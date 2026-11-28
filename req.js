/* ================= รายการขอข้อมูลธนาคาร (CCTV / ใบถอน-ใบฝาก / ที่ตั้งตู้) — รวบรวมอัตโนมัติ + ติดตามสถานะคำขอ ================= */
const RQ_CH = { B: "เคาน์เตอร์สาขา", D: "ตู้ ADM", A: "ตู้ ATM/CDM" };
const RQ_ST = { K: "ทราบที่ตั้ง", I: "ที่ตั้งอนุมาน", U: "ไม่ทราบที่ตั้ง" };
const RQ_SRC = { A: "รหัสตู้ตรงกับรายการที่ตั้งตู้ของธนาคาร", S: "รหัสสาขาในไฟล์ (เคาน์เตอร์/ตู้ของธนาคารเจ้าของบัญชี) · ชื่อและที่อยู่จากรายการรหัสสาขา ธปท.", I: "อนุมานจากรอบฝากเดียวกัน (ห่างไม่เกิน 20 นาที)", U: "ไม่พบในข้อมูลอ้างอิง" };
const RQ_SL = { "": "ยังไม่ขอ", q: "ขอแล้ว รอผล", g: "ได้รับแล้ว", x: "ไม่ต้องขอ" };
const RQ_KEY = { st: "atm_rq_st", acc: "atm_rq_acc" };
const RQ = { R: 10, cats: new Set(), stmF: "all", sF: "all", inclV: false };
const rqN = (a) => String(a || "").replace(/\D/g, "").replace(/^0+/, "");
const rqKs = (s) => (s && s.size ? [...s].sort((a, b) => a - b).join(", ") : "");
/* กรรมที่เกี่ยวข้อง: ตามบัญชี / ตามรายการถอนเงินสด (บัญชี+นาที) / ตามรหัสจุด */
function rqKmap() { if (RQ.km) return RQ.km; rqFlowTasks(); const byAcc = new Map(), byTx = new Map(), byRc = new Map(), add = (m, k, v) => { if (!m.has(k)) m.set(k, new Set()); m.get(k).add(v); };
  if (DB.flow) { DB.flow.kam.forEach((k) => add(byAcc, rqN(k.l1acc), k.k)); (RQ.ho || []).forEach((h) => { add(byAcc, rqN(h.from), h.k); if (h.typ === "F") add(byAcc, rqN(h.to), h.k); if (h.typ === "C") { add(byTx, rqN(h.from) + "|" + h.t.slice(0, 16), h.k); if (h.rc) add(byRc, h.rc, h.k); } }); }
  return (RQ.km = { byAcc, byTx, byRc }); }
/* ประเภทคำขอ (ใช้กรองในตาราง "คำขอทั้งหมด") */
const RQ_CAT = { stm: "ขอ STM", cctv: "ภาพกล้อง CCTV", slip: "ใบถอน/ใบฝาก (pay-in/out)", loc: "ที่ตั้งตู้/สาขา", wit: "สอบพยาน/ร้านค้า", wal: "วอลเล็ต/ผู้รับชำระเงิน", det: "รายละเอียดรายการ", abr: "โอนต่างประเทศ", frz: "อายัด", oth: "อื่น ๆ" };
const RQ_ACAT = { stm: ["stm"], ext: ["stm"], atm: ["cctv", "loc"], br: ["slip", "cctv"], shop: ["wit"], itv: ["wit"], wal: ["wal"], pay: ["det"], abr: ["abr"], frz: ["frz"], oth: ["oth"] };
/* งานติดตามจากเส้นเงิน (หน้าเส้นเงิน) — สร้างครั้งเดียว */
function rqFlowTasks() { if (!DB.flow || typeof flTasks !== "function") return []; if (!RQ.ft) { RQ.ho = DB.flow.hops.map(flHop); RQ.ft = flTasks(DB.flow.kam, RQ.ho); } return RQ.ft; }

/* ---------- เก็บสถานะ: ไฟล์สถานะกลาง (ฝังมากับข้อมูลเว็บ) + ที่ติ๊กในเครื่องนี้ (รายการที่ใหม่กว่าชนะ) ---------- */
const rqLoad = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
const rqSave = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { toast("บันทึกในเครื่องนี้ไม่ได้ (เบราว์เซอร์โหมดส่วนตัว?)"); return false; } };
function rqStore() {
  if (!RQ.st) {
    RQ.st = Object.assign({}, (DB.rq && DB.rq.base) || {});
    Object.entries(rqLoad(RQ_KEY.st, {})).forEach(([k, v]) => { if (!RQ.st[k] || (v.ts || 0) >= (RQ.st[k].ts || 0)) RQ.st[k] = v; });
  }
  return RQ.st;
}
const rqToday = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
function rqSet(rc, s) {
  const v = Object.assign({}, rqStore()[rc] || {}, { s, d: s ? rqToday() : "", ts: Date.now() });   // คงข้อมูลเสริมของรายการเดิมไว้
  rqStore()[rc] = v;
  const loc = rqLoad(RQ_KEY.st, {}); loc[rc] = v; rqSave(RQ_KEY.st, loc);
}
/* เพิ่ม/แก้ข้อมูลเสริมของรายการ (a = งานที่ต้องทำ · n = หมายเหตุ · en/eb/ea = ชื่อ/ธนาคาร/เลขบัญชีที่ระบุเอง · fl = งานติดตามเส้นเงิน) */
function rqPatch(rc, o) {
  const v = Object.assign({ s: "", d: "" }, rqStore()[rc] || {}, o, { ts: Date.now() });
  rqStore()[rc] = v;
  const loc = rqLoad(RQ_KEY.st, {}); loc[rc] = v; rqSave(RQ_KEY.st, loc);
}
/* ไฟล์ที่ได้รับ (โฟลเดอร์ในเครื่อง ตอนอัปเดตเว็บ) จับคู่ด้วยรหัสคำขอ / รหัสตู้เต็ม / เลขบัญชี */
const rqNorm = (s) => String(s || "").toUpperCase().replace(/[\s_\-.()/\\]/g, "");
function rqFiles(tok) {
  if (!RQ.fn) RQ.fn = ((DB.rq && DB.rq.files) || []).map((f) => [rqNorm(f[0]), f]);
  const ts = tok.map(rqNorm).filter((t) => t.length >= 5);
  return RQ.fn.filter(([n]) => ts.some((t) => n.includes(t))).map((x) => x[1]);
}
function rqStat(o) {
  if (!o.fl) o.fl = rqFiles(o.tok);
  if (o.fl.length) return { s: "g", d: o.fl.map((f) => f[1]).sort().pop(), auto: 1 };
  const v = rqStore()[o.rc];
  return v && v.s ? v : { s: "" };
}
function rqSaveFile() {
  const st = Object.fromEntries(Object.entries(rqStore()).filter(([, v]) => v && (v.s || v.ts)));
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify({ saved: new Date().toISOString(), st }, null, 1)], { type: "application/json" }));
  a.download = "สถานะขอข้อมูล.json"; a.click(); toast(`บันทึก ${nf(Object.keys(st).length)} สถานะ — วางไฟล์ไว้ที่ 0_บันทึกงาน แล้วอัปเดตเว็บ`);
}
const rqSafe = (s) => s.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "");

/* เอกสารที่ต้องขอ ตามช่องทาง/ประเภทรายการ/สถานะที่ตั้ง */
function rqDoc(ch, ks, st) {
  const d = [];
  if (st === "U") d.push("ที่ตั้งตู้/สาขา");
  if (st === "I") d.push("ยืนยันที่ตั้งตู้");
  if (ch.has("B")) {
    if (ks.has("W") || ks.has("O")) d.push("ใบถอน/ใบโอน + หลักฐานแสดงตนผู้ทำรายการ");
    if (ks.has("D") || ks.has("X")) d.push("ใบนำฝาก (ชื่อ/เบอร์ผู้ฝาก)");
    d.push("CCTV เคาน์เตอร์");
  }
  if (ch.has("A") || ch.has("D")) { d.push("CCTV ตู้"); if (ks.has("W") || ks.has("O")) d.push("เลขบัตรที่ใช้กด"); }
  return d.join(" + ");
}

