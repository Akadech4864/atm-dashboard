/* CIB ATM Dashboard — วิเคราะห์สาขา/ตู้ที่ฝากเงินเข้าบัญชีเป้าหมาย ; ข้อมูลเข้ารหัส (AES-GCM) ถอดด้วยรหัสผ่านในเบราว์เซอร์เท่านั้น */
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nf = (v, d = 0) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const M = (x) => { const v = Number(x || 0), a = Math.abs(v); if (!a) return "0"; if (a < 1e3) return nf(v); if (a < 99950) return nf(v / 1e3, a < 1e4 ? 2 : 1) + "k"; return nf(v / 1e6, 2) + " ล."; };
const B = (x) => nf(x, 2);
const MTH = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const dTh = (iso) => { if (!iso) return ""; const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return `${d} ${MTH[m]} ${String(y + 543).slice(2)}`; };
const dtTh = (iso) => iso ? `${dTh(iso)} ${String(iso).slice(11, 19)}` : "";      // แสดงถึงหลักวินาที (ถ้าข้อมูลมี)
const toast = (t) => { const e = $("#toast"); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (e.hidden = true), 3000); };

let KEY = null, DB = null, CH = [];
/* อัปเดตเว็บอัตโนมัติ (ผู้สั่งงาน 28 พ.ย. 69): เทียบ <meta name="site-ver"> ของหน้าที่เปิดอยู่กับ version.txt ล่าสุด
   ตอนเปิดหน้า + ตอนกลับมาที่แท็บ (ห่างกันอย่างน้อย 3 นาที) — ไม่ตรง = โหลดรุ่นใหม่ (เข้าระบบค้างไว้ได้ เพราะกุญแจอยู่ใน sessionStorage) */
(() => {
  const SV = (document.querySelector('meta[name="site-ver"]') || {}).content || ""; let last = 0;
  const chk = async () => {
    if (!SV || Date.now() - last < 180000) return; last = Date.now();
    try {
      const r = await fetch("version.txt?t=" + Date.now(), { cache: "no-store" }); if (!r.ok) return;
      const v = (await r.text()).trim(), k = "atm_reload_" + v;
      if (v && v !== SV && !sessionStorage.getItem(k)) { sessionStorage.setItem(k, "1"); location.replace(location.pathname + "?v=" + encodeURIComponent(v) + location.hash); }
    } catch (e) { }
  };
  chk(); document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") chk(); });
})();
const ITER = 600000;

/* ---------- ถอดรหัส (รูปแบบเดียวกับแอพเดิม: "CIB1" + salt + iv + ciphertext ; gzip JSON) ---------- */
async function deriveKey(pass, salt) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, true, ["decrypt"]);
}
async function fetchEnc(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("โหลดข้อมูลไม่ได้ (" + r.status + ")");
  const b = new Uint8Array(await r.arrayBuffer());
  if (String.fromCharCode(...b.slice(0, 4)) !== "CIB1") throw new Error("รูปแบบไฟล์ไม่ถูกต้อง");
  return { salt: b.slice(4, 20), iv: b.slice(20, 32), ct: b.slice(32) };
}
async function gunzipJSON(buf) {
  const ds = new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip")));
  return JSON.parse(await ds.text());
}
async function unlock(pass, rawKey) {
  const f = await fetchEnc("data.enc");
  KEY = rawKey ? await crypto.subtle.importKey("raw", rawKey, "AES-GCM", true, ["decrypt"]) : await deriveKey(pass, f.salt);
  DB = await gunzipJSON(await crypto.subtle.decrypt({ name: "AES-GCM", iv: f.iv }, KEY, f.ct));
  if (!rawKey) { try { sessionStorage.setItem("atm_k", btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey("raw", KEY))))); } catch (e) { } }
}
/* ระบบเฝ้าเว็บ (27 พ.ย. 69 ; Apps Script ชุดเดียวกับเว็บแอพคดี): แจ้ง "รหัสผิด" / "เข้าสำเร็จ" ไปที่ window.GUARD_URL (guard.js) — ไม่ส่งรหัสที่พิมพ์ */
function guardPing(t) {
  try {
    const u = window.GUARD_URL; if (!u || !navigator.sendBeacon) return;
    let d = ""; try { d = localStorage.getItem("cib_dev") || ""; if (!d) { d = Math.random().toString(36).slice(2, 12); localStorage.setItem("cib_dev", d); } } catch (e) { }
    navigator.sendBeacon(u, JSON.stringify({ t, s: "atm-dashboard", d, ua: navigator.userAgent.slice(0, 150) }));
  } catch (e) { }
}
$("#loginForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const btn = $("#loginBtn"), msg = $("#loginMsg");
  btn.disabled = true; msg.textContent = "กำลังถอดรหัสข้อมูล…";
  try { await unlock($("#pw").value); msg.textContent = ""; guardPing("ok"); start(); }
  catch (e) { KEY = null; if (e.name === "OperationError") guardPing("fail"); msg.textContent = e.name === "OperationError" ? "รหัสผ่านไม่ถูกต้อง" : "ผิดพลาด: " + e.message; }
  btn.disabled = false; $("#pw").value = "";
});
(async () => {
  let k = null; try { k = sessionStorage.getItem("atm_k"); } catch (e) { }
  if (!k) return;
  if (document.readyState === "loading") await new Promise((r) => document.addEventListener("DOMContentLoaded", r, { once: true }));   // รอสคริปต์ทุกไฟล์โหลดครบก่อนเริ่มแอพ
  try { await unlock(null, Uint8Array.from(atob(k), (c) => c.charCodeAt(0))); start(); } catch (e) { try { sessionStorage.removeItem("atm_k"); } catch (e2) { } }
})();

/* ---------- ไอคอน ---------- */
const ICP = {
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>', home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  bank: '<path d="M3 10h18L12 4 3 10z"/><path d="M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18"/>', atm: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M7 20h10M9 16v4M15 16v4M7 9h10"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>', net: '<circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="5" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M7.3 11l9.4-4.6M7.3 13l9.4 4.6"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', todo: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>', moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  back: '<path d="M15 18l-6-6 6-6"/>', out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>', pin: '<path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  dl: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
};
const FUNNEL = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 4h18l-7 8.5V20l-4-2v-5.5z"/></svg>';
const IC = (n, s = 20) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICP[n] || ""}</svg>`;

/* ---------- ค่าคงที่การแสดงผล ---------- */
const KC = { CASH_OTHER: "#B3261E", CASH_OWN: "#E08A00", COUNTER: "#6A1B9A", ATMX: "#1565C0", APP: "#2E7D32", OTHERIN: "#9E9E9E", OUT: "#455A64" };
const KL = { CASH_OTHER: "เงินสด ตู้ต่างธนาคาร", CASH_OWN: "เงินสด ตู้ธนาคารเจ้าของบัญชี", COUNTER: "เคาน์เตอร์สาขา", ATMX: "โอนผ่านตู้ ATM (ระบุบัญชี)", APP: "โอนแอป/ออนไลน์", OTHERIN: "อื่น ๆ", OUT: "เงินออก" };
const ROLE = { L1: "ผู้ควบคุม/หัวหน้า (สันนิษฐาน)", L2: "ผู้ประสาน/คุมหลายบัญชี", L3: "ผู้ปฏิบัติ/เจ้าของบัญชีโอน" };
const ACOL = { ykk: "#1565C0", kes: "#C2185B", ora: "#2E7D32" };
const kb = (k) => `<span class="kb" style="background:${KC[k] || "#999"}">${esc(KL[k] || k)}</span>`;
/* รหัสตู้: รหัสไม่ครบ (ไม่ระบุเครื่องเฉพาะ) แสดงกรอบประ + คำเตือน */
const GEN_TIP = "รหัสไม่ครบ — ไฟล์ธนาคารเก็บรหัสเครื่องได้ 6 ตัวอักษร (ลงท้าย … = ถูกตัดจากรหัสจริง) จึงระบุเครื่องเฉพาะไม่ได้ ต้องขอรหัสเครื่องเต็มจากธนาคาร";
const isGen = (c) => { c = String(c || "").trim(); return !c || /…$/.test(c) || /^([A-Z]\d{3}B\d|S\dB\d{3}|\d{3}-\d{2}|TR ?fr|BATCH|0+|-00 ?Cardle.*)$/i.test(c) || c.replace(/[^0-9A-Za-z]/g, "").length < 4; };
const mcode = (c, g) => (g ?? isGen(c)) ? `<span class="gcode" title="${GEN_TIP}">${esc(c)}</span>` : esc(c);
const routeH = (r) => `<div class="route">${r.map((c) => (isGen(c) ? `<span class="g" title="${GEN_TIP}">${esc(c)}</span>` : `<span>${esc(c)}</span>`)).join("<i>›</i>")}</div>`;
const isCash = (k) => k === "CASH_OTHER" || k === "CASH_OWN" || k === "COUNTER";
const acOf = (id) => DB.acs.find((a) => a.id === id);
const acTag = (id) => { const a = acOf(id); return a ? `<a class="badge" href="#acc/${accK(a.acc)}" title="ดูรายละเอียดบัญชี" style="background:${ACOL[id]}1f;color:${ACOL[id]}">${av(a.name)}${a.no}. ${esc(a.short)}</a>` : esc(id); };
/* รูปบุคคล (DB.ph) จับคู่ด้วยชื่อ-นามสกุล ; ชื่อที่มีหลายคนไม่แสดงรูป แสดงจำนวนคนแทน */
const phKey = (n) => String(n || "").replace(/\s+/g, "").replace(/^(นางสาว|น\.ส\.?|นาย|นาง|MR\.?|MRS\.?|MS\.?|MISS)/, "");
const phOf = (n) => { const p = DB && DB.ph; if (!p || !n) return null; const k = phKey(n); return p.img && p.img[k] ? { src: p.img[k], mb: (p.maybe || {})[k] || "" } : p.dup && p.dup[k] ? { dup: p.dup[k] } : null; };
const av = (n, cls = "") => { const p = phOf(n); return !p ? "" : p.src ? `<img class="av ${cls}${p.mb ? " mb" : ""}" src="${p.src}" alt="" data-av="${esc(n)}" title="${p.mb ? "ยังไม่ยืนยันตัวบุคคล — " + esc(p.mb) : "รูปจากข้อมูลบุคคล (จับคู่ด้วยชื่อ)"} — แตะเพื่อขยาย">` : `<span class="avq" title="ข้อมูลบุคคลมี ${p.dup} คนที่ชื่อนี้ — ยังไม่ยืนยันว่าเป็นคนใด จึงไม่แสดงรูป">${p.dup} คน?</span>`; };
function showPhoto(n) { const p = phOf(n); if (!p || !p.src) return; const d = document.createElement("div"); d.className = "phbox"; d.innerHTML = `<figure><img src="${p.src}" alt=""><figcaption><b>${esc(n)}</b><br>${p.mb ? `<small class="mbw">⚠ ยังไม่ยืนยันตัวบุคคล: ${esc(p.mb)}</small><br>` : ""}<small>รูปจากข้อมูลบุคคลในสำนวน · จับคู่ด้วยชื่อ-นามสกุล (ต้องยืนยันกับข้อมูลเปิดบัญชีของธนาคาร)</small></figcaption></figure>`; d.onclick = () => d.remove(); document.body.appendChild(d); }
/* บัญชีที่เลือก ใช้ร่วมทุกหน้า (แผนที่ · รายละเอียดบัญชี · ขอข้อมูล) — เก็บเป็นเลขบัญชีตัด 0 นำหน้า */
const SELK = "atm_sel_accs", gK = (a) => String(a || "").replace(/^0+/, "");
function gSel() { if (window._gsel === undefined) { let v = null; try { v = JSON.parse(localStorage.getItem(SELK)); } catch (e) { } window._gsel = Array.isArray(v) ? v : null; } return window._gsel; }
function gSelSet(keys) { window._gsel = [...new Set(keys)]; try { localStorage.setItem(SELK, JSON.stringify(window._gsel)); } catch (e) { } }
/* หน้าที่มีบัญชีให้เลือกเพียงบางส่วน (เช่น แผนที่ = บัญชีที่มีจุด) : แทนที่เฉพาะบัญชีของหน้านั้น บัญชีอื่นที่เลือกไว้ยังอยู่ */
function gSelMerge(allKeys, chosen) { const all = new Set(allKeys); gSelSet([...(gSel() || []).filter((k) => !all.has(k)), ...chosen]); }
/* ประเภทแหล่งข้อมูลของบัญชี (template04 / ขอตรงจากธนาคาร มีพิกัด) */
const srcTag = (acc) => { const k = gK(acc), f = (DB.srcf || {})[k] || [], g = ((DB.geo || {})[k] || []).length;
  return f.map((x) => (x === "bank" ? `<span class="badge src-b" title="ไฟล์ที่ขอตรงจากธนาคาร — มีพิกัดผู้ทำรายการ (lat/long)">ขอตรงธนาคาร${g ? ` · พิกัด ${nf(g)}` : ""}${(DB.extra || {})[k] ? ` · เติม ${nf(DB.extra[k])} รายการ` : ""}</span>` : `<span class="badge src-t" title="ไฟล์รูปแบบกลาง template04">template04</span>`)).join(" "); };
/* ตราธนาคาร: ป้ายสีประจำธนาคาร + อักษรย่อ (ไม่ใช้รูปโลโก้จริง) ; ธนาคารต่างประเทศ (รหัส SWIFT) = ธงประเทศ */
const BANK_MK = { KBANK: ["#138F2D", "#fff", "K+"], SCB: ["#4E2E7F", "#fff", "SCB"], KTB: ["#1BA5E1", "#fff", "KTB"], BBL: ["#1E4598", "#fff", "BBL"], BAY: ["#FEC43B", "#5A4A42", "BAY"],
  GSB: ["#EB198D", "#fff", "GSB"], TTB: ["#0050F0", "#FF8A00", "ttb"], BAAC: ["#4B9B2E", "#fff", "ธกส"], GHB: ["#F57D23", "#fff", "GHB"], KKP: ["#594F74", "#fff", "KKP"],
  CIMB: ["#7E2F36", "#fff", "CIMB"], UOB: ["#0B3979", "#fff", "UOB"], LHB: ["#6D6E71", "#fff", "LH"], TISCO: ["#12549F", "#fff", "TIS"], TCRB: ["#0A4AB3", "#fff", "TCR"], ICBC: ["#C50F1D", "#fff", "ICBC"], IBANK: ["#0B6E4F", "#fff", "isl"] };
const BANK_ALIAS = { KBNK: "KBANK", "004": "KBANK", KASIKORN: "KBANK", "014": "SCB", SCBA: "SCB", "006": "KTB", KTBA: "KTB", "002": "BBL", BBLA: "BBL", "025": "BAY", BAYA: "BAY", "030": "GSB", "30": "GSB", GSBA: "GSB",
  TMB: "TTB", TMBA: "TTB", TTBA: "TTB", "011": "TTB", "065": "TTB", "034": "BAAC", "033": "GHB", "069": "KKP", KKBA: "KKP", KK: "KKP", "022": "CIMB", CIMBT: "CIMB", "024": "UOB", UOBT: "UOB", "073": "LHB", LH: "LHB", "067": "TISCO", "070": "ICBC", "066": "IBANK", "071": "TCRB", "031": "HSBC" };
const bankKey = (b) => { const u = String(b || "").trim().toUpperCase(); return BANK_MK[u] ? u : BANK_ALIAS[u] || BANK_ALIAS[u.replace(/^0+/, "")] || ""; };
const swiftCC = (b) => { const u = String(b || "").trim().toUpperCase(); return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(u) && u.slice(4, 6) !== "TH" ? u.slice(4, 6) : ""; };
const CC_TH = { HK: "ฮ่องกง", MY: "มาเลเซีย", CN: "จีน", SG: "สิงคโปร์", KH: "กัมพูชา", LA: "ลาว", MM: "เมียนมา", VN: "เวียดนาม", PH: "ฟิลิปปินส์", ID: "อินโดนีเซีย", JP: "ญี่ปุ่น", KR: "เกาหลีใต้", TW: "ไต้หวัน", US: "สหรัฐฯ", GB: "อังกฤษ", AE: "สหรัฐอาหรับฯ" };
/* ธงแบบย่อ (viewBox 30x20) */
const flagInner = (cc) => { const st = (cs) => cs.map((c, i) => `<rect y="${i * 20 / cs.length}" width="30" height="${20 / cs.length + 0.2}" fill="${c}"/>`).join(""), star = (cx, cy, r, f) => { let d = ""; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r; d += (i ? "L" : "M") + (cx + rr * Math.cos(a)).toFixed(2) + "," + (cy + rr * Math.sin(a)).toFixed(2); } return `<path d="${d}Z" fill="${f}"/>`; };
  switch (cc) {
    case "HK": return `<rect width="30" height="20" fill="#DE2910"/>${[0, 1, 2, 3, 4].map((i) => `<ellipse cx="15" cy="6.6" rx="1.9" ry="3.4" fill="#fff" transform="rotate(${i * 72} 15 10)"/>`).join("")}`;
    case "MY": return `${st(["#CC0001", "#fff", "#CC0001", "#fff", "#CC0001", "#fff", "#CC0001", "#fff", "#CC0001", "#fff", "#CC0001", "#fff", "#CC0001", "#fff"])}<rect width="15" height="11.4" fill="#010066"/><circle cx="6.5" cy="5.7" r="3.6" fill="#FC0"/><circle cx="7.6" cy="5.7" r="3" fill="#010066"/>${star(11.3, 5.7, 2.4, "#FC0")}`;
    case "CN": return `<rect width="30" height="20" fill="#DE2910"/>${star(6, 5.5, 3.3, "#FFDE00")}`;
    case "VN": return `<rect width="30" height="20" fill="#DA251D"/>${star(15, 10.5, 6, "#FF0")}`;
    case "SG": return `${st(["#EF3340", "#fff"])}<circle cx="6.2" cy="5" r="3.3" fill="#fff"/><circle cx="7.4" cy="5" r="3" fill="#EF3340"/>`;
    case "KH": return `${st(["#032EA1", "#E00025", "#E00025", "#032EA1"])}<path d="M10 13h10l-1-2h-1.5l-.8-3h-1.2l-.5-2-.5 2h-1.2l-.8 3H12z" fill="#fff"/>`;
    case "LA": return `${st(["#CE1126", "#002868", "#002868", "#CE1126"])}<circle cx="15" cy="10" r="4" fill="#fff"/>`;
    case "MM": return `${st(["#FECB00", "#34B233", "#EA2839"])}${star(15, 10.8, 6.2, "#fff")}`;
    case "ID": return st(["#CE1126", "#fff"]);
    case "PH": return `${st(["#0038A8", "#CE1126"])}<path d="M0 0L13 10L0 20Z" fill="#fff"/><circle cx="4.5" cy="10" r="1.8" fill="#FCD116"/>`;
    case "JP": return `<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#BC002D"/>`;
    case "TW": return `<rect width="30" height="20" fill="#FE0000"/><rect width="15" height="10" fill="#000095"/><circle cx="7.5" cy="5" r="2.6" fill="#fff"/>`;
    case "US": return `${st(["#B22234", "#fff", "#B22234", "#fff", "#B22234", "#fff", "#B22234", "#fff", "#B22234", "#fff", "#B22234", "#fff", "#B22234"])}<rect width="12" height="10.8" fill="#3C3B6E"/>`;
    case "GB": return `<rect width="30" height="20" fill="#012169"/><path d="M0 0L30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0L30 20M30 0L0 20" stroke="#C8102E" stroke-width="1.6"/><path d="M15 0V20M0 10H30" stroke="#fff" stroke-width="6"/><path d="M15 0V20M0 10H30" stroke="#C8102E" stroke-width="3.4"/>`;
    case "KR": return `<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="5" fill="#CD2E3A"/><path d="M10 10a2.5 2.5 0 0 0 5 0a2.5 2.5 0 0 1 5 0a5 5 0 0 1-10 0z" fill="#0047A0"/>`;
    case "AE": return `${st(["#00732F", "#fff", "#000"])}<rect width="8" height="20" fill="#FF0000"/>`;
    default: return `<rect width="30" height="20" fill="#ECEFF1"/><text x="15" y="14" font-size="10" font-weight="700" text-anchor="middle" fill="#37474F">${esc(cc)}</text>`; } };
