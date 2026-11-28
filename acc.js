/* ================= บัญชี: รายบัญชี · เปรียบเทียบความสัมพันธ์ · รายชื่อทั้งหมด =================
   - ค่าเริ่มต้น = 3 บัญชีหลัก ; เลือกตามหน้าแผนที่ได้ ; เพิ่ม/ตัดบัญชีได้ที่หน้านี้
   - รายละเอียดบัญชีอื่น (นอก 3 บัญชีหลัก) อยู่ในไฟล์ acc.enc โหลดเมื่อเปิดดูครั้งแรก */
const ACC = { mapSig: undefined, cmpPair: null };
const ACC_KEY = "atm_acc_sel";
const ACC_PAL = ["#00838F", "#6A1B9A", "#E08A00", "#5D4037", "#AD1457", "#283593", "#827717", "#BF360C", "#455A64", "#00695C", "#4527A0", "#9E9D24"];
const SYS_ACC = new Set(["16056210"]);
let ACCD = null, ACCD_P = null;
const accK = (acc) => String(acc || "").replace(/^0+/, "");
const accShort = (n) => String(n || "").replace(/^(บริษัท|น\.ส\.?|นางสาว|นาย|นาง|MR\.?|MRS\.?|MS\.?|MISS)\s*/i, "").replace(/\s*จำกัด$/, "");

/* ดัชนีบัญชีทุกบัญชีในสำนวน: key = เลขบัญชีตัดเลข 0 นำหน้า */
function accIndex() {
  if (ACC.ix) return ACC.ix;
  mapInit();
  const ix = new Map(), mi = new Map();
  DB.map.accs.forEach((a) => mi.set(accK(a.acc), a.i));
  DB.accounts.forEach((x, n) => {
    const k = accK(x.acc), f = x.id ? DB.acs.find((a) => a.id === x.id) : null, i = mi.has(k) ? mi.get(k) : -1;
    ix.set(k, { k, acc: f ? f.acc : x.acc, name: x.name, short: f ? f.short.replace(/^(บ\.|น\.ส\.)\s*/, "") : accShort(x.name), bank: x.bank, id: x.id || "", no: f ? f.no : 0,
      detail: x.detail !== false, rows: x.rows, first: x.first, last: x.last, in: x.in, out: x.out, mi: i,
      col: x.id ? ACOL[x.id] : i >= 0 ? DB.map.accs[i].col : ACC_PAL[n % ACC_PAL.length] });
  });
  ACC.ix = ix;
  ACC.nEv = new Map(); MAPX.ev.forEach((e) => { const k = accK(DB.map.accs[e.a].acc); ACC.nEv.set(k, (ACC.nEv.get(k) || 0) + 1); });
  return ix;
}
const accFocus = () => [...accIndex().values()].filter((x) => x.id).sort((a, b) => a.no - b.no).map((x) => x.k);
const accMapSel = () => [...MAPX.f.accs].map((i) => accK(DB.map.accs[i].acc));
const accChip = (x, extra = "") => `<span class="badge" style="background:${x.col}1f;color:${x.col}">${av(x.name)}${x.no ? x.no + ". " : ""}${esc(x.short.slice(0, 24))}</span>${extra}`;
const accLink = (k) => { const x = accIndex().get(k); return x ? `<a class="badge" href="#acc/${k}" title="ดูรายละเอียดบัญชี" style="background:${x.col}1f;color:${x.col}">${av(x.name)}${x.no ? x.no + ". " : ""}${esc(x.short.slice(0, 24))}</a>` : esc(k); };
const cmpHref = (ks) => "#acc/cmp/" + [...new Set(ks)].join("~");
const cmpLink = (ks) => (new Set(ks).size > 1 ? ` <a class="cmpl" href="${cmpHref(ks)}" title="เปรียบเทียบความสัมพันธ์ของบัญชีเหล่านี้">⇄ เปรียบเทียบ</a>` : "");

/* รายละเอียดบัญชี: 3 บัญชีหลักอยู่ใน DB.acs ; บัญชีอื่นโหลดจาก acc.enc ครั้งเดียว */
async function accLoadAll() {
  if (ACCD) return ACCD;
  if (!ACCD_P) ACCD_P = (async () => { const f = await fetchEnc("acc.enc"); ACCD = await gunzipJSON(await crypto.subtle.decrypt({ name: "AES-GCM", iv: f.iv }, KEY, f.ct)); return ACCD; })()
    .catch((e) => { ACCD_P = null; throw e; });
  return ACCD_P;
}
function accGet(k) { const f = DB.acs.find((a) => accK(a.acc) === k); return f || (ACCD && ACCD[k]) || null; }
async function accNeed(ks) { if (ks.some((k) => !DB.acs.find((a) => accK(a.acc) === k))) await accLoadAll(); return ks.map(accGet); }