/* รวมรายการของบัญชีที่เลือก -> จุด (สาขา/ตู้) */
function rqBuild(sel) {
  mapInit();
  const P = DB.map.places, A = DB.map.accs;
  const tx = [], pts = new Map();
  MAPX.ev.forEach((e) => {
    if (!sel.has(e.a)) return;
    const p = P[e.p], st = p.lat == null ? (p.k === "A" && !e.inf ? "K" : "U") : e.inf ? "I" : "K";   // ตู้ที่พบชื่อที่ตั้งในรายการตู้ของธนาคาร = ทราบที่ตั้ง แม้ยังไม่มีพิกัด
    const mcd = e.mk ? e.mk.slice(e.mk.indexOf(" ") + 1) : "";
    const bank = e.mk ? e.mk.split(" ")[0] : p.b || A[e.a].bank;
    const key = st === "I" ? "I|" + e.mk : "P|" + e.p;
    let o = pts.get(key);
    if (!o) {
      const isAtmList = p.k === "A" && st !== "I", brOnly = p.k === "M" && !mcd;   // จุดที่ไม่มีรหัสตู้ = รหัสสาขา (เคาน์เตอร์)
      const rc = rqSafe(st === "I" ? `${bank}-ตู้-${mcd}` : p.k === "A" ? `${p.b}-ตู้-${p.code}` : p.k === "S" ? `${p.b}-สาขา-${p.code}` : `${bank}-${brOnly ? "สาขา" : "ตู้"}-${p.code}`);
      const weak = st === "I" ? e.wk : brOnly ? false : p.weak;
      o = { key, rc, st, bank, ch: new Set(), ks: new Set(), accs: new Set(), mcs: new Set(), n: 0, amt: 0, first: e.t, last: e.t, hrs: new Set(), files: new Set(), tx: [],
        prov: p.prov || "", lat: p.lat, lng: p.lng, weak, addr: st === "I" ? "" : p.addr || "", pv: p.pv || 0,
        tok: [rc, (st === "I" || p.k === "A" || (p.k === "M" && !brOnly)) && !weak ? (st === "I" ? mcd : p.code) : ""],
        place: st === "I" ? `ใกล้ ${p.name}` : p.k === "M" ? "" : p.name,
        branch: st === "I" ? "" : p.k === "A" ? `${p.bcode || ""} ${p.branch || ""}`.trim() : p.k === "S" || brOnly ? p.code : "",
        src: st === "I" ? RQ_SRC.I : st === "U" ? RQ_SRC.U : isAtmList ? RQ_SRC.A + (p.asrc ? ` (${p.asrc})` : "") : RQ_SRC.S };
      pts.set(key, o);
    }
    o.ch.add(e.ch); o.ks.add(e.k); o.accs.add(e.a); if (mcd) o.mcs.add(mcd); o.n++; o.amt += e.amt; o.first = Math.min(o.first, e.t); o.last = Math.max(o.last, e.t);
    o.hrs.add(+isoMin(e.t).slice(11, 13)); if (mcd || e.bc) o.files.add([mcd && "ตู้ " + (e.mr || mcd), e.bc && "สาขา " + e.bc].filter(Boolean).join(" / "));
    const r = { e, pt: o, a: A[e.a], st, bank, mcd };
    o.tx.push(r); tx.push(r);
  });
  const P2 = [...pts.values()];
  P2.forEach((o) => { o.doc = rqDoc(o.ch, o.ks, o.st); o.chL = [...o.ch].map((c) => RQ_CH[c]).join(", "); o.ksL = [...o.ks].map((k) => MK[k][0]).join(", "); });
  tx.forEach((r) => (r.doc = rqDoc(new Set([r.e.ch]), new Set([r.e.k]), r.st)));
  const acc = A.filter((a) => sel.has(a.i)).map((a) => {
    const t = tx.filter((r) => r.a === a), s = (f) => t.filter(f), sum = (x) => x.reduce((q, r) => q + r.e.amt, 0);
    const cw = s((r) => r.e.ch === "B" && (r.e.k === "W" || r.e.k === "O")), cd = s((r) => r.e.ch === "B" && (r.e.k === "D" || r.e.k === "X"));
    const md = s((r) => r.e.ch !== "B" && (r.e.k === "D" || r.e.k === "X")), mw = s((r) => r.e.ch !== "B" && (r.e.k === "W" || r.e.k === "O"));
    const rc = rqSafe(`บัญชี-${a.bank}-${a.acc}`);
    return { a, t, rc, tok: [rc, a.acc], cwN: cw.length, cwA: sum(cw), cdN: cd.length, cdA: sum(cd), mdN: md.length, mdA: sum(md), mwN: mw.length, mwA: sum(mw),
      pK: new Set(t.filter((r) => r.st !== "U").map((r) => r.pt.key)).size, pU: new Set(t.filter((r) => r.st === "U").map((r) => r.pt.key)).size,
      prov: [...new Set(t.map((r) => r.pt.prov).filter(Boolean))].join(", "), first: t.length ? t[0].e.t : 0, last: t.length ? t[t.length - 1].e.t : 0 };
  }).filter((x) => x.t.length);
  return { tx, pts: P2, acc };
}

/* จัดกลุ่มจุดที่อยู่ใกล้กัน (ห่างกันไม่เกิน R กม. ต่อเนื่องกัน) -> ใช้แบ่งงานส่งเจ้าหน้าที่ทีละพื้นที่ */
function rqGroup(pts, R) {
  const L = pts.filter((o) => o.lat != null), n = L.length, par = L.map((_, i) => i);
  const f = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (hav(L[i], L[j]) <= R) { const a = f(i), b = f(j); if (a !== b) par[a] = b; }
  const g = new Map(); L.forEach((o, i) => { const r = f(i); if (!g.has(r)) g.set(r, []); g.get(r).push(o); });
  const gs = [...g.values()].map((m) => { const pc = {}; m.forEach((o) => { if (o.prov) pc[o.prov] = (pc[o.prov] || 0) + o.n; }); return { m, prov: Object.entries(pc).sort((a, b) => b[1] - a[1]).map((x) => x[0]).slice(0, 2).join("/") || "-", n: m.reduce((s, o) => s + o.n, 0) }; })
    .sort((a, b) => a.prov.localeCompare(b.prov, "th") || b.n - a.n);
  gs.forEach((G, i) => { const lab = `${String(i + 1).padStart(2, "0")} ${G.prov}`; G.m.forEach((o) => { o.grp = lab; o.grpN = G.m.length; }); });
  pts.filter((o) => o.lat == null).forEach((o) => { o.grp = o.st === "U" ? "ไม่ทราบพิกัด" : "ทราบชื่อที่ตั้ง (ยังไม่มีพิกัด)"; o.grpN = 0; });
  return gs.length;
}

const rqAcc = (a) => a.name.replace(/^(บริษัท|น\.ส\.?|นางสาว|นาย|นาง)\s*/, "");
const rqAccs = (o) => [...o.accs].map((i) => DB.map.accs[i]);
const rqHrs = (o) => { const h = [...o.hrs].sort((a, b) => a - b); return h.length ? `${String(h[0]).padStart(2, "0")}–${String(h[h.length - 1]).padStart(2, "0")} น.` : ""; };
const rqCctv = (t) => `${isoMin(t - 15).slice(11)}–${isoMin(t + 15).slice(11)}`;

