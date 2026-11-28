/* ================= เส้นทางเงินตามกรรม : ผู้เสียหายโอน -> บัญชีม้า -> ถอนเงินสด / โอนต่อ =================
   ข้อมูลจาก build/flow.py (DB.flow) — ติดตามแบบเงินเข้าก่อนออกก่อน (FIFO) จากรายการที่ผู้เสียหายโอน */
const FLX = { tab: "k", sel: new Set(), label: "", nav: [], fwd: [], focus: null, tk: null, thr: 90, init: false, split: true };
/* วิธีนับเงิน (คำนวณไว้ล่วงหน้าทุกแบบใน build/flow.py) : v = พอดียอดที่ผู้เสียหายโอน · vb = ยอดที่โอน + ยอดคงเหลือเดิมของบัญชี ; ยอดเกินได้กี่ % */
const FL_MODE = [["v", "พอดียอดผู้เสียหายโอน"], ["vb", "ยอดผู้เสียหาย + ยอดคงเหลือเดิมของบัญชี"]];
const FL_TOL = [["0", "ไม่ได้เลย"], ["1", "1%"], ["5", "5%"], ["10", "10%"], ["25", "25%"], ["50", "50%"], ["x", "ไม่จำกัด"]];
function flVarSet(k) { const F = DB.flow; if (!F || !F.var) return; if (!F.var[k]) k = F.def; const v = F.var[k];
  F.kam = v.kam; F.hops = v.hops; F.accs = v.accs; F.lots = v.lots; F.clusters.forEach((c, i) => { if (v.cl[i]) { c.tin = v.cl[i][0]; c.cash = v.cl[i][1]; c.nk = v.cl[i][2]; } });
  F.cur = k; try { localStorage.setItem("atm_flow_var", k); } catch (e) { }
  if (typeof RQ !== "undefined") { RQ.ft = null; RQ.ho = null; RQ.km = null; } FLX.only = null; FLX.tk = null; }
function flVarInit() { const F = DB && DB.flow; if (!F || !F.var || F.cur) return; let k = F.def; try { k = localStorage.getItem("atm_flow_var") || F.def; } catch (e) { } flVarSet(k); }
const flVarLab = () => { const F = DB.flow, [m, t] = String((F && F.cur) || "v:1").split(":"); return `นับทั้งรายการตามยอดจริง · ${(FL_MODE.find((x) => x[0] === m) || ["", m])[1]} · ยอดเกินได้ ${(FL_TOL.find((x) => x[0] === t) || ["", t])[1]}`; };
/* ขาด / เกิน ของกรรม */
const flGapH = (k) => { const ov = k.over || 0, mx = k.mix || 0, lf = k.left || 0;
  return [ov > 0.005 ? `<b class="ovr" title="ยอดรายการที่นับรวมเกินยอดตั้งต้น (มีเงินอื่นปนในรายการสุดท้าย)">เกิน +${B(ov)}</b>` : "", mx > 0.005 ? `<b class="shr" title="เงินของกรรมที่อยู่ในรายการซึ่งมีเงินอื่นปน (รายการใหญ่กว่ายอดที่เหลือเกิน % ที่ตั้งไว้) — แสดงเป็นกล่องเส้นประ ไม่ไล่ต่อ">ปน ${B(mx)}</b>` : "", lf > 0.005 ? `<b class="shr" title="เงินยังค้างในบัญชี ณ สิ้นข้อมูล">ค้าง ${B(lf)}</b>` : ""].filter(Boolean).join(" ") || (k.st === "พบในบัญชีแถวแรก" ? '<span class="okk">พอดี</span>' : ""); };
const flGapT = (k) => [(k.over || 0) > 0.005 ? `เกิน ${B(k.over)}` : "", (k.mix || 0) > 0.005 ? `ปนในรายการที่มีเงินอื่น ${B(k.mix)}` : "", (k.left || 0) > 0.005 ? `ค้าง ${B(k.left)}` : ""].filter(Boolean).join(" ; ") || (k.st === "พบในบัญชีแถวแรก" ? "พอดี" : "");
/* ผลการไล่ของกรรม: สุดสาย = เงินถึงปลายทางที่ไล่ต่อไม่ได้แล้ว (ถอนเงินสด / คืนผู้เสียหาย / ค่าธรรมเนียมเล็กน้อย) ไม่น้อยกว่า FLX.thr % ของยอด */
function flRes(k, HO) {
  const hs = HO.filter((h) => h.k === k.k), lay = hs.length ? Math.max(...hs.map((h) => h.d)) : 0, a = k.amt || 1;
  const feeO = hs.filter((h) => flFee(h)).reduce((s, h) => s + h.amt, 0), bigO = k.oth - feeO;
  const mh = hs.filter(flMix), ms = (f) => mh.filter(f).reduce((s, h) => s + h.amt, 0), mC = ms((h) => h.typ === "C"), mE = ms((h) => h.typ === "B" || flFee(h)), mX = ms((h) => h.typ === "X");
  const end = k.cash + k.back + feeO + mC + mE, pe = Math.min(100, end / a * 100), pc = Math.min(100, (k.cash + mC) / a * 100);
  const r = { lay, pe, pc, px: Math.min(100, (k.ext + mX) / a * 100), pl: k.left / a * 100, po: bigO / a * 100, pm: Math.max(0, (k.mix || 0) - mC - mE - mX) / a * 100 };
  if (!k.has) return Object.assign(r, { c: "n", ic: "✕", t: "ยังไม่มี statement ของบัญชีแถวแรก — ไล่ได้ 0 แถว" });
  if (k.st !== "พบในบัญชีแถวแรก") return Object.assign(r, { c: "n", ic: "?", t: "ไม่พบรายการใน statement ของบัญชีแถวแรก" });
  if (pe >= FLX.thr) return Object.assign(r, { c: "e", ic: "🏁", t: `ไล่สุดสายแล้ว · ถอนเงินสด ${nf(pc, 0)}%${mC > 0.005 ? " (บางส่วนอยู่ในรายการที่มีเงินอื่นปน)" : ""}` });
  const op = [[r.px, "โอนต่อ ต้องขอ statement แถว " + (lay + 1)], [r.po, "ไฟล์ไม่ระบุปลายทาง"], [r.pl, "เงินค้างในบัญชี"], [r.pm, "ปนในรายการโอนที่มีเงินอื่น (หยุดไล่)"]].filter((x) => x[0] >= 0.5).sort((p, q) => q[0] - p[0]);
  return Object.assign(r, { c: pe >= 50 ? "m" : "o", ic: pe >= 50 ? "◐" : "→", t: `ถึงปลายทางแล้ว ${nf(pe, 0)}% · ยังเหลือ: ${op.map((x) => `${x[1]} ${nf(x[0], 0)}%`).join(" · ") || "-"}` });
}
const FL_T = { C: "ถอนเงินสด", X: "โอนต่อ — ยังไม่มี statement", F: "โอนต่อ — บัญชีในสำนวน", B: "คืนผู้เสียหาย", O: "โอนออกไม่ระบุปลายทาง / ค่าธรรมเนียม", L: "ยังค้างในบัญชี ณ สิ้นข้อมูล" };
const FL_C = { C: "#B3261E", X: "#E08A00", F: "#1565C0", B: "#2E7D32", O: "#78909C", L: "#B0BEC5" };
const flDw = (m) => (m == null ? "" : m < 60 ? `${nf(m, 0)} นาที` : m < 2880 ? `${nf(m / 60, 1)} ชม.` : `${nf(m / 1440, 0)} วัน`);
const flAcc = (o) => { const x = accIndex().get(o); if (x) return accLink(o); const n = (DB.flow.names || {})[o]; return n ? `<span class="badge">${av(n[2])}${esc(n[2].slice(0, 24))}</span>` : esc(o); };
/* คอกม้า = กลุ่มบัญชีของเจ้าของตั้งแต่ 2 คนขึ้นไป ที่มีหลักฐานเชื่อมกัน (กลุ่มที่เป็นคนเดียวหลายบัญชี ไม่นับเป็นคอก) */
const flIsCl = (c) => (c.real != null ? c.real : c.kinds.some((k) => k !== "เจ้าของบัญชีชื่อเดียวกัน"));
const flClusters = (F) => F.clusters.filter(flIsCl).length;
const flName = (o) => { const n = (DB.flow.names || {})[o]; return n ? `${n[0]} ${n[1]} ${n[2]}` : o; };

/* ---------- บัญชีคุมงานติดตามเส้นเงิน : 1 งาน = 1 เป้าหมายที่ต้องขอข้อมูล/ดำเนินการต่อ ----------
   สถานะ/งานที่ต้องทำ/หมายเหตุ/ปลายทางที่ระบุเอง เก็บที่เดียวกับหน้า "รายการขอข้อมูลธนาคาร" (rqStore) ใช้รหัสงานเป็นกุญแจ */
const FL_ACT = {
  stm: ["ขอ statement (ไล่แถวถัดไป)", "ทำหนังสือขอ statement ของบัญชีปลายทาง ช่วงก่อน-หลังวันที่รับโอนอย่างน้อย 1 เดือน พร้อมข้อมูลเปิดบัญชี (KYC) เบอร์โทรและอุปกรณ์ที่ผูกแอป · ได้ไฟล์แล้ววางในโฟลเดอร์ตามรหัสคำขอ แล้วอัปเดตเว็บ ระบบจะไล่เส้นเงินต่อให้"],
  atm: ["ที่ตั้งตู้ + CCTV ตู้", "ขอที่ตั้งตู้ ภาพ CCTV ช่วงก่อน-หลังเวลาถอน 15 นาที และช่องทางที่ใช้กด (เลขบัตร หรือกดเงินไม่ใช้บัตรพร้อมเบอร์โทร) เพื่อระบุตัวผู้ถอน"],
  br: ["ใบถอน / ใบ pay-in pay-out + CCTV สาขา", "ขอใบถอนเงินหรือใบ pay-in pay-out หลักฐานแสดงตนและลายมือชื่อผู้ทำรายการ และ CCTV เคาน์เตอร์ช่วงเวลาที่ทำรายการ"],
  shop: ["ร้านค้า / ร้านทอง / นิติบุคคล — ใบเสร็จ + สอบปากคำ", "ขอ statement บัญชีร้านเพื่อยืนยันยอดรับ · ขอใบเสร็จหรือใบกำกับภาษี รายการสินค้า (น้ำหนักทอง/รุ่นสินค้า) ชื่อผู้ซื้อและผู้รับของ CCTV ร้าน · เรียกเจ้าของร้านหรือพนักงานขายมาสอบปากคำ · พิจารณาติดตามยึดทรัพย์ที่ซื้อ"],
  wal: ["วอลเล็ต / ผู้ให้บริการรับชำระเงิน", "ทำหนังสือถึงผู้ให้บริการ (e-wallet / payment gateway) ขอข้อมูลผู้รับปลายทาง: เลขอ้างอิงรายการ บัญชีวอลเล็ตหรือร้านค้าผู้รับ ข้อมูล KYC เบอร์โทร และบัญชีธนาคารที่ถอนเงินออก"],
  pay: ["ขอรายละเอียดรายการ (ไฟล์ไม่ระบุปลายทาง)", "ไฟล์ของธนาคารไม่ระบุบัญชีปลายทางของรายการนี้ — ขอธนาคารเจ้าของบัญชีแจ้งรายละเอียด (บัญชี ร้านค้า หรือ Biller ผู้รับ และเลขอ้างอิง) · เมื่อทราบเลขบัญชีแล้วกด ✎ เพื่อพิมพ์เลขบัญชีเอง ระบบจะไล่ต่อให้"],
  abr: ["โอนต่างประเทศ", "ขอสำเนาคำขอโอนเงินต่างประเทศ (SWIFT) ชื่อผู้รับ ธนาคารและประเทศปลายทาง วัตถุประสงค์การโอน · ประสานหน่วยงานที่เกี่ยวข้องหากต้องติดตามต่อในต่างประเทศ"],
  itv: ["เรียกสอบปากคำ", "ออกหมายเรียกเจ้าของบัญชีหรือผู้ทำรายการ สอบถามที่มาของเงิน ผู้สั่งการ ผู้ถือสมุด-บัตร-โทรศัพท์ และค่าจ้างเปิดบัญชี"],
  ext: ["ขอ statement ช่วงถัดไป / ตรวจยอดคงเหลือ", "เงินยังค้างในบัญชี ณ วันสุดท้ายของข้อมูล — ขอ statement ต่อจากวันสุดท้ายถึงปัจจุบัน ตรวจยอดคงเหลือ และพิจารณาอายัด"],
  frz: ["อายัดบัญชี", "ประสานธนาคารตรวจยอดคงเหลือปัจจุบันและอายัดบัญชีตามอำนาจที่มี"],
  oth: ["อื่น ๆ (ดูหมายเหตุ)", "ระบุสิ่งที่ต้องทำในช่องหมายเหตุ (กด ✎)"],
};
const FL_KIND = { N: "บัญชีแถวแรก — ยังไม่มี statement", X: "บัญชีปลายทาง — ยังไม่มี statement", C: "จุดถอนเงินสด", O: "ปลายทางไม่ปรากฏในไฟล์", L: "เงินค้างในบัญชี", H: "ปิดแล้ว" };
const FL_KS = { N: "แถวแรก", X: "โอนต่อ", C: "ถอนสด", O: "ไม่ระบุปลายทาง", L: "เงินค้าง", H: "ปิดแล้ว" };
const FL_BANKS = ["BBL", "KBANK", "KTB", "TTB", "SCB", "BAY", "GSB", "BAAC", "KKP", "CIMB", "TISCO", "UOB", "LHBANK", "GHB", "ICBC", "อื่น ๆ"];
const flBk = (b) => (!b || b === "nan" ? "" : b);
const flPad = (a) => (/^\d{9}$/.test(a || "") ? "0" + a : a || "");
/* รหัสงานของรายการเดินเงิน — ต้องตรงกับที่ build/flow.py ใช้รับ "เลขบัญชีที่ระบุเอง" (บัญชี-<ธนาคาร>-<เลขในไฟล์> / ระบุเอง-<บัญชีต้นทาง>-<วันเวลา>) */
const flRc = (h) => (h.typ === "X" ? h.okey || rqSafe(`บัญชี-${h.tb}-${h.to}`) : h.typ === "C" ? h.rc || "" : h.typ === "O" ? (!flFee(h) ? h.okey || rqSafe(`ระบุเอง-${h.from}-${h.t}`) : "") : h.typ === "L" ? (h.amt >= 100 ? rqSafe(`ค้าง-${h.from}`) : "") : "");
const flEd = (rc) => { const v = rc && rqStore()[rc]; return v && (v.en || v.eb || v.ea) ? v : null; };
/* ปลายทางของรายการโอนต่อ (ใช้ค่าที่ผู้ใช้แก้ไขก่อนค่าในไฟล์) */
const flDest = (h) => { const e = flEd(flRc(h)) || {}; return { name: e.en || h.tn || "", bank: e.eb || flBk(h.tb), acc: e.ea || flPad(h.to), ed: !!(e.en || e.eb || e.ea) }; };
const FL_SWIFT = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;      // รหัส SWIFT/BIC = ธนาคารต่างประเทศ (เช่น HSBCHKHHHKH ฮ่องกง, RHBBMYKL มาเลเซีย)
const flGuess = (nm, bank, acc) => (FL_SWIFT.test(String(bank || "").trim().toUpperCase()) && !/^(BKKB|KASI|KRTH|SICO|AYUD|GSBA|TMBK|BAAB|UBOB)TH/.test(String(bank).toUpperCase()) ? "abr" :/ทอง|เยาวราช|เพชร|GOLD|JEWEL/i.test(nm) ? "shop" : /เพย์|PAY|มันนี่|MONEY|วอลเล็|WALLET|เซ็นดิท|XENDIT|SHOPEE|ช้อปปี้|LAZADA|ลาซาด้า|2C2P|OMISE|แอสเซนด์|ASCEND|BITKUB|บิทคับ|BINANCE|E-MONEY/i.test(nm) ? "wal" :
  /บริษัท|บจก|บจ\.|หจก|ห้างหุ้นส่วน|ร้าน|SHOP|การไฟฟ้า|การประปา|CO\.,? ?LTD/i.test(nm) ? "shop" : !/^\d{9,15}$/.test(acc) || /^\d+$/.test(bank) ? "wal" : "stm");
function flTasks(K, HO) {
  const T = new Map(), nm = DB.flow.names || {};
  const add = (rc, o, h, k, from, amt, t, d) => { let x = T.get(rc); if (!x) { x = Object.assign({ rc, n: 0, amt: 0, ks: new Set(), from: new Set(), ds: new Set(), first: t, last: t, rows: [] }, o); T.set(rc, x); }
    x.n++; x.amt += amt; x.ks.add(k); if (from) x.from.add(from); if (d) x.ds.add(d); if (t < x.first) x.first = t; if (t > x.last) x.last = t; if (h) x.rows.push(h); };
  K.filter((k) => !k.has).forEach((k) => { const c = rqSafe(`บัญชี-${k.l1bank}-${k.l1acc}`); add(c, { kind: "N", bank: k.l1bank, acc: k.l1acc, name: k.l1name, def: "stm", code: c, tok: [k.l1acc] }, null, k.k, "", k.amt, k.t, 0); });
  HO.forEach((h) => { const rc = flRc(h); if (!rc) return;
    if (h.typ === "X") { const b = flBk(h.tb), a = flPad(h.to); add(rc, { kind: "X", bank: b, acc: a, name: h.tn || "", def: flGuess(h.tn || "", b, h.to), code: rqSafe(`บัญชี-${/^\d*$/.test(b) ? "ไม่ทราบธนาคาร" : b}-${a}`), tok: [a] }, h, h.k, h.from, h.amt, h.t, h.d); }
    else if (h.typ === "C") { const code = rc.split("-").slice(2).join("-"); add(rc, { kind: "C", place: h.place, prov: h.prov, ch: h.ch, def: h.ch === "B" ? "br" : "atm", code: rc, tok: [/ไม่ระบุเครื่อง|สาขา/.test(rc) ? "" : code] }, h, h.k, h.from, h.amt, h.t, h.d); }
    else if (h.typ === "O") add(rc, { kind: "O", bank: "", acc: "", name: "", def: "pay", code: rc, tok: [] }, h, h.k, h.from, h.amt, h.t, h.d);
    else if (h.typ === "L") { const n = nm[h.from] || ["", h.from, h.from]; add(rc, { kind: "L", bank: n[0], acc: n[1], name: n[2], o: h.from, def: "ext", code: rqSafe(`ค้าง-${n[0]}-${n[1]}`), tok: [] }, h, h.k, h.from, h.amt, h.t, h.d); } });
  const out = [...T.values()]; out.forEach((t) => (t.tok = [t.rc, t.code, ...t.tok])); return out;
}
const flMiss = (t) => { const a = flActOf(t);
  return t.kind === "N" ? "ยังไม่มี statement ของบัญชีแถวแรก — ไล่เงินต่อไม่ได้" : t.kind === "X" ? (a === "wal" ? "ยังไม่ทราบผู้รับเงินปลายทางในระบบวอลเล็ต/ผู้ให้บริการชำระเงิน" : a === "shop" ? "ยังไม่ทราบว่าซื้ออะไร ใครเป็นผู้ซื้อ/ผู้รับของ (ใบเสร็จ · CCTV ร้าน · คำให้การ)" : a === "abr" ? "ยังไม่ทราบผู้รับเงินในต่างประเทศ" : "ยังไม่มี statement ของบัญชีปลายทาง (แถวถัดไป)") :
    t.kind === "C" ? `ยังไม่ทราบตัวผู้ถอน — ไม่มีภาพ CCTV / ${t.ch === "B" ? "ใบถอน-หลักฐานแสดงตน" : "ข้อมูลบัตรหรือเบอร์ที่ใช้กด"}${/ไม่ระบุเครื่อง/.test(t.rc) ? " · ไฟล์ไม่ระบุรหัสตู้/สาขา" : ""}` :
    t.kind === "O" ? "ไฟล์ของธนาคารไม่ระบุบัญชีปลายทาง" : t.kind === "L" ? "เงินยังค้างในบัญชี ณ วันสุดท้ายของข้อมูล — ยังไม่มี statement ช่วงถัดไป" : ""; };