/* บัญชีที่เลือก: ตามหน้าแผนที่ (เมื่อแผนที่เปลี่ยน) ; ปรับเพิ่ม/ตัดที่หน้านี้ได้ (จำไว้ในเครื่อง) */
function accSelInit() {
  const ix = accIndex(), g = gSel();
  ACC.sel = accSort((g || accFocus()).filter((k) => ix.has(k)));
  if (!g) accSelSave();
}
const accSelSave = () => gSelMerge([...accIndex().keys()], ACC.sel);
const accSort = (ks) => { const ix = accIndex(); return ks.map((k, i) => [k, i]).sort((x, y) => (ix.get(x[0]).no || 99) - (ix.get(y[0]).no || 99) || x[1] - y[1]).map((x) => x[0]); };   // 3 บัญชีหลักเรียง 1-2-3 ก่อน
function accSelSet(ks) { ACC.sel = accSort([...new Set(ks)].filter((k) => accIndex().has(k))); accSelSave(); }

/* ---------- หน้า ---------- */
function pAccPage(m) {
  accIndex(); accSelInit();
  const parts = location.hash.slice(1).split("/");
  let mode = "one", cur = null, tab = "";
  if (parts[1] === "list") mode = "list";
  else if (parts[1] === "cmp") {
    mode = "cmp"; const ks = (parts[2] || "").split("~").map(decodeURIComponent).filter((k) => ACC.ix.has(k));
    if (ks.length >= 2 && ks.join() !== ACC.sel.join()) { accSelSet(ks); setTimeout(() => toast(`เปรียบเทียบ ${ks.length} บัญชี — กด "3 หลัก" เพื่อกลับค่าเริ่มต้น`), 60); }
  } else if (parts[1] && ACC.ix.has(parts[1])) { cur = parts[1]; tab = parts[2] || ""; if (!ACC.sel.includes(cur)) accSelSet([...ACC.sel, cur]); }
  if (mode === "one" && !cur) cur = ACC.sel[0] || accFocus()[0];
  ACC.mode = mode; ACC.cur = cur;
  m.innerHTML = `<div id="accRoot">
    <div class="accbar2">
      <details class="pick" id="accPick"><summary class="tb">${IC("user", 15)} เลือกบัญชี</summary><div class="pick-box">
        <div class="pick-q"><input class="tin" type="search" placeholder="ค้นหาชื่อ / เลขบัญชี" id="accQ"><button class="tb" data-q="m" title="ใช้บัญชีที่เลือกในหน้าแผนที่">ตามแผนที่</button><button class="tb" data-q="f">3 หลัก</button><button class="tb" data-q="n">ล้าง</button></div>
        <div class="pick-list" id="accL"></div></div></details>
      <div class="accchips" id="accChips"></div>
      <div class="seg" id="accMode"></div>
      <button class="tb ic" id="accMap" title="แสดงบัญชีที่เลือกบนแผนที่" aria-label="แผนที่">${IC("pin", 16)}</button></div>
    <div id="accBody" class="sec"></div></div>`;
  const root = $("#accRoot");
  const ix = ACC.ix;
  const chips = () => {
    $("#accChips").innerHTML = ACC.sel.map((k) => { const x = ix.get(k); return `<span class="achip${mode === "one" && k === cur ? " on" : ""}" data-k="${k}" style="--c:${x.col}" title="${esc(x.bank + " " + x.acc + " " + x.name)}"><i></i>${x.no ? x.no + ". " : ""}${esc(x.short.slice(0, 22))}<button data-rm="${k}" aria-label="เอาออก">✕</button></span>`; }).join("") || `<span class="muted">ยังไม่ได้เลือกบัญชี — กด "เลือกบัญชี"</span>`;
    $("#accMode").innerHTML = [["one", "รายบัญชี"], ["cmp", `เปรียบเทียบ ${ACC.sel.length}`], ["list", `ทั้งหมด ${ix.size}`]].map(([k, l]) => `<button data-md="${k}" class="${k === mode ? "on" : ""}">${l}</button>`).join("");
  };
  const list = () => { const q = $("#accQ").value.trim().toLowerCase();
    $("#accL").innerHTML = [...ix.values()].filter((x) => !q || (x.name + " " + x.acc + " " + x.bank).toLowerCase().includes(q))
      .sort((a, b) => (b.id ? 1 : 0) - (a.id ? 1 : 0) || (ACC.nEv.get(b.k) || 0) - (ACC.nEv.get(a.k) || 0) || b.in - a.in)
      .map((x) => `<label><input type="checkbox" value="${x.k}" ${ACC.sel.includes(x.k) ? "checked" : ""}><span class="dot" style="background:${x.col}"></span><span class="nm">${esc(x.name)}</span><small>${esc(x.bank)} ${esc(x.acc)}${x.detail ? "" : " · ไม่มีรายละเอียด"}</small></label>`).join(""); };
  chips(); list();
  const reload = () => { chips(); list(); body(); };
  $("#accQ").addEventListener("input", list);
  $("#accL").addEventListener("change", (e) => { if (e.target.type !== "checkbox") return; const k = e.target.value;
    accSelSet(e.target.checked ? [...ACC.sel, k] : ACC.sel.filter((x) => x !== k));
    if (mode === "one" && !ACC.sel.includes(cur)) cur = ACC.sel[0]; if (mode === "one" && e.target.checked) cur = k; ACC.cur = cur; reload(); });
  $("#accPick").addEventListener("click", (e) => { const b = e.target.closest("[data-q]"); if (!b) return;
    accSelSet(b.dataset.q === "m" ? accMapSel() : b.dataset.q === "f" ? accFocus() : []); cur = ACC.sel[0]; ACC.cur = cur; reload(); });
  const outPick = (e) => { const p = $("#accPick"); if (!p) return document.removeEventListener("click", outPick); if (p.open && !p.contains(e.target)) p.open = false; };
  document.addEventListener("click", outPick);
  root.addEventListener("click", (e) => {
    const rm = e.target.closest("[data-rm]"); if (rm) { e.stopPropagation(); accSelSet(ACC.sel.filter((x) => x !== rm.dataset.rm)); if (cur === rm.dataset.rm) cur = ACC.sel[0]; ACC.cur = cur; reload(); return; }
    const ch = e.target.closest(".achip[data-k]"); if (ch) { mode = "one"; cur = ch.dataset.k; ACC.mode = mode; ACC.cur = cur; tab = ""; setHash(); chips(); body(); return; }
    const md = e.target.closest("[data-md]"); if (md) { mode = md.dataset.md; ACC.mode = mode; if (mode === "one" && !cur) cur = ACC.sel[0]; setHash(); chips(); body(); }
  });
  $("#accMap").addEventListener("click", () => { const is = ACC.sel.map((k) => ix.get(k).mi).filter((i) => i >= 0);
    if (!is.length) return toast("บัญชีที่เลือกไม่มีรายการที่ตู้/สาขา (ไม่มีจุดบนแผนที่)");
    MAPX.f.accs = new Set(is); ACC.mapSig = accMapSel().sort().join(","); go("map"); });
  const setHash = () => { const h = mode === "list" ? "#acc/list" : mode === "cmp" ? cmpHref(ACC.sel) : cur ? "#acc/" + cur : "#acc"; try { history.replaceState(null, "", h); } catch (e) { } };
  const body = async () => {
    const host = $("#accBody"); CH.forEach((c) => c.destroy()); CH = [];
    if (mode === "list") return accList(host, reload);
    const ks = mode === "one" ? (cur ? [cur] : []) : ACC.sel;
    if (!ks.length) { host.innerHTML = `<div class="empty card">เลือกบัญชีอย่างน้อย ${mode === "cmp" ? 2 : 1} บัญชี</div>`; return; }
    if (mode === "cmp" && ks.length < 2) { host.innerHTML = `<div class="empty card">เลือกบัญชีอย่างน้อย 2 บัญชีเพื่อเปรียบเทียบ — กด "เลือกบัญชี" หรือไปที่ "รายชื่อทั้งหมด"</div>`; return; }
    const noDet = ks.filter((k) => !ix.get(k).detail);
    if (ks.some((k) => !DB.acs.find((a) => accK(a.acc) === k)) && !ACCD) host.innerHTML = `<div class="empty card">กำลังโหลดรายละเอียดบัญชี…</div>`;
    let objs; try { objs = await accNeed(ks); } catch (e) { host.innerHTML = `<div class="errbox">โหลดรายละเอียดบัญชีไม่ได้: ${esc(e.message)}</div>`; return; }
    if (!$("#accBody") || $("#accBody") !== host) return;          // เปลี่ยนหน้าไปแล้ว
    if (mode === "one") {
      const x = ix.get(cur), a = objs[0];
      if (!a) { host.innerHTML = `<div class="card"><h3>${esc(x.name)}</h3><p class="note">${esc(x.bank)} ${esc(x.acc)} · ${nf(x.rows)} แถว — ไม่มีรายการที่มีวันเวลาในไฟล์ จึงวิเคราะห์รายละเอียดไม่ได้</p></div>`; return; }
      host.innerHTML = `<div id="accOne"></div>`;
      pAccView(a, $("#accOne"), x.col, "acc/" + cur, tab);
    } else accCompare(host, ks, objs.map((a, i) => a || null), noDet);
  };
  body();
}