function pReq(m) {
  mapInit();                                   // กำหนดเลขลำดับบัญชี (a.i) ก่อนใช้
  if (RQ.focus) { if (RQ.focus.used) RQ.focus = null; else RQ.focus.used = true; }   // งานที่ส่งมาจากหน้าเส้นเงิน ใช้ครั้งเดียว
  const A = DB.map.accs;
  const KM = rqKmap(), VS = new Set(((DB.flow && DB.flow.vict) || []).map(rqN)), VX = new Set(A.filter((a) => VS.has(rqN(a.acc))).map((a) => a.i));
  const ptKs = (o) => { if (!o._ks) { o._ks = new Set(KM.byRc.get(o.rc) || []); o.tx.forEach((r) => (KM.byTx.get(rqN(r.a.acc) + "|" + isoMin(r.e.t)) || []).forEach((k) => o._ks.add(k))); } return o._ks; };
  /* บัญชีที่เลือก = ชุดเดียวกับทุกหน้า (เลือกที่หน้าไหนก็ได้) */
  const g0 = gSel();
  let sel = new Set(g0 ? A.filter((a) => g0.includes(gK(a.acc))).map((a) => a.i) : MAPX.f.accs);
  let D, nG;
  const rebuild = () => { D = rqBuild(new Set([...sel].filter((i) => RQ.inclV || !VX.has(i)))); nG = rqGroup(D.pts, RQ.R); };
  rebuild();
  const known = () => D.pts.filter((o) => o.st !== "U"), unk = () => D.pts.filter((o) => o.st === "U");
  const nByA = new Map(); MAPX.ev.forEach((e) => nByA.set(e.a, (nByA.get(e.a) || 0) + 1));
  const fold = (DB.rq && DB.rq.folder) || "โฟลเดอร์ข้อมูลที่ได้รับจากธนาคาร";

  m.innerHTML = `<div id="rqRoot"><section class="hero"><div><h2 style="margin:0 0 6px">รายการขอข้อมูลธนาคาร</h2><p class="lead" id="rqLead"></p></div>
    <div class="hero-k" id="rqKpi"></div></section>
  <details class="fbox" style="margin-top:12px"><summary>${IC("todo", 15)} วิธีใช้ / การติดตามสถานะ</summary><p class="note">
    <b>เลือกบัญชี</b>: ระบบใช้บัญชีที่เลือกไว้ใน<b>หน้าแผนที่</b> — ต้องการเพิ่ม/ตัด กดปุ่ม "บัญชี" ที่หน้านี้ (จำไว้จนกว่าจะเปลี่ยนการเลือกในหน้าแผนที่ใหม่ ; ปุ่ม "ตามแผนที่" = กลับไปใช้ตามแผนที่) — ทุกตารางและไฟล์ Excel คิดจากบัญชีที่เลือก<br>
    <b>สถานะคำขอ</b>: เลือกในช่อง "สถานะคำขอ" ของแต่ละแถว (ยังไม่ขอ / ขอแล้ว รอผล / ได้รับแล้ว / ไม่ต้องขอ) ระบบบันทึกวันที่ให้ · ตั้งทีละหลายแถวได้ด้วย "ตั้งสถานะแถวที่แสดง" (ตามตัวกรองของตารางที่เปิดอยู่)<br>
    <b>ได้รับไฟล์แล้ว</b>: วางไฟล์ในโฟลเดอร์ <code>${esc(fold)}</code> โดยตั้งชื่อโฟลเดอร์ย่อย/ไฟล์ตาม <b>รหัสคำขอ</b> (กดรหัสเพื่อคัดลอก) แล้วดับเบิลคลิก <b>อัปเดตเว็บ.bat</b> — แถวนั้นขึ้น 📁 ได้รับแล้ว อัตโนมัติ<br>
    <b>ใช้หลายเครื่อง</b>: สถานะที่ติ๊กเก็บในเบราว์เซอร์ของเครื่องนั้น — กด "บันทึกสถานะเป็นไฟล์" แล้ววางไฟล์ไว้ที่ <code>0_บันทึกงาน/สถานะขอข้อมูล.json</code> ก่อนอัปเดตเว็บ ทุกเครื่องจะเห็นสถานะเดียวกัน<br>
    <b>ช่องทาง</b>: เคาน์เตอร์ = ใบถอน/ใบนำฝาก + หลักฐานแสดงตน + CCTV เคาน์เตอร์ · ตู้ = CCTV ตู้ ±15 นาที · <b>สถานะที่ตั้ง</b>: อนุมาน = ต้องให้ธนาคารยืนยันที่ตั้งก่อน · ไม่ทราบ = ส่งรหัสตู้ให้ธนาคารระบุที่ตั้ง<br>
    <b>กลุ่มพื้นที่</b> = จุดที่ห่างกันไม่เกินรัศมีที่เลือก ใช้แบ่งงานส่งเจ้าหน้าที่ · พิกัดระดับอำเภอโดยประมาณ ตรวจทานกับคอลัมน์ "รหัสในไฟล์"</p></details>
  <div class="sec rqbar">
    <details class="pick" id="rqPick"><summary class="tb">${IC("user", 15)} บัญชี <b id="rqAccN"></b></summary><div class="pick-box">
      <div class="pick-q"><input class="tin" type="search" placeholder="ค้นหาบัญชี" id="rqAccQ"><button class="tb" data-q="m" title="ใช้บัญชีที่เลือกในหน้าแผนที่">ตามแผนที่</button><button class="tb" data-q="f">3 หลัก</button><button class="tb" data-q="a">ทั้งหมด</button><button class="tb" data-q="n">ล้าง</button></div>
      <div class="pick-list" id="rqAccL"></div></div></details>
    ${VX.size ? `<label class="rqr" title="บัญชีของผู้เสียหายไม่ต้องขอข้อมูล — ไม่นำมารวมเป็นค่าเริ่มต้น"><input type="checkbox" id="rqInclV" ${RQ.inclV ? "checked" : ""}> รวมบัญชีผู้เสียหาย</label>` : ""}
    <div class="seg" id="rqTabs"></div>
    <label class="rqr">รัศมีกลุ่ม <select class="tin" id="rqR">${[3, 5, 10, 20, 50].map((r) => `<option value="${r}" ${r === RQ.R ? "selected" : ""}>${r} กม.</option>`).join("")}</select></label>
    <label class="rqr" id="rqBulkW">ตั้งสถานะแถวที่แสดง <select class="tin" id="rqBulk"><option value="-">เลือก…</option>${Object.entries(RQ_SL).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></label>
    <button class="tb xl" id="rqXls">${IC("dl", 15)} Excel ทั้งชุด</button>
    <details class="xmenu"><summary class="tb ic" title="สำรอง/นำเข้าสถานะ" aria-label="เมนูสถานะ">⋯</summary><div class="xm-box"><button class="tb" id="rqSaveF">บันทึกสถานะเป็นไฟล์</button><button class="tb" id="rqLoadF">นำเข้าไฟล์สถานะ</button></div></details>
    <input type="file" id="rqFile" accept=".json,application/json" hidden></div>
  <div data-rq="q"><div class="flcrumb" id="rqCrumb" hidden></div><div class="rqflt" id="rqQF"></div><div id="rqQ"></div></div><div data-rq="s" hidden><div class="rqflt" id="rqSF"></div><div id="rqS"></div></div>
  <div data-rq="p" hidden><div id="rqP"></div></div><div data-rq="a" hidden><div id="rqA"></div><div id="rqAP"></div></div><div data-rq="t" hidden><div id="rqT"></div></div></div>`;
  const root = $("#rqRoot");

  const accCell = (o) => { const as = rqAccs(o); return as.slice(0, 3).map((a) => mAcc(a.i)).join(" ") + (as.length > 3 ? ` <small>+${as.length - 3}</small>` : ""); };
  const accTxt = (o) => rqAccs(o).map((a) => `${a.bank} ${a.acc} ${a.name}`).join(" ; ");
  const stB = (s) => `<span class="rqs rq${s}">${RQ_ST[s]}</span>`;
  const rng = (o) => [isoSec(o.first).slice(0, 10), isoSec(o.last).slice(0, 10)];
  const rngF = (o) => `${dS(isoMin(o.first))} – ${dS(isoMin(o.last))}`;
  /* คอลัมน์สถานะคำขอ / รหัสคำขอ (ใช้กับตารางจุดและตารางบัญชี) */
  const stCell = (o) => { const v = rqStat(o);
    if (v.auto) return `<span class="rqst sg" title="${esc(o.fl.map((f) => f[0]).join("\n"))}">📁 ได้รับแล้ว · ${o.fl.length} ไฟล์</span>`;
    return `<select class="rqsel s${v.s || "0"}" data-rc="${esc(o.rc)}" aria-label="สถานะคำขอ">${Object.entries(RQ_SL).map(([k, l]) => `<option value="${k}" ${k === v.s ? "selected" : ""}>${l}</option>`).join("")}</select>${v.d ? `<small class="rqd">${dS(v.d)}</small>` : ""}`; };
  const stCols = [{ k: "rqs", lab: "สถานะคำขอ", f: stCell, v: (o) => { const v = rqStat(o); return RQ_SL[v.s] + (v.auto ? " (มีไฟล์)" : ""); } },
    { k: "rqd", lab: "วันที่สถานะ", v: (o) => rqStat(o).d || "", date: (o) => rqStat(o).d || "" },
    { k: "rc", lab: "รหัสคำขอ (ชื่อโฟลเดอร์)", sh: "รหัสคำขอ", f: (o) => `<button class="rcb" data-copy="${esc(o.rc)}" title="กดเพื่อคัดลอก — ใช้ตั้งชื่อโฟลเดอร์ไฟล์ที่ได้รับ">${esc(o.rc)}</button>`, v: (o) => o.rc }];
  /* ตารางรายการ (ใช้ทั้งตาราง "ทุกรายการ" และตารางย่อยเมื่อกดแถว) */
  const txCols = [
    { k: "rqs", lab: "สถานะคำขอ (จุด)", v: (r) => RQ_SL[rqStat(r.pt).s] }, { k: "grp", lab: "กลุ่มพื้นที่", v: (r) => r.pt.grp }, { k: "prov", lab: "จังหวัด", v: (r) => r.pt.prov },
    { k: "st", lab: "สถานะที่ตั้ง", f: (r) => stB(r.st), v: (r) => RQ_ST[r.st] }, { k: "ch", lab: "ช่องทาง", v: (r) => RQ_CH[r.e.ch] }, { k: "k", lab: "ประเภท", f: (r) => mkb(r.e.k), v: (r) => MK[r.e.k][0] },
    { k: "t", lab: "วันเวลา", f: (r) => dtTh(isoMin(r.e.t)), v: (r) => isoMin(r.e.t), s: (r) => r.e.t, date: (r) => isoSec(r.e.t) }, { k: "amt", lab: "ยอด", n: 1, f: (r) => B(r.e.amt), v: (r) => r.e.amt }, { k: "ks", lab: "กรรมที่", v: (r) => rqKs(KM.byTx.get(rqN(r.a.acc) + "|" + isoMin(r.e.t))) },
    { k: "cctv", lab: "ช่วงขอ CCTV", v: (r) => rqCctv(r.e.t) },
    { k: "bank", lab: "ธนาคารที่ส่งหนังสือ", v: (r) => r.bank }, { k: "place", lab: "สาขา/ที่ตั้งตามระบบ", w: 1, v: (r) => [r.pt.place, r.pt.branch].filter(Boolean).join(" · ") },
    { k: "mcd", lab: "รหัสตู้ในไฟล์", f: (r) => (r.mcd ? mcode(r.mcd, r.e.wk) : ""), v: (r) => r.mcd }, { k: "bc", lab: "รหัสสาขาในไฟล์", v: (r) => r.e.bc },
    { k: "agrp", lab: "กลุ่มบัญชี", v: (r) => (r.a.id ? "บัญชีเป้าหมาย" : "บัญชีเกี่ยวข้อง") }, { k: "abank", lab: "ธนาคารบัญชี", v: (r) => r.a.bank }, { k: "acc", lab: "เลขบัญชี", v: (r) => r.a.acc },
    { k: "aname", lab: "ชื่อบัญชี", f: (r) => mAcc(r.a.i), v: (r) => r.a.name }, { k: "cp", lab: "คู่โอน", v: (r) => r.e.nm || "" }, { k: "doc", lab: "เอกสารที่ขอ", w: 1, v: (r) => r.doc },
    { k: "rc", lab: "รหัสคำขอ", v: (r) => r.pt.rc }];
  const det = (rows, title, host) => table(host, { title, rows: () => rows, sort: "t", desc: false, csvName: "รายการ_" + title.slice(0, 20), lead: false, cols: txCols, total: (r) => `รวม ${B(r.reduce((s, x) => s + x.e.amt, 0))} บาท` });
  const ptTot = (r) => `รวม ${nf(r.reduce((s, o) => s + o.n, 0))} รายการ ${B(r.reduce((s, o) => s + o.amt, 0))} บาท`;
  const mcCol = { k: "mcode", lab: "รหัสตู้", f: (o) => [...o.mcs].map((c) => mcode(c, o.mcs.size === 1 ? o.weak : undefined)).join(", "), v: (o) => [...o.mcs].join(", ") };

  /* ตารางจุดตารางเดียว: ปุ่ม ทุกจุด / ทราบที่ตั้ง / ไม่ทราบที่ตั้ง = ตัวกรองของตารางนี้ */
  const accBA = (o) => rqAccs(o).map((a) => `${a.bank} ${a.acc}`);
  const ptCols = [stCols[0], { k: "grp", lab: "กลุ่มพื้นที่", v: (o) => o.grp },
    { k: "place", lab: "ที่ตั้งตามระบบ", w: 1, v: (o) => o.place || (o.mcs.size ? `ตู้ ${o.bank} (ยังไม่ทราบที่ตั้ง)` : `${o.bank} สาขา ${o.branch}`) },
    { k: "st", lab: "สถานะที่ตั้ง", f: (o) => stB(o.st), v: (o) => RQ_ST[o.st] }, { k: "chL", lab: "ช่องทาง" },
    { k: "accs", lab: "บัญชี", w: 1, f: accCell, v: (o) => rqAccs(o).map((a) => a.name).join(" ; ") },
    { k: "accno", lab: "ธนาคาร / เลขบัญชี", sh: "เลขบัญชี", w: 1, f: (o) => accBA(o).map(esc).join("<br>"), v: (o) => accBA(o).join(" ; ") }, { k: "ks", lab: "กรรมที่", w: 1, v: (o) => rqKs(ptKs(o)) },
    { k: "n", lab: "ครั้ง", n: 1 }, { k: "amt", lab: "ยอด", n: 1, f: (o) => B(o.amt) },
    { k: "prov", lab: "จังหวัด" }, { k: "bank", lab: "ธนาคารที่ส่งหนังสือ" }, { k: "branch", lab: "สาขา (รหัส ชื่อ)", w: 1 }, { k: "addr", lab: "ที่อยู่สาขา", w: 1 }, mcCol,
    { k: "weak", lab: "รหัสตู้ครบหรือไม่", v: (o) => (o.mcs.size && o.weak ? "รหัสไม่ครบ (ไฟล์เก็บได้ 6 ตัวอักษร) — ให้ธนาคารค้นจากวันเวลา + ยอด + บัญชีปลายทาง" : o.mcs.size ? "ครบ" : "") },
    { k: "files", lab: "รหัสในไฟล์ (ตรวจทาน)", sh: "รหัสในไฟล์", w: 1, v: (o) => [...o.files].join(" ; ") }, { k: "ksL", lab: "ประเภทรายการ" },
    { k: "first", lab: "ช่วงวันที่", f: rngF, s: (o) => o.first, range: rng }, { k: "hrs", lab: "ช่วงเวลา", v: rqHrs }, { k: "doc", lab: "เอกสารที่ขอ", w: 1 }, { k: "src", lab: "ที่มาของที่ตั้ง", w: 1 },
    { k: "ll", lab: "พิกัด (โดยประมาณ)", v: (o) => (o.lat != null ? `${o.lat}, ${o.lng}${o.pv ? " (ระดับจังหวัด)" : ""}` : "") }, stCols[1], stCols[2]];
  const ptClick = (o, h) => det(o.tx, `รายการที่ ${o.place || [...o.mcs][0] || o.branch}`, h);
  const LOC = { all: "ทุกจุด", k: "ทราบที่ตั้ง", u: "ไม่ทราบที่ตั้ง" };
  const ptRows = () => D.pts.filter((o) => (RQ.loc === "k" ? o.st !== "U" : RQ.loc === "u" ? o.st === "U" : true));
  const T = {};
  T.p = table($("#rqP"), { title: "จุดที่ต้องขอข้อมูล", sub: "เรียงตามกลุ่มพื้นที่ (จุดที่ไม่ทราบพิกัดอยู่ท้าย) · กดแถวดูรายการ", rows: ptRows, sort: "grp", desc: false, csvName: "จุดที่ต้องขอข้อมูล", lead: false, cols: ptCols, click: ptClick, total: ptTot });
  /* ตามบัญชี: กดบัญชี -> จุดของบัญชีนั้นเรียงตามกลุ่มพื้นที่ (ครั้ง/ยอด = ของบัญชีนั้น) */
  /* ตามบัญชี: ตารางล่างแสดงจุดของทุกบัญชีที่เลือกอัตโนมัติ เรียง บัญชี -> กลุ่มพื้นที่ (ครั้ง/ยอด = ของบัญชีนั้น) ; กดบัญชีด้านบน = เหลือบัญชีเดียว */
  const ptsOf = (a) => D.pts.filter((o) => o.accs.has(a.i)).map((o) => { const t = o.tx.filter((r) => r.a === a);
    return Object.assign(Object.create(o), { acc: a, n: t.length, amt: t.reduce((q, r) => q + r.e.amt, 0), first: t[0].e.t, last: t[t.length - 1].e.t, tx: t }); })
    .sort((x, y) => x.grp.localeCompare(y.grp, "th") || y.amt - x.amt);
  let apD = null, apRows = [];
  const accPtRows = () => { if (apD !== D) { apD = D; RQ.accF = D.acc.some((x) => x.a.i === RQ.accF) ? RQ.accF : null;
    apRows = D.acc.slice().sort((x, y) => y.cwA - x.cwA || y.t.length - x.t.length).flatMap((x) => ptsOf(x.a)); } return apRows; };
  const apCols = [{ k: "aname", lab: "บัญชี", f: (o) => mAcc(o.acc.i), v: (o) => o.acc.name }, { k: "aba", lab: "ธนาคาร / เลขบัญชี", sh: "เลขบัญชี", v: (o) => `${o.acc.bank} ${o.acc.acc}` },
    ...ptCols.filter((c) => c.k !== "accs" && c.k !== "accno")];
  const apTitle = () => { const a = RQ.accF == null ? null : DB.map.accs[RQ.accF];
    return a ? `จุดของ ${esc(rqAcc(a))} <small>${esc(a.bank)} ${esc(a.acc)}</small>` : "จุดของแต่ละบัญชี <small>เรียงตามบัญชี → กลุ่มพื้นที่</small>"; };
  const accPick = (x) => { RQ.accF = RQ.accF === x.a.i ? null : x.a.i; T.ap.draw(); const h = $("#rqAP h2"); if (h) h.innerHTML = apTitle();
    $$("#rqA tbody tr").forEach((tr) => tr.classList.toggle("sel", RQ.accF != null && (($("#rqA table")._rows || [])[+tr.dataset.i] || {}).a === DB.map.accs[RQ.accF]));
    setTimeout(() => $("#rqAP").scrollIntoView({ behavior: "smooth", block: "start" }), 60); };
  T.a = table($("#rqA"), { title: "สรุปตามบัญชี — บัญชีที่ต้องขอข้อมูล", sub: "เรียงตามยอดถอนที่เคาน์เตอร์ · กดแถว = ตารางล่างเหลือเฉพาะบัญชีนั้น (กดซ้ำ = ทุกบัญชี)", rows: () => D.acc, sort: "cwA", csvName: "สรุปตามบัญชี", lead: false,
    cols: [stCols[0], { k: "name", lab: "ชื่อบัญชี", f: (x) => mAcc(x.a.i), v: (x) => x.a.name }, { k: "grp", lab: "กลุ่มบัญชี", v: (x) => (x.a.id ? "บัญชีเป้าหมาย" : "บัญชีเกี่ยวข้อง") },
      { k: "bank", lab: "ธนาคาร", v: (x) => x.a.bank }, { k: "acc", lab: "เลขบัญชี", v: (x) => x.a.acc }, { k: "ks", lab: "กรรมที่", w: 1, v: (x) => rqKs(KM.byAcc.get(rqN(x.a.acc))) },
      { k: "cwN", lab: "ถอนเคาน์เตอร์ (ครั้ง)", sh: "ถอนสาขา (ครั้ง)", n: 1 }, { k: "cwA", lab: "ถอนเคาน์เตอร์ (ยอด)", sh: "ถอนสาขา (ยอด)", n: 1, f: (x) => (x.cwA ? B(x.cwA) : "") },
      { k: "cdN", lab: "ฝากเคาน์เตอร์ (ครั้ง)", sh: "ฝากสาขา (ครั้ง)", n: 1 }, { k: "cdA", lab: "ฝากเคาน์เตอร์ (ยอด)", sh: "ฝากสาขา (ยอด)", n: 1, f: (x) => (x.cdA ? B(x.cdA) : "") },
      { k: "mdN", lab: "ฝาก/รับโอนที่ตู้ (ครั้ง)", sh: "เข้าที่ตู้ (ครั้ง)", n: 1 }, { k: "mdA", lab: "ฝาก/รับโอนที่ตู้ (ยอด)", sh: "เข้าที่ตู้ (ยอด)", n: 1, f: (x) => (x.mdA ? B(x.mdA) : "") },
      { k: "mwN", lab: "ถอน/โอนออกที่ตู้ (ครั้ง)", sh: "ออกที่ตู้ (ครั้ง)", n: 1 }, { k: "mwA", lab: "ถอน/โอนออกที่ตู้ (ยอด)", sh: "ออกที่ตู้ (ยอด)", n: 1, f: (x) => (x.mwA ? B(x.mwA) : "") },
      { k: "pK", lab: "จุดทราบที่ตั้ง", n: 1 }, { k: "pU", lab: "จุดไม่ทราบที่ตั้ง", n: 1 }, { k: "prov", lab: "จังหวัด", w: 1 },
      { k: "first", lab: "ช่วงวันที่", f: rngF, s: (x) => x.first, range: rng }, stCols[1], stCols[2]],
    click: accPick });
  T.ap = table($("#rqAP"), { title: apTitle(), sub: "ครั้ง/ยอด = ของบัญชีนั้น · กดแถวดูรายการ", rows: () => accPtRows().filter((o) => RQ.accF == null || o.acc.i === RQ.accF), sort: "", csvName: "จุดตามบัญชี", lead: false, max: 600,
    cols: apCols, click: ptClick, total: ptTot });
  T.t = table($("#rqT"), { title: "ทุกรายการ — แนบท้ายหนังสือถึงธนาคาร", sub: "1 แถว = 1 ครั้งที่ตู้/เคาน์เตอร์", rows: () => D.tx, sort: "t", desc: false, max: 600, csvName: "ทุกรายการขอข้อมูล", lead: false, cols: txCols,
    total: (r) => `รวม ${B(r.reduce((s, x) => s + x.e.amt, 0))} บาท` });

  /* ===== คำขอทั้งหมด = จุดตู้/สาขาของบัญชีที่เลือก + งานติดตามเส้นเงิน (ขอ STM · สอบพยาน · วอลเล็ต ฯลฯ) — กรองตามประเภท / มี STM แล้วหรือยัง ===== */
  const FT = rqFlowTasks();
  const ptCats = (o) => { const c = new Set(), d = o.doc || ""; if (/ที่ตั้ง/.test(d)) c.add("loc"); if (/ใบถอน|ใบนำฝาก/.test(d)) c.add("slip"); if (/CCTV/.test(d)) c.add("cctv"); return c; };
  const qRows = () => { const byRc = new Map(), out = [];
    D.pts.forEach((o) => { const r = { src: "P", o, so: o, rc: o.rc, cats: ptCats(o), stm: 1, amt: o.amt, n: o.n, first: isoSec(o.first), last: isoSec(o.last), ks: new Set(ptKs(o)), acts: [] }; byRc.set(o.rc, r); out.push(r); });
    FT.forEach((t) => { const cs = RQ_ACAT[flActOf(t)] || ["oth"], hit = byRc.get(t.rc);
      if (hit) { cs.forEach((c) => hit.cats.add(c)); t.ks.forEach((k) => hit.ks.add(k)); hit.acts.push(t); return; }
      out.push({ src: "F", t, so: t, rc: t.rc, cats: new Set(cs), stm: ["stm", "ext"].includes(flActOf(t)) ? 0 : 1, amt: t.amt, n: t.n, first: t.first || "", last: t.last || "", ks: t.ks, acts: [t] }); });
    return out; };
  const stmOk = (r, f) => f === "all" || (f === "have" ? r.stm : !r.stm);
  const qFoc = (r) => { const f = RQ.focus; return f.rc ? r.rc === f.rc || r.acts.some((t) => t.rc === f.rc) : r.ks.has(f.k); };
  const qShown = () => qRows().filter((r) => (RQ.focus ? qFoc(r) : stmOk(r, RQ.stmF) && (!RQ.cats.size || [...r.cats].some((c) => RQ.cats.has(c)))));
  const qTarget = (r) => (r.src === "P" ? r.o.place || (r.o.mcs.size ? `ตู้ ${r.o.bank} (ยังไม่ทราบที่ตั้ง)` : `${r.o.bank} สาขา ${r.o.branch}`) : flTkName(r.t));
  const qBank = (r) => (r.src === "P" ? r.o.bank : r.t.kind === "C" ? r.rc.split("-")[0] : r.t.bank || "");
  const qCode = (r) => (r.src === "F" ? r.t.code : r.rc);
  const catChips = (r) => [...r.cats].map((c) => `<span class="cat c-${c}">${RQ_CAT[c]}</span>`).join("");
  const ksTxt = (ks) => (ks.size ? `กรรมที่ ${[...ks].sort((a, b) => a - b).join(", ")}` : "");
  const srcNote = (t) => { const a = FL_ACT[flActOf(t)]; return `<b>${esc(a[0])}</b> — ${esc(a[1])}<br><span class="miss">ขาดข้อมูล: ${esc(flMiss(t))}</span> · <a href="#flow/k" data-flgo="${esc(t.rc)}">ดูผังเส้นเงินของงานนี้ ›</a>`; };
  const taskDet = (t, h) => { if (!t.rows.length) { h.innerHTML = `<p class="note">${srcNote(t)}<br>${esc(ksTxt(t.ks))} — ผู้เสียหายโอนเข้าบัญชีนี้โดยตรง</p>`; return; }
    table(h, { title: `ที่มาของคำขอ · ${esc(fcCut(flTkName(t), 60))}`, note: srcNote(t), noteShow: true, rows: () => t.rows, sort: "t", desc: false, csvName: "ที่มาของคำขอ", lead: false, search: false,
      cols: [{ k: "k", lab: "กรรมที่", n: 1 }, { k: "t", lab: "วันเวลา", f: (x) => dtTh(x.t), date: (x) => x.t }, { k: "from", lab: "ออกจากบัญชี", v: (x) => flName(x.from) }, { k: "typ", lab: "ลักษณะ", v: (x) => FL_T[x.typ] }, { k: "amt", lab: "ยอด", n: 1, f: (x) => B(x.amt) }],
      total: (r) => `รวม ${B(r.reduce((q, x) => q + x.amt, 0))} บาท` }); };
  T.q = table($("#rqQ"), { title: "คำขอทั้งหมด", sub: "รวมจุดตู้/สาขาของบัญชีที่เลือก และงานติดตามเส้นเงิน (ขอ STM · สอบพยาน · วอลเล็ต ฯลฯ) ไว้ตารางเดียว · กรองด้วยปุ่มด้านบน · ★ ความจำเป็นตามยอดเงิน · กดแถว = ที่มาของคำขอ",
    rows: qShown, sort: "star", csvName: "คำขอทั้งหมด", lead: false, max: 500,
    cols: [{ k: "rqs", lab: "สถานะ", f: (r) => stCell(r.so), v: (r) => { const v = rqStat(r.so); return RQ_SL[v.s] + (v.auto ? " (มีไฟล์)" : ""); } },
      { k: "star", lab: "ความจำเป็น", f: (r) => flStarH(r.amt, r.ks.size), v: (r) => flStarT(r.amt, r.ks.size), s: (r) => flStar(r.amt, r.ks.size) * 1e12 + r.ks.size * 1e9 + r.amt },
      { k: "cat", lab: "ประเภทคำขอ", w: 1, f: catChips, v: (r) => [...r.cats].map((c) => RQ_CAT[c]).join(", ") },
      { k: "stm", lab: "กลุ่ม", hide: 1, v: (r) => (r.stm ? "จาก STM ที่ได้แล้ว" : "ต้องขอ STM") },
      { k: "ks", lab: "กรรมที่", w: 1, f: (r) => (r.ks.size ? `<b class="ktxt">${esc(rqKs(r.ks))}</b>` : '<span class="muted">-</span>'), v: (r) => rqKs(r.ks), s: (r) => (r.ks.size ? Math.min(...r.ks) : 1e9) },
      { k: "tg", lab: "เป้าหมาย", w: 1, f: (r) => (r.src === "F" && "NXL".includes(r.t.kind) ? av(flTkD(r.t).name) : "") + esc(qTarget(r)), v: qTarget },
      { k: "bank", lab: "ส่งหนังสือถึง", f: (r) => bankIco(qBank(r)) + esc(qBank(r)), v: qBank }, { k: "n", lab: "ครั้ง", n: 1 }, { k: "amt", lab: "ยอด", n: 1, f: (r) => B(r.amt) },
      { k: "first", lab: "ช่วงวันที่", f: (r) => (r.first ? `${dS(r.first)} – ${dS(r.last)}` : ""), s: (r) => r.first, range: (r) => [r.first.slice(0, 10), r.last.slice(0, 10)] },
      { k: "from", lab: "จากบัญชี", w: 1, f: (r) => (r.src === "P" ? accCell(r.o) : r.t.kind === "N" ? '<small class="muted">ผู้เสียหายโอนเข้าโดยตรง</small>' : [...r.t.from].slice(0, 3).map((o) => esc(flName(o))).join("<br>") + (r.t.from.size > 3 ? ` <small>+${r.t.from.size - 3}</small>` : "")), v: (r) => (r.src === "P" ? accTxt(r.o) : [...r.t.from].map(flName).join(" ; ")) },
      { k: "need", lab: "สิ่งที่ต้องขอ / ทำ", w: 1, hide: 1, v: (r) => (r.src === "P" ? [r.o.doc, ...r.acts.map((t) => FL_ACT[flActOf(t)][0])].filter(Boolean).join(" + ") : `${FL_ACT[flActOf(r.t)][0]} — ${flMiss(r.t)}`) },
      { k: "prov", lab: "จังหวัด", hide: 1, v: (r) => (r.src === "P" ? r.o.prov : r.t.prov || "") }, { k: "grp", lab: "กลุ่มพื้นที่", hide: 1, v: (r) => (r.src === "P" ? r.o.grp : "") },
      { k: "ed", lab: "แก้ไข", f: (r) => (r.acts.length ? `<a href="#" class="cmpl" data-qed="${esc(r.acts[0].rc)}" title="แก้งานที่ต้องทำ · หมายเหตุ · ชื่อ/เลขบัญชีปลายทาง">✎</a>` : ""), v: (r) => (r.acts.length ? (rqStore()[r.acts[0].rc] || {}).n || "" : "") },
      { k: "rc", lab: "รหัสคำขอ", f: (r) => `<button class="rcb" data-copy="${esc(qCode(r))}" title="กดเพื่อคัดลอก — ใช้ตั้งชื่อโฟลเดอร์ไฟล์ที่ได้รับ">${esc(qCode(r))}</button>`, v: qCode },
      { k: "rqd", lab: "วันที่สถานะ", hide: 1, v: (r) => rqStat(r.so).d || "", date: (r) => rqStat(r.so).d || "" }],
    total: (r) => `รวม ${B(r.reduce((q, x) => q + x.amt, 0))} บาท`,
    click: (r, h) => (r.src === "P" ? ptClick(r.o, h) : taskDet(r.t, h)) });
  const qCrumb = () => { const f = RQ.focus, el = $("#rqCrumb"); if (!el) return; el.hidden = !f; if (!f) return;
    const t = f.rc && FT.find((x) => x.rc === f.rc), lab = f.k ? `งานของกรรมที่ ${f.k}` : t ? fcCut(flTkName(t), 60) : f.rc;
    el.innerHTML = `${f.back ? `<button class="tb" id="rqBack" title="กลับไปหน้าเส้นเงินตำแหน่งเดิม">← กลับไปหน้าเส้นเงิน</button>` : ""}<span class="flnow">แสดงเฉพาะ <b>${esc(lab)}</b></span><button class="tb" id="rqAll">แสดงคำขอทั้งหมด</button>`; };
  const qFilt = () => { qCrumb(); const all = qRows(), base = all.filter((r) => stmOk(r, RQ.stmF)), cnt = (c) => base.filter((r) => r.cats.has(c)).length;
    $("#rqQF").innerHTML = `<div class="seg">${[["all", "ทั้งหมด"], ["have", "จาก STM ที่ได้แล้ว (สอบพยาน · ตู้ · สาขา)"], ["need", "ต้องขอ STM"]].map(([k, l]) => `<button data-qs="${k}" class="${RQ.stmF === k ? "on" : ""}">${l} ${nf(all.filter((r) => stmOk(r, k)).length)}</button>`).join("")}</div>
      <div class="cchips"><button data-qc="" class="${RQ.cats.size ? "" : "on"}">ทุกประเภท</button>${Object.keys(RQ_CAT).filter((c) => cnt(c) || RQ.cats.has(c)).map((c) => `<button data-qc="${c}" class="cat c-${c} ${RQ.cats.has(c) ? "on" : ""}">${RQ_CAT[c]} ${nf(cnt(c))}</button>`).join("")}</div>`; };

  /* ===== บัญชีคุม STM : บัญชีที่ได้ STM แล้ว / ต้องขอต่อ ===== */
  const ksOf = new Map(); if (DB.flow) { DB.flow.kam.forEach((k) => { if (!ksOf.has(k.l1)) ksOf.set(k.l1, new Set()); ksOf.get(k.l1).add(k.k); }); (RQ.ho || []).forEach((h) => [h.from, h.to].forEach((o) => { if (!o) return; if (!ksOf.has(o)) ksOf.set(o, new Set()); ksOf.get(o).add(h.k); })); }
  const S_HAVE = DB.flow ? DB.flow.accs.map((a) => ({ have: 1, a, rc: rqSafe(`บัญชี-${a.bank}-${a.acc}`), name: a.name, bank: a.bank, acc: a.acc, layer: a.layer || 0, amt: a.tin || 0, n: a.nk || 0, ks: ksOf.get(a.o) || new Set(), first: a.first, last: a.last,
    note: a.layer ? `รับเงินผู้เสียหาย (แถว ${a.layer})` : "ไม่ได้รับเงินผู้เสียหายรายนี้" })) : [];
  const S_NEED = FT.filter((t) => "NXL".includes(t.kind) && ["stm", "ext"].includes(flActOf(t))).map((t) => { const d = flTkD(t); return { t, so: t, rc: t.rc, name: d.name || "(ไม่มีชื่อในไฟล์)", bank: d.bank, acc: d.acc, layer: t.kind === "N" ? 1 : t.kind === "X" ? Math.max(1, ...t.ds) + 1 : Math.max(1, ...t.ds), amt: t.amt, n: t.n, ks: t.ks, first: "", last: "" }; });
  const sRows = () => [...S_HAVE, ...S_NEED].filter((r) => RQ.sF === "all" || (RQ.sF === "have" ? r.have || rqStat(r.so).s === "g" : !r.have && rqStat(r.so).s !== "g"));
  T.s = table($("#rqS"), { title: "บัญชีคุม STM", sub: "บัญชีที่ได้ statement แล้ว และบัญชีที่ต้องขอต่อ (แถวถัดไป / บัญชีแถวแรกที่ยังไม่มี / เงินค้างที่ต้องขอช่วงถัดไป) · ★ ตามยอดเงินผู้เสียหายที่เข้า — ★ เดียว = ต่ำกว่า 1,000 บาท อาจเป็นการทดสอบบัญชี",
    rows: sRows, sort: "star", csvName: "บัญชีคุม_STM", lead: false, max: 500,
    cols: [{ k: "st", lab: "STM", f: (r) => (r.have ? '<span class="rqs rqK">✓ ได้รับแล้ว</span>' : stCell(r.so)), v: (r) => (r.have ? "ได้รับแล้ว" : RQ_SL[rqStat(r.so).s] + (rqStat(r.so).auto ? " (มีไฟล์)" : "")) },
      { k: "star", lab: "ความจำเป็น", f: (r) => (r.amt ? flStarH(r.amt, r.ks.size) : '<span class="muted">-</span>'), v: (r) => (r.amt ? flStarT(r.amt, r.ks.size) : ""), s: (r) => (r.amt ? flStar(r.amt, r.ks.size) * 1e12 + r.ks.size * 1e9 + r.amt : -1) },
      { k: "name", lab: "ชื่อบัญชี", w: 1, f: (r) => (r.have ? accLink(r.a.o) : av(r.name) + esc(r.name)), v: (r) => r.name }, { k: "ba", lab: "ธนาคาร / เลขบัญชี", sh: "เลขบัญชี", f: (r) => `${bankIco(r.bank)}${esc(r.bank)} ${esc(r.acc)}`, v: (r) => `${r.bank} ${r.acc}` },
      { k: "layer", lab: "แถว", n: 1, f: (r) => (r.layer ? r.layer : ""), v: (r) => r.layer }, { k: "amt", lab: "เงินผู้เสียหายที่เข้า", n: 1, f: (r) => (r.amt ? B(r.amt) : "") }, { k: "n", lab: "ครั้ง", n: 1, f: (r) => r.n || "" },
      { k: "ks", lab: "กรรมที่", w: 1, f: (r) => esc(fcKs(r.ks)), v: (r) => [...r.ks].sort((a, b) => a - b).join(", "), s: (r) => r.ks.size },
      { k: "rng", lab: "ช่วงข้อมูล STM", f: (r) => (r.have ? `${dS(r.first)} – ${dS(r.last)}` : ""), s: (r) => r.first || "", range: (r) => [r.first || "", r.last || ""] },
      { k: "note", lab: "หมายเหตุ", w: 1, f: (r) => (r.have ? esc(r.note) : `<span class="miss">${esc(flMiss(r.t))}</span>`), v: (r) => (r.have ? r.note : flMiss(r.t)) },
      { k: "rc", lab: "รหัสคำขอ", f: (r) => (r.have ? "" : `<button class="rcb" data-copy="${esc(r.t.code)}" title="กดเพื่อคัดลอก">${esc(r.t.code)}</button>`), v: (r) => (r.have ? "" : r.t.code) }],
    total: (r) => `${nf(r.filter((x) => x.have).length)} บัญชีได้ STM แล้ว · ${nf(r.filter((x) => !x.have).length)} บัญชีต้องขอ`,
    click: (r, h) => (r.have ? (h.innerHTML = `<p class="note">${esc(r.name)} — มี statement ${dS(r.first)} – ${dS(r.last)} · <a href="#acc/${esc(r.a.o)}">ดูรายละเอียดบัญชี ›</a> · <a href="#flow/k">ดูเส้นเงิน ›</a></p>`) : taskDet(r.t, h)) });
  const sFilt = () => { const all = [...S_HAVE, ...S_NEED], hv = all.filter((r) => r.have || rqStat(r.so).s === "g").length;
    $("#rqSF").innerHTML = `<div class="seg">${[["all", "ทั้งหมด", all.length], ["have", "ได้ STM แล้ว", hv], ["need", "ต้องขอ STM", all.length - hv]].map(([k, l, n]) => `<button data-ss="${k}" class="${RQ.sF === k ? "on" : ""}">${l} ${nf(n)}</button>`).join("")}</div>`; };
  root.addEventListener("click", (e) => {
    const a = e.target.closest("[data-qs],[data-qc],[data-ss],[data-flgo],[data-qed],#rqBack,#rqAll"); if (!a) return;
    if (a.dataset.flgo != null) { const t = FT.find((x) => x.rc === a.dataset.flgo), ks = t ? [...t.ks].sort((p, q) => p - q) : [];
      if (ks.length) { FLX.sel = new Set(ks); FLX.label = ks.length === 1 ? `กรรมที่ ${ks[0]}` : `${ks.length} กรรม (ที่ ${ks.slice(0, 8).join(", ")}${ks.length > 8 ? " …" : ""})`; FLX.init = true; } FLX.tab = "k"; return; }
    e.preventDefault(); e.stopPropagation();
    if (a.id === "rqBack") { const b = RQ.focus && RQ.focus.back; if (RQ.focus) FLX.fwdReq = RQ.focus.rc ? { rc: RQ.focus.rc } : { k: RQ.focus.k }; RQ.focus = null; if (b) { history.length > 1 ? history.back() : (location.hash = b); } return; }
    if (a.id === "rqAll") { RQ.focus = null; }
    else if (a.dataset.qed != null) { const t = FT.find((x) => x.rc === a.dataset.qed); if (t) flEdit(t, () => { T.q.draw(); qFilt(); summary(); }); return; }
    if (a.dataset.qs != null) RQ.stmF = a.dataset.qs;
    else if (a.dataset.qc != null) { const c = a.dataset.qc; if (!c) RQ.cats.clear(); else if (RQ.cats.has(c)) RQ.cats.delete(c); else RQ.cats.add(c); }
    else if (a.dataset.ss != null) RQ.sF = a.dataset.ss;
    $("[data-det]", T.q.host).innerHTML = ""; T.q.draw(); T.s.draw(); qFilt(); sFilt(); });

  /* สรุปด้านบน + แท็บ */
  const summary = () => {
    const items = [...qRows().map((r) => r.so), ...D.acc], c = { "": 0, q: 0, g: 0, x: 0 }; qFilt(); sFilt(); items.forEach((o) => c[rqStat(o).s]++);
    const nb = (DB.map.noterm || {}).by || {}, nt = [...sel].reduce((q, i) => { const v = nb[i]; return v ? [q[0] + v[0], q[1] + v[1]] : q; }, [0, 0]);
    const ms = MAPX.f.accs, add = [...sel].filter((i) => !ms.has(i)).length, cut = [...ms].filter((i) => !sel.has(i)).length;
    $("#rqLead").innerHTML = `บัญชีที่เลือก <b>${nf(sel.size)}</b> บัญชี <small>(${add || cut ? `ตามหน้าแผนที่ ${nf(sel.size - add)}${add ? ` · เพิ่มเอง ${nf(add)}` : ""}${cut ? ` · ตัดออก ${nf(cut)}` : ""}` : "ตามหน้าแผนที่"})</small> · ${nf(D.tx.length)} รายการที่ตู้/เคาน์เตอร์<br>
      ทราบที่ตั้ง <b class="y">${nf(known().length)}</b> จุด (${nG} กลุ่มพื้นที่) · ไม่ทราบที่ตั้ง <b>${nf(unk().length)}</b> จุด · คำขอทั้งหมด ${nf(items.length)} รายการ (จุด + บัญชี)${nt[0] ? `<br><small>ไม่รวมรายการโอนต่างธนาคารที่ไฟล์ไม่ระบุเครื่อง ${nf(nt[0])} รายการ ${M(nt[1])} — ไม่มีตู้ให้ขอ CCTV ให้ขอช่องทาง/เครื่องที่ทำรายการจากธนาคารของผู้โอน</small>` : ""}`;
    $("#rqKpi").innerHTML = `<div class="kc"><span class="l">ยังไม่ขอ</span><span class="v">${nf(c[""])}</span><span class="s">คำขอ</span></div>
      <div class="kc"><span class="l">ขอแล้ว รอผล</span><span class="v">${nf(c.q)}</span><span class="s">คำขอ</span></div>
      <div class="kc"><span class="l">ได้รับแล้ว</span><span class="v">${nf(c.g)}</span><span class="s">ไม่ต้องขอ ${nf(c.x)}</span></div>`;
    $("#rqAccN").textContent = sel.size === A.length ? "ทั้งหมด" : sel.size;
    const tabs = [["q", "คำขอทั้งหมด", qRows().length], ["s", "บัญชีคุม STM", S_HAVE.length + S_NEED.length], ["all", "จุดตู้/สาขา", D.pts.length], ["k", "ทราบที่ตั้ง", known().length], ["u", "ไม่ทราบที่ตั้ง", unk().length], ["a", "ตามบัญชี", D.acc.length], ["t", "ทุกรายการ", D.tx.length]];
    $("#rqTabs").innerHTML = tabs.map(([t, l, n]) => `<button data-rt="${t}" class="${t === RQ.tab ? "on" : ""}">${l} ${nf(n)}</button>`).join("");
  };
  const curT = () => T[RQ.tab in LOC ? "p" : RQ.tab];
  const setTab = (k) => { RQ.tab = k; const box = k in LOC ? "p" : k; if (k in LOC && RQ.loc !== k) { RQ.loc = k; $("[data-det]", T.p.host).innerHTML = ""; T.p.draw(); }
    $$("[data-rq]", root).forEach((x) => (x.hidden = x.dataset.rq !== box)); $("#rqBulkW").hidden = k === "t"; summary(); };
  const redraw = () => { Object.values(T).forEach((t) => { $("[data-det]", t.host).innerHTML = ""; t.draw(); }); summary(); };
  if (!RQ.tab || RQ.tab === "k" && RQ.loc === undefined) RQ.tab = "q"; RQ.loc = RQ.tab in LOC ? RQ.tab : RQ.loc || "all"; T.p.draw(); setTab(RQ.tab);
  $("#rqTabs").addEventListener("click", (e) => { const b = e.target.closest("[data-rt]"); if (b) setTab(b.dataset.rt); });
  if (RQ.focus && RQ.tab === "q") requestAnimationFrame(() => { const tr = $("#rqQ tbody tr[data-i]"); if (tr) tr.click(); window.scrollTo(0, Math.max(0, $("#rqTabs").getBoundingClientRect().top + window.scrollY - 70)); });
  $("#rqR").addEventListener("change", (e) => { RQ.R = +e.target.value; nG = rqGroup(D.pts, RQ.R); apD = null; T.p.draw(); T.ap.draw(); T.t.draw(); summary(); toast(`จัดกลุ่มใหม่: ${nG} กลุ่มพื้นที่ (รัศมี ${RQ.R} กม.)`); });

  /* เลือกบัญชี */
  const accList = () => { const q = $("#rqAccQ").value.trim().toLowerCase();
    $("#rqAccL").innerHTML = A.filter((a) => nByA.get(a.i) && (!q || (a.name + " " + a.acc + " " + a.bank).toLowerCase().includes(q)))
      .sort((x, y) => (y.id ? 1 : 0) - (x.id ? 1 : 0) || nByA.get(y.i) - nByA.get(x.i))
      .map((a) => `<label><input type="checkbox" value="${a.i}" ${sel.has(a.i) ? "checked" : ""}><span class="dot" style="background:${a.col}"></span><span class="nm">${esc(a.name)}${VX.has(a.i) ? ' <b class="miss">· ผู้เสียหาย</b>' : ""}</span><small>${a.bank} ${a.acc} · ${nf(nByA.get(a.i))}</small></label>`).join(""); };
  const applySel = () => { gSelMerge(A.map((a) => gK(a.acc)), A.filter((a) => sel.has(a.i)).map((a) => gK(a.acc))); MAPX.f.accs = new Set(sel); rebuild(); redraw(); };
  accList();
  if ($("#rqInclV")) $("#rqInclV").addEventListener("change", (e) => { RQ.inclV = e.target.checked; rebuild(); redraw(); });
  $("#rqAccQ").addEventListener("input", accList);
  $("#rqAccL").addEventListener("change", (e) => { if (e.target.type !== "checkbox") return; const i = +e.target.value; e.target.checked ? sel.add(i) : sel.delete(i); applySel(); });
  $("#rqPick").addEventListener("click", (e) => { const b = e.target.closest("[data-q]"); if (!b) return; sel = new Set(b.dataset.q === "m" ? MAPX.f.accs : b.dataset.q === "a" ? A.map((a) => a.i) : b.dataset.q === "f" ? A.filter((a) => a.id).map((a) => a.i) : []); accList(); applySel(); });
  const outPick = (e) => { const p = $("#rqPick"); if (!p) return document.removeEventListener("click", outPick); if (p.open && !p.contains(e.target)) p.open = false; };
  document.addEventListener("click", outPick);

  /* สถานะรายแถว / ทั้งตาราง / คัดลอกรหัส */
  root.addEventListener("change", (e) => { const s = e.target.closest("select[data-rc]"); if (!s) return; rqSet(s.dataset.rc, s.value); curT().draw(); summary(); });
  root.addEventListener("click", (e) => { const b = e.target.closest("[data-copy]"); if (!b) return; e.stopPropagation();
    const t = b.dataset.copy; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast("คัดลอกรหัสคำขอแล้ว: " + t), () => toast("รหัสคำขอ: " + t)); }, true);
  $("#rqBulk").addEventListener("change", (e) => { const v = e.target.value; e.target.value = "-"; if (v === "-") return;
    const rows = curT().rows().filter((o) => !rqStat(o).auto && rqStat(o).s !== v);
    if (!rows.length) return toast("ไม่มีแถวที่ต้องเปลี่ยน");
    if (!confirm(`ตั้งสถานะ "${RQ_SL[v]}" ให้ ${nf(rows.length)} แถวที่แสดงอยู่ในตารางนี้?`)) return;
    rows.forEach((o) => rqSet(o.rc, v)); curT().draw(); summary(); toast(`ตั้งสถานะ ${nf(rows.length)} แถวแล้ว`); });

  /* สำรอง / นำเข้าสถานะ (ย้ายระหว่างเครื่อง หรือวางไว้ที่ 0_บันทึกงาน เพื่อเป็นสถานะกลาง) */
  $("#rqSaveF").addEventListener("click", rqSaveFile);
  $("#rqLoadF").addEventListener("click", () => $("#rqFile").click());
  $("#rqFile").addEventListener("change", async (e) => { const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    try { const j = JSON.parse(await f.text()), inc = j.st || j; let n = 0;
      const loc = rqLoad(RQ_KEY.st, {}), st = rqStore();
      Object.entries(inc).forEach(([k, v]) => { if (v && typeof v === "object" && (!st[k] || (v.ts || 0) > (st[k].ts || 0))) { st[k] = v; loc[k] = v; n++; } });
      rqSave(RQ_KEY.st, loc); redraw(); toast(`นำเข้า ${nf(n)} สถานะ (ใช้รายการที่ใหม่กว่า)`);
    } catch (err) { toast("ไฟล์สถานะไม่ถูกต้อง: " + err.message); } });

  $("#rqXls").addEventListener("click", async (ev) => {
    const btn = ev.currentTarget; btn.disabled = true;
    try {
      await loadXLSX();
      const wb = XLSX.utils.book_new(), now = new Date();
      const sheets = [["0 คำขอทั้งหมด", T.q, "จุดตู้/สาขา + งานติดตามเส้นเงิน (ขอ STM · สอบพยาน · วอลเล็ต ฯลฯ) ตามตัวกรองประเภทที่เลือก"], ["0.1 บัญชีคุม STM", T.s, "บัญชีที่ได้ statement แล้ว / ต้องขอต่อ พร้อมความจำเป็น (ดาว)"], [`1 จุด (${LOC[RQ.loc] || "ทุกจุด"})`, T.p, "จุดที่ส่งเจ้าหน้าที่ขอ CCTV/เอกสาร เรียงตามกลุ่มพื้นที่ (จุดไม่ทราบที่ตั้ง = ส่งธนาคารเจ้าของตู้ระบุที่ตั้ง)"], ["2 ตามบัญชี", T.a, "บัญชีที่ต้องขอข้อมูล + จำนวนครั้งแยกช่องทาง"], ["3 จุดตามบัญชี", T.ap, "จุดของแต่ละบัญชี เรียงบัญชี → กลุ่มพื้นที่"], ["4 ทุกรายการ", T.t, "รายการรายครั้ง สำหรับแนบหนังสือถึงธนาคาร (วันเวลา ค.ศ.)"]];
      const read = [["รายการขอข้อมูลธนาคาร", ""], ["สร้างเมื่อ", now.toLocaleString("th-TH")], ["ข้อมูล ณ", DB.built], ["บัญชีที่เลือก", `${sel.size} บัญชี`], ["รัศมีจัดกลุ่มพื้นที่", RQ.R + " กม."], ["", ""], ["ชีต", "เนื้อหา"]];
      sheets.forEach(([n, t, d]) => { const a = t.aoa(); read.push([n, `${d} — ${nf(a.body.length)} แถว${t.nf() ? " (ตามตัวกรองที่ตั้งไว้)" : ""}`]); });
      read.push(["", ""], ["รหัสคำขอ", `ใช้ตั้งชื่อโฟลเดอร์ย่อยใน ${fold} เมื่อได้รับไฟล์จากธนาคาร`], ["หมายเหตุ", "พิกัดเป็นระดับอำเภอโดยประมาณ (ตำแหน่งสาขาเจ้าของตู้) — ตรวจทานกับคอลัมน์ 'รหัสในไฟล์' ก่อนส่งหนังสือ"], ["", "สถานะ 'ที่ตั้งอนุมาน' ต้องให้ธนาคารยืนยันที่ตั้งตู้ก่อนขอ CCTV"]);
      const ws0 = XLSX.utils.aoa_to_sheet(read); ws0["!cols"] = [{ wch: 22 }, { wch: 90 }];
      XLSX.utils.book_append_sheet(wb, ws0, "อ่านก่อน");
      sheets.forEach(([n, t]) => XLSX.utils.book_append_sheet(wb, xlSheet(t.aoa()), n));
      XLSX.writeFile(wb, `รายการขอข้อมูลธนาคาร_${rqToday().replace(/-/g, "")}.xlsx`);
    } catch (err) { toast("ส่งออก Excel ไม่สำเร็จ: " + err.message); }
    btn.disabled = false;
  });
}
