/* แผนที่จุดฝาก-ถอน รวมทุกบัญชี + ตัววิเคราะห์ "จุดเดียวกัน เวลาเดียวกัน" + เล่นไล่ทีละวัน/เส้นทางลำดับเหตุการณ์ (โหลดหลัง app.js) */
"use strict";
const MAPX = { ready: false, ev: [], f: { accs: null, kinds: null, from: "", to: "", R: 5, T: 60, col: "k" }, tab: "pl", map: null, lay: null, hist: [],
  play: { on: false, run: false, day: 0, cum: true, ms: 1500, timer: null, segT: [], def: false } };
const MK = { D: ["ฝากเงินสด", "#B3261E"], X: ["รับโอนผ่านตู้", "#1565C0"], W: ["ถอนเงินสด", "#6A1B9A"], O: ["โอนออกผ่านตู้", "#455A64"] };
const MPAL = ["#00838F", "#6A1B9A", "#E08A00", "#5D4037", "#AD1457", "#283593", "#827717", "#BF360C", "#455A64", "#00695C", "#4527A0", "#9E9D24"];
const isoMin = (t) => new Date(Math.round(t * 60) * 1000).toISOString().slice(0, 16).replace("T", " ");
const isoSec = (t) => new Date(Math.round(t * 60) * 1000).toISOString().slice(0, 19).replace("T", " ");
const mkb = (k) => `<span class="kb" style="background:${MK[k][1]}">${MK[k][0]}</span>`;
/* วันที่แบบสั้น "11 พ.ย.69" */
const dS = (iso) => { if (!iso) return ""; const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return `${d} ${MTH[m]}${String(y + 543).slice(2)}`; };
const SPD = 120, SPD_KM = 30;   // เดินทางไม่ทัน: เร็วกว่า 120 กม./ชม. และห่างเกิน 30 กม. (พิกัดเป็นระดับอำเภอโดยประมาณ)

function mapInit() {
  if (MAPX.ready) return;
  const m = DB.map;
  const weakCode = (c) => isGen(c) || /\s/.test(String(c).trim()) || /^TR|cardle/i.test(c);   // รหัสตู้ไม่ครบ/รหัสทั่วไป ใช้ชี้ว่าเป็นตู้เดียวกันไม่ได้
  m.places.forEach((p) => { p.weak = p.k === "M" && weakCode(p.code); });
  m.accs.forEach((a, i) => { a.i = i; a.col = a.id ? ACOL[a.id] : MPAL[i % MPAL.length]; a.key = a.name.replace(/^(นาย|นางสาว|นาง|น\.ส\.?|MR\.?|MRS\.?|MS\.?|MISS|บริษัท|บจก\.?|หจก\.?)\s*/i, "").replace(/\s+/g, ""); });
  MAPX.ev = m.ev.map((e) => ({ a: e[0], t: e[1] / 60, k: e[2], amt: e[3], p: e[4], inf: e[5], mk: e[6], wk: weakCode(e[6].slice(e[6].indexOf(" ") + 1)), nm: m.names[e[7]], ch: e[8] || "A", bc: e[9] || "", mr: e[10] || "" })).sort((x, y) => x.t - y.t);
  MAPX.ev.forEach((e) => (e.day = isoMin(e.t).slice(0, 10)));
  MAPX.f.accs = new Set(m.accs.filter((a) => a.id).map((a) => a.i));
  MAPX.f.kinds = new Set(Object.keys(MK));
  MAPX.ready = true;
}
function mapFilter(f) {
  const lo = f.from ? Date.parse(f.from + "T00:00:00Z") / 60000 : -Infinity, hi = f.to ? Date.parse(f.to + "T23:59:59Z") / 60000 : Infinity;
  const ks = f.kinds && f.kinds.size < 4 ? f.kinds : f.kind ? new Set([f.kind]) : null;
  return MAPX.ev.filter((e) => (!f.accs || f.accs.has(e.a)) && (!ks || ks.has(e.k)) && e.t >= lo && e.t <= hi);
}
function hav(a, b) { const r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lng - a.lng) * r, x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); }
/* เหตุการณ์ของคนละบัญชี (คนละเจ้าของ) ที่อยู่จุดเดียวกัน/ในรัศมี R กม. และห่างกันไม่เกิน T นาที */
function coFind(evs, R, T) {
  const P = DB.map.places, A = DB.map.accs, n = evs.length, par = Array.from({ length: n }, (_, i) => i);
  const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  const dist = (a, b) => { if (a.p === b.p) return P[a.p].weak ? null : 0; if (a.mk && a.mk === b.mk && !a.wk) return 0; const pa = P[a.p], pb = P[b.p]; if (pa.pv || pb.pv) return null; return pa.lat == null || pb.lat == null ? null : hav(pa, pb); };
  const linked = new Uint8Array(n);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n && evs[j].t - evs[i].t <= T; j++) {
    if (evs[i].a === evs[j].a || A[evs[i].a].key === A[evs[j].a].key) continue;
    const d = dist(evs[i], evs[j]); if (d == null || d > R) continue;
    const ri = find(i), rj = find(j); if (ri !== rj) par[ri] = rj; linked[i] = linked[j] = 1;
  }
  const span = (pl) => { let d = 0; const q = pl.map((p) => P[p]).filter((p) => p.lat != null); for (let i = 0; i < q.length; i++) for (let j = i + 1; j < q.length; j++) d = Math.max(d, hav(q[i], q[j])); return d; };
  const g = new Map();
  for (let i = 0; i < n; i++) if (linked[i]) { const r = find(i); if (!g.has(r)) g.set(r, []); g.get(r).push(evs[i]); }
  return [...g.entries()].map(([r, es]) => { const accs = [...new Set(es.map((e) => e.a))], pl = [...new Set(es.map((e) => e.p))];
    return { t0: es[0].t, t1: es[es.length - 1].t, es, accs, pl, n: es.length, amt: es.reduce((s, e) => s + e.amt, 0), d: span(pl), loc: pl.map((p) => P[p]).find((p) => p.lat != null) || null }; })
    .sort((a, b) => b.accs.length - a.accs.length || b.amt - a.amt);
}
/* ลำดับเหตุการณ์ตามเวลา-สถานที่ (เฉพาะจุดที่ทราบพิกัด) : แยกบัญชี เรียงเวลา รวมรายการติดกันที่จุดเดิมเป็น 1 ลำดับ
   ระยะทาง/เวลาจากจุดก่อนหน้า -> ความเร็ว ; เร็วเกินจริง = เดินทางไม่ทัน (น่าจะคนละคน/ทีม หรือพิกัดโดยประมาณคลาดเคลื่อน) */
function seqBuild(evs) {
  const P = DB.map.places, out = [], by = new Map();
  evs.forEach((e) => { if (P[e.p].lat == null) return; if (!by.has(e.a)) by.set(e.a, []); by.get(e.a).push(e); });
  for (const [a, es] of by) {
    let prev = null, dayN = 0, curDay = "", seqN = 0;
    for (const e of es) {
      if (prev && prev.p === e.p && e.t - prev.t1 <= 60) { prev.es.push(e); prev.n++; prev.amt += e.amt; prev.t1 = e.t; continue; }
      if (e.day !== curDay) { curDay = e.day; dayN = 0; }
      const s = { a, p: e.p, P: P[e.p], day: e.day, t0: e.t, t1: e.t, n: 1, amt: e.amt, es: [e], no: ++seqN, dno: ++dayN, k: e.k, inf: e.inf };
      if (prev) { s.km = hav(prev.P, s.P); s.min = e.t - prev.t1; s.kmh = s.min > 0 ? s.km / (s.min / 60) : (s.km > 1 ? Infinity : 0); s.same = prev.day === s.day;
        s.cash = /[DW]/.test(prev.k) && /[DW]/.test(s.k);   // เทียบเฉพาะฝาก/ถอนเงินสด — ต้องมีคนถือเงินสดไปที่ตู้/สาขาเอง (รับโอนผ่านตู้ = ผู้โอนแต่ละรายทำเอง)
        s.fast = s.same && s.cash && s.km > (prev.P.pv || s.P.pv ? 150 : SPD_KM) && s.kmh > SPD; s.fromP = prev.P; }
      out.push(s); prev = s;
    }
  }
  return out.sort((x, y) => x.t0 - y.t0);
}
/* สรุปใช้ในหน้าแรก: เคลื่อนที่ข้ามจังหวัดในวันเดียว / เดินทางไม่ทัน */
function seqSummary(accIdx) {
  mapInit();
  const sq = seqBuild(mapFilter({ accs: new Set(accIdx), kinds: null }));
  const days = new Map(); sq.forEach((s) => { const k = s.a + "|" + s.day; if (!days.has(k)) days.set(k, new Set()); if (s.P.prov) days.get(k).add(s.P.prov.replace(" (?)", "")); });
  const multi = [...days.entries()].filter(([, v]) => v.size >= 2).map(([k, v]) => ({ a: +k.split("|")[0], day: k.split("|")[1], provs: [...v] }));
  return { seq: sq, fast: sq.filter((s) => s.fast), multi };
}
const plName = (p) => (p.k === "A" ? `ตู้ ${p.b === "KTB" ? "" : p.b + " "}${p.code} ${p.name}${p.branch && p.branch !== p.name ? ` (${p.branch})` : ""}${p.prov ? " · " + p.prov : ""}` : p.k === "S" ? `${p.name}${p.prov ? " · " + p.prov : ""}` : `ตู้ ${p.b} ${p.code}`);
const mAcc = (i) => { const a = DB.map.accs[i]; return `<a class="badge" href="#acc/${accK(a.acc)}" title="ดูรายละเอียดบัญชี" style="background:${a.col}22;color:${a.col}">${av(a.name)}${esc(a.name.replace(/^(บริษัท|น\.ส\.?|นางสาว|นาย|นาง)\s*/, "").slice(0, 22))}</a>`; };