/* ---------- รายชื่อบัญชีทั้งหมด (ติ๊กเลือก / ดู) ---------- */
function accList(host, reload) {
  const ix = ACC.ix, lk = new Map();
  DB.links.forEach((l) => { const o = lk.get(l.o) || []; o.push(l); lk.set(l.o, o); });
  const rows = [...ix.values()].map((x) => Object.assign({}, x, { nev: ACC.nEv.get(x.k) || 0, lnk: lk.get(x.k) || [] }));
  const sk = DB.skipped || [];
  host.innerHTML = `${sk.length ? `<details class="tnote warnline"><summary>⚠ ไฟล์ที่ระบบอ่านไม่ได้ ${sk.length} ไฟล์</summary><p class="note">${sk.map((x) => `${esc(x[0].split("/").pop())} <small>(${esc(x[1])})</small>`).join(" · ")}</p></details>` : ""}<div id="accLT"></div>`;
  table($("#accLT"), { title: "บัญชีทั้งหมด", sub: "ติ๊ก = เลือกเข้าชุด (ดูรายบัญชี/เปรียบเทียบ) · กดแถว = ดูรายละเอียด", rows: () => rows, sort: "nev", csvName: "บัญชีทั้งหมด", lead: false, max: 300,
    cols: [{ k: "sel", lab: "เลือก", f: (x) => `<input type="checkbox" data-ck="${x.k}" ${ACC.sel.includes(x.k) ? "checked" : ""} aria-label="เลือก">`, v: (x) => (ACC.sel.includes(x.k) ? "เลือก" : "") },
      { k: "name", lab: "ชื่อบัญชี", f: (x) => accChip(x), v: (x) => x.name }, { k: "grp", lab: "กลุ่ม", v: (x) => (x.id ? "บัญชีเป้าหมาย" : "บัญชีเกี่ยวข้อง") },
      { k: "bank", lab: "ธนาคาร", f: (x) => bankIco(x.bank) + esc(x.bank), v: (x) => x.bank }, { k: "acc", lab: "เลขบัญชี" }, { k: "src", lab: "แหล่งข้อมูล", f: (x) => srcTag(x.acc), v: (x) => ((DB.srcf || {})[x.k] || []).map((f) => (f === "bank" ? "ขอตรงธนาคาร" : f)).join(" + ") }, { k: "nev", lab: "รายการที่ตู้/สาขา", n: 1 },
      { k: "in", lab: "เงินเข้า", n: 1, f: (x) => M(x.in) }, { k: "out", lab: "เงินออก", n: 1, f: (x) => M(x.out) }, { k: "rows", lab: "แถว", n: 1 },
      { k: "first", lab: "ช่วงข้อมูล", f: (x) => (x.first ? `${dS(x.first)} – ${dS(x.last)}` : "-"), range: (x) => [x.first, x.last] },
      { k: "lnk", lab: "เชื่อมโยงกับบัญชีเป้าหมาย", sh: "เชื่อมโยงเป้าหมาย", w: 1, f: (x) => x.lnk.map((l) => `${acTag(l.a)}${l.direct.n ? ` โอนตรง ${l.direct.n}` : ""}${l.same.length ? ` ตู้เดียวกัน ${l.same.length}` : ""}${l.common.length ? ` คู่โอนร่วม ${l.common.length}` : ""}${cmpLink([accK(acOf(l.a).acc), x.k])}`).join("<br>") || "",
        v: (x) => x.lnk.map((l) => `${acOf(l.a).short}: โอนตรง ${l.direct.n} ตู้เดียวกัน ${l.same.length} คู่โอนร่วม ${l.common.length}`).join(" ; "), s: (x) => x.lnk.reduce((s, l) => s + l.direct.n + l.same.length * 3 + l.common.length, 0) }],
    click: (x) => { if (!x.detail) return toast("บัญชีนี้ไม่มีรายการที่มีวันเวลา — ดูรายละเอียดไม่ได้"); location.hash = "#acc/" + x.k; } });
  host.addEventListener("change", (e) => { const c = e.target.closest("[data-ck]"); if (!c) return; const k = c.dataset.ck;
    accSelSet(c.checked ? [...ACC.sel, k] : ACC.sel.filter((y) => y !== k)); const ch = $("#accChips"); if (ch) { reload.chipsOnly = 1; } $$("#accMode [data-md=cmp]").forEach((b) => (b.textContent = `เปรียบเทียบ ${ACC.sel.length}`));
    $("#accChips").innerHTML = ACC.sel.map((kk) => { const y = ix.get(kk); return `<span class="achip" data-k="${kk}" style="--c:${y.col}"><i></i>${y.no ? y.no + ". " : ""}${esc(y.short.slice(0, 22))}<button data-rm="${kk}" aria-label="เอาออก">✕</button></span>`; }).join(""); });
}