/* ใช้ในผัง (svg) : x,y = มุมซ้ายบน, h = ความสูง ; คืน [svg, ความกว้าง] */
const logoKey = (b) => { if (typeof BANK_LOGO === "undefined") return ""; const k = bankKey(b); if (k && BANK_LOGO[k]) return k; const u = String(b || "").trim().toUpperCase();
  const f = /^HSBC/.test(u) ? "HSBC" : /^RHB/.test(u) ? "RHB" : /^(ICBK|ICBC)/.test(u) ? "ICBC" : ""; return f && BANK_LOGO[f] ? f : ""; };
const logoW = (k, h) => h * Math.min(3.4, (typeof BANK_LOGO_AR !== "undefined" && BANK_LOGO_AR[k]) || 1);
const bankMarkSvg = (b, x, y, h = 14) => { const cc = swiftCC(b), lk = logoKey(b);
  if (cc) { const w = h * 1.5, lw = lk ? logoW(lk, h) : 0; return [`<g class="bmk"><title>${esc(CC_TH[cc] || cc)} · ${esc(b)}</title><svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 30 20">${flagInner(cc)}</svg><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#90A4AE" stroke-width=".6"/>${lk ? `<image href="${BANK_LOGO[lk]}" x="${(x + w + 3).toFixed(1)}" y="${y}" width="${lw.toFixed(1)}" height="${h}"/>` : ""}</g>`, w + (lk ? lw + 3 : 0)]; }
  if (lk) { const w = logoW(lk, h); return [`<g class="bmk"><title>${esc(lk)}</title><image href="${BANK_LOGO[lk]}" x="${x}" y="${y}" width="${w.toFixed(1)}" height="${h}"/></g>`, w]; }
  const k = bankKey(b); if (!k) return ["", 0]; const m = BANK_MK[k], w = Math.max(h * 1.55, m[2].length * h * 0.42 + 6);
  return [`<g class="bmk"><title>${esc(k)}</title><rect x="${x}" y="${y}" width="${w.toFixed(1)}" height="${h}" rx="${(h / 2.6).toFixed(1)}" fill="${m[0]}"/><text x="${(x + w / 2).toFixed(1)}" y="${(y + h * 0.72).toFixed(1)}" font-size="${(h * 0.6).toFixed(1)}" font-weight="900" text-anchor="middle" fill="${m[1]}" font-family="Arial, sans-serif">${esc(m[2])}</text></g>`, w]; };
/* ใช้ในตาราง (html) */
const bankLogoImg = (k, h = 16) => `<img class="bico logo" src="${BANK_LOGO[k]}" width="${logoW(k, h).toFixed(0)}" height="${h}" alt="${esc(k)}" title="${esc(k)}">`;
const bankIco = (b) => { const cc = swiftCC(b), lk = logoKey(b); if (cc) return `<svg class="bico flag" viewBox="0 0 30 20" width="21" height="14" aria-label="${esc(CC_TH[cc] || cc)}"><title>${esc(CC_TH[cc] || cc)}</title>${flagInner(cc)}</svg>` + (lk ? bankLogoImg(lk) : "");
  if (lk) return bankLogoImg(lk);
  const k = bankKey(b); if (!k) return ""; const m = BANK_MK[k], w = Math.max(22, m[2].length * 6 + 7);
  return `<svg class="bico" viewBox="0 0 ${w} 14" width="${w}" height="14" aria-label="${esc(k)}"><title>${esc(k)}</title><rect width="${w}" height="14" rx="5" fill="${m[0]}"/><text x="${w / 2}" y="10.2" font-size="8.4" font-weight="900" text-anchor="middle" fill="${m[1]}" font-family="Arial, sans-serif">${esc(m[2])}</text></svg>`; };
const bankTh = (b) => (DB.bank_th[b] ? `${b} (${DB.bank_th[b]})` : b || "-");

