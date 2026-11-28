/* ================= ผังเส้นทางเงิน (SVG) : รายกรรม / หลายกรรม / ทั้งคอก — บันทึกเป็นภาพ และออกรายงานได้ =================
   ใช้สีคงที่พื้นขาว (ไม่ตามธีม) เพื่อให้ภาพที่บันทึกออกมาเหมือนกันทุกเครื่อง */
const FC = { S: "#00264D", C: "#B3261E", X: "#C77700", F: "#1565C0", B: "#2E7D32", O: "#78909C" };
const FC_FONT = "Sarabun, 'Leelawadee UI', Tahoma, 'Noto Sans Thai', sans-serif";
const fcT = (t0, t1, n) => (!t0 ? "" : n > 1 && t1 !== t0 ? `${dS(t0)} ${t0.slice(11, 19)} – ${t1.slice(0, 10) === t0.slice(0, 10) ? t1.slice(11, 19) : dS(t1) + " " + t1.slice(11, 19)}` : `${dS(t0)} ${t0.slice(11, 19)}`);
const fcCut = (s, n) => { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

/* บทบาทของกล่องบัญชี -> สีกล่อง (เรียงตามลำดับความสำคัญ) */
const FC_ROLE = { cl: ["#AD1457", "#FDEDF3", "คอกม้า (ผู้ควบคุมร่วม)"], agg: ["#00796B", "#E3F4F1", "ตัวรวมเงิน (รับจากหลายบัญชี)"], hold: ["#6D4C41", "#F6EFEA", "บัญชีพัก (เงินค้างนาน/ค้างมาก)"],
  cash: ["#6A1B9A", "#F6EEFA", "ม้าถอนเงินสด"], corp: ["#455A64", "#ECEFF1", "นิติบุคคล / ร้านค้า / วอลเล็ต"], mule: ["#00264D", "#FFFFFF", "บัญชีม้า"], nost: ["#8A8A8A", "#FFFFFF", "ยังไม่มี statement"] };
/* สีสามเหลี่ยม ! ตามงานที่ต้องทำต่อ */
const FL_ACT_C = { stm: "#E65100", ext: "#EF6C00", atm: "#1565C0", br: "#6A1B9A", shop: "#C62828", itv: "#C62828", wal: "#00838F", pay: "#546E7A", abr: "#283593", frz: "#212121", oth: "#795548" };
/* ไอคอนตามประเภทงานที่ต้องทำต่อ (เส้นบนตาราง 24x24) — ดูรูปแล้วรู้ทันทีว่าต้องขออะไร ไม่ต้องจำสี */
const FL_ICO = {
  atm: "M4 2.5h16v12H4z M7 5.5h10v4.5H7z M7 12h2 M11 12h2 M15 12h2 M6 14.5v7h12v-7 M8.5 17.5h7 M9.5 17.5v3h5v-3",                                      // ตู้ ATM
  br: "M3 9.5 12 4l9 5.5 M4 10.5h16 M6 10.5v7.5 M10 10.5v7.5 M14 10.5v7.5 M18 10.5v7.5 M3 20.5h18",   // สาขาธนาคาร
  shop: "M4 9.5 5.5 4h13L20 9.5 M4 9.5c0 1.6 1.2 2.6 2.7 2.6s2.6-1 2.6-2.6c0 1.6 1.2 2.6 2.7 2.6s2.7-1 2.7-2.6c0 1.6 1.1 2.6 2.6 2.6s2.7-1 2.7-2.6 M5.5 12v8.5h13V12 M10 20.5v-5h4v5", // ร้านค้า
  stm: "M2.5 5.5C5.5 4.3 8.7 4.5 12 6.5c3.3-2 6.5-2.2 9.5-1v13.5c-3-1.2-6.2-1-9.5 1-3.3-2-6.5-2.2-9.5-1z M12 6.5V20 M5 9h4.5 M5 12h4.5 M14.5 9H19 M14.5 12H19",  // สมุดบัญชี (statement)
  ext: "M2.5 5.5C5.5 4.3 8.7 4.5 12 6.5c3.3-2 6.5-2.2 9.5-1v13.5c-3-1.2-6.2-1-9.5 1-3.3-2-6.5-2.2-9.5-1z M12 6.5V20 M16.8 9.5v5 M14.3 12h5 M5 10.5h4.5",       // สมุดบัญชี + ช่วงถัดไป
  itv: "M12 11.5a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6z M4.5 20.5a7.5 7.5 0 0 1 15 0",           // บุคคล (เรียกสอบปากคำ)
  wal: "M7.5 2.5h9v19h-9z M11 18h2 M10 5.5h4",                                                       // โทรศัพท์/วอลเล็ต
  pay: "M6 2.5h8.5L19 7v14.5H6z M14 2.5V7h5 M9 12h6.5 M9 15.5h6.5 M9 19h4",                           // เอกสารรายละเอียดรายการ
  abr: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M3 12h18 M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9 M12 3C9.5 5.6 8.2 8.6 8.2 12s1.3 6.4 3.8 9", // ลูกโลก (ต่างประเทศ)
  frz: "M6 11h12v10H6z M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11 M12 15v2.5",                                 // กุญแจ (อายัด)
  oth: "M6 12h.01 M12 12h.01 M18 12h.01",
};
/* ไอคอนบนผัง: กรอบขาว + รูป + ป้ายสถานะมุมขวาบน (! = ยังไม่ขอ · … = ขอแล้ว รอผล · ✓ = ได้รับแล้ว) */
const fcIcon = (act, cx, cy, state, sz = 28) => { const h = sz / 2, s = (sz - 8) / 24;
  const mark = state === "todo" ? `<circle cx="${cx + h - 2}" cy="${cy - h + 2}" r="7.5" fill="#D32F2F" stroke="#fff" stroke-width="1.5"/><text x="${cx + h - 2}" y="${cy - h + 6}" font-size="11" font-weight="900" text-anchor="middle" fill="#fff">!</text>`
    : state === "wait" ? `<circle cx="${cx + h - 2}" cy="${cy - h + 2}" r="7.5" fill="#F9A825" stroke="#fff" stroke-width="1.5"/><text x="${cx + h - 2}" y="${cy - h + 5}" font-size="10" font-weight="900" text-anchor="middle" fill="#fff">…</text>`
    : state === "ok" ? `<circle cx="${cx + h - 2}" cy="${cy - h + 2}" r="7.5" fill="#2E7D32" stroke="#fff" stroke-width="1.5"/><text x="${cx + h - 2}" y="${cy - h + 6}" font-size="10" font-weight="900" text-anchor="middle" fill="#fff">✓</text>` : "";
  return `<rect x="${cx - h}" y="${cy - h}" width="${sz}" height="${sz}" rx="7" fill="#fff" stroke="${state === "ok" ? "#9EB0A2" : "#34435A"}" stroke-width="1.6"/><path d="${FL_ICO[act] || FL_ICO.oth}" transform="translate(${cx - h + 4},${cy - h + 4}) scale(${s.toFixed(3)})" fill="none" stroke="${state === "ok" ? "#9EB0A2" : "#1B2A3D"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${mark}`; };
const fcKs = (s) => { const a = [...s].sort((x, y) => x - y); return a.length > 7 ? `${a.slice(0, 6).join(", ")} … (${a.length} กรรม)` : a.join(", "); };

/* สร้างกราฟจากกรรมที่เลือก: โหนด = บัญชีผู้เสียหาย / บัญชีในสำนวน / จุดถอนเงินสด / บัญชีปลายทางที่ยังไม่มี statement
   split = แยกกล่องตามกรรม (กรรมละชุด — ดูยอดค้างของแต่ละกรรมได้) ; ไม่แยก + หลายกรรม = ภาพรวม (ไม่แสดงยอดคงเหลือ) */
function flGraph(F, HO, S, split, opt = {}) {
  const K = F.kam.filter((k) => S.has(k.k)), H = HO.filter((h) => S.has(h.k));
  split = K.length === 1 || (!!split && K.length > 1);       // กรรมเดียว = แสดงแบบรายครั้งเสมอ
  const AR = new Map(F.accs.map((a) => [a.o, a]));
  const N = new Map(), E = new Map(), sx = (k) => (split ? "#" + k : ""), he = new Map(), hn = new Map();
  /* ลำดับครั้ง (ทั้งคดี เรียงตามเวลา): บัญชีผู้เสียหายโอนครั้งที่เท่าไร / บัญชีแถวแรกรับครั้งที่เท่าไร */
  const vi = new Map(), li = new Map(), vn = new Map(), ln = new Map();
  F.kam.slice().sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : a.k - b.k)).forEach((k) => { vn.set(k.vacc, (vn.get(k.vacc) || 0) + 1); vi.set(k.k, vn.get(k.vacc)); ln.set(k.l1, (ln.get(k.l1) || 0) + 1); li.set(k.k, ln.get(k.l1)); });
  /* ผู้ส่งเงินผู้เสียหายเข้าแต่ละปลายทาง (ทั้งคดี) -> ตัวรวมเงิน */
  const srcAll = new Map(); HO.forEach((h) => { if (h.typ === "X" || h.typ === "F") { if (!srcAll.has(h.to)) srcAll.set(h.to, new Set()); srcAll.get(h.to).add(h.from); } });
  const REP = new Set();
  if (split && opt.mergeDup) { const cnt = new Map(), occN = new Map(), add = (key, k) => { if (!cnt.has(key)) cnt.set(key, new Set()); cnt.get(key).add(k); occN.set(key, (occN.get(key) || 0) + 1); };
    K.forEach((k) => add("A|" + k.l1, k.k)); H.forEach((h) => { add("A|" + h.from, h.k); if (flMix(h)) return; if (h.typ === "F") add("A|" + h.to, h.k); else if (h.typ === "X") add("X|" + flXKey(h), h.k); else if (h.typ === "C" && !/ไม่ระบุเครื่อง/.test(h.rc || h.place)) add("C|" + h.place, h.k); });
    cnt.forEach((s, key) => { if (s.size >= 2 || (key[0] !== "A" && occN.get(key) >= 2)) REP.add(key); }); }
  const cRep = (h) => !/ไม่ระบุเครื่อง/.test(h.rc || h.place) && REP.has("C|" + h.place);
  const node = (id, o) => { let n = N.get(id); if (!n) { n = Object.assign({ id, in: 0, out: 0, nin: 0, left: 0, t0: null, t1: null, ks: new Set(), rcs: new Set() }, o); N.set(id, n); } return n; };
  const span = (n, t) => { if (!n.t0 || t < n.t0) n.t0 = t; if (!n.t1 || t > n.t1) n.t1 = t; };
  const edge = (a, b, amt, t, typ) => { const id = a + ">" + b; let e = E.get(id); if (!e) { e = { a, b, amt: 0, n: 0, t0: t, t1: t, typ }; E.set(id, e); } e.amt += amt; e.n++; if (t < e.t0) e.t0 = t; if (t > e.t1) e.t1 = t; };
  const accNode = (o, col, k) => { const nm = (F.names || {})[o] || ["", o, o], a = AR.get(o); const rp = REP.has("A|" + o), n = node("A|" + o + (rp ? "" : sx(k)), { kind: "A", col, o, rep: rp, kk: split && !rp ? k : null, title: nm[2], sub: `${nm[0]} ${nm[1]}`, bk: nm[0], has: true, cl: a && a.cl, bal: a ? a.bal : null, last: a ? a.last : "" }); if (col < n.col) n.col = col; (n.rows || (n.rows = new Set())).add(col); return n; };
  K.forEach((k) => {
    const v = node("V|" + k.vacc + sx(k.k), { kind: "V", col: 0, kk: split ? k.k : null, title: "ผู้เสียหาย", sub: `${k.vbank} ${k.vacc}`, bk: k.vbank, vacc: k.vacc, run: `${vi.get(k.k)}/${vn.get(k.vacc)}` });
    const a = k.has ? accNode(k.l1, 1, k.k) : node("A|" + k.l1 + (REP.has("A|" + k.l1) ? "" : sx(k.k)), { kind: "A", col: 1, o: k.l1, rep: REP.has("A|" + k.l1), kk: split && !REP.has("A|" + k.l1) ? k.k : null, title: k.l1name, sub: `${k.l1bank} ${k.l1acc}`, bk: k.l1bank, has: false, rc: rqSafe(`บัญชี-${k.l1bank}-${k.l1acc}`) });
    v.out += k.amt; a.in += k.amt; a.nin++; span(a, k.t); span(v, k.t); v.ks.add(k.k); a.ks.add(k.k); a.l1 = true; a.lrun = `${li.get(k.k)}/${ln.get(k.l1)}`;
    if (!k.has && a.rc) a.rcs.add(a.rc);
    if (k.has && k.st !== "พบในบัญชีแถวแรก") a.nohit = true;
    edge(v.id, a.id, k.amt, k.t, "S");
  });
  /* แยกตามกรรม: ปลายทางแยกกล่องทีละรายการ + ลำดับครั้ง (ต้นทาง->ปลายทางเดียวกันในกรรมเดียวกัน) */
  const hix = new Map(), ri = new Map(), rn = new Map();
  if (split) H.slice().sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0)).forEach((h, i) => { const q = `${h.k}|${h.from}|${h.typ}|${h.typ === "C" ? h.place : h.to}`; hix.set(h, i); rn.set(q, (rn.get(q) || 0) + 1); ri.set(h, [q, rn.get(q)]); });
  const sh = (h) => (split ? "#" + h.k + "." + hix.get(h) : ""), run2 = (h) => (split ? `${ri.get(h)[1]}/${rn.get(ri.get(h)[0])}` : null);
  H.forEach((h) => {
    const src = accNode(h.from, h.d, h.k); src.ks.add(h.k);
    if (h.typ === "L") { src.left += h.amt; const r0 = flRc(h); if (r0) src.rcs.add(r0); hn.set(h, src.id); return; }
    let n;
    if (flMix(h)) { const nm = h.typ === "F" ? (F.names || {})[h.to] || ["", h.to, h.to] : null, d = h.typ === "X" ? flDest(h) : null, uq = h.from + "|" + h.t + "|" + h.full + "|" + (h.to || h.place || "");
      n = node("M|" + uq + sh(h), Object.assign({ mix: true, col: h.d + 1 },
        h.typ === "C" ? { kind: "C", place: /ไม่ระบุเครื่อง/.test(h.rc || h.place) ? "" : h.place, title: "ถอนเงินสด", sub: h.place + (h.prov ? " · " + h.prov : ""), bk: bankKey(String(h.rc || "").split("-")[0]) || bankKey(String(h.place || "").split(" ")[/^ตู้ /.test(h.place) ? 1 : 0]) || "" }
        : h.typ === "X" ? { kind: "X", o: h.to, ok: "M|" + uq, title: (d.ed ? "✎ " : "") + (d.name || "(ไม่มีชื่อในไฟล์)"), pn: d.name, sub: `${d.bank} ${d.acc}`, bk: d.bank, rc: flRc(h), gs: flGuess(d.name, d.bank, h.to) }
        : h.typ === "F" ? { kind: "X", o: h.to, ok: "M|" + uq, title: nm[2], pn: nm[2], sub: `${nm[0]} ${nm[1]}`, bk: nm[0] }
        : h.typ === "B" ? { kind: "B", title: "คืนผู้เสียหาย", sub: h.to }
        : { kind: "O", title: flOLab(h), sub: flOSub(h) })); }
    else if (h.typ === "F") n = accNode(h.to, h.d + 1, h.k);
    else if (h.typ === "C") n = node("C|" + h.place + (/ไม่ระบุเครื่อง/.test(h.rc || h.place) ? "|" + h.from + "|" + h.t : "") + (cRep(h) ? "" : sh(h)), { kind: "C", place: /ไม่ระบุเครื่อง/.test(h.rc || h.place) ? "" : h.place, rep: cRep(h), run2: run2(h), title: "ถอนเงินสด", sub: h.place + (h.prov ? " · " + h.prov : ""), bk: bankKey(String(h.rc || "").split("-")[0]) || bankKey(String(h.place || "").split(" ")[/^ตู้ /.test(h.place) ? 1 : 0]) || "", col: h.d + 1 });
    else if (h.typ === "X") { const d = flDest(h); n = node("X|" + flXKey(h) + (REP.has("X|" + flXKey(h)) ? "" : sh(h)), { kind: "X", rep: REP.has("X|" + flXKey(h)), run2: run2(h), o: h.to, ok: flXKey(h), mnm: flXKey(h) !== h.to, title: (d.ed ? "✎ " : "") + (d.name || "(ไม่มีชื่อในไฟล์)"), pn: d.name, sub: `${d.bank} ${d.acc}`, bk: d.bank, col: h.d + 1, rc: flRc(h), gs: flGuess(d.name, d.bank, h.to) }); }
    else if (h.typ === "B") n = node("B|" + h.to + sh(h), { kind: "B", title: "คืนผู้เสียหาย", sub: h.to, col: h.d + 1 });
    else n = node("O|" + (flFee(h) ? "f" : "n") + "|" + h.from + "|" + (flFee(h) ? "" : h.ch || "") + sh(h), { kind: "O", title: flOLab(h), sub: (() => { const e = flEd(flRc(h)); return e ? `✎ ระบุเอง: ${[e.eb, e.ea, e.en].filter(Boolean).join(" ")}` : (split ? flOSub(h) : ""); })(), col: h.d + 1 });
    if (n.kind !== "A" && n.col < h.d + 1) n.col = h.d + 1; if (n.kind !== "A") (n.rows || (n.rows = new Set())).add(h.d + 1);
    n.kk = split && !n.rep ? h.k : null; n.ks.add(h.k); { const r1 = flRc(h); if (r1) n.rcs.add(r1); } he.set(h, [src.id, n.id]);
    let first = true;
    if (flMix(h)) { const mk = h.from + "|" + h.t + "|" + h.full; first = !(n.mset || (n.mset = new Set())).has(mk); if (first) { n.mset.add(mk); n.in += h.full; n.nin++; }
      n.mixin = (n.mixin || 0) + h.amt; span(n, h.t); src.mixo = (src.mixo || 0) + h.amt; }
    else { n.in += h.amt; n.nin++; span(n, h.t); src.out += h.amt; if (h.ov) { src.over = (src.over || 0) + h.ov; n.ovin = (n.ovin || 0) + h.ov; } }
    if (n.kind !== "A" && !flMix(h)) { const fk = h.from + "|" + h.t + "|" + (h.full || h.amt); (n.fset || (n.fset = new Map())).set(fk, h.full || h.amt); }
    if (!flMix(h)) edge(src.id, n.id, h.amt, h.t, h.typ); else if (first) edge(src.id, n.id, h.full, h.t, h.typ);
  });
  /* ยอดคงเหลือเดิมของบัญชีที่นับรวม (วิธี ยอดผู้เสียหาย + ยอดคงเหลือเดิม) */
  (F.lots || []).forEach((l) => { if (!S.has(l[0])) return; const n = N.get("A|" + l[2] + (REP.has("A|" + l[2]) ? "" : sx(l[0]))); if (!n) return; if (l[5]) n.prior = (n.prior || 0) + l[5]; (n.lots || (n.lots = [])).push(l); });
  /* บทบาท -> สีกล่อง */
  N.forEach((n) => {
    if (n.kind === "A") { const a = AR.get(n.o), R = [], ns = (srcAll.get(n.o) || new Set()).size;
      if (a && a.cl) R.push(["cl", `คอกม้า ${a.cl}`]);
      if (ns >= 2) R.push(["agg", `ตัวรวมเงิน (รับจาก ${ns} บัญชี)`]);
      if (a && ((a.dw != null && a.dw >= 1440) || (a.tin > 0 && a.left / a.tin >= 0.2))) R.push(["hold", a.dw >= 1440 ? `บัญชีพัก (เงินค้าง ~${flDw(a.dw)})` : "บัญชีพัก (เงินยังค้าง)"]);
      if (a && a.tin > 0 && a.cash / a.tin >= 0.5) R.push(["cash", "ม้าถอนเงินสด"]);
      if (a && a.corp) R.push(["corp", "นิติบุคคล"]);
      if (!n.has) R.push(["nost", "ม้าแถวแรก · ยังไม่มี statement"]);
      if (!R.length) R.push(["mule", a && a.layer >= 2 ? `ม้าส่งต่อ (ชั้น ${a.layer})` : n.l1 ? "ม้าแถวแรก" : "บัญชีในสำนวน"]);
      n.role = R[0][0]; n.roleT = R.map((r) => r[1]).join(" · ");
    } else if (n.kind === "X") { const ns = (srcAll.get(n.o) || new Set()).size, R = [];
      if (ns >= 2) R.push(["agg", `ตัวรวมเงิน (รับจาก ${ns} บัญชี)`]);
      if (n.gs === "shop" || n.gs === "wal") R.push(["corp", n.gs === "wal" ? "วอลเล็ต / ผู้รับชำระเงิน" : "ร้านค้า / นิติบุคคล"]);
      if (n.mnm) R.push(["corp", "รับแทนหลายชื่อ"]);
      if (R.length) { n.role = R[0][0]; n.roleT = R.map((r) => r[1]).join(" · "); }
    }
  });
  /* ปลายทางมากเกิน -> รวมรายย่อยเป็นกล่อง "อื่น ๆ" (ต่อประเภท ต่อคอลัมน์ ต่อกรรมเมื่อแยก) ให้ผังอ่านได้ */
  const LIM = Infinity, remap = new Map();   // ไม่รวมกล่อง "อื่น ๆ" แล้ว: แยกทุกบัญชี/ทุกจุด เพื่อดูบัญชี/ตู้ที่ถูกใช้บ่อย
  for (const kind of ["X", "C"]) {
    const byCol = new Map(); [...N.values()].filter((n) => n.kind === kind).forEach((n) => { const g = n.col + "#" + (n.kk || ""); if (!byCol.has(g)) byCol.set(g, []); byCol.get(g).push(n); });
    byCol.forEach((ns, g) => { if (ns.length <= LIM) return; ns.sort((a, b) => b.in - a.in);
      const rest = ns.slice(LIM - 1), id = `${kind}|อื่น|${g}`;
      const m = node(id, { kind, col: ns[0].col, kk: ns[0].kk, title: kind === "X" ? `บัญชีปลายทางอื่น ${rest.length} บัญชี` : `จุดถอนเงินสดอื่น ${rest.length} จุด`, sub: "(รวมรายย่อย — ดูรายการในตาราง)", merged: rest.map((r) => r.id) });
      rest.forEach((r) => { m.in += r.in; m.nin += r.nin; r.ks.forEach((k) => m.ks.add(k)); r.rcs.forEach((x) => m.rcs.add(x)); span(m, r.t0); span(m, r.t1); remap.set(r.id, id); N.delete(r.id); }); });
  }
  if (remap.size) { const E2 = new Map(); E.forEach((e) => { const b = remap.get(e.b) || e.b, id = e.a + ">" + b, x = E2.get(id);
    if (!x) E2.set(id, Object.assign({}, e, { b })); else { x.amt += e.amt; x.n += e.n; if (e.t0 < x.t0) x.t0 = e.t0; if (e.t1 > x.t1) x.t1 = e.t1; } }); E.clear(); E2.forEach((v, k) => E.set(k, v)); }
  /* กล่องรวมหลายกรรม: เลื่อนคอลัมน์ผู้รับให้อยู่ขวาผู้ส่งเสมอ (จำกัด 12 คอลัมน์ กันวงวน) */
  if (REP.size || (K.length > 1 && !split)) { const nn = N.size;
    /* เส้นที่ทำให้เกิดวงวน (บัญชีโอนกลับไปมา) ไม่นำมาเลื่อนคอลัมน์ */
    const adj = new Map(), stt = new Map(), skip = new Set(); E.forEach((e) => { if (!adj.has(e.a)) adj.set(e.a, []); adj.get(e.a).push(e); });
    const dfs = (u) => { stt.set(u, 1); (adj.get(u) || []).forEach((e) => { const q = stt.get(e.b); if (q === 1) skip.add(e); else if (!q) dfs(e.b); }); stt.set(u, 2); };
    [...N.values()].sort((x, y) => x.col - y.col).forEach((n) => { if (!stt.get(n.id)) dfs(n.id); });
    for (let it = 0; it < nn; it++) { let ch = false; E.forEach((e) => { if (skip.has(e)) return; const a = N.get(e.a), b = N.get(e.b); if (a && b && b.col <= a.col) { b.col = a.col + 1; ch = true; } }); if (!ch) break; } }
  const tot = { amt: K.reduce((s, k) => s + k.amt, 0), cash: 0, ext: 0, oth: 0, left: 0, fwd: 0, mix: 0, over: 0 };
  H.forEach((h) => { if (flMix(h)) tot.mix += h.amt; else if (h.typ === "C") tot.cash += h.amt; else if (h.typ === "X") tot.ext += h.amt; else if (h.typ === "L") tot.left += h.amt; else if (h.typ === "O" || h.typ === "B") tot.oth += h.amt; if (h.ov && !flMix(h)) tot.over += h.ov; });
  tot.untraced = K.filter((k) => k.st !== "พบในบัญชีแถวแรก").reduce((s, k) => s + k.amt, 0);
  const heK = new Map([...he].map(([h, [a, b]]) => [h, a + ">" + (remap.get(b) || b)]));     // รายการเดินเงิน -> เส้นในผัง
  return { K, H, nodes: [...N.values()], edges: [...E.values()], tot, split, nrep: REP.size, nrepC: [...REP].filter((x) => x[0] === "C").length, multi: K.length > 1 && !split, he: heK, hn };
}

