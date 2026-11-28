/* ผู้ช่วยถาม-ตอบข้อมูลในแอพ — ใช้ API key กลางชุดเดิม (ai.enc เข้ารหัสด้วยรหัสเข้าเว็บ) หรือ key ส่วนตัวที่ใส่เอง
   รูปแบบการเรียกเหมือนแอพเดิม : โมเดลไม่ได้รับฐานข้อมูลทั้งก้อน ใช้เครื่องมือที่ทำงานในเบราว์เซอร์ ตัวเลขทุกตัวคำนวณด้วยโค้ด */
(() => {
  "use strict";
  const AI_URL = "https://api.anthropic.com/v1/messages", AI_VERSION = "2026-10-21";
  const MODELS = [["claude-opus-5-5", "Claude Opus 5.5"], ["claude-sonnet-5-5", "Claude Sonnet 5.5 (เร็วกว่า)"], ["claude-haiku-5-5", "Claude Haiku 5.5 (เร็วที่สุด)"]];
  const MAX_TURNS = 10, MAX_RESULT = 60000;
  let SHARED = null, MSGS = [], BUSY = false, ABORT = null, ERR = "", SETUP = false;
  const LSg = () => { try { return JSON.parse(localStorage.getItem("atm_ai")) || {}; } catch (e) { return {}; } };
  const LSs = (v) => { try { localStorage.setItem("atm_ai", JSON.stringify(v)); } catch (e) { } };
  const conf = () => { const o = LSg(); return o.key ? { key: o.key, model: o.model, src: "own" } : SHARED ? { key: SHARED.key, model: o.model || SHARED.model, src: "shared" } : o; };
  async function loadShared() {
    try { const f = await fetchEnc("ai.enc"); const s = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: f.iv }, KEY, f.ct))); if (s && s.key) SHARED = s; } catch (e) { SHARED = null; }
  }

  /* ---------- เครื่องมือ ---------- */
  const TOOLS = [
    { name: "get_overview", description: "ภาพรวม 3 บัญชีเป้าหมาย: ช่องทางเงินเข้า ยอดเข้า-ออก จำนวนสาขา/ตู้/รอบตะเวนฝาก สาขาเจ้าของบัญชี จุดถอนเงินสด", input_schema: { type: "object", properties: {} } },
    { name: "list_accounts", description: "รายชื่อบัญชีทั้งหมดในสำนวนที่มีรายการผ่านตู้/สาขา (ใช้หาเลขบัญชีก่อนเรียกเครื่องมืออื่น)", input_schema: { type: "object", properties: { search: { type: "string" } } } },
    { name: "query_events", description: "รายการฝาก/ถอน/โอนผ่านตู้และสาขา ของทุกบัญชี กรองและสรุปได้ kinds: D=ฝากเงินสด X=รับโอนผ่านตู้ W=ถอนเงินสด O=โอนออกผ่านตู้",
      input_schema: { type: "object", properties: { accounts: { type: "array", items: { type: "string" }, description: "เลขบัญชีหรือบางส่วนของชื่อ ; ไม่ใส่ = ทุกบัญชี" }, kinds: { type: "array", items: { type: "string", enum: ["D", "X", "W", "O"] } },
        date_from: { type: "string", description: "YYYY-MM-DD" }, date_to: { type: "string" }, place: { type: "string", description: "บางส่วนของชื่อสาขา จังหวัด รหัสสาขา หรือรหัสตู้" },
        group_by: { type: "string", enum: ["none", "place", "account", "day", "hour", "counterparty", "province"] }, limit: { type: "integer" } } } },
    { name: "find_cooccurrence", description: "หาเหตุการณ์ที่คนละบัญชี (คนละเจ้าของ) ทำรายการ ณ จุดเดียวกันหรือในรัศมีที่กำหนด ภายในเวลาที่กำหนด — ใช้ชี้ว่าน่าจะเป็นกลุ่มเดียวกัน",
      input_schema: { type: "object", properties: { radius_km: { type: "number" }, minutes: { type: "number" }, accounts: { type: "array", items: { type: "string" } }, date_from: { type: "string" }, date_to: { type: "string" }, limit: { type: "integer" } } } },
    { name: "get_people", description: "บุคคลที่โอนผ่านตู้ ATM เข้าบัญชีเป้าหมาย พร้อมบทบาทสันนิษฐาน (L1 ผู้ควบคุม / L2 ผู้ประสาน / L3 ผู้ปฏิบัติ) คะแนน และพฤติการณ์", input_schema: { type: "object", properties: { role: { type: "string", enum: ["L1", "L2", "L3"] }, search: { type: "string" }, limit: { type: "integer" } } } },
    { name: "get_runs", description: "รอบตะเวนฝากเงินสดของบัญชีเป้าหมาย (ฝากต่อเนื่องห่างกันไม่เกิน 20 นาที) เรียงตามยอด", input_schema: { type: "object", properties: { account: { type: "string", enum: ["ykk", "kes", "ora"] }, limit: { type: "integer" } }, required: ["account"] } },
    { name: "get_links", description: "ความเชื่อมโยงของบัญชีเป้าหมายกับบัญชีอื่นในสำนวน (โอนตรง / ตู้เดียวกันภายใน 1 ชม. / คู่โอนร่วม)", input_schema: { type: "object", properties: {} } },
  ];
  const r2 = (x) => Math.round(x * 100) / 100;
  function pickAccs(list) {
    const A = DB.map.accs; if (!list || !list.length) return null;
    const s = new Set(); list.forEach((q) => { const d = String(q).replace(/\D/g, ""), l = String(q).toLowerCase(); A.forEach((a) => { if ((d.length >= 5 && a.acc.replace(/^0+/, "").includes(d.replace(/^0+/, ""))) || a.name.toLowerCase().includes(l) || a.id === l) s.add(a.i); }); });
    return s;
  }
  function runTool(name, inp) {
    try {
      mapInit(); inp = inp || {};
      const A = DB.map.accs, P = DB.map.places; let out;
      if (name === "get_overview") out = { case: DB.case, built: DB.built, note: DB.map.geo_note, accounts: DB.acs.map((a) => ({ id: a.id, no: a.no, name: a.name, bank: a.bank, acc: a.acc, period: [a.first, a.last], in: r2(a.in), out: r2(a.out), home_branch: a.home, channels_in: a.chan.map((c) => ({ type: c.lab, n: c.n, amt: r2(c.amt) })), n_branches_known: a.branches.length, n_machines: a.machines.length, n_runs: a.runs.length, provinces: a.prov.slice(0, 12), cash_out_points: a.cashout.slice(0, 6), top_branches: a.branches.slice(0, 10).map((b) => ({ code: b.code, name: b.name, prov: b.prov, n: b.n, amt: r2(b.amt) })) })) };
      else if (name === "list_accounts") { const q = (inp.search || "").toLowerCase(); out = A.filter((a) => !q || (a.name + a.acc).toLowerCase().includes(q)).map((a) => ({ name: a.name, bank: a.bank, acc: a.acc, focus: a.id || undefined, events: a.n })); }
      else if (name === "query_events") {
        const ks = inp.kinds && inp.kinds.length ? new Set(inp.kinds) : null, pq = (inp.place || "").toLowerCase();
        let ev = mapFilter({ accs: pickAccs(inp.accounts), kind: "", from: inp.date_from || "", to: inp.date_to || "" }).filter((e) => (!ks || ks.has(e.k)) && (!pq || (P[e.p].name + " " + P[e.p].prov + " " + P[e.p].code + " " + e.mk).toLowerCase().includes(pq)));
        const lim = Math.min(inp.limit || 40, 200), g = inp.group_by || "none", tot = { n: ev.length, amt: r2(ev.reduce((s, e) => s + e.amt, 0)) };
        if (g === "none") out = { total: tot, rows: ev.slice(0, lim).map((e) => ({ time: isoSec(e.t), account: A[e.a].name, kind: MK[e.k][0], amt: e.amt, place: plName(P[e.p]), located: P[e.p].lat != null, inferred: !!e.inf, machine: e.mk, counterparty: e.nm || undefined })) };
        else { const kf = { place: (e) => plName(P[e.p]) + (P[e.p].lat == null ? " (ไม่ทราบพิกัด)" : ""), account: (e) => A[e.a].name + " " + A[e.a].bank + " " + A[e.a].acc, day: (e) => isoMin(e.t).slice(0, 10), hour: (e) => isoMin(e.t).slice(11, 13) + ":00", counterparty: (e) => e.nm || "(ไม่ระบุ/เงินสด)", province: (e) => P[e.p].prov || "(ไม่ทราบ)" }[g];
          const m = new Map(); ev.forEach((e) => { const k = kf(e), o = m.get(k) || { key: k, n: 0, amt: 0, accounts: new Set() }; o.n++; o.amt += e.amt; o.accounts.add(A[e.a].name); m.set(k, o); });
          out = { total: tot, groups: [...m.values()].sort((a, b) => (g === "day" || g === "hour" ? a.key.localeCompare(b.key) : b.amt - a.amt)).slice(0, lim).map((o) => ({ key: o.key, n: o.n, amt: r2(o.amt), accounts: [...o.accounts].slice(0, 8) })) }; }
      }
      else if (name === "find_cooccurrence") {
        const R = inp.radius_km == null ? 5 : inp.radius_km, T = inp.minutes == null ? 60 : inp.minutes;
        const inc = coFind(mapFilter({ accs: pickAccs(inp.accounts), kind: "", from: inp.date_from || "", to: inp.date_to || "" }), R, T);
        out = { radius_km: R, minutes: T, rule: "จุดเดียวกัน = ตู้เดียวกัน (รหัสตู้) หรือสาขาเดียวกัน ; พิกัดเป็นตำแหน่งสาขาเจ้าของตู้โดยประมาณ (รหัสตู้ไม่ครบไม่นับ) ; บัญชีชื่อเจ้าของเดียวกันไม่นับ", incidents: inc.length,
          rows: inc.slice(0, Math.min(inp.limit || 30, 80)).map((x) => ({ from: isoMin(x.t0), to: isoMin(x.t1), places: x.pl.map((p) => plName(P[p])), accounts: x.accs.map((a) => A[a].name + " " + A[a].bank + " " + A[a].acc), n: x.n, amt: r2(x.amt), max_km: r2(x.d), events: x.es.slice(0, 12).map((e) => `${isoMin(e.t).slice(11)} ${A[e.a].name} ${MK[e.k][0]} ${e.amt} ${e.mk}`) })) };
      }
      else if (name === "get_people") { const q = (inp.search || "").toLowerCase(); out = DB.people.filter((p) => (!inp.role || p.role === inp.role) && (!q || (p.name + p.accs.map((a) => a.acc).join(" ")).toLowerCase().includes(q))).slice(0, Math.min(inp.limit || 30, 100)).map((p) => ({ name: p.name, role: p.role, score: p.score, accounts: p.accs.map((a) => a.bank + " " + a.acc), n: p.n, amt: r2(p.amt), into: p.dst, behaviours: p.why, same_machine_with: p.ties })); }
      else if (name === "get_runs") { const a = DB.acs.find((x) => x.id === inp.account); out = a ? { account: a.name, runs: a.runs.length, top: [...a.runs].sort((x, y) => y.amt - x.amt).slice(0, Math.min(inp.limit || 25, 80)).map((r) => ({ start: r.st, end: r.en, minutes: r.min, n: r.n, amt: r2(r.amt), cash_est: r.cash, route: r.route, banks: r.banks, anchor: r.loc ? r.loc.name + " " + r.loc.prov : undefined, area: r.area })) } : { error: "ไม่พบบัญชี" }; }
      else if (name === "get_links") out = DB.links.map((l) => ({ focus: l.a, other: l.oname + " " + l.obank + " " + l.o, direct: l.direct, same_machine_within_1h: l.same.slice(0, 10), common_counterparties: l.common.slice(0, 10) }));
      else return { content: "ไม่รู้จักเครื่องมือนี้", is_error: true };
      let s = JSON.stringify(out); if (s.length > MAX_RESULT) s = s.slice(0, MAX_RESULT) + '…(ตัดเพราะยาวเกิน ลองกรองให้แคบลง)';
      return { content: s };
    } catch (e) { return { content: "เครื่องมือผิดพลาด: " + e.message, is_error: true }; }
  }
  const systemPrompt = () => `คุณเป็นผู้ช่วยนักวิเคราะห์เส้นทางการเงินของชุดสืบสวน ตอบเป็นภาษาไทย กระชับ ตรงประเด็น
ข้อมูลคือรายการฝาก/ถอน/โอนผ่านตู้ ATM ตู้ฝากเงินสด และเคาน์เตอร์สาขา ของบัญชีในสำนวน "${DB.case}" (ข้อมูล ณ ${DB.built}) บัญชีเป้าหมาย: ${DB.acs.map((a) => `${a.id} = ${a.name} ${a.bank} ${a.acc}`).join(" ; ")}
กติกา: (1) ตัวเลขทุกตัวต้องมาจากเครื่องมือ ห้ามประมาณเอง (2) ที่ตั้งทราบเฉพาะตู้/สาขาของธนาคารเจ้าของบัญชี พิกัดเป็นระดับอำเภอ/ย่านโดยประมาณ ตู้ธนาคารอื่นทราบเพียงรหัสตู้ (3) บทบาทหัวหน้า-ลูกน้องเป็นข้อสันนิษฐานจากพฤติการณ์ทางการเงิน ต้องบอกว่าเป็นข้อสันนิษฐานและควรยืนยันด้วย CCTV / KYC (4) รหัสตู้บางรูปแบบเป็น "รหัสกลุ่ม" ไม่ระบุเครื่องเฉพาะ (เช่น GSB T091B0, BBL A902B6, BBL 002-59 — พบรหัสเดียวกันหลายจังหวัด) ห้ามสรุปว่าเป็นตู้เครื่องเดียวกันจากรหัสกลุ่ม ; ตู้ KTB รหัส K + 5 หลัก ระบุเครื่องได้ (5) ถ้าข้อมูลไม่พอให้บอกตรง ๆ และเสนอว่าควรขอข้อมูลอะไรเพิ่ม (6) ใช้ข้อความธรรมดาและรายการหัวข้อย่อย ไม่ใช้ตาราง`;

  async function callApi() {
    const c = conf(), model = c.model || MODELS[0][0];
    const headers = { "content-type": "application/json", "x-api-key": c.key, "anthropic-version": AI_VERSION, "anthropic-dangerous-direct-browser-access": "true" };
    const body = { model, max_tokens: 16000, system: systemPrompt(), tools: TOOLS, messages: MSGS, output_config: { effort: "medium" } };
    if (model !== "claude-haiku-5-5") { headers["anthropic-beta"] = "server-side-fallback-2026-07-01"; body.fallbacks = "default"; }
    ABORT = new AbortController();
    let res;
    try { res = await fetch(AI_URL, { method: "POST", headers, body: JSON.stringify(body), signal: ABORT.signal }); }
    catch (e) { throw new Error(e.name === "AbortError" ? "ยกเลิกแล้ว" : "เชื่อมต่อผู้ให้บริการ AI ไม่ได้ (เครือข่าย หรือเบราว์เซอร์บล็อกคำขอ)"); }
    if (!res.ok) {
      let m = ""; try { m = ((await res.json()).error || {}).message || ""; } catch (e) { }
      const t = res.status === 401 ? "API key ไม่ถูกต้อง หรือถูกยกเลิก" : res.status === 403 ? "API key ไม่มีสิทธิ์ใช้งานส่วนนี้" : res.status === 404 ? "ไม่พบโมเดลที่เลือก" : res.status === 429 ? "ใช้งานถี่เกินโควตา ลองใหม่อีกครั้งในอีกสักครู่" : res.status >= 500 ? "ระบบของผู้ให้บริการ AI ขัดข้องชั่วคราว" : "คำขอไม่ถูกต้อง";
      throw new Error(`${t} (HTTP ${res.status})${m ? " — " + m.slice(0, 200) : ""}`);
    }
    return res.json();
  }
  async function ask(text) {
    if (BUSY || !text.trim()) return;
    const base = MSGS.length; ERR = ""; BUSY = true; MSGS.push({ role: "user", content: text }); draw();
    try {
      for (let turn = 0; turn < MAX_TURNS; turn++) {
        const r = await callApi();
        MSGS.push({ role: "assistant", content: r.content });
        if (r.stop_reason === "refusal") { ERR = "ผู้ช่วยปฏิเสธคำถามนี้ ลองถามใหม่ด้วยถ้อยคำอื่น"; break; }
        if (r.stop_reason === "max_tokens") { ERR = "คำตอบยาวเกินกำหนดจึงถูกตัด ลองถามให้แคบลง"; break; }
        if (r.stop_reason !== "tool_use") break;
        const uses = r.content.filter((b) => b.type === "tool_use");
        draw(uses.map((u) => u.name));
        MSGS.push({ role: "user", content: uses.map((u) => ({ type: "tool_result", tool_use_id: u.id, ...runTool(u.name, u.input) })) });
        if (turn === MAX_TURNS - 1) ERR = "ค้นข้อมูลหลายรอบเกินกำหนด ลองถามให้เจาะจงขึ้น";
      }
    } catch (e) { MSGS.length = base; ERR = e.message || String(e); $("#aiQ") && ($("#aiQ").value = text); }
    BUSY = false; ABORT = null; draw();
  }

  /* ---------- หน้าจอ ---------- */
  const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/^\s*[-•]\s+(.*)$/gm, '<span class="ai2-li">$1</span>').replace(/^#{1,4}\s*(.*)$/gm, "<b>$1</b>").replace(/<\/span>\n+/g, "</span>").replace(/\n/g, "<br>");
  const SUG = ["สรุปจุดที่ฝากเงินสดเข้า 3 บัญชี แยกจังหวัด", "มีบัญชีไหนทำรายการจุดเดียวกันพร้อมกันบ้าง ในรัศมี 5 กม. 60 นาที", "ใครน่าจะเป็นหัวหน้ากลุ่ม เพราะอะไร", "ช่วงเวลาไหนที่ฝากเงินสดบ่อยที่สุด", "ควรขอ CCTV ตู้ไหน วันเวลาใดก่อน"];
  function draw(tools) {
    const box = $("#aiBody"); if (!box) return; const c = conf();
    if (!c.key || SETUP) {
      box.innerHTML = `<div class="ai2-set"><b>ตั้งค่า API key</b><p class="note">${SHARED ? "มี key กลางชุดเดิมอยู่แล้ว — ใส่ key ส่วนตัวเฉพาะเมื่อต้องการใช้แทน" : "ไม่พบ key กลาง (ai.enc) — ใส่ API key ของ Claude เพื่อใช้งาน"} · key ส่วนตัวเก็บในเบราว์เซอร์เครื่องนี้เท่านั้น</p>
        <input class="tin" id="aiKey" type="password" placeholder="sk-ant-…" autocomplete="off" style="width:100%"><select class="tin" id="aiModel" style="width:100%;margin-top:6px">${MODELS.map(([v, l]) => `<option value="${v}" ${v === (c.model || MODELS[0][0]) ? "selected" : ""}>${l}</option>`).join("")}</select>
        <div style="display:flex;gap:6px;margin-top:8px"><button class="tb on" id="aiSave">บันทึก</button>${SHARED ? `<button class="tb" id="aiShared">ใช้ key กลาง</button>` : ""}${LSg().key ? `<button class="tb" id="aiDel">ลบ key ส่วนตัว</button>` : ""}</div>
        <p class="note">คำถามและผลจากเครื่องมือ (มีชื่อบุคคล เลขบัญชี ยอดเงิน) จะถูกส่งไปยังผู้ให้บริการ AI</p></div>`;
      return;
    }
    let h = "";
    MSGS.forEach((m) => {
      if (m.role === "user" && typeof m.content === "string") h += `<div class="ai2-m u">${esc(m.content)}</div>`;
      else if (m.role === "assistant") { const t = m.content.filter((b) => b.type === "text" && b.text.trim()).map((b) => b.text).join("\n\n"); if (t) h += `<div class="ai2-m a">${md(t)}</div>`; }
    });
    if (!MSGS.length) h = `<div class="ai2-sug"><p class="note">ถามข้อมูลในแอพได้เลย เช่น</p>${SUG.map((s) => `<button class="tb" data-sug="${esc(s)}">${esc(s)}</button>`).join("")}</div>`;
    if (BUSY) h += `<div class="ai2-m a busy">${tools ? "กำลังค้นข้อมูล: " + tools.join(", ") : "กำลังคิด…"}</div>`;
    if (ERR) h += `<div class="ai2-m e">${esc(ERR)}</div>`;
    box.innerHTML = h; box.scrollTop = box.scrollHeight;
    $("#aiLab").textContent = ((MODELS.find((m) => m[0] === (c.model || MODELS[0][0])) || [0, c.model || ""])[1]).split(" (")[0] + (c.src === "shared" ? " · key กลาง" : " · key ส่วนตัว");
    $("#aiSend").textContent = BUSY ? "หยุด" : "ส่ง";
  }
  window.aiMount = async function () {
    if ($("#aiFab")) return;
    await loadShared();
    document.body.insertAdjacentHTML("beforeend", `<button id="aiFab" class="ai2-fab" title="ถามผู้ช่วย AI" aria-label="ถามผู้ช่วย AI"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M9 11h.01M12 11h.01M15 11h.01"/></svg></button>
      <section id="aiPanel" class="ai2-panel" hidden><header><b>ผู้ช่วยถาม-ตอบ</b><small id="aiLab"></small><button class="ib" id="aiNew" title="เริ่มใหม่">↺</button><button class="ib" id="aiCfg" title="ตั้งค่า key">⚙</button><button class="ib" id="aiX" title="ปิด">✕</button></header>
      <div id="aiBody" class="ai2-body"></div><form id="aiForm" class="ai2-form"><textarea id="aiQ" class="tin" rows="1" placeholder="พิมพ์คำถาม…"></textarea><button class="tb on" id="aiSend" type="submit">ส่ง</button></form></section>`);
    $("#aiFab").onclick = () => { const p = $("#aiPanel"); p.hidden = !p.hidden; if (!p.hidden) { draw(); $("#aiQ").focus(); } };
    $("#aiX").onclick = () => ($("#aiPanel").hidden = true);
    $("#aiNew").onclick = () => { if (BUSY) return; MSGS = []; ERR = ""; SETUP = false; draw(); };
    $("#aiCfg").onclick = () => { SETUP = !SETUP; draw(); };
    $("#aiForm").addEventListener("submit", (e) => { e.preventDefault(); if (BUSY) { ABORT && ABORT.abort(); return; } const q = $("#aiQ").value; $("#aiQ").value = ""; ask(q); });
    $("#aiQ").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#aiForm").requestSubmit(); } });
    $("#aiBody").addEventListener("click", (e) => {
      const s = e.target.closest("[data-sug]"); if (s) return ask(s.dataset.sug);
      if (e.target.id === "aiSave") { const k = $("#aiKey").value.trim(); if (!k && !SHARED) return toast("ยังไม่ได้ใส่ API key"); LSs(k ? { key: k, model: $("#aiModel").value } : { model: $("#aiModel").value }); SETUP = false; draw(); }
      else if (e.target.id === "aiShared") { LSs({ model: $("#aiModel").value }); SETUP = false; draw(); }
      else if (e.target.id === "aiDel") { LSs({}); SETUP = false; draw(); }
    });
  };
  window.__aiTest = { runTool };
})();