/* ---------- ตารางกลาง: เรียง / ค้นหา / ส่งออก CSV ---------- */
function table(host, cfg) {
  const st = { k: cfg.sort || null, d: cfg.desc === false ? 1 : -1, q: "", sel: null, cf: {} };
  const id = "t" + Math.random().toString(36).slice(2, 8);
  /* จอเล็กดูยอดได้ทันที: ย้ายคอลัมน์ "ครั้ง/ยอด" มาไว้ต้นตาราง (หลังคอลัมน์ชื่อ/รหัส) */
  if (cfg.lead !== false && cfg.cols.some((c) => c.k === "amt")) {
    const mv = cfg.cols.filter((c) => c.k === "n" || c.k === "amt"), rest = cfg.cols.filter((c) => !mv.includes(c));
    const wi = rest.findIndex((c) => c.w), pos = wi >= 0 && wi <= 1 ? wi + 1 : wi === 2 ? 2 : Math.min(3, rest.length);
    cfg.cols = [...rest.slice(0, pos), ...mv, ...rest.slice(pos)];
  }
  const isDet = host.matches("[data-det]");          // ตารางรายการย่อย (เปิดจากการกดแถว) = ปุ่มปิด แทนปุ่มย้อนกลับ/ล้าง
  host.innerHTML = `<div class="hd"><h2>${cfg.title || ""}${cfg.sub ? `<details class="info"><summary title="คำอธิบาย" aria-label="คำอธิบาย">i</summary><div class="info-box">${cfg.sub}</div></details>` : ""}${cfg.note && !cfg.noteShow ? `<details class="info lbl"><summary title="คำอธิบาย / สัญลักษณ์">คำอธิบาย / สัญลักษณ์</summary><div class="info-box">${cfg.note}</div></details>` : ""}</h2><div class="tools">
    ${cfg.search === false ? "" : `<input class="tin" type="search" placeholder="ค้นหา" data-q>`}
    ${cfg.extra || ""}<span class="tgrp"><button class="tb" data-undo hidden disabled></button><button class="tb" data-reset title="ล้างการค้นหา/ตัวกรอง/การเรียง กลับค่าเริ่มต้น" disabled ${isDet ? "hidden" : ""}>ล้าง</button><details class="xmenu"><summary class="tb ic" title="ส่งออกตาราง (Excel / CSV)" aria-label="ส่งออก">${IC("dl", 16)}</summary><div class="xm-box"><button class="tb xl" data-xls>Excel (.xlsx)</button><button class="tb" data-csv>CSV</button></div></details>${isDet ? `<button class="tb ic" data-close-det title="ปิดตารางรายการย่อย" aria-label="ปิด">✕</button>` : ""}</span></div></div>
    ${cfg.note && cfg.noteShow ? `<p class="note">${cfg.note}</p>` : ""}
    <style data-fit></style><div class="tblwrap mh"><div class="tbly"><table id="${id}"><thead></thead><tbody></tbody></table></div></div><div class="note" data-cnt></div><div data-det></div>`;
  if (isDet) $("[data-close-det]", host).addEventListener("click", () => { const par = host.parentElement; host.innerHTML = ""; if (par) $$("tr.sel", par).forEach((t) => t.classList.remove("sel")); });
  const tb = $(`#${id}`, host);
  /* ---------- ความกว้างคอลัมน์ยืดหยุ่นตามพื้นที่จริงของตาราง (คอม / แท็บเล็ต / มือถือ / หุบ-กางเมนูข้าง) ----------
     วัดความกว้างธรรมชาติ (ไม่ตัดบรรทัด) ของทุกคอลัมน์ แล้วเทียบกับความกว้างกล่องตาราง:
       พอดี            -> ไม่ตัดบรรทัดเลย (ที่เหลือให้คอลัมน์ข้อความยาว / ช่องเติมท้าย)
       เกิน แต่หดได้  -> คอลัมน์ข้อความ (w = ข้อความยาว, และคอลัมน์ข้อความที่กว้าง) หดลง + ขึ้นบรรทัดใหม่ จนตารางพอดีกล่อง
       ยังเกิน         -> คอลัมน์ข้อความใช้ความกว้างต่ำสุด (ไม่เกิน ~3-5 บรรทัด) แล้วเลื่อนแนวนอนเท่าที่จำเป็น
     คอลัมน์ตัวเลข / วันที่ / ปุ่ม / ช่องเลือก ไม่ตัดบรรทัด (c.fx = บังคับไม่ตัดบรรทัด) */
  const wr = $(".tblwrap", host), ly = $(".tbly", host), fsEl = $("style[data-fit]", host);
  let fitW = -1, fitT = 0, fitN = 0;
  const fit = (pass, Wo, cmp) => { fitT = 0; const W = Wo || wr.clientWidth, hr = tb.tHead.rows[0]; if (!W || !hr || !hr.cells.length) return;
    if (!cmp) ly.classList.remove("cmp");
    const VC = cfg.cols.filter((c) => !c.hide), ths = [...hr.cells], sx = wr.scrollLeft, sy = window.scrollY, s1 = wr.scrollTop, s2 = ly.scrollTop, body = tb.tBodies[0];
    const ctl = (i) => !!body.querySelector(`tr:nth-child(-n+40)>td:nth-child(${i + 1}) :is(select,input,button,textarea)`);
    const kind = ths.map((th, i) => { const c = VC[i]; return !c || c.fx || c.n || c.c || c.bare ? 0 : c.w ? 2 : ctl(i) ? 0 : 1; });      // 0 = ไม่ตัดบรรทัด · 1 = ข้อความ · 2 = ข้อความยาว
    /* วัด 2 รอบ: (ก) กว้างธรรมชาติ ไม่ตัดบรรทัดเลย + กว้างของหัวคอลัมน์  (ข) กว้างต่ำสุดจริง เมื่อหัวคอลัมน์และคอลัมน์ข้อความขึ้นบรรทัดใหม่ได้ (ป้ายชื่อ/โลโก้/ปุ่มที่ตัดไม่ได้ยังเต็มขนาด)
       ตารางใหญ่: วัดจากแถวตัวอย่าง (60 แถวแรก + แถวที่ข้อความยาวสุด 2 อันดับของแต่ละคอลัมน์) -> เร็วขึ้นหลายเท่า */
    const R = body.rows, NR = R.length; let samp = null;
    if (NR * ths.length > 2500) { const keep = new Set(), best = ths.map(() => [0, -1, 0, -1]); for (let r = 0; r < Math.min(60, NR); r++) keep.add(r);
      for (let r = 0; r < NR; r++) { const cl = R[r].cells; for (let c = 0; c < cl.length && c < best.length; c++) { const L = cl[c].textContent.length, b = best[c]; if (L > b[0]) { b[2] = b[0]; b[3] = b[1]; b[0] = L; b[1] = r; } else if (L > b[2]) { b[2] = L; b[3] = r; } } }
      best.forEach((b) => { if (b[1] >= 0) keep.add(b[1]); if (b[3] >= 0) keep.add(b[3]); });
      samp = [...keep].map((r) => R[r]); samp.forEach((tr) => tr.classList.add("fk")); ly.classList.add("smp"); }
    const done = () => { if (samp) { samp.forEach((tr) => tr.classList.remove("fk")); ly.classList.remove("smp"); }
      wr.scrollLeft = sx; wr.scrollTop = s1; ly.scrollTop = s2; if (Math.abs(window.scrollY - sy) > 1) window.scrollTo(0, sy);
      fitW = wr.clientWidth; if (pass) return;
      if (ly.classList.contains("fitw") && ly.clientWidth < W - 1 && tb.offsetWidth > ly.clientWidth + 1) return fit(1, ly.clientWidth);   // แถบเลื่อนแนวตั้งของกล่องในกินที่ -> จัดซ้ำตามที่เหลือ
      if (Math.abs(fitW - W) > 1) fit(1); };                                                // แถบเลื่อนแนวตั้งโผล่/หาย หลังจัด -> จัดซ้ำ 1 รอบตามความกว้างใหม่
    fsEl.textContent = ""; tb.style.width = ""; ly.classList.remove("fitw"); ly.classList.add("tm");
    const nat = ths.map((th) => Math.ceil(th.getBoundingClientRect().width));
    if (nat.reduce((q, v) => q + v, 0) <= W + 1) { ly.classList.remove("tm"); return done(); }                 // พอดีอยู่แล้ว ไม่ต้องตัดบรรทัด
    const rg = document.createRange(), cs = getComputedStyle(ths[0]), pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const hn = ths.map((th) => { if (!th.firstChild) return 0; rg.selectNodeContents(th); return Math.ceil(rg.getBoundingClientRect().width + pad) + 2; });
    ly.classList.replace("tm", "tn"); fsEl.textContent = kind.map((k, i) => (k ? "" : `#${id}>tbody>tr>td:nth-child(${i + 1}){white-space:nowrap!important}`)).join("");
    const hard = ths.map((th) => Math.ceil(th.getBoundingClientRect().width) + 1);
    fsEl.textContent = ""; ly.classList.remove("tn");
    const small = W < 640, tight = W < 900;
    /* แผนความกว้าง (ข้อความไม่เกิน 2 บรรทัด): 0 = ตัดเฉพาะคอลัมน์ข้อความยาว · 1 = คอลัมน์ข้อความขนาดกลางด้วย · 2 = ทุกคอลัมน์ข้อความ + หัวคอลัมน์ 2 บรรทัด
       ข้อความยาวมากจน 2 บรรทัดยังกว้างเกิน (CAP) -> กว้างเท่า CAP แล้วตัดเหลือ 2 บรรทัด (…) แตะเพื่อดูทั้งหมด */
    const two = (n) => Math.ceil((n - pad) * 0.56) + pad, CAP = small ? Math.max(150, Math.floor(W * 0.78)) : Math.max(220, Math.min(520, Math.floor(W * 0.45)));
    const plan = (t) => { const hw = false, TS = (small ? [136, 96, 0] : [180, 120, 0])[t];
      let fx = 0, mn = 0, nt = 0; const fl = [];
      ths.forEach((th, i) => { const n = nat[i], k = kind[i], hd = hw ? Math.max(hard[i], two(hn[i])) : Math.max(hard[i], hn[i]); let m = n;
        if (k && (k === 2 || n >= TS)) m = Math.max(hd, Math.min(two(n), CAP));
        else if (hw && VC[i]) m = hd;
        if (m < n) { fl.push([i, m, n, k]); mn += m; nt += n; } else fx += n; });
      return { fx, mn, nt, fl, hw }; };
    const hd0 = (i) => Math.max(hard[i], hn[i]);
    let P = plan(0);
    if (P.fx + P.nt > W + 1) { let t = 0; while (P.fx + P.mn > W && t < 2) P = plan(++t);
      if (P.fx + P.mn > W * 1.1 && !tight) P = plan(1);
      if (P.fl.length) { const fits = P.fx + P.mn <= W, g0 = P.fl.reduce((q, f) => q + (f[3] ? 0 : f[2] - f[1]), 0), g1 = P.nt - P.mn - g0;
        let spare = fits ? W - P.fx - P.mn : 0; const s0 = Math.min(spare, g0); spare -= s0;
        const wd = new Map(P.fl.map(([i, m, n, k]) => [i, Math.floor(m + (k ? (g1 > 0 ? spare * (n - m) / g1 : 0) : (g0 > 0 ? s0 * (n - m) / g0 : 0)))]));
        const emit = () => { fsEl.textContent = (P.hw ? `#${id}>thead>tr>th{white-space:normal!important}` : "") + P.fl.map(([i, m, n, k]) => { const x = wd.get(i), c = i + 1;
            return `#${id}>thead>tr>th:nth-child(${c}){width:${x}px!important;min-width:0!important}#${id}>tbody>tr>td:nth-child(${c}):not(.empty){width:${x}px!important;min-width:0!important${k ? ";white-space:normal!important;overflow-wrap:break-word" : ""}}` +
              (k ? `#${id}>tbody>tr>td:nth-child(${c})>.lc{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}` : ""); }).join("");
          const tot = P.fx + [...wd.values()].reduce((q, v) => q + v, 0);
          if (tot <= W + 1) { ly.classList.add("fitw"); tb.style.width = "100%"; } else { ly.classList.remove("fitw"); tb.style.width = tot + "px"; } };
        emit();
        /* ตรวจซ้ำ: ช่องที่ยังต้องใช้เกิน 2 บรรทัด (ตัดคำได้ไม่ลงตัว) หรือหัวคอลัมน์เกิน 2 บรรทัด -> ขยายคอลัมน์นั้นทีละ 20% (ไม่เกินความกว้างจริง / CAP) */
        const rows = samp || [...R].slice(0, 150), lines = (th) => { rg.selectNodeContents(th); const h = rg.getBoundingClientRect().height, q = th.querySelector(".thi"), one = q ? q.getBoundingClientRect().height : 0; return one ? Math.round(h / one) : 1; };
        for (let round = 0; round < 5; round++) { let grow = false;
          P.fl.forEach(([i, m, n, k]) => { const x = wd.get(i), lim = k ? Math.min(n, Math.max(CAP, hd0(i))) : n; if (x >= lim) return;
            const over = (k && rows.some((tr) => { const lc = tr.cells[i] && tr.cells[i].firstElementChild; return lc && lc.classList.contains("lc") && lc.scrollHeight > lc.clientHeight + 2; })) || (P.hw && lines(ths[i]) > 2);
            if (over) { wd.set(i, Math.min(lim, Math.ceil(x * 1.2) + 4)); grow = true; } });
          if (!grow) break; emit(); } } }
    { const used = tb.offsetWidth; if (!cmp && used > W + 1 && used - W <= ths.length * 9) { if (samp) { samp.forEach((tr) => tr.classList.remove("fk")); ly.classList.remove("smp"); } ly.classList.add("cmp"); return fit(pass, Wo, 1); } }
    done(); };
  const fitSoon = (now) => { clearTimeout(fitT); if (now || !fitN++) fit(); else fitT = setTimeout(fit, 90); };
  tb._fit = fitSoon; tb._fitChk = () => { const w = wr.clientWidth; if (w && w !== fitW) fitSoon(fitW <= 0); };
  if (!window._tblFitHook) { window._tblFitHook = 1; const chk = () => setTimeout(() => $$("#main table").forEach((t) => t._fitChk && t._fitChk()), 40);
    document.addEventListener("click", chk, true); window.addEventListener("resize", chk); window.addEventListener("orientationchange", chk); }
  if (window.ResizeObserver) new ResizeObserver(() => setTimeout(() => { if (wr.clientWidth !== fitW) fitSoon(fitW <= 0); }, 0)).observe(wr);
  if (document.fonts && document.fonts.status !== "loaded") document.fonts.ready.then(() => fitSoon());
  const rowsF = () => {
    let r = cfg.rows();
    if (st.q) { const q = st.q.toLowerCase(); r = r.filter((x) => cfg.cols.some((c) => String(c.v ? c.v(x) : x[c.k] ?? "").toLowerCase().includes(q))); }
    r = cfApply(r, null);
    if (st.k) { const c = cfg.cols.find((c) => c.k === st.k); const val = (x) => (c.s ? c.s(x) : c.v ? c.v(x) : x[c.k]); r = [...r].sort((a, b) => { const A = val(a), Bv = val(b); return (typeof A === "number" && typeof Bv === "number" ? A - Bv : String(A ?? "").localeCompare(String(Bv ?? ""), "th")) * st.d; }); }
    return r;
  };
  const draw = () => {
    const VC = cfg.cols.filter((c) => !c.hide), FILL = !VC.some((c) => c.w), fth = FILL ? '<th class="fill" aria-hidden="true"></th>' : "", ftd = FILL ? '<td class="fill"></td>' : "";
    tb.tHead.innerHTML = "<tr>" + VC.map((c) => (c.bare ? `<th class="bare ${c.c ? "c" : ""}"${c.sh ? ` title="${esc(c.lab.replace(/<[^>]+>/g, ""))}"` : ""}>${c.sh || c.lab}</th>` : `<th class="srt ${c.n ? "n" : ""} ${c.c ? "c" : ""}${st.k === c.k ? " sd" : ""}" data-k="${c.k}"${c.sh ? ` title="${esc(c.lab.replace(/<[^>]+>/g, ""))}"` : ""}>${c.sh || c.lab}<span class="thi">${st.k === c.k ? `<span class="si">${st.d > 0 ? "▲" : "▼"}</span>` : ""}<button class="cfb${st.cf[c.k] ? " on" : ""}" data-fk="${c.k}" title="กรองคอลัมน์นี้" aria-label="กรองคอลัมน์ ${esc(c.lab.replace(/<[^>]+>/g, ""))}">${FUNNEL}</button></span></th>`)).join("") + fth + "</tr>";
    const r = rowsF(), lim = cfg.max || 400, show = r.slice(0, lim);
    tb.tBodies[0].innerHTML = show.length ? show.map((x, i) => `<tr data-i="${i}" class="${cfg.click ? "cl" : ""} ${cfg.rowCls ? cfg.rowCls(x) : ""}">` + VC.map((c) => { const h = c.f ? c.f(x) : esc(c.v ? c.v(x) : x[c.k]); return `<td class="${c.n ? "n" : ""} ${c.c ? "c" : ""} ${c.w ? "wrap" : ""}">${c.n || c.c || c.bare || c.fx ? h : `<div class="lc">${h}</div>`}</td>`; }).join("") + ftd + "</tr>").join("")
      : `<tr><td colspan="${VC.length + (FILL ? 1 : 0)}" class="empty">ไม่มีรายการ</td></tr>`;
    tb._rows = show; fitSoon();
    const tot = cfg.total ? cfg.total(r) : "";
    if (typeof mark === "function" && init) mark();
    const ncf = Object.keys(st.cf).length;
    $("[data-cnt]", host).innerHTML = `${cfg.cnt ? cfg.cnt(r) : nf(r.length) + " รายการ"}${ncf ? ` · <b>กรอง ${ncf} คอลัมน์</b>` : ""}${r.length > lim ? ` (แสดง ${nf(lim)} แรก — ใช้ช่องค้นหา/ตัวกรองเพื่อกรอง)` : ""}${tot ? " · " + tot : ""}`;
  };
  tb.addEventListener("mouseover", (e) => { const lc = e.target.closest(".lc"); if (lc && !lc.dataset.t && lc.scrollHeight > lc.clientHeight + 2) { lc.dataset.t = 1; lc.classList.add("ovf"); if (!lc.querySelector("[title]")) lc.title = lc.textContent.replace(/\s+/g, " ").trim(); } });
  tb.addEventListener("click", (e) => {
    const lc = e.target.closest(".lc");
    if (lc && !e.target.closest("a,button,select,input,label,[data-copy],[data-av]")) { const td = lc.parentElement; if (td.classList.contains("lco") || lc.scrollHeight > lc.clientHeight + 2) { td.classList.toggle("lco"); e.stopPropagation(); return; } }
    const fb = e.target.closest("[data-fk]");
    if (fb) { e.stopPropagation(); cfOpen(fb.dataset.fk, fb); return; }
    const th = e.target.closest("th[data-k]");
    if (th && e.target.closest("input")) return;                 // ช่องติ๊กบนหัวตาราง (เลือกทั้งหมด) ไม่ใช่การเรียง
    if (th) { flush(); push(); st.d = st.k === th.dataset.k ? -st.d : -1; st.k = th.dataset.k; draw(); cur = snap(); return; }
    if (e.target.closest("select,input,a,[data-copy],[data-av]")) return;   // ช่องเลือก/ปุ่มในแถว ไม่เปิดรายการย่อย
    const tr = e.target.closest("tr[data-i]");
    if (tr && cfg.click) { $$("tr.sel", tb).forEach((t) => t.classList.remove("sel")); tr.classList.add("sel"); const det = $("[data-det]", host); if (cfg.click(tb._rows[+tr.dataset.i], det) !== false) requestAnimationFrame(() => det.scrollIntoView({ behavior: "smooth", block: "start" })); }
  });
  const q = $("[data-q]", host);
  /* ประวัติตัวกรองของตาราง: ย้อนกลับทีละขั้น / ล้างทั้งหมด */
  const tools = $(".tools", host), sels = () => $$("select", tools), bU = $("[data-undo]", host);
  const cfSer = () => JSON.stringify(Object.entries(st.cf).map(([k, f]) => [k, f.t, f.vals ? [...f.vals].sort() : null, f.min ?? null, f.max ?? null, f.from || null, f.to || null]));
  const snap = () => ({ q: st.q, k: st.k, d: st.d, sel: sels().map((x) => x.value), cf: cfSer(), cfo: Object.fromEntries(Object.entries(st.cf).map(([k, f]) => [k, Object.assign({}, f, f.vals ? { vals: new Set(f.vals) } : {})])) });
  const init = snap(), hist = []; let cur = init, applying = false, typing = null;
  const bR = $("[data-reset]", host);
  const sig = (o) => JSON.stringify([o.q, o.k, o.d, o.sel, o.cf]);
  const mark = () => { bU.disabled = !hist.length; bR.disabled = sig({ q: st.q, k: st.k, d: st.d, sel: sels().map((x) => x.value), cf: cfSer() }) === sig(init); };
  const flush = () => { if (typing) { clearTimeout(typing); typing = null; cur = snap(); } };   // พิมพ์ค้นหาค้างอยู่ = นับเป็น 1 ขั้นก่อนทำอย่างอื่น
  const push = () => { hist.push(cur); if (hist.length > 50) hist.shift(); mark(); };
  const apply = (sv) => {
    applying = true; st.q = sv.q; st.k = sv.k; st.d = sv.d; if (q) q.value = sv.q;
    st.cf = Object.fromEntries(Object.entries(sv.cfo || {}).map(([k, f]) => [k, Object.assign({}, f, f.vals ? { vals: new Set(f.vals) } : {})]));
    sels().forEach((x, i) => { if (x.value !== sv.sel[i]) { x.value = sv.sel[i]; x.dispatchEvent(new Event("change", { bubbles: true })); } });
    applying = false; $("[data-det]", host).innerHTML = ""; draw(); cur = snap(); mark();
  };
  tools.addEventListener("change", (e) => { if (applying || e.target.tagName !== "SELECT") return; const v = e.target.value; e.target.value = cur.sel[sels().indexOf(e.target)]; flush(); e.target.value = v; push(); cur = snap(); }, true);
  bU.addEventListener("click", () => { flush(); if (hist.length) apply(hist.pop()); });
  $("[data-reset]", host).addEventListener("click", () => { flush(); const n = snap(); if (sig(n) !== sig(init)) { push(); apply(init); } else { $("[data-det]", host).innerHTML = ""; $$("tr.sel", tb).forEach((t) => t.classList.remove("sel")); } });
  if (q) q.addEventListener("input", () => { if (!typing) push(); clearTimeout(typing); typing = setTimeout(() => { typing = null; cur = snap(); }, 1200); st.q = q.value.trim(); draw(); });
  /* ---------- ตัวกรองรายคอลัมน์: ข้อความ = เลือกค่า (หลายค่า) / ตัวเลข = ช่วงต่ำสุด-สูงสุด / วันที่ = ช่วงวันที่ ---------- */
  const colOf = (k) => cfg.cols.find((c) => c.k === k);
  const ctype = (c) => (c.date || c.range ? "d" : c.n ? "n" : "t");
  const tval = (c, x) => { const v = c.v ? c.v(x) : c.f && !c.n ? plain(c.f(x)) : x[c.k]; return v == null || v === "" ? "(ว่าง)" : String(v); };
  const nval = (c, x) => { const r = x[c.k]; if (typeof r === "number" && !c.v) return r; const v = c.v ? c.v(x) : r; return v === "" || v == null || isNaN(+v) ? null : +v; };
  const dval = (c, x) => (c.range ? c.range(x).map((v) => String(v || "").slice(0, 10)) : [String(c.date(x) || "").slice(0, 10), String(c.date(x) || "").slice(0, 10)]);
  function cfApply(rows, skip) {
    const es = Object.entries(st.cf).filter(([k]) => k !== skip); if (!es.length) return rows;
    return rows.filter((x) => es.every(([k, f]) => { const c = colOf(k); if (!c) return true;
      if (f.t === "t") return f.vals.has(tval(c, x));
      if (f.t === "n") { const v = nval(c, x); return v != null && (f.min == null || v >= f.min) && (f.max == null || v <= f.max); }
      const [a, b] = dval(c, x); return (!f.from || b >= f.from) && (!f.to || a <= f.to); }));
  }
  let pop = null;
  const cfClose = () => { if (pop) { pop.remove(); pop = null; document.removeEventListener("pointerdown", outside, true); } };
  const outside = (e) => { if (pop && !pop.contains(e.target) && !e.target.closest("[data-fk]")) cfClose(); };
  const cfSet = (k, f) => { flush(); push(); if (f) st.cf[k] = f; else delete st.cf[k]; $("[data-det]", host).innerHTML = ""; draw(); cur = snap(); mark(); cfClose(); };
  function cfOpen(k, btn) {
    if (pop && pop.dataset.k === k) return cfClose();
    cfClose();
    const c = colOf(k), t = ctype(c), f = st.cf[k];
    let base = cfg.rows();
    if (st.q) { const qq = st.q.toLowerCase(); base = base.filter((x) => cfg.cols.some((cc) => String(cc.v ? cc.v(x) : x[cc.k] ?? "").toLowerCase().includes(qq))); }
    base = cfApply(base, k);                           // ค่าให้เลือก = ตามตัวกรองคอลัมน์อื่นที่ตั้งไว้ (แบบ Excel)
    pop = document.createElement("div"); pop.className = "cfpop"; pop.dataset.k = k;
    const title = `<div class="cfh"><b>${esc(c.lab.replace(/<[^>]+>/g, ""))}</b><button class="tb ic" data-x aria-label="ปิด">✕</button></div>`;
    if (t === "t") {
      const cnt = new Map(); base.forEach((x) => { const v = tval(c, x); cnt.set(v, (cnt.get(v) || 0) + 1); });
      const vals = [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 600), on = f ? f.vals : null;
      pop.innerHTML = `${title}<input class="tin" type="search" placeholder="ค้นหาค่า" data-s><div class="cfq"><button class="tb" data-all>เลือกทั้งหมด</button><button class="tb" data-none>ไม่เลือก</button></div>
        <div class="cfl">${vals.map(([v, n]) => `<label><input type="checkbox" value="${esc(v)}" ${!on || on.has(v) ? "checked" : ""}><span>${esc(v)}</span><small>${nf(n)}</small></label>`).join("")}</div>
        ${cnt.size > 600 ? `<p class="note">แสดง 600 ค่าที่พบบ่อยสุด จาก ${nf(cnt.size)} ค่า — ใช้ช่องค้นหาด้านบน</p>` : ""}`;
      $("[data-s]", pop).addEventListener("input", (e) => { const qq = e.target.value.trim().toLowerCase(); $$(".cfl label", pop).forEach((l) => (l.hidden = qq && !l.textContent.toLowerCase().includes(qq))); });
      $("[data-all]", pop).onclick = () => $$(".cfl label:not([hidden]) input", pop).forEach((i) => (i.checked = true));
      $("[data-none]", pop).onclick = () => $$(".cfl label:not([hidden]) input", pop).forEach((i) => (i.checked = false));
    } else if (t === "n") {
      const vs = base.map((x) => nval(c, x)).filter((v) => v != null), lo = vs.length ? Math.min(...vs) : 0, hi = vs.length ? Math.max(...vs) : 0;
      pop.innerHTML = `${title}<div class="cfr"><label>ต่ำสุด<input class="tin" type="number" data-min value="${f && f.min != null ? f.min : ""}" placeholder="${nf(lo, 0)}"></label><label>สูงสุด<input class="tin" type="number" data-max value="${f && f.max != null ? f.max : ""}" placeholder="${nf(hi, 0)}"></label></div>`;
    } else {
      const ds = base.flatMap((x) => dval(c, x)).filter(Boolean).sort(), lo = ds[0] || "", hi = ds[ds.length - 1] || "";
      pop.innerHTML = `${title}<div class="cfr"><label>ตั้งแต่<span class="dfield sm"><b data-fl>${dS(f && f.from || lo)}</b><input type="date" data-from min="${lo}" max="${hi}" value="${f && f.from || ""}"></span></label>
        <label>ถึง<span class="dfield sm"><b data-tl>${dS(f && f.to || hi)}</b><input type="date" data-to min="${lo}" max="${hi}" value="${f && f.to || ""}"></span></label></div>`;
      $("[data-from]", pop).onchange = (e) => ($("[data-fl]", pop).textContent = dS(e.target.value || lo));
      $("[data-to]", pop).onchange = (e) => ($("[data-tl]", pop).textContent = dS(e.target.value || hi));
    }
    pop.insertAdjacentHTML("beforeend", `<div class="cff"><button class="tb" data-clr>ล้างคอลัมน์นี้</button><button class="tb on" data-ok>กรอง</button></div>`);
    $("[data-x]", pop).onclick = cfClose;
    $("[data-clr]", pop).onclick = () => cfSet(k, null);
    $("[data-ok]", pop).onclick = () => {
      if (t === "t") { const all = $$(".cfl input", pop), sel = all.filter((i) => i.checked).map((i) => i.value);
        cfSet(k, sel.length === all.length ? null : { t: "t", vals: new Set(sel) }); }
      else if (t === "n") { const a = $("[data-min]", pop).value, b = $("[data-max]", pop).value; cfSet(k, a === "" && b === "" ? null : { t: "n", min: a === "" ? null : +a, max: b === "" ? null : +b }); }
      else { const a = $("[data-from]", pop).value, b = $("[data-to]", pop).value; cfSet(k, !a && !b ? null : { t: "d", from: a, to: b }); }
    };
    document.body.appendChild(pop);
    const r = btn.getBoundingClientRect(), w = pop.offsetWidth;
    if (innerWidth > 640) { pop.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + "px"; pop.style.top = Math.min(r.bottom + 6, innerHeight - pop.offsetHeight - 8) + "px"; }
    else pop.classList.add("sheet");
    setTimeout(() => document.addEventListener("pointerdown", outside, true), 0);
  }
  /* คอลัมน์สำหรับส่งออก: วันที่-เวลา แยกเป็น 2 คอลัมน์ "วันที่" (dd/mm/yyyy ค.ศ.) และ "เวลา" (hh:mm:ss) ; ช่วงวันที่แยกเป็น วันเริ่มต้น / วันสิ้นสุด */
  const expCols = () => { const R = rowsF().slice(0, 300); return cfg.cols.flatMap((c) => {
    const lab = c.lab.replace(/<[^>]+>/g, "").trim();
    if (c.range) { const [a, b] = c.rl || ["วันเริ่มต้น", "วันสิ้นสุด"]; return [{ c, lab: a, dt: (x) => c.range(x)[0], z: "d" }, { c, lab: b, dt: (x) => c.range(x)[1], z: "d" }]; }
    if (c.date) { const tm = R.some((x) => /\d{2}:\d{2}/.test(String(c.date(x) || ""))); return tm ? [{ c, lab: lab + " (วันที่)", dt: c.date, z: "d" }, { c, lab: lab + " (เวลา)", dt: c.date, z: "t" }] : [{ c, lab, dt: c.date, z: "d" }]; }
    return [{ c, lab }];
  }); };
  const dtPart = (e, v, txt) => (!v ? "" : e.z === "t" ? (txt ? v.time : v.serial - Math.floor(v.serial)) : txt ? v.date : Math.floor(v.serial));
  const plain = (h) => String(h).replace(/<br\s*\/?>/g, " ; ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
  const val = (e, x) => {
    const c = e.c, raw = x[c.k];
    if (e.dt) return xlDate(e.dt(x));
    if (c.n && typeof raw === "number" && !c.v) return raw;
    const v = c.csv ? c.csv(x) : c.v ? c.v(x) : c.f && !c.n ? plain(c.f(x)) : raw;
    return c.n && v !== "" && v != null && !isNaN(+v) ? +v : v == null ? "" : String(v);
  };
  $$(".xm-box button", host).forEach((b) => b.addEventListener("click", () => { const dm = b.closest("details"); if (dm) dm.open = false; }));
  $("[data-csv]", host).addEventListener("click", () => {
    const E = expCols(), lines = [E.map((e) => `"${e.lab}"`).join(",")];
    rowsF().forEach((x) => lines.push(E.map((e) => { const v = val(e, x); const t = e.dt ? dtPart(e, v, 1) : v; return `"${String(t ?? "").replace(/"/g, '""')}"`; }).join(",")));
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv" }));
    a.download = (cfg.csvName || "table") + ".csv"; a.click();
  });
  $("[data-xls]", host).addEventListener("click", async (ev) => {
    const btn = ev.currentTarget; btn.disabled = true;
    try {
      await loadXLSX();
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, xlSheet(aoa()), (cfg.csvName || "ข้อมูล").replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
      XLSX.writeFile(wb, (cfg.csvName || "table") + ".xlsx");
    } catch (err) { toast("ส่งออก Excel ไม่สำเร็จ: " + err.message); }
    btn.disabled = false;
  });
  /* ข้อมูลตาราง (ตามตัวกรองที่ตั้งอยู่) สำหรับส่งออก — ใช้ทั้งปุ่มของตารางเองและปุ่มส่งออกหลายชีต */
  function aoa() { const E = expCols(); return { E, head: E.map((e) => e.lab), body: rowsF().map((x) => E.map((e) => { const v = val(e, x); return e.dt ? dtPart(e, v, 0) : v; })) }; }
  draw();
  return { draw, host, aoa, rows: rowsF, nf: () => Object.keys(st.cf).length + (st.q ? 1 : 0) };
}
/* ชีต Excel จาก { E, head, body } : ความกว้างคอลัมน์ · ตัวกรองหัวคอลัมน์ · รูปแบบวันที่ ค.ศ. / ตัวเลข */
function xlSheet({ E, head, body }) {
  const ws = XLSX.utils.aoa_to_sheet([head, ...body]);
  ws["!cols"] = head.map((h, i) => ({ wch: E[i].dt ? Math.max(12, h.length + 2) : Math.min(60, Math.max(h.length + 2, ...body.slice(0, 300).map((r) => String(r[i] ?? "").length + 1))) }));
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: body.length, c: head.length - 1 } }) };
  E.forEach((e, i) => {
    if (!e.dt && !e.c.n) return;
    for (let r = 1; r <= body.length; r++) { const cell = ws[XLSX.utils.encode_cell({ r, c: i })]; if (!cell || cell.t !== "n") continue;
      cell.z = e.dt ? (e.z === "t" ? XL_T : e.z === "d" ? XL_D : XL_DT) : Number.isInteger(cell.v) && !/ยอด|amt|เงิน/i.test(e.c.lab + e.c.k) ? "#,##0" : "#,##0.00"; }
  });
  return ws;
}