const flTkIc = (t) => { const a = flActOf(t); return `<span class="tkic" style="--c:${FL_ACT_C[a] || "#795548"}" title="${esc(FL_ACT[a][0])}">!</span>`; };
/* ความจำเป็น = ดาวตามยอดเงินผู้เสียหายที่เข้า (เงินเข้ามาก = ดาวมาก) ; ต่ำกว่า 1,000 บาท อาจเป็นการทดสอบบัญชี */
const flStarA = (amt) => (amt >= 5e5 ? 5 : amt >= 1e5 ? 4 : amt >= 1e4 ? 3 : amt >= 1e3 ? 2 : 1);
const flStarF = (nk) => (nk >= 5 ? 5 : nk >= 3 ? 4 : nk >= 2 ? 3 : 0);          // ซ้ำหลายกรรม = น่าสงสัย แม้ยอดน้อย
const flStar = (amt, nk = 0) => Math.max(flStarA(amt), flStarF(nk));
const flStarWhy = (amt, nk = 0) => [`ยอดเงินผู้เสียหาย ${B(amt)} บาท`, nk >= 2 ? `ซ้ำ ${nk} กรรม` : ""].filter(Boolean).join(" · ");
const flStarH = (amt, nk = 0) => { const n = flStar(amt, nk), test = n === 1; return `<span class="star s${n}" title="${test ? "ยอดต่ำกว่า 1,000 บาท — อาจเป็นการทดสอบบัญชี" : flStarWhy(amt, nk)}">${"★".repeat(n)}<i>${"★".repeat(5 - n)}</i></span>${test ? ' <small class="muted">ทดสอบ?</small>' : nk >= 2 ? ` <small class="rpt" title="บัญชี/จุดเดียวกันพบใน ${nk} กรรม">ซ้ำ ${nk} กรรม</small>` : ""}`; };
const flStarT = (amt, nk = 0) => "★".repeat(flStar(amt, nk)) + (flStar(amt, nk) === 1 ? " (ยอดต่ำ อาจเป็นการทดสอบบัญชี)" : nk >= 2 ? ` (ซ้ำ ${nk} กรรม)` : "");
/* บัญชีในสำนวน: ชื่อ + ธนาคาร/เลขบัญชี */
const flAccN = (o) => { const n = (DB.flow.names || {})[o]; return flAcc(o) + (n && n[1] ? `<small class="accno">${bankIco(n[0])}${esc(n[0])} ${esc(n[1])}</small>` : ""); };
/* รายการเดินเงินจากข้อมูลดิบ (ใช้ทั้งหน้าเส้นเงินและหน้าขอข้อมูลธนาคาร) */
/* รายการไม่มีปลายทาง: ค่าธรรมเนียม หรือ โอนออกแต่ไฟล์ไม่ระบุบัญชี */
/* รายการที่เงินของกรรมปนกับเงินอื่น: รายการจริงใหญ่กว่ายอดที่เหลือของกรรมเกิน % ที่ตั้งไว้ -> แสดงรายการจริงเต็มยอด (h.full) โดย h.amt = เงินของกรรมที่ปนอยู่ ; ไม่ไล่ต่อจากรายการนี้ */
const flMix = (h) => !!h.mx;
const flFee = (h) => h.typ === "O" && (h.ch === "fee" || (!/^nd:/.test(h.ch || "") && (h.mx ? h.full : h.amt) < 100));
const flOLab = (h) => (flFee(h) ? "ค่าธรรมเนียม" : "โอนออก · ไม่ระบุบัญชีปลายทาง");
const flOSub = (h) => (flFee(h) ? "" : [String(h.ch || "").slice(3) ? "ช่องทาง " + String(h.ch).slice(3) : "", h.tb ? "ธนาคารปลายทาง " + h.tb : ""].filter(Boolean).join(" · "));
/* บัญชีปลายทางที่รับโอนในชื่อบุคคลต่างกัน (วอลเล็ต / บัญชีรับแทน) — แยกเป็นรายชื่อ ; ชื่อบริษัท/ร้าน (ชื่อไทย-อังกฤษ) ไม่แยก */
const FL_CORP = /บริษัท|จำกัด|บจก|หจก|ห้าง|CO\.|LTD|LIMITED|COMPANY|CORP|PAY|BANK|SETTLEMENT|ELEC|BUS/i;
const flMulti = (acc, name) => { const M = flMulti.M || (flMulti.M = new Set((DB.flow && DB.flow.multi) || [])); return M.has(acc) && !!name; };
const flNmKey = (s) => String(s || "").replace(/\s+/g, "").replace(/^(นางสาว|น\.ส\.?|นาย|นาง|MRS\.?|MR\.?|MS\.?|MISS)/i, "").toUpperCase();
const flXKey = (h) => (flMulti(h.to, h.tn) ? h.to + "|" + flNmKey(h.tn) : h.to);
const flHop = (h) => ({ k: h[0], d: h[1], from: h[2], to: h[3], typ: h[4], amt: h[5], t: h[6], dw: h[7], place: h[8], prov: h[9], tn: h[10], tb: h[11], rc: h[12] || "", ch: h[13] || "", okey: h[14] || "", full: h[15] || 0, ov: h[16] || 0, mx: h[17] || 0, bal: h[18] == null ? null : h[18], rk: h[19] || 0, te: h[20] || "" });
/* ---- ยอดคงเหลือของบัญชีช่วงที่เงินกรรมนี้อยู่ (จาก build/flow.py : lots) ----
   ก่อนรับ = ยอดก่อนเงินกรรมนี้เข้า · ต่ำสุดหลังรับ = ยอดต่ำสุดตั้งแต่รับจนรายการออกที่ปิดยอด (เงินกรรมนี้เหลือในบัญชีได้ไม่เกินยอดนี้) · เงินอื่นเข้า = เงินเข้าอื่นระหว่างช่วง */
const flLotO = (l) => ({ k: l[0], d: l[1], o: l[2], t: l[3], base: l[4], prior: l[5], st: l[9], before: l[10] == null ? null : l[10], after: l[11] == null ? null : l[11], low: l[12] == null ? null : l[12], oi: l[13] || 0, src: l[14] || "", rk: l[15] || 0, te: l[16] || "" });
const flSk = (x) => (x.te || x.t) + "|" + String(Math.round((x.rk || 0) * 10)).padStart(9, "0");
const flLowHi = (l) => l.low != null && l.low >= l.base - 0.5;
/* เพิ่มแถวเงินเข้า (สีเทา) ให้ทุกบัญชีที่มีรายการในตาราง: รับเงินกรรมนี้ 1 แถว + เงินอื่นที่เข้าระหว่างช่วง (เกิน 3 รายการ = แถวสรุป) */
function flAug(rows) {
  const want = new Set(rows.filter((h) => !h.aux).map((h) => h.k + "|" + h.d + "|" + h.from)), ex = [], seen = new Set();
  ((DB.flow && DB.flow.lots) || []).forEach((l0) => { if (!want.has(l0[0] + "|" + l0[1] + "|" + l0[2]) || l0.length < 13) return; const l = flLotO(l0);
    ex.push({ aux: "R", typ: "R", k: l.k, d: l.d, from: l.o, t: l.t, te: l.te, rk: l.rk, amt: l.base, bal: l.after, lot: l });
    const oi = l.oi; if (!oi) return;
    if (oi[4] && oi[4].length) oi[4].forEach((e) => { const id = l.o + "|" + e[0] + "|" + e[1] + "|" + e[4]; if (seen.has(id)) return; seen.add(id);
      ex.push({ aux: "I", typ: "I", k: l.k, d: l.d, from: l.o, t: e[0], te: e[5] || "", rk: e[4] || 0, amt: e[1], bal: e[3] == null ? null : e[3], who: e[2] || "", kk: e[6] || 0 }); });
    else ex.push({ aux: "I", typ: "I", k: l.k, d: l.d, from: l.o, t: oi[2], t1: oi[3], te: oi[6] || "", rk: (oi[5] || 0) - 0.5, amt: oi[1], bal: null, n: oi[0] }); });
  return rows.concat(ex); }
/* เรียงสำหรับรายงาน: กรรม → ชั้น → บัญชี (ตามเวลาที่เงินเข้าบัญชีนั้น) → ลำดับจริงตามโซ่ยอดคงเหลือ */
function flAugSort(rows) { const R = flAug(rows), g = new Map(); R.forEach((h) => { const q = h.k + "|" + h.d + "|" + h.from, v = flSk(h); if (!g.has(q) || v < g.get(q)) g.set(q, v); });
  const G = (h) => g.get(h.k + "|" + h.d + "|" + h.from);
  return R.sort((a, b) => a.k - b.k || a.d - b.d || (G(a) < G(b) ? -1 : G(a) > G(b) ? 1 : 0) || (flSk(a) < flSk(b) ? -1 : flSk(a) > flSk(b) ? 1 : 0)); }
const flAuxLab = (x) => (x.aux === "R" ? (x.d === 1 ? "รับเงินผู้เสียหาย" : "รับโอนเข้า") : x.kk ? `เงินกรรม ${x.kk} เข้า` : x.n ? `เงินอื่นเข้า ${x.n} ครั้ง` : "เงินอื่นเข้า");
/* คำอธิบายแถวเงินเข้า : html = ในเว็บ (ป้ายสี) / ไม่ใช่ = ข้อความล้วน (CSV / รายงาน) */
const flAuxTxt = (x, html, nolab) => { const e = html ? esc : (v) => v, b = html ? (v) => `<b>${v}</b>` : (v) => v, lab = (t) => (nolab ? "" : t);
  if (x.aux === "R") { const l = x.lot, src = l.d > 1 && l.src ? (html ? " จาก " + flAccN(l.src) : " จาก " + flName(l.src)) : "";
    const st = l.before == null ? "ไม่มียอดคงเหลือในไฟล์ธนาคาร" : `ก่อนรับมี ${b(B(l.before))} · ต่ำสุดหลังรับ ${b(B(l.low))}`;
    const hi = flLowHi(l) ? (html ? ` <span class="badge" style="background:#FDECEA;color:#B3261E" title="ยอดคงเหลือไม่เคยต่ำกว่ายอดที่รับ ตั้งแต่รับจนรายการออกที่ปิดยอด — เงินกรรมนี้อาจยังอยู่ในบัญชี">อาจยังค้าง</span>` : " · ยอดไม่เคยต่ำกว่าที่รับ อาจยังค้าง") : "";
    return (html ? `<span class="badge" style="background:#E3F2FD;color:#1565C0">${flAuxLab(x)}</span>${src} · ` : nolab ? (src ? src.trim() + " · " : "") : flAuxLab(x) + src + " · ") + st + hi; }
  if (x.n) return (html ? `<span class="badge" style="background:#ECEFF1;color:#455A64">${flAuxLab(x)}</span> ` : lab(flAuxLab(x) + " ")) + `${dtTh(x.t)} – ${dtTh(x.t1)} · รวม ${B(x.amt)}`;
  return (html ? `<span class="badge" style="background:${x.kk ? "#E8EAF6;color:#3949AB" : "#ECEFF1;color:#455A64"}">${flAuxLab(x)}</span> จาก ` : lab(flAuxLab(x) + " ") + "จาก ") + e(x.who || "ไม่ระบุผู้โอน"); };
/* สรุปของกล่องบัญชีในผัง */
const flLotSum = (ls) => { if (!ls || !ls.length) return null; const L = ls.filter((l) => l.length >= 13).map(flLotO).sort((a, b) => (flSk(a) < flSk(b) ? -1 : 1)); if (!L.length) return null;
  const lows = L.map((l) => l.low).filter((v) => v != null);
  return { before: L[0].before, low: lows.length ? Math.min(...lows) : null, base: L.reduce((s, l) => s + l.base, 0), on: L.reduce((s, l) => s + (l.oi ? l.oi[0] : 0), 0), os: L.reduce((s, l) => s + (l.oi ? l.oi[1] : 0), 0) }; };
const flTeMk = (x, html) => (x.te && x.te !== x.t ? (html ? ` <small class="muted" title="ไฟล์ธนาคารลงเวลาไม่ตรงลำดับ — ยอดคงเหลือยืนยันว่ารายการนี้เกิดหลังรายการก่อนหน้า (เรียงตามยอดคงเหลือ)">*</small>` : " *") : "");
/* รายการที่เงินของกรรมนี้เป็นเพียงส่วนหนึ่งของยอดทั้งรายการ (เช่น ถอน 20,000 แต่เป็นเงินกรรมนี้ 74.33) */
const flPart = (h) => h.full > 0 && h.full - h.amt > 0.005;
const flActOf = (t) => { const v = rqStore()[t.rc]; return v && FL_ACT[v.a] ? v.a : FL_ACT[t.def] ? t.def : "oth"; };
const flTkD = (t) => { const e = flEd(t.rc) || {}; return { name: e.en || t.name || "", bank: e.eb || t.bank || "", acc: e.ea || t.acc || "", ed: !!(e.en || e.eb || e.ea) }; };
const flTkName = (t) => { if (t.kind === "C") return `${t.place}${t.prov ? " · " + t.prov : ""}`; if (t.kind === "H") return t.name; const d = flTkD(t);
  return [d.name || (t.kind === "O" ? (d.ed ? "" : "ปลายทางไม่ปรากฏในไฟล์") : "(ไม่มีชื่อในไฟล์)"), d.bank, d.acc].filter(Boolean).join(" ") + (d.ed ? " (ระบุเอง)" : ""); };
const flStTxt = (t) => { const v = rqStat(t); return v.auto ? `ได้รับแล้ว (${t.fl.length} ไฟล์)` : RQ_SL[v.s || ""]; };
const flNote = (t) => (rqStore()[t.rc] || {}).n || "";
const flSnap = (t) => ({ fl: 1, kd: t.kind, tt: flTkName(t), ks: [...t.ks].sort((a, b) => a - b), amt: Math.round(t.amt * 100) / 100 });
const flStHtml = (t) => { const v = rqStat(t);
  return `<span class="flst">` + (v.auto ? `<span class="rqst sg" title="${esc(t.fl.map((f) => f[0]).join("\n"))}">📁 ได้รับแล้ว · ${t.fl.length} ไฟล์</span>` :
    `<select class="rqsel s${v.s || "0"}" data-frc="${esc(t.rc)}" aria-label="สถานะการขอข้อมูล">${Object.entries(RQ_SL).map(([k, l]) => `<option value="${k}" ${k === (v.s || "") ? "selected" : ""}>${l}</option>`).join("")}</select>${v.d ? `<small class="rqd">${dS(v.d)}</small>` : ""}`) + `</span>`; };
/* แก้ไขงาน: งานที่ต้องทำ · หมายเหตุ · ชื่อ/ธนาคาร/เลขบัญชีปลายทางที่พิมพ์เอง */
function flEdit(t, done) {
  const v = rqStore()[t.rc] || {}, canAcc = "XO".includes(t.kind), act = flActOf(t), ks = [...t.ks].sort((a, b) => a - b);
  const d = document.createElement("dialog"); d.className = "fdlg";
  const st = t.hist ? { s: v.s || "" } : rqStat(t);
  d.innerHTML = `<form method="dialog"><h3>${flTkIc(t)} อัปเดตสถานะ / แก้ไข</h3><p class="note"><b>${esc(flTkName(t))}</b><br>มาจากกรรมที่ ${ks.slice(0, 12).join(", ")}${ks.length > 12 ? " …" : ""} · ${nf(t.n)} รายการ · ${B(t.amt)} บาท${flMiss(t) ? `<br><span class="miss">ขาดข้อมูล: ${esc(flMiss(t))}</span>` : ""}</p>
    ${st.auto ? `<p class="note">📁 ได้รับไฟล์แล้ว ${t.fl.length} ไฟล์ (สถานะตั้งให้อัตโนมัติ)</p>` : `<label>สถานะการขอข้อมูล<select name="s">${Object.entries(RQ_SL).map(([k, l]) => `<option value="${k}" ${k === (st.s || "") ? "selected" : ""}>${l}</option>`).join("")}</select></label>`}
    <label>งานที่ต้องทำ<select name="a">${Object.entries(FL_ACT).map(([k, a]) => `<option value="${k}" ${k === act ? "selected" : ""}>${a[0]}</option>`).join("")}</select></label>
    ${canAcc ? `<label>ชื่อบัญชี / ผู้รับปลายทาง (พิมพ์เองเมื่อไฟล์ไม่มีชื่อ หรือชื่อไม่ถูก)<input name="en" value="${esc(v.en || "")}" placeholder="${esc(t.name || "ไม่มีชื่อในไฟล์")}" autocomplete="off"></label>
    <div class="row2"><label>ธนาคาร<select name="eb"><option value="">${esc(t.bank ? "ตามไฟล์: " + t.bank : "ไม่ทราบ")}</option>${FL_BANKS.map((b) => `<option ${b === v.eb ? "selected" : ""}>${b}</option>`).join("")}</select></label>
    <label>เลขบัญชี (พิมพ์เอง)<input name="ea" value="${esc(v.ea || "")}" placeholder="${esc(t.acc || "ไม่มีเลขบัญชีในไฟล์")}" inputmode="numeric" autocomplete="off"></label></div>` : ""}
    <label>หมายเหตุ / ผลที่ได้<textarea name="n" rows="3" placeholder="เช่น เลขหนังสือ วันที่ส่ง ผู้ประสาน ผลการสอบปากคำ">${esc(v.n || "")}</textarea></label>
    <p class="err" hidden></p>
    ${canAcc ? `<p class="note">ชื่อและเลขบัญชีที่พิมพ์เองจะแสดงในตารางและผังทันที (มีเครื่องหมาย ✎) · ถ้าต้องการให้ระบบ<b>ไล่เส้นเงินต่อ</b>ด้วยเลขนี้ ให้กด "บันทึกสถานะเป็นไฟล์" วางไว้ที่ <code>0_บันทึกงาน/สถานะขอข้อมูล.json</code> แล้วอัปเดตเว็บ</p>` : ""}
    <menu><button value="cancel" class="tb" formnovalidate>ยกเลิก</button><button value="ok" class="tb pri">บันทึก</button></menu></form>`;
  document.body.appendChild(d);
  const fm = $("form", d), get = (k) => String(new FormData(fm).get(k) || "").trim(), eaOf = () => get("ea").replace(/[\s-]/g, "");
  fm.addEventListener("submit", (e) => { if (e.submitter && e.submitter.value === "ok" && canAcc && eaOf() && !/^\d{9,15}$/.test(eaOf())) { e.preventDefault(); const p = $(".err", d); p.hidden = false; p.textContent = "เลขบัญชีต้องเป็นตัวเลข 9–15 หลัก"; } });
  d.addEventListener("close", () => { if (d.returnValue === "ok") { const o = Object.assign({ a: get("a"), n: get("n") }, canAcc ? { en: get("en"), eb: get("eb"), ea: eaOf() } : {}, flSnap(t));
      if (fm.elements.s) { const sN = get("s"); if (sN !== (v.s || "")) { o.s = sN; o.d = sN ? rqToday() : ""; } }
      rqPatch(t.rc, o); done(); toast("บันทึกแล้ว (เก็บในเครื่องนี้) — กด “บันทึกสถานะเป็นไฟล์” เพื่อใช้ทุกเครื่อง"); } d.remove(); });
  d.showModal();
}