/* ---------- เปรียบเทียบ / ความสัมพันธ์ ---------- */
function accCompare(host, ks, objs, noDet) {
  const ix = ACC.ix, X = ks.map((k) => ix.get(k)), O = new Map(ks.map((k, i) => [k, objs[i]]));
  /* คู่โอนที่พบในหลายบัญชีมาก (บัญชีระบบ/ร้านค้า/ผู้ให้บริการชำระเงิน) ไม่นับเป็นคู่โอนร่วม */
  if (!ACC.cpFreq) { const f = new Map(); const all = [...DB.acs, ...Object.values(ACCD || {})]; all.forEach((a) => new Set(a.tx.map((r) => r[3]).filter(Boolean)).forEach((c) => f.set(c, (f.get(c) || 0) + 1))); ACC.cpFreq = ACCD ? f : null; ACC.cpFreqTmp = f; }
  const freq = ACC.cpFreq || ACC.cpFreqTmp;
  const cps = (a) => { const g = new Map(); if (!a) return g; a.tx.forEach((r) => { const c = r[3]; if (!c || SYS_ACC.has(c)) return; const o = g.get(c) || { acc: c, name: r[4], bank: r[5], in: 0, out: 0, n: 0 }; if (r[1] === "I") o.in += r[2]; else o.out += r[2]; o.n++; if (!o.name && r[4]) o.name = r[4]; g.set(c, o); }); return g; };
  const CP = new Map(ks.map((k) => [k, cps(O.get(k))]));
  const days = (a) => new Set(a ? a.tx.map((r) => r[0].slice(0, 10)) : []);
  const DY = new Map(ks.map((k) => [k, days(O.get(k))]));
  const evOf = (k) => { const i = ix.get(k).mi; return i < 0 ? [] : MAPX.ev.filter((e) => e.a === i); };
  const EV = new Map(ks.map((k) => [k, evOf(k)]));
  const P = DB.map.places;
  const pairs = [];
  for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
    const a = ks[i], b = ks[j], A = O.get(a), Bo = O.get(b);
    let dir = (A ? A.tx.filter((r) => r[3] === b) : []).map((r) => ({ r, from: r[1] === "O" ? a : b, to: r[1] === "O" ? b : a, src: a }));
    if (!dir.length && Bo) dir = Bo.tx.filter((r) => r[3] === a).map((r) => ({ r, from: r[1] === "O" ? b : a, to: r[1] === "O" ? a : b, src: b }));
    const ab = dir.filter((d) => d.from === a).reduce((s, d) => s + d.r[2], 0), ba = dir.filter((d) => d.from === b).reduce((s, d) => s + d.r[2], 0);
    const ca = CP.get(a), cb = CP.get(b);
    const com = [...ca.keys()].filter((c) => cb.has(c) && c !== a && c !== b && (freq.get(c) || 0) <= 8).map((c) => ({ c, A: ca.get(c), B: cb.get(c) }));
    const ea = EV.get(a), eb = EV.get(b), pa = new Map(), pb = new Map();
    ea.forEach((e) => { if (!P[e.p].weak) pa.set(e.p, (pa.get(e.p) || []).concat(e)); }); eb.forEach((e) => { if (!P[e.p].weak) pb.set(e.p, (pb.get(e.p) || []).concat(e)); });
    const sp = [...pa.keys()].filter((p) => pb.has(p)).map((p) => ({ p, P: P[p], A: pa.get(p), B: pb.get(p) }));
    const co = ea.length && eb.length ? coFind([...ea, ...eb].sort((x, y) => x.t - y.t), 5, 60) : [];
    const da = DY.get(a), db = DY.get(b), sd = [...da].filter((d) => db.has(d)).length, un = new Set([...da, ...db]).size;
    const same = accShort(ix.get(a).name).replace(/\s+/g, "") === accShort(ix.get(b).name).replace(/\s+/g, "");
    const ev = (dir.length ? 1 : 0) + (com.length >= 2 ? 1 : 0) + (sp.length ? 1 : 0) + (co.length ? 1 : 0) + (same ? 1 : 0);
    pairs.push({ a, b, dir, ab, ba, com, sp, co, sd, jac: un ? sd / un : 0, same, ev });
  }
  const sumK2 = (a, ks2) => (a ? a.chan.filter((c) => ks2.includes(c.k)).reduce((s, c) => s + c.amt, 0) : 0);
  const sRows = ks.map((k) => { const x = ix.get(k), a = O.get(k); return { x, a, cash: sumK2(a, ["CASH_OTHER", "CASH_OWN", "COUNTER"]), cw: a ? a.cashout.filter((c) => c.ch === "BRANCH").reduce((s, c) => s + c.amt, 0) : 0,
    mc: a ? a.machines.length : 0, pv: a ? [...new Set(a.branches.map((b) => b.prov).filter(Boolean).map((p) => p.replace(" (?)", "")))] : [], ncp: CP.get(k).size, nev: EV.get(k).length }; });
  const strong = pairs.filter((p) => p.ev >= 2).length;
  host.innerHTML = `${noDet.length ? `<div class="warn">${noDet.length} บัญชีไม่มีรายการที่มีวันเวลา — เปรียบเทียบได้เฉพาะข้อมูลสรุป</div>` : ""}
    <div class="find" style="margin-bottom:12px">${fi("⇄", `เปรียบเทียบ ${ks.length} บัญชี · ${pairs.length} คู่ · เชื่อมโยงชัด (หลักฐาน ≥ 2 ด้าน) ${strong} คู่`,
      `หลักฐาน 5 ด้าน: <b>โอนตรงถึงกัน</b> · <b>คู่โอนร่วม</b> ≥ 2 ราย (ตัดบัญชีระบบ/ร้านค้าที่พบในหลายบัญชี) · <b>ใช้ตู้/สาขาเดียวกัน</b> (รหัสเฉพาะเครื่อง) · <b>เหตุการณ์พร้อมกัน</b> (≤ 5 กม. ≤ 60 นาที คนละเจ้าของ) · <b>ชื่อเดียวกัน</b> — กดแถวคู่บัญชีเพื่อดูหลักฐาน`)}</div>
    <div id="cmpS"></div><div id="cmpP"></div>
    <div class="card sec"><b>เงินเข้ารายวัน เทียบกัน</b> <small class="muted">ดูว่าบัญชีเคลื่อนไหวพร้อมกันหรือรับช่วงต่อกัน</small><div class="chartbox"><canvas id="cmpC"></canvas></div></div>`;
  table($("#cmpS"), { title: "สรุปรายบัญชี", sub: "กดแถว = ดูรายละเอียดบัญชี", rows: () => sRows, sort: "", csvName: "เปรียบเทียบ_สรุป", lead: false, search: false,
    cols: [{ k: "name", lab: "บัญชี", f: (r) => accChip(r.x), v: (r) => r.x.name }, { k: "bank", lab: "ธนาคาร/เลขที่", v: (r) => `${r.x.bank} ${r.x.acc}` },
      { k: "first", lab: "ช่วงข้อมูล", f: (r) => (r.x.first ? `${dS(r.x.first)} – ${dS(r.x.last)}` : "-"), range: (r) => [r.x.first, r.x.last] },
      { k: "in", lab: "เงินเข้า", n: 1, v: (r) => r.x.in, f: (r) => M(r.x.in) }, { k: "out", lab: "เงินออก", n: 1, v: (r) => r.x.out, f: (r) => M(r.x.out) },
      { k: "cash", lab: "ฝากเงินสด", n: 1, f: (r) => (r.cash ? M(r.cash) : "") }, { k: "cw", lab: "ถอนเคาน์เตอร์", n: 1, f: (r) => (r.cw ? M(r.cw) : "") },
      { k: "nev", lab: "รายการที่ตู้/สาขา", n: 1 }, { k: "mc", lab: "ตู้ที่ใช้", n: 1 }, { k: "ncp", lab: "คู่โอน", n: 1 }, { k: "pv", lab: "จังหวัด (สาขาที่ทราบ)", sh: "จังหวัด", w: 1, v: (r) => r.pv.join(", ") }],
    click: (r) => { location.hash = "#acc/" + r.x.k; } });
  const dots = (n) => `<span class="evd" title="หลักฐาน ${n} ด้าน">${"●".repeat(n)}${"○".repeat(5 - n)}</span>`;
  table($("#cmpP"), { title: "ความสัมพันธ์รายคู่", sub: "เรียงตามจำนวนหลักฐาน · กดแถว = ดูหลักฐาน", rows: () => pairs, sort: "ev", csvName: "เปรียบเทียบ_รายคู่", lead: false,
    cols: [{ k: "ev", lab: "หลักฐาน", n: 1, f: (p) => dots(p.ev) }, { k: "a", lab: "บัญชี 1", f: (p) => accChip(ix.get(p.a)), v: (p) => ix.get(p.a).name }, { k: "b", lab: "บัญชี 2", f: (p) => accChip(ix.get(p.b)), v: (p) => ix.get(p.b).name },
      { k: "dir", lab: "โอนตรง", n: 1, v: (p) => p.dir.length, f: (p) => (p.dir.length ? `${p.dir.length} ครั้ง<br><small>1→2 ${M(p.ab)} · 2→1 ${M(p.ba)}</small>` : "") },
      { k: "com", lab: "คู่โอนร่วม", n: 1, v: (p) => p.com.length, f: (p) => (p.com.length ? nf(p.com.length) : "") },
      { k: "sp", lab: "ตู้/สาขาเดียวกัน", n: 1, v: (p) => p.sp.length, f: (p) => (p.sp.length ? nf(p.sp.length) + " จุด" : "") },
      { k: "co", lab: "พร้อมกัน", n: 1, v: (p) => p.co.length, f: (p) => (p.co.length ? nf(p.co.length) + " ครั้ง" : "") },
      { k: "sd", lab: "วันที่ทำรายการวันเดียวกัน", sh: "วันเดียวกัน", n: 1, f: (p) => (p.sd ? `${nf(p.sd)} วัน <small>(${nf(p.jac * 100, 0)}%)</small>` : "") },
      { k: "same", lab: "ชื่อเดียวกัน", v: (p) => (p.same ? "ใช่" : "") }],
    click: (p, det) => accPairDetail(p, det) });
  /* กราฟเงินเข้ารายวัน */
  const shown = ks.filter((k) => O.get(k)).slice(0, 8);
  const allD = [...new Set(shown.flatMap((k) => O.get(k).days))].sort();
  if (allD.length) {
    const inKs = ["CASH_OTHER", "CASH_OWN", "COUNTER", "ATMX", "APP"];
    chart($("#cmpC"), { type: "line", data: { labels: allD.map(dS), datasets: shown.map((k) => { const a = O.get(k), pos = new Map(a.days.map((d, i) => [d, i]));
      return { label: ix.get(k).short, borderColor: ix.get(k).col, backgroundColor: ix.get(k).col, pointRadius: 0, borderWidth: 1.6, spanGaps: false,
        data: allD.map((d) => { const i = pos.get(d); return i == null ? null : inKs.reduce((s, kk) => s + ((a.daily[kk] || [])[i] || 0), 0); }) }; }) },
      options: baseOpt({ plugins: { legend: { labels: { color: inkC(), boxWidth: 12 } }, tooltip: { mode: "index", intersect: false, callbacks: { label: (c) => (c.raw ? `${c.dataset.label}: ${B(c.raw)}` : null) } } },
        scales: { x: { ticks: { color: inkC(), maxTicksLimit: 12 }, grid: { display: false } }, y: { ticks: { color: inkC(), callback: (v) => M(v) }, grid: { color: gridC() } } } }) });
  } else $("#cmpC").parentElement.innerHTML = `<p class="note">ไม่มีข้อมูลรายวัน</p>`;
}