/* วันที่สำหรับส่งออก: "YYYY-MM-DD[ HH:MM[:SS]]" -> ค่าวันที่ Excel (serial) + ข้อความ dd/mm/yyyy hh:mm:ss (ค.ศ.) */
const XL_DT = "[$-409]dd\\/mm\\/yyyy hh:mm:ss", XL_D = "[$-409]dd\\/mm\\/yyyy", XL_T = "hh:mm:ss";      // บังคับปฏิทิน ค.ศ. และเครื่องหมาย / ทุกเครื่อง
function xlDate(sv) {
  const m = String(sv || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const [y, mo, d, h = "00", mi = "00", se = "00"] = m.slice(1).map((v) => v ?? undefined);
  return { serial: (Date.UTC(+y, +mo - 1, +d, +h, +mi, +se) - Date.UTC(1899, 11, 30)) / 864e5, text: `${d}/${mo}/${y} ${h || "00"}:${mi || "00"}:${se || "00"}`, date: `${d}/${mo}/${y}`, time: `${h || "00"}:${mi || "00"}:${se || "00"}` };
}
/* ไลบรารี Excel โหลดเมื่อกดปุ่มครั้งแรกเท่านั้น (ไม่ถ่วงหน้าเว็บ) */
let XLSX_P = null;
function loadXLSX() {
  if (window.XLSX) return Promise.resolve();
  return XLSX_P || (XLSX_P = new Promise((ok, bad) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.integrity = "sha512-r22gChDnGvBylk90+2e/ycr3RVrDi8DIOkIGNhJlKfuyQM4tIRAI062MaV8sfjQKYVGjOBaZBOA87z+IhZE9DA=="; s.crossOrigin = "anonymous"; s.referrerPolicy = "no-referrer"; s.onload = ok; s.onerror = () => { XLSX_P = null; bad(new Error("โหลดไลบรารีไม่ได้ (เครือข่าย)")); }; document.head.appendChild(s); }));
}

/* ---------- กราฟ ---------- */
function chart(el, cfg) { const c = new Chart(el, cfg); CH.push(c); return c; }
const gridC = () => (document.documentElement.dataset.theme === "dark" ? "#24324C" : "#E6EAF0");
const inkC = () => (document.documentElement.dataset.theme === "dark" ? "#C9D5E6" : "#34435A");
function baseOpt(extra = {}) {
  return Object.assign({ responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { labels: { color: inkC(), boxWidth: 12, font: { family: "Sarabun" } } }, tooltip: { callbacks: {} } },
    scales: { x: { ticks: { color: inkC(), font: { family: "Sarabun" } }, grid: { color: gridC() } }, y: { ticks: { color: inkC(), callback: (v) => M(v), font: { family: "Sarabun" } }, grid: { color: gridC() } } } }, extra);
}

/* ---------- เมนู ---------- */
const NAV = [
  { g: "ภาพรวม", items: [{ t: "home", l: "ภาพรวมคดี", s: "สรุปผล 3 บัญชี + ข้อค้นพบ", i: "home" }, { t: "map", l: "แผนที่จุดฝาก-ถอน", s: "รวมทุกบัญชี · หาเหตุการณ์พร้อมกัน", i: "pin" }] },
  { g: "บัญชี", items: [] },
  { g: "วิเคราะห์ขบวนการ", items: [{ t: "flow", l: "เส้นทางเงินตามกรรม", s: "ผู้เสียหาย → บัญชีม้า → ถอนสด/โอนต่อ · คอกม้า", i: "link" }, { t: "net", l: "บทบาท หัวหน้า-ลูกน้อง", s: "ผังเครือข่ายผู้ฝาก/ผู้โอน", i: "net" }, { t: "link", l: "ความเชื่อมโยงบัญชี", s: "ตู้เดียวกัน · คู่บัญชีร่วม", i: "link" }, { t: "list", l: "รายการฝากทั้งหมด", s: "กรอง/ค้นหา/ส่งออก", i: "list" }] },
  { g: "งานต่อ", items: [{ t: "req", l: "รายการขอข้อมูลธนาคาร", s: "CCTV · ใบถอน · ที่ตั้งตู้ · Excel", i: "todo" }] },
];
let BNAV = [];
const TITLES = { home: "ภาพรวมคดี", map: "แผนที่จุดฝาก-ถอน", net: "บทบาทในขบวนการ", link: "ความเชื่อมโยงระหว่างบัญชี", list: "รายการฝากทั้งหมด", acc: "บัญชี", flow: "เส้นทางเงินตามกรรม", todo: "รายการขอข้อมูลธนาคาร", req: "รายการขอข้อมูลธนาคาร" };

/* ข้อผิดพลาดใด ๆ หลังล็อกอิน -> แสดงกล่องแจ้งบนจอ (ไม่ปล่อยหน้าว่าง) */
function showErr(where, e) {
  const msg = (e && (e.message || e.reason && e.reason.message || e.reason)) || String(e);
  const st = (e && (e.stack || e.reason && e.reason.stack) || "").split("\n").slice(0, 3).join(" | ");
  const box = document.createElement("div"); box.className = "errbox";
  box.innerHTML = `<b>เกิดข้อผิดพลาดในการแสดงผล (${esc(where)})</b><br>${esc(msg)}<br><small>${esc(st)}</small><br><small>${esc(navigator.userAgent)}</small><br><button class="tb" data-errhome="1">กลับหน้าแรก</button>`;
  box.querySelector("[data-errhome]").addEventListener("click", () => { location.hash = "home"; location.reload(); });
  const m = $("#main"); if (m) m.prepend(box); else document.body.prepend(box);
}
window.addEventListener("error", (e) => { if (!$("#app").hidden) showErr("หน้าเว็บ", e.error || e); });
window.addEventListener("unhandledrejection", (e) => { if (!$("#app").hidden) showErr("งานเบื้องหลัง", e); });
function start() {
  try { start0(); } catch (e) { showErr("เริ่มแอพ", e); }
}
function start0() {
  $("#login").hidden = true; $("#app").hidden = false;
  try { const th = localStorage.getItem("atm_theme"); if (th) document.documentElement.dataset.theme = th; } catch (e) { }
  NAV[1].items = [{ t: "acc", l: "รายละเอียดบัญชี", s: "ดูได้ทุกบัญชี · เปรียบเทียบความสัมพันธ์", i: "user" }];
  BNAV = [["home", "ภาพรวม", "home"], ["flow", "เส้นเงิน", "link"], ["map", "แผนที่", "pin"], ["acc", "บัญชี", "user"], ["req", "ขอข้อมูล", "todo"]];
  DB.acs.forEach((a) => { TITLES[a.id] = (a.bank === "BAY" ? "รหัสสาขาที่ฝากเงิน " : "สาขา/ตู้ ATM ที่ฝากเข้า ") + a.short; });
  $("#caseTitle").textContent = DB.case; document.title = DB.case || document.title; $("#madeAt").textContent = "ข้อมูล ณ " + DB.built;
  $("#menuBtn").innerHTML = IC("menu"); if ($("#backBtn")) $("#backBtn").innerHTML = IC("back"); $("#themeBtn").innerHTML = IC("moon"); $("#outBtn").innerHTML = IC("out");
  $("#srchBtn").innerHTML = IC("search", 18) + '<span class="sb-t">ค้นหา ชื่อ · เลขบัญชี · รหัสตู้ · สาขา</span><kbd>Ctrl K</kbd>';
  $("#tabs").innerHTML = `<div class="side-hd"><img src="logo.jpg" alt=""><b>${esc(DB.case)}<br><small style="color:#8FA6C0;font-weight:400">วิเคราะห์สาขา/ตู้ที่ฝากเงิน</small></b></div>` +
    NAV.map((g) => `<div class="side-g">${g.g}</div>` + g.items.map((it) => `<button data-t="${it.t}" title="${it.l}">${IC(it.i)}<span class="tx">${it.l}<small>${it.s}</small></span></button>`).join("")).join("");
  $("#bnav").innerHTML = BNAV.map(([t, l, i]) => `<button data-t="${t}">${IC(i)}<span>${l}</span></button>`).join("");
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-t]"); if (b && !b.closest("table")) { e.preventDefault(); go(b.dataset.t); document.body.classList.remove("drawer"); $("#drawerMask").hidden = true; }
    const g = e.target.closest("[data-go]"); if (g) { e.preventDefault(); go(g.dataset.go); }
  });
  $("#menuBtn").onclick = () => { document.body.classList.add("drawer"); $("#drawerMask").hidden = false; };
  /* จอคอม: หุบแถบเมนูซ้ายให้เหลือแค่ไอคอน (จำค่าไว้ในเครื่อง) */
  if ($("#navTgl")) { const tg = $("#navTgl"); let mini = false; try { mini = localStorage.getItem("atm_nav_mini") === "1"; } catch (e) { }
    tg.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
    const lab = (m) => { tg.title = m ? "ขยายเมนู" : "หุบเมนู (เหลือแค่ไอคอน)"; tg.setAttribute("aria-label", m ? "ขยายเมนูด้านซ้าย" : "หุบเมนูด้านซ้าย"); };
    document.body.classList.toggle("nav-mini", mini); lab(mini);
    tg.onclick = () => { const m = document.body.classList.toggle("nav-mini"); lab(m); try { localStorage.setItem("atm_nav_mini", m ? "1" : ""); } catch (e) { } setTimeout(() => window.dispatchEvent(new Event("resize")), 60); }; }
  $("#drawerMask").onclick = () => { document.body.classList.remove("drawer"); $("#drawerMask").hidden = true; };
  $("#themeBtn").onclick = () => { const d = document.documentElement; d.dataset.theme = d.dataset.theme === "dark" ? "light" : "dark"; try { localStorage.setItem("atm_theme", d.dataset.theme); } catch (e) { } render(); };
  if ($("#logBtn") && window.GUARD_LOG) { const lb = $("#logBtn"); lb.href = window.GUARD_LOG; lb.innerHTML = IC("shield"); lb.hidden = false; }   /* ผู้พัฒนา: ชีต log ระบบเฝ้าเว็บ (27 พ.ย. 69) */
  $("#outBtn").onclick = () => { try { sessionStorage.removeItem("atm_k"); } catch (e) { } location.reload(); };
  $("#srchBtn").onclick = openSearch;
  document.addEventListener("click", (e) => { const a = e.target.closest("[data-av]"); if (a) { e.preventDefault(); e.stopPropagation(); showPhoto(a.dataset.av); } }, true);
  document.addEventListener("click", (e) => { $$("details.xmenu[open],details.info[open]").forEach((x) => { if (!x.contains(e.target)) x.open = false; });
    const ld = e.target.closest(".hero .lead"); if (ld && !e.target.closest("a,button,select,input")) ld.classList.toggle("open"); });
  if ($("#backBtn")) $("#backBtn").onclick = () => { if (NAVN > 0) { NAVN--; history.back(); } else go("home"); };
  document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openSearch(); } if (e.key === "Escape") $("#search").hidden = true; });
  $("#search").addEventListener("click", (e) => { if (e.target.id === "search" || e.target.closest("[data-close]")) $("#search").hidden = true; });
  $("#sq").addEventListener("input", doSearch);
  window.addEventListener("hashchange", render);
  render();
  if (window.aiMount) aiMount().catch((e) => console.warn("ai", e));
}
let NAVN = 0;   // จำนวนครั้งที่เปลี่ยนหน้าในแอพ (ใช้กับปุ่มย้อนกลับ)
function go(t) { if (location.hash.slice(1).split("/")[0] !== t) { NAVN++; location.hash = t; } else render(); }
function render() {
  if (typeof flVarInit === "function") flVarInit();          // วิธีนับเงินที่ผู้ใช้เลือกไว้
  let t = (location.hash.slice(1) || "home").split("/")[0];
  const fk = DB.acs.find((a) => a.id === t);   // ลิงก์เดิม #ykk / #kes / #ora -> หน้าบัญชี
  if (fk) { const sub = location.hash.split("/")[1]; try { history.replaceState(null, "", "#acc/" + accK(fk.acc) + (sub ? "/" + sub : "")); } catch (e) { } t = "acc"; }
  CH.forEach((c) => c.destroy()); CH = []; $("#tip").hidden = true;
  $$("#tabs [data-t], #bnav [data-t]").forEach((b) => b.classList.toggle("on", b.dataset.t === t));
  $("#pageTitle").textContent = TITLES[t] || ""; if ($("#backBtn")) $("#backBtn").hidden = t === "home" && NAVN === 0;
  try { if (typeof stopPlay === "function") stopPlay(); } catch (e) { }
  $$(".cfpop").forEach((x) => x.remove());
  const m = $("#main"); m.innerHTML = ""; m.onclick = null; window.scrollTo(0, 0);
  try { ({ home: pHome, map: pMap, acc: pAccPage, flow: pFlow, net: pNet, link: pLink, list: pList, todo: pReq, req: pReq }[t] || pHome)(m); }
  catch (e) { showErr("หน้า " + t, e); }
}

/* ---------- ค่าสรุปที่ใช้หลายหน้า ---------- */
const sumK = (a, ks) => a.chan.filter((c) => ks.includes(c.k)).reduce((s, c) => s + c.amt, 0);
const cntK = (a, ks) => a.chan.filter((c) => ks.includes(c.k)).reduce((s, c) => s + c.n, 0);
const provs = (a) => [...new Set(a.branches.map((b) => b.prov).filter(Boolean).map((p) => p.replace(" (?)", "")))];