function pFlow(m) {
  const F = DB.flow;
  if (!F) { m.innerHTML = `<div class="card empty">ยังไม่มีข้อมูลเส้นทางเงิน — ต้องมีไฟล์ "5_เอกสาร/บัญชี ผู้เสียหายโอนไป ผคห.xlsx" แล้วอัปเดตเว็บ</div>`; return; }
  accIndex();
  const K = F.kam, H = F.hops, AC = F.accs, CL = F.clusters;
  const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
  const tot = sum(K, (k) => k.amt), seeded = sum(K.filter((k) => k.st === "พบในบัญชีแถวแรก"), (k) => k.amt);
  const end = { C: sum(K, (k) => k.cash), X: sum(K, (k) => k.ext), B: sum(K, (k) => k.back), O: sum(K, (k) => k.oth), L: sum(K, (k) => k.left) };
  const noSt = K.filter((k) => !k.has), noHit = K.filter((k) => k.has && k.st !== "พบในบัญชีแถวแรก");
  const firsts = K.map((k) => k.first).filter((v) => v != null).sort((a, b) => a - b), med = firsts.length ? firsts[Math.floor(firsts.length / 2)] : null;
  const l1 = new Set(K.map((k) => k.l1)).size;
  const nCL = flClusters(F);          // คอกที่มีหลักฐานมากกว่า "เจ้าของชื่อเดียวกัน"
  const fold = (DB.rq && DB.rq.folder) || "โฟลเดอร์ข้อมูลที่ได้รับจากธนาคาร";
  const bar = Object.entries(end).filter(([, v]) => v > 0).map(([k, v]) => `<i style="width:${v / seeded * 100}%;background:${FL_C[k]}" title="${k === "L" ? "ยังค้างในบัญชี" : FL_T[k]} ${B(v)}"></i>`).join("");
  const lg = Object.entries(end).filter(([, v]) => v > 0).map(([k, v]) => `<span><span class="dot" style="background:${FL_C[k]}"></span>${k === "L" ? "ยังค้างในบัญชี" : FL_T[k]} <b>${M(v)}</b> (${nf(v / seeded * 100, 0)}%)</span>`).join("");
  m.innerHTML = `<div id="flRoot"><section class="hero"><div style="position:relative;z-index:1"><span class="eyebrow">เส้นทางเงินตามกรรม · เริ่มจากรายการที่ผู้เสียหายโอน</span>
    <h1>ผู้เสียหายโอน ${nf(K.length)} ครั้ง ${M(tot)} เข้าบัญชีแถวแรก ${nf(l1)} บัญชี</h1>
    <p class="lead">ติดตามได้ <b class="y">${M(seeded)}</b> (${nf(K.length - noSt.length - noHit.length)} กรรม) — เงินออกจากบัญชีแถวแรกภายใน <b>${flDw(med)}</b> (ค่ากลาง) ·
    ${noSt.length ? `อีก ${nf(noSt.length)} กรรม ${M(sum(noSt, (k) => k.amt))} ยังไม่มี statement ของบัญชีแถวแรก (ยืนยันจาก statement ของผู้เสียหายได้ ${nf(noSt.filter((k) => /^ยืนยัน/.test(k.cf || "")).length)} กรรม)` : ""}${noHit.length ? ` · ${nf(noHit.length)} กรรมไม่พบรายการใน statement` : ""}
    ${F.rev ? `<br><small>ตรวจย้อนจาก statement ของบัญชีม้า: พบเงินเข้าจากบัญชีผู้เสียหาย ${nf(F.rev.n)} รายการ ${M(F.rev.amt)} — ${F.rev.extra ? `<b>มี ${nf(F.rev.extra)} รายการ ${M(F.rev.extra_amt)} ที่ไม่อยู่ในไฟล์ผู้เสียหาย</b> (เพิ่มเป็นกรรมให้แล้ว ดูคอลัมน์ "ที่มา")` : "อยู่ในไฟล์ผู้เสียหายครบ ไม่มีรายการนอกไฟล์"}</small>` : ""}</p>
    <div class="bar" style="height:14px;margin-top:10px">${bar}</div><div class="lg" style="margin-top:8px;color:#DCE6F2">${lg}</div></div>
    <div class="hero-k">
      <div class="kc"><span class="l">ถอนเป็นเงินสด</span><span class="v">${M(end.C)}</span><span class="s">${nf(H.filter((h) => h[4] === "C").length)} ครั้ง</span></div>
      <div class="kc"><span class="l">โอนต่อ (ต้องขอ statement)</span><span class="v">${M(end.X)}</span><span class="s">${nf(new Set(H.filter((h) => h[4] === "X").map((h) => h[3])).size)} บัญชีปลายทาง</span></div>
      <div class="kc"><span class="l">กลุ่มบัญชีที่มีผู้ควบคุมร่วม</span><span class="v">${nf(nCL)}</span><span class="s">คอกม้า${CL.length > nCL ? ` · อีก ${nf(CL.length - nCL)} กลุ่มเป็นเจ้าของเดียวกัน` : ""}</span></div>
    </div></section>
  <details class="fbox" style="margin-top:12px"><summary>${IC("link", 15)} วิธีวิเคราะห์ / ข้อจำกัด</summary><p class="note">
    <b>กรรม</b> = รายการที่ผู้เสียหายโอน 1 ครั้ง (จากไฟล์ "บัญชี ผู้เสียหายโอนไป ผคห.") จับคู่กับรายการเงินเข้าใน statement ของบัญชีแถวแรก (ยอดตรงกัน วันเดียวกัน) ·
    <b>การติดตาม</b> ใช้หลัก "เงินเข้าก่อน ออกก่อน" ไล่ไปทีละรายการจนถึง ถอนเงินสด / โอนออกไปบัญชีที่ยังไม่มี statement / ยังค้างในบัญชี — เป็นการปันส่วนทางบัญชี ไม่ใช่การระบุธนบัตร และยอดรวมทุกปลายทางเท่ากับยอดที่เริ่มติดตาม ·
    <b>บทบาทบัญชี</b> ดูจากชั้นที่รับเงิน สัดส่วนที่ถอนเงินสด จำนวนวันที่ใช้งาน และความเร็วที่เงินผ่านบัญชี ·
    <b>คอกม้า</b> = บัญชีที่มีร่องรอยผู้ควบคุมร่วมกัน: เจ้าของชื่อเดียวกัน · IP เดียวกัน · โอนออกไปวอลเล็ต/พร้อมเพย์เบอร์เดียวกัน · ถอนเงินตู้เดียวกันในเวลาไล่เลี่ยกัน (เบอร์โทร/อีเมลในไฟล์เป็นของคู่ธุรกรรม จึงไม่ใช้เบอร์ฝั่งเงินเข้า) —
    เป็น <b>ข้อสันนิษฐานจากข้อมูลธนาคาร</b> ต้องยืนยันด้วยข้อมูลผู้ใช้ IP จากผู้ให้บริการ ภาพ CCTV และคำให้การ ·
    <b>รูปบุคคล</b> จับคู่กับบัญชีด้วยชื่อ-นามสกุล (รูปที่มีกรอบประสีส้ม = ชื่อนี้มีหลายคน ยังไม่ยืนยันว่าเป็นคนใด) ต้องยืนยันกับเอกสารเปิดบัญชีของธนาคาร</p></details>
  <div class="seg sec" id="flTabs"></div>
  <div class="flcrumb" id="flCrumb" hidden></div>
  <div data-fl="k"><div id="flK"></div>
    <div class="card fcbox" id="fcBox"><div class="fchead"><b id="fcTitle">ผังเส้นทางเงิน</b><span class="fcg"><details class="fchelp"><summary class="tb" title="วิธีใช้ผังและปุ่มต่าง ๆ">? วิธีใช้</summary><div class="fchelp-box"><b>วิธีใช้ผังเส้นทางเงิน</b><ol>
        <li><b>เลือกกรรม</b>: แตะแถวในตาราง “เลือกกรรม” (หลายกรรม = ติ๊กช่องหน้าแถว) หรือใช้ “เลือกเร็ว…”</li>
        <li><b>แตะกล่อง</b> = เน้นเส้นทางเงินของกล่องนั้น ถ้าบัญชี/จุดถอน/ร้านค้านั้นมีหลายกล่องในผัง จะเน้นทุกกล่องที่ซ้ำให้อัตโนมัติ · แตะกล่องเดิมอีกครั้ง = ยกเลิก</li>
        <li><b>แถบสีม่วง</b> (ขึ้นหลังแตะกล่อง) บอกว่าพบในกรรมไหน แถวไหนบ้างทั้งคดี
          <ul><li>“เลือก N กรรมนี้ → ผังใหม่” = เปิดผังเฉพาะกรรมเหล่านั้น (กลับด้วย “← กลับชุดกรรมเดิม”)</li><li>“รายงาน N กรรมนี้” = ทำรายงานทันที หัวรายงานบอกว่าซ้ำกรรมไหน แถวไหน</li><li>“เน้นเฉพาะกล่องที่แตะ” / “เน้นทุกกล่องที่ซ้ำ” = สลับเน้นกล่องเดียว หรือทุกกล่อง</li></ul></li>
        <li><b>เลือกหลายกล่องรวมกัน</b>: กด “＋ เลือกหลายกล่อง” ให้เป็น ✓ (หรือกด Ctrl ค้างแล้วคลิก) แล้วแตะกล่อง/เส้นที่ต้องการ → “⧉ แยกเป็นผังใหม่” เพื่อตัดเฉพาะส่วนนั้น</li>
        <li><b>⟳ บัญชีซ้ำทั้งหมด</b> = เน้นทุกบัญชีที่ซ้ำในผังพร้อมกัน · ป้าย ⟳ 1/3 บนกล่อง = กล่องที่ 1 จาก 3 กล่องที่ซ้ำ (แตะป้ายก็เน้นทุกกล่องได้)</li>
        <li><b>← →</b> = ย้อน/ไปข้างหน้าการเน้น · <b>ล้างที่เน้น</b> = ยกเลิกทั้งหมด</li>
        <li><b>ไอคอนงาน</b> (ตู้ สาขา ร้าน สมุดบัญชี) บนกล่อง = แตะเพื่ออัปเดตสถานะการขอข้อมูล</li>
        <li><b>ยอดคงเหลือในกล่องบัญชี</b>: “ก่อนรับ” = ยอดก่อนเงินกรรมนี้เข้า · “ต่ำสุดหลังรับ” = ยอดต่ำสุดตั้งแต่รับจนนำออก (เงินกรรมนี้เหลือในบัญชีได้ไม่เกินยอดนี้) · “อาจยังค้าง” = ยอดไม่เคยต่ำกว่าที่รับ · “เงินอื่นเข้า” = เงินที่เข้ามาปนระหว่างนำออก (ดูรายการเป็นแถวสีเทาในตาราง)</li>
        <li><b>รายงาน</b> = หน้าพิมพ์ A4 แนวนอน ผังทีละกรรม ตามด้วยตารางรายการเดินเงินของกรรมนั้น</li></ol></div></details><button class="tb" id="fcPng" disabled>${IC("dl", 15)} บันทึกภาพ</button><button class="tb" id="fcRep" disabled>รายงาน</button></span></div>
      <div class="fctools">
        <span class="fcg"><i>กรรม</i><select class="tin" id="fcQuick" aria-label="เลือกกรรมแบบเร็ว"></select><button class="tb on" id="fcPrev" hidden title="กลับไปชุดกรรมที่แสดงอยู่ก่อนใช้ เลือกเร็ว…">← กลับชุดกรรมเดิม</button><button class="tb" id="fcClr" disabled title="เอากรรมทั้งหมดออกจากผัง">ล้างผัง</button></span>
        <span class="fcg"><i>วิธีนับเงิน</i><select class="tin" id="flMode" aria-label="วิธีนับเงิน">${FL_MODE.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select><select class="tin" id="flTol" aria-label="ยอดเกินได้" title="ยอดเกินได้: รายการที่ใหญ่กว่ายอดที่เหลือของกรรม ยอมให้เกินได้เท่าไร">${FL_TOL.map(([v, l]) => `<option value="${v}">${v === "0" ? "ห้ามเกินยอด" : v === "x" ? "เกินได้ไม่จำกัด" : "เกินได้ " + l}</option>`).join("")}</select><details class="info"><summary title="วิธีนับเงิน">i</summary><div class="info-box">ทุกรายการในผังและตารางเป็น<b>ยอดจริงของรายการ</b>ในไฟล์ธนาคาร (ไม่แบ่งยอด)<br><b>พอดียอดผู้เสียหายโอน</b>: นับรายการเงินออกของบัญชีตามลำดับเวลา จนครบยอดที่ผู้เสียหายโอน (ชั้นถัดไป = ยอดที่บัญชีนั้นรับมา)<br><b>ยอดผู้เสียหาย + ยอดคงเหลือเดิม</b>: นับจนครบยอดที่รับ + เงินที่มีอยู่ในบัญชีก่อนหน้า<br><b>ยอดเกินได้</b>: ถ้ารายการถัดไปใหญ่กว่ายอดที่เหลือของกรรม แปลว่ามีเงินอื่นปนอยู่ในรายการนั้น — ถ้าเกินไม่มากกว่า % ที่เลือก จะนับรายการนั้นเต็มยอดและไล่ต่อ (ขึ้น <b style="color:#B3261E">เกินยอด +…</b>) ; ถ้าเกินมากกว่านั้น ยังแสดงรายการจริงเต็มยอดเป็น<b>กล่องเส้นประ</b> บอกว่า <b style="color:#B26A00">เงินกรรมนี้ปนอยู่เท่าไร เงินอื่นเท่าไร</b> แต่ไม่ไล่ต่อจากรายการนั้น และไม่นับรวมในยอดถอนสด/โอนต่อของกรรม</div></details></span>
        <span class="fcg"><i>มุมมอง</i><span class="fczm"><button class="tb" id="fcSplit" disabled title="แยกกล่องเป็นรายกรรม มีกรอบและยอดรวมของแต่ละกรรม">แยกตามกรรม</button><button class="tb" id="fcOver" disabled title="รวมทุกกรรมเป็นภาพเดียว บัญชี/จุดเดียวกันเป็นกล่องเดียว">ภาพรวม</button></span><button class="tb" id="fcMdup" hidden title="แบบแยกตามกรรม: บัญชีและจุดถอนเงินสด (ตู้/สาขา) ที่ซ้ำกันในผัง รวมเป็นกล่องเดียว (มีป้ายจำนวนครั้ง) / แยกกล่องรายครั้ง (ป้าย ⟳ i/N)">รวมกล่องซ้ำ</button></span>
      </div>
      <div class="fctools" id="fcSelBar" hidden>
        <span class="fcg"><i>เน้นในผัง</i><span class="fczm"><button class="tb ic" id="fcUndo" disabled title="ย้อนการเน้นทีละขั้น">←</button><button class="tb ic" id="fcRedo" disabled title="ไปข้างหน้า — กลับไปขั้นที่ย้อนมา">→</button></span><button class="tb" id="fcDup" disabled title="เน้นทุกกล่องบัญชีที่ซ้ำกันในผัง พร้อมเส้นทางเงินที่ผ่าน">⟳ บัญชีซ้ำทั้งหมด</button><select class="tin" id="fcMin" aria-label="เน้นบัญชีที่รับเข้าหลายครั้ง" title="เน้นบัญชีที่รับเข้าหลายครั้ง"><option value="">รับเข้า ≥ … ครั้ง</option>${[2, 3, 5, 10].map((v) => `<option value="${v}">รับเข้า ≥ ${v} ครั้ง</option>`).join("")}</select><button class="tb" id="fcHlClr" disabled title="ล้างการเน้นทั้งหมดในผัง">ล้างที่เน้น</button><button class="tb" id="fcMulti" aria-pressed="false" title="เปิด = แตะได้หลายกล่อง/หลายเส้น เลือกรวมกัน (เหมือนกด Ctrl ค้างแล้วคลิก) · ปิด = แตะกล่องเดียว เลือกกล่องนั้นพร้อมกล่องที่ซ้ำกันในผัง">＋ เลือกหลายกล่อง</button><details class="info"><summary title="วิธีใช้">i</summary><div class="info-box">แตะกล่อง/เส้น = เน้นเส้นทางเงิน (ตารางด้านล่างแสดงเฉพาะรายการบนเส้นที่เน้น)<br>ชี้เมาส์ = รายละเอียด · แตะไอคอนงาน (ตู้ สาขา ร้าน สมุดบัญชี …) = อัปเดตสถานะ<br>แตะป้าย ⟳ = เน้นทุกกล่องของบัญชี/จุดเดียวกัน</div></details></span>
        <span class="fcg"><i>ผังย่อย</i><button class="tb" id="fcSub" disabled title="แยกเฉพาะกล่องและเส้นที่เน้นอยู่ ออกมาเป็นผังใหม่ (จัดวางใหม่ให้กระชับ) — บันทึกภาพ/รายงานได้ ใช้นำเสนอ">⧉ แยกเป็นผังใหม่</button><button class="tb on" id="fcFull" hidden title="กลับไปผังเต็มของกรรมที่เลือก">← กลับผังเต็ม</button></span>
        <span id="fcSelInfo" class="note"></span>
        <span class="fcg fcr"><i>ซูม</i><span class="fczm"><button class="tb ic" id="fcZo" disabled title="ย่อ (Ctrl + หมุนล้อเมาส์ก็ได้)">−</button><button class="tb" id="fcZr" disabled title="ขนาดจริง 100%">100%</button><button class="tb ic" id="fcZi" disabled title="ขยาย (Ctrl + หมุนล้อเมาส์ก็ได้)">+</button></span><button class="tb" id="fcFit" disabled title="ย่อ/ขยายให้พอดีความกว้างจอ">พอดีจอ</button></span>
      </div>
      <div class="fcpick" id="fcPick" hidden></div>
      <div class="fcwrap" id="fcWrap"><p class="note" id="fcHint">เลือกกรรมจากตารางด้านบน หรือเลือกทั้งคอกจาก "เลือกเร็ว…"</p></div>
      <div id="fcDet" data-det></div></div>
    </div><div class="fctip" id="fcTip" hidden></div><div data-fl="a" hidden><div id="flA"></div></div><div data-fl="c" hidden><div id="flC"></div><div id="flW"></div></div>
  <div data-fl="w" hidden><div id="flCash"></div><div id="flProv"></div></div>
  <div data-fl="t" hidden>
    <details class="fbox"><summary>${IC("todo", 15)} วิธีใช้บัญชีคุม</summary><p class="note">
      <b>1 แถว = 1 เป้าหมาย</b>ที่ต้องขอข้อมูลหรือดำเนินการต่อ (บัญชีปลายทางที่ยังไม่มี statement · จุดถอนเงินสด · รายการที่ไฟล์ไม่ระบุปลายทาง · เงินที่ยังค้างในบัญชี) — คอลัมน์ "มาจากกรรมที่" และ "ออกจากบัญชี" บอกที่มา กดแถวเพื่อดูรายการต้นทางทุกแถว<br>
      <b>สถานะ / งานที่ต้องทำ</b>: เลือกได้ทั้งในตารางนี้และในรายการย่อยของหน้า "ตามกรรม" (ใช้ข้อมูลชุดเดียวกัน) · งานที่ระบบเลือกให้เป็นค่าเริ่มต้นเปลี่ยนได้ เช่น ร้านทอง → ขอใบเสร็จและเรียกสอบปากคำ<br>
      <b>ไปมา</b>: กดเลขกรรมเพื่อไปดูผังของกรรมนั้น แล้วกด <b>← ย้อนกลับ</b> ที่แถบด้านบนเพื่อกลับมาที่เดิม<br>
      <b>ได้ข้อมูลแล้ว</b>: วางไฟล์ในโฟลเดอร์ <code>${esc(fold)}</code> โดยตั้งชื่อโฟลเดอร์ย่อยตาม <b>รหัสคำขอ</b> (กดเพื่อคัดลอก) แล้วดับเบิลคลิก <b>อัปเดตเว็บ.bat</b> — แถวขึ้น 📁 ได้รับแล้ว อัตโนมัติ ; ถ้าเป็น statement รูปแบบ template04 ระบบอ่านและไล่เส้นเงินต่อให้เอง<br>
      <b>ไฟล์ไม่ระบุปลายทาง / ไม่มีชื่อ</b>: กด ✎ เพื่อพิมพ์ชื่อ ธนาคาร เลขบัญชีเอง<br>
      <b>ใช้หลายเครื่อง</b>: สถานะ หมายเหตุ และเลขบัญชีที่พิมพ์เอง เก็บในเบราว์เซอร์ของเครื่องนี้ — กด "บันทึกสถานะเป็นไฟล์" แล้ววางไว้ที่ <code>0_บันทึกงาน/สถานะขอข้อมูล.json</code> ก่อนอัปเดตเว็บ</p></details>
    <div class="flkp sec" id="flKp"></div><div id="flT"></div></div></div>`;
  const root = $("#flRoot");

  /* ---- รายการเดินเงิน (ใช้ทุกตารางย่อย) ---- */
  const hopObj = flHop;
  const HO = H.map(hopObj);
  /* ซ้ำข้ามกรรม: บัญชีเดียวกัน หรือ ชื่อบัญชีเดียวกันแต่คนละเลขบัญชี */
  const dnm = (s_) => String(s_ || "").replace(/\s+/g, "").replace(/^(นางสาว|น\.ส\.?|นาย|นาง|MRS\.?|MR\.?|MS\.?|MISS|บริษัท|บจก\.?|หจก\.?)/i, "").replace(/จำกัด$/, "").toUpperCase();
  const DA = new Map(), DN = new Map(), dpush = (m, k, v) => { if (!k) return; if (!m.has(k)) m.set(k, new Map()); const x = m.get(k); if (!x.has(v.a)) x.set(v.a, new Set()); x.get(v.a).add(v.k); };
  K.forEach((k) => { const a = gK(k.l1acc), v = { a, k: k.k }; dpush(DA, a, v); dpush(DN, dnm(k.l1name), v); });
  HO.forEach((h) => { if (h.typ !== "X" && h.typ !== "F") return; const nm = h.typ === "F" ? ((DB.flow.names || {})[h.to] || [])[2] : h.tn, a = gK(h.to) + (h.typ === "X" && flMulti(h.to, nm) ? "|" + flNmKey(nm) : ""), v = { a, k: h.k }; dpush(DA, a, v); dpush(DN, dnm(nm), v); });
  /* คืน { same: กรรมอื่นที่มีบัญชีนี้, nm: กรรมที่มีชื่อเดียวกันแต่คนละบัญชี } */
  const dupOf = (acc, name, self) => { const a = gK(acc) + (flMulti(acc, name) ? "|" + flNmKey(name) : ""), same = [...((DA.get(a) || new Map()).get(a) || [])].filter((k) => !self.has(k)).sort((x, y) => x - y);
    const nm = []; const m = DN.get(dnm(name)); if (m && dnm(name).length > 3) m.forEach((ks, a2) => { if (a2 !== a) ks.forEach((k) => nm.push(k)); });
    return { same, nm: [...new Set(nm)].sort((x, y) => x - y) }; };
  const dupKs = (ks) => ks.slice(0, 6).map((k) => `<a href="#" class="kchip sm" data-addk="${k}" title="เพิ่มกรรมที่ ${k} เข้าผัง">${k}</a>`).join("") + (ks.length > 6 ? `<small>+${ks.length - 6}</small>` : "");
  const dupHtml = (d) => (d.same.length || d.nm.length ? `<span class="dupn">${d.same.length ? `<span title="บัญชีเดียวกันนี้อยู่ในกรรมอื่นด้วย">↺ บช.เดียวกับกรรม ${dupKs(d.same)}</span>` : ""}${d.nm.length ? `<span class="nm" title="ชื่อบัญชีเดียวกัน แต่คนละเลขบัญชี">≈ ชื่อซ้ำในกรรม ${dupKs(d.nm)}</span>` : ""}</span>` : "");
  const dupTxt = (d) => [d.same.length ? `บช.เดียวกับกรรม ${d.same.join(", ")}` : "", d.nm.length ? `ชื่อซ้ำ (คนละบัญชี) ในกรรม ${d.nm.join(", ")}` : ""].filter(Boolean).join(" ; ");
  /* กรรมที่มีบัญชีร่วมกับกรรมอื่น (ภายในชุด sel ถ้าระบุ) */
  const flShared = (sel) => { const out = new Set(); DA.forEach((m) => { const ks = new Set(); m.forEach((s_) => s_.forEach((k) => { if (!sel || sel.has(k)) ks.add(k); })); if (ks.size >= 2) ks.forEach((k) => out.add(k)); }); return [...out].sort((a, b) => a - b); };
  /* งานติดตาม (บัญชีคุม) + งานที่เคยตั้งสถานะไว้แต่ไม่อยู่ในเส้นเงินรอบนี้แล้ว (เช่น ได้ statement มาแล้ว) */
  const TK = flTasks(K, HO), tkBy = new Map(TK.map((t) => [t.rc, t]));
  /* ---- บัญชี / จุดถอนเงินสด / ร้านค้า-นิติบุคคล ที่ปรากฏในหลายกรรม (ทั้งคดี) : key -> กรรมไหน แถวไหน ---- */
  const isShop = (h) => { const t = tkBy.get(flRc(h)); return (t ? flActOf(t) : flGuess(h.tn || "", flBk(h.tb), h.to)) === "shop"; };
  const hopItem = (h) => (h.typ === "F" ? ["A|" + h.to, "acc"] : h.typ === "X" ? ["X|" + flXKey(h), isShop(h) ? "shop" : "acc"] : h.typ === "C" && !/ไม่ระบุเครื่อง/.test(h.rc || h.place) ? ["C|" + h.place, "cash"] : null);
  const itName = (key, h) => { if (key[0] === "A") { const o = key.slice(2), n = (DB.flow.names || {})[o], k0 = K.find((k) => k.l1 === o); return n ? [n[2], `${n[0]} ${n[1]}`] : k0 ? [k0.l1name, `${k0.l1bank} ${k0.l1acc}`] : [o, ""]; }
    if (key[0] === "X") { const d = flDest(h); return [d.name || "(ไม่มีชื่อในไฟล์)", `${d.bank} ${d.acc}`]; } return [h.place, h.prov || ""]; };
  const itIndex = (KK, HH) => { const m = new Map(), add = (key, type, nmF, k, row, amt) => { let o = m.get(key); if (!o) { const nm = nmF(); m.set(key, (o = { key, type, name: nm[0], sub: nm[1], occ: new Map(), amt: 0 })); }
      if (type === "shop") o.type = "shop"; let r = o.occ.get(k); if (!r) o.occ.set(k, (r = new Set())); r.add(row); o.amt += amt || 0; };
    KK.forEach((k) => { add("V|" + k.vacc, "vic", () => [`${k.vbank} ${k.vacc}`, ""], k.k, 0, k.amt); add("A|" + k.l1, "acc", () => itName("A|" + k.l1), k.k, 1, k.amt); });
    HH.forEach((h) => { add("A|" + h.from, "acc", () => itName("A|" + h.from), h.k, h.d, 0); const it = hopItem(h); if (it) add(it[0], it[1], () => itName(it[0], h), h.k, h.d + 1, h.amt); });
    return m; };
  const ITX = itIndex(K, HO), TYL = { acc: "บัญชี", cash: "จุดถอนเงินสด", shop: "ร้านค้า/นิติบุคคล", vic: "บัญชีผู้เสียหาย" };
  const nodeItem = (n) => { if (!n) return null; if (n.kind === "V") return n.vacc ? "V|" + n.vacc : null; if (n.kind === "A") return "A|" + n.o; if (n.kind === "C") return n.place ? "C|" + n.place : null;
    if (n.kind === "X") return !n.mix ? "X|" + n.ok : ITX.has("X|" + n.o) ? "X|" + n.o : ITX.has("A|" + n.o) ? "A|" + n.o : null; return null; };
  const occTxt = (o, ks) => [...o.occ.entries()].filter(([k]) => !ks || ks.has(k)).sort((a, b) => a[0] - b[0]).map(([k, r]) => { const rr = [...r].filter((x) => x > 0).sort((a, b) => a - b); return rr.length ? `กรรม ${k} (แถว ${rr.join(", ")})` : `กรรม ${k}`; });
  /* แตะกล่อง -> แถบ "พบในกี่กรรมทั้งคดี" + ปุ่มเลือกทุกกรรมนั้นเป็นผังใหม่ / ทำรายงาน */
  const pickUpd = (S) => { const el = $("#fcPick"); if (!el || !curG) return; const its = [...new Set([...S.n].map((id) => nodeItem(curG.byId.get(id))).filter(Boolean))];
    const o = its.length === 1 && !S.e.size ? ITX.get(its[0]) : null; FLX.pickItem = o ? o.key : null; el.hidden = !o; if (!o) return;
    const ks = [...o.occ.keys()].sort((a, b) => a - b), same = ks.join(",") === selKey(), lst = occTxt(o), grp = curG.nodes.filter((m) => nodeItem(m) === o.key);
    const sw = grp.length < 2 ? "" : S.n.size >= grp.length ? `<button class="tb" data-pk="one" title="เน้นเฉพาะกล่องที่แตะล่าสุด ไม่รวมกล่องอื่นที่ซ้ำ">เน้นเฉพาะกล่องที่แตะ</button>` : `<button class="tb" data-pk="all" title="เน้นทุกกล่องของ${TYL[o.type]}นี้ในผัง">เน้นทุกกล่องที่ซ้ำ (${grp.length})</button>`;
    el.innerHTML = `<span class="pkt"><b>${TYL[o.type]} ${esc(o.name)}</b> <small>${esc(o.sub)}</small> · พบใน <b>${ks.length}</b> กรรมทั้งคดี${grp.length > 1 ? ` · ในผังนี้ ${grp.length} กล่อง (เน้นอยู่ ${S.n.size})` : ""}</span>${lst.slice(0, 14).map((t) => `<span class="pko">${esc(t)}</span>`).join("")}${lst.length > 14 ? `<small>… อีก ${lst.length - 14}</small>` : ""}` +
      `<span class="pkb">${sw}${ks.length < 2 ? `<small class="muted">พบในกรรมนี้กรรมเดียว</small>` : (same ? `<small class="muted">ผังนี้คือทุกกรรมที่พบแล้ว</small>` : `<button class="tb pri" data-pk="g">เลือก ${ks.length} กรรมนี้ → ผังใหม่</button>`) + `<button class="tb" data-pk="r">รายงาน ${ks.length} กรรมนี้</button>`}</span>`; };
  /* รายงาน: สิ่งที่พบซ้ำ (ในกรรมที่เลือก / ในกรรมอื่นของคดี) */
  const repItems = () => { const sel = new Set(curG.K.map((k) => k.k)), loc = itIndex(curG.K, curG.H), out = [];
    loc.forEach((o, key) => { if (o.type === "vic") return; const all = ITX.get(key) || o, other = [...all.occ.keys()].filter((k) => !sel.has(k)).sort((a, b) => a - b); if (o.occ.size < 2 && !other.length) return;
      out.push({ key, type: all.type, name: o.name, sub: o.sub, nk: o.occ.size, occ: occTxt(o).join(" · "), amt: o.amt, other: other.length ? other.slice(0, 40).join(", ") + (other.length > 40 ? ` … (+${other.length - 40})` : "") : "", focus: key === FLX.focusItem && FLX.focusSel === selKey() }); });
    const TO = { acc: 0, cash: 1, shop: 2 }; return out.sort((a, b) => b.focus - a.focus || TO[a.type] - TO[b.type] || b.nk - a.nk || b.amt - a.amt); };
  const HS = Object.entries(rqStore()).filter(([rc, v]) => v && v.fl && !tkBy.has(rc)).map(([rc, v]) => ({ rc, code: rc, kind: "H", hist: 1, name: v.tt || rc, n: 0, amt: v.amt || 0, ks: new Set(v.ks || []), from: new Set(), ds: new Set(), first: "", last: "", rows: [], tok: [rc], def: "oth" }));
  const LG = [...TK, ...HS], lgBy = new Map(LG.map((t) => [t.rc, t]));
  FLX.tk = tkBy;
  const tkOfK = new Map(); TK.forEach((t) => t.ks.forEach((k) => { if (!tkOfK.has(k)) tkOfK.set(k, []); tkOfK.get(k).push(t); }));
  const kProg = (k) => { const ts = tkOfK.get(k) || []; let dn = 0, q = 0; ts.forEach((t) => { const s = rqStat(t).s || ""; if (s === "g" || s === "x") dn++; else if (s === "q") q++; }); return { n: ts.length, dn, q }; };
  const progHtml = (k) => { const p = kProg(k); return p.n ? `<a href="#" class="flprog ${p.dn === p.n ? "d" : p.dn || p.q ? "p" : ""}" data-gp="${k}" title="งานติดตามของกรรมนี้: เสร็จ ${p.dn} จาก ${p.n}${p.q ? ` · รอผล ${p.q}` : ""} — กดเพื่อเปิดในรายการขอข้อมูลธนาคาร">${p.dn}/${p.n}${p.q ? ` · รอ ${p.q}` : ""}</a>` : ""; };
  const tkCell = (x) => { const rc = flRc(x), t = rc && tkBy.get(rc); if (!t) return x.typ === "F" ? '<span class="muted">มี statement — ไล่ต่อได้</span>' : "";
    return `${flStHtml(t)}<br>${flTkIc(t)}<span class="flact">${esc(FL_ACT[flActOf(t)][0])}</span> <a href="#" class="cmpl" data-go="${esc(rc)}" title="เปิดในรายการขอข้อมูลธนาคาร (ย้อนกลับมาได้)">ขอข้อมูล ›</a><a href="#" class="cmpl" data-ed="${esc(rc)}" title="แก้ไขชื่อ/เลขบัญชีปลายทาง · งานที่ต้องทำ · หมายเหตุ">✎</a>`; };
  const tkTxt = (x) => { const rc = flRc(x), t = rc && tkBy.get(rc); return t ? `${flStTxt(t)} · ${FL_ACT[flActOf(t)][0]}${flNote(t) ? " · " + flNote(t) : ""}` : x.typ === "F" ? "มี statement" : ""; };
  const destX = (x) => { const d = flDest(x); return `<span class="badge" style="background:#FFF4D6;color:#8A5A00">โอนต่อ</span><span class="badge nostm" title="ยังไม่มี statement ของบัญชีปลายทาง">ขาด STM</span> ${av(d.name)}${bankIco(d.bank)}${esc(d.bank)} ${esc(d.acc)} ${esc(d.name || "(ไม่มีชื่อในไฟล์)")}${d.ed ? ' <span class="fled" title="ชื่อ/เลขบัญชีที่พิมพ์เอง">✎</span>' : ""}${dupHtml(dupOf(x.to, x.tn, new Set([x.k])))}`; };
  const destO = (x) => { const e = flEd(flRc(x)), sb = flOSub(x); return (flFee(x) ? `<span class="muted">ค่าธรรมเนียม</span>` : `<span class="badge" style="background:#FFF4D6;color:#8A5A00">โอนออก</span><span class="badge nostm" title="ไฟล์ของธนาคารไม่ระบุบัญชีปลายทาง — ขอรายละเอียดรายการจากธนาคารต้นทาง">ไม่ระบุบัญชีปลายทาง</span>${sb ? ` <small class="muted">${esc(sb)}</small>` : ""}`) + (e ? ` → <span class="fled">✎</span> ${av(e.en)}${esc([e.eb, e.ea, e.en].filter(Boolean).join(" "))} <small class="muted">(ระบุเอง)</small>` : ""); };
  const destF = (x) => destF0(x) + (flMix(x) ? ' <span class="badge" style="background:#FFF3E0;color:#B26A00" title="รายการนี้ใหญ่กว่ายอดที่เหลือของกรรม — มีเงินอื่นปน จึงไม่ไล่ต่อจากรายการนี้">ปนเงินอื่น · ไม่ไล่ต่อ</span>' : "");
  const destF0 = (x) => (x.typ === "C" ? `<span class="badge r">ถอนเงินสด</span> ${esc(x.place)}${x.prov ? " · " + esc(x.prov) : ""}` : x.typ === "F" ? `→ ${flAccN(x.to)}` :
    x.typ === "X" ? destX(x) : x.typ === "B" ? `<span class="badge g">คืนผู้เสียหาย</span> ${esc(x.to)}` : x.typ === "L" ? `<span class="badge" style="background:#ECEFF1;color:#455A64">ยังค้างในบัญชี</span> ณ สิ้นข้อมูล` : destO(x));
  const destV = (x) => { if (x.typ === "X") { const d = flDest(x); return `โอนต่อ (ไม่มี statement) ${d.bank} ${d.acc} ${d.name}${d.ed ? " (ระบุเอง)" : ""}`; } if (x.typ === "O") { const e = flEd(flRc(x)); return flOLab(x) + (flOSub(x) ? ` (${flOSub(x)})` : "") + (e ? ` → ระบุเอง ${[e.eb, e.ea, e.en].filter(Boolean).join(" ")}` : ""); }
    return x.typ === "C" ? `ถอนเงินสด ${x.place} ${x.prov}` : x.typ === "F" ? `โอนต่อ ${flName(x.to)}` : x.typ === "B" ? `คืนผู้เสียหาย ${x.to}` : FL_T.L; };
  const KAM = new Map(K.map((k) => [k.k, k.amt])), kAmt = (k) => KAM.get(k) || 0;
  const hopCols = [{ k: "k", lab: "กรรมที่", sh: "กรรม", n: 1 }, { k: "vamt", lab: "ผู้เสียหายโอน", n: 1, v: (x) => kAmt(x.k), f: (x) => B(kAmt(x.k)) }, { k: "d", lab: "ชั้น", n: 1 }, { k: "t", lab: "วันเวลา", f: (x) => dtTh(x.t) + flTeMk(x, 1), date: (x) => x.t, s: flSk },
    { k: "from", lab: "บัญชี", f: (x) => { const n = (DB.flow.names || {})[x.from]; return flAcc(x.from) + (n ? `<small class="accno">${bankIco(n[0])}${esc(n[0])} ${esc(n[1])}</small>` : ""); }, v: (x) => flName(x.from) }, { k: "dest", lab: "ปลายทาง", w: 1, f: (x) => (x.aux ? flAuxTxt(x, 1) : destF(x)), v: (x) => (x.aux ? flAuxTxt(x) : destV(x)) }, { k: "typ", lab: "ลักษณะ", hide: 1, v: (x) => (x.aux ? flAuxLab(x) : x.typ === "O" ? flOLab(x) : FL_T[x.typ]) },
    { k: "amt", lab: "ยอดรายการ", sh: "ยอด", n: 1, f: (x) => (x.typ === "L" ? `<span class="muted">${B(x.amt)}</span>` : B(flMix(x) ? x.full : x.amt)), v: (x) => (flMix(x) ? x.full : x.amt), s: (x) => (flMix(x) ? x.full : x.amt) },
      { k: "ov", lab: "เกินยอด", n: 1, f: (x) => (flMix(x) ? `<span class="shr" title="รายการนี้ ${B(x.full)} บาท ใหญ่กว่ายอดที่เหลือของกรรม ${B(x.amt)} (เกิน ${B(x.ov)}) — มีเงินอื่นปน จึงไม่ไล่ต่อ">ปน · ของกรรมนี้<br>${B(x.amt)}</span>` : x.ov > 0.005 ? `<b class="ovr" title="รายการนี้ทำให้ยอดที่นับรวมเกินยอดตั้งต้น (มีเงินอื่นปน)">+${B(x.ov)}</b>` : ""), v: (x) => (flMix(x) ? `ปนเงินอื่น · ของกรรมนี้ ${x.amt}` : x.ov > 0.005 ? x.ov : ""), s: (x) => (flMix(x) ? 0 : x.ov || 0) }, { k: "bal", lab: "คงเหลือหลังรายการ", sh: "คงเหลือ", n: 1, f: (x) => (x.bal == null ? "" : x.typ === "L" ? `<span class="muted" title="ยอดคงเหลือ ณ รายการสุดท้ายของข้อมูล">${B(x.bal)}</span>` : B(x.bal)), v: (x) => (x.bal == null ? "" : x.bal) },
    { k: "dw", lab: "ค้างในบัญชีก่อนออก", sh: "ค้างนาน", n: 1, f: (x) => flDw(x.dw), v: (x) => (x.dw == null ? "" : x.dw) },
    { k: "tk", lab: "ติดตามต่อ (สถานะ · งาน)", sh: "ติดตามต่อ", f: (x) => (x.aux ? "" : tkCell(x)), v: (x) => (x.aux ? "" : tkTxt(x)) }];
  const openT = new Set();
  const hopTbl = (host, title, rows, note, aug) => { const R = aug ? flAug(rows) : rows;
    const t = table(host, { title, note: note || (aug && R.length > rows.length ? "แถวสีเทา = เงินเข้าบัญชี (รับเงินกรรมนี้ / เงินอื่นที่เข้าระหว่างที่นำเงินกรรมนี้ออก) ไม่นับในยอดรวม · “คงเหลือ” = ยอดคงเหลือหลังรายการนั้น ตามไฟล์ธนาคาร · “ต่ำสุดหลังรับ” = เงินกรรมนี้เหลือในบัญชีได้ไม่เกินยอดนี้" : undefined),
      rows: () => R, sort: "t", desc: false, csvName: "เส้นทางเงิน", lead: false, max: 900, cols: hopCols, rowCls: (x) => (x.aux ? "aux" : ""),
      cnt: (r) => { const a = r.filter((x) => x.aux).length; return a ? `${nf(r.length - a)} รายการ + แถวเงินเข้า ${nf(a)}` : `${nf(r.length)} รายการ`; },
      total: (r) => `รวม ${B(r.filter((x) => !x.aux).reduce((s, x) => s + x.amt, 0))} บาท` }); openT.add(t); return t; };

  /* ---- 1) ตามกรรม ---- */
  /* ผัง: กรรมที่เลือก (FLX.sel) -> SVG ; แตะกล่องในผัง = รายการของบัญชี/ปลายทางนั้น */
  const CLx = CL.filter(flIsCl);
  const kOfCl = (c) => K.filter((k) => c.accs.includes(k.l1)).map((k) => k.k);
  let curG = null;
  const fcKey = () => [...FLX.sel].sort((a, b) => a - b).join(",") + "|" + !!FLX.split + "|" + (!!FLX.mdup), fcLab = () => (FLX.only ? FLX.only.label : FLX.label);
  const selKey = () => [...FLX.sel].sort((a, b) => a - b).join(",");
  const prevUpd = () => { if (FLX.prevSel && FLX.prevSel.key !== selKey()) FLX.prevSel = null; const b = $("#fcPrev"); b.hidden = !FLX.prevSel; if (FLX.prevSel) b.textContent = `← กลับชุดกรรมเดิม (${FLX.prevSel.sel.length} กรรม)`; };
  const buildG = () => { let g = flGraph(F, HO, FLX.sel, FLX.split, { mergeDup: !!FLX.mdup });
    if (FLX.only && FLX.only.key !== fcKey()) FLX.only = null;
    if (FLX.only) g = flPrune(g, new Set(FLX.only.n), new Set(FLX.only.e));
    g.byId = new Map(g.nodes.map((n) => [n.id, n])); return g; };
  /* คืนการเน้น (กล่อง/เส้นที่เลือก) เฉพาะที่ยังอยู่ในผังปัจจุบัน */
  const hlRestore = (h) => { if (!h || !curG) return; const es = new Set(curG.edges.map((q) => q.a + ">" + q.b));
    FLX.hl = { n: new Set(h.n.filter((id) => curG.byId.has(id))), e: new Set(h.e.filter((id) => es.has(id))) }; hlApply(); };
  const fcDraw = () => {
    const S = FLX.sel, has = S.size > 0;
    $("#fcPng").disabled = $("#fcRep").disabled = $("#fcClr").disabled = $("#fcFit").disabled = $("#fcZo").disabled = $("#fcZi").disabled = $("#fcZr").disabled = !has; $("#fcDet").innerHTML = "";
    FLX.hl = { n: new Set(), e: new Set() }; FLX.hlH = []; FLX.hlF = []; FLX.zoom = null; $("#fcSelBar").hidden = !has; $("#fcTip").hidden = true;
    prevUpd();
    $("#fcMdup").hidden = !(S.size === 1 || (FLX.split && S.size > 1)); $("#fcMdup").classList.toggle("on", !!FLX.mdup); $("#fcMdup").textContent = !!FLX.mdup ? "✓ รวมกล่องซ้ำ" : "รวมกล่องซ้ำ";
    $("#fcSplit").disabled = $("#fcOver").disabled = S.size < 2; $("#fcSplit").classList.toggle("on", has && (!!FLX.split || S.size === 1)); $("#fcOver").classList.toggle("on", !FLX.split && S.size > 1);
    $("#fcTitle").textContent = has ? `ผังเส้นทางเงิน · ${FLX.label}` : "ผังเส้นทางเงิน";
    if (!has) { curG = null; $("#fcWrap").classList.remove("fit"); $("#fcWrap").innerHTML = `<p class="note" id="fcHint">เลือกกรรมจากตารางด้านบน หรือเลือกทั้งคอกจาก "เลือกเร็ว…"</p>`; return; }
    curG = buildG();
    $("#fcFull").hidden = !FLX.only; if (FLX.only) $("#fcTitle").textContent = `ผังเส้นทางเงิน · ${FLX.only.label}`;
    $("#fcWrap").classList.remove("fit");
    $("#fcWrap").innerHTML = flSvg(curG, fcLab()) + (curG.nodes.length > 40 ? `<p class="note">ผังนี้มี ${nf(curG.nodes.length)} กล่อง — เลื่อนดูได้ทั้งแนวตั้งและแนวนอน ; ทุกบัญชี/ทุกจุดแยกกล่อง</p>` : "");
    zoomApply(); hlApply();
    if (FLX.pendHl) { const key = FLX.pendHl, ids = curG.nodes.filter((n) => nodeItem(n) === key).map((n) => n.id); FLX.pendHl = null; if (ids.length) { FLX.hl = { n: new Set(ids), e: new Set() }; hlApply(); } }
  };
  /* ---- ซูม ---- */
  const zoomApply = () => { const sv = $("#fcWrap svg"); if (!sv) return; const W = +sv.getAttribute("width"), Hh = +sv.getAttribute("height"), cw = $("#fcWrap").clientWidth || W;
    if (FLX.zoom == null) FLX.zoom = cw / W >= 0.7 ? Math.min(1, cw / W) : 1;      // อัตโนมัติ: พอดีจอเมื่อย่อไม่เกิน 30%
    sv.style.width = W * FLX.zoom + "px"; sv.style.height = Hh * FLX.zoom + "px"; $("#fcZr").textContent = Math.round(FLX.zoom * 100) + "%"; };
  const zoomTo = (z, cx, cy) => { const w = $("#fcWrap"), sv = $("svg", w); if (!sv) return; const old = FLX.zoom || 1, r = w.getBoundingClientRect();
    z = Math.max(0.15, Math.min(3, z)); const px = cx == null ? w.clientWidth / 2 : cx - r.left, py = cy == null ? w.clientHeight / 2 : cy - r.top;
    const ax = (w.scrollLeft + px) / old, ay = (w.scrollTop + py) / old; FLX.zoom = z; zoomApply(); w.scrollLeft = ax * z - px; w.scrollTop = ay * z - py; };
  /* ---- เลือกกล่อง/เส้นในผัง -> เน้นเส้นทาง (ต้นน้ำ+ปลายน้ำ) และตารางแสดงเฉพาะรายการบนเส้นที่เลือก ---- */
  const hlCalc = () => { const S = FLX.hl, on = new Set(), eon = new Set(), dn = new Set(), ins = new Map(), outs = new Map();
    curG.edges.forEach((e) => { const id = e.a + ">" + e.b; if (!ins.has(e.b)) ins.set(e.b, []); ins.get(e.b).push([id, e.a]); if (!outs.has(e.a)) outs.set(e.a, []); outs.get(e.a).push([id, e.b]); });
    const vu = new Set(), up = (x) => { if (vu.has(x)) return; vu.add(x); on.add(x); (ins.get(x) || []).forEach(([id, a]) => { eon.add(id); up(a); }); };
    const down = (x) => { if (dn.has(x)) return; dn.add(x); on.add(x); (outs.get(x) || []).forEach(([id, b]) => { eon.add(id); down(b); }); };
    S.n.forEach((x) => { up(x); down(x); });
    S.e.forEach((id) => { const e = curG.edges.find((q) => q.a + ">" + q.b === id); if (!e) return; eon.add(id); up(e.a); down(e.b); });
    return { on, eon, dn }; };
  const hlName = (id) => { const n = curG.byId.get(id); return n ? (n.kind === "V" ? "ผู้เสียหาย " + n.sub : n.title) : id; };
  const hlApply = () => { const sv = $("#fcWrap svg"); if (!sv || !curG) return; const S = FLX.hl, any = S.n.size + S.e.size > 0, { on, eon, dn } = hlCalc();
    sv.classList.toggle("hl", any);
    $$("[data-n]", sv).forEach((g) => { g.classList.toggle("on", on.has(g.dataset.n)); g.classList.toggle("sel", S.n.has(g.dataset.n)); });
    $$(".ed", sv).forEach((g) => { g.classList.toggle("on", eon.has(g.dataset.e)); g.classList.toggle("sel", S.e.has(g.dataset.e)); });
    $("#fcDup").disabled = !curG.nodes.some((n) => n.kind !== "C" && (n.occL || ((curG.multi || n.rep) && (n.kind === "A" || n.kind === "X") && n.ks.size >= 2)));
    $("#fcSub").disabled = !any;
    $("#fcUndo").disabled = !FLX.hlH.length; $("#fcRedo").disabled = !(FLX.hlF || []).length; $("#fcHlClr").disabled = !any;
    $("#fcSelInfo").innerHTML = any ? `เลือก <b>${S.n.size}</b> กล่อง · <b>${S.e.size}</b> เส้น — ตารางด้านล่างแสดงเฉพาะรายการบนเส้นทางที่เลือก` : ""; pickUpd(S);
    const rows = any ? curG.H.filter((h) => eon.has(curG.he.get(h)) || (h.typ === "L" && dn.has(curG.hn.get(h)))) : curG.H;
    const sel = [...S.n].map(hlName).concat([...S.e].map((id) => { const [a, b] = [id.slice(0, id.indexOf(">")), id.slice(id.indexOf(">") + 1)]; return `${hlName(a)} → ${hlName(b)}`; }));
    const one = S.n.size === 1 && !S.e.size ? curG.byId.get([...S.n][0]) : null;
    const ttl = any ? `รายการบนเส้นทางที่เลือก · ${esc(fcCut(sel.join(" · "), 90))}${one && one.kind === "A" && one.has ? ` <a class="cmpl" href="#acc/${one.o}">ดูบัญชี</a>` : ""}` : `รายการเดินเงินทั้งหมดในผัง · ${esc(FLX.label)}`;
    if (!rows.length) { const tks = [...S.n].flatMap((id) => [...((curG.byId.get(id) || {}).rcs || [])]).map((r) => tkBy.get(r)).filter(Boolean);
      $("#fcDet").innerHTML = `<p class="note">${ttl} — ไม่มีรายการเดินเงิน${tks.length ? " · " + tks.map((t) => `${flStHtml(t)} ${flTkIc(t)}${esc(flMiss(t))} <a href="#" class="cmpl" data-go="${esc(t.rc)}">ขอข้อมูล ›</a>`).join("<br>") : ""}</p>`; return; }
    hopTbl($("#fcDet"), ttl, rows, "", true); };
  const hlPush = (keep) => { if (!keep) FLX.hlF = []; FLX.hlH.push({ n: [...FLX.hl.n], e: [...FLX.hl.e] }); if (FLX.hlH.length > 60) FLX.hlH.shift(); };
  /* ---- ทูลทิป ---- */
  const tipTasks = (n) => [...(n.rcs || [])].map((r) => tkBy.get(r)).filter(Boolean).map((t) => `<div class="tt">${flTkIc(t)}<b>${esc(FL_ACT[flActOf(t)][0])}</b> · ${esc(flStTxt(t))}<br><span class="miss">ขาด: ${esc(flMiss(t))}</span></div>`).join("");
  const tipHtml = (el) => {
    if (el.dataset.tk != null) { const n = curG.byId.get(el.dataset.tk); return n ? `<b>${esc(n.title)}</b> <small>${esc(n.sub || "")}</small>${tipTasks(n) || '<div class="tt">งานติดตามของกล่องนี้เสร็จแล้ว</div>'}<div class="th">แตะเพื่ออัปเดตสถานะ / แก้ไข</div>` : ""; }
    if (el.dataset.n != null) { const n = curG.byId.get(el.dataset.n); if (!n) return "";
      const ein = curG.edges.filter((e) => e.b === n.id).sort((a, b) => b.amt - a.amt), eout = curG.edges.filter((e) => e.a === n.id).sort((a, b) => b.amt - a.amt);
      const li = (e, o) => { const x = curG.byId.get(o); return `<li>${esc(x ? (x.kind === "V" ? "ผู้เสียหาย " + x.sub : x.title + " · " + x.sub) : o)} — <b>${B(e.amt)}</b>${e.n > 1 ? ` (${e.n} ครั้ง)` : ""} <small>${esc(fcT(e.t0, e.t1, e.n))}</small></li>`; };
      return `<b>${esc(n.kind === "V" ? "ผู้เสียหาย " + n.sub : n.title)}</b> <small>${esc(n.kind === "V" ? "" : n.sub || "")}</small>${n.roleT ? `<div class="tt">▣ ${esc(n.roleT)}</div>` : ""}<div class="tt">กรรมที่ ${esc(fcKs(n.ks))}</div>${n.occL ? `<div class="tt dupt"><b>⟳ ${esc(fcOccHead(n))}</b>${fcOccLines(n).map((l) => `<div class="ol">${esc(l)}</div>`).join("")}</div>` : ""}${(n.kind === "A" || n.kind === "X") && n.o ? (() => { const t_ = dupTxt(dupOf(n.o, n.kind === "A" ? n.title : n.pn, n.ks)); return t_ ? `<div class="tt dupt">${esc(t_)}</div>` : ""; })() : ""}` +
        (ein.length ? `<div class="th">รับเข้า ${nf(n.nin || ein.reduce((s, e) => s + e.n, 0))} ครั้ง รวม ${B(n.in)} บาท จาก</div><ul>${ein.slice(0, 10).map((e) => li(e, e.a)).join("")}${ein.length > 10 ? `<li>… อีก ${ein.length - 10} ราย</li>` : ""}</ul>` : "") +
        (eout.length ? `<div class="th">โอน/ถอนออก ${nf(eout.reduce((s, e) => s + e.n, 0))} ครั้ง รวม ${B(eout.reduce((s, e) => s + e.amt, 0))} บาท ไปที่</div><ul>${eout.slice(0, 10).map((e) => li(e, e.b)).join("")}${eout.length > 10 ? `<li>… อีก ${eout.length - 10} ราย</li>` : ""}</ul>` : "") +
        (n.left > 0.5 ? `<div class="tt">ยังค้างในบัญชี ${B(n.left)} บาท</div>` : "") + tipTasks(n) + `<div class="th">แตะ = เน้นกล่องนี้และกล่องที่ซ้ำ · แถบสีม่วง = กรรมที่พบทั้งคดี</div>`; }
    if (el.dataset.e != null) { const id = el.dataset.e, e = curG.edges.find((q) => q.a + ">" + q.b === id); if (!e) return ""; const ks = new Set(curG.H.filter((h) => curG.he.get(h) === id).map((h) => h.k));
      return `<b>${esc(hlName(e.a))}</b> → <b>${esc(hlName(e.b))}</b><div class="tt">${esc(e.typ === "S" ? "ผู้เสียหายโอนเข้าบัญชีแถวแรก" : (e.typ === "O" ? hlName(e.b) : FL_T[e.typ]) || "")}</div><div class="tt"><b>${B(e.amt)}</b> บาท · ${e.n} ครั้ง · ${esc(fcT(e.t0, e.t1, e.n))}</div>${ks.size ? `<div class="tt">กรรมที่ ${esc(fcKs(ks))}</div>` : ""}<div class="th">แตะ = เลือก/เน้นเส้นนี้</div>`; }
    return ""; };
  const tip = () => $("#fcTip");
  const tipPos = (ev) => { const t = tip(), w = t.offsetWidth, h = t.offsetHeight; let x = ev.clientX + 16, y = ev.clientY + 16; if (x + w > innerWidth - 8) x = Math.max(8, ev.clientX - w - 12); if (y + h > innerHeight - 8) y = Math.max(8, ev.clientY - h - 12); t.style.left = x + "px"; t.style.top = y + "px"; };
  const tipShow = (ev, el) => { const t = tip(), h = tipHtml(el); if (!h) { t.hidden = true; return; } if (t._el !== el) { t.innerHTML = h; t._el = el; } t.hidden = false; tipPos(ev); };
  /* วาดผังซ้ำโดยไม่ปิดรายการย่อยใต้ผัง (หลังเปลี่ยนสถานะ/แก้ไขปลายทาง) */
  const fcPaint = () => { const w = $("#fcWrap"), old = $("svg", w); if (!FLX.sel.size || !old) return; const sl = w.scrollLeft, st = w.scrollTop; curG = buildG(); old.outerHTML = flSvg(curG, fcLab()); zoomApply(); hlApply(); w.scrollLeft = sl; w.scrollTop = st; };
  const fcSet = (ks, label) => { FLX.sel = new Set(ks); FLX.label = label; fcDraw(); if (kt) kt.draw(); };
  const fcLabel = () => { const a = [...FLX.sel].sort((x, y) => x - y); return a.length === 1 ? `กรรมที่ ${a[0]}` : `${a.length} กรรม (ที่ ${a.slice(0, 8).join(", ")}${a.length > 8 ? " …" : ""})`; };
  $("#fcQuick").innerHTML = `<option value="">เลือกเร็ว…</option><option value="t">กรรมที่แสดงในตาราง (ตามตัวกรอง)</option><option value="s">กรรมที่ใช้บัญชีร่วมกัน · ${flShared(null).length} กรรม</option>` +
    CLx.map((c) => { const n = kOfCl(c).length; return n ? `<option value="c${c.id}">คอก ${c.id} · ${n} กรรม · ${c.n} บัญชี</option>` : ""; }).join("") +
    [...new Map(K.map((k) => [k.l1, k])).values()].filter((k) => K.filter((x) => x.l1 === k.l1).length > 1).map((k) => `<option value="a${k.l1}">บัญชี ${esc(k.l1name.slice(0, 26))} · ${K.filter((x) => x.l1 === k.l1).length} กรรม</option>`).join("");
  $("#fcQuick").addEventListener("change", (e) => { const v = e.target.value; e.target.value = ""; if (!v) return;
    const prev = { sel: [...FLX.sel].sort((a, b) => a - b), label: FLX.label, split: FLX.split };
    if (v === "t") { const r = kt.rows(); if (r.length > 40 && !confirm(`รวม ${r.length} กรรมในผังเดียว ผังจะใหญ่มาก ทำต่อหรือไม่?`)) return; fcSet(r.map((k) => k.k), `${r.length} กรรม (ตามตัวกรองในตาราง)`); }
    else if (v === "s") { const ks = flShared(null); if (ks.length > 40 && !confirm(`รวม ${ks.length} กรรมในผังเดียว ผังจะใหญ่มาก ทำต่อหรือไม่?`)) return; FLX.split = true; fcSet(ks, `${ks.length} กรรมที่ใช้บัญชีร่วมกัน`); setTimeout(() => { if (curG && dupIds().length) { $("#fcDup").click(); toast(`เลือก ${ks.length} กรรมที่ใช้บัญชีร่วมกัน และเน้นบัญชีที่ซ้ำแล้ว — กด "⧉ แยกเป็นผังใหม่" เพื่อแสดงเฉพาะเส้นเงินนี้`); } }, 300); }
    else if (v[0] === "c") { const c = CL.find((x) => "c" + x.id === v); fcSet(kOfCl(c), `คอก ${c.id} · ${kOfCl(c).length} กรรม`); }
    else { const o = v.slice(1), ks = K.filter((k) => k.l1 === o); fcSet(ks.map((k) => k.k), `บัญชีแถวแรก ${ks[0].l1name} · ${ks.length} กรรม`); }
    if (prev.sel.length && prev.sel.join(",") !== selKey()) { FLX.prevSel = Object.assign(prev, { key: selKey() }); prevUpd(); }
    crumb(); $("#fcBox").scrollIntoView({ behavior: "smooth", block: "start" }); });
  $("#fcPrev").addEventListener("click", () => { const p = FLX.prevSel; if (!p) return; FLX.prevSel = null; FLX.split = p.split; fcSet(p.sel, p.label); crumb(); toast(`กลับชุดกรรมเดิมแล้ว: ${p.sel.length} กรรม`); });
  $("#fcClr").addEventListener("click", () => { fcSet([], ""); crumb(); });
  $("#fcPick").addEventListener("click", (e) => { const b = e.target.closest("[data-pk]"), o = b && ITX.get(FLX.pickItem); if (!o) return; const ks = [...o.occ.keys()].sort((a, b) => a - b);
    if (b.dataset.pk === "one" || b.dataset.pk === "all") { const grp = curG.nodes.filter((m) => nodeItem(m) === o.key).map((m) => m.id), one = grp.includes(FLX.tap) ? FLX.tap : grp[0];
      hlPush(); FLX.hl = { n: new Set(b.dataset.pk === "one" ? [one] : grp), e: new Set() }; hlApply(); return; }
    if (ks.join(",") !== selKey()) { if (ks.length > 40 && !confirm(`รวม ${ks.length} กรรมในผังเดียว ผังจะใหญ่มาก ทำต่อหรือไม่?`)) return;
      const prev = { sel: [...FLX.sel].sort((a, b) => a - b), label: FLX.label, split: FLX.split };
      FLX.split = true; FLX.only = null; FLX.pendHl = o.key; fcSet(ks, `${ks.length} กรรมที่พบ${TYL[o.type]} ${fcCut(o.name, 40)}`);
      if (prev.sel.length) { FLX.prevSel = Object.assign(prev, { key: selKey() }); prevUpd(); } crumb(); }
    FLX.focusItem = o.key; FLX.focusSel = selKey();
    if (b.dataset.pk === "r") setTimeout(() => $("#fcRep").click(), 30); else $("#fcBox").scrollIntoView({ behavior: "smooth", block: "start" }); });
  { const [m0, t0] = String(F.cur || F.def || "v:1").split(":"); $("#flMode").value = m0; $("#flTol").value = t0;
    const chg = () => { flVarSet($("#flMode").value + ":" + $("#flTol").value); FLX.y = window.scrollY; render(); toast("วิธีนับเงิน: " + flVarLab().replace(/^[^·]*· /, "")); };
    $("#flMode").addEventListener("change", chg); $("#flTol").addEventListener("change", chg); }
  $("#fcSplit").addEventListener("click", () => { if (FLX.split) return; FLX.split = true; fcDraw(); });
  $("#fcOver").addEventListener("click", () => { if (!FLX.split) return; FLX.split = false; fcDraw(); });
  $("#fcMdup").addEventListener("click", () => { FLX.mdup = !FLX.mdup; fcDraw(); toast(FLX.mdup ? `รวมกล่องที่ซ้ำเป็นกล่องเดียว: ${curG ? curG.nrep - curG.nrepC : 0} บัญชี · ${curG ? curG.nrepC : 0} จุดถอนเงินสด` : "แยกกล่องบัญชี/จุดถอนรายครั้ง (ดูป้าย ⟳ i/N)"); });
  $("#fcZo").addEventListener("click", () => zoomTo((FLX.zoom || 1) / 1.25));
  $("#fcZi").addEventListener("click", () => zoomTo((FLX.zoom || 1) * 1.25));
  $("#fcZr").addEventListener("click", () => zoomTo(1));
  $("#fcWrap").addEventListener("wheel", (e) => { if (!(e.ctrlKey || e.metaKey) || !$("#fcWrap svg")) return; e.preventDefault(); zoomTo((FLX.zoom || 1) * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY); }, { passive: false });
  $("#fcUndo").addEventListener("click", () => { const p = FLX.hlH.pop(); if (!p) return; (FLX.hlF = FLX.hlF || []).push({ n: [...FLX.hl.n], e: [...FLX.hl.e] }); FLX.hl = { n: new Set(p.n), e: new Set(p.e) }; hlApply(); });
  $("#fcRedo").addEventListener("click", () => { const p = (FLX.hlF || []).pop(); if (!p) return; hlPush(true); FLX.hl = { n: new Set(p.n), e: new Set(p.e) }; hlApply(); });
  const dupIds = () => curG.nodes.filter((n) => n.kind !== "C" && (n.occL || ((curG.multi || n.rep) && (n.kind === "A" || n.kind === "X") && n.ks.size >= 2)));
  $("#fcDup").addEventListener("click", () => { if (!curG) return; const ns = dupIds(); if (!ns.length) return toast("ในผังนี้ไม่มีบัญชีที่ซ้ำกัน — ลองกดแบบ \"แยกตามกรรม\"");
    hlPush(); FLX.hl = { n: new Set(ns.map((n) => n.id)), e: new Set() }; hlApply(); toast(`เน้น ${ns.length} กล่อง ของ ${new Set(ns.map((n) => n.o)).size} บัญชีที่ซ้ำกัน`); });
  $("#fcSub").addEventListener("click", () => { if (!curG) return; const S = FLX.hl; if (!S.n.size && !S.e.size) return; const { on, eon } = hlCalc();
    const dup = dupIds().map((n) => n.id), isDup = dup.length && S.n.size === dup.length && dup.every((id) => S.n.has(id));
    let keepN = on, keepE = eon;
    if (isDup) { const ins = new Map(); curG.edges.forEach((e) => { if (!ins.has(e.b)) ins.set(e.b, []); ins.get(e.b).push(e); }); keepN = new Set(); keepE = new Set();
      const st_ = [...S.n]; while (st_.length) { const x = st_.pop(); if (keepN.has(x)) continue; keepN.add(x); (ins.get(x) || []).forEach((e) => { keepE.add(e.a + ">" + e.b); st_.push(e.a); }); } }
    const keepHl = { n: [...S.n], e: [...S.e] }, nFull = curG.nodes.length;
    FLX.only = { key: fcKey(), hl: keepHl, n: [...keepN], e: [...keepE], label: `${FLX.label} · ${isDup ? "เส้นเงินเข้าบัญชีที่ใช้ร่วมกัน" : "เฉพาะส่วนที่เลือก"} (${keepN.size} กล่อง)` }; fcDraw(); hlRestore(keepHl);
    document.querySelector("#fcBox").scrollIntoView({ block: "start" }); toast(`แยกเป็นผังใหม่: ${nf(curG.nodes.length)} จาก ${nf(nFull)} กล่อง · กล่องที่เลือกไว้มีกรอบสีทอง — กด "← กลับผังเต็ม" เพื่อกลับ`); });
  $("#fcFull").addEventListener("click", () => { const h = FLX.only && FLX.only.hl, n0 = curG ? curG.nodes.length : 0; FLX.only = null; fcDraw(); hlRestore(h);
    toast(`กลับผังเต็มแล้ว: ${nf(n0)} → ${nf(curG.nodes.length)} กล่อง${h ? " · ยังเน้นส่วนที่เลือกไว้ (กด \"ล้างที่เน้น\" เพื่อดูทั้งหมด)" : ""}`); });
  $("#fcHlClr").addEventListener("click", () => { hlPush(); FLX.hl = { n: new Set(), e: new Set() }; hlApply(); });
  const multiUpd = () => { const b = $("#fcMulti"); b.classList.toggle("on", !!FLX.multi); b.setAttribute("aria-pressed", FLX.multi ? "true" : "false"); b.textContent = FLX.multi ? "✓ เลือกหลายกล่อง" : "＋ เลือกหลายกล่อง"; };
  $("#fcMulti").addEventListener("click", () => { FLX.multi = !FLX.multi; multiUpd(); toast(FLX.multi ? "เลือกหลายกล่อง: แตะกล่อง/เส้นเพื่อเพิ่มหรือเอาออกทีละรายการ" : "แตะกล่องเดียว = เลือกกล่องนั้นพร้อมกล่องที่ซ้ำกันในผัง"); }); multiUpd();
  $("#fcMin").addEventListener("change", (e) => { const v = +e.target.value; e.target.value = ""; if (!v || !curG) return;
    const ids = curG.nodes.filter((n) => (n.kind === "A" || n.kind === "X") && n.nin >= v).map((n) => n.id);
    if (!ids.length) return toast(`ในผังนี้ไม่มีบัญชีที่รับเข้า ≥ ${v} ครั้ง`);
    hlPush(); FLX.hl = { n: new Set(ids), e: new Set() }; hlApply(); toast(`เน้น ${ids.length} บัญชีที่รับเข้า ≥ ${v} ครั้ง`); });
  $("#fcWrap").addEventListener("mousemove", (e) => { if (!curG) return; const el = e.target.closest("[data-tk],[data-n],[data-e]"); if (!el) { tip().hidden = true; tip()._el = null; return; } tipShow(e, el); });
  $("#fcWrap").addEventListener("mouseleave", () => { tip().hidden = true; tip()._el = null; });
  $("#fcWrap").addEventListener("scroll", () => { tip().hidden = true; tip()._el = null; });
  /* แตะ ! ในผัง -> อัปเดตสถานะงาน (กล่องที่มีหลายงานให้เลือกงานก่อน) */
  const tkOpen = (id) => { const n = curG.byId.get(id); const ts = n ? [...n.rcs].map((r) => tkBy.get(r)).filter(Boolean) : []; if (!ts.length) return;
    if (ts.length === 1) return flEdit(ts[0], refresh);
    const d = document.createElement("dialog"); d.className = "fdlg";
    d.innerHTML = `<form method="dialog"><h3>เลือกงานที่จะอัปเดต</h3><p class="note"><b>${esc(n.title)}</b> มี ${ts.length} งาน</p>${ts.map((t, i) => `<button class="tb tkpick" value="${i}">${flTkIc(t)}<b>${esc(FL_ACT[flActOf(t)][0])}</b> · ${esc(flStTxt(t))}<br><small>${esc(fcCut(flTkName(t), 70))} · ${B(t.amt)} บาท</small></button>`).join("")}<menu><button value="cancel" class="tb">ปิด</button></menu></form>`;
    document.body.appendChild(d); d.addEventListener("close", () => { const i = d.returnValue; d.remove(); if (i !== "" && i !== "cancel" && ts[+i]) flEdit(ts[+i], refresh); }); d.showModal(); };
  $("#fcFit").addEventListener("click", () => { const sv = $("#fcWrap svg"); if (sv) zoomTo(($("#fcWrap").clientWidth - 2) / +sv.getAttribute("width")); });
  /* ผังฉบับเต็มสำหรับบันทึกภาพ/รายงาน (ชื่อและเลขบัญชีไม่ถูกตัด) คงการเน้นเส้นทางที่เลือกไว้ */
  const fullSvg = (prn) => { const d = document.createElement("div"); d.innerHTML = flSvg(curG, fcLab(), { full: true, print: !!prn }); const sv = d.firstElementChild, S = FLX.hl;
    if (S && S.n.size + S.e.size) { const { on, eon } = hlCalc(); sv.classList.add("hl");
      $$("[data-n]", sv).forEach((g) => { g.classList.toggle("on", on.has(g.dataset.n)); g.classList.toggle("sel", S.n.has(g.dataset.n)); });
      $$(".ed", sv).forEach((g) => { g.classList.toggle("on", eon.has(g.dataset.e)); g.classList.toggle("sel", S.e.has(g.dataset.e)); }); }
    return sv; };
  $("#fcPng").addEventListener("click", () => { const sv = curG && fullSvg(); if (sv) flSavePng(sv, "เส้นทางเงิน_" + FLX.label.replace(/[\\/:*?"<>|·]/g, "").replace(/\s+/g, "_").slice(0, 60)); });
  $("#fcRep").addEventListener("click", () => { if (!curG) return; flReport(F, curG, fullSvg(true).outerHTML, fcLab(), { rep: repItems() }); fcPaint(); });
  $("#fcWrap").addEventListener("click", (e) => { if (!curG) return;
    const tk = e.target.closest("[data-tk]"); if (tk) { e.stopPropagation(); tip().hidden = true; return tkOpen(tk.dataset.tk); }
    const g = e.target.closest("[data-n]"), ed = g ? null : e.target.closest("[data-e]"); if (!g && !ed) return;
    if (g && e.target.closest(".occ")) { const n = curG.byId.get(g.dataset.n); if (n && n.occL) { hlPush(); FLX.hl = { n: new Set(n.occL.map((o) => o.id)), e: new Set() }; hlApply(); toast(fcOccTxt(n)); return; } }
    hlPush(); const S = FLX.hl, id = (g || ed).dataset[g ? "n" : "e"];
    if (FLX.multi || e.ctrlKey || e.metaKey || e.shiftKey) { const set = g ? S.n : S.e; if (set.has(id)) set.delete(id); else set.add(id); }
    else if (g) { const key = nodeItem(curG.byId.get(id)), grp = key ? curG.nodes.filter((m) => nodeItem(m) === key).map((m) => m.id) : [id];
      const cur = [...S.n].sort().join("|"), want = grp.slice().sort().join("|"); FLX.tap = id;
      FLX.hl = !S.e.size && (cur === want || (S.n.size === 1 && S.n.has(id))) ? { n: new Set(), e: new Set() } : { n: new Set(grp), e: new Set() }; }
    else FLX.hl = S.e.size === 1 && S.e.has(id) && !S.n.size ? { n: new Set(), e: new Set() } : { n: new Set(), e: new Set([id]) };
    hlApply();
    if (matchMedia("(hover: none)").matches) { tipShow(e, g || ed); clearTimeout(tip().t); tip().t = setTimeout(() => (tip().hidden = true), 6000); } });

  const RS = new Map(), calcRes = () => K.forEach((k) => RS.set(k.k, flRes(k, HO))); calcRes();
  const resBar = (x) => { if (!x.has || x.st !== "พบในบัญชีแถวแรก") return ""; const a = x.amt || 1, seg = [[x.cash + x.back, "#B3261E"], [x.ext, "#E08A00"], [x.oth + x.left, "#90A4AE"]];
    return `<span class="rbar">${seg.filter((s) => s[0] > 0).map((s) => `<i style="width:${Math.min(100, s[0] / a * 100).toFixed(1)}%;background:${s[1]}"></i>`).join("")}</span>`; };
  const kt = table($("#flK"), { title: "เลือกกรรม", sub: "แตะแถว = ดูผังของกรรมนั้น (ถ้าเลือกไว้หลายกรรม = เพิ่มเข้าผัง) · แตะแถวที่เลือกอยู่ = เอาออก · ช่องติ๊กบนหัวคอลัมน์ = เลือก/ยกเลิกทั้งหมด · เลขกรรมเรียงตามวันเวลาที่โอน (เลขแถวเดิมในไฟล์ผู้เสียหายอยู่ในไฟล์ Excel ที่ส่งออก)", rows: () => K, sort: "k", desc: false, csvName: "กรรม_เส้นทางเงิน", lead: false, max: 300,
    cols: [{ k: "sel", bare: 1, c: 1, get lab() { let r; try { r = kt.rows(); } catch (e) { r = K; } const n = r.filter((k) => FLX.sel.has(k.k)).length; return `<input type="checkbox" data-kall ${r.length && n === r.length ? "checked" : ""} title="${n === r.length ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"} (ตามตัวกรองในตาราง)" aria-label="เลือก/ยกเลิกทั้งหมด"> ${n ? `<small>${n}</small>` : ""}`; }, f: (x) => `<input type="checkbox" data-kk="${x.k}" ${FLX.sel.has(x.k) ? "checked" : ""} aria-label="เลือกกรรมที่ ${x.k}">`, v: (x) => (FLX.sel.has(x.k) ? "เลือก" : "") }, { k: "k", lab: "กรรม", c: 1 }, { k: "row", hide: 1, lab: "แถวในไฟล์ผู้เสียหาย", n: 1, v: (x) => (x.row == null ? "" : x.row) }, { k: "t", lab: "วันเวลา", f: (x) => dtTh(x.t), date: (x) => x.t }, { k: "amt", lab: "ยอด", n: 1, f: (x) => B(x.amt) },
      { k: "l1name", lab: "บัญชีแถวแรก", f: (x) => (x.has ? flAcc(x.l1) : av(x.l1name) + esc(x.l1name)) + dupHtml(dupOf(x.l1acc, x.l1name, new Set([x.k]))), v: (x) => x.l1name }, { k: "dup", hide: 1, lab: "ซ้ำกับกรรมอื่น", v: (x) => dupTxt(dupOf(x.l1acc, x.l1name, new Set([x.k]))) }, { k: "l1acc", lab: "ธนาคาร / เลขบัญชี", sh: "เลขบัญชี", f: (x) => `${bankIco(x.l1bank)}${esc(x.l1bank)} ${esc(x.l1acc)}`, v: (x) => `${x.l1bank} ${x.l1acc}` },
      { k: "st", hide: 1, lab: "สถานะ", f: (x) => (x.st === "พบในบัญชีแถวแรก" ? '<span class="rqs rqK">ติดตามได้</span>' : `<span class="rqs rqU">${esc(x.st)}</span>`), v: (x) => x.st },
      { k: "res", lab: "ผลการไล่", w: 1, f: (x) => { const r = RS.get(x.k), sh = r.c === "e" ? "สุดสาย" : r.c === "m" ? `ถึงปลายทาง ${nf(r.pe, 0)}%` : r.c === "o" ? "ต้องไล่ต่อ" : "ไม่มี STM"; return `<span class="flres r${r.c}" title="${esc(r.t)}">${r.ic} ${sh}</span>${resBar(x)}`; }, v: (x) => RS.get(x.k).t, s: (x) => RS.get(x.k).pe },
      { k: "lay", lab: "ไล่ได้", n: 1, f: (x) => { const r = RS.get(x.k); return r.lay ? `<b>${r.lay}</b> แถว` : '<span class="muted">0</span>'; }, v: (x) => RS.get(x.k).lay },
      { k: "pe", hide: 1, lab: "ถึงปลายทางแล้ว %", n: 1, f: (x) => (x.has && x.st === "พบในบัญชีแถวแรก" ? nf(RS.get(x.k).pe, 0) + "%" : ""), v: (x) => Math.round(RS.get(x.k).pe * 10) / 10 },
      { k: "tk", lab: "งาน", f: (x) => progHtml(x.k), v: (x) => { const p = kProg(x.k); return p.n ? `${p.dn}/${p.n}${p.q ? ` รอผล ${p.q}` : ""}` : ""; }, s: (x) => { const p = kProg(x.k); return p.n ? p.dn / p.n : -1; } },
      { k: "cf", hide: 1, lab: "ตรวจสอบรายการ", w: 1, v: (x) => x.cf || "" }, { k: "src", hide: 1, lab: "ที่มา", v: (x) => x.src || "" },
      { k: "cash", lab: "ถอนสด", n: 1, f: (x) => (x.cash ? B(x.cash) : "") }, { k: "ext", lab: "โอนต่อ", n: 1, f: (x) => (x.ext ? B(x.ext) : "") }, { k: "gap", lab: "เกิน/ปน/ค้าง", n: 1, f: flGapH, v: flGapT, s: (x) => (x.over || 0) - (x.mix || 0) - (x.left || 0) },
      { k: "left", hide: 1, lab: "ยังค้างในบัญชี", n: 1, f: (x) => (x.left ? B(x.left) : "") }, { k: "oth", hide: 1, lab: "อื่น ๆ", n: 1, f: (x) => (x.oth ? B(x.oth) : "") },
      { k: "first", hide: 1, lab: "ออกจากแถวแรกใน", n: 1, f: (x) => flDw(x.first), v: (x) => (x.first == null ? "" : x.first) }, 
      { k: "vacc", hide: 1, lab: "บัญชีผู้เสียหาย", v: (x) => `${x.vbank} ${x.vacc}` }],
    total: (r) => `โอน ${B(r.reduce((s, x) => s + x.amt, 0))} · ถอนสด ${B(r.reduce((s, x) => s + x.cash, 0))} · โอนต่อ ${B(r.reduce((s, x) => s + x.ext, 0))} บาท · 🏁 ไล่สุดสาย ${r.filter((x) => RS.get(x.k).c === "e").length} กรรม`,
    note: `🏁 = ไล่สุดสายแล้ว (เงิน ≥ เกณฑ์ที่เลือกถึงปลายทางที่ไล่ต่อไม่ได้ คือ ถอนเงินสด / คืนผู้เสียหาย / ค่าธรรมเนียม) · ◐ = ถึงปลายทางแล้วเกินครึ่ง · → = ส่วนใหญ่ยังต้องไล่ต่อ · ✕ = ยังไม่มี statement แถวแรก · <b>ไล่ได้ (แถว)</b> = จำนวนชั้นบัญชีที่มี statement และไล่ผ่านแล้ว · แถบสี = สัดส่วนปลายทาง (แดง ถอนสด · ส้ม โอนต่อ · เทา ไม่ระบุ/ค้าง)`,
    extra: `<button class="tb" id="flSelAll" title="เลือกทุกกรรมที่แสดงในตาราง (ตามตัวกรอง)">เลือกทั้งหมด</button><button class="tb" id="flSelNone" title="ยกเลิกการเลือกกรรมทั้งหมด">ยกเลิกที่เลือก</button><label class="rqr">เกณฑ์สุดสาย <select class="tin" id="flThr">${[70, 80, 90, 95, 99].map((v) => `<option value="${v}" ${v === FLX.thr ? "selected" : ""}>≥ ${v}%</option>`).join("")}</select></label>`,
    rowCls: (x) => "kr" + RS.get(x.k).c,
    click: (x, det) => {      // แตะแถวที่เลือกอยู่ = ยกเลิก ; เลือกไว้หลายกรรม = เพิ่ม ; ไม่ได้เลือก/เลือกกรรมเดียว = เปลี่ยนเป็นกรรมนี้
      if (FLX.sel.has(x.k)) { FLX.sel.delete(x.k); FLX.label = FLX.sel.size ? fcLabel() : ""; fcDraw(); crumb(); kt.draw(); toast(`ยกเลิกการเลือกกรรมที่ ${x.k}${FLX.sel.size ? ` (เหลือ ${FLX.sel.size} กรรม)` : ""}`); det.innerHTML = ""; return false; }
      if (FLX.sel.size > 1) { FLX.sel.add(x.k); FLX.label = fcLabel(); toast(`เพิ่มกรรมที่ ${x.k} เข้าผัง (รวม ${FLX.sel.size} กรรม) — แตะแถวที่เลือกอยู่เพื่อเอาออก`); }
      else { FLX.sel = new Set([x.k]); FLX.label = `กรรมที่ ${x.k}`; }
      fcDraw(); crumb(); $$("#flK [data-kk]").forEach((c) => (c.checked = FLX.sel.has(+c.dataset.kk)));
      const rows = HO.filter((h) => h.k === x.k).sort((a, b) => a.d - b.d || (a.t < b.t ? -1 : 1));
      if (!rows.length && FLX.sel.size === 1) { const t = tkBy.get(rqSafe(`บัญชี-${x.l1bank}-${x.l1acc}`));
        $("#fcDet").innerHTML = `<p class="note">${esc(x.st)} — ยังไล่เส้นทางเงินของกรรมนี้ไม่ได้ ${x.has ? "" : "(ต้องขอ statement ของ " + esc(x.l1bank + " " + x.l1acc + " " + x.l1name) + ")"}${t ? `<br>สถานะการขอ statement: ${flStHtml(t)} <a href="#" class="cmpl" data-go="${esc(t.rc)}">ขอข้อมูล ›</a>` : ""}</p>`; det.innerHTML = ""; return false; }
      det.innerHTML = ""; return false; } });      // รายการเดินเงินแสดงที่ตารางใต้ผัง (ตามที่เลือกในผัง) ที่เดียว

  $("#flK").addEventListener("change", (e) => { const all = e.target.closest("[data-kall]");
    if (all) { const r = kt.rows(); if (all.checked) { r.forEach((k) => FLX.sel.add(k.k)); toast(`เลือก ${FLX.sel.size} กรรม — ผังรวมหลายกรรมอาจใหญ่ ใช้ซูม/พอดีจอช่วยดู`); } else r.forEach((k) => FLX.sel.delete(k.k)); FLX.label = FLX.sel.size ? fcLabel() : ""; fcDraw(); kt.draw(); crumb(); return; }
    const c = e.target.closest("[data-kk]"); if (!c) return; const k = +c.dataset.kk; if (c.checked) FLX.sel.add(k); else FLX.sel.delete(k); FLX.label = FLX.sel.size ? fcLabel() : ""; fcDraw(); crumb();
    const h = $("#flK [data-kall]"); if (h) { const r = kt.rows(), n = r.filter((x) => FLX.sel.has(x.k)).length; h.checked = r.length > 0 && n === r.length; h.indeterminate = n > 0 && n < r.length; const sm = h.nextElementSibling; if (sm && sm.tagName === "SMALL") sm.textContent = n || ""; } });
  root.addEventListener("click", (e) => { const a = e.target.closest("[data-addk]"); if (!a) return; e.preventDefault(); e.stopPropagation(); const k = +a.dataset.addk;
    if (FLX.sel.has(k)) return toast(`กรรมที่ ${k} อยู่ในผังแล้ว`); FLX.sel.add(k); FLX.label = fcLabel(); fcDraw(); kt.draw(); crumb(); toast(`เพิ่มกรรมที่ ${k} เข้าผัง (รวม ${FLX.sel.size} กรรม)`); }, true);
  $("#flSelAll").addEventListener("click", () => { const r = kt.rows(); FLX.sel = new Set(r.map((k) => k.k)); if (r.length > 40) toast(`เลือก ${r.length} กรรม — ผังจะใหญ่ ใช้ซูม/พอดีจอช่วยดู`); FLX.label = fcLabel(); fcDraw(); kt.draw(); crumb(); });
  $("#flSelNone").addEventListener("click", () => { if (!FLX.sel.size) return toast("ยังไม่ได้เลือกกรรม"); FLX.sel = new Set(); FLX.label = ""; fcDraw(); kt.draw(); crumb(); toast("ยกเลิกการเลือกกรรมทั้งหมดแล้ว"); });
  $("#flThr").addEventListener("change", (e) => { FLX.thr = +e.target.value; calcRes(); kt.draw(); });
  FLX.sel = new Set([...FLX.sel].filter((k) => K.some((x) => x.k === k)));
  if (!FLX.init) { FLX.init = true; const k0 = K.filter((k) => HO.some((h) => h.k === k.k)).sort((a, b) => a.k - b.k)[0]; if (k0 && !FLX.sel.size) { FLX.sel = new Set([k0.k]); FLX.label = `กรรมที่ ${k0.k}`; kt.draw(); } }
  fcDraw();


  /* ---- 2) บัญชีม้า ---- */
  const tagB = (t) => `<span class="badge" style="background:${/แถวแรก/.test(t) ? "#FDE7E7;color:#B3261E" : /ถอนเงินสด/.test(t) ? "#F3E5F5;color:#6A1B9A" : /ส่งต่อ/.test(t) ? "#E3F2FD;color:#1565C0" : "var(--soft);color:inherit"}">${esc(t)}</span>`;
  const ksA = new Map(), addK = (o, k) => { if (!ksA.has(o)) ksA.set(o, new Set()); ksA.get(o).add(k); };
  K.forEach((k) => addK(k.l1, k.k)); HO.forEach((h) => { addK(h.from, h.k); if (h.typ === "F") addK(h.to, h.k); });
  const ksL = (s) => (s && s.size ? [...s].sort((a, b) => a - b).join(", ") : "");
  table($("#flA"), { title: "บทบาทของบัญชี", sub: "เรียงตามเงินผู้เสียหายที่รับ · กดแถว = รายการเดินเงินของบัญชีนั้น", rows: () => AC, sort: "tin", csvName: "บทบาทบัญชี", lead: false, max: 300,
    cols: [{ k: "name", lab: "บัญชี", f: (x) => flAcc(x.o), v: (x) => x.name }, { k: "tags", lab: "บทบาท / ลักษณะการใช้", sh: "บทบาท", w: 1, f: (x) => x.tags.map(tagB).join(" ") || '<span class="muted">ไม่ได้รับเงินผู้เสียหายรายนี้</span>', v: (x) => x.tags.join(" ; "), s: (x) => x.tags.length },
      { k: "bank", lab: "ธนาคาร / เลขบัญชี", sh: "เลขบัญชี", v: (x) => `${x.bank} ${x.acc}` }, { k: "tin", lab: "รับเงินผู้เสียหาย", n: 1, f: (x) => (x.tin ? B(x.tin) : "") }, { k: "nk", lab: "กรรม", n: 1, f: (x) => x.nk || "" }, { k: "ksl", lab: "กรรมที่", w: 1, v: (x) => ksL(ksA.get(x.o)) },
      { k: "cash", lab: "ถอนเงินสด", n: 1, f: (x) => (x.cash ? B(x.cash) : "") }, { k: "ext", lab: "โอนต่อ", n: 1, f: (x) => (x.ext ? B(x.ext) : "") }, { k: "left", lab: "ค้าง", n: 1, f: (x) => (x.left ? B(x.left) : "") },
      { k: "dw", lab: "เงินผู้เสียหายค้างก่อนออก", sh: "ค้างนาน", n: 1, f: (x) => flDw(x.dw), v: (x) => (x.dw == null ? "" : x.dw) }, { k: "adays", lab: "วันที่มีรายการ", n: 1 }, { k: "span", lab: "อายุการใช้งาน (วัน)", sh: "ใช้งาน (วัน)", n: 1 },
      { k: "first", lab: "ช่วงข้อมูล", f: (x) => `${dS(x.first)} – ${dS(x.last)}`, range: (x) => [x.first, x.last] }, { k: "pt", lab: "เงินออก/เงินเข้า", n: 1, f: (x) => nf(x.pt * 100, 0) + "%", v: (x) => x.pt },
      { k: "in", lab: "เงินเข้าทั้งบัญชี", n: 1, f: (x) => M(x.in) }, { k: "cashall", lab: "ถอนเงินสดทั้งบัญชี", n: 1, f: (x) => (x.cashall ? M(x.cashall) : "") },
      { k: "cl", lab: "คอก", n: 1, f: (x) => (x.cl ? `คอก ${x.cl}` : ""), v: (x) => x.cl || "" }],
    total: (r) => `รับเงินผู้เสียหาย ${B(r.reduce((s, x) => s + x.tin, 0))} · ถอนสด ${B(r.reduce((s, x) => s + x.cash, 0))} บาท`,
    click: (x, det) => { const rows = HO.filter((h) => h.from === x.o || h.to === x.o); if (!rows.length) { det.innerHTML = `<p class="note">ไม่มีเงินของผู้เสียหายรายนี้ผ่านบัญชี ${esc(x.name)} — ดูรายละเอียดบัญชีได้ที่ <a href="#acc/${x.o}">หน้าบัญชี</a></p>`; return; } hopTbl(det, `เงินผู้เสียหายที่ผ่านบัญชี ${esc(x.name)}`, rows); } });

  /* ---- 3) คอกม้า ---- */
  const chips = (os, n = 6) => os.slice(0, n).map(flAcc).join(" ") + (os.length > n ? ` <small>+${os.length - n}</small>` : "");
  table($("#flC"), { title: "กลุ่มบัญชีที่มีผู้ควบคุมร่วมกัน (คอกม้า)", sub: "กดแถว = ดูหลักฐานที่เชื่อมบัญชี", rows: () => CL, sort: "tin", csvName: "คอกม้า", lead: false, search: false,
    cols: [{ k: "id", lab: "คอก", n: 1, f: (c) => (flIsCl(c) ? `<b>คอก ${c.id}</b>` : '<span class="muted" title="บัญชีหลายบัญชีของคนเดียวกัน — ไม่นับเป็นคอก">คนเดียวกัน</span>'), v: (c) => (flIsCl(c) ? "คอก " + c.id : "คนเดียวกัน"), s: (c) => c.id }, { k: "own", lab: "เจ้าของ (คน)", n: 1, v: (c) => c.own || "" }, { k: "n", lab: "บัญชี", n: 1 }, { k: "kinds", lab: "หลักฐานที่เชื่อม", w: 1, v: (c) => c.kinds.join(" · ") },
      { k: "tin", lab: "รับเงินผู้เสียหาย", n: 1, f: (c) => (c.tin ? B(c.tin) : "") }, { k: "nk", lab: "กรรม", n: 1, f: (c) => c.nk || "" }, { k: "ksl", lab: "กรรมที่", w: 1, v: (c) => ksL(new Set(kOfCl(c))) }, { k: "cash", lab: "ถอนเงินสด (เงินผู้เสียหาย)", sh: "ถอนเงินสด", n: 1, f: (c) => (c.cash ? B(c.cash) : "") },
      { k: "cashall", lab: "ถอนเงินสดทั้งหมด", n: 1, f: (c) => (c.cashall ? M(c.cashall) : "") },
      { k: "accs", lab: "สมาชิก", w: 1, f: (c) => chips(c.accs) + (c.accs.length <= 12 ? cmpLink(c.accs) : ""), v: (c) => c.accs.map(flName).join(" ; ") }],
    click: (c, det) => table(det, { title: flIsCl(c) ? `หลักฐานของคอก ${c.id}` : "หลักฐานของกลุ่มบัญชีคนเดียวกัน", rows: () => c.ev.map((e) => ({ k: e[0], v: e[1], accs: e[2] })), sort: "", csvName: `หลักฐาน_คอก${c.id}`, lead: false, search: false,
      cols: [{ k: "k", lab: "ประเภทหลักฐาน" }, { k: "v", lab: "รายละเอียด", w: 1 }, { k: "n", lab: "บัญชี", n: 1, v: (e) => e.accs.length }, { k: "accs", lab: "บัญชีที่เกี่ยวข้อง", w: 1, f: (e) => chips(e.accs, 20) + cmpLink(e.accs.slice(0, 12)), v: (e) => e.accs.map(flName).join(" ; ") }] }) });
  table($("#flW"), { title: "หลักฐานเสริม (ยังไม่พอรวมกลุ่ม)", sub: "ใช้ประกอบ ไม่ได้ใช้จัดคอก", rows: () => F.weak.map((e) => ({ k: e[0], v: e[1], accs: e[2] })), sort: "", csvName: "หลักฐานเสริม", lead: false,
    cols: [{ k: "k", lab: "ประเภท" }, { k: "v", lab: "รายละเอียด", w: 1 }, { k: "accs", lab: "บัญชี", w: 1, f: (e) => chips(e.accs, 8) + cmpLink(e.accs.slice(0, 12)), v: (e) => e.accs.map(flName).join(" ; ") }] });

  /* ---- 4) ถอนเงินสด ---- */
  const cg = new Map();
  HO.filter((h) => h.typ === "C").forEach((h) => { const key = /ไม่ระบุเครื่อง/.test(h.rc || h.place) ? (h.rc || h.place) + "|" + h.from : h.place || "ไม่ระบุ"; const o = cg.get(key) || { place: key, prov: h.prov, n: 0, amt: 0, accs: new Set(), ks: new Set(), first: h.t, last: h.t, rows: [] };
    o.n++; o.amt += h.amt; o.accs.add(h.from); o.ks.add(h.k); if (h.t < o.first) o.first = h.t; if (h.t > o.last) o.last = h.t; o.rows.push(h); cg.set(key, o); });
  const CG = [...cg.values()];
  table($("#flCash"), { title: "จุดที่ถอนเงินของผู้เสียหายเป็นเงินสด", sub: "ผู้ถอน = ผู้ถือบัตร/สมุดของบัญชีนั้น — ขอ CCTV และใบถอนตามจุดและเวลาในตาราง · กดแถว = ดูรายการ", rows: () => CG, sort: "amt", csvName: "จุดถอนเงินสด_เงินผู้เสียหาย", lead: false,
    cols: [{ k: "place", lab: "จุดถอน", w: 1 }, { k: "prov", lab: "จังหวัด" }, { k: "n", lab: "ครั้ง", n: 1 }, { k: "amt", lab: "ยอด (เงินผู้เสียหาย)", sh: "เงินผู้เสียหาย", n: 1, f: (x) => B(x.amt) },
      { k: "accs", lab: "บัญชีที่ถอน", w: 1, f: (x) => chips([...x.accs], 4), v: (x) => [...x.accs].map(flName).join(" ; "), s: (x) => x.accs.size }, { k: "nk", lab: "กรรม", n: 1, v: (x) => x.ks.size }, { k: "ksl", lab: "กรรมที่", w: 1, v: (x) => ksL(x.ks) },
      { k: "first", lab: "ช่วงวันที่", f: (x) => `${dS(x.first)} – ${dS(x.last)}`, range: (x) => [x.first, x.last] }],
    total: (r) => `รวม ${B(r.reduce((s, x) => s + x.amt, 0))} บาท`, click: (x, det) => hopTbl(det, `รายการถอนที่ ${esc(x.place)}`, x.rows) });
  /* จังหวัดที่พบทั้ง "ถอนเงินสดของบัญชีม้า" และ "ฝากเงินสดเข้าบัญชีรวมเงิน (3 บัญชีหลัก)" */
  const pw = new Map(); HO.filter((h) => h.typ === "C" && h.prov).forEach((h) => pw.set(h.prov, (pw.get(h.prov) || 0) + h.amt));
  const pd = new Map(); DB.acs.forEach((a) => a.prov.forEach((p) => { const k = p.prov.replace(" (?)", ""); if (!/ไม่ทราบ|รอยืนยัน/.test(k)) { const o = pd.get(k) || { amt: 0, accs: new Set() }; o.amt += p.amt; o.accs.add(a.short); pd.set(k, o); } }));
  const PV = [...new Set([...pw.keys(), ...pd.keys()])].map((p) => ({ prov: p, w: pw.get(p) || 0, d: (pd.get(p) || {}).amt || 0, accs: [...((pd.get(p) || {}).accs || [])] })).filter((x) => x.w && x.d);
  /* เทียบช่วงเวลา: วันที่ถอนเงินสดของผู้เสียหาย กับ วันที่มีการฝากเงินสดเข้าบัญชีรวมเงิน (ไม่ใช่ช่วงของ statement ทั้งบัญชี) */
  const cts = HO.filter((h) => h.typ === "C").map((h) => h.t.slice(0, 10)).sort(), cr = [cts[0], cts[cts.length - 1]];
  const dts = DB.acs.flatMap((a) => a.deps.filter((d) => isCash(d.k)).map((d) => d.t.slice(0, 10))).sort(), dr = [dts[0], dts[dts.length - 1]];
  const ov = cr[0] && dr[0] && cr[0] <= dr[1] && dr[0] <= cr[1], gap = cr[1] && dr[0] && dr[0] > cr[1] ? Math.round((Date.parse(dr[0]) - Date.parse(cr[1])) / 864e5) : 0;
  const nDep = ov ? dts.filter((d) => d >= cr[0] && d <= cr[1]).length : 0;
  table($("#flProv"), { title: "จังหวัดที่พบทั้งการถอนเงินสด และการฝากเงินสดเข้าบัญชีรวมเงิน", sub: `ใช้ชี้พื้นที่ปฏิบัติการของสายถอน-ฝากเงินสด`, rows: () => PV, sort: "w", csvName: "จังหวัดถอนและฝากเงินสด", lead: false, search: false,
    noteShow: true, note: `เงินของผู้เสียหายรายนี้ถูกถอนเป็นเงินสดช่วง <b>${dS(cr[0])} – ${dS(cr[1])}</b> ส่วนการฝากเงินสดเข้าบัญชีรวมเงิน 3 บัญชีที่มีในสำนวนอยู่ช่วง <b>${dS(dr[0])} – ${dS(dr[1])}</b> — ` +
      (ov ? `มีช่วงทับกัน (${nf(nDep)} รายการฝากอยู่ในช่วงที่มีการถอน) ควรเทียบรายวันต่อ` : `<b>ไม่ทับกัน${gap ? ` (ห่างกัน ${nf(gap)} วัน)` : ""}</b> จึงยังเชื่อมเงินสดที่ถอนกับเงินสดที่ฝากเป็นรายการต่อรายการไม่ได้ ต้องขอ statement ของบัญชีรวมเงินช่วงเดียวกับที่ผู้เสียหายโอน หรือหาบัญชีรวมเงินที่ใช้ในช่วงนั้น`) +
      ` · ตารางนี้บอกได้เพียงว่าขบวนการใช้พื้นที่จังหวัดเดียวกัน`,
    cols: [{ k: "prov", lab: "จังหวัด" }, { k: "w", lab: "ถอนเงินสด (เงินผู้เสียหาย)", sh: "ถอนเงินสด", n: 1, f: (x) => B(x.w) }, { k: "d", lab: "ฝากเข้าบัญชีรวมเงิน (สาขาที่ทราบที่ตั้ง)", sh: "ฝากเข้าบัญชีรวม", n: 1, f: (x) => B(x.d) }, { k: "accs", lab: "บัญชีรวมเงินที่พบในจังหวัดนี้", sh: "บัญชีรวมเงิน", w: 1, v: (x) => x.accs.join(", ") }] });

  /* ---- 5) บัญชีคุมงานติดตาม ---- */
  const kChips = (t) => { const a = [...t.ks].sort((x, y) => x - y); return a.slice(0, 8).map((k) => `<a href="#" class="kchip" data-gk="${k}" title="ไปดูผังของกรรมที่ ${k}">${k}</a>`).join("") + (a.length > 8 ? ` <small>+${a.length - 8}</small>` : ""); };
  const tkHtml = (t) => { const kb = `<span class="tkk k${t.kind}">${FL_KS[t.kind]}</span> `;
    if (t.kind === "C") return kb + esc(flTkName(t));
    if (t.kind === "H") return kb + esc(t.name) + ` <small class="muted">ไม่อยู่ในรายการค้างของเส้นเงินรอบนี้แล้ว (เช่น ได้ statement แล้ว หรือระบุเลขบัญชีแล้ว)</small>`;
    if (t.kind === "L") return kb + flAcc(t.o) + ` <small class="muted">${esc(t.bank)} ${esc(t.acc)}</small>`;
    const d = flTkD(t); return kb + av(d.name) + `<b>${esc(d.name || (t.kind === "O" ? "ปลายทางไม่ปรากฏในไฟล์" : "(ไม่มีชื่อในไฟล์)"))}</b> ${esc(d.bank)} ${esc(d.acc)}${d.ed ? ' <span class="fled" title="ชื่อ/เลขบัญชีที่พิมพ์เอง">✎</span>' : ""}`; };
  const actHtml = (t) => (t.hist ? esc(FL_ACT[flActOf(t)][0]) : `<select class="rqsel fact" data-fact="${esc(t.rc)}" aria-label="งานที่ต้องทำ">${Object.entries(FL_ACT).map(([k, a]) => `<option value="${k}" ${k === flActOf(t) ? "selected" : ""}>${a[0]}</option>`).join("")}</select>`);
  const focusLab = () => { const f = FLX.focus; if (!f) return ""; if (f.k) return `งานของกรรมที่ ${f.k}`; const t = lgBy.get(f.rc); return t ? `งาน: ${fcCut(flTkName(t), 40)}` : "งานที่เลือก"; };
  const tkRows = () => { const f = FLX.focus; return !f ? LG : f.k ? LG.filter((t) => t.ks.has(f.k)) : LG.filter((t) => t.rc === f.rc); };
  const ledSum = () => { const c = { "": 0, q: 0, g: 0, x: 0 }, a = { "": 0, q: 0, g: 0, x: 0 }; TK.forEach((t) => { const s = rqStat(t).s || ""; c[s]++; a[s] += t.amt; });
    $("#flKp").innerHTML = `<span class="kpc"><b>${nf(TK.length)}</b> งาน</span><span class="kpc s0"><b>${nf(c[""])}</b> ยังไม่ขอ · ${M(a[""])}</span><span class="kpc sq"><b>${nf(c.q)}</b> ขอแล้ว รอผล · ${M(a.q)}</span><span class="kpc sg"><b>${nf(c.g)}</b> ได้รับแล้ว · ${M(a.g)}</span><span class="kpc"><b>${nf(c.x)}</b> ไม่ต้องขอ</span>` +
      `<button class="tb" id="flSaveF" title="วางไฟล์ไว้ที่ 0_บันทึกงาน/สถานะขอข้อมูล.json แล้วอัปเดตเว็บ">${IC("dl", 15)} บันทึกสถานะเป็นไฟล์</button>`; };
  const lt = table($("#flT"), { title: "บัญชีคุมงานติดตามเส้นเงิน", sub: "1 แถว = 1 เป้าหมาย · กดแถว = ดูว่ามาจากรายการไหนและต้องทำอะไรต่อ · กดเลขกรรม = ไปดูผัง", rows: tkRows, sort: "star", csvName: "บัญชีคุม_งานติดตามเส้นเงิน", lead: false, max: 400,
    cols: [{ k: "st", lab: "สถานะ", f: (t) => (t.hist ? '<span class="rqs rqK">ปิดแล้ว</span>' : flStHtml(t)), v: (t) => (t.hist ? "ปิดแล้ว" : flStTxt(t)) },
      { k: "star", lab: "ความจำเป็น", f: (t) => flStarH(t.amt, t.ks.size), v: (t) => flStarT(t.amt, t.ks.size), s: (t) => flStar(t.amt, t.ks.size) * 1e12 + t.amt },
      { k: "act", lab: "งานที่ต้องทำ", f: actHtml, v: (t) => FL_ACT[flActOf(t)][0] }, { k: "kind", lab: "ประเภท", v: (t) => FL_KIND[t.kind] },
      { k: "tg", lab: "เป้าหมาย", w: 1, f: tkHtml, v: flTkName }, { k: "miss", lab: "ขาดข้อมูล", w: 1, f: (t) => (t.hist ? "" : `${flTkIc(t)}${esc(flMiss(t))}`), v: (t) => (t.hist ? "" : flMiss(t)) }, { k: "amt", lab: "ยอด (เงินผู้เสียหาย)", sh: "เงินผู้เสียหาย", n: 1, f: (t) => B(t.amt) }, { k: "n", lab: "ครั้ง", n: 1, f: (t) => t.n || "" },
      { k: "ks", lab: "มาจากกรรมที่", f: kChips, v: (t) => [...t.ks].sort((a, b) => a - b).join(", "), s: (t) => t.ks.size },
      { k: "from", lab: "ออกจากบัญชี (ชั้น)", w: 1, f: (t) => (t.kind === "N" ? '<small class="muted">ผู้เสียหายโอนเข้าโดยตรง</small>' : chips([...t.from], 3) + (t.ds.size ? ` <small>ชั้น ${[...t.ds].sort().join(", ")}</small>` : "")), v: (t) => (t.kind === "N" ? "ผู้เสียหายโอนเข้าโดยตรง" : [...t.from].map(flName).join(" ; ") + (t.ds.size ? ` (ชั้น ${[...t.ds].sort().join(", ")})` : "")), s: (t) => t.from.size },
      { k: "first", lab: "ช่วงวันเวลาของรายการ", sh: "ช่วงวันเวลา", f: (t) => (t.first ? fcT(t.first, t.last, t.n) : ""), v: (t) => (t.first ? `${t.first} – ${t.last}` : ""), s: (t) => t.first, range: (t) => [t.first.slice(0, 10), t.last.slice(0, 10)] },
      { k: "rc", lab: "รหัสคำขอ (ชื่อโฟลเดอร์)", sh: "รหัสคำขอ", f: (t) => `<button class="rcb" data-copy="${esc(t.code)}" title="กดเพื่อคัดลอก — ใช้ตั้งชื่อโฟลเดอร์ไฟล์ที่ได้รับ">${esc(t.code)}</button>`, v: (t) => t.code },
      { k: "files", lab: "ไฟล์ที่ได้รับ", w: 1, v: (t) => { rqStat(t); return (t.fl || []).map((f) => f[0]).join(" ; "); } },
      { k: "note", lab: "หมายเหตุ", w: 1, f: (t) => `${esc(flNote(t))} <a href="#" class="cmpl" data-ed="${esc(t.rc)}" title="แก้ไขงานที่ต้องทำ · หมายเหตุ · ชื่อ/เลขบัญชีปลายทาง">✎ แก้ไข</a>`, v: flNote }],
    total: (r) => `ยอดรวม ${B(r.reduce((s, t) => s + t.amt, 0))} บาท`,
    click: (t, det) => { const a = FL_ACT[flActOf(t)]; rqStat(t);
      const note = `<b>ต้องทำ: ${esc(a[0])}</b> — ${esc(a[1])}<br>` + (t.fl && t.fl.length ? `<b>ไฟล์ที่ได้รับ ${t.fl.length} ไฟล์:</b> ${t.fl.map((f) => `${esc(f[0])} (${dS(f[1])})`).join(" · ")}` : `ยังไม่มีไฟล์ — เมื่อได้ข้อมูลให้วางในโฟลเดอร์ <code>${esc(fold)}/${esc(t.code)}</code>`) + (flNote(t) ? `<br><b>หมายเหตุ:</b> ${esc(flNote(t))}` : "");
      if (t.rows.length) return hopTbl(det, `ที่มาของงานนี้ · ${esc(fcCut(flTkName(t), 60))}`, t.rows, note);
      const ks = K.filter((k) => t.ks.has(k.k));
      table(det, { title: `ที่มาของงานนี้ · ${esc(fcCut(flTkName(t), 60))}`, note, rows: () => ks, sort: "k", desc: false, csvName: "ที่มาของงาน", lead: false, search: false,
        cols: [{ k: "k", lab: "กรรมที่", n: 1, f: (k) => `<a href="#" class="kchip" data-gk="${k.k}">${k.k}</a>`, v: (k) => k.k }, { k: "t", lab: "วันเวลาที่ผู้เสียหายโอน", sh: "วันเวลาโอน", f: (k) => dtTh(k.t), date: (k) => k.t }, { k: "amt", lab: "ยอด", n: 1, f: (k) => B(k.amt) }, { k: "vacc", lab: "จากบัญชีผู้เสียหาย", v: (k) => `${k.vbank} ${k.vacc}` }, { k: "cf", lab: "ตรวจสอบรายการ", w: 1, v: (k) => k.cf || k.st }] }); } });
  ledSum();

  /* ---- แท็บ + ทางเดิน (ไปบัญชีคุม / ไปผังของกรรม / ย้อนกลับ) ---- */
  const tabs = [["k", `ตามกรรม ${nf(K.length)}`], ["a", `บัญชีม้า ${nf(AC.filter((a) => a.layer).length)}`], ["c", `คอกม้า ${nf(nCL)}`], ["w", `ถอนเงินสด ${nf(CG.length)} จุด`]];
  const curName = () => (FLX.tab === "k" ? "ตามกรรม" + (FLX.sel.size ? " · " + FLX.label : "") : FLX.tab === "t" ? "บัญชีคุม" + (FLX.focus ? " · " + focusLab() : "") : (tabs.find((x) => x[0] === FLX.tab) || ["", ""])[1].replace(/\s[\d,]+.*$/, ""));
  const crumb = () => { const p = FLX.nav[FLX.nav.length - 1], f = FLX.fwd[FLX.fwd.length - 1], fr = FLX.fwdReq, el = $("#flCrumb"), foc = FLX.tab === "t" && FLX.focus;
    el.hidden = !p && !f && !fr && !foc;
    el.innerHTML = (p ? `<button class="tb" id="flBack" title="กลับไปตำแหน่งก่อนหน้า">← ย้อนกลับ: ${esc(fcCut(p.name, 44))}</button>` : "") + (f ? `<button class="tb" id="flFwd" title="ไปข้างหน้า — กลับไปตำแหน่งที่ย้อนมา">ไปข้างหน้า: ${esc(fcCut(f.name, 44))} →</button>` : "") + (fr ? `<button class="tb" id="flFwdReq" title="กลับไปหน้ารายการขอข้อมูลตำแหน่งเดิม">ไปข้างหน้า: รายการขอข้อมูล →</button>` : "") + `<span class="flnow">ตอนนี้อยู่ที่ <b>${esc(curName())}</b></span>` + (foc ? `<button class="tb" id="flAll">แสดงงานทั้งหมด</button>` : ""); };
  const setTab = (k) => { FLX.tab = k; $("#flTabs").innerHTML = tabs.map(([t, l]) => `<button data-ft="${t}" class="${t === k ? "on" : ""}">${l}</button>`).join(""); $$("[data-fl]", root).forEach((x) => (x.hidden = x.dataset.fl !== k)); try { history.replaceState(null, "", "#flow/" + k); } catch (e) { } if (k === "t") { $("#flT [data-det]").innerHTML = ""; lt.draw(); } crumb(); };
  const snapNow = () => ({ tab: FLX.tab, focus: FLX.focus, sel: [...FLX.sel], label: FLX.label, y: window.scrollY, name: curName() });
  const applyNav = (s) => { FLX.focus = s.focus || null; if (s.sel && (s.sel.length !== FLX.sel.size || s.sel.some((k) => !FLX.sel.has(k)))) { FLX.sel = new Set(s.sel); FLX.label = s.label || ""; fcDraw(); kt.draw(); } setTab(s.tab); };
  const flGo = (s) => { FLX.fwd = []; FLX.fwdReq = null; FLX.nav.push(snapNow()); if (FLX.nav.length > 40) FLX.nav.shift(); applyNav(s);
    requestAnimationFrame(() => { if (s.tab === "t") { $("#flTabs").scrollIntoView({ block: "start" }); if (s.focus && s.focus.rc) { const tr = $("#flT tbody tr[data-i]"); if (tr) tr.click(); } } else $("#flTabs").scrollIntoView({ block: "start" }); }); };
  const flBack = () => { const s = FLX.nav.pop(); if (!s) return; FLX.fwd.push(snapNow()); applyNav(s); requestAnimationFrame(() => window.scrollTo(0, s.y)); };
  const flFwd = () => { const s = FLX.fwd.pop(); if (!s) return; FLX.nav.push(snapNow()); applyNav(s); requestAnimationFrame(() => window.scrollTo(0, s.y)); };
  const refresh = () => { ledSum(); lt.draw(); kt.draw(); openT.forEach((t) => { if (t.host && t.host.isConnected && $("table", t.host)) t.draw(); else openT.delete(t); }); fcPaint(); crumb(); };
  root.addEventListener("click", (e) => {
    const cp = e.target.closest("[data-copy]");
    if (cp) { e.stopPropagation(); const t = cp.dataset.copy; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast("คัดลอกรหัสคำขอแล้ว: " + t), () => toast("รหัสคำขอ: " + t)); return; }
    const a = e.target.closest("[data-go],[data-gk],[data-gp],[data-ed],#flBack,#flFwd,#flFwdReq,#flAll,#flSaveF"); if (!a) return; e.preventDefault(); e.stopPropagation();
    if (a.id === "flBack") return flBack();
    if (a.id === "flFwd") return flFwd();
    if (a.id === "flFwdReq") { RQ.focus = Object.assign({}, FLX.fwdReq, { back: location.hash }); FLX.fwdReq = null; RQ.tab = "q"; RQ.cats.clear(); RQ.stmF = "all"; FLX.y = window.scrollY; location.hash = "#req"; return; }
    if (a.id === "flAll") { FLX.focus = null; $("#flT [data-det]").innerHTML = ""; lt.draw(); crumb(); return; }
    if (a.id === "flSaveF") return rqSaveFile();
    if (a.dataset.go || a.dataset.gp) { FLX.fwdReq = null; RQ.focus = a.dataset.go ? { rc: a.dataset.go } : { k: +a.dataset.gp }; RQ.focus.back = location.hash; RQ.tab = "q"; RQ.cats.clear(); RQ.stmF = "all"; FLX.y = window.scrollY; location.hash = "#req"; return; }
    if (a.dataset.gk) { const k = +a.dataset.gk; return flGo({ tab: "k", focus: FLX.focus, sel: [k], label: `กรรมที่ ${k}` }); }
    if (a.dataset.ed) { const t = lgBy.get(a.dataset.ed); if (t) flEdit(t, refresh); }
  }, true);
  root.addEventListener("change", (e) => {
    const s = e.target.closest("select[data-frc]");
    if (s) { const t = tkBy.get(s.dataset.frc); rqPatch(s.dataset.frc, Object.assign({ s: s.value, d: s.value ? rqToday() : "" }, t ? flSnap(t) : {})); refresh(); return; }
    const c = e.target.closest("select[data-fact]");
    if (c) { const t = tkBy.get(c.dataset.fact); rqPatch(c.dataset.fact, Object.assign({ a: c.value }, t ? flSnap(t) : {})); refresh(); }
  });
  $("#flTabs").addEventListener("click", (e) => { const b = e.target.closest("[data-ft]"); if (b) setTab(b.dataset.ft); });
  const t0 = location.hash.split("/")[1] || ""; setTab(tabs.some((x) => x[0] === t0) ? t0 : tabs.some((x) => x[0] === FLX.tab) ? FLX.tab : "k");
  if (FLX.y != null) { const y = FLX.y; FLX.y = null; requestAnimationFrame(() => window.scrollTo(0, y)); }
}