/* หลักฐานของคู่บัญชี */
function accPairDetail(p, det) {
  const ix = ACC.ix, xa = ix.get(p.a), xb = ix.get(p.b), mis = [xa.mi, xb.mi].filter((i) => i >= 0);
  det.innerHTML = `<div class="card pairhd"><div><b>หลักฐานความสัมพันธ์</b> ${accChip(xa)} ⇄ ${accChip(xb)}</div><div class="tools">
      <a class="tb" href="#acc/${p.a}">ดูบัญชี 1</a><a class="tb" href="#acc/${p.b}">ดูบัญชี 2</a>${mis.length ? `<button class="tb" data-pmap>${IC("pin", 14)} แผนที่ 2 บัญชี</button>` : ""}<button class="tb ic" data-pclose aria-label="ปิด">✕</button></div></div>
    <div id="pdD"></div><div id="pdC"></div><div id="pdS"></div><div id="pdO"></div>`;
  $("[data-pclose]", det).onclick = () => { det.innerHTML = ""; $$("tr.sel", det.parentElement).forEach((t) => t.classList.remove("sel")); };
  const pm = $("[data-pmap]", det); if (pm) pm.onclick = () => { MAPX.f.accs = new Set(mis); go("map"); };
  const nm = (k) => ix.get(k).short;
  const empty = (id, t) => ($(id).innerHTML = `<p class="note">${t}</p>`);
  if (p.dir.length) table($("#pdD"), { title: "โอนตรงถึงกัน", rows: () => p.dir, sort: "t", desc: false, csvName: "โอนตรง", lead: false,
    cols: [{ k: "t", lab: "วันเวลา", f: (d) => dtTh(d.r[0]), v: (d) => d.r[0], date: (d) => d.r[0] }, { k: "from", lab: "จาก", f: (d) => accChip(ix.get(d.from)), v: (d) => nm(d.from) }, { k: "to", lab: "ถึง", f: (d) => accChip(ix.get(d.to)), v: (d) => nm(d.to) },
      { k: "amt", lab: "ยอด", n: 1, v: (d) => d.r[2], f: (d) => B(d.r[2]) }, { k: "ch", lab: "ช่องทาง", v: (d) => d.r[6] }, { k: "m", lab: "ตู้", v: (d) => d.r[7] }, { k: "loc", lab: "ที่ตั้ง", w: 1, v: (d) => d.r[9] || "" }],
    total: (r) => `รวม ${B(r.reduce((s, d) => s + d.r[2], 0))} บาท` }); else empty("#pdD", "ไม่พบการโอนตรงถึงกัน");
  if (p.com.length) table($("#pdC"), { title: "คู่โอนร่วม", sub: "บุคคล/บัญชีที่ทำธุรกรรมกับทั้งสองบัญชี", rows: () => p.com, sort: "tot", csvName: "คู่โอนร่วม", lead: false,
    cols: [{ k: "name", lab: "คู่โอน", w: 1, v: (c) => c.A.name || c.B.name || "(ไม่มีชื่อ)" }, { k: "acc", lab: "ธนาคาร/เลขที่", v: (c) => `${c.A.bank || c.B.bank} ${c.c}` },
      { k: "ai", lab: `เข้า ${nm(p.a)}`, n: 1, v: (c) => c.A.in, f: (c) => (c.A.in ? M(c.A.in) : "") }, { k: "ao", lab: `ออก ${nm(p.a)}`, n: 1, v: (c) => c.A.out, f: (c) => (c.A.out ? M(c.A.out) : "") },
      { k: "bi", lab: `เข้า ${nm(p.b)}`, n: 1, v: (c) => c.B.in, f: (c) => (c.B.in ? M(c.B.in) : "") }, { k: "bo", lab: `ออก ${nm(p.b)}`, n: 1, v: (c) => c.B.out, f: (c) => (c.B.out ? M(c.B.out) : "") },
      { k: "tot", lab: "รวม", n: 1, v: (c) => c.A.in + c.A.out + c.B.in + c.B.out, f: (c) => M(c.A.in + c.A.out + c.B.in + c.B.out) }, { k: "lnk", lab: "", f: (c) => (ACC.ix.has(c.c) ? `<a class="cmpl" href="#acc/${c.c}">ดูบัญชี</a>` : ""), v: () => "" }] });
  else empty("#pdC", "ไม่พบคู่โอนร่วม (หลังตัดบัญชีระบบ/ร้านค้าที่พบในหลายบัญชี)");
  const sm = (es) => `${es.length} ครั้ง ${M(es.reduce((s, e) => s + e.amt, 0))}`;
  if (p.sp.length) table($("#pdS"), { title: "ตู้/สาขาที่ใช้ร่วมกัน", sub: "นับเฉพาะรหัสเฉพาะเครื่อง/สาขา", rows: () => p.sp, sort: "n", csvName: "จุดใช้ร่วม", lead: false,
    cols: [{ k: "name", lab: "ที่ตั้ง/ตู้", w: 1, v: (s) => plName(s.P) }, { k: "prov", lab: "จังหวัด", v: (s) => s.P.prov || "" },
      { k: "a", lab: nm(p.a), v: (s) => sm(s.A) }, { k: "b", lab: nm(p.b), v: (s) => sm(s.B) }, { k: "n", lab: "รวมครั้ง", n: 1, v: (s) => s.A.length + s.B.length },
      { k: "gap", lab: "ห่างกันน้อยสุด", n: 1, v: (s) => Math.round(Math.min(...s.A.flatMap((x) => s.B.map((y) => Math.abs(x.t - y.t))))), f: (s) => { const g = Math.min(...s.A.flatMap((x) => s.B.map((y) => Math.abs(x.t - y.t)))); return g < 1440 ? `${nf(g, 0)} นาที` : `${nf(g / 1440, 0)} วัน`; } },
      { k: "first", lab: "ช่วงวันที่", f: (s) => { const t = [...s.A, ...s.B].map((e) => e.t); return `${dS(isoMin(Math.min(...t)))} – ${dS(isoMin(Math.max(...t)))}`; }, range: (s) => { const t = [...s.A, ...s.B].map((e) => e.t); return [isoSec(Math.min(...t)), isoSec(Math.max(...t))]; } }] });
  else empty("#pdS", "ไม่พบตู้/สาขาที่ใช้ร่วมกัน (ไม่นับรหัสตู้กลุ่ม)");
  if (p.co.length) table($("#pdO"), { title: "เหตุการณ์พร้อมกัน (≤ 5 กม. · ≤ 60 นาที)", rows: () => p.co, sort: "t0", desc: false, csvName: "พร้อมกัน", lead: false,
    cols: [{ k: "t0", lab: "เวลา", f: (x) => `${dtTh(isoMin(x.t0))}–${isoMin(x.t1).slice(11)}`, v: (x) => isoMin(x.t0), s: (x) => x.t0, range: (x) => [isoSec(x.t0), isoSec(x.t1)], rl: ["เวลาเริ่มต้น", "เวลาสิ้นสุด"] },
      { k: "pl", lab: "จุด", w: 1, v: (x) => x.pl.map((q) => plName(DB.map.places[q])).join(" ; ") }, { k: "n", lab: "รายการ", n: 1, v: (x) => x.es.length },
      { k: "amt", lab: "ยอด", n: 1, v: (x) => x.es.reduce((s, e) => s + e.amt, 0), f: (x) => M(x.es.reduce((s, e) => s + e.amt, 0)) },
      { k: "ks", lab: "ประเภท", v: (x) => [...new Set(x.es.map((e) => MK[e.k][0]))].join(", ") }] });
  else empty("#pdO", "ไม่พบเหตุการณ์พร้อมกันในรัศมี 5 กม. / 60 นาที");
}