function pMap(m) {
  mapInit();
  const F = MAPX.f, A = DB.map.accs, P = DB.map.places, PL = MAPX.play;
  stopPlay();
  { const g = gSel(); if (g) F.accs = new Set(A.filter((a) => g.includes(gK(a.acc))).map((a) => a.i)); }      // ชุดบัญชีที่เลือกร่วมทุกหน้า
  const dmin = MAPX.ev.length ? MAPX.ev[0].day : "", dmax = MAPX.ev.length ? MAPX.ev[MAPX.ev.length - 1].day : "";
  m.innerHTML = `<div class="mbar">
    <details class="pick" id="mPick"><summary class="tb">${IC("user", 15)} บัญชี <b id="mAccN"></b></summary><div class="pick-box">
      <div class="pick-q"><input class="tin" type="search" placeholder="ค้นหาบัญชี" id="mAccQ"><button class="tb" data-q="f">3 หลัก</button><button class="tb" data-q="a">ทั้งหมด</button><button class="tb" data-q="n">ล้าง</button></div>
      <div class="pick-list" id="mAccL"></div></div></details>
    <span class="kchips" id="mKinds">${Object.entries(MK).map(([k, v]) => `<button class="kchip" data-k="${k}" style="--c:${v[1]}" aria-pressed="true" title="${v[0]}">${{ D: "ฝากสด", X: "รับโอน", W: "ถอนสด", O: "โอนออก" }[k]}</button>`).join("")}</span>
    <details class="pick mmore" id="mMore"><summary class="tb">ตัวกรอง<b id="mMoreN"></b></summary><div class="pick-box mmore-box">
      <div class="mrow2"><span class="mlab">ช่วงวันที่</span><span class="mdates"><label class="dfield"><small>ตั้งแต่</small><b id="mFromL"></b><input type="date" id="mFrom" min="${dmin}" max="${dmax}"></label>
        <label class="dfield"><small>ถึง</small><b id="mToL"></b><input type="date" id="mTo" min="${dmin}" max="${dmax}"></label></span></div>
      <div class="mrow2"><span class="mlab">สีวงกลม</span><span class="seg cseg" id="mCol"><button data-c="k">ตามประเภท</button><button data-c="a">ตามบัญชี</button></span></div>
      <div class="mrow2"><button class="tb" id="mUndo" hidden disabled></button><button class="tb" id="mReset" title="กลับค่าเริ่มต้น (3 บัญชีหลัก ทุกประเภท ทุกวันที่)">ล้างตัวกรองทั้งหมด</button></div></div></details>
    <span class="mgrp" id="mCoCtl" ${MAPX.tab === "co" ? "" : "hidden"} title="เหตุการณ์ของคนละบัญชี ณ จุดเดียวกันหรือในรัศมีที่กำหนด ภายในเวลาที่กำหนด">${IC("net", 15)} พร้อมกัน ≤ <input class="tin num" type="number" id="mR" min="0" step="0.5" value="${F.R}"> กม. <input class="tin num" type="number" id="mT" min="1" step="5" value="${F.T}"> นาที</span></div>
  <div class="mviews"><div class="seg" id="mTabs"></div><span class="msum" id="mSum"></span></div>
  <div class="sqbar" id="mSqBar" hidden></div>
  <div class="mapwrap"><div id="mapBox" class="mapbox"></div><div class="pday" id="pDayBadge" hidden></div>
    <div class="lg mlg"><span id="mLgC" class="lgc"></span><span><span class="dot" style="background:#FFD403;outline:2px solid #00264D"></span>ใช้ร่วม</span><span><span class="dot" style="background:transparent;outline:2px dashed #B3261E"></span>พร้อมกัน</span><details class="info"><summary title="คำอธิบาย">i</summary><div class="info-box">ขนาดวง = ยอดเงิน · ขอบเหลือง = หลายบัญชีใช้จุดเดียวกัน · ขอบประแดง = มีเหตุการณ์พร้อมกัน · เลขในวง = ลำดับเหตุการณ์ (โหมดเล่น/ลำดับเวลา) · ${esc(DB.map.geo_note || "")}</div></details></div></div>
  <div class="player" id="mPlayer">
    <button class="tb ic" id="pPlay" title="เล่น/หยุด ไล่ทีละวัน" aria-label="เล่น">▶</button>
    <button class="tb ic" id="pPrev" title="วันก่อนหน้า" aria-label="วันก่อนหน้า">‹</button>
    <input type="range" id="pSlider" min="0" max="0" value="0" aria-label="เลือกวัน">
    <button class="tb ic" id="pNext" title="วันถัดไป" aria-label="วันถัดไป">›</button>
    <b id="pLabel" class="plab">เล่นไล่ทีละวัน</b>
    <select class="tin" id="pSpeed" title="ความเร็ว"><option value="2500">ช้า</option><option value="1500" selected>ปกติ</option><option value="700">เร็ว</option></select>
    <button class="tb" id="pCum" title="แสดงเส้นทางวันก่อนหน้าแบบจาง ๆ ด้วย">สะสม</button>
    <button class="tb" id="pExit" hidden>ออก</button>
  </div>
  <div id="mTbl"></div>`;
  // แผนที่
  const dark = document.documentElement.dataset.theme === "dark";
  const map = L.map("mapBox", { zoomControl: true, attributionControl: true, preferCanvas: true }).setView([13.4, 101], 6);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, referrerPolicy: "strict-origin-when-cross-origin", className: dark ? "tile-dark" : "", attribution: "© OpenStreetMap contributors" }).addTo(map);
  const lay = L.layerGroup().addTo(map), rlay = L.layerGroup().addTo(map); MAPX.map = map; MAPX.lay = lay;
  let evs = [], inc = [], fitted = false, days = [];
  const showDates = () => {
    $("#mFrom").value = F.from; $("#mTo").value = F.to;
    const ev0 = mapFilter({ accs: F.accs, kinds: F.kinds }), lo = ev0.length ? ev0[0].day : dmin, hi = ev0.length ? ev0[ev0.length - 1].day : dmax;
    $("#mFromL").textContent = dS(F.from || lo); $("#mToL").textContent = dS(F.to || hi);
    $("#mFromL").classList.toggle("muted", !F.from); $("#mToL").classList.toggle("muted", !F.to);
  };
  const showKinds = () => $$("#mKinds .kchip").forEach((b) => b.setAttribute("aria-pressed", F.kinds.has(b.dataset.k) ? "true" : "false"));
  const accList = () => { const q = $("#mAccQ").value.trim().toLowerCase();
    $("#mAccL").innerHTML = A.filter((a) => !q || (a.name + a.acc + a.bank).toLowerCase().includes(q)).sort((a, b) => (b.id ? 1 : 0) - (a.id ? 1 : 0) || b.n - a.n)
      .map((a) => `<label><input type="checkbox" value="${a.i}" ${F.accs.has(a.i) ? "checked" : ""}><span class="dot" style="background:${a.col}"></span><span class="nm">${esc(a.name)}</span><small>${a.bank} ${a.acc} · ${a.n}</small></label>`).join(""); };
  const evTbl = (title, rows, det) => table(det, { title, rows: () => rows, sort: "t", desc: false, max: 500, csvName: "รายการที่จุด",
    cols: [{ k: "t", lab: "วันเวลา", f: (e) => dtTh(isoMin(e.t)), v: (e) => isoMin(e.t), s: (e) => e.t, date: (e) => isoSec(e.t) }, { k: "a", lab: "บัญชี", f: (e) => mAcc(e.a), v: (e) => A[e.a].name }, { k: "k", lab: "รายการ", f: (e) => mkb(e.k), v: (e) => MK[e.k][0] },
      { k: "amt", lab: "ยอด", n: 1, f: (e) => B(e.amt) }, { k: "mk", lab: "ตู้" }, { k: "p", lab: "จุด", v: (e) => plName(P[e.p]) + (e.inf ? " (อนุมานจากรอบเดียวกัน)" : "") }, { k: "nm", lab: "คู่โอน" }],
    total: (r) => `รวม ${B(r.reduce((s, e) => s + e.amt, 0))} บาท` });

  /* ---------- วาดเส้นทางลำดับเหตุการณ์ของวัน (โหมดเล่น) ---------- */
  const numIcon = (n, col, faded) => L.divIcon({ className: "", html: `<span class="seqn${faded ? " f" : ""}" style="--c:${col}">${n}</span>`, iconSize: [24, 24], iconAnchor: [12, 12] });
  const drawRoute = (dayIdx) => {
    PL.segT.forEach(clearTimeout); PL.segT = []; rlay.clearLayers(); lay.clearLayers();
    const day = days[dayIdx]; if (!day) return;
    const seqAll = seqBuild(evs).filter((s) => (PL.cum ? s.day <= day : s.day === day));   // เลขลำดับต่อเนื่องของแต่ละบัญชี (ไม่เริ่ม 1 ใหม่ทุกวัน)
    const today = seqAll.filter((s) => s.day === day), old = seqAll.filter((s) => s.day !== day);
    // วันก่อนหน้า (สะสม) = เส้นจาง
    if (PL.cum) { const by = new Map(); old.forEach((s) => { if (!by.has(s.a)) by.set(s.a, []); by.get(s.a).push([s.P.lat, s.P.lng]); });
      by.forEach((pts, a) => { if (pts.length > 1) L.polyline(pts, { color: A[a].col, weight: 2, opacity: .25 }).addTo(rlay); pts.forEach((p) => L.circleMarker(p, { radius: 4, color: A[a].col, weight: 1, fillOpacity: .25 }).addTo(rlay)); }); }
    const by = new Map(); today.forEach((s) => { if (!by.has(s.a)) by.set(s.a, []); by.get(s.a).push(s); });
    const total = today.length, gap = Math.max(120, Math.min(600, (PL.run ? PL.ms * 0.8 : 1200) / Math.max(1, total)));
    let k = 0;
    by.forEach((list, a) => list.forEach((s, i) => {
      const t = setTimeout(() => {
        if (i > 0) L.polyline([[list[i - 1].P.lat, list[i - 1].P.lng], [s.P.lat, s.P.lng]], { color: s.fast ? "#B3261E" : A[a].col, weight: s.fast ? 4 : 3, opacity: .9, dashArray: s.fast ? "8 6" : null }).addTo(rlay);
        const mk = L.marker([s.P.lat, s.P.lng], { icon: numIcon(s.no, A[a].col) }).addTo(rlay);
        mk.bindTooltip(`${s.no}. ${isoMin(s.t0).slice(11)} ${esc(s.P.name)} · ${MK[s.k][0]} ${M(s.amt)}${s.km != null && s.same ? ` · ห่างจุดก่อน ${nf(s.km, 0)} กม. ใน ${nf(s.min, 0)} นาที` : ""}${s.fast ? " · เดินทางไม่ทัน" : ""}`);
      }, (k++) * gap);
      PL.segT.push(t);
    }));
    const pts = today.map((s) => [s.P.lat, s.P.lng]);
    if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.4), { maxZoom: 11 });
    $("#pDayBadge").hidden = false;
    $("#pDayBadge").innerHTML = `<b>${dS(day)}</b> · ${today.length} จุด${today.some((s) => s.fast) ? ' · <span class="bad">มีเดินทางไม่ทัน</span>' : ""}`;
    $("#pLabel").textContent = `${dS(day)} (${dayIdx + 1}/${days.length})`;
    $("#pSlider").value = dayIdx;
    if (MAPX.tab === "sq") drawTable();
  };
  const tick = () => { if (!PL.run || !$("#pPlay")) return; if (PL.day >= days.length - 1) { pause(); return; } PL.day++; drawRoute(PL.day); PL.timer = setTimeout(tick, PL.ms); };
  const pause = () => { PL.run = false; clearTimeout(PL.timer); const b = $("#pPlay"); if (b) b.textContent = "▶"; };
  const enterPlay = () => { if (PL.on) return;
    PL.on = true; $("#pExit").hidden = false; $("#mPlayer").classList.add("on");
    if (!PL.def) { PL.def = true; const ks = new Set(["W", "O"].filter((k) => evs.some((e) => e.k === k) || MAPX.ev.some((e) => e.k === k)));
      if (ks.size) { save(); F.kinds = ks; showKinds(); showDates(); PL.day = 0; fitted = false; draw(); toast("โหมดเล่น: เลือกถอนเงินสด + โอนออกผ่านตู้ · แบบสะสม (เปลี่ยนได้ที่ปุ่มประเภท/สะสม)"); } } };
  const exitPlay = () => { pause(); PL.on = false; PL.segT.forEach(clearTimeout); rlay.clearLayers(); $("#pExit").hidden = true; $("#mPlayer").classList.remove("on"); $("#pDayBadge").hidden = true; $("#pLabel").textContent = "เล่นไล่ทีละวัน"; draw(); };
  /* แท็บลำดับเวลา: เลขลำดับต่อเนื่องของแต่ละบัญชี (สีตามบัญชี) + เส้นทาง ; ◀ ▶ ไล่ทีละลำดับตามเวลา */
  const SQ = MAPX.sq || (MAPX.sq = { i: -1, all: [], list: [] });
  const sqName = (a) => esc(A[a].name.replace(/^(บริษัท|น\.ส\.?|นางสาว|นาย|นาง)\s*/, "").replace(/\s*จำกัด$/, "").slice(0, 22));
  const drawSeq = () => {
    rlay.clearLayers(); lay.clearLayers();
    const list = SQ.all.slice().sort((x, y) => x.t0 - y.t0); SQ.list = list;
    if (SQ.i >= list.length) SQ.i = -1;
    const show = SQ.i < 0 ? list : list.slice(0, SQ.i + 1), cur = SQ.i < 0 ? null : list[SQ.i];
    const by = new Map(); show.forEach((s) => { if (!by.has(s.a)) by.set(s.a, []); by.get(s.a).push(s); });
    by.forEach((ss, a) => ss.forEach((s, i) => {
      if (i > 0) L.polyline([[ss[i - 1].P.lat, ss[i - 1].P.lng], [s.P.lat, s.P.lng]], { color: s.fast ? "#B3261E" : A[a].col, weight: s.fast ? 3.5 : 2.5, opacity: cur && s !== cur ? .35 : .75, dashArray: s.fast ? "8 6" : null }).addTo(rlay);
      const mk = L.marker([s.P.lat, s.P.lng], { icon: numIcon(s.no, A[a].col, !!cur && s !== cur), zIndexOffset: s === cur ? 1000 : s.no }).addTo(rlay);
      mk.bindTooltip(`${sqName(a)} · ลำดับที่ ${s.no} · ${dS(s.day)} ${isoMin(s.t0).slice(11)} · ${esc(s.P.name)} · ${MK[s.k][0]} ${M(s.amt)}${s.fast ? " · เดินทางไม่ทัน" : ""}`);
      mk.on("click", () => { SQ.i = list.indexOf(s); drawSeq(); });
    }));
    if (cur) map.flyTo([cur.P.lat, cur.P.lng], Math.max(map.getZoom(), 10), { duration: .5 });
    else if (!fitted && show.length) { map.fitBounds(L.latLngBounds(show.map((s) => [s.P.lat, s.P.lng])).pad(0.15)); fitted = true; }
    const b = $("#mSqBar"), n = list.length;
    if (b) b.innerHTML = `<button class="tb" data-sq="p" ${n ? "" : "disabled"}>◀</button><span class="sqlab">${cur
      ? `ลำดับรวม <b>${SQ.i + 1}</b>/${n} · <span class="seqn" style="--c:${A[cur.a].col}">${cur.no}</span> ${sqName(cur.a)} · ${dS(cur.day)} ${isoMin(cur.t0).slice(11)} · ${esc(cur.P.name)} · ${MK[cur.k][0]} ${M(cur.amt)}${cur.fast ? ' · <span class="bad">เดินทางไม่ทัน</span>' : ""}`
      : `แสดงทั้งหมด ${nf(n)} ลำดับ · เลขในวงกลม = ลำดับของแต่ละบัญชี (สีตามบัญชี) — กด ▶ เพื่อไล่ทีละลำดับตามเวลา`}</span><button class="tb" data-sq="n" ${n ? "" : "disabled"}>▶</button>${cur ? `<button class="tb" data-sq="a">ดูทั้งหมด</button>` : ""}`;
  };
  $("#mSqBar").addEventListener("click", (e) => { const b = e.target.closest("[data-sq]"); if (!b) return; const n = SQ.list.length; if (!n) return;
    const v = b.dataset.sq; SQ.i = v === "a" ? -1 : v === "n" ? Math.min(n - 1, SQ.i + 1) : SQ.i < 0 ? n - 1 : Math.max(0, SQ.i - 1); drawSeq(); });
  MAPX.stop = () => { PL.run = false; clearTimeout(PL.timer); PL.segT.forEach(clearTimeout); PL.segT = []; };

  const drawTable = () => {
    const host = $("#mTbl"), accV = (x) => x.accs.map((a) => A[a].name).join(", "), accF = (x) => x.accs.map(mAcc).join(" ") + cmpLink(x.accs.map((i) => accK(A[i].acc)));
    const st = MAPX.cur;
    const { locAll, shr, unl } = st;
    if (MAPX.tab === "pl") table(host, { title: "จุดที่ทราบพิกัด", sub: "กดแถว = ดูรายการ + เลื่อนแผนที่", rows: () => locAll, sort: "amt", csvName: "จุดบนแผนที่",
      cols: [{ k: "name", lab: "ที่ตั้ง/สาขา", w: 1, v: (x) => x.P.name + (x.P.k === "A" ? ` (${x.P.branch})` : "") }, { k: "prov", lab: "จังหวัด", v: (x) => x.P.prov }, { k: "code", lab: "รหัส", v: (x) => x.P.code }, { k: "pk", lab: "ระดับ", v: (x) => (x.P.k === "A" ? "ตู้" : "สาขา") }, { k: "accs", lab: "บัญชี", w: 1, f: accF, v: accV, s: (x) => x.accs.length },
        { k: "n", lab: "ครั้ง", n: 1 }, { k: "amt", lab: "ยอด", n: 1, f: (x) => B(x.amt) }, { k: "t", lab: "ช่วงวันที่", f: (x) => `${dTh(isoMin(x.es[0].t))} – ${dTh(isoMin(x.es[x.es.length - 1].t))}`, s: (x) => x.es[0].t, range: (x) => [isoSec(x.es[0].t), isoSec(x.es[x.es.length - 1].t)] }, { k: "hot", lab: "พร้อมกัน", v: (x) => (x.hot ? "มี" : "") }],
      click: (x, det) => { map.flyTo([x.P.lat, x.P.lng], Math.max(map.getZoom(), 11)); evTbl(esc(x.P.name), x.es, det); } });
    else if (MAPX.tab === "sh") table(host, { title: "จุดที่หลายบัญชีใช้ร่วมกัน", sub: "นับเฉพาะบัญชีคนละเจ้าของ · รวมตู้ที่ยังไม่ทราบพิกัด (ไม่นับรหัสตู้ที่ไม่ครบ) · กดแถว = ดูรายการ", rows: () => shr, sort: "own", csvName: "จุดใช้ร่วมหลายบัญชี",
      cols: [{ k: "name", lab: "ที่ตั้ง/ตู้", w: 1, v: (x) => plName(x.P) }, { k: "pk", lab: "พิกัด", v: (x) => (x.P.lat != null ? (x.P.k === "A" ? "ตู้" : "สาขา") : "ไม่ทราบ") }, { k: "own", lab: "เจ้าของ", n: 1 }, { k: "accs", lab: "บัญชี", w: 1, f: accF, v: accV, s: (x) => x.accs.length },
        { k: "n", lab: "ครั้ง", n: 1 }, { k: "amt", lab: "ยอด", n: 1, f: (x) => B(x.amt) }, { k: "t", lab: "ช่วงวันที่", f: (x) => `${dTh(isoMin(x.es[0].t))} – ${dTh(isoMin(x.es[x.es.length - 1].t))}`, s: (x) => x.es[0].t, range: (x) => [isoSec(x.es[0].t), isoSec(x.es[x.es.length - 1].t)] }, { k: "hot", lab: "พร้อมกัน", v: (x) => (x.hot ? "มี" : "") }],
      click: (x, det) => { if (x.P.lat != null) map.flyTo([x.P.lat, x.P.lng], Math.max(map.getZoom(), 11)); evTbl(plName(x.P), x.es, det); } });
    else if (MAPX.tab === "co") table(host, { title: `เหตุการณ์พร้อมกัน (คนละบัญชี · ≤ ${F.R} กม. · ≤ ${F.T} นาที)`, note: inc.length ? "" : "ไม่พบในตัวกรองนี้ — ลองเพิ่มรัศมี/เวลา (ช่องด้านบน) หรือเลือกบัญชีเพิ่มในปุ่ม \"บัญชี\"", sub: "จุดเดียวกัน = ตู้เดียวกัน (รหัสเฉพาะเครื่อง) หรือสาขาเดียวกัน · รหัสไม่ครบ เช่น T091B0 ไม่นับ", rows: () => inc, sort: "nacc", csvName: "เหตุการณ์พร้อมกัน",
      cols: [{ k: "t0", lab: "เวลา", f: (x) => `${dtTh(isoMin(x.t0))}–${isoMin(x.t1).slice(11)}`, v: (x) => isoMin(x.t0), s: (x) => x.t0, range: (x) => [isoSec(x.t0), isoSec(x.t1)], rl: ["เวลาเริ่มต้น", "เวลาสิ้นสุด"] }, { k: "pl", lab: "จุด", w: 1, v: (x) => x.pl.map((p) => plName(P[p])).join(" | ") }, { k: "nacc", lab: "บัญชี", w: 1, f: accF, v: accV, s: (x) => x.accs.length * 1e12 + x.amt },
        { k: "n", lab: "รายการ", n: 1 }, { k: "amt", lab: "ยอดรวม", n: 1, f: (x) => B(x.amt) }, { k: "d", lab: "ห่างสุด (กม.)", n: 1, f: (x) => nf(x.d, 1) }, { k: "kinds", lab: "ลักษณะ", f: (x) => [...new Set(x.es.map((e) => e.k))].map(mkb).join(" "), v: (x) => [...new Set(x.es.map((e) => MK[e.k][0]))].join(" + ") }],
      click: (x, det) => { if (x.loc) map.flyTo([x.loc.lat, x.loc.lng], Math.max(map.getZoom(), 11)); evTbl("รายการในเหตุการณ์ " + dtTh(isoMin(x.t0)), x.es, det); } });
    else if (MAPX.tab === "sq") {
      const day = PL.on ? days[PL.day] : "";
      const sq = (PL.on || !SQ.all.length ? seqBuild(evs) : SQ.all).filter((s) => !day || s.day === day);
      table(host, { title: day ? `ลำดับเหตุการณ์ วันที่ ${dS(day)}` : "ลำดับเหตุการณ์ตามเวลา-สถานที่",
        sub: `เรียงเวลา แยกบัญชี · เลขลำดับ = ลำดับต่อเนื่องของแต่ละบัญชี (สีตามบัญชี) · ระยะ/เวลาเทียบจุดก่อนหน้าของบัญชีเดียวกัน · <b>เดินทางไม่ทัน</b> = ฝาก/ถอนเงินสด 2 จุดติดกันเร็วกว่า ${SPD} กม./ชม. (ห่าง > ${SPD_KM} กม.) แปลว่าคนถือเงินสดมีมากกว่า 1 คน/ทีม หรือพิกัดโดยประมาณคลาดเคลื่อน (ไม่นับรับโอนผ่านตู้ เพราะผู้โอนแต่ละรายทำเอง)`,
        rows: () => sq, sort: "t0", desc: false, csvName: "ลำดับเหตุการณ์เวลา-สถานที่", lead: false,
        cols: [{ k: "t0", lab: "วันเวลา", f: (x) => `${dS(x.day)} ${isoMin(x.t0).slice(11)}`, v: (x) => isoMin(x.t0), s: (x) => x.t0, date: (x) => isoSec(x.t0) },
          { k: "no", lab: "ลำดับ", n: 1, f: (x) => `<span class="seqn" style="--c:${A[x.a].col}">${x.no}</span>` }, { k: "dno", lab: "ลำดับในวัน", n: 1 }, { k: "a", lab: "บัญชี", f: (x) => mAcc(x.a), v: (x) => A[x.a].name },
          { k: "pl", lab: "สถานที่", w: 1, v: (x) => plName(x.P) + (x.inf ? " (อนุมาน)" : "") }, { k: "prov", lab: "จังหวัด", v: (x) => x.P.prov }, { k: "k", lab: "รายการ", f: (x) => mkb(x.k), v: (x) => MK[x.k][0] },
          { k: "n", lab: "ครั้ง", n: 1 }, { k: "amt", lab: "ยอด", n: 1, f: (x) => B(x.amt) },
          { k: "km", lab: "ห่างจุดก่อน (กม.)", n: 1, f: (x) => (x.km == null ? "" : nf(x.km, 0) + (x.same ? "" : ' <small class="muted">ข้ามวัน</small>')), v: (x) => (x.km == null ? "" : Math.round(x.km)) },
          { k: "min", lab: "ห่าง (นาที)", n: 1, f: (x) => (x.min == null ? "" : x.same ? nf(x.min, 0) : "-"), v: (x) => (x.min == null || !x.same ? "" : Math.round(x.min)) },
          { k: "kmh", lab: "ความเร็ว (กม./ชม.)", sh: "กม./ชม.", n: 1, f: (x) => (x.kmh == null || !x.same || !x.km ? "" : x.kmh === Infinity ? "∞" : nf(x.kmh, 0)), v: (x) => (x.kmh == null || !x.same || !x.km || x.kmh === Infinity ? "" : Math.round(x.kmh)) },
          { k: "fast", lab: "ข้อสังเกต", f: (x) => (x.fast ? '<span class="badge r">เดินทางไม่ทัน</span>' : ""), v: (x) => (x.fast ? "เดินทางไม่ทัน" : "") }],
        total: (r) => `${nf(r.filter((x) => x.fast).length)} ช่วงเดินทางไม่ทัน`,
        click: (x, det) => { if (!PL.on && SQ.list.includes(x)) { SQ.i = SQ.list.indexOf(x); drawSeq(); } else map.flyTo([x.P.lat, x.P.lng], Math.max(map.getZoom(), 11)); evTbl(`${dS(x.day)} ${isoMin(x.t0).slice(11)} ${esc(x.P.name)}`, x.es, det); } });
    } else table(host, { title: "ตู้/สาขาที่ยังไม่ทราบพิกัด", sub: "ตู้ที่ไม่พบในรายการที่ตั้งตู้ของธนาคาร หรือพบชื่อที่ตั้งแต่ยังไม่มีพิกัด — ต้องขอที่ตั้งจากธนาคารเจ้าของตู้", rows: () => unl, sort: "amt", csvName: "ตู้ไม่ทราบพิกัด",
      cols: [{ k: "b", lab: "ธนาคาร", v: (x) => x.P.b }, { k: "code", lab: "รหัสตู้/สาขา", f: (x) => mcode(x.P.code), v: (x) => x.P.code }, { k: "pname", lab: "ชื่อที่ตั้ง (ถ้าพบ)", w: 1, v: (x) => x.P.name || "" }, { k: "accs", lab: "บัญชี", w: 1, f: accF, v: accV, s: (x) => x.accs.length }, { k: "n", lab: "ครั้ง", n: 1 }, { k: "amt", lab: "ยอด", n: 1, f: (x) => B(x.amt) },
        { k: "t", lab: "ช่วงวันที่", f: (x) => `${dTh(isoMin(x.es[0].t))} – ${dTh(isoMin(x.es[x.es.length - 1].t))}`, s: (x) => x.es[0].t, range: (x) => [isoSec(x.es[0].t), isoSec(x.es[x.es.length - 1].t)] }, { k: "hot", lab: "พร้อมกัน", v: (x) => (x.hot ? "มี" : "") }],
      click: (x, det) => evTbl(plName(x.P), x.es, det) });
  };

  /* ---------- พิกัดผู้ทำรายการ จากไฟล์ที่ขอตรงจากธนาคาร (lat/long) ---------- */
  const GK = { W: ["ถอนเงินสด", "#B3261E", "W"], D: ["ฝากเงินสด", "#2E7D32", "D"], O: ["โอนออกผ่านแอป", "#E08A00", "O"], I: ["รับโอน (พิกัดผู้โอน)", "#1565C0", "X"] };
  const geoRows = () => { const ks = F.geoSel ? (gSel() || A.filter((a) => F.accs.has(a.i)).map((a) => gK(a.acc))) : Object.keys(DB.geo || {}), lo = F.from || "0000", hi = F.to ? F.to + " 99" : "9999", out = [];
    ks.forEach((k) => ((DB.geo || {})[k] || []).forEach((r) => { if (r[0] < lo || r[0] > hi || !F.kinds.has(GK[r[4]][2]) || (F.geoCash && (r[4] === "O" || r[4] === "I"))) return; out.push({ k, t: r[0], lat: r[1], lng: r[2], amt: r[3], kind: r[4], ch: r[5], cp: r[6] }); })); return out; };
  const geoName = (k) => { const x = accIndex().get(k); return x ? x.name : k; }, geoCol = (k) => { const x = accIndex().get(k); return x ? x.col : "#555"; };
  const geoGroups = (rows) => { const m = new Map(); rows.forEach((r) => { const key = r.lat.toFixed(3) + "," + r.lng.toFixed(3); const o = m.get(key) || { key, lat: 0, lng: 0, n: 0, amt: 0, ks: new Set(), kc: {}, first: r.t, last: r.t, rows: [] };
    o.lat += r.lat; o.lng += r.lng; o.n++; o.amt += r.amt; o.ks.add(r.k); o.kc[r.kind] = (o.kc[r.kind] || 0) + 1; if (r.t < o.first) o.first = r.t; if (r.t > o.last) o.last = r.t; o.rows.push(r); m.set(key, o); });
    return [...m.values()].map((o) => Object.assign(o, { lat: o.lat / o.n, lng: o.lng / o.n })); };
  const drawGeo = () => { lay.clearLayers(); rlay.clearLayers(); const rows = geoRows(), G = geoGroups(rows), byA = F.col === "a", mx = Math.max(1, ...G.map((g) => g.n));
    G.sort((a, b) => b.n - a.n).forEach((g) => { const top = Object.entries(g.kc).sort((a, b) => b[1] - a[1])[0][0], fill = byA ? geoCol([...g.ks][0]) : GK[top][1];
      const c = L.circleMarker([g.lat, g.lng], { radius: 4 + Math.sqrt(g.n / mx) * 14, color: g.ks.size > 1 ? "#00264D" : "#fff", weight: g.ks.size > 1 ? 2.5 : 1, fillColor: fill, fillOpacity: .75 }).addTo(lay);
      c.bindTooltip(`${nf(g.n)} รายการ · ${[...g.ks].map(geoName).join(", ").slice(0, 80)}`);
      c.on("click", () => { const det = $("#mTbl [data-det]"); if (det) gpDet(g, det); }); });
    if (!fitted && G.length) { map.fitBounds(L.latLngBounds(G.map((g) => [g.lat, g.lng])).pad(0.15)); fitted = true; }
    return { rows, G }; };
  const gpDet = (g, det) => table(det, { title: `รายการที่พิกัด ${g.lat.toFixed(5)}, ${g.lng.toFixed(5)}`, rows: () => g.rows, sort: "t", desc: false, csvName: "รายการที่พิกัด", lead: false, max: 600,
    note: `<a href="https://www.google.com/maps?q=${g.lat.toFixed(6)},${g.lng.toFixed(6)}" target="_blank" rel="noopener">เปิดตำแหน่งใน Google Maps ↗</a>`, noteShow: true,
    cols: [{ k: "t", lab: "วันเวลา", f: (r) => dtTh(r.t), date: (r) => r.t }, { k: "k", lab: "บัญชี", f: (r) => accLink(r.k), v: (r) => geoName(r.k) }, { k: "kind", lab: "รายการ", f: (r) => `<span class="badge" style="background:${GK[r.kind][1]}22;color:${GK[r.kind][1]}">${GK[r.kind][0]}</span>`, v: (r) => GK[r.kind][0] },
      { k: "amt", lab: "ยอด", n: 1, f: (r) => B(r.amt) }, { k: "ch", lab: "ช่องทาง" }, { k: "cp", lab: "คู่รายการ / ที่ตั้งตู้", w: 1 }, { k: "ll", lab: "พิกัด", v: (r) => `${r.lat}, ${r.lng}` }],
    total: (r) => `รวม ${B(r.reduce((s, x) => s + x.amt, 0))} บาท` });

  /* ---------- บัญชีที่น่าจะอยู่ด้วยกัน (จากพิกัดของเจ้าของบัญชีเอง) ----------
     ใช้เฉพาะรายการที่เจ้าของบัญชีทำเอง: โอนออกผ่านแอป (ตำแหน่งโทรศัพท์) และถอน/ฝากเงินสด (ตำแหน่งตู้)
     ไม่ใช้ "รับโอน" เพราะพิกัดเป็นของผู้โอน
       พร้อมกัน      = คนละบัญชี อยู่ห่างกันไม่เกิน R เมตร ภายใน T นาที
       ใช้จุดเดียวกัน = ตำแหน่งโทรศัพท์ของ 2 บัญชีห่างกันไม่เกิน R เมตร (คนละเวลาได้) นับเป็นจำนวนวัน
     ระดับ: สูง = พร้อมกัน / ที่เดียวกันวันเดียวกัน ≥ 2 วัน หรือใช้จุดเดียวกัน ≥ 3 วันทั้งสองบัญชี · กลาง = พร้อมกัน / ที่เดียวกันวันเดียวกัน 1 วัน หรือใช้จุดเดียวกัน ≥ 2 วัน · ต่ำ = ใช้จุดเดียวกัน (คนละวัน) วันเดียว
     ชื่อเจ้าของเดียวกัน = "คนเดียวกัน" (ไม่นับเป็นคู่/กลุ่ม) ; กลุ่ม = คู่ระดับกลางขึ้นไปที่เชื่อมกัน */
  const TG = MAPX.tg || (MAPX.tg = { R: 150, T: 60, sel: null });
  const ownKey = (k) => String(geoName(k) || k).replace(/^(นาย|นางสาว|นาง|น\.ส\.?|MR\.?|MRS\.?|MS\.?|MISS|MISTER)\s*/i, "").replace(/\s+/g, "").toUpperCase();
  const TGL = { 3: ["สูง", "#B3261E"], 2: ["กลาง", "#E08A00"], 1: ["ต่ำ", "#78909C"], 0: ["คนเดียวกัน", "#6A1B9A"] };
  const tgCalc = () => {
    const key = [F.from, F.to, TG.R, TG.T].join("|"); if (MAPX.tgC && MAPX.tgC.key === key) return MAPX.tgC.res;
    const lo = F.from || "0000", hi = F.to ? F.to + " 99" : "9999", R = TG.R, T = TG.T, pts = [], byK = new Map();
    Object.entries(DB.geo || {}).forEach(([k, rows]) => rows.forEach((r) => { if (r[4] === "I" || r[0] < lo || r[0] > hi) return;
      const q = { k, t: Date.parse(r[0].replace(" ", "T") + "Z") / 60000, ts: r[0], day: r[0].slice(0, 10), lat: r[1], lng: r[2], amt: r[3], kind: r[4], ch: r[5], cp: r[6], app: r[4] === "O" };
      pts.push(q); if (!byK.has(k)) byK.set(k, []); byK.get(k).push(q); }));
    const cs = R / 111000 / 0.95, cell = new Map(), ci = (v) => Math.floor(v / cs);
    pts.forEach((q, i) => { const kk = ci(q.lat) + "," + ci(q.lng); let a = cell.get(kk); if (!a) cell.set(kk, (a = [])); a.push(i); });
    const PR = new Map(), getP = (a, b) => { const x = a < b ? a : b, y = a < b ? b : a, kk = x + "|" + y; let o = PR.get(kk);
      if (!o) PR.set(kk, (o = { a: x, b: y, dA: new Set(), dB: new Set(), sd: new Set(), togD: new Set(), night: new Set(), tog: [], nTog: 0, sp: new Map(), dmin: 1e9, t0: "9", t1: "0" })); return o; };
    pts.forEach((p, i) => { const a0 = ci(p.lat), b0 = ci(p.lng);
      for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) { const arr = cell.get((a0 + da) + "," + (b0 + db)); if (!arr) continue;
        for (const j of arr) { if (j <= i) continue; const q = pts[j]; if (q.k === p.k) continue; const d = hav(p, q) * 1000; if (d > R) continue;
          const o = getP(p.k, q.k), pa = p.k === o.a ? p : q, pb = p.k === o.a ? q : p; o.dmin = Math.min(o.dmin, d);
          if (pa.ts < o.t0) o.t0 = pa.ts; if (pb.ts < o.t0) o.t0 = pb.ts; if (pa.ts > o.t1) o.t1 = pa.ts; if (pb.ts > o.t1) o.t1 = pb.ts;
          const sk = (Math.round(pa.lat * 1000) / 1000).toFixed(3) + "," + (Math.round(pa.lng * 1000) / 1000).toFixed(3);
          let sp = o.sp.get(sk); if (!sp) o.sp.set(sk, (sp = { lat: 0, lng: 0, m: 0, dA: new Set(), dB: new Set(), nTog: 0, t0: "9", t1: "0" }));
          sp.lat += pa.lat; sp.lng += pa.lng; sp.m++; sp.dA.add(pa.day); sp.dB.add(pb.day); for (const z of [pa.ts, pb.ts]) { if (z < sp.t0) sp.t0 = z; if (z > sp.t1) sp.t1 = z; }
          if (pa.app && pb.app) { o.dA.add(pa.day); o.dB.add(pb.day); }
          if (pa.day === pb.day && (pa.app || pb.app)) o.sd.add(pa.day);
          if (Math.abs(pa.t - pb.t) <= T) { o.nTog++; sp.nTog++; o.togD.add(pa.day); const h = +pa.ts.slice(11, 13); if (h >= 20 || h < 6) o.night.add(pa.day); if (o.tog.length < 400) o.tog.push({ pa, pb, d }); } } } });
    const pairs = [...PR.values()].map((o) => { const same = ownKey(o.a) === ownKey(o.b), mn = Math.min(o.dA.size, o.dB.size);
      const lv = same ? 0 : o.togD.size >= 2 || o.sd.size >= 2 || mn >= 3 ? 3 : o.togD.size >= 1 || o.sd.size >= 1 || mn >= 2 ? 2 : 1;
      const top = [...o.sp.values()].sort((x, y) => y.m - x.m)[0]; return Object.assign(o, { same, lv, top: top ? { lat: top.lat / top.m, lng: top.lng / top.m } : null }); })
      .sort((x, y) => (y.lv || 0.5) - (x.lv || 0.5) || y.togD.size - x.togD.size || y.sd.size - x.sd.size || Math.min(y.dA.size, y.dB.size) - Math.min(x.dA.size, x.dB.size));
    // กลุ่ม = คู่ระดับกลางขึ้นไปที่เชื่อมกัน (ไม่รวมคนเดียวกัน)
    const par = new Map(), fd = (x) => { while (par.get(x) !== x) { par.set(x, par.get(par.get(x))); x = par.get(x); } return x; };
    pairs.filter((o) => o.lv >= 2).forEach((o) => { [o.a, o.b].forEach((k) => par.has(k) || par.set(k, k)); const ra = fd(o.a), rb = fd(o.b); if (ra !== rb) par.set(ra, rb); });
    const gm = new Map(); [...par.keys()].forEach((k) => { const r = fd(k); if (!gm.has(r)) gm.set(r, []); gm.get(r).push(k); });
    const groups = [...gm.values()].filter((ks) => ks.length >= 2).map((ks) => ({ ks, prs: pairs.filter((o) => o.lv >= 2 && ks.includes(o.a)) }))
      .sort((x, y) => y.ks.length - x.ks.length || y.prs.length - x.prs.length);
    const gOf = new Map(); groups.forEach((g, i) => { g.no = i + 1; g.ks.forEach((k) => gOf.set(k, g.no)); });
    pairs.forEach((o) => { o.g = o.lv >= 2 ? gOf.get(o.a) || "" : ""; });
    // จุดที่หลายบัญชี (คนละเจ้าของ) ใช้โทรศัพท์ทำรายการ
    const SP = new Map(), sz = R / 111000 / 0.95;
    pts.forEach((q) => { if (!q.app) return; const kk = Math.round(q.lat / sz) + "," + Math.round(q.lng / sz); let o = SP.get(kk);
      if (!o) SP.set(kk, (o = { lat: 0, lng: 0, n: 0, ks: new Map(), rows: [], t0: "9", t1: "0" })); o.lat += q.lat; o.lng += q.lng; o.n++; o.rows.push(q);
      if (q.ts < o.t0) o.t0 = q.ts; if (q.ts > o.t1) o.t1 = q.ts; let a = o.ks.get(q.k); if (!a) o.ks.set(q.k, (a = { n: 0, days: new Set() })); a.n++; a.days.add(q.day); });
    const spots = [...SP.values()].map((o) => Object.assign(o, { lat: o.lat / o.n, lng: o.lng / o.n, own: new Set([...o.ks.keys()].map(ownKey)).size, days: new Set(o.rows.map((q) => q.day)).size }))
      .filter((o) => o.own >= 2).sort((x, y) => y.own - x.own || y.n - x.n);
    spots.forEach((o) => { o.g = [...new Set([...o.ks.keys()].map((k) => gOf.get(k)).filter(Boolean))].sort((a, b) => a - b).join(", "); });
    const res = { pairs, groups, spots, byK, nPts: pts.length };
    MAPX.tgC = { key, res }; return res; };
  const tgN = () => { const key = [F.from, F.to, TG.R, TG.T].join("|"); if (MAPX.tgC && MAPX.tgC.key === key) return " " + MAPX.tgC.res.pairs.filter((o) => o.lv >= 2).length;
    clearTimeout(MAPX.tgT); MAPX.tgT = setTimeout(() => { const b = $('#mTabs [data-mt="tg"]'); if (!b) return; tgCalc(); b.textContent = "อยู่ด้วยกัน" + tgN(); }, 400); return ""; };
  const tgCol = ["#1565C0", "#C2185B", "#2E7D32", "#E08A00", "#6A1B9A", "#00838F", "#5D4037", "#283593", "#AD1457", "#827717"];
  const tgSel = (res) => { const S = TG.sel; if (!S) return null;
    if (S.a) { const o = res.pairs.find((x) => x.a === S.a && x.b === S.b); return o ? { ks: [o.a, o.b], pair: o, title: `${geoName(o.a)} ↔ ${geoName(o.b)}` } : null; }
    if (S.g) { const g = res.groups.find((x) => x.no === S.g); return g ? { ks: g.ks, group: g, title: `กลุ่ม ${g.no}` } : null; }
    if (S.s) { const o = res.spots.find((x) => x.lat.toFixed(5) + "," + x.lng.toFixed(5) === S.s); return o ? { ks: [...o.ks.keys()], spot: o, title: "จุดร่วม" } : null; }
    return null; };
  const drawTg = (res) => { lay.clearLayers(); rlay.clearLayers(); const S = tgSel(res), bb = [];
    if (!S) { res.spots.forEach((o) => { const c = L.circleMarker([o.lat, o.lng], { radius: 6 + Math.min(9, Math.sqrt(o.n)) + Math.min(12, o.own * 1.6), color: "#00264D", weight: 2, fillColor: o.own >= 3 ? "#B3261E" : "#E08A00", fillOpacity: .82 }).addTo(lay);
        c.bindTooltip(`${o.own} เจ้าของบัญชี · ${nf(o.n)} รายการ · ${[...o.ks.keys()].map(geoName).join(", ").slice(0, 90)}`); c.on("click", () => { TG.sel = { s: o.lat.toFixed(5) + "," + o.lng.toFixed(5) }; drawTg(res); });
        bb.push([o.lat, o.lng]); });
      $("#mLgC").innerHTML = `<span><span class="dot" style="background:#B3261E"></span>จุดที่ 3 เจ้าของขึ้นไปใช้โทรศัพท์ทำรายการ</span><span><span class="dot" style="background:#E08A00"></span>2 เจ้าของ</span>`; }
    else { const col = new Map(S.ks.map((k, i) => [k, tgCol[i % tgCol.length]]));
      S.ks.forEach((k) => { const g = new Map(); (res.byK.get(k) || []).forEach((q) => { const kk = q.lat.toFixed(4) + "," + q.lng.toFixed(4); const o = g.get(kk) || { lat: q.lat, lng: q.lng, n: 0, app: 0 }; o.n++; o.app += q.app ? 1 : 0; g.set(kk, o); });
        g.forEach((o) => { L.circleMarker([o.lat, o.lng], { radius: 3.5 + Math.min(9, Math.sqrt(o.n) * 1.4), color: "#fff", weight: 1, fillColor: col.get(k), fillOpacity: .8 }).addTo(lay)
          .bindTooltip(`${geoName(k)} · ${nf(o.n)} รายการ${o.app < o.n ? ` (ตู้ ${o.n - o.app})` : ""}`); if (!S.pair && !S.spot) bb.push([o.lat, o.lng]); }); });
      if (S.pair) { S.pair.tog.forEach((e) => { L.polyline([[e.pa.lat, e.pa.lng], [e.pb.lat, e.pb.lng]], { color: "#B3261E", weight: 3 }).addTo(rlay); bb.push([e.pa.lat, e.pa.lng]); });
        [...S.pair.sp.values()].forEach((sp) => { const la = sp.lat / sp.m, ln = sp.lng / sp.m; L.circleMarker([la, ln], { radius: 13, color: sp.nTog ? "#B3261E" : "#00264D", weight: 2.5, dashArray: sp.nTog ? null : "4 3", fill: false }).addTo(rlay)
          .bindTooltip(`จุดร่วม · ${geoName(S.pair.a)} ${sp.dA.size} วัน · ${geoName(S.pair.b)} ${sp.dB.size} วัน${sp.nTog ? ` · พร้อมกัน ${sp.nTog} ครั้ง` : ""}`); bb.push([la, ln]); }); }
      if (S.spot) { L.circleMarker([S.spot.lat, S.spot.lng], { radius: 16, color: "#B3261E", weight: 3, fill: false }).addTo(rlay); bb.push([S.spot.lat, S.spot.lng]); }
      $("#mLgC").innerHTML = S.ks.slice(0, 10).map((k) => `<span><span class="dot" style="background:${col.get(k)}"></span>${esc(String(geoName(k)).replace(/^(นาย|นางสาว|นาง|น\.ส\.?)\s*/, "").slice(0, 20))}</span>`).join("") + (S.pair ? `<span><span class="dot" style="background:transparent;outline:2px solid #B3261E"></span>พร้อมกัน</span>` : "") + `<a href="#" id="tgAll">← ดูทุกจุดร่วม</a>`;
      const ba = $("#tgAll"); if (ba) ba.onclick = (e) => { e.preventDefault(); TG.sel = null; drawTg(res); }; }
    if (bb.length) map.fitBounds(L.latLngBounds(bb).pad(0.25), { maxZoom: 16 }); };
  const tgDays = (st) => [...st].sort().map((d) => dS(d)).join(", ");
  const drawTgTables = (res) => { const host = $("#mTbl"); host.innerHTML = `<div id="tgG"></div><div id="tgP"></div><div id="tgS"></div>`;
    const lvB = (lv) => `<span class="badge" style="background:${TGL[lv][1]}1f;color:${TGL[lv][1]}">${TGL[lv][0]}</span>`;
    const gmap = (lat, lng) => `<a href="https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}" target="_blank" rel="noopener">${lat.toFixed(5)}, ${lng.toFixed(5)}</a>`;
    if (res.groups.length) table($("#tgG"), { title: "กลุ่มบัญชีที่น่าจะอยู่ด้วยกัน", sub: "คู่บัญชีระดับกลางขึ้นไปที่เชื่อมถึงกัน · กดแถว = แสดงจุดของทุกบัญชีในกลุ่มบนแผนที่", rows: () => res.groups, sort: "no", desc: false, search: false, csvName: "กลุ่มบัญชีอยู่ด้วยกัน", lead: false,
      cols: [{ k: "no", lab: "กลุ่ม", n: 1 }, { k: "ks", lab: "บัญชี", w: 1, f: (g) => g.ks.map(accLink).join(" "), v: (g) => g.ks.map(geoName).join(", "), s: (g) => g.ks.length }, { k: "nk", lab: "จำนวนบัญชี", n: 1, v: (g) => g.ks.length },
        { k: "hi", lab: "คู่ระดับสูง", n: 1, v: (g) => g.prs.filter((o) => o.lv === 3).length }, { k: "tog", lab: "วันที่อยู่ที่เดียวกัน", n: 1, v: (g) => new Set(g.prs.flatMap((o) => [...o.togD, ...o.sd])).size }],
      click: (g) => { TG.sel = { g: g.no }; drawTg(res); return false; } });
    table($("#tgP"), { title: "คู่บัญชีที่พบอยู่ที่เดียวกัน", sub: `ใช้พิกัดที่เจ้าของบัญชีทำรายการเอง (โอนออกผ่านแอป = ตำแหน่งโทรศัพท์ · ถอน/ฝากเงินสด = ตำแหน่งตู้) ไม่ใช้รายการรับโอน (เป็นพิกัดของผู้โอน)<br>พร้อมกัน = ห่างกันไม่เกิน ${TG.R} ม. ภายใน ${TG.T} นาที · ใช้จุดเดียวกัน = ตำแหน่งโทรศัพท์ห่างกันไม่เกิน ${TG.R} ม. คนละเวลาได้ (นับวัน)<br>ระดับ สูง = พร้อมกัน หรือที่เดียวกันวันเดียวกัน ≥ 2 วัน หรือใช้จุดเดียวกัน ≥ 3 วันทั้งสองบัญชี · กลาง = 1 วัน หรือใช้จุดเดียวกัน ≥ 2 วัน · ต่ำ = ใช้จุดเดียวกันคนละวัน วันเดียว · คนเดียวกัน = ชื่อเจ้าของเดียวกัน<br>กดแถว = แสดง 2 บัญชีบนแผนที่ (เส้นแดง = พร้อมกัน) และรายการที่พบร่วม`,
      rows: () => res.pairs, sort: "lv", csvName: "คู่บัญชีอยู่ที่เดียวกัน", lead: false,
      cols: [{ k: "lv", lab: "ระดับ", f: (o) => lvB(o.lv), v: (o) => TGL[o.lv][0], s: (o) => (o.lv || 0.5) }, { k: "g", lab: "กลุ่ม", n: 1, v: (o) => o.g },
        { k: "a", lab: "บัญชี 1", f: (o) => accLink(o.a), v: (o) => geoName(o.a) }, { k: "b", lab: "บัญชี 2", f: (o) => accLink(o.b), v: (o) => geoName(o.b) },
        { k: "tog", lab: "พร้อมกัน (วัน)", n: 1, v: (o) => o.togD.size, f: (o) => (o.togD.size ? `<b>${o.togD.size}</b> <small>(${nf(o.nTog)} ครั้ง${o.night.size ? ` · กลางคืน ${o.night.size} วัน` : ""})</small>` : "") },
        { k: "sd", lab: "ที่เดียวกัน วันเดียวกัน (วัน)", sh: "ที่เดียวกัน (วัน)", n: 1, v: (o) => o.sd.size, f: (o) => (o.sd.size ? `<b>${o.sd.size}</b>` : "") },
        { k: "shd", lab: "ใช้จุดเดียวกัน (วัน)", v: (o) => `${o.dA.size} / ${o.dB.size}`, s: (o) => Math.min(o.dA.size, o.dB.size), f: (o) => (o.dA.size ? `${o.dA.size} / ${o.dB.size}` : "") },
        { k: "dmin", lab: "ใกล้สุด (ม.)", n: 1, v: (o) => Math.round(o.dmin) }, { k: "top", lab: "จุดที่พบบ่อย", f: (o) => (o.top ? gmap(o.top.lat, o.top.lng) : ""), v: (o) => (o.top ? `${o.top.lat.toFixed(6)}, ${o.top.lng.toFixed(6)}` : "") },
        { k: "t0", lab: "ช่วงวันที่", f: (o) => `${dS(o.t0)} – ${dS(o.t1)}`, range: (o) => [o.t0, o.t1] }],
      click: (o, det) => { TG.sel = { a: o.a, b: o.b }; drawTg(res);
        det.innerHTML = `<div data-d1></div><div data-d2></div>`;
        table($("[data-d1]", det), { title: `จุดที่พบร่วม · ${esc(geoName(o.a))} ↔ ${esc(geoName(o.b))}`, rows: () => [...o.sp.values()].map((sp) => Object.assign({ la: sp.lat / sp.m, ln: sp.lng / sp.m }, sp)), sort: "m", search: false, csvName: "จุดที่พบร่วม", lead: false,
          cols: [{ k: "ll", lab: "พิกัด", f: (x) => gmap(x.la, x.ln), v: (x) => `${x.la.toFixed(6)}, ${x.ln.toFixed(6)}` }, { k: "dA", lab: "วันของบัญชี 1", w: 1, v: (x) => tgDays(x.dA), s: (x) => x.dA.size }, { k: "dB", lab: "วันของบัญชี 2", w: 1, v: (x) => tgDays(x.dB), s: (x) => x.dB.size },
            { k: "nTog", lab: "พร้อมกัน (ครั้ง)", n: 1 }, { k: "m", lab: "คู่รายการที่ใกล้กัน", n: 1 }, { k: "t0", lab: "ช่วงวันเวลา", f: (x) => `${dtTh(x.t0)} – ${dtTh(x.t1)}`, range: (x) => [x.t0, x.t1] }] });
        if (o.tog.length) table($("[data-d2]", det), { title: `รายการที่ทำพร้อมกัน (≤ ${TG.T} นาที · ≤ ${TG.R} ม.)${o.nTog > o.tog.length ? ` — แสดง ${o.tog.length} จาก ${nf(o.nTog)}` : ""}`, rows: () => o.tog, sort: "t", desc: false, search: false, csvName: "รายการพร้อมกัน", lead: false,
          cols: [{ k: "t", lab: "เวลา บัญชี 1", f: (e) => dtTh(e.pa.ts), v: (e) => e.pa.ts, date: (e) => e.pa.ts }, { k: "ka", lab: "รายการ บัญชี 1", v: (e) => `${GK[e.pa.kind][0]} ${B(e.pa.amt)}` }, { k: "tb", lab: "เวลา บัญชี 2", f: (e) => dtTh(e.pb.ts), v: (e) => e.pb.ts },
            { k: "kb", lab: "รายการ บัญชี 2", v: (e) => `${GK[e.pb.kind][0]} ${B(e.pb.amt)}` }, { k: "dt", lab: "ห่าง (นาที)", n: 1, v: (e) => Math.round(Math.abs(e.pa.t - e.pb.t)) }, { k: "d", lab: "ห่าง (ม.)", n: 1, v: (e) => Math.round(e.d) },
            { k: "ll", lab: "พิกัด", f: (e) => gmap(e.pa.lat, e.pa.lng), v: (e) => `${e.pa.lat}, ${e.pa.lng}` }] }); } });
    table($("#tgS"), { title: "จุดที่หลายเจ้าของบัญชีใช้โทรศัพท์ทำรายการ", sub: `ตำแหน่งโทรศัพท์ (โอนออกผ่านแอป) ของบัญชีคนละเจ้าของ อยู่ในรัศมีราว ${TG.R} ม. เดียวกัน (คนละเวลาได้) · กดแถว = แสดงจุดของทุกบัญชีที่ใช้จุดนี้`,
      rows: () => res.spots, sort: "own", csvName: "จุดที่หลายบัญชีใช้ร่วม", lead: false,
      cols: [{ k: "ll", lab: "พิกัด", f: (o) => gmap(o.lat, o.lng), v: (o) => `${o.lat.toFixed(6)}, ${o.lng.toFixed(6)}` }, { k: "own", lab: "เจ้าของบัญชี", n: 1 },
        { k: "ks", lab: "บัญชี (ครั้ง · วัน)", w: 1, f: (o) => [...o.ks.entries()].sort((x, y) => y[1].n - x[1].n).map(([k, a]) => `${accLink(k)} <small>${nf(a.n)} · ${a.days.size} วัน</small>`).join(" "), v: (o) => [...o.ks.entries()].map(([k, a]) => `${geoName(k)} (${a.n} ครั้ง ${a.days.size} วัน)`).join(", ") },
        { k: "n", lab: "รายการ", n: 1 }, { k: "days", lab: "วัน", n: 1 }, { k: "g", lab: "กลุ่ม" }, { k: "t0", lab: "ช่วงวันเวลา", f: (o) => `${dtTh(o.t0)} – ${dtTh(o.t1)}`, range: (o) => [o.t0, o.t1] }],
      click: (o, det) => { TG.sel = { s: o.lat.toFixed(5) + "," + o.lng.toFixed(5) }; drawTg(res);
        table(det, { title: "รายการที่จุดนี้", rows: () => o.rows, sort: "t", desc: false, csvName: "รายการที่จุดร่วม", lead: false, max: 600,
          cols: [{ k: "t", lab: "วันเวลา", f: (q) => dtTh(q.ts), v: (q) => q.ts, date: (q) => q.ts }, { k: "k", lab: "บัญชี", f: (q) => accLink(q.k), v: (q) => geoName(q.k) }, { k: "amt", lab: "ยอด", n: 1, f: (q) => B(q.amt) }, { k: "cp", lab: "โอนไปที่", w: 1 }] }); } }); };

  const draw = () => {
    gSelMerge(A.map((a) => gK(a.acc)), A.filter((a) => F.accs.has(a.i)).map((a) => gK(a.acc)));      // บันทึกชุดบัญชีที่เลือกให้หน้าอื่นใช้ด้วย
    evs = mapFilter(F); inc = coFind(evs, F.R, F.T);
    days = [...new Set(evs.filter((e) => P[e.p].lat != null).map((e) => e.day))].sort();
    $("#pSlider").max = Math.max(0, days.length - 1); if (PL.day > days.length - 1) PL.day = Math.max(0, days.length - 1);
    const hot = new Set(inc.flatMap((x) => x.pl));
    const by = new Map(); evs.forEach((e) => { if (!by.has(e.p)) by.set(e.p, []); by.get(e.p).push(e); });
    const mk = ([p, es]) => { const accs = [...new Set(es.map((e) => e.a))]; return { p, P: P[p], es, n: es.length, amt: es.reduce((s, e) => s + e.amt, 0), accs, own: new Set(accs.map((a) => A[a].key)).size, inf: es.every((e) => e.inf), hot: hot.has(p) }; };
    const all = [...by.entries()].map(mk), shr = all.filter((x) => x.own > 1 && !x.P.weak);
    const T = MAPX.tab, keep = (x) => (T === "sh" ? x.own > 1 && !x.P.weak : T === "co" ? x.hot : true);   // แท็บที่เลือก = สิ่งที่แผนที่แสดง
    const locAll = all.filter((x) => x.P.lat != null), unl = all.filter((x) => x.P.lat == null);
    const loc = locAll.filter(keep);
    MAPX.cur = { locAll, shr, unl };
    $("#mAccN").textContent = F.accs.size === A.length ? "ทั้งหมด" : F.accs.size;
    $("#mCoCtl").hidden = T !== "co";
    const sqAll = seqBuild(evs), nFast = sqAll.filter((s) => s.fast).length;
    const shown = T === "un" ? unl : T === "co" ? inc.map((x) => ({ es: x.es })) : loc, sn = shown.reduce((s, x) => s + x.es.length, 0), sa = shown.reduce((s, x) => s + x.es.reduce((t, e) => t + e.amt, 0), 0);
    $("#mSum").innerHTML = `<b>${nf(sn)}</b> รายการ · <b>${M(sa)}</b>`;
    $("#mSum").title = `จากทั้งหมด ${nf(evs.length)} รายการ ${M(evs.reduce((s, e) => s + e.amt, 0))} · ${days.length} วันที่มีพิกัด`;
    $("#mMoreN").textContent = (F.from || F.to ? 1 : 0) + (F.col === "a" ? 1 : 0) ? ` · ${(F.from || F.to ? 1 : 0) + (F.col === "a" ? 1 : 0)}` : "";
    $("#mTabs").innerHTML = [["pl", `ทุกจุด ${locAll.length}`], ["sh", `ใช้ร่วม ${shr.length}`], ["co", `พร้อมกัน ${inc.length}`], ["sq", `ลำดับเวลา${nFast ? ` · ไม่ทัน ${nFast}` : ""}`], ["un", `ไม่ทราบพิกัด ${unl.length}`], ["gp", `พิกัดจากธนาคาร ${nf(geoRows().length)}`], ["tg", `อยู่ด้วยกัน${tgN()}`]].map(([k, l]) => `<button data-mt="${k}" class="${MAPX.tab === k ? "on" : ""}">${l}</button>`).join("");
    // สี: ตามประเภทรายการ หรือ ตามบัญชี
    const byA = F.col === "a";
    $$("#mCol button").forEach((b) => b.classList.toggle("on", b.dataset.c === F.col));
    if (byA) { const sel = A.filter((a) => F.accs.has(a.i) && evs.some((e) => e.a === a.i));
      $("#mLgC").innerHTML = sel.slice(0, 10).map((a) => `<span><span class="dot" style="background:${a.col}"></span>${esc(a.name.replace(/^(บริษัท|น\.ส\.?|นางสาว|นาย|นาง)\s*/, "").replace(/\s*จำกัด$/, "").slice(0, 20))}</span>`).join("") + (sel.length > 10 ? `<span class="muted">+${sel.length - 10} บัญชี</span>` : ""); }
    else $("#mLgC").innerHTML = Object.entries(MK).filter(([k]) => F.kinds.has(k)).map(([, v]) => `<span><span class="dot" style="background:${v[1]}"></span>${v[0]}</span>`).join("");
    $("#mSqBar").hidden = T !== "sq" || PL.on;
    if (PL.on) { drawRoute(PL.day); drawTable(); return; }
    if (T === "sq") { SQ.all = sqAll; drawSeq(); drawTable(); return; }
    if (T === "tg") { const res = tgCalc(), nl = (v) => res.pairs.filter((o) => o.lv === v).length;
      $("#mSum").innerHTML = `ระยะ ≤ <input class="tin num" type="number" id="tgR" min="20" step="10" value="${TG.R}"> ม. · พร้อมกัน ≤ <input class="tin num" type="number" id="tgT" min="5" step="5" value="${TG.T}"> นาที · คู่ระดับสูง <b>${nl(3)}</b> · กลาง <b>${nl(2)}</b> · ต่ำ ${nl(1)} · กลุ่ม <b>${res.groups.length}</b>`;
      const setN = (id, k, mn) => { $(id).onchange = (e) => { TG[k] = Math.max(mn, +e.target.value || mn); TG.sel = null; draw(); }; }; setN("#tgR", "R", 20); setN("#tgT", "T", 5);
      drawTg(res); drawTgTables(res); return; }
    if (T === "gp") { const { rows, G } = drawGeo(); $("#mSum").innerHTML = `<label class="rqr" title="ค่าเริ่มต้นแสดงทุกรายการ (รวมโอนผ่านแอป = ตำแหน่งโทรศัพท์) — ติ๊กเพื่อดูเฉพาะถอน/ฝากเงินสด (ตำแหน่งตู้/สาขา)"><input type="checkbox" id="mGeoApp" ${F.geoCash ? "checked" : ""}> เฉพาะถอน/ฝากเงินสด</label> · <label class="rqr" title="ค่าเริ่มต้นแสดงทุกบัญชีที่มีพิกัด — ติ๊กเพื่อดูเฉพาะบัญชีที่เลือกไว้ในปุ่ม “บัญชี”"><input type="checkbox" id="mGeoSel" ${F.geoSel ? "checked" : ""}> เฉพาะบัญชีที่เลือก</label> · <b>${nf(rows.length)}</b> รายการ · <b>${nf(G.length)}</b> จุด · <b>${M(rows.reduce((s, r) => s + r.amt, 0))}</b>`;
      $("#mGeoApp").onchange = (e) => { F.geoCash = e.target.checked; fitted = false; draw(); };
      $("#mGeoSel").onchange = (e) => { F.geoSel = e.target.checked; fitted = false; draw(); };
      table($("#mTbl"), { title: "พิกัดผู้ทำรายการ (จากไฟล์ที่ขอตรงจากธนาคาร)", sub: "ธนาคารบันทึกพิกัด lat/long ของผู้ทำรายการ — โอนออกผ่านแอป = ตำแหน่งโทรศัพท์ของเจ้าของบัญชี · ถอน/ฝากเงินสด = ตำแหน่งตู้/สาขา · รับโอน = พิกัดของ<b>ผู้โอน</b> (ตรวจแล้ว: ตรงกับรายการโอนออกของบัญชีผู้โอนทุกรายการ) · ใช้วิเคราะห์พื้นที่เท่านั้น ไม่ต้องขอข้อมูลเพิ่ม · ติ๊ก “เฉพาะถอน/ฝากเงินสด” เพื่อดูเฉพาะตู้/สาขา · รวมจุดที่ห่างกันไม่เกินราว 100 เมตร · มีเฉพาะบัญชีที่มีไฟล์ขอตรงจากธนาคาร · กดแถว = รายการ + เลื่อนแผนที่",
        rows: () => G, sort: "n", csvName: "พิกัดผู้ทำรายการ", lead: false,
        cols: [{ k: "ll", lab: "พิกัด", f: (g) => `${g.lat.toFixed(5)}, ${g.lng.toFixed(5)}`, v: (g) => `${g.lat.toFixed(6)}, ${g.lng.toFixed(6)}` }, { k: "n", lab: "ครั้ง", n: 1 },
          { k: "kc", lab: "ประเภท", w: 1, f: (g) => Object.entries(g.kc).map(([k, n]) => `<span class="badge" style="background:${GK[k][1]}22;color:${GK[k][1]}">${GK[k][0]} ${n}</span>`).join(" "), v: (g) => Object.entries(g.kc).map(([k, n]) => `${GK[k][0]} ${n}`).join(", ") },
          { k: "ks", lab: "บัญชี", w: 1, f: (g) => [...g.ks].slice(0, 3).map(accLink).join(" ") + (g.ks.size > 3 ? ` <small>+${g.ks.size - 3}</small>` : ""), v: (g) => [...g.ks].map(geoName).join(", "), s: (g) => g.ks.size },
          { k: "amt", lab: "ยอด", n: 1, f: (g) => B(g.amt) }, { k: "first", lab: "ช่วงวันเวลา", f: (g) => `${dtTh(g.first)} – ${dtTh(g.last)}`, range: (g) => [g.first, g.last] }],
        click: (g, det) => { map.flyTo([g.lat, g.lng], Math.max(map.getZoom(), 15)); gpDet(g, det); } });
      return; }
    lay.clearLayers(); rlay.clearLayers();
    const mx = Math.max(1, ...loc.map((x) => x.amt));
    loc.sort((a, b) => b.amt - a.amt).forEach((x) => {
      const multi = x.own > 1, kc = {}, ac = {}; x.es.forEach((e) => { kc[e.k] = (kc[e.k] || 0) + e.amt; ac[e.a] = (ac[e.a] || 0) + e.amt; });
      const top = Object.entries(kc).sort((a, b) => b[1] - a[1])[0][0], topA = +Object.entries(ac).sort((a, b) => b[1] - a[1])[0][0];
      const fill = byA ? A[topA].col : multi ? "#FFD403" : MK[top][1];
      const c = L.circleMarker([x.P.lat, x.P.lng], { radius: 7 + Math.sqrt(x.amt / mx) * 24, color: x.hot ? "#B3261E" : multi ? (byA ? "#FFD403" : "#00264D") : "#fff", weight: x.hot ? 3 : multi ? (byA ? 4 : 2.5) : 1.5, dashArray: x.hot ? "5 4" : x.inf || x.P.pv ? "2 4" : null, fillColor: fill, fillOpacity: .78 }).addTo(lay);
      c.bindTooltip(`${esc(x.P.name)} · ${M(x.amt)}`);
      c.bindPopup(() => `<div class="mpop"><b>${esc(x.P.name)}</b><br><small>${x.P.k === "A" ? `ตู้ ${esc(x.P.b)} ${esc(x.P.code)}${x.P.branch ? " · " + esc(x.P.branch) : ""}` : `${x.P.b} รหัส ${esc(x.P.code)}`}${x.P.prov ? " · " + esc(x.P.prov) : ""}${x.inf ? " · ที่ตั้งอนุมาน" : ""}${x.P.pv ? " · พิกัดระดับจังหวัด" : ""}${x.P.addr ? `<br>${esc(x.P.addr)}` : ""}</small>
        <div class="mrow"><span>${nf(x.n)} รายการ</span><b>${B(x.amt)}</b></div>${x.accs.map((a) => { const es = x.es.filter((e) => e.a === a); return `<div class="mrow"><span><span class="dot" style="background:${A[a].col}"></span><a href="#acc/${accK(A[a].acc)}" title="ดูรายละเอียดบัญชี">${esc(A[a].name)}</a></span><b>${es.length} · ${M(es.reduce((s, e) => s + e.amt, 0))}</b></div>`; }).join("")}${x.accs.length > 1 ? `<div>${cmpLink(x.accs.map((i) => accK(A[i].acc)))}</div>` : ""}
        <small>${dS(x.es[0].day)} – ${dS(x.es[x.es.length - 1].day)}${x.hot ? " · <b style='color:#B3261E'>มีเหตุการณ์พร้อมกัน</b>" : ""}</small><br><a href="#" data-pl="${x.p}">ดูรายการ ↓</a></div>`);
    });
    if (!fitted && loc.length) { map.fitBounds(L.latLngBounds(loc.map((x) => [x.P.lat, x.P.lng])).pad(0.15)); fitted = true; }
    drawTable();
  };
  const snapF = () => ({ accs: new Set(F.accs), kinds: new Set(F.kinds), from: F.from, to: F.to, R: F.R, T: F.T, col: F.col, tab: MAPX.tab });
  $("#mCol").addEventListener("click", (e) => { const b = e.target.closest("[data-c]"); if (!b || b.dataset.c === F.col) return; F.col = b.dataset.c; draw(); });
  const save = () => { MAPX.hist.push(snapF()); if (MAPX.hist.length > 50) MAPX.hist.shift(); };
  accList(); showDates(); showKinds(); draw();
  $("#mAccQ").addEventListener("input", accList);
  $("#mPick").addEventListener("change", (e) => { if (e.target.type !== "checkbox") return; save(); const i = +e.target.value; e.target.checked ? F.accs.add(i) : F.accs.delete(i); fitted = false; showDates(); draw(); });
  $("#mPick").addEventListener("click", (e) => { const b = e.target.closest("[data-q]"); if (!b) return; save(); F.accs = new Set(b.dataset.q === "a" ? A.map((a) => a.i) : b.dataset.q === "f" ? A.filter((a) => a.id).map((a) => a.i) : []); fitted = false; accList(); draw(); });
  if (!MAPX.docBound) { MAPX.docBound = true; document.addEventListener("click", (e) => { ["#mPick", "#mMore"].forEach((id) => { const p = $(id); if (p && p.open && !p.contains(e.target)) p.open = false; }); }); }
  // ประเภท: เลือกได้หลายประเภท (อย่างน้อย 1)
  $("#mKinds").addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (!b) return; save(); const k = b.dataset.k;
    if (F.kinds.has(k) && F.kinds.size > 1) F.kinds.delete(k); else F.kinds.add(k); showKinds(); showDates(); fitted = false; draw(); });
  const bindD = (id, k) => $(id).addEventListener("change", (e) => { save(); F[k] = e.target.value; if (F.from && F.to && F.from > F.to) { const t = F.from; F.from = F.to; F.to = t; } showDates(); fitted = false; PL.day = 0; draw(); });
  bindD("#mFrom", "from"); bindD("#mTo", "to");
  const bindN = (id, k) => $(id).addEventListener("change", (e) => { save(); F[k] = Math.max(0, +e.target.value || 0); draw(); });
  bindN("#mR", "R"); bindN("#mT", "T");
  $("#mReset").onclick = () => { save(); Object.assign(F, { kinds: new Set(Object.keys(MK)), from: "", to: "", R: 5, T: 60, accs: new Set(A.filter((a) => a.id).map((a) => a.i)) }); MAPX.tab = "pl"; PL.on = false; PL.day = 0; render(); };
  const pickTab = (t) => { if (t === MAPX.tab) return; save(); MAPX.tab = t; draw(); };
  $("#mTabs").addEventListener("click", (e) => { const b = e.target.closest("[data-mt]"); if (b) pickTab(b.dataset.mt); });
  $$(".lg [data-mt]", m).forEach((b) => b.addEventListener("click", () => { pickTab(b.dataset.mt); $("#mTabs").scrollIntoView({ behavior: "smooth", block: "nearest" }); }));
  // ตัวเล่น
  $("#pPlay").onclick = () => { if (!days.length) return toast("ไม่มีวันที่มีพิกัดในตัวกรองนี้");
    enterPlay(); if (PL.run) return pause(); PL.run = true; $("#pPlay").textContent = "⏸"; if (PL.day >= days.length - 1) PL.day = 0; drawRoute(PL.day); PL.timer = setTimeout(tick, PL.ms); };
  $("#pPrev").onclick = () => { if (!days.length) return; enterPlay(); pause(); PL.day = Math.max(0, PL.day - 1); drawRoute(PL.day); };
  $("#pNext").onclick = () => { if (!days.length) return; enterPlay(); pause(); PL.day = Math.min(days.length - 1, PL.day + 1); drawRoute(PL.day); };
  $("#pSlider").oninput = (e) => { if (!days.length) return; enterPlay(); pause(); PL.day = +e.target.value; drawRoute(PL.day); };
  $("#pSpeed").value = String(PL.ms); $("#pSpeed").onchange = (e) => { PL.ms = +e.target.value; };
  $("#pCum").classList.toggle("on", PL.cum); $("#pCum").onclick = () => { PL.cum = !PL.cum; $("#pCum").classList.toggle("on", PL.cum); if (PL.on) drawRoute(PL.day); };
  $("#pExit").onclick = exitPlay;
  m.onclick = (e) => { const a = e.target.closest("[data-pl]"); if (!a) return; e.preventDefault(); const p = +a.dataset.pl; MAPX.tab = "pl"; draw();
    const row = [...$("#mTbl").querySelectorAll("tbody tr")].find((tr, i) => $("#mTbl table")._rows[i] && $("#mTbl table")._rows[i].p === p); if (row) { row.scrollIntoView({ block: "nearest" }); row.click(); } };
}
function stopPlay() { if (MAPX.stop) MAPX.stop(); MAPX.play.on = false; MAPX.play.run = false; }