/* ================= หน้าแรก ================= */
function pHome(m) {
  const [Y, K, O] = ["ykk", "kes", "ora"].map(acOf);
  const L1 = DB.people.filter((p) => p.role === "L1"), L2 = DB.people.filter((p) => p.role === "L2");
  const yk = DB.links.find((l) => l.a === "ykk" && l.o === K.acc.replace(/^0+/, "") && l.same.length);
  const ykGen = yk && yk.same.every((x) => x.gen);
  const l1k = new Set(L1.map((p) => p.name));
  const l1p = DB.pairs.filter((x) => l1k.has(x.n1) && l1k.has(x.n2) || (L1.some((p) => p.accs.some((a) => a.acc === x.a1)) && L1.some((p) => p.accs.some((a) => a.acc === x.a2))));
  const l1u = l1p.filter((x) => !x.gen), l1g = l1p.filter((x) => x.gen);
  const both = DB.people.filter((p) => Object.keys(p.dst).length >= 2);
  const kesOut = K.cashout.filter((c) => c.ch === "BRANCH");
  const oraGrp = DB.links.filter((l) => l.a === "ora" && (l.direct.n || l.common.length >= 2));
  const cashY = sumK(Y, ["CASH_OTHER", "CASH_OWN", "COUNTER"]);
  m.innerHTML = `
  <section class="hero"><div style="position:relative;z-index:1"><span class="eyebrow">${esc(DB.case)} · วิเคราะห์สาขา/ตู้ ATM ที่ฝากเงินเข้า</span>
    <h1>${esc(DB.headline || "")}</h1>
    <p class="lead">เงินสดฝากผ่านตู้หลายธนาคารเป็นรอบ ๆ เข้าบัญชีพักเงิน 3 บัญชี แล้วโอนต่อออกเกือบทั้งหมด</p></div>
    <div class="hero-k">
      <div class="kc"><span class="l">เงินเข้า 3 บัญชี</span><span class="v">${M(Y.in + K.in + O.in)}</span><span class="s">${nf(Y.n_in + K.n_in + O.n_in)} รายการ</span></div>
      <div class="kc"><span class="l">ฝากเงินสด (ตู้+สาขา)</span><span class="v">${M(DB.acs.reduce((s, a) => s + sumK(a, ["CASH_OTHER", "CASH_OWN", "COUNTER"]), 0))}</span><span class="s">${nf(DB.acs.reduce((s, a) => s + cntK(a, ["CASH_OTHER", "CASH_OWN", "COUNTER"]), 0))} ครั้ง</span></div>
      <div class="kc"><span class="l">ตู้ / สาขาที่ใช้ฝาก</span><span class="v">${nf(DB.acs.reduce((s, a) => s + a.machines.length, 0))} / ${nf(DB.acs.reduce((s, a) => s + a.branches.length, 0))}</span><span class="s">รอบตะเวนฝาก ${nf(DB.acs.reduce((s, a) => s + a.runs.length, 0))} รอบ</span></div>
    </div></section>
  <div class="hd"><h2>บัญชีเป้าหมาย</h2><div class="tools"><button class="tb" data-go="map">${IC("pin", 15)} แผนที่</button></div></div>
  <div class="cols2" style="grid-template-columns:repeat(auto-fit,minmax(290px,1fr))">${DB.acs.map(accCard).join("")}</div>
  <div class="hd"><h2>ข้อค้นพบสำคัญ</h2></div>
  <div class="find">
    ${DB.flow ? (() => { const K = DB.flow.kam, s = (f) => K.reduce((q, k) => q + f(k), 0), sd = s((k) => (k.st === "พบในบัญชีแถวแรก" ? k.amt : 0));
      return fi("★", `ผู้เสียหายโอน ${nf(K.length)} ครั้ง ${M(s((k) => k.amt))} — ไล่เส้นทางเงินได้ ${M(sd)}`,
        `เงินออกจากบัญชีแถวแรกแทบทันที : ถอนเป็นเงินสด ${M(s((k) => k.cash))} (${nf(s((k) => k.cash) / sd * 100, 0)}%) · โอนต่อไปบัญชีที่ยังไม่มี statement ${M(s((k) => k.ext))} (${nf(s((k) => k.ext) / sd * 100, 0)}%) ; พบกลุ่มบัญชีที่มีผู้ควบคุมร่วมกัน (คอกม้า) ${flClusters(DB.flow)} กลุ่ม — ดูรายกรรม บทบาทบัญชีม้า คอกม้า จุดถอนเงินสด และบัญชีชั้นถัดไปที่ต้องขอ statement`, "flow"); })() : ""}
    ${fi(1, Y.short + " รับเงินสดผ่านตู้/สาขา " + M(cashY) + " (" + nf(cashY / Y.in * 100, 1) + "% ของเงินเข้า)",
      `ฝากเงินสดที่ตู้ต่างธนาคารแบบไม่ระบุผู้ฝาก ${nf(cntK(Y, ["CASH_OTHER"]))} ครั้ง ${M(sumK(Y, ["CASH_OTHER"]))} ส่วนใหญ่ยอด 99,880 บาท (เงินสดราว 100,000 บาท/ครั้ง หลังหักค่าธรรมเนียม) ทำต่อเนื่องหลายตู้ในเวลาไม่กี่นาที รวม ${nf(Y.runs.length)} รอบ ; ตู้/สาขากรุงไทยที่ทราบที่ตั้งกระจายใน ${provs(Y).length} จังหวัด เช่น ${provs(Y).slice(0, 6).join(" · ")}`, "ykk")}
    ${fi(2, `${K.short} ใช้รูปแบบเดียวกับ ${Y.short} และมีผู้โอนร่วมกัน`,
      `มีผู้โอนผ่านตู้ ${both.length} รายที่โอนเข้าทั้ง 2 บัญชี และรับเงินจากบริษัทรับโอนเงินรายเดียวกัน ; ${yk ? `วันที่ ${dTh(yk.same[0].ta)} ฝากเงินสดเข้า${esc(K.short)} ${yk.same.length} ครั้งแล้วฝากเข้า${esc(Y.short)}ต่อภายใน ${nf(Math.min(...yk.same.map((s) => s.lag)))}–${nf(Math.max(...yk.same.map((s) => s.lag)))} นาที ด้วยรหัสตู้ ${esc(yk.same[0].mb)} ${mcode(yk.same[0].m, yk.same[0].gen)} เดียวกัน${ykGen ? ` <b>— แต่รหัสนี้เป็นรหัสไม่ครบ ยืนยันว่าเป็นตู้เครื่องเดียวกันไม่ได้ ต้องขอรหัสเครื่องเต็มจากธนาคารก่อนสรุป</b>` : ""} ; ` : ""} บัญชีเปิดที่${esc(K.home.name)} ถอนเงินสดที่เคาน์เตอร์ ${kesOut.length ? esc(kesOut[0].name) + " " + kesOut[0].n + " ครั้ง " + M(kesOut[0].amt) : "-"}`, "kes")}
    ${fi(3, `${O.short} (${O.bank}) เป็นบัญชีรับเงินย่อย เชื่อมกับกลุ่มบัญชีในหมาย B`,
      `รับเงินส่วนใหญ่ผ่านแอป ${nf(cntK(O, ["APP"]))} ครั้ง ${M(sumK(O, ["APP"]))} ; ฝากเงินสดที่ตู้กรุงศรีฯ ${nf(cntK(O, ["CASH_OWN"]))} ครั้ง ใน ${O.branches.filter((b) => b.kinds.CASH_OWN).length} รหัสสาขา ; มีโอนตรง/คู่บัญชีร่วมกับ ${oraGrp.map((l) => esc(l.oname)).join(" · ") || "-"} — ไม่พบตู้ร่วมกับ 2 บัญชีแรก`, "ora")}
    ${fi(4, `บุคคลที่น่าจะเป็นหัวหน้า/ผู้ควบคุม ${L1.length} ราย · ผู้ประสาน ${L2.length} ราย`,
      `${L1.map((p) => `<b>${esc(p.name)}</b>`).join(" · ")} — รับเงินรายการแรก (ทดสอบบัญชี) จากบริษัท ใช้หลายบัญชี และทำรายการตู้เดียวกันห่างกันไม่กี่นาที${l1p.length ? ` ${l1p.length} ครั้ง (ยืนยันเครื่องเดียวกันได้ ${l1u.length} ครั้ง${l1u.length ? " ที่ตู้ " + [...new Set(l1u.map((x) => x.mb + " " + x.m))].join(", ") : ""} ; อีก ${l1g.length} ครั้งเป็นรหัสไม่ครบ ${[...new Set(l1g.map((x) => x.mb + " " + x.m))].join(", ")})` : ""} ; ผู้ประสาน: ${L2.slice(0, 6).map((p) => esc(p.name)).join(" · ")}`, "net")}
    ${fi(5, `บัญชีเลขติดกัน ${DB.seq.length} คู่ (เปิดบัญชีพร้อมกัน สาขาเดียวกัน)`,
      `${DB.seq.map((s) => `${esc(s.n1)} / ${esc(s.n2)} (${s.bank})`).join(" · ")} — ลักษณะบัญชีม้าที่เปิดเป็นชุด ; ${DB.seq.filter((x) => x.co).length} คู่ทำรายการรหัสตู้เดียวกันห่างกันไม่กี่นาที แต่${DB.seq.some((x) => x.co_u) ? "บางครั้ง" : "ทุกครั้ง"}เป็นรหัสไม่ครบ (${[...new Set(DB.seq.flatMap((x) => x.codes))].join(", ")}) จึงยังยืนยันว่าเป็นตู้เครื่องเดียวกัน/คนเดียวถือบัตรไม่ได้`, "net")}
    ${(() => { const fi_ = DB.map.accs.map((x, i) => (x.id ? i : -1)).filter((i) => i >= 0), sm = seqSummary(fi_), A = DB.map.accs;
      const ex = sm.fast.slice().sort((x, y) => y.kmh - x.kmh).slice(0, 3).map((x) => `${dS(x.day)} ${esc(A[x.a].name.replace(/^(บริษัท|น\.ส\.?|นางสาว|นาย|นาง)\s*/, ""))} ${esc(x.fromP.prov || x.fromP.name)} → ${esc(x.P.prov || x.P.name)} ${nf(x.km, 0)} กม. ใน ${nf(x.min, 0)} นาที`);
      const md = sm.multi.slice(0, 4).map((x) => `${dS(x.day)} ${esc(A[x.a].name.replace(/^(บริษัท|น\.ส\.?|นางสาว|นาย|นาง)\s*/, ""))} (${x.provs.map(esc).join(" / ")})`);
      return fi(6, `เวลากับสถานที่: ${sm.multi.length} วันที่บัญชีเดียวมีรายการหลายจังหวัด · ${sm.fast.length} ช่วงฝาก/ถอนเงินสดที่เดินทางไม่ทัน`,
        `เรียงรายการที่ทราบพิกัดตามเวลา (${nf(sm.seq.length)} ลำดับ) แล้วเทียบระยะทางกับเวลาระหว่างจุด ; ถ้าฝาก/ถอนเงินสดของบัญชีเดียวกันเกิดห่างกันหลายร้อยกิโลเมตรในเวลาไม่กี่ชั่วโมง แปลว่าคนถือเงินสดมีมากกว่า 1 คน/ทีม ทำงานพร้อมกันคนละพื้นที่ (หรือพิกัดโดยประมาณคลาดเคลื่อน) ; ไม่นับรับโอนผ่านตู้ เพราะผู้โอนแต่ละรายทำเอง${ex.length ? " — เช่น " + ex.join(" ; ") : ""}${md.length ? ` ; วันที่มีหลายจังหวัด: ${md.join(" ; ")}` : ""} — ดูไล่ทีละวันได้ที่แผนที่ ปุ่ม ▶ และแท็บ "ลำดับเวลา"`, "map"); })()}
  </div>
  <div class="hd"><h2>ช่องทางเงินเข้า</h2></div>
  <div class="card"><div class="chartbox"><canvas id="cCmp"></canvas></div></div>`;
  const ks = ["CASH_OTHER", "CASH_OWN", "COUNTER", "ATMX", "APP", "OTHERIN"];
  chart($("#cCmp"), { type: "bar", data: { labels: DB.acs.map((a) => `${a.no}. ${a.short}`), datasets: ks.map((k) => ({ label: KL[k], backgroundColor: KC[k], data: DB.acs.map((a) => sumK(a, [k])) })) },
    options: baseOpt({ indexAxis: "y", scales: { x: { stacked: true, ticks: { color: inkC(), callback: (v) => M(v) }, grid: { color: gridC() } }, y: { stacked: true, ticks: { color: inkC() }, grid: { display: false } } },
      plugins: { legend: { labels: { color: inkC(), boxWidth: 12 } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${B(c.raw)} บาท` } } } }) });
}
const fi = (n, h, p, goT) => `<div class="item"><span class="num">${n}</span><div style="flex:1;min-width:0"><h3>${h}</h3><div class="fdrow"><details class="fd"><summary>รายละเอียด</summary><p>${p}</p></details>${goT ? `<a class="fgo" href="#${goT}" data-go="${goT}">เปิดหน้า →</a>` : ""}</div></div></div>`;
function accCard(a) {
  const tot = a.chan.reduce((s, c) => s + c.amt, 0) || 1;
  return `<div class="card acard" data-go="${a.id}" style="border-top:4px solid ${ACOL[a.id]}"><span class="eyebrow">บัญชีที่ ${a.no} · ${esc(a.bank)} ${esc(a.acc)}</span><h3>${esc(a.name)}</h3>
  <div class="bar" title="สัดส่วนช่องทางเงินเข้า">${a.chan.map((c) => `<i style="width:${c.amt / tot * 100}%;background:${KC[c.k]}" title="${esc(KL[c.k])} ${M(c.amt)}"></i>`).join("")}</div>
  <div class="row"><span>เงินเข้า / ออก</span><b>${M(a.in)} / ${M(a.out)}</b></div>
  <div class="row"><span>ฝากเงินสด</span><b>${M(sumK(a, ["CASH_OTHER", "CASH_OWN", "COUNTER"]))}</b></div>
  <div class="row muted"><span>${dTh(a.first)} – ${dTh(a.last)}</span><span>สาขา ${a.branches.length} · ตู้ ${a.machines.length}</span></div></div>`;
}

/* ================= หน้าบัญชี (สาขา/ตู้) ================= */
function pAcc(id) { pAccView(acOf(id), $("#main"), ACOL[id], id, location.hash.split("/")[1]); }
/* รายละเอียดบัญชีหนึ่งบัญชี (ใช้ได้ทั้ง 3 บัญชีหลักและบัญชีอื่น) : a = ผลวิเคราะห์ · m = กล่องที่แสดง · col = สี · hb = hash ของหน้า · t0 = แท็บเริ่มต้น */
function pAccView(a, m, col, hb, t0) {
  const cashN = cntK(a, ["CASH_OTHER", "CASH_OWN", "COUNTER"]), cashA = sumK(a, ["CASH_OTHER", "CASH_OWN", "COUNTER"]);
  const isBay = a.bank === "BAY";
  m.innerHTML = `
  <section class="hero"><div style="position:relative;z-index:1"><span class="eyebrow">${a.no ? `บัญชีที่ ${a.no} · ` : ""}${bankIco(a.bank)}${esc(bankTh(a.bank))} ${esc(a.acc)}${a.letter ? ` · หนังสือ ${esc(a.letter)}` : ""} ${srcTag(a.acc)}</span>
    <h1>${av(a.name, "lg")}${esc(a.name)}</h1>
    <p class="lead">${dTh(a.first)} – ${dTh(a.last)} · สาขาเจ้าของบัญชี ${esc(a.home.name)}${a.home.prov ? " (" + esc(a.home.prov) + ")" : ""}</p></div>
    <div class="hero-k">
      <div class="kc"><span class="l">เงินเข้า</span><span class="v">${M(a.in)}</span><span class="s">${nf(a.n_in)} ครั้ง</span></div>
      <div class="kc"><span class="l">เงินออก</span><span class="v">${M(a.out)}</span><span class="s">${nf(a.n_out)} ครั้ง</span></div>
      <div class="kc"><span class="l">ฝากเงินสด ตู้+สาขา</span><span class="v">${M(cashA)}</span><span class="s">${nf(cashN)} ครั้ง${provs(a).length ? " · " + provs(a).length + " จังหวัด" : ""}</span></div>
    </div></section>
  <div class="atabs sec"><div class="seg" id="aTabs">${[["sum", "สรุป"], ["br", `${isBay ? "รหัสสาขา" : "สาขา"} ${a.branches.length}`], ["mc", `ตู้ ${a.machines.length}`], ["run", `รอบตะเวนฝาก ${a.runs.length}`], ["flow", "เงินเข้า-ออก"]].map(([k, l]) => `<button data-at="${k}">${l}</button>`).join("")}</div>
  <details class="info"><summary title="หลักการระบุที่ตั้ง">i</summary><div class="info-box"><b>หลักการระบุที่ตั้ง</b><br>ชื่อ/ที่อยู่สาขาของทุกธนาคารมาจากรายการรหัสสาขา ธปท. ; รหัสสาขาในไฟล์เป็นที่ตั้งจริงเฉพาะเคาน์เตอร์ และตู้ของธนาคารเจ้าของบัญชี (${esc(a.bank)}) ; ตู้ธนาคารอื่นได้เพียงธนาคาร + รหัสตู้ ต้องขอที่ตั้งจากธนาคารเจ้าของตู้ ; <b>ไฟล์กรุงไทยเก็บรหัสเครื่องได้ 6 ตัวอักษร</b> — รหัสตู้ออมสิน/กรุงเทพ/ทีทีบี/ธ.ก.ส. จึงถูกตัด (แสดงลงท้าย …) ระบุเครื่องเฉพาะไม่ได้ ส่วนกสิกรไทย (เลข 5 หลัก) และไทยพาณิชย์ (4 ตัว) ได้รหัสครบ ; รายการรับโอนต่างธนาคารที่ไฟล์ไม่ระบุเครื่อง ไม่นับเป็นรายการที่ตู้${isBay ? " ; กรุงศรีฯ ลงรายการโอนผ่านแอปเป็นช่องทางสาขา รหัส 0700 (สำนักงานใหญ่) จึงไม่นับเป็นเคาน์เตอร์ และสาขาเจ้าของบัญชีดูจาก 3 หลักแรกของเลขบัญชี" : ""}</div></details></div>
  <div data-tab="sum">
  <div class="cols2 sec">
    <div class="card"><b>ช่องทางเงินเข้า</b><div class="chartbox sm"><canvas id="cCh"></canvas></div></div>
    <div class="card"><b>${isBay ? "ยอดฝากตามรหัสสาขา" : "ยอดฝากตามจังหวัด (สาขาที่ทราบที่ตั้ง)"}</b><div class="chartbox sm"><canvas id="cPv"></canvas></div></div>
  </div>
  <div class="card sec"><b>เงินเข้า-ออกรายวัน แยกช่องทาง</b><div class="chartbox"><canvas id="cDay"></canvas></div></div>
  <div class="card sec"><b>ช่วงเวลาที่ฝาก (จำนวนครั้งตามชั่วโมง)</b><div class="chartbox sm"><canvas id="cHr"></canvas></div></div>
  </div>
  <div data-tab="br"><div id="tBr"></div></div>
  <div data-tab="mc"><div id="tMc"></div></div>
  <div data-tab="run">
  <details class="tnote"><summary>วิธีอ่านแท็บนี้</summary><p class="note"><b>รอบ</b> = เงินสดที่ฝากต่อเนื่องห่างกันไม่เกิน 20 นาที (คนเดียว/ทีมเดียวตะเวนฝาก) ;
    <b>พื้นที่</b> = รอบที่ใช้ตู้เครื่องเดียวกัน (นับเฉพาะรหัสตู้ที่ระบุเครื่องได้ และไม่รวมรอบที่จุดอ้างอิงคนละจังหวัด) ตู้ในพื้นที่เดียวกันจึงอยู่ใกล้กัน ;
    <b>กดแถวในตารางพื้นที่</b> = ตารางรอบด้านล่างเหลือเฉพาะรอบของพื้นที่นั้น (กดซ้ำ = ดูทุกรอบ) ; รหัสตู้กรอบประ = <span class="gcode">รหัสไม่ครบ</span> ไม่ระบุเครื่อง</p></details>
  <div id="tArea"></div>
  <div id="tRun"></div></div>
  <div data-tab="flow"><div id="tCp"></div></div>`;
  const setTab = (k) => { $$("#aTabs button", m).forEach((x) => x.classList.toggle("on", x.dataset.at === k)); $$("[data-tab]", m).forEach((x) => (x.hidden = x.dataset.tab !== k)); if (k === "sum") CH.forEach((c) => c.resize()); try { history.replaceState(null, "", "#" + hb + "/" + k); } catch (e) { } };
  $("#aTabs").addEventListener("click", (e) => { const x = e.target.closest("[data-at]"); if (x) setTab(x.dataset.at); });
  // กราฟ
  chart($("#cCh"), { type: "doughnut", data: { labels: a.chan.map((c) => KL[c.k]), datasets: [{ data: a.chan.map((c) => c.amt), backgroundColor: a.chan.map((c) => KC[c.k]) }] },
    options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { position: "right", labels: { color: inkC(), boxWidth: 12 } }, tooltip: { callbacks: { label: (c) => `${c.label}: ${B(c.raw)} บาท (${a.chan[c.dataIndex].n} ครั้ง)` } } } } });
  const pv = isBay ? a.branches.map((b) => ({ prov: b.code, amt: b.amt, n: b.n })) : a.prov;
  chart($("#cPv"), { type: "bar", data: { labels: pv.map((p) => p.prov), datasets: [{ label: "ยอดฝาก", data: pv.map((p) => p.amt), backgroundColor: col }] },
    options: baseOpt({ indexAxis: "y", plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${B(c.raw)} บาท · ${pv[c.dataIndex].n} ครั้ง` } } },
      scales: { x: { ticks: { color: inkC(), callback: (v) => M(v) }, grid: { color: gridC() } }, y: { ticks: { color: inkC(), autoSkip: false }, grid: { display: false } } } }) });
  const ks = ["CASH_OTHER", "CASH_OWN", "COUNTER", "ATMX", "APP"];
  chart($("#cDay"), { type: "bar", data: { labels: a.days.map(dTh), datasets: ks.map((k) => ({ label: KL[k], backgroundColor: KC[k], data: a.daily[k], stack: "in" })).concat([{ type: "line", label: "เงินออก", data: a.daily.OUT, borderColor: KC.OUT, backgroundColor: KC.OUT, pointRadius: 0, borderWidth: 1.5 }]) },
    options: baseOpt({ scales: { x: { stacked: true, ticks: { color: inkC(), maxTicksLimit: 14 }, grid: { display: false } }, y: { stacked: true, ticks: { color: inkC(), callback: (v) => M(v) }, grid: { color: gridC() } } },
      plugins: { legend: { labels: { color: inkC(), boxWidth: 12 } }, tooltip: { mode: "index", intersect: false, callbacks: { label: (c) => c.raw ? `${c.dataset.label}: ${B(c.raw)}` : null } } } }) });
  chart($("#cHr"), { type: "bar", data: { labels: [...Array(24).keys()].map((h) => h + ":00"), datasets: ["CASH_OTHER", "CASH_OWN", "COUNTER", "ATMX"].map((k) => ({ label: KL[k], backgroundColor: KC[k], data: a.hour[k] })) },
    options: baseOpt({ scales: { x: { stacked: true, ticks: { color: inkC() }, grid: { display: false } }, y: { stacked: true, ticks: { color: inkC() }, grid: { color: gridC() } } } }) });

  const depTbl = (title, rows, det) => table(det, {
    title, rows: () => rows, sort: "t", desc: false, csvName: `รายการ_${a.id}`, max: 600,
    cols: [{ k: "t", lab: "วันเวลา", f: (x) => dtTh(x.t), date: (x) => x.t }, { k: "k", lab: "ประเภท", f: (x) => kb(x.k), v: (x) => KL[x.k] }, { k: "amt", lab: "ยอด", n: 1, f: (x) => B(x.amt) },
      { k: "mb", lab: "ธนาคารตู้", v: (x) => x.mb }, { k: "m", lab: "รหัสตู้", f: (x) => (x.m ? mcode(x.m, x.gen) : x.mn ? '<small class="muted">ไม่ระบุเครื่อง</small>' : ""), v: (x) => (x.m ? x.m + (x.gen ? " (รหัสไม่ครบ)" : "") : x.mn ? "ไม่ระบุเครื่อง (โอนต่างธนาคาร)" : "") }, { k: "loc", lab: "สาขา (ที่ตั้ง)", w: 1, v: (x) => [x.site, x.loc ? `${x.loc.code} ${x.loc.name}${x.loc.prov ? " · " + x.loc.prov : ""}` : ""].filter(Boolean).join(" · ") },
      { k: "nm", lab: "ผู้โอน (ถ้ามี)", v: (x) => (x.nm ? `${x.nm} ${x.fb} ${x.fa}` : x.fa || "") }],
    total: (r) => `รวม ${B(r.reduce((s, x) => s + x.amt, 0))} บาท`,
  });
  table($("#tBr"), {
    title: isBay ? "รหัสสาขาที่ฝากเงิน (ตู้/เคาน์เตอร์กรุงศรีฯ)" : "สาขาที่ฝากเงิน (ตู้/ADM/เคาน์เตอร์ กรุงไทย — ทราบที่ตั้ง)", sub: "กดแถวเพื่อดูรายการ", rows: () => a.branches, sort: "amt", csvName: `สาขาที่ฝาก_${a.id}`,
    cols: [{ k: "code", lab: "รหัสสาขา" }, { k: "name", lab: "ชื่อสาขา", w: 1 }, { k: "prov", lab: "จังหวัด", v: (x) => x.prov || "-" },
      { k: "kinds", lab: "ช่องทาง", f: (x) => Object.entries(x.kinds).map(([k, n]) => `${kb(k)} ${n}`).join(" "), v: (x) => Object.entries(x.kinds).map(([k, n]) => KL[k] + " " + n).join(" ; "), s: (x) => x.n },
      { k: "n", lab: "ครั้ง", n: 1 }, { k: "amt", lab: "ยอดฝาก", n: 1, f: (x) => B(x.amt) }, { k: "days", lab: "วัน", n: 1 },
      { k: "first", lab: "ครั้งแรก–ล่าสุด", f: (x) => `${dTh(x.first)} – ${dTh(x.last)}`, range: (x) => [x.first, x.last], rl: ["ครั้งแรก", "ล่าสุด"] }, { k: "machines", lab: "ตู้", v: (x) => x.machines.join(" ") }, { k: "people", lab: "ผู้โอนที่ระบุชื่อ", w: 1, v: (x) => x.people.join(", ") }],
    total: (r) => `รวม ${B(r.reduce((s, x) => s + x.amt, 0))} บาท`,
    click: (x, det) => depTbl(`รายการที่ ${x.code} ${x.name}`, a.deps.filter((d) => d.loc && d.loc.code === x.code), det),
  });
  const banks = [...new Set(a.machines.map((x) => x.b))].sort();
  const fb = { bk: "" };
  const mt = table($("#tMc"), {
    title: "ตู้ที่ใช้ฝาก/โอนเข้า (ทุกธนาคาร)", sub: "กดแถวเพื่อดูรายการ", rows: () => a.machines.filter((x) => !fb.bk || x.b === fb.bk), sort: "amt", csvName: `ตู้ที่ฝาก_${a.id}`,
    extra: `<select class="tin" data-bk><option value="">ทุกธนาคาร</option>${banks.map((b) => `<option value="${b}">${esc(bankTh(b))}</option>`).join("")}</select>`,
    cols: [{ k: "b", lab: "ธนาคารตู้", v: (x) => bankTh(x.b) }, { k: "m", lab: "รหัสตู้", f: (x) => mcode(x.m, x.gen) + (x.gen ? ' <small class="muted">รหัสไม่ครบ</small>' : ""), v: (x) => x.m + (x.gen ? " (รหัสไม่ครบ)" : "") }, { k: "loc", lab: "ที่ตั้ง (ถ้าทราบ)", w: 1, v: (x) => x.site || (x.loc ? `${x.loc.name}${x.loc.prov ? " · " + x.loc.prov : ""}` : "ต้องขอจากธนาคารเจ้าของตู้") },
      { k: "ncash", lab: "เงินสด", n: 1 }, { k: "nx", lab: "โอน", n: 1 }, { k: "people", lab: "ผู้โอน", n: 1 }, { k: "amt", lab: "ยอดรวม", n: 1, f: (x) => B(x.amt) },
      { k: "days", lab: "วัน", n: 1 }, { k: "h0", lab: "ช่วงเวลา", v: (x) => `${String(x.h0).padStart(2, "0")}–${String(x.h1).padStart(2, "0")} น.` }, { k: "area", lab: "พื้นที่", n: 1, v: (x) => x.area || "", f: (x) => (x.area ? `<button class="alink" data-area="${x.area}">พื้นที่ ${x.area}</button>` : (x.gen ? `<span class="muted" title="${GEN_TIP}">—</span>` : "")) },
      { k: "first", lab: "ช่วงวันที่", f: (x) => `${dTh(x.first)} – ${dTh(x.last)}`, range: (x) => [x.first, x.last] }],
    total: (r) => `รวม ${B(r.reduce((s, x) => s + x.amt, 0))} บาท`,
    click: (x, det) => depTbl(`รายการที่ตู้ ${x.b} ${x.m}`, a.deps.filter((d) => d.m === x.m && d.mb === x.b), det),
  });
  $("[data-bk]", $("#tMc")).addEventListener("change", (e) => { fb.bk = e.target.value; mt.draw(); });
  const fa = { area: "" };
  const rt = table($("#tRun"), {
    title: "รอบตะเวนฝากเงินสด", sub: "กดแถว = ดูรายการในรอบ", rows: () => a.runs.filter((x) => !fa.area || String(x.area) === fa.area || (fa.area === "none" && !x.area)), sort: "amt", csvName: `รอบตะเวนฝาก_${a.id}`,
    extra: `<select class="tin" data-ar><option value="">ทุกพื้นที่</option>${a.areas.map((r) => `<option value="${r.id}">พื้นที่ ${r.id}${r.provs.length ? " · " + r.provs.join("/") : ""}</option>`).join("")}<option value="none">ไม่ระบุพื้นที่ (รหัสไม่ครบ)</option></select>`,
    cols: [{ k: "st", lab: "เริ่ม", f: (x) => dtTh(x.st), date: (x) => x.st }, { k: "en", lab: "สิ้นสุด", f: (x) => x.en.slice(11, 16), date: (x) => x.en }, { k: "min", lab: "นาที", n: 1 }, { k: "n", lab: "ครั้ง", n: 1 },
      { k: "amt", lab: "ยอดเข้าบัญชี", n: 1, f: (x) => B(x.amt) }, { k: "cash", lab: "เงินสดโดยประมาณ", n: 1, f: (x) => B(x.cash) },
      { k: "route", lab: "เส้นทางตู้", w: 1, f: (x) => routeH(x.route), v: (x) => x.route.join(" > "), s: (x) => x.route.length },
      { k: "banks", lab: "ธนาคาร", v: (x) => x.banks.join(" ") }, { k: "loc", lab: "จุดอ้างอิงที่ตั้ง", w: 1, v: (x) => (x.loc ? `${x.loc.name}${x.loc.prov ? " · " + x.loc.prov : ""}` : "") },
      { k: "area", lab: "พื้นที่", n: 1, v: (x) => x.area || "", f: (x) => (x.area ? `<button class="alink" data-area="${x.area}">พื้นที่ ${x.area}</button>` : `<span class="muted" title="ทุกตู้ในรอบนี้เป็นรหัสไม่ครบ — จัดพื้นที่ไม่ได้">—</span>`) }],
    total: (r) => `รวม ${B(r.reduce((s, x) => s + x.amt, 0))} บาท`,
    click: (x, det) => depTbl(`รายการในรอบ ${dtTh(x.st)}`, a.deps.filter((d) => d.run === x.id), det),
  });
  const pal = ["#1565C0", "#B3261E", "#2E7D32", "#6A1B9A", "#E08A00", "#00838F", "#AD1457", "#5D4037", "#455A64", "#827717", "#283593", "#BF360C"];
  const noA = a.runs.filter((x) => !x.area);
  const pickArea = (v, toggle) => { const sel = $("[data-ar]", $("#tRun")); if (toggle && sel.value === v) v = ""; if (sel.value === v) return; sel.value = v; sel.dispatchEvent(new Event("change", { bubbles: true })); };
  table($("#tArea"), {
    title: "พื้นที่ปฏิบัติการ", sub: `${a.areas.length} พื้นที่ · ${a.runs.length - noA.length} รอบ${noA.length ? ` · ไม่ระบุพื้นที่ ${noA.length} รอบ (รหัสไม่ครบทั้งรอบ)` : ""} · กดแถว = กรองตารางรอบด้านล่าง`,
    rows: () => a.areas, sort: "amt", csvName: `พื้นที่ปฏิบัติการ_${a.id}`,
    cols: [{ k: "id", lab: "พื้นที่", n: 1, f: (x) => `<b>พื้นที่ ${x.id}</b>`, v: (x) => x.id },
      { k: "loc", lab: "จังหวัด / จุดอ้างอิง", sh: "จังหวัด/จุดอ้างอิง", w: 1, v: (x) => [x.provs.join(", "), x.anchors.map((y) => y.name).join(", ")].filter(Boolean).join(" · ") || "ยังไม่มีจุดอ้างอิงที่ตั้ง" },
      { k: "runs", lab: "รอบ", n: 1 }, { k: "n", lab: "ครั้ง", n: 1 }, { k: "amt", lab: "ยอด", n: 1, f: (x) => B(x.amt) },
      { k: "first", lab: "ช่วงวันที่", f: (x) => `${dTh(x.first)} – ${dTh(x.last)}`, range: (x) => [x.first, x.last] },
      { k: "machines", lab: "ตู้ (รหัสเฉพาะเครื่อง)", sh: "ตู้", w: 1, f: (x) => `<div class="route">${x.machines.map((c) => `<span>${esc(c)}</span>`).join("")}</div>`, v: (x) => x.machines.join(" "), s: (x) => x.machines.length },
      { k: "gen", lab: "รหัสไม่ครบที่พบร่วม", sh: "รหัสไม่ครบ", f: (x) => x.gen.map((c) => mcode(c, true)).join(" ") || "-", v: (x) => x.gen.join(" ") }],
    total: (r) => `รวม ${B(r.reduce((s, x) => s + x.amt, 0))} บาท`,
    click: (x) => { pickArea(String(x.id), true); setTimeout(() => $("#tRun").scrollIntoView({ behavior: "smooth", block: "start" }), 60); },
  });
  const markArea = () => { const rows = $("#tArea table")._rows || []; $$("#tArea tbody tr").forEach((tr, i) => tr.classList.toggle("sel", !!fa.area && !!rows[i] && String(rows[i].id) === fa.area)); };
  $("[data-ar]", $("#tRun")).addEventListener("change", (e) => { fa.area = e.target.value; rt.draw(); markArea(); });
  m.onclick = (e) => { const b = e.target.closest(".alink[data-area]"); if (!b) return; e.stopPropagation(); setTab("run"); pickArea(b.dataset.area); markArea(); $("#tRun").scrollIntoView({ behavior: "smooth", block: "start" }); };
  /* คู่โอน เงินเข้า-ออก (แบบ PV in / PV out ของไฟล์ EDIT แต่รวมเป็นตารางเดียว) */
  const fc = { dir: "", ch: "" };
  const cpRows = () => {
    const g = new Map();
    a.tx.forEach((r) => { if (fc.ch && r[6] !== fc.ch) return;
      const k = r[3] || r[4], o = g.get(k) || { key: k, acc: r[3], name: r[4], bank: r[5], in_n: 0, in_amt: 0, out_n: 0, out_amt: 0, ch: new Set(), rows: [] };
      if (r[1] === "I") { o.in_n++; o.in_amt += r[2]; } else { o.out_n++; o.out_amt += r[2]; }
      if (!o.name && r[4]) o.name = r[4]; o.ch.add(r[6]); o.rows.push(r); g.set(k, o); });
    return [...g.values()].map((o) => Object.assign(o, { tot: o.in_amt + o.out_amt, chs: [...o.ch].sort().join(", ") }))
      .filter((o) => !fc.dir || (fc.dir === "in" ? o.in_n : fc.dir === "out" ? o.out_n : o.in_n && o.out_n));
  };
  const txTbl = (title, rows, det) => table(det, { title, rows: () => rows.map((r) => ({ t: r[0], d: r[1], amt: r[2], ch: r[6], m: r[7], kind: r[8], loc: r[9] || "" })), sort: "t", desc: false, max: 800, csvName: `รายการคู่โอน_${a.id}`,
    cols: [{ k: "t", lab: "วันเวลา", f: (x) => dtTh(x.t), date: (x) => x.t }, { k: "d", lab: "ทิศ", f: (x) => (x.d === "I" ? '<span class="badge g">เงินเข้า</span>' : '<span class="badge r">เงินออก</span>'), v: (x) => (x.d === "I" ? "เงินเข้า" : "เงินออก") },
      { k: "amt", lab: "ยอด", n: 1, f: (x) => B(x.amt) }, { k: "loc", lab: "สาขา/ที่ตั้ง", w: 1, v: (x) => x.loc || (x.m ? "ตู้ธนาคารอื่น — ไม่ทราบที่ตั้ง" : "") }, { k: "ch", lab: "ช่องทาง" },
      { k: "m", lab: "ตู้", f: (x) => (x.m ? `${esc(x.m.split(" ")[0])} ${mcode(x.m.split(" ").slice(1).join(" "))}` : ""), v: (x) => x.m }, { k: "kind", lab: "ประเภท" }],
    total: (r) => `เข้า ${B(r.filter((x) => x.d === "I").reduce((s, x) => s + x.amt, 0))} · ออก ${B(r.filter((x) => x.d === "O").reduce((s, x) => s + x.amt, 0))} บาท` });
  const ct = table($("#tCp"), {
    title: "คู่โอน เงินเข้า–ออก", sub: "รวม PV in / PV out ไว้ในตารางเดียว · กดแถว = ดูรายการของคู่โอนนั้น", rows: cpRows, sort: "tot", csvName: `คู่โอนเข้าออก_${a.id}`, lead: false,
    extra: `<select class="tin" data-dir><option value="">ทุกทิศ</option><option value="in">มีเงินเข้า</option><option value="out">มีเงินออก</option><option value="both">ทั้งเข้าและออก</option></select>
      <select class="tin" data-ch><option value="">ทุกช่องทาง</option>${[...new Set(a.tx.map((r) => r[6]))].map((c) => `<option>${esc(c)}</option>`).join("")}</select>`,
    cols: [{ k: "name", lab: "คู่โอน", w: 1, v: (x) => x.name || "(ไม่มีชื่อในไฟล์)" },
      { k: "in_amt", lab: "เงินเข้า (บาท)", n: 1, f: (x) => (x.in_n ? B(x.in_amt) : "") }, { k: "out_amt", lab: "เงินออก (บาท)", n: 1, f: (x) => (x.out_n ? B(x.out_amt) : "") },
      { k: "in_n", lab: "เข้า (ครั้ง)", n: 1, f: (x) => (x.in_n ? nf(x.in_n) : "") }, { k: "out_n", lab: "ออก (ครั้ง)", n: 1, f: (x) => (x.out_n ? nf(x.out_n) : "") },
      { k: "bank", lab: "ธนาคาร" }, { k: "acc", lab: "เลขบัญชี" }, { k: "chs", lab: "ช่องทาง" }, { k: "tot", lab: "รวมเข้า+ออก", n: 1, f: (x) => B(x.tot) }],
    total: (r) => `เข้า ${B(r.reduce((s, x) => s + x.in_amt, 0))} · ออก ${B(r.reduce((s, x) => s + x.out_amt, 0))} บาท`,
    click: (x, det) => txTbl(`${esc(x.name || x.acc)} ${x.acc ? `<small>${esc(x.bank)} ${esc(x.acc)}</small>` : ""}`, fc.ch ? x.rows.filter((r) => r[6] === fc.ch) : x.rows, det),
  });
  $("[data-dir]", $("#tCp")).addEventListener("change", (e) => { fc.dir = e.target.value; ct.draw(); });
  $("[data-ch]", $("#tCp")).addEventListener("change", (e) => { fc.ch = e.target.value; ct.draw(); });
  setTab(["sum", "br", "mc", "run", "flow"].includes(t0) ? t0 : "sum");
}