/* กระจายตำแหน่งป้ายไม่ให้ซ้อนกัน (แกนตั้ง) : รวมป้ายที่ชิดกันเป็นกลุ่ม แล้วจัดเรียงห่างเท่า ๆ กันรอบจุดกึ่งกลางเดิม */
function fcSpread(ys, min) {
  let g = ys.map((y) => ({ sum: y, n: 1 })), merged = true;
  while (merged) { merged = false;
    for (let i = 0; i < g.length - 1; i++) { const A = g[i], Bq = g[i + 1], ca = A.sum / A.n, cb = Bq.sum / Bq.n;
      if ((cb - (Bq.n - 1) * min / 2) - (ca + (A.n - 1) * min / 2) < min) { A.sum += Bq.sum; A.n += Bq.n; g.splice(i + 1, 1); merged = true; break; } } }
  const out = []; g.forEach((x) => { const c = x.sum / x.n; for (let i = 0; i < x.n; i++) out.push(c + (i - (x.n - 1) / 2) * min); }); return out;
}

/* วาด SVG : คอลัมน์ซ้าย->ขวา ตามชั้น ; ความหนาเส้นตามยอด ; ป้ายยอด+วันเวลาอยู่ชิดปลายเส้น (ฝั่งกล่องปลายทาง) และไม่ซ้อนกัน */
function flSvg(G, label, opt = {}) {
  const full = !!opt.full, cut = (x, n) => (full ? String(x || "") : fcCut(x, n));
  let NW = 300, GAP = 220; const PAD = 24, VG = 28, LH = 30, PRN = !!opt.print;
  const NC = new Set(G.nodes.map((n) => n.col)).size;
  if (PRN) { NW = Math.max(170, Math.min(250, Math.round(1187 / (NC + (NC - 1) * 0.64)))); GAP = Math.round(NW * 0.64); }
  const hwrap = (txt, cw) => { if (!PRN) return [txt]; const wmax = Math.max(1062, PAD * 2 + NC * NW + (NC - 1) * GAP) - PAD * 2, out = []; let cur = "";
    String(txt).split(/(?<= · )/).forEach((q) => { if ((cur + q).trimEnd().length * cw > wmax && cur) { out.push(cur.replace(/\s*·\s*$/, "")); cur = ""; } cur += q; }); if (cur) out.push(cur); return out; };
  const fz = (o) => (PRN ? Math.max(12, o.fs || 12) : o.fs || 12);
  /* ตัดบรรทัดให้พอดีความกว้าง (ตามช่องว่างในข้อความ ; คำยาวเกินตัดกลางคำ) */
  const wrapP = (x, o, avail) => { const cw = fz(o) * (o.b ? 0.62 : 0.58), max = Math.max(8, Math.floor(avail / cw)); x = String(x); if (x.length <= max) return [x];
    const pack = (parts) => { const out = []; let cur = ""; parts.forEach((q) => { if ((cur + q).trimEnd().length > max && cur) { out.push(cur); cur = ""; } cur += q; }); if (cur) out.push(cur); return out; };
    return pack(x.split(/(?<= · )|(?<=, )/)).flatMap((ln) => (ln.trimEnd().length <= max ? [ln] : pack(ln.split(/(?<= )(?![\u0E01-\u0E4E]{1,2}\.[\u0E01-\u0E2E]\.)/)))).flatMap((ln) => { const o2 = []; while (ln.trimEnd().length > max) { o2.push(ln.slice(0, max)); ln = ln.slice(max); } if (ln) o2.push(ln); return o2; }); };
  const T = G.tot;
  const head1 = `ผู้เสียหายโอน ${B(T.amt)} บาท (${G.K.length} กรรม)`;
  const head2 = `→ ถอนเงินสด ${B(T.cash)} · โอนต่อ (ยังไม่มี statement) ${B(T.ext)} · ค้างในบัญชี ${B(T.left)}${T.oth ? ` · อื่น ๆ ${B(T.oth)}` : ""}${T.mix ? ` · ปนในรายการที่มีเงินอื่น ${B(T.mix)}` : ""}${T.over ? ` · นับเกินยอด +${B(T.over)}` : ""}${T.untraced ? ` · ยังไล่ไม่ได้ ${B(T.untraced)}` : ""}`;
  const head3 = `${G.multi ? "ภาพรวมหลายกรรม (ไม่แสดงยอดคงเหลือ — กด “แยกตามกรรม” เพื่อดูยอดค้างรายกรรม) · " : G.split && G.K.length > 1 ? "แยกกล่องตามกรรม · " : ""}${DB.case || ""} · ${typeof flVarLab === "function" ? flVarLab() : ""} · ข้อมูล ณ ${DB.built || ""}`;
  const H2 = PRN ? [] : hwrap(head2, 6.9), H3 = PRN ? [] : hwrap(head3, 5.8), TOP = PRN ? 44 : 124 + 17 * (H2.length - 1) + 15 * (H3.length - 1), FRH = 74;
  /* กรอบรายกรรม (แบบแยกตามกรรม ที่ไม่มีกล่องรวมข้ามกรรม และไม่ใช่ผังย่อย): ป้ายกรรม+แถว อยู่ที่หัวกรอบ ไม่ติดทุกกล่อง */
  const framed = !!G.split && !G.sub && !G.nodes.some((n) => n.rep || n.kk == null);
  /* บรรทัดข้อความในกล่อง (สั้นพอดีความกว้างกล่อง) */
  const linesOf = (n) => {
    const rl = n.role ? FC_ROLE[n.role] : null, col = rl ? rl[0] : n.kind === "V" ? FC.S : n.kind === "A" ? (n.has ? "#00264D" : "#8A8A8A") : FC[n.kind];
    const kl = n.kk ? `กรรมที่ ${n.kk}` : `กรรมที่ ${full ? [...n.ks].sort((a, b) => a - b).join(", ") : fcKs(n.ks)}`;
    if (n.kind === "V") return [["ผู้เสียหาย", { b: 1, fs: 13.5 }], [cut(n.sub, 34), { c: "#34435A" }],
      [n.kk ? `โอนครั้งที่ ${n.run} ของบัญชีนี้` : n.ks.size > 4 ? `${kl} · ${n.ks.size} ครั้ง` : n.ks.size > 1 ? `โอน ${n.ks.size} ครั้ง` : `โอนครั้งที่ ${n.run} ของบัญชีนี้`, { c: "#1565C0", fs: 11.5, b: 1 }], [`โอน ${B(n.out)} บาท`, { b: 1, c: FC.S }]];
    if (n.kind === "A") { const L = [[cut(n.title, 28), { b: 1, fs: 13.5 }], [cut(n.sub + (n.cl ? ` · คอก ${n.cl}` : ""), 34), { c: "#34435A" }],
        [`▣ ${n.roleT || "บัญชีม้า"}`, { c: col, fs: 11, b: 1 }],
        n.kk || n.ks.size <= 4 ? null : [kl, { c: "#1565C0", fs: 11, b: 1 }],
        [`รับ ${B(n.in)} บาท${n.nin > 1 ? ` (${n.nin} ครั้ง)` : ""}`, { b: 1, c: FC.S }]];
      if (n.ovin > 0.005) L.push([`⚠ รับเกินยอดของต้นทาง +${B(n.ovin)}`, { c: "#B3261E", fs: 11, b: 1 }]);
      if (!n.has) L.push(["ยังไม่มี statement — ไล่ต่อไม่ได้", { c: "#B3261E", fs: 11.5 }]);
      else if ((G.multi || n.rep) && n.ks.size > 1) L.push([`ออกแล้ว ${B(n.out)} (รวม ${n.ks.size} กรรม)`, { c: "#667588", fs: 11 }]);
      else { const ov = n.over || 0, mx_ = n.mixo || 0, lf = n.left || 0;
        if (n.prior > 0.005) L.push([`นับรวมยอดคงเหลือเดิม ${B(n.prior)}`, { c: "#667588", fs: 11 }]);
        L.push([`ออกแล้ว ${B(n.out)}` + (ov > 0.005 ? ` · เกินยอด +${B(ov)}` : lf > 0.005 ? ` · ค้าง ${B(lf)}` : mx_ > 0.005 ? ` · ปนในรายการถัดไป ${B(mx_)}` : " · พอดียอด"), { c: ov > 0.005 || lf > 0.5 ? "#B3261E" : mx_ > 0.005 ? "#B26A00" : "#2E7D32", fs: 11.5, b: 1 }]);
        const ls = typeof flLotSum === "function" ? flLotSum(n.lots) : null;
        if (ls) { L.push([ls.before == null ? "ไม่มียอดคงเหลือในไฟล์" : `ก่อนรับ ${B(ls.before)} · ต่ำสุดหลังรับ ${B(ls.low)}`, { c: "#667588", fs: 11 }]);
          if (ls.low != null && ls.low >= ls.base - 0.5 && lf <= 0.5) L.push(["⚠ ยอดไม่เคยต่ำกว่าที่รับ · อาจยังค้าง", { c: "#B3261E", fs: 11, b: 1 }]);
          if (ls.on) L.push([`เงินอื่นเข้าระหว่างนำออก · ${ls.on} ครั้ง ${B(ls.os)}`, { c: "#B26A00", fs: 11 }]); } }
      return L.filter(Boolean); }
    const L = [[cut(n.title, 30), { b: 1, fs: 12.5, c: col }], [cut(n.sub, 36), { c: "#34435A", fs: 11.5 }]];
    if (n.roleT) L.push([`▣ ${n.roleT}`, { c: col, fs: 11, b: 1 }]);
    if (!n.kk && n.ks.size > 4) L.push([kl, { c: "#1565C0", fs: 11, b: 1 }]); L.push([`${B(n.in)} บาท${n.nin > 1 ? ` · ${n.nin} ครั้ง` : ""}`, { b: 1 }]);
    { const full = n.fset ? [...n.fset.values()].reduce((q, v) => q + v, 0) : 0; if (full - n.in > 0.005) L.push([`จากรายการจริง ${B(full)} บาท`, { c: "#667588", fs: 11 }]); }
    if (n.ovin > 0.005) L.push([`⚠ เกินยอด +${B(n.ovin)} (มีเงินอื่นปน)`, { c: "#B3261E", fs: 11, b: 1 }]);
    if (n.mix) { L.push([`⚠ เงินกรรมนี้ปนอยู่ ${B(n.mixin)}`, { c: "#B26A00", fs: 11.5, b: 1 }]); L.push([`เงินอื่น ${B(Math.max(0, n.in - n.mixin))} · ไม่ไล่ต่อจากรายการนี้`, { c: "#667588", fs: 11 }]); }
    return L;
  };
  const PW = 44, PH = 52;
  { const grp = new Map(); G.nodes.forEach((n) => { n.occ = ""; n.occL = null; const key = n.merged ? "" : (n.kind === "A" || n.kind === "X") && n.o ? "a:" + (n.ok || n.o) : n.kind === "C" && n.sub && !/ไม่ระบุเครื่อง/.test(n.sub) ? "c:" + n.sub : ""; if (key) { if (!grp.has(key)) grp.set(key, []); grp.get(key).push(n); } });
    G._occG = []; grp.forEach((ns) => { if (ns.length < 2) return; ns.sort((a, b) => (a.t0 < b.t0 ? -1 : a.t0 > b.t0 ? 1 : Math.min(...a.ks) - Math.min(...b.ks))); ns.forEach((n, i) => (n.occ = `${i + 1}/${ns.length}`)); G._occG.push(ns); }); }
  G.nodes.forEach((n) => { n.ph = n.kind === "A" || n.kind === "X" ? phOf(n.kind === "A" ? n.title : n.pn) : null; if (n.ph && !n.ph.src) n.ph = null;
    n.L = linesOf(n);
    if (PRN) { const out = []; n.L.forEach(([x, o], i) => { let sx = String(x), j = 0;
        do { const hd = wrapP(sx, o, NW - 30 - (i === 1 && !j && n.bk ? 22 : 0) - (n.ph && out.length < 3 ? PW + 16 : 0))[0];
          out.push([hd.replace(/\s*·?\s*$/, "") || hd.trim(), Object.assign({}, o, { i0: i, w0: !j })]); sx = sx.slice(hd.length); j++; } while (sx.trim() && j < 12); });
      n.L = out; }
    else if (full) n.L = n.L.flatMap(([x, o]) => { x = String(x); if (x.length <= 64) return [[x, o]]; const out = []; let cur = "";
      x.split(/(?<=, )|(?<= · )/).forEach((w) => { if ((cur + w).length > 64 && cur) { out.push(cur); cur = ""; } cur += w; }); if (cur) out.push(cur); return out.map((y) => [y, o]); });
    n.h = Math.max(22 + n.L.length * 17 + 6, n.ph ? PH + 30 : 0); });
  if (full && !PRN) NW = Math.round(Math.min(720, Math.max(300, ...G.nodes.map((n) => Math.max(...n.L.map(([x, o]) => String(x).length * (o.fs || 12) * (o.b ? 0.62 : 0.58))) + 36 + (n.ph ? PW + 18 : 0)))));
  const cols = [...new Set(G.nodes.map((n) => n.col))].sort((a, b) => a - b), X = new Map(cols.map((c, i) => [c, PAD + i * (NW + GAP)]));
  /* ตำแหน่งของกล่องซ้ำแต่ละกล่อง: แถวไหน · กรรมไหน (ใช้ในป้าย ⟳ / ทูลทิป / ปุ่มเลือกบัญชีซ้ำ) */
  (G._occG || []).forEach((ns) => { const L = ns.map((m) => ({ id: m.id, r: m.rows && m.rows.size ? Math.min(...m.rows) : m.col, k: [...m.ks].sort((a, b) => a - b) })); ns.forEach((m) => (m.occL = L)); });
  const byId = new Map(G.nodes.map((n) => [n.id, n])), cy = (n) => n.y + n.h / 2;
  let maxY = TOP;
  /* วางเป็นแถวตามเส้นทาง: กล่องลูกอยู่แนวเดียวกับกล่องต้นทาง (ลูกหลายกล่องเรียงลงตามเวลา) ; ต้นทางถัดไป (ผู้เสียหาย) เริ่มแถวใหม่ใต้แถวก่อนหน้า */
  const byT = (a, b) => (a.t0 < b.t0 ? -1 : a.t0 > b.t0 ? 1 : Math.min(...a.ks) - Math.min(...b.ks));
  const kids = new Map(); G.edges.forEach((e) => { const a = byId.get(e.a), b = byId.get(e.b); if (!a || !b || b.col <= a.col) return; if (!kids.has(a.id)) kids.set(a.id, []); kids.get(a.id).push(b); });
  const free = new Map(), place = (n, d) => { if (n.y != null) return; n.x = X.get(n.col); n.y = Math.max(free.get(n.col) ?? TOP, d); free.set(n.col, n.y + n.h + VG);
    (kids.get(n.id) || []).slice().sort(byT).forEach((k) => place(k, n.y)); };
  G.nodes.forEach((n) => { n.y = null; });
  const roots = G.nodes.filter((n) => n.col === cols[0]).sort(byT);
  roots.forEach((r) => place(r, Math.max(TOP, ...[...free.values()]) + (framed ? FRH : 0)));
  G.nodes.filter((n) => n.y == null).sort((a, b) => a.col - b.col || byT(a, b)).forEach((n) => place(n, TOP));
  G.nodes.forEach((n) => { maxY = Math.max(maxY, n.y + n.h + VG); });
  /* จุดเข้า-ออกของเส้นแยกกันตามขอบกล่อง (เรียงตามตำแหน่งของปลายอีกด้าน) -> เส้นไม่มารวมที่จุดเดียว */
  const ED = G.edges.filter((e) => byId.get(e.a) && byId.get(e.b));
  G.nodes.forEach((n) => { n.outs = []; n.ins = []; });
  ED.forEach((e) => { byId.get(e.a).outs.push(e); byId.get(e.b).ins.push(e); });
  G.nodes.forEach((n) => { n.outs.sort((p, q) => cy(byId.get(p.b)) - cy(byId.get(q.b))); n.ins.sort((p, q) => cy(byId.get(p.a)) - cy(byId.get(q.a)));
    n.outs.forEach((e, i) => (e.y1 = n.y + 12 + (n.h - 24) * (i + 1) / (n.outs.length + 1)));
    n.ins.forEach((e, i) => (e.y2 = n.y + 12 + (n.h - 24) * (i + 1) / (n.ins.length + 1))); });
  /* ป้ายบนเส้น: ชิดขวา ติดกล่องปลายทาง ; กระจายแนวตั้งไม่ให้ซ้อน (แยกทีละช่องระหว่างคอลัมน์) */
  const EP = PRN ? 14 : 12, cwA = PRN ? 6.9 : 6.6, cwB = PRN ? 6.1 : 5.5;
  ED.forEach((e) => { const many = e.n > 1, dd = many && e.t0.slice(0, 10) !== e.t1.slice(0, 10);
    e.LL = !PRN ? [`${B(e.amt)}${many ? ` · ${e.n} ครั้ง` : ""}`, dd ? dS(e.t0) + " – " + dS(e.t1) : fcT(e.t0, e.t1, e.n)]
      : [B(e.amt)].concat(many ? [`${e.n} ครั้ง`] : [], !e.t0 ? [] : dd ? [dS(e.t0) + " –", dS(e.t1)] : [dS(e.t0), many && e.t1 !== e.t0 ? e.t0.slice(11, 16) + "–" + e.t1.slice(11, 16) : e.t0.slice(11, 19)]);
    e.lh = 15 + EP * (e.LL.length - 1); });
  cols.forEach((c) => { const es = ED.filter((e) => byId.get(e.b).col === c).sort((p, q) => p.y2 - q.y2); if (!es.length) return;
    const lhc = Math.max(...es.map((e) => e.lh)), ys = fcSpread(es.map((e) => e.y2), lhc + 3); let sh = Math.max(0, TOP - 14 + (lhc - 27) / 2 - ys[0]);
    es.forEach((e, i) => { e.ly = ys[i] + sh; maxY = Math.max(maxY, e.ly + 26 + (e.lh - 27) / 2); }); });
  const mx = Math.max(1, ...ED.map((e) => e.amt));
  let ed = "", lb = "";
  ED.slice().sort((a, b) => b.amt - a.amt).forEach((e) => { const a = byId.get(e.a), b = byId.get(e.b), eid = esc(e.a + ">" + e.b);
    const x1 = a.x + NW, x2 = b.x, cx = (x1 + x2) / 2, col = FC[e.typ] || "#607D8B", d = `M${x1},${e.y1.toFixed(1)} C${cx},${e.y1.toFixed(1)} ${cx},${e.y2.toFixed(1)} ${x2},${e.y2.toFixed(1)}`;
    const LL = e.LL, w = Math.min(GAP - 22, Math.max(...LL.map((q, k) => q.length * (k ? cwB : cwA))) + 12), lx = x2 - 10, top = e.ly - 14 - (e.lh - 27) / 2;
    ed += `<g class="ed" data-e="${eid}"><path class="ln" d="${d}" fill="none" stroke="${col}" stroke-opacity=".5" stroke-width="${(1.5 + e.amt / mx * 11).toFixed(1)}" stroke-linecap="round"/><path class="hit" d="${d}"/>` +
      (Math.abs(e.ly - e.y2) > 6 ? `<path d="M${lx + 2},${e.ly.toFixed(1)} L${x2},${e.y2.toFixed(1)}" stroke="${col}" stroke-opacity=".45" stroke-width="1" fill="none"/>` : "") + `</g>`;
    lb += `<g class="ed el" data-e="${eid}"><rect x="${(lx - w).toFixed(0)}" y="${top.toFixed(0)}" width="${w.toFixed(0)}" height="${e.lh}" rx="5" fill="#fff" fill-opacity=".93" stroke="${col}" stroke-opacity=".35" stroke-width=".8"/>` +
      LL.map((q, k) => `<text x="${(lx - 6).toFixed(0)}" y="${(top + 12 + EP * k).toFixed(0)}" font-size="${k ? (PRN ? 11 : 10) : (PRN ? 12 : 11.5)}" text-anchor="end" fill="${k ? "#34435A" : col}"${k ? "" : ' font-weight="700"'}${q.length * (k ? cwB : cwA) > w - 10 ? ` textLength="${(w - 12).toFixed(0)}" lengthAdjust="spacingAndGlyphs"` : ""}>${esc(q)}</text>`).join("") + `</g>`; });
  let defs = ""; const usedAct = new Set();
  { const g = new Map(); G.nodes.forEach((n) => { n.rpos = ""; n.kq = n.kk != null ? n.kk : n.rep && n.ks.size === 1 ? [...n.ks][0] : null; if (!G.split || n.kq == null || n.col === cols[0] || n.kind === "O") return; const key = n.kq + "|" + n.col; if (!g.has(key)) g.set(key, []); g.get(key).push(n); });
    g.forEach((ns) => { if (ns.length < 2) return; ns.sort((a, b) => a.y - b.y); ns.forEach((n, i) => (n.rpos = `${i + 1}/${ns.length}`)); }); }
  const nd = G.nodes.map((n, i) => {
    const rl = n.role ? FC_ROLE[n.role] : null;
    const col = rl ? rl[0] : n.kind === "V" ? FC.S : n.kind === "A" ? (n.has ? "#00264D" : "#8A8A8A") : FC[n.kind], fill = rl ? (n.kind === "X" && n.role !== "agg" ? "#FFF6E0" : rl[1]) : n.kind === "V" ? "#E8EEF6" : n.kind === "A" ? "#FFFFFF" : n.kind === "C" ? "#FDECEA" : n.kind === "X" ? "#FFF6E0" : "#F1F4F7";
    defs += `<clipPath id="fcc${i}"><rect x="${n.x + 8}" y="${n.y}" width="${NW - 14}" height="${n.h}"/></clipPath>`;
    let t = `<rect x="${n.x}" y="${n.y}" width="${NW}" height="${n.h}" rx="10" fill="${fill}" stroke="${col}" stroke-width="${n.kind === "A" ? (n.role && n.role !== "mule" ? 2.6 : 2) : n.role === "agg" ? 2.4 : 1.5}"${(n.kind === "A" && !n.has) || n.mix ? ' stroke-dasharray="6 4"' : ""}/><g clip-path="url(#fcc${i})">`;
    let y = n.y + 30, li = 0; const tx = n.x + 16, px = n.x + NW - 12 - PW, py = n.y + 20;     // เว้นแถบบนให้แท็กกรรม/ไอคอน ไม่ทับชื่อบัญชี
    if (n.ph) t += `<image href="${n.ph.src}" x="${px}" y="${py}" width="${PW}" height="${PH}" preserveAspectRatio="xMidYMid slice"/><rect x="${px}" y="${py}" width="${PW}" height="${PH}" fill="none" stroke="${n.ph.mb ? "#E08A00" : "#B9C2CC"}" stroke-width="${n.ph.mb ? 2 : 1}"${n.ph.mb ? ' stroke-dasharray="4 3"' : ""}/>` + (n.ph.mb ? `<text x="${px + PW - 4}" y="${py + PH - 4}" font-size="13" font-weight="700" text-anchor="end" fill="#E08A00">?</text>` : "");
    const i1 = PRN ? n.L.findIndex(([, o]) => o.i0 === 1 && o.w0) : 1;
    if (n.occ && i1 >= 0 && n.L[i1]) { const s2 = full ? String(n.L[i1][0]) : fcCut(n.L[i1][0], n.ph ? 27 : 99), w2 = [...s2].reduce((q, ch) => q + (/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/.test(ch) ? 0 : /[A-Z]/.test(ch) ? 8.6 : /[0-9a-z .·\-]/.test(ch) ? 6.3 : 7.2), 0), ox = tx + w2 + 8 + (n.bk ? (bankMarkSvg(n.bk, 0, 0, 12)[1] ? bankMarkSvg(n.bk, 0, 0, 12)[1] + 5 : 0) : 0), oy = n.y + 30 + 17 * i1, ow = n.occ.length * 7 + 22;
      const occSvg = (X_, Y_) => `<g class="occ"><title>${esc(fcOccTxt(n) + "\n(แตะเพื่อเน้นทุกกล่อง)")}</title><rect x="${X_.toFixed(0)}" y="${Y_ - 12}" width="${ow}" height="16" rx="8" fill="#fff" stroke="#6A1B9A" stroke-width="1.4"/><text x="${(X_ + ow / 2).toFixed(0)}" y="${Y_}" font-size="11" font-weight="800" text-anchor="middle" fill="#6A1B9A">⟳ ${n.occ}</text></g>`;
      if ((n.ph && ox + ow > px - 4) || ox + ow > n.x + NW - 8) n._occ = [occSvg, ow]; else { n._occ = null; t += occSvg(ox, oy); } } else n._occ = null;
    n.L.forEach(([sx, o], idx) => { let ix = 0; if (idx === i1 && n.bk) { const [mk_, mw] = bankMarkSvg(n.bk, tx, y - 11, 12); if (mw) { t += mk_; ix = mw + 5; } } t += `<text x="${tx + ix}" y="${y}" font-size="${fz(o)}" fill="${o.c || "#1B2A3D"}"${o.b ? ' font-weight="700"' : ""}>${esc(full ? sx : fcCut(sx, n.ph && li++ < 3 ? 27 : 99))}</text>`; y += 17; });
    t += `</g>`;
    /* ป้ายบนขอบกล่อง: จำนวนครั้งที่รับเข้า + สามเหลี่ยม ! งานที่ต้องทำต่อ (สีตามประเภทงาน) */
    const tks = [...(n.rcs || [])].map((r) => FLX.tk && FLX.tk.get(r)).filter(Boolean), st = (q) => rqStat(q).s || "";
    const pend = tks.filter((q) => st(q) !== "g" && st(q) !== "x").sort((p, q) => q.amt - p.amt), done = tks.filter((q) => st(q) === "g");
    let right = n.x + NW - 8;
    { const by = new Map(); [...pend, ...done].forEach((q) => { const a = flActOf(q); if (!by.has(a)) by.set(a, []); by.get(a).push(q); });
      let cx = n.x + NW - 22;
      [...by.entries()].slice(0, 3).forEach(([a, qs]) => { const state = qs.some((q) => !st(q)) ? "todo" : qs.some((q) => st(q) === "q") ? "wait" : "ok"; usedAct.add(a);
        t += `<g class="tk" data-tk="${esc(n.id)}" style="cursor:pointer">${fcIcon(a, cx, n.y, state, 32)}</g>`; cx -= 40; });
      if (by.size) right = cx + 14; }
    if ((n.kind === "A" || n.kind === "X" || n.kind === "C") && n.nin > 1) { const lab = `${n.kind === "C" ? "ถอน" : "เข้า"} ${n.nin} ครั้ง`, w = lab.length * 6.4 + 14;
      const rx = n.x + NW - 10, by = n.y + n.h;          // ป้ายจำนวนครั้งอยู่ขอบล่าง (ไม่แย่งที่กับแท็กกรรม/ไอคอนด้านบน)
      t += `<g class="cnt"><rect x="${(rx - w).toFixed(0)}" y="${by - 10}" width="${w.toFixed(0)}" height="20" rx="10" fill="${col}"/><text x="${(rx - w / 2).toFixed(0)}" y="${by + 4}" font-size="11.5" font-weight="700" text-anchor="middle" fill="#fff">${lab}</text></g>`; }
    /* แท็กกรรม (มุมซ้ายบน) : กรรมที่ + ครั้งที่รับ เช่น "กรรม 6 · 1/2" */
    const rr = n.rows ? [...n.rows].filter((x) => x > 0).sort((a, b) => a - b) : n.col > 0 ? [n.col] : [], rowTxt = rr.length ? ` · แถว ${rr.length > 1 ? rr[0] + "–" + rr[rr.length - 1] : rr[0]}` : "";
    let ktag = n.kq ? `กรรม ${n.kq}${rowTxt}${n.rpos ? ` · ${n.rpos}` : ""}` : (() => { const a = [...n.ks].sort((x, y) => x - y); return a.length ? `กรรม ${a.slice(0, 4).join(", ")}${a.length > 4 ? ` +${a.length - 4}` : ""}${rowTxt}` : ""; })();
    if (ktag && !n.kq) { const a = [...n.ks].sort((x, y) => x - y); let m = Math.min(4, a.length); while (m > 1 && (`กรรม ${a.slice(0, m).join(", ")} +${a.length - m}${rowTxt}`.length * 6.8 + 18) > right - n.x - 24) m--; ktag = `กรรม ${a.slice(0, m).join(", ")}${a.length > m ? ` +${a.length - m}` : ""}${rowTxt}`; }
    if (n._occ) { const tw = ktag && n.kind !== "O" && !framed ? ktag.length * 6.8 + 18 : 0, ox2 = n.x + 12 + tw + 6; t += ox2 + n._occ[1] <= right - 4 ? n._occ[0](ox2, n.y + 4) : n._occ[0](n.x + 12, n.y + n.h + 4); }
    if (ktag && n.kind !== "O" && !framed) { const w = ktag.length * 6.8 + 18; t += `<g class="ktag"><rect x="${n.x + 12}" y="${n.y - 11}" width="${w.toFixed(0)}" height="22" rx="11" fill="#1565C0" stroke="#fff" stroke-width="1.5"/><text x="${(n.x + 12 + w / 2).toFixed(0)}" y="${n.y + 4.5}" font-size="12.5" font-weight="800" text-anchor="middle" fill="#fff">${esc(ktag)}</text></g>`; }
    return `<g class="nd" data-n="${esc(n.id)}" style="cursor:pointer">${t}</g>`; }).join("");
  const est = (sx, px) => sx.length * px;
  const frs = [];
  if (framed) G.K.forEach((k) => { const ns = G.nodes.filter((n) => n.kk === k.k); if (!ns.length) return;
    const sh = (k.left || 0) + (k.mix || 0), ov = k.over || 0, traced = k.st === "พบในบัญชีแถวแรก";
    const parts = [k.cash > 0.005 ? `ถอนสด ${B(k.cash)}` : "", k.ext > 0.005 ? `โอนต่อไปบัญชีที่ยังไม่มี STM ${B(k.ext)}` : "", (k.back || 0) > 0.005 ? `คืนผู้เสียหาย ${B(k.back)}` : "", k.oth > 0.005 ? `อื่น ๆ ${B(k.oth)}` : ""].filter(Boolean);
    const t1 = `ผู้เสียหายโอน ${B(k.amt)}` + (traced && parts.length ? " → " + parts.join(" · ") : ""), arrow = traced && !parts.length;
    const st = !traced ? [["#8A8A8A", k.has ? "ไม่พบรายการใน statement บัญชีแถวแรก" : "ยังไม่มี statement บัญชีแถวแรก — ไล่ไม่ได้"]]
      : [ov > 0.005 ? ["#B3261E", `เกินยอด +${B(ov)}`] : null, (k.left || 0) > 0.005 ? ["#B26A00", "ค้างในบัญชี " + B(k.left)] : null, (k.mix || 0) > 0.005 ? ["#B26A00", "ปนในรายการที่มีเงินอื่น " + B(k.mix)] : null].filter(Boolean);
    if (traced && !st.length) st.push(["#2E7D32", "พอดียอด ✓"]);
    frs.push({ k, t1, st, arrow, y0: Math.min(...ns.map((n) => n.y)) - FRH + 10, y1: Math.max(...ns.map((n) => n.y + n.h)) + 12, cs: [...new Set(ns.map((n) => n.col))] }); });
  const frW = frs.length ? Math.max(...frs.map((f) => (`กรรม ${f.k.k}`.length * 7.4 + 22) + (f.t1.length + f.st.reduce((q, x) => q + x[1].length + 3, 0)) * 6.5 + 40)) : 0;
  const W = Math.max(frW + PAD * 2, PAD * 2 + cols.length * NW + (cols.length - 1) * GAP, Math.max(...H2.map((q) => est(q, 6.9))) + PAD * 2, Math.max(...H3.map((q) => est(q, 5.8))) + PAD * 2, PRN ? 0 : est(`เส้นทางเงิน · ${label}`, 10.5) + PAD * 2);
  const used = new Set(G.nodes.map((n) => n.role).filter(Boolean));
  const LG = [["C", "เส้น: ถอนเงินสด"], ["X", "เส้น: โอนต่อ — ยังไม่มี statement"], ["F", "เส้น: โอนต่อ — บัญชีในสำนวน"], ["O", "เส้น: โอนออกไม่ระบุปลายทาง / ค่าธรรมเนียม"]].concat(Object.entries(FC_ROLE).filter(([k]) => used.has(k)).map(([k, r]) => ["@" + k, "กล่อง: " + r[2]])).concat(Object.keys(FL_ICO).filter((a) => usedAct.has(a)).map((a) => ["!" + a, FL_ACT[a][0]])).concat(usedAct.size ? [["?st", "ป้ายมุมไอคอน: ! ยังไม่ขอ · … ขอแล้ว รอผล · ✓ ได้รับแล้ว"]] : []),
    per = Math.max(1, Math.floor((W - PAD * 2) / 300)), lrows = Math.ceil(LG.length / per);
  const H = PRN ? maxY + 16 : maxY + 20 + lrows * 26 + 14; G._lg = LG;
  const lg = LG.map(([k, l], i) => { const x = PAD + (i % per) * 300, y = maxY + 30 + Math.floor(i / per) * 26, r = k[0] === "@" ? FC_ROLE[k.slice(1)] : null, tc = k[0] === "!" ? k.slice(1) : null;
    return (tc ? fcIcon(tc, x + 11, y - 4, "", 22) : k === "?st" ? fcIcon("oth", x + 10, y - 4, "todo", 20).replace(/<path[^>]*\/>/, "") : r ? `<rect x="${x}" y="${y - 11}" width="22" height="14" rx="3" fill="${r[1]}" stroke="${r[0]}" stroke-width="2"/>` : `<rect x="${x}" y="${y - 7}" width="22" height="6" rx="3" fill="${FC[k]}"/>`) + `<text x="${x + 28}" y="${y}" font-size="11.5" fill="#34435A">${esc(l)}</text>`; }).join("");
  const headC = ["ผู้เสียหาย", "บัญชีแถวแรก", "ปลายทาง / ชั้นถัดไป", "ชั้นถัดไป", "ชั้นถัดไป"];
  const colH = cols.map((c, i) => `<text x="${X.get(c)}" y="${TOP - 14}" font-size="12" font-weight="700" fill="#667588">${headC[Math.min(i, headC.length - 1)]}</text>`).join("");
  G._lay = { W: Math.ceil(W), H: Math.ceil(H), TOP, maxY, FRH, frames: frs.map((f) => [f.y0, f.y1, f.k.k]),
    items: [[0, TOP - 30], [maxY + 4, Math.ceil(H)]].concat(G.nodes.map((n) => [n.y - 24, n.y + n.h + 18]), ED.map((e) => [e.ly - 16 - (e.lh - 27) / 2, e.ly + 15 + (e.lh - 27) / 2])) };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(W)}" height="${Math.ceil(H)}" viewBox="0 0 ${Math.ceil(W)} ${Math.ceil(H)}" font-family="${FC_FONT}"><defs>${defs}</defs><style>.hit{fill:none;stroke:transparent;stroke-width:16px;cursor:pointer}.ed{cursor:pointer}.hl .nd:not(.on),.hl .ed:not(.on){opacity:.12}.nd.sel>rect:first-of-type{stroke:#FFB300;stroke-width:5px;filter:drop-shadow(0 0 5px #FF8F00)}.ed.sel .ln{stroke-opacity:.95}.hl .ed.on .ln{stroke-opacity:.85}.tk:hover path,.tk:hover circle{filter:brightness(1.15)}</style><rect width="${Math.ceil(W)}" height="${Math.ceil(H)}" fill="#fff"/>
    <g class="fhd">${PRN ? "" : `<text x="${PAD}" y="30" font-size="18" font-weight="700" fill="#00264D">${esc(`เส้นทางเงิน · ${label}`)}</text>
    <text x="${PAD}" y="52" font-size="13" font-weight="700" fill="#1B2A3D">${esc(head1)}</text>`}
    ${H2.map((q, k) => `<text x="${PAD}" y="${70 + 17 * k}" font-size="12.5" fill="#34435A">${esc(q)}</text>`).join("")}
    ${H3.map((q, k) => `<text x="${PAD}" y="${87 + 17 * (H2.length - 1) + 15 * k}" font-size="10.5" fill="#8696A8">${esc(q)}</text>`).join("")}
    ${colH}</g>${frs.map((f) => { const pw = `กรรม ${f.k.k}`.length * 7.4 + 22; let x = PAD + pw + 10;
      const seg = [["#1B2A3D", f.t1]].concat(f.st).map(([c, tx], i) => { const o = `<tspan fill="${c}"${i ? ' font-weight="800"' : ""}>${i ? (i === 1 && f.arrow ? " → " : " · ") : ""}${esc(tx)}</tspan>`; return o; }).join("");
      return `<g class="kfr"><rect x="8" y="${f.y0}" width="${W - 16}" height="${f.y1 - f.y0}" rx="12" fill="#F7FAFD" stroke="#9DB7D5" stroke-width="1.2"/>` +
        `<rect x="${PAD - 6}" y="${f.y0 + 7}" width="${pw.toFixed(0)}" height="22" rx="11" fill="#1565C0"/><text x="${(PAD - 6 + pw / 2).toFixed(0)}" y="${f.y0 + 22.5}" font-size="12.5" font-weight="800" text-anchor="middle" fill="#fff">กรรม ${f.k.k}</text>` +
        `<text x="${(PAD + pw + 4).toFixed(0)}" y="${f.y0 + 22.5}" font-size="12.5" font-weight="700">${seg}</text>` +
        f.cs.map((c) => `<text x="${X.get(c)}" y="${f.y0 + 47}" font-size="${PRN ? 12 : 10.5}" font-weight="700" fill="#8696A8">${c === cols[0] && c === 0 ? "ผู้เสียหาย" : "แถว " + c}</text>`).join("") + `</g>`; }).join("")}${ed}${nd}${lb}${PRN ? "" : `<g class="flg">${lg}</g>`}</svg>`;
}

/* บันทึก SVG เป็นภาพ PNG (พื้นขาว) */
function flSavePng(svgEl, name) {
  const w = +svgEl.getAttribute("width"), h = +svgEl.getAttribute("height"), sc = Math.max(0.5, Math.min(2, Math.sqrt(12e6 / (w * h))));
  const xml = new XMLSerializer().serializeToString(svgEl), img = new Image();
  img.onload = () => { try { const c = document.createElement("canvas"); c.width = Math.round(w * sc); c.height = Math.round(h * sc); const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    c.toBlob((b) => { if (!b) return toast("บันทึกภาพไม่สำเร็จ (ภาพใหญ่เกินไป — ลองเลือกกรรมน้อยลง)"); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name + ".png"; a.click(); toast("บันทึกภาพแล้ว: " + name + ".png"); }, "image/png"); } catch (e) { toast("บันทึกภาพไม่สำเร็จ: " + e.message); } };
  img.onerror = () => toast("บันทึกภาพไม่สำเร็จ");
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
}

/* รายงาน (หน้าพิมพ์ / บันทึกเป็น PDF) : ผัง + ตารางกรรม + ตารางรายการเดินเงิน */
/* ผังย่อย: เฉพาะกล่อง keepN และเส้น keepE (รายการ/กรรม/ยอดรวม คิดใหม่ตามส่วนที่เหลือ) */
function flPrune(G, keepN, keepE) {
  const nodes = G.nodes.filter((n) => keepN.has(n.id)), ids = new Set(nodes.map((n) => n.id));
  const edges = G.edges.filter((e) => keepE.has(e.a + ">" + e.b) && ids.has(e.a) && ids.has(e.b)), eids = new Set(edges.map((e) => e.a + ">" + e.b));
  const H = G.H.filter((h) => { const e = G.he.get(h); return e ? eids.has(e) : ids.has(G.hn.get(h)); });
  const ks = new Set(H.map((h) => h.k)); nodes.forEach((n) => { if (n.kind === "V" || n.kind === "A") n.ks.forEach((k) => ks.add(k)); });
  const K = G.K.filter((k) => ks.has(k.k)), tot = { amt: K.reduce((s, k) => s + k.amt, 0), cash: 0, ext: 0, oth: 0, left: 0, fwd: 0, mix: 0, over: 0 };
  H.forEach((h) => { if (flMix(h)) tot.mix += h.amt; else if (h.typ === "C") tot.cash += h.amt; else if (h.typ === "X") tot.ext += h.amt; else if (h.typ === "L") tot.left += h.amt; else if (h.typ === "O" || h.typ === "B") tot.oth += h.amt; if (h.ov && !flMix(h)) tot.over += h.ov; });
  tot.untraced = K.filter((k) => k.st !== "พบในบัญชีแถวแรก").reduce((s, k) => s + k.amt, 0);
  return Object.assign({}, G, { nodes, edges, H, K, tot, sub: true });
}
/* คำอธิบายกล่องซ้ำ: หัวข้อ + 1 บรรทัดต่อ 1 กล่อง — "บัญชีนี้ซ้ำกัน 3 ครั้งในผัง" / "1) กรรม 2 - แถว 2" / "2) กรรม 3 - แถว 2  ← กล่องนี้" */
const fcOccHead = (n) => (!n || !n.occL ? "" : `${n.kind === "C" ? "ถอนที่ตู้/จุดนี้" : "บัญชีนี้"}ซ้ำกัน ${n.occL.length} ครั้งในผัง`);
const fcOccLines = (n) => { if (!n || !n.occL) return []; const MAX = 12, gs = [], by = new Map();
  n.occL.forEach((o) => { const key = o.k.join(",") + "|" + o.r; let g = by.get(key); if (!g) { g = { k: o.k, r: o.r, n: 0, me: false }; by.set(key, g); gs.push(g); } g.n++; if (o.id === n.id) g.me = true; });   // กรรม+แถวเดียวกัน รวมเป็นบรรทัดเดียว บอกจำนวนครั้ง
  const ls = gs.slice(0, MAX).map((g, i) => `${i + 1}) กรรม ${g.k.slice(0, 5).join(", ")}${g.k.length > 5 ? " …" : ""} - ${g.r > 0 ? "แถว " + g.r : "แถวผู้เสียหาย"}${g.n > 1 ? ` · ${g.n} ครั้ง` : ""}${g.me ? (g.n > 1 ? "  ← รวมกล่องนี้" : "  ← กล่องนี้") : ""}`);
  if (gs.length > MAX) ls.push(`… อีก ${gs.length - MAX} รายการ`);
  return ls; };
const fcOccTxt = (n) => (!n || !n.occL ? "" : [fcOccHead(n)].concat(fcOccLines(n)).join("\n"));
/* ตัดผังเป็นหน้า: [yเริ่ม, yจบ, กรรมที่ต่อจากหน้าก่อน] — ตัดที่ช่องว่างระหว่างกรอบกรรมก่อน ถ้าไม่ได้ตัดที่ช่องว่างระหว่างกล่อง (ไม่ตัดผ่านกล่อง/ป้าย) */
function flPages(lay, Hp) {
  const H = lay.H, fr = (lay.frames || []).slice().sort((p, q) => p[0] - q[0]), its = (lay.items || []).slice().sort((p, q) => p[0] - q[0]);
  /* หัวกรอบกรรมต้องอยู่หน้าเดียวกับกล่องแถวแรกของกรรมนั้น -> ไม่ตัดระหว่างหัวกรอบกับกล่องแรก */
  const hdrEnd = fr.map((f) => Math.min(f[1], ...its.filter((t) => t[0] > f[0] && t[0] < f[1]).map((t) => t[0])) + 1);
  const gaps = new Set(fr.map((f) => Math.round(f[0] - 4)));
  const cand = [...new Set(its.map((t) => Math.round(t[0])).filter((c) => !fr.some((f, k) => c > f[0] - 4 && c <= hdrEnd[k])).concat([...gaps]))].sort((a, b) => a - b);
  const out = []; let ps = 0, guard = 0;
  while (H - ps > Hp + 1 && guard++ < 2000) { const lim = ps + Hp; let j = 0, run = ps, best = -1, bestGap = -1, bestE = ps, gapE = ps;
    while (j < its.length && its[j][0] < ps - 0.5) j++;
    for (const c of cand) { if (c <= ps + 1) continue; if (c > lim) break;
      while (j < its.length && its[j][0] < c) { run = Math.max(run, its[j][1]); j++; }
      const e = Math.max(c, run); if (e > lim + 0.5) break;
      best = c; bestE = e; if (gaps.has(c) && c > ps + Hp * 0.45) { bestGap = c; gapE = e; } }
    let b = bestGap > 0 ? bestGap : best, e = bestGap > 0 ? gapE : bestE;
    if (b < 0) { b = cand.find((c) => c > ps + 1) || lim; e = Math.max(b, ...its.filter((t) => t[0] >= ps - 0.5 && t[0] < b).map((t) => t[1])); }     // ชิ้นเดียวสูงเกินหน้า
    out.push([ps, e, b]); ps = b; }
  out.push([ps, H, Infinity]);
  return out.map(([a, e, b]) => { const f = fr.find((x) => x[0] + 30 < a && x[1] - 10 > a); return { a, e, b, cont: f ? f[2] : null }; });
}
function flReport(F, G, svg, label, opt = {}) {
  const nm = (o) => { const n = (F.names || {})[o]; return n ? `${n[2]} (${n[0]} ${n[1]})` : o; };
  const TL = { C: "ถอนเงินสด", X: "โอนต่อ (ยังไม่มี statement)", F: "โอนต่อ (บัญชีในสำนวน)", B: "คืนผู้เสียหาย", O: "โอนออกไม่ระบุปลายทาง / ค่าธรรมเนียม", L: "ยังค้างในบัญชี ณ สิ้นข้อมูล" };
  const dest = (h) => (h.typ === "C" ? `${h.place}${h.prov ? " · " + h.prov : ""}` : h.typ === "F" ? nm(h.to) : h.typ === "X" ? `${h.tn} (${h.tb} ${h.to})` : h.typ === "B" ? h.to : h.typ === "O" ? flOSub(h) : "");
  const T = G.tot, rowsK = G.K.map((k) => `<tr><td class="n">${k.k}</td><td>${dtTh(k.t)}</td><td class="n">${B(k.amt)}</td><td>${esc(k.vbank + " " + k.vacc)}</td><td>${esc(k.l1name)}<br><small>${esc(k.l1bank + " " + k.l1acc)}</small></td><td>${esc(k.cf || k.st)}</td><td class="n">${k.cash ? B(k.cash) : ""}</td><td class="n">${k.ext ? B(k.ext) : ""}</td><td class="n">${k.left ? B(k.left) : ""}</td></tr>`).join("");
  const KA = new Map(G.K.map((k) => [k.k, k.amt]));
  const hsort = (a, b) => a.k - b.k || a.d - b.d || (a.t < b.t ? -1 : 1), rowH = (h) => `<tr${h.aux ? ' class="aux"' : ""}><td class="n">${h.k}</td><td class="n">${B(KA.get(h.k) || 0)}</td><td class="n">${h.d}</td><td>${dtTh(h.t)}${flTeMk(h)}</td><td>${esc(nm(h.from))}</td><td>${esc(h.aux ? flAuxLab(h) : h.typ === "O" ? flOLab(h) : TL[h.typ])}</td><td>${esc(h.aux ? flAuxTxt(h, 0, 1) : dest(h))}</td><td class="n">${flMix(h) ? `${B(h.full)}<br><small>ปนเงินอื่น · ของกรรมนี้ ${B(h.amt)} · ไม่ไล่ต่อ</small>` : B(h.amt)}</td><td class="n">${h.bal == null ? "" : B(h.bal)}</td></tr>`; const rowsH = G.H.slice().sort(hsort).map(rowH).join("");
  const TKM = FLX.tk || new Map(), seen = new Set(), tks = [];
  G.K.forEach((k) => { if (!k.has) { const t = TKM.get(rqSafe(`บัญชี-${k.l1bank}-${k.l1acc}`)); if (t && !seen.has(t.rc)) { seen.add(t.rc); tks.push(t); } } });
  G.H.forEach((h) => { const t = TKM.get(flRc(h)); if (t && !seen.has(t.rc)) { seen.add(t.rc); tks.push(t); } });
  const amtIn = (t) => G.H.filter((h) => flRc(h) === t.rc).reduce((s, h) => s + h.amt, 0) || G.K.filter((k) => !k.has && rqSafe(`บัญชี-${k.l1bank}-${k.l1acc}`) === t.rc).reduce((s, k) => s + k.amt, 0);
  const rowsT = tks.sort((a, b) => amtIn(b) - amtIn(a)).map((t) => { const ks = [...t.ks].filter((k) => G.K.some((x) => x.k === k)).sort((a, b) => a - b);
    return `<tr><td>${esc(flStTxt(t))}</td><td>${esc(FL_ACT[flActOf(t)][0])}</td><td>${esc(flTkName(t))}</td><td class="n">${B(amtIn(t))}</td><td>${ks.join(", ")}</td><td>${esc([...t.from].map((o) => nm(o)).join(" ; ") || "ผู้เสียหายโอนเข้าโดยตรง")}</td><td>${esc(t.code)}</td><td>${esc(flNote(t))}</td></tr>`; }).join("");
  const ag = new Map(); G.nodes.filter((n) => n.kind === "A" || n.kind === "X").forEach((n) => { const key = n.kind + "|" + (n.o || n.id); const o = ag.get(key) || { n, ks: new Set(), in: 0, out: 0, left: 0, nin: 0 };
    n.ks.forEach((k) => o.ks.add(k)); o.in += n.in; o.out += n.out; o.left += n.left || 0; o.nin += n.nin; ag.set(key, o); });
  const rowsA = [...ag.values()].sort((a, b) => a.n.col - b.n.col || b.in - a.in).map((o) => { const n = o.n;
    return `<tr><td>${n.kind === "A" ? (n.l1 ? "บัญชีแถวแรก" : "บัญชีในสำนวน") : "ปลายทาง (ยังไม่มี statement)"}</td><td>${esc(String(n.title).replace(/^✎ /, ""))}</td><td>${esc(n.sub || "")}</td><td>${esc(n.roleT || "")}</td><td>${esc(fcKs(o.ks))}</td><td class="n">${nf(o.nin)}</td><td class="n">${B(o.in)}</td><td class="n">${n.kind === "A" && n.has ? B(o.out) : ""}</td><td class="n">${n.kind === "A" && n.has && !G.multi ? B(o.left) : ""}</td><td class="n">${n.kind === "A" && n.bal != null ? B(n.bal) + (n.last ? `<br><small>${esc(dS(n.last))}</small>` : "") : ""}</td></tr>`; }).join("");
  /* ---- ผัง: ตัดเป็นหน้า A4 แนวนอน (297×210 มม. ขอบ 8 มม. = 1062×733 px) ---- */
  const d0 = document.createElement("div"); d0.innerHTML = svg; const sv = d0.firstElementChild, lay = G._lay || { W: +sv.getAttribute("width"), H: +sv.getAttribute("height"), frames: [], items: [] };
  const PWp = 1062, PHp = 688, sc = Math.min(1.2, PWp / lay.W), Hp = PHp / sc, pages = flPages(lay, Hp);
  const byN = new Map(G.nodes.map((n) => [n.id, [n.y - 24, n.y + n.h + 18]])), byE = new Map(G.edges.map((e) => [e.a + ">" + e.b, [Math.min(e.y1, e.y2, e.ly) - 18, Math.max(e.y1, e.y2, e.ly) + 18]])), byL = new Map(G.edges.map((e) => [e.a + ">" + e.b, e.ly - 16 - ((e.lh || 27) - 27) / 2]));
  const frY = new Map((lay.frames || []).map((f) => [String(f[2]), [f[0], f[1]]]));
  const kids = [...sv.children], sty = kids.filter((c) => c.tagName === "style").map((c) => c.textContent).join("\n"), defs = kids.filter((c) => c.tagName === "defs").map((c) => c.innerHTML).join("");
  const items = kids.filter((c) => c.tagName !== "style" && c.tagName !== "defs").map((c) => { const cl = c.getAttribute("class") || "";
    let r = null, top = null;                               // top = ชิ้นที่ต้องอยู่หน้าเดียว (ตามขอบบน) ; r = ช่วงของชิ้นที่ตัดผ่านได้ (เส้น/กรอบ)
    if (/\bnd\b/.test(cl)) { const q = byN.get(c.dataset.n); top = q ? q[0] : 0; }
    else if (/\bel\b/.test(cl)) top = byL.get(c.dataset.e);
    else if (/\bed\b/.test(cl)) r = byE.get(c.dataset.e);
    else if (/\bkfr\b/.test(cl)) { const t = c.querySelector("text"); r = t ? frY.get(String(t.textContent).replace(/\D/g, "")) : null; }
    else if (/\bfhd\b/.test(cl)) top = 0;
    else if (/\bflg\b/.test(cl)) top = lay.maxY + 4;
    return [r, c.outerHTML, top]; });
  const attrs = [...sv.attributes].filter((a) => !/^(width|height|viewBox|xmlns)$/.test(a.name)).map((a) => `${a.name}="${esc(a.value)}"`).join(" ");
  const svgOf = (ya, yb, b) => { const hh = yb - ya; return `<svg xmlns="http://www.w3.org/2000/svg" ${attrs} width="${(lay.W * sc).toFixed(0)}" height="${(hh * sc).toFixed(0)}" viewBox="0 ${ya.toFixed(1)} ${lay.W} ${hh.toFixed(1)}"><rect x="0" y="${ya.toFixed(1)}" width="${lay.W}" height="${hh.toFixed(1)}" fill="#fff"/>` +
      items.filter(([r, , top]) => (top != null ? top >= ya - 0.5 && top < b : !r || (r[0] < yb && r[1] > ya))).map((x) => x[1]).join("") + `</svg>`; };
  const pgHtml = pages.map((pg, i) => `<section class="pg"><div class="pgh"><b>ผังเส้นทางเงิน · ${esc(label)}</b><span>${pg.cont != null ? `(ต่อ) กรรม ${pg.cont} · ` : ""}หน้าผัง ${i + 1}/${pages.length}</span></div>${svgOf(pg.a, pg.e, pg.b)}</section>`).join("");
  /* ผังแยกตามกรรม: ผังของกรรม -> ตารางรายการเดินเงินของกรรมนั้นต่อท้ายทันที (ทีละกรรม) ; กรรมที่สูงเกินหน้าตัดเป็นหลายส่วนที่ช่องว่างระหว่างกล่อง */
  const frs = (lay.frames || []).slice().sort((p, q) => p[0] - q[0]), framed = frs.length > 0, KB = new Map(G.K.map((k) => [k.k, k]));
  const hopHead = `<th class="n">กรรม</th><th class="n">ผู้เสียหายโอน</th><th class="n">ชั้น</th><th>วันเวลา</th><th>บัญชี</th><th>ลักษณะ</th><th>ปลายทาง</th><th class="n">ยอด</th><th class="n">คงเหลือ</th>`, tbl0 = (hd, rows) => `<table><thead><tr>${hd}</tr></thead><tbody>${rows}</tbody></table>`;
  const ktOf = (k, hs) => (hs.length ? `<section class="sec flw kt"><h3>รายการเดินเงิน · กรรม ${k} · ${hs.length} รายการ</h3>${tbl0(hopHead, flAugSort(hs).map(rowH).join(""))}</section>` : `<p class="note kt">กรรม ${k}: ไม่มีรายการเดินเงินต่อจากบัญชีแถวแรก</p>`);
  const ktAll = G.K.slice().sort((a, b) => a.k - b.k).map((k) => ktOf(k.k, G.H.filter((h) => h.k === k.k).sort(hsort))).join("");
  const frHtml = !framed ? "" : frs.map((f, i) => { const a = i ? f[0] - 4 : 0, bnd = i < frs.length - 1 ? frs[i + 1][0] - 4 : lay.H, k = f[2], kk = KB.get(k);
      const L2 = { H: bnd - a, frames: [], items: (lay.items || []).filter((t) => t[0] >= a - 0.5 && t[0] < bnd).map((t) => [t[0] - a, Math.min(t[1], bnd) - a]) };
      const ps = flPages(L2, Hp).map((p) => ({ a: p.a + a, e: Math.min(p.e + a, bnd), b: p.b === Infinity ? bnd : p.b + a })), hs = G.H.filter((h) => h.k === k).sort(hsort);
      return ps.map((p, j) => `<section class="pg fr${i === 0 && j === 0 ? " p1" : ""}"><div class="pgh"><b>กรรม ${k}${j ? " (ต่อ)" : ""} · ผู้เสียหายโอน ${B(kk ? kk.amt : 0)} บาท</b><span>${ps.length > 1 ? `ส่วนที่ ${j + 1}/${ps.length} · ` : ""}${esc(label)}</span></div>${svgOf(p.a, p.e, p.b)}</section>`).join("")
        + ktOf(k, hs); }).join("");
  /* ---- วิธีอ่านผังและตาราง (สัญลักษณ์เฉพาะที่มีในผังนี้) ---- */
  const box = (s, f, d) => `<svg width="28" height="16" aria-hidden="true"><rect x="1" y="1" width="26" height="14" rx="3" fill="${f}" stroke="${s}" stroke-width="1.8"${d ? ' stroke-dasharray="4 3"' : ""}/></svg>`;
  const sw = (k) => (FC[k] && k.length === 1 ? `<svg width="28" height="10" aria-hidden="true"><rect y="2" width="28" height="6" rx="3" fill="${FC[k]}"/></svg>`
    : k[0] === "@" ? box(FC_ROLE[k.slice(1)][0], FC_ROLE[k.slice(1)][1])
    : k[0] === "!" ? `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">${fcIcon(k.slice(1), 12, 12, "", 22)}</svg>`
    : k === "?st" ? `<svg width="30" height="28" viewBox="-2 -6 32 30" aria-hidden="true">${fcIcon("oth", 12, 12, "todo", 20).replace(/<path[^>]*\/>/, "")}</svg>` : "");
  const sym = [[`<svg width="34" height="18" aria-hidden="true"><rect x="1" y="1" width="32" height="16" rx="5" fill="#F7FAFD" stroke="#9DB7D5"/><rect x="4" y="5" width="14" height="8" rx="4" fill="#1565C0"/></svg>`, "กรอบ = 1 กรรม · หัวกรอบ = ยอดผู้เสียหายโอน → ไปที่ไหนเท่าไร"],
    [box("#00264D", "#fff"), "บัญชีที่มี statement (ไล่ต่อได้)"], [box("#8A8A8A", "#fff", 1), "บัญชีที่ยังไม่มี statement (ไล่ต่อไม่ได้)"],
    [box(FC.C, "#FDECEA", 1), "กล่องปลายทางเส้นประ = รายการที่มีเงินอื่นปน · แสดงยอดจริง ไม่ไล่ต่อ"], [`<span class="occp">⟳ 1/3</span>`, "บัญชี / จุดถอนเดียวกันปรากฏหลายครั้งในผัง"]]
    .concat((G._lg || []).map(([k, l]) => [sw(k), l.replace(/^(เส้น|กล่อง): /, (m0, a) => (a === "เส้น" ? "เส้นสี: " : "กล่องสี: "))]));
  const guide = `<div class="guide"><div><b>สัญลักษณ์ในผัง</b><ul>${sym.map(([s, l]) => `<li>${s}<span>${esc(l)}</span></li>`).join("")}</ul></div>
    <div><b>วิธีอ่าน</b><ol><li>อ่านผังจากซ้ายไปขวา: ผู้เสียหาย → บัญชีแถวแรก (แถว 1) → ปลายทางชั้นถัดไป (แถว 2, 3 …)</li>
    <li>ป้ายบนเส้น = ยอดรายการจริง · วันที่ · เวลา ; เส้นหนา = ยอดมาก ; สีกล่องปลายทางตรงกับสีเส้น</li>
    <li>ตาราง “รายการเดินเงิน” ใต้ผัง: 1 แถว = 1 รายการจริงใน statement ; “ผู้เสียหายโอน” = ยอดตั้งต้นของกรรม ; “ยอดรายการ” = ยอดจริงในไฟล์ธนาคาร (ไม่แบ่งยอด) ; “คงเหลือ” = ยอดคงเหลือหลังรายการนั้น ตามไฟล์ธนาคาร</li>
    <li>แถวสีเทา = เงินเข้าบัญชี: “รับเงินผู้เสียหาย / รับโอนเข้า” บอกยอดก่อนรับ และยอดต่ำสุดหลังรับ (เงินกรรมนี้เหลือในบัญชีได้ไม่เกินยอดนี้ ; “อาจยังค้าง” = ยอดไม่เคยต่ำกว่าที่รับ) ; “เงินอื่นเข้า” = เงินที่เข้ามาปนระหว่างนำเงินกรรมนี้ออก ; * = ไฟล์ธนาคารลงเวลาไม่ตรงลำดับ เรียงตามยอดคงเหลือ</li>
    <li>วิธีนับเงิน: ${esc(typeof flVarLab === "function" ? flVarLab() : "")}</li></ol></div></div>`;
  const RT = { acc: "บัญชีที่รับโอนต่อ", cash: "จุดถอนเงินสด", shop: "ร้านค้า / นิติบุคคล (ซื้อขายจริง)" }, REP = opt.rep || [], FOC = REP.find((x) => x.focus);
  const repHtml = !REP.length ? "" : `<h2>สิ่งที่พบซ้ำในหลายกรรม</h2><p class="note">“พบในกรรม (แถว)” = กรรมในรายงานนี้ที่มีบัญชี/จุดเดียวกัน และอยู่แถวไหนของผัง (แถว 1 = บัญชีแถวแรก) · “กรรมอื่นในคดี” = กรรมที่ไม่ได้อยู่ในรายงานนี้แต่พบบัญชี/จุดเดียวกัน</p>` +
    ["acc", "cash", "shop"].map((t) => { const xs = REP.filter((x) => x.type === t); return xs.length ? `<h3>${RT[t]} · ${xs.length} รายการ</h3>` + `<table><thead><tr><th>ชื่อ / รายละเอียด</th><th>พบในกรรม (แถว)</th><th class="n">จำนวนกรรม</th><th class="n">เงินผู้เสียหายที่ผ่าน</th><th>กรรมอื่นในคดี</th></tr></thead><tbody>` +
      xs.map((x) => `<tr${x.focus ? ' class="fx"' : ""}><td>${x.focus ? "★ " : ""}${esc(x.name)}${x.sub ? `<br><small>${esc(x.sub)}</small>` : ""}</td><td>${esc(x.occ)}</td><td class="n">${x.nk}</td><td class="n">${x.amt ? B(x.amt) : ""}</td><td>${esc(x.other)}</td></tr>`).join("") + `</tbody></table>` : ""; }).join("");
  const w = window.open("", "_blank");
  if (!w) return toast("เบราว์เซอร์บล็อกหน้าต่างใหม่ — อนุญาตป๊อปอัปแล้วกดอีกครั้ง");
  const tbl = (head, rows) => `<table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
  w.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>รายงานเส้นทางเงิน · ${esc(label)}</title>
  <style>@page{size:A4 landscape;margin:8mm}tr.aux td{background:#F3F5F8;color:#4F5D70}
  body{font-family:${FC_FONT};margin:0;color:#111;background:#eef1f4;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sheet{width:1062px;margin:0 auto;padding:10px 0 30px}
  .bar{position:sticky;top:0;z-index:5;background:#fff;border-bottom:1px solid #cfd6dd;padding:8px 14px;display:flex;gap:12px;align-items:center;font-size:13px}
  .bar button{font:inherit;font-weight:700;padding:8px 16px;border-radius:8px;border:1px solid #00264D;background:#00264D;color:#fff;cursor:pointer}
  .pg,.sec{background:#fff;border:1px solid #d5dbe2;padding:10px 12px;margin:12px 0}
  h1{font-size:20px;margin:0 0 2px}h2{font-size:15px;margin:0 0 6px}p{margin:3px 0;font-size:12.5px}
  table{border-collapse:collapse;width:100%;font-size:11.5px}td small{font-size:10.5px}thead{display:table-header-group}th,td{border:1px solid #b9c2cc;padding:3px 5px;text-align:left;vertical-align:top}th{background:#eef2f6}td.n,th.n{text-align:right;white-space:nowrap}tr{break-inside:avoid;page-break-inside:avoid}
  .kp{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 10px}.kp div{border:1px solid #b9c2cc;border-radius:8px;padding:5px 11px;font-size:11.5px}.kp b{display:block;font-size:14.5px}.note{color:#555;font-size:11px}
  .pgh{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:11.5px;color:#444;border-bottom:1px solid #b9c2cc;padding-bottom:3px;margin-bottom:4px}.pgh b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pgh span{white-space:nowrap}
  .pg svg{display:block;margin:0 auto}
  h3{font-size:13px;margin:8px 0 4px}.kt h3{margin-top:2px}tr.fx td{background:#FFF4C2;font-weight:700}.focl{font-size:13px;background:#FFF4C2;border-radius:6px;padding:4px 8px;display:inline-block}
  .guide{display:grid;grid-template-columns:1fr;gap:6px;border:1px solid #b9c2cc;border-radius:8px;padding:7px 12px;margin:8px 0 10px;font-size:11.5px;break-inside:avoid}
  .guide b{display:block;font-size:12.5px;margin-bottom:3px}.guide ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0 14px}.guide li{margin:2px 0;line-height:1.35}
  .guide ul li{display:flex;align-items:center;gap:8px}.guide ul li>svg,.guide ul li>.occp{flex:none;width:34px;text-align:center}.guide ol{margin:0;padding-left:17px}
  .occp{display:inline-block;border:1.4px solid #6A1B9A;color:#6A1B9A;border-radius:8px;font-size:10px;font-weight:800;line-height:14px;padding:0 4px;width:auto!important}
  ${sty}
  @media print{body{background:#fff}.bar{display:none}.sheet{width:auto;padding:0}.pg,.sec{border:0;padding:0;margin:0}.pg{break-before:page;page-break-before:always;break-inside:avoid;page-break-inside:avoid}.sec{break-before:page;page-break-before:always}.sec.first,.sec.flw{break-before:auto;page-break-before:auto}.pg.fr{break-before:auto;page-break-before:auto;margin-top:6px}.pg.fr.p1{break-before:page;page-break-before:always}.sec.kt{margin-bottom:8px}}</style></head><body>
  <div class="bar"><button id="rpPrint">พิมพ์ / บันทึกเป็น PDF</button><span>กระดาษ <b>A4 แนวนอน</b> · ${framed ? `ผังและตารางรายการเดินเงินทีละกรรม (${frs.length} กรรม)` : `ผัง ${pages.length} หน้า ตามด้วยตารางรายการเดินเงิน`} · ในหน้าต่างพิมพ์เลือก "กราฟิกพื้นหลัง" เพื่อให้สีครบ</span></div>
  <svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${defs}</defs></svg>
  <div class="sheet">
  <section class="sec first"><h1>รายงานเส้นทางเงินตามกรรม</h1><p>${esc(DB.case || "")} · ${esc(label)} · ข้อมูล ณ ${esc(DB.built || "")} · จัดทำ ${new Date().toLocaleString("th-TH")}</p>${FOC ? `<p class="focl">เลือกจาก${RT[FOC.type].replace(/ \(.*$/, "")}: <b>★ ${esc(FOC.name)}</b>${FOC.sub ? ` (${esc(FOC.sub)})` : ""} — พบใน ${esc(FOC.occ)}</p>` : ""}${guide}
  <div class="kp"><div>ผู้เสียหายโอน<b>${B(T.amt)}</b>${G.K.length} กรรม</div>${T.cash ? `<div>ถอนเงินสด<b>${B(T.cash)}</b></div>` : ""}${T.ext ? `<div>โอนต่อไปบัญชีที่ยังไม่มี STM<b>${B(T.ext)}</b></div>` : ""}${T.left ? `<div>ยังค้างในบัญชี<b>${B(T.left)}</b></div>` : ""}${T.oth ? `<div>โอนออกไม่ระบุปลายทาง / ค่าธรรมเนียม<b>${B(T.oth)}</b></div>` : ""}${T.mix ? `<div>ปนในรายการที่มีเงินอื่น (ไม่ไล่ต่อ)<b>${B(T.mix)}</b></div>` : ""}${T.over ? `<div>นับเกินยอดตั้งต้น<b>+${B(T.over)}</b></div>` : ""}${T.untraced ? `<div>ยังไล่ไม่ได้ (ไม่มี statement)<b>${B(T.untraced)}</b></div>` : ""}</div>
  ${repHtml}<h2>รายการที่ผู้เสียหายโอน</h2>${tbl(`<th class="n">กรรมที่</th><th>วันเวลา</th><th class="n">ยอด</th><th>บัญชีผู้เสียหาย</th><th>บัญชีแถวแรก</th><th>ตรวจสอบรายการ</th><th class="n">ถอนเงินสด</th><th class="n">โอนต่อ</th><th class="n">ค้าง</th>`, rowsK)}</section>
  ${framed ? frHtml : pgHtml + `<section class="sec flw"><h2>รายการเดินเงินในผัง (ยอดจริงของรายการ) — ทีละกรรม</h2></section>${ktAll}`}
  </div></body></html>`);
  w.document.close();
  { const pb = w.document.getElementById("rpPrint"); if (pb) pb.addEventListener("click", () => w.print()); }
}