/* ================= บทบาท / เครือข่าย ================= */
function pNet(m) {
  const P = DB.people;
  m.innerHTML = `<div class="hd"><h2>บทบาท หัวหน้า-ลูกน้อง<details class="info"><summary title="วิธีอ่านผัง">i</summary><div class="info-box">วงใน = ผู้ควบคุม/หัวหน้า (สันนิษฐาน) · วงกลาง = ผู้ประสาน/ถือหลายบัญชี · วงนอก = ผู้ปฏิบัติ (แสดง 60 รายยอดสูงสุด) · เส้นสีเหลืองประ = ทำรายการตู้เดียวกันภายใน 5 นาที · ชี้/แตะที่จุดเพื่อดูรายละเอียด<br><br>บทบาทเป็น <b>ข้อสันนิษฐานจากพฤติการณ์ทางการเงิน</b> (คะแนนจาก: รับเงินรายการแรก/ทดสอบบัญชี · ใช้หลายบัญชี · โอนเข้าหลายบัญชีเป้าหมาย · ยอดสูง · ทำรายการตู้เดียวกันกับผู้อื่นภายใน 5 นาที · รับเงินกลับ) ต้องยืนยันด้วยภาพ CCTV ข้อมูลผู้ถือบัตร และคำให้การ ; ผู้ฝาก<b>เงินสด</b>ที่ตู้ต่างธนาคารไม่มีชื่อในไฟล์ จึงไม่อยู่ในผังนี้ — ดูที่ "รอบตะเวนฝาก" ในหน้าบัญชี</div></details></h2></div>
  <div class="card" style="padding:8px"><svg id="net" class="net" viewBox="0 0 1000 760"></svg>
  <div class="lg">${Object.entries(ROLE).map(([k, v]) => `<span><span class="rl ${k}">${k}</span> ${v}</span>`).join("")}${DB.acs.map((a) => `<span><span class="dot" style="background:${ACOL[a.id]}"></span>บัญชีที่ ${a.no} ${esc(a.short)}</span>`).join("")}</div></div>
  <div class="seg sec" id="nTabs">${[["p", `บุคคล ${P.length}`], ["pair", `ตู้เดียวกัน ≤5 นาที ${DB.pairs.length}`], ["seq", `บัญชีเลขติดกัน ${DB.seq.length}`], ["pref", `เปิดบัญชีสาขาเดียวกัน ${DB.pref.length}`]].map(([k, l]) => `<button data-nt="${k}" class="${k === "p" ? "on" : ""}">${l}</button>`).join("")}</div>
  <div data-n="p"><div id="tP"></div></div><div data-n="pair" hidden><div id="tPair"></div></div><div data-n="seq" hidden><div id="tSeq"></div></div><div data-n="pref" hidden><div id="tPref"></div></div>`;
  $("#nTabs").addEventListener("click", (e) => { const b = e.target.closest("[data-nt]"); if (!b) return; $$("#nTabs button").forEach((x) => x.classList.toggle("on", x === b)); $$("[data-n]", m).forEach((x) => (x.hidden = x.dataset.n !== b.dataset.nt)); });
  drawNet();
  const roleSel = `<select class="tin" data-role><option value="">ทุกบทบาท</option>${Object.entries(ROLE).map(([k, v]) => `<option value="${k}">${k} ${v}</option>`).join("")}</select>`;
  const fr = { role: "" };
  const tp = table($("#tP"), {
    title: "บุคคลที่โอนผ่านตู้ ATM เข้าบัญชีเป้าหมาย", sub: "เรียงตามคะแนนบทบาท · ชี้ที่พฤติการณ์เพื่อดูครบทุกข้อ (ไฟล์ Excel มีครบ)", lead: false, rows: () => P.filter((p) => !fr.role || p.role === fr.role), sort: "score", csvName: "บทบาทบุคคล", extra: roleSel,
    cols: [{ k: "role", lab: "บทบาท", f: (p) => `<span class="rl ${p.role}">${p.role}</span>`, v: (p) => ROLE[p.role], s: (p) => p.score }, { k: "score", lab: "คะแนน", n: 1 },
      { k: "name", lab: "ชื่อ" }, { k: "accs", lab: "บัญชีที่ใช้", w: 1, v: (p) => p.accs.map((a) => `${a.bank} ${a.acc}`).join(", "), s: (p) => p.accs.length },
      { k: "dst", lab: "โอนเข้า", f: (p) => Object.keys(p.dst).map(acTag).join(" "), v: (p) => Object.keys(p.dst).map((d) => (acOf(d) || {}).short || d).join(", "), s: (p) => Object.keys(p.dst).length },
      { k: "n", lab: "ครั้ง", n: 1 }, { k: "amt", lab: "ยอดโอนผ่านตู้", n: 1, f: (p) => B(p.amt) }, { k: "why", lab: "พฤติการณ์", w: 1, f: (p) => (p.why.length ? `<span title="${esc(p.why.join("\n"))}">${esc(p.why[0])}${p.why.length > 1 ? ` <small class="muted">+${p.why.length - 1}</small>` : ""}</span>` : ""), v: (p) => p.why.join(" ; "), s: (p) => p.why.length }],
  });
  $("[data-role]", $("#tP")).addEventListener("change", (e) => { fr.role = e.target.value; tp.draw(); });
  table($("#tPair"), { title: "ทำรายการรหัสตู้เดียวกันภายใน 5 นาที (คนละบัญชี)", sub: "รหัสเฉพาะเครื่อง = มาด้วยกัน/คนเดียวถือหลายบัตร ; รหัสไม่ครบ = ยืนยันเครื่องเดียวกันไม่ได้", rows: () => DB.pairs, sort: "t", desc: false, csvName: "ตู้เดียวกัน5นาที",
    cols: [{ k: "t", lab: "วันเวลา", f: (x) => dtTh(x.t), date: (x) => x.t }, { k: "m", lab: "ตู้", f: (x) => `${esc(x.mb)} ${mcode(x.m, x.gen)}`, v: (x) => `${x.mb} ${x.m}` }, { k: "gen", lab: "รหัสตู้", v: (x) => (x.gen ? "รหัสไม่ครบ" : "เฉพาะเครื่อง") }, { k: "n1", lab: "รายที่ 1", v: (x) => `${x.n1} (${x.a1})` }, { k: "x1", lab: "ยอด", n: 1, f: (x) => B(x.x1) },
      { k: "n2", lab: "รายที่ 2", v: (x) => `${x.n2} (${x.a2})` }, { k: "x2", lab: "ยอด", n: 1, f: (x) => B(x.x2) }, { k: "lag", lab: "ห่าง (นาที)", n: 1 }, { k: "d1", lab: "เข้าบัญชี", f: (x) => acTag(x.d1) }] });
  table($("#tSeq"), { title: "บัญชีเลขติดกัน (เปิดพร้อมกัน)", rows: () => DB.seq, search: false, csvName: "บัญชีเลขติดกัน",
    cols: [{ k: "bank", lab: "ธนาคาร" }, { k: "n1", lab: "บัญชี 1", v: (x) => `${x.n1} ${x.a1}` }, { k: "n2", lab: "บัญชี 2", v: (x) => `${x.n2} ${x.a2}` }, { k: "diff", lab: "เลขห่าง", n: 1 },
      { k: "co", lab: "ตู้เดียวกัน ≤5 นาที", n: 1 }, { k: "codes", lab: "รหัสตู้", f: (x) => x.codes.map((c) => mcode(c.split(" ").slice(1).join(" "))).join(" ") || "-", v: (x) => x.codes.join(", ") }] });
  table($("#tPref"), { title: "เปิดบัญชีสาขาเดียวกัน (3 หลักแรก) ≥ 3 ราย", rows: () => DB.pref, search: false, csvName: "สาขาเปิดบัญชีเดียวกัน",
    cols: [{ k: "bank", lab: "ธนาคาร" }, { k: "pre", lab: "รหัสนำ" }, { k: "n", lab: "ราย", n: 1 }, { k: "amt", lab: "ยอด", n: 1, f: (x) => B(x.amt) }, { k: "names", lab: "รายชื่อ", w: 1, v: (x) => x.names.join(", ") }] });
}
function drawNet() {
  const svg = $("#net"), W = 1000, H = 760, cx = W / 2, cy = H / 2 + 10;
  const acs = DB.acs.map((a, i) => ({ id: "A:" + a.id, a, x: cx + Math.cos(-Math.PI / 2 + i * 2 * Math.PI / 3) * 70, y: cy + Math.sin(-Math.PI / 2 + i * 2 * Math.PI / 3) * 70 }));
  const L = { L1: DB.people.filter((p) => p.role === "L1"), L2: DB.people.filter((p) => p.role === "L2"), L3: DB.people.filter((p) => p.role === "L3").sort((a, b) => b.amt - a.amt).slice(0, 60) };
  const R = { L1: 175, L2: 265, L3: 345 }, nodes = [...acs], byKey = {};
  for (const lv of ["L1", "L2", "L3"]) {
    const arr = L[lv].slice().sort((a, b) => (Object.keys(a.dst)[0] || "").localeCompare(Object.keys(b.dst)[0] || "")), n = arr.length;
    arr.forEach((p, i) => { const ang = -Math.PI / 2 + (i + 0.5) * 2 * Math.PI / Math.max(n, 1) + (lv === "L2" ? 0.3 : 0); const nd = { id: "P:" + p.key, p, lv, x: cx + Math.cos(ang) * R[lv] * 1.32, y: cy + Math.sin(ang) * R[lv] }; nodes.push(nd); byKey[p.key] = nd; });
  }
  const maxA = Math.max(...DB.people.map((p) => p.amt));
  const rad = (p) => 4 + Math.sqrt(p.amt / maxA) * 16;
  let edges = "";
  nodes.filter((n) => n.p).forEach((n) => Object.entries(n.p.dst).forEach(([d, v]) => { const t = acs.find((x) => x.a.id === d); edges += `<path class="ed" data-a="${n.id}" data-b="${t.id}" d="M${n.x},${n.y} Q${(n.x + t.x) / 2 + (cy - n.y) * 0.08},${(n.y + t.y) / 2 + (n.x - cx) * 0.08} ${t.x},${t.y}" stroke="${ACOL[d]}" stroke-opacity=".35" stroke-width="${1 + Math.sqrt(v / maxA) * 5}"/>`; }));
  const seen = new Set();
  DB.people.forEach((p) => p.ties.forEach((t) => { const a = byKey[p.key], b = byKey[t.k]; if (!a || !b) return; const k = [p.key, t.k].sort().join("|"); if (seen.has(k)) return; seen.add(k);
    edges += `<path class="ed" data-a="${a.id}" data-b="${b.id}" d="M${a.x},${a.y} L${b.x},${b.y}" stroke="#E0A800" stroke-width="${1.5 + t.n * 0.6}" stroke-dasharray="5 4"/>`; }));
  const RC = { L1: "#B3261E", L2: "#E08A00", L3: "#90A4AE" };
  const nd = nodes.map((n) => n.a ? `<g class="nd" data-id="${n.id}" transform="translate(${n.x},${n.y})"><circle r="30" fill="${ACOL[n.a.id]}" stroke="#fff" stroke-width="2"/><text text-anchor="middle" dy="5" fill="#fff" font-size="18" font-weight="700">${n.a.no}</text><text text-anchor="middle" dy="48" font-size="13" font-weight="700" fill="${ACOL[n.a.id]}">${esc(n.a.short)}</text></g>`
    : `<g class="nd" data-id="${n.id}" transform="translate(${n.x},${n.y})"><circle r="${rad(n.p)}" fill="${RC[n.lv]}" stroke="#fff" stroke-width="1.5"/>${n.lv !== "L3" ? `<text text-anchor="middle" dy="${-rad(n.p) - 4}" font-size="${n.lv === "L1" ? 13 : 11}" font-weight="700" fill="currentColor">${esc(n.p.name.replace(/^(MR\.?|MRS\.?|MS\.?|MISS|MISTER)\s*/i, "").replace(/\s*-\s*$/, ""))}</text>` : ""}</g>`).join("");
  svg.innerHTML = `<g style="color:var(--ink)">${edges}${nd}</g>`;
  const tip = $("#tip");
  const show = (e, n) => {
    tip.innerHTML = n.a ? `<b>บัญชีที่ ${n.a.no} ${esc(n.a.name)}</b><br>${esc(n.a.bank)} ${esc(n.a.acc)}<br>เงินเข้า ${B(n.a.in)}`
      : `<b>${esc(n.p.name)}</b> · ${ROLE[n.lv]}<br>${n.p.accs.map((a) => `${a.bank} ${a.acc}`).join(", ")}<br>โอนผ่านตู้ ${B(n.p.amt)} บาท (${n.p.n} ครั้ง)<br>${n.p.why.slice(0, 3).map(esc).join("<br>")}`;
    tip.hidden = false; tip.style.left = Math.min(e.clientX + 14, innerWidth - 350) + "px"; tip.style.top = Math.min(e.clientY + 14, innerHeight - 160) + "px";
  };
  const hl = (id) => { svg.classList.toggle("dim", !!id); $$(".hi", svg).forEach((x) => x.classList.remove("hi")); if (!id) return;
    $$(`.nd[data-id="${CSS.escape(id)}"]`, svg).forEach((x) => x.classList.add("hi"));
    $$(".ed", svg).forEach((e) => { if (e.dataset.a === id || e.dataset.b === id) { e.classList.add("hi"); $$(`.nd[data-id="${CSS.escape(e.dataset.a === id ? e.dataset.b : e.dataset.a)}"]`, svg).forEach((x) => x.classList.add("hi")); } }); };
  svg.addEventListener("mousemove", (e) => { const g = e.target.closest(".nd"); if (!g) { tip.hidden = true; return; } show(e, nodes.find((n) => n.id === g.dataset.id)); });
  svg.addEventListener("mouseleave", () => { tip.hidden = true; });
  svg.addEventListener("click", (e) => { const g = e.target.closest(".nd"); hl(g && !g.classList.contains("hi") ? g.dataset.id : null); });
}

/* ================= ความเชื่อมโยงบัญชี ================= */
function pLink(m) {
  const LK = DB.links;
  const same = LK.flatMap((l) => l.same.map((s) => Object.assign({ a: l.a, oname: l.oname, obank: l.obank, o: l.o }, s)));
  const seenS = new Set(), sameU = same.filter((s) => { const k = [s.m, s.ta, s.to].join("|") + [s.a, s.o].sort().join(); if (seenS.has(k)) return false; seenS.add(k); return true; });
  const com = LK.flatMap((l) => l.common.map((c) => Object.assign({ a: l.a, oname: l.oname, obank: l.obank }, c)));
  m.innerHTML = `<div class="hd"><h2>ความเชื่อมโยงบัญชี<details class="info"><summary title="วิธีตรวจ">i</summary><div class="info-box">ตรวจทุกบัญชีที่มีไฟล์ statement ในโฟลเดอร์คดี (${DB.accounts.length} บัญชี) เทียบกับบัญชีเป้าหมาย 3 บัญชี : (1) โอนตรงถึงกัน (2) ใช้ตู้เดียวกันภายใน 1 ชั่วโมง (3) มีคู่โอนรายเดียวกัน — ตัดบัญชีระบบ/ร้านค้า/ผู้ให้บริการชำระเงินที่พบในหลายบัญชีออก</div></details></h2></div>
  <div class="seg sec" id="lTabs">${[["l", `บัญชีที่เชื่อมโยง ${LK.length}`], ["s", `ตู้เดียวกัน ≤1 ชม. ${sameU.length}`], ["c", `คู่โอนร่วม ${com.length}`]].map(([k, l]) => `<button data-lt="${k}" class="${k === "l" ? "on" : ""}">${l}</button>`).join("")}</div>
  <div data-lk="l"><div id="tL"></div></div><div data-lk="s" hidden><div id="tS"></div></div><div data-lk="c" hidden><div id="tC"></div></div>`;
  $("#lTabs").addEventListener("click", (e) => { const b = e.target.closest("[data-lt]"); if (!b) return; $$("#lTabs button").forEach((x) => x.classList.toggle("on", x === b)); $$("[data-lk]", m).forEach((x) => (x.hidden = x.dataset.lk !== b.dataset.lt)); });
  table($("#tL"), { title: "บัญชีที่เชื่อมโยง", rows: () => LK, sort: "score", csvName: "บัญชีเชื่อมโยง",
    cols: [{ k: "a", lab: "บัญชีเป้าหมาย", f: (l) => acTag(l.a) }, { k: "oname", lab: "บัญชีที่เชื่อมโยง", f: (l) => `${av(l.oname)}${esc(l.oname)}<small class="accno">${bankIco(l.obank)}${esc(l.obank)} ${esc(l.o)}</small>`, v: (l) => `${l.oname}` }, { k: "obank", lab: "ธนาคาร/เลขที่", hide: 1, v: (l) => `${l.obank} ${l.o}` },
      { k: "direct", lab: "โอนตรง", n: 1, v: (l) => l.direct.n, f: (l) => l.direct.n ? `${l.direct.n} ครั้ง<small class="accno">เข้า ${M(l.direct.in)} · ออก ${M(l.direct.out)}</small>` : '<span class="muted">-</span>' },
      { k: "same", lab: "ตู้เดียวกัน ≤1 ชม.", n: 1, v: (l) => l.same.length, f: (l) => l.same.length ? `${l.same.length}${l.same.every((x) => x.gen) ? ' <small class="muted">(รหัสไม่ครบ)</small>' : ""}` : "0" }, { k: "common", lab: "คู่โอนร่วม", n: 1, v: (l) => l.common.length }, { k: "cmp", lab: "", f: (l) => cmpLink([accK(acOf(l.a).acc), l.o]), v: () => "" },
      { k: "score", lab: "คู่โอนร่วม (ตัวอย่าง)", sh: "คู่โอนร่วม", w: 1, f: (l) => esc(l.common.slice(0, 3).map((c) => c.name).join(", ")) + (l.common.length > 3 ? ` <small class="muted">+${l.common.length - 3}</small>` : ""), v: (l) => l.common.map((c) => c.name).join(", "), s: (l) => l.same.length * 10 + l.direct.n + l.common.length * 3 }] });
  table($("#tS"), { title: "ใช้รหัสตู้เดียวกันภายใน 1 ชั่วโมง", sub: "รหัสเฉพาะเครื่อง = ผู้ฝากชุดเดียวกันน่าจะฝากเข้าหลายบัญชี ; รหัสไม่ครบ = ต้องขอรหัสเครื่องเต็มจากธนาคารก่อนสรุป", rows: () => sameU, sort: "ta", desc: false, csvName: "ตู้เดียวกัน",
    cols: [{ k: "a", lab: "บัญชีเป้าหมาย", f: (x) => acTag(x.a) }, { k: "ta", lab: "เวลาฝากเข้าบัญชีเป้าหมาย", sh: "เวลาฝากเข้า", f: (x) => dtTh(x.ta), date: (x) => x.ta }, { k: "aamt", lab: "ยอด", n: 1, f: (x) => B(x.aamt) },
      { k: "m", lab: "ตู้", f: (x) => `${esc(x.mb)} ${mcode(x.m, x.gen)}`, v: (x) => `${x.mb} ${x.m}` }, { k: "gen", lab: "รหัสตู้", v: (x) => (x.gen ? "รหัสไม่ครบ" : "เฉพาะเครื่อง") }, { k: "oname", lab: "อีกบัญชี" }, { k: "to", lab: "เวลา (อีกบัญชี)", f: (x) => dtTh(x.to), date: (x) => x.to }, { k: "odir", lab: "รายการ" }, { k: "oamt", lab: "ยอด", n: 1, f: (x) => B(x.oamt) }, { k: "lag", lab: "ห่าง (นาที)", n: 1 }] });
  table($("#tC"), { title: "คู่โอนรายเดียวกัน", rows: () => com, sort: "a_in", csvName: "คู่โอนร่วม",
    cols: [{ k: "a", lab: "บัญชีเป้าหมาย", f: (x) => acTag(x.a) }, { k: "oname", lab: "อีกบัญชี" }, { k: "name", lab: "คู่โอนร่วม" }, { k: "acc", lab: "เลขบัญชีคู่โอน" },
      { k: "a_in", lab: "เข้าบัญชีเป้าหมาย", n: 1, f: (x) => B(x.a_in) }, { k: "a_out", lab: "ออกจากบัญชีเป้าหมาย", sh: "ออกจากเป้าหมาย", n: 1, f: (x) => B(x.a_out) }, { k: "o_in", lab: "เข้าอีกบัญชี", n: 1, f: (x) => B(x.o_in) }, { k: "o_out", lab: "ออกจากอีกบัญชี", n: 1, f: (x) => B(x.o_out) }] });
}

/* ================= รายการทั้งหมด ================= */
function pList(m) {
  const all = DB.acs.flatMap((a) => a.deps.map((d) => Object.assign({ ac: a.id }, d)));
  m.innerHTML = `<div id="tAll"></div>`;
  const f = { ac: "", k: "" };
  const t = table($("#tAll"), {
    title: "รายการฝาก/โอนเข้าผ่านตู้และสาขา ทั้ง 3 บัญชี", rows: () => all.filter((x) => (!f.ac || x.ac === f.ac) && (!f.k || x.k === f.k)), sort: "t", desc: false, max: 800, csvName: "รายการฝากทั้งหมด",
    extra: `<select class="tin" data-ac><option value="">ทุกบัญชี</option>${DB.acs.map((a) => `<option value="${a.id}">${a.no}. ${esc(a.short)}</option>`).join("")}</select>
      <select class="tin" data-k><option value="">ทุกประเภท</option>${["CASH_OTHER", "CASH_OWN", "COUNTER", "ATMX"].map((k) => `<option value="${k}">${KL[k]}</option>`).join("")}</select>`,
    cols: [{ k: "ac", lab: "บัญชี", f: (x) => acTag(x.ac) }, { k: "t", lab: "วันเวลา", f: (x) => dtTh(x.t), date: (x) => x.t }, { k: "k", lab: "ประเภท", f: (x) => kb(x.k), v: (x) => KL[x.k] }, { k: "amt", lab: "ยอด", n: 1, f: (x) => B(x.amt) },
      { k: "mb", lab: "ธนาคารตู้" }, { k: "m", lab: "รหัสตู้", f: (x) => (x.m ? mcode(x.m, x.gen) : x.mn ? '<small class="muted">ไม่ระบุเครื่อง</small>' : ""), v: (x) => (x.m ? x.m + (x.gen ? " (รหัสไม่ครบ)" : "") : x.mn ? "ไม่ระบุเครื่อง (โอนต่างธนาคาร)" : "") }, { k: "loc", lab: "สาขา (ที่ตั้ง)", w: 1, v: (x) => [x.site, x.loc ? `${x.loc.code} ${x.loc.name}${x.loc.prov ? " · " + x.loc.prov : ""}` : ""].filter(Boolean).join(" · ") },
      { k: "nm", lab: "ผู้โอน", v: (x) => (x.nm ? `${x.nm} ${x.fb} ${x.fa}` : x.fa || "") }, { k: "run", lab: "รอบ", n: 1, v: (x) => (x.run == null ? "" : x.run) }],
    total: (r) => `รวม ${B(r.reduce((s, x) => s + x.amt, 0))} บาท`,
  });
  $("[data-ac]", $("#tAll")).addEventListener("change", (e) => { f.ac = e.target.value; t.draw(); });
  $("[data-k]", $("#tAll")).addEventListener("change", (e) => { f.k = e.target.value; t.draw(); });
}

/* ================= สิ่งที่ต้องขอเพิ่ม ================= */
function pTodo(m) {
  const mc = DB.acs.flatMap((a) => a.machines.filter((x) => !x.loc && x.ncash > 0).map((x) => Object.assign({ ac: a.id }, x))).sort((a, b) => b.amt - a.amt);
  const brU = DB.acs.flatMap((a) => a.branches.filter((b) => !b.prov).map((b) => Object.assign({ ac: a.id, bank: a.bank }, b)));
  const runs = DB.acs.flatMap((a) => a.runs.map((r) => Object.assign({ ac: a.id }, r))).sort((a, b) => b.amt - a.amt).slice(0, 40);
  const ppl = DB.people.filter((p) => p.role !== "L3");
  const gm = new Map(); DB.acs.forEach((a) => a.machines.filter((x) => x.gen && x.m && !/^(TR ?fr|BATCH|0+)$/i.test(x.m)).forEach((x) => { const k = x.b + " " + x.m, o = gm.get(k) || { b: x.b, m: x.m, n: 0, amt: 0, acs: new Set(), first: x.first, last: x.last }; o.n += x.n; o.amt += x.amt; o.acs.add(a.id); if (x.first < o.first) o.first = x.first; if (x.last > o.last) o.last = x.last; gm.set(k, o); }));
  const gens = [...gm.values()].map((o) => Object.assign(o, { acs: [...o.acs] })).sort((a, b) => b.amt - a.amt);
  m.innerHTML = `<div class="hd"><h2>แผนงานขอข้อมูลเพิ่ม เพื่อยืนยันตัวผู้ร่วมขบวนการ</h2></div>
  <div class="find">
    ${fi(1, "ขอที่ตั้งตู้ + ภาพ CCTV จากธนาคารเจ้าของตู้", `ตู้ฝากเงินสดของธนาคารอื่นที่ไม่ทราบที่ตั้ง ${mc.length} ตู้ (ตารางด้านล่าง เรียงตามยอด) — ระบุรหัสตู้และช่วงเวลาตามรอบตะเวนฝาก เพื่อเห็นหน้าผู้ฝาก/รถที่ใช้`)}
    ${fi(2, "ยืนยันชื่อสาขาจากรหัสสาขา", `รหัสสาขาที่ยังไม่ทราบชื่อ/จังหวัด ${brU.length} รายการ (กรุงศรีฯ ทั้งหมด และกรุงไทยที่เปิดหลังปี 2556) — ขอรายการรหัสสาขาจากธนาคาร`)}
    ${fi(3, "ขอข้อมูลผู้ถือบัญชี/KYC ของผู้ควบคุมและผู้ประสาน", `${ppl.length} ราย (บทบาท L1-L2) — ภาพถ่ายเปิดบัญชี เบอร์โทร อุปกรณ์ที่ผูกแอป และ statement ของบัญชีเหล่านี้ เพื่อไล่ต่อว่าใครสั่งการ`)}
    ${fi(4, "ขอภาพเคาน์เตอร์/ใบถอนเงินที่สาขา", `จุดถอนเงินสดออกจากบัญชี${esc(acOf("kes").short)} (เคาน์เตอร์ ${esc((acOf("kes").cashout[0] || {}).name || "-")}) และการฝากที่เคาน์เตอร์ของ${esc(acOf("ykk").short)} — ผู้ทำรายการต้องแสดงตัวที่สาขา`)}
    ${fi(5, "ขอรหัสเครื่องเต็มของรหัสตู้กลุ่ม", `รหัสในไฟล์ธนาคารบางรูปแบบไม่ระบุเครื่อง (เช่น GSB T091B0 ปรากฏในรอบที่อยู่ 3 จังหวัด) ${gens.length} รหัส — ขอรหัสเครื่องเต็ม/ที่ตั้งตามวันเวลาจริงจากธนาคาร จึงจะยืนยัน "ตู้เดียวกัน" ได้ (ตารางสุดท้าย)`)}
  </div>
  <div id="tM"></div><div id="tR"></div><div id="tB"></div><div id="tG"></div>`;
  table($("#tM"), { title: "ตู้ที่ต้องขอที่ตั้ง/CCTV", rows: () => mc, sort: "amt", csvName: "ตู้ที่ต้องขอที่ตั้ง",
    cols: [{ k: "ac", lab: "บัญชี", f: (x) => acTag(x.ac) }, { k: "b", lab: "ธนาคารเจ้าของตู้", v: (x) => bankTh(x.b) }, { k: "m", lab: "รหัสตู้", f: (x) => (x.m ? mcode(x.m, x.gen) : x.mn ? '<small class="muted">ไม่ระบุเครื่อง</small>' : ""), v: (x) => (x.m ? x.m + (x.gen ? " (รหัสไม่ครบ)" : "") : x.mn ? "ไม่ระบุเครื่อง (โอนต่างธนาคาร)" : "") }, { k: "ncash", lab: "ฝากเงินสด (ครั้ง)", n: 1 }, { k: "amt", lab: "ยอด", n: 1, f: (x) => B(x.amt) },
      { k: "first", lab: "ช่วงวันที่", f: (x) => `${dTh(x.first)} – ${dTh(x.last)}`, range: (x) => [x.first, x.last] }, { k: "h0", lab: "ช่วงเวลา", v: (x) => `${String(x.h0).padStart(2, "0")}–${String(x.h1).padStart(2, "0")} น.` }, { k: "area", lab: "พื้นที่", n: 1, v: (x) => x.area || "" }] });
  table($("#tR"), { title: "ช่วงเวลาที่ควรขอ CCTV (40 รอบยอดสูงสุด)", rows: () => runs, sort: "amt", csvName: "ช่วงเวลาCCTV",
    cols: [{ k: "ac", lab: "บัญชี", f: (x) => acTag(x.ac) }, { k: "st", lab: "เริ่ม", f: (x) => dtTh(x.st), date: (x) => x.st }, { k: "en", lab: "ถึง", f: (x) => x.en.slice(11, 16), date: (x) => x.en }, { k: "n", lab: "ครั้ง", n: 1 }, { k: "amt", lab: "ยอด", n: 1, f: (x) => B(x.amt) },
      { k: "route", lab: "ตู้", w: 1, f: (x) => routeH(x.route), v: (x) => x.route.join(" > ") }, { k: "loc", lab: "จุดอ้างอิง", v: (x) => (x.loc ? x.loc.name : "") }] });
  table($("#tB"), { title: "รหัสสาขาที่ต้องยืนยันชื่อ/ที่ตั้ง", rows: () => brU, sort: "amt", csvName: "รหัสสาขารอยืนยัน",
    cols: [{ k: "ac", lab: "บัญชี", f: (x) => acTag(x.ac) }, { k: "bank", lab: "ธนาคาร" }, { k: "code", lab: "รหัสสาขา" }, { k: "name", lab: "ชื่อ (ถ้าพบ)", w: 1 }, { k: "n", lab: "ครั้ง", n: 1 }, { k: "amt", lab: "ยอด", n: 1, f: (x) => B(x.amt) }] });
  table($("#tG"), { title: "รหัสตู้กลุ่มที่ต้องขอรหัสเครื่องเต็ม", rows: () => gens, sort: "amt", csvName: "รหัสตู้กลุ่ม",
    cols: [{ k: "b", lab: "ธนาคาร", v: (x) => bankTh(x.b) }, { k: "m", lab: "รหัสในไฟล์", f: (x) => mcode(x.m, true), v: (x) => x.m }, { k: "acs", lab: "บัญชี", f: (x) => x.acs.map(acTag).join(" "), v: (x) => x.acs.map((i) => acOf(i).short).join(", ") },
      { k: "n", lab: "ครั้ง", n: 1 }, { k: "amt", lab: "ยอด", n: 1, f: (x) => B(x.amt) }, { k: "first", lab: "ช่วงวันที่", f: (x) => `${dTh(x.first)} – ${dTh(x.last)}`, range: (x) => [x.first, x.last] }] });
  m.insertAdjacentHTML("beforeend", `<p class="note">ที่มาชื่อสาขากรุงไทย: ${esc(DB.br_source)}</p>`);
}

/* ================= ค้นหา ================= */
function openSearch() { $("#search").hidden = false; $("#sq").value = ""; $("#sres").innerHTML = ""; setTimeout(() => $("#sq").focus(), 30); }
function doSearch() {
  const q = $("#sq").value.trim().toLowerCase(); const out = [];
  if (q.length >= 2) {
    DB.people.forEach((p) => { if (p.name.toLowerCase().includes(q) || p.accs.some((a) => a.acc.includes(q))) out.push(["net", `${IC("user", 16)} <b>${esc(p.name)}</b> · <span class="rl ${p.role}">${p.role}</span> · ${p.accs.map((a) => a.bank + " " + a.acc).join(", ")} · ${B(p.amt)}`]); });
    DB.acs.forEach((a) => {
      a.branches.forEach((b) => { if (b.code.includes(q) || b.name.toLowerCase().includes(q) || (b.prov || "").includes(q)) out.push([a.id, `${IC("bank", 16)} ${a.no}. ${esc(a.short)} · สาขา ${esc(b.code)} ${esc(b.name)} · ${b.n} ครั้ง ${B(b.amt)}`]); });
      a.machines.forEach((x) => { if (x.m.toLowerCase().includes(q)) out.push([a.id, `${IC("atm", 16)} ${a.no}. ${esc(a.short)} · ตู้ ${esc(x.b)} ${esc(x.m)} · ${x.n} ครั้ง ${B(x.amt)}`]); });
    });
    accIndex().forEach((x) => { if (x.name.toLowerCase().includes(q) || x.acc.includes(q)) out.push(["acc/" + x.k, `${IC("user", 16)} <b>${esc(x.name)}</b> · ${esc(x.bank)} ${esc(x.acc)} · เงินเข้า ${M(x.in)}${x.id ? " · บัญชีเป้าหมาย" : ""}`]); });
    DB.links.forEach((l) => { if (l.oname.toLowerCase().includes(q) || l.o.includes(q)) out.push(["link", `${IC("link", 16)} ${esc(l.oname)} ${esc(l.obank)} ${esc(l.o)} ↔ ${esc(acOf(l.a).short)}`]); });
  }
  $("#sres").innerHTML = out.slice(0, 80).map(([t, h]) => `<div class="srsite" data-t="${t}" style="cursor:pointer">${h}</div>`).join("") || (q.length >= 2 ? `<div class="empty">ไม่พบ</div>` : `<div class="empty">พิมพ์อย่างน้อย 2 ตัวอักษร</div>`);
  $$("#sres [data-t]").forEach((e) => e.addEventListener("click", () => { $("#search").hidden = true; go(e.dataset.t); }));
}
