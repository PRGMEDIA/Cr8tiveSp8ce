/* ============================================================
   Aura Studio — Application Engine
   Gallery, editor, exporters, storage. No external dependencies.
   ============================================================ */
"use strict";

const APP_VERSION = "3.1.1";
const LS = {
  autosave: "aura.autosave",
  customTpl: "aura.templates.custom",
  seenVersion: "aura.seenVersion",
  brand: "aura.brand",
};
const IMG_FILTERS = [
  { n:"None", v:"none" },
  { n:"Grayscale", v:"grayscale(1)" },
  { n:"Sepia / vintage", v:"sepia(0.7) saturate(1.2)" },
  { n:"B&W dramatic", v:"grayscale(1) contrast(1.4)" },
  { n:"Vivid", v:"saturate(1.7) contrast(1.1)" },
  { n:"Soft glow", v:"brightness(1.12) saturate(1.15)" },
  { n:"Cool tone", v:"hue-rotate(-15deg) saturate(1.25)" },
  { n:"Warm tone", v:"hue-rotate(12deg) saturate(1.2) brightness(1.05)" },
  { n:"Blur", v:"blur(2px)" },
  { n:"Invert", v:"invert(1)" },
];

/* ---------------- brand kit ---------------- */
function getBrand(){
  try { return JSON.parse(localStorage.getItem(mkey(LS.brand)) || "") || { colors:[], font:"", logo:"" }; }
  catch(e){ return { colors:[], font:"", logo:"" }; }
}
function setBrand(b){ localStorage.setItem(mkey(LS.brand), JSON.stringify(b)); }
const FONT_LIST = [
  "Georgia, 'Times New Roman', serif",
  "'Times New Roman', serif",
  "'Segoe UI', Arial, sans-serif",
  "Arial, sans-serif",
  "'Arial Black', Arial, sans-serif",
  "'Courier New', monospace",
  "'Comic Sans MS', 'Segoe UI', cursive",
  "'Trebuchet MS', sans-serif",
  "Verdana, sans-serif",
  "Impact, 'Arial Black', sans-serif",
  "'Brush Script MT', cursive",
  "'Palatino Linotype', 'Book Antiqua', serif",
];

/* ---------------- state ---------------- */
let project = null;
let curPage = 0, selId = null, zoom = 1, zoomMode = "fit";
let guidesOn = false;
let undoStack = [], redoStack = [];
let activeCat = "social";
let suppressHistory = false;

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const uid = () => "e" + Math.random().toString(36).slice(2, 9);
const clone = (o) => JSON.parse(JSON.stringify(o));
const esc = (s) => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const hex2rgba = (hex, a) => {
  const h = hex.replace("#",""); const f = h.length===3 ? h.split("").map(c=>c+c).join("") : h;
  const n = parseInt(f||"000000",16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a==null?1:a})`;
};

/* ---------------- CMYK color engine ----------------
   The screen renders RGB; CMYK values are stored with each element
   (el.cmyk / page.cmyk) and exported as print-reference metadata. */
function hexToRgb(hex){
  const h = String(hex||"#000000").replace("#","");
  const f = h.length===3 ? h.split("").map(c=>c+c).join("") : (h || "000000").slice(0,6).padEnd(6,"0");
  const n = parseInt(f,16);
  return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
}
function rgbToHex(r,g,b){
  const c = (x)=>Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,"0");
  return "#"+c(r)+c(g)+c(b);
}
function cmykToRgb(c,m,y,k){
  const C=c/100, M=m/100, Y=y/100, K=k/100;
  return { r:255*(1-C)*(1-K), g:255*(1-M)*(1-K), b:255*(1-Y)*(1-K) };
}
function cmykToHex(c,m,y,k){ const {r,g,b} = cmykToRgb(c,m,y,k); return rgbToHex(r,g,b); }
function rgbToCmyk(hex){
  const {r,g,b} = hexToRgb(hex);
  const R=r/255, G=g/255, B=b/255;
  const K = 1 - Math.max(R,G,B);
  if (K >= 0.999) return { c:0, m:0, y:0, k:100 };
  return {
    c: Math.round(((1-R-K)/(1-K))*100),
    m: Math.round(((1-G-K)/(1-K))*100),
    y: Math.round(((1-B-K)/(1-K))*100),
    k: Math.round(K*100),
  };
}
const CMYK_PRESETS = [
  { n:"Process Cyan",     cmyk:[100,  0,  0,  0] },
  { n:"Process Magenta",  cmyk:[  0,100,  0,  0] },
  { n:"Process Yellow",   cmyk:[  0,  0,100,  0] },
  { n:"Process Black",    cmyk:[  0,  0,  0,100] },
  { n:"Rich Black",       cmyk:[ 60, 40, 40, 90] },
  { n:"Red (M+Y)",        cmyk:[  0,100,100,  0] },
  { n:"Green (C+Y)",      cmyk:[100,  0,100,  0] },
  { n:"Blue (C+M)",       cmyk:[100,100,  0,  0] },
  { n:"Orange",           cmyk:[  0, 60,100,  0] },
  { n:"Violet",           cmyk:[ 40,100,  0, 20] },
  { n:"Warm Gray 40%",    cmyk:[  0,  5, 10, 40] },
  { n:"Cool Gray 60%",    cmyk:[ 20, 10,  0, 60] },
];
function cmykLabel(v){ return `C${v.c} M${v.m} Y${v.y} K${v.k}`; }

/* Solid-ink reference swatch book (name, C, M, Y, K) */
const CMYK_PALETTE = [
  ["Process Cyan",100,0,0,0],["Process Magenta",0,100,0,0],["Process Yellow",0,0,100,0],
  ["Process Black",0,0,0,100],["Rich Black",60,40,40,90],["Registration",100,100,100,100],
  ["Scarlet",0,95,85,0],["Crimson",0,100,60,10],["Cherry",5,100,80,5],["Ruby",10,95,85,15],
  ["Wine",20,100,60,30],["Brick",10,85,90,20],["Tangerine",0,70,95,0],["Pumpkin",5,75,100,10],
  ["Amber",5,45,95,10],["Rust",20,80,95,20],["Coral",0,55,60,0],["Lemon",8,5,100,0],
  ["Gold",15,35,95,10],["Mustard",10,30,95,25],["Cream",6,8,30,0],["Kelly Green",90,10,85,5],
  ["Forest",80,30,90,25],["Emerald",85,15,80,10],["Sage",40,15,45,15],["Olive",45,25,95,25],
  ["Mint",45,0,35,5],["Teal",85,25,40,10],["Turquoise",70,5,30,5],["Aqua",55,0,25,5],
  ["Deep Sea",90,45,50,25],["Royal Blue",90,70,0,0],["Navy",100,80,20,35],["Sky Blue",45,15,0,0],
  ["Cobalt",85,50,0,10],["Denim",70,45,15,15],["Baby Blue",30,8,0,0],["Violet",45,85,0,0],
  ["Lavender",25,30,0,5],["Plum",40,85,20,25],["Grape",60,95,0,20],["Lilac",18,25,0,8],
  ["Hot Pink",0,85,25,0],["Rose",5,70,20,5],["Blush",5,25,15,2],["Fuchsia",15,100,10,5],
  ["Warm Gray 40%",0,5,10,40],["Cool Gray 60%",20,10,0,60],["Slate",45,30,25,25],
  ["Taupe",20,30,40,30],["Charcoal",30,25,25,80],["Bone",8,10,20,8],["Champagne",10,15,35,8],
  ["Skin - Light",12,22,25,3],["Skin - Medium",25,40,45,10],["Skin - Tan",30,50,60,20],
  ["Skin - Deep",45,65,70,30],["Skin - Rich",55,75,75,40],
].map(p=>({ n:p[0], c:p[1], m:p[2], y:p[3], k:p[4] }));
function cmykAttr(el){
  return el.cmyk ? ` data-cmyk="${el.cmyk.c} ${el.cmyk.m} ${el.cmyk.y} ${el.cmyk.k}"` : "";
}
function svgRot(el){
  return el.rot ? ` transform="rotate(${el.rot} ${el.x + el.w/2} ${el.y + el.h/2})"` : "";
}

function toast(msg, ms=2200){
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(()=>t.classList.remove("show"), ms);
}

/* ---------------- boot ---------------- */
window.addEventListener("DOMContentLoaded", () => {
  applyAppBranding();
  buildCategoryRail();
  renderGallery();
  bindTopbar();
  bindPalette();
  bindKeyboard();
  updateMemberChip();
  const store = getMembers();
  const session = currentUser();
  if (Object.keys(store.members).length && !session){
    showMemberGate(() => { renderGallery(); restoreAutosave(); });
  } else {
    restoreAutosave();
  }
  window.addEventListener("resize", applyZoom);
});

/* ============================================================
   MEMBERS — device-local member profiles (user ID + password).
   Passwords are salted and SHA-256 hashed via WebCrypto; plaintext
   is never stored. Storage is namespaced per member so designs,
   brand kits and custom templates stay separate. Server-backed
   cloud accounts are a Phase II deliverable (Oracle backend).
   ============================================================ */
const MEMBERS_LS = "aura.members";
const SESSION_LS = "aura.currentMember";
function getMembers(){
  try { return JSON.parse(localStorage.getItem(MEMBERS_LS) || "") || { members:{} }; }
  catch(e){ return { members:{} }; }
}
function setMembers(m){ localStorage.setItem(MEMBERS_LS, JSON.stringify(m)); }
function currentUser(){
  try { return JSON.parse(localStorage.getItem(SESSION_LS) || "null"); } catch(e){ return null; }
}
function mkey(base){
  const u = currentUser();
  return u ? `aura.m.${u}.${base}` : base;
}
async function hashPassword(salt, pw){
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ":" + pw));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  } catch(e){
    let h = 0x811c9dc5; const s = salt + ":" + pw;   // FNV-1a fallback
    for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return "fnv:" + h.toString(16);
  }
}
function updateMemberChip(){
  const chip = $("#memberChip");
  if (chip) chip.textContent = currentUser() ? "\uD83D\uDC64 " + currentUser() : "\uD83D\uDC64 Guest";
}
function showMemberGate(after){
  const store = getMembers();
  const names = Object.keys(store.members);
  showModal(`<h3>\uD83D\uDC65 Member sign-in</h3>
    <p>Member profiles keep designs, brand kits and templates separate on this device \u2014 like a phone lock screen. (Cloud-synced member accounts arrive with the Phase II server.)</p>
    ${names.map(n => `<button class="prop-btn" data-member="${esc(n)}">\uD83D\uDC64 ${esc(n)}</button>`).join("")}
    <div class="m-row"><input id="mUser" placeholder="member ID" autocomplete="off" spellcheck="false"></div>
    <div class="m-row"><input id="mPass" type="password" placeholder="password"></div>
    <div class="m-actions" style="flex-wrap:wrap">
      <button class="abtn ghost" id="mNew" style="margin-right:auto">\u2795 Create member</button>
      <button class="abtn ghost" id="mGuest">Continue as guest</button>
      <button class="abtn ghost" id="mForgot">\uD83D\uDD11 Forgot password?</button>
      <button class="abtn primary" id="mIn">Sign in</button></div>`);
  $$("#modalCard [data-member]").forEach(b => b.onclick = () => { $("#mUser").value = b.dataset.member; $("#mPass").focus(); });
  const done = (u) => { localStorage.setItem(SESSION_LS, JSON.stringify(u)); closeModal(); updateMemberChip(); if (after) after(); };
  $("#mGuest").onclick = () => { localStorage.removeItem(SESSION_LS); closeModal(); updateMemberChip(); if (after) after(); };
  // defect fix: always read the FRESH registry (a stale snapshot rejected
  // members created after the modal opened)
  const signIn = async () => {
    const u = ($("#mUser").value || "").trim(), pw = $("#mPass").value || "";
    const rec = getMembers().members[u];
    if (!rec){ toast("Unknown member ID \u2014 create one first"); return; }
    const h = await hashPassword(rec.salt, pw);
    if (h !== rec.hash){ toast("Wrong password"); return; }
    done(actual);
    if (!rec.ipAcknowledged) showIpAcknowledgment(actual, after);
  };
  $("#mIn").onclick = signIn;
  ["mUser", "mPass"].forEach(id => $("#" + id).addEventListener("keydown", (e) => { if (e.key === "Enter") signIn(); }));
  $("#mForgot").onclick = showRecoveryModal;
  $("#mNew").onclick = async () => {
    const u = ($("#mUser").value || "").trim(), pw = $("#mPass").value || "";
    if (!/^\S{2,24}$/.test(u)){ toast("Member ID: 2\u201324 characters, no spaces \u2014 special characters allowed"); return; }
    if (pw.length < 4){ toast("Password: at least 4 characters"); return; }
    const st = getMembers();
    if (st.members[u]){ toast("That member ID already exists"); return; }
    const salt = uid() + uid();
    // the first member created on a device becomes the superuser (admin role)
    st.members[u] = { salt, hash: await hashPassword(salt, pw), created: Date.now(), super: Object.keys(st.members).length === 0 };
    // password recovery code (shown ONCE, stored hashed) — Phase III item I-021
    const rc = genRecoveryCode();
    st.members[u].recovery = { hash: await hashPassword("rc:" + u, normCode(rc)), created: Date.now() };
    setMembers(st);
    toast(`Member \u201c${u}\u201d created \u2014 signed in`);
    done(u);
    showRecoveryCodeModal(u, rc);
  };
  $$("#modalCard [data-close]").forEach(x => x.onclick = closeModal);
}
/* ---- password recovery (Phase III item I-021) ----
   Device-local workflow: a recovery code is issued at member creation
   (shown once, stored hashed). Redeeming it sets a new password and
   rotates the code. Email-based reset arrives with the cloud tier. */
function genRecoveryCode(){
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  try {
    const a = new Uint8Array(8);
    crypto.getRandomValues(a);
    for (let i = 0; i < 8; i++) out += chars[a[i] % chars.length];
  } catch(e){
    for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out.slice(0, 4) + "-" + out.slice(4);
}
function normCode(c){ return String(c || "").replace(/[\s-]/g, "").toUpperCase(); }
function showRecoveryCodeModal(u, code){
  showModal(`<h3>\uD83D\uDD11 Recovery code for ${esc(u)}</h3>
    <p><b>Write this down or copy it now.</b> It is shown <b>only this once</b> and is required to reset your password if you forget it.</p>
    <div style="text-align:center;font-family:'Courier New',monospace;font-size:26px;font-weight:800;letter-spacing:2px;background:var(--bg2);border:1px solid var(--line);border-radius:10px;padding:14px;margin:10px 0">${esc(code)}</div>
    <div class="m-actions"><button class="abtn primary" data-close style="margin-left:auto">I've saved it</button></div>`);
  $$("#modalCard [data-close]").forEach(x => x.onclick = closeModal);
}
function showRecoveryModal(){
  const names = Object.keys(getMembers().members);
  if (!names.length){ toast("No members exist on this device"); return; }
  showModal(`<h3>\uD83D\uDD11 Password recovery</h3>
    <p>Enter your member ID and your recovery code, then choose a new password.</p>
    <div class="m-row"><span style="font-size:12px;color:var(--ink-dim);width:110px;flex-shrink:0">Member ID</span>
      <input id="rcUser" autocomplete="off" spellcheck="false"></div>
    <div class="m-row"><span style="font-size:12px;color:var(--ink-dim);width:110px;flex-shrink:0">Recovery code</span>
      <input id="rcCode" placeholder="XXXX-XXXX" autocomplete="off" spellcheck="false"></div>
    <div class="m-row"><span style="font-size:12px;color:var(--ink-dim);width:110px;flex-shrink:0">New password</span>
      <input id="rcNew" type="password"></div>
    <div class="m-row"><span style="font-size:12px;color:var(--ink-dim);width:110px;flex-shrink:0">Repeat</span>
      <input id="rcNew2" type="password"></div>
    <div class="m-actions"><button class="abtn ghost" data-close style="margin-right:auto">Back</button>
      <button class="abtn primary" id="rcGo">Set new password</button></div>`);
  $("#rcGo").onclick = async () => {
    const u = ($("#rcUser").value || "").trim();
    const st = getMembers();
    const rec = st.members[u];
    if (!rec){ toast("Unknown member ID"); return; }
    if (!rec.recovery || !rec.recovery.hash){ toast("No recovery code on file \u2014 ask the superuser to issue one"); return; }
    const h = await hashPassword("rc:" + u, normCode($("#rcCode").value));
    if (h !== rec.recovery.hash){ toast("Invalid recovery code"); return; }
    const np = $("#rcNew").value || "", np2 = $("#rcNew2").value || "";
    if (np.length < 4 || np !== np2){ toast("New passwords must match (min 4 characters)"); return; }
    const salt = uid() + uid();
    rec.salt = salt;
    rec.hash = await hashPassword(salt, np);
    const nc = genRecoveryCode();
    rec.recovery = { hash: await hashPassword("rc:" + u, normCode(nc)), created: Date.now() };
    setMembers(st);
    localStorage.setItem(SESSION_LS, JSON.stringify(u));
    updateMemberChip(); closeModal();
    toast("Password updated \u2014 signed in");
    showRecoveryCodeModal(u, nc);
  };
  $$("#modalCard [data-close]").forEach(x => x.onclick = closeModal);
}

function isSuperuser(){
  const u = currentUser();
  const st = getMembers();
  return !!(u && st.members[u] && st.members[u].super);
}
function showMemberMenu(){
  const u = currentUser();
  if (!u){ showMemberGate(() => { renderGallery(); restoreAutosave(); }); return; }
  const su = isSuperuser();
  showModal(`<h3>\uD83D\uDC65 Members</h3>
    <p>Signed in as <b>${esc(u)}</b>${su ? " <span class=\"tag-ok\">\uD83D\uDEE1 superuser</span>" : ""}. Designs, brand kit and templates in use belong to this member profile.</p>
    <div class="m-actions" style="flex-wrap:wrap">
      <button class="abtn ghost" id="mmAdd" style="margin-right:auto">\u2795 Add member</button>
      ${su ? `<button class="abtn ghost" id="mmAdmin">\uD83D\uDEE1 Superuser admin</button>` : ""}
      <button class="abtn ghost" id="mmDel">\uD83D\uDD1B Delete this member</button>
      <button class="abtn primary" id="mmOut">Sign out</button></div>`);
  if (su) $("#mmAdmin").onclick = ()=>{ closeModal(); openAdminOverlay(); };
  $("#mmOut").onclick = ()=>{ localStorage.removeItem(SESSION_LS); location.reload(); };
  $("#mmAdd").onclick = ()=>{ closeModal(); showMemberGate(() => { renderGallery(); restoreAutosave(); }); };
  $("#mmDel").onclick = ()=>{
    if (!confirm(`Delete member \u201c${u}\u201d and their local data? This cannot be undone.`)) return;
    const st = getMembers(); delete st.members[u]; setMembers(st);
    Object.keys(localStorage).filter(k => k.startsWith(`aura.m.${u}.`)).forEach(k => localStorage.removeItem(k));
    localStorage.removeItem(SESSION_LS); location.reload();
  };
  $$("#modalCard [data-close]").forEach(x => x.onclick = closeModal);
}

function restoreAutosave(){
  try {
    const raw = localStorage.getItem(mkey(LS.autosave));
    if (!raw) return;
    const p = JSON.parse(raw);
    if (p && p.pages && p.pages.length){
      project = hydrate(p);
      openEditor();
      toast("Restored your last working design");
    }
  } catch(e){ /* ignore */ }
}

function hydrate(p){
  if (!p.id) p.id = uid();
  p.pages.forEach(pg => pg.elements.forEach(el => {
    if(!el.id) el.id = uid();
    // legacy normalization: glyph elements once stored their character only in .ch
    if (el.type === "glyph" && el.text == null && el.ch != null) el.text = el.ch;
  }));
  return p;
}

/* ---------------- all templates (builtin + custom) ---------------- */
function allTemplates(){
  let custom = [];
  try { custom = JSON.parse(localStorage.getItem(mkey(LS.customTpl)) || "[]"); } catch(e){}
  return [...custom, ...TEMPLATES];
}

/* ================= GALLERY ================= */
function buildCategoryRail(){
  const list = $("#catList");
  list.innerHTML = "";
  const mk = (id, icon, label) => {
    const b = document.createElement("button");
    b.className = "cat-item" + (id===activeCat ? " active":"");
    b.innerHTML = `<span class="em">${icon}</span> ${label}`;
    b.onclick = () => { activeCat = id; buildCategoryRail(); renderGallery(); };
    list.appendChild(b);
  };
  CATS.forEach(c => mk(c.id, c.icon, c.name));
  const hr = document.createElement("div");
  hr.className = "pal-sep"; list.appendChild(hr);
  mk("all", "🗂", "All templates");
}

function renderGallery(){
  const wrap = $("#gallerySections");
  wrap.innerHTML = "";
  const tpl = allTemplates();
  const cats = activeCat === "all" ? CATS : CATS.filter(c=>c.id===activeCat);
  for (const cat of cats){
    const items = tpl.filter(t=>t.cat===cat.id);
    if (!items.length) continue;
    const sec = document.createElement("div");
    sec.className = "gal-section";
    sec.innerHTML = `<h2>${cat.icon} ${cat.name}</h2><div class="sub">${items.length} template${items.length>1?"s":""}</div>`;
    const grid = document.createElement("div");
    grid.className = "tpl-grid";
    items.forEach(t => grid.appendChild(makeTplCard(t)));
    sec.appendChild(grid);
    wrap.appendChild(sec);
  }
}

function makeTplCard(t){
  const card = document.createElement("div");
  card.className = "tpl-card";
  const thumb = document.createElement("div");
  thumb.className = "tpl-thumb";
  const ar = t.w / t.h;
  let tw = 168, th = 126;
  if (ar < tw/th){ tw = th * ar; } else { th = tw / ar; }
  const mini = renderMini(t.pages[0], t.w, t.h, tw / t.w);
  mini.classList.add("mini");
  mini.style.width = t.w + "px"; mini.style.height = t.h + "px";
  thumb.appendChild(mini);
  const info = document.createElement("div");
  info.className = "tpl-info";
  info.innerHTML = `<div class="t">${esc(t.name)}</div><div class="d">${t.w}×${t.h} · ${t.pages.length} page${t.pages.length>1?"s":""}</div>`;
  if (t.cat === "docs"){
    const b = document.createElement("div"); b.className = "badge"; b.textContent = "LibreOffice";
    thumb.appendChild(b);
  }
  if (t.custom === true){
    const b = document.createElement("div"); b.className = "badge"; b.textContent = "Custom"; b.style.color="#9be2b0";
    thumb.appendChild(b);
  }
  card.appendChild(thumb); card.appendChild(info);
  card.onclick = () => useTemplate(t);
  return card;
}

function useTemplate(t){
  project = hydrate(clone({ name:t.name, cat:t.cat, w:t.w, h:t.h, pages:t.pages }));
  project.name = t.name;
  curPage = 0; selId = null; undoStack = []; redoStack = [];
  openEditor();
  toast(`Opened “${t.name}”`);
}

function doSearch(){
  const q = $("#searchBox").value.trim().toLowerCase();
  const res = $("#searchResults"), secs = $("#gallerySections");
  if (!q){ res.style.display="none"; secs.style.display=""; return; }
  secs.style.display = "none"; res.style.display = "";
  const matches = allTemplates().filter(t =>
    (t.name+" "+t.desc+" "+t.tags+" "+(CATS.find(c=>c.id===t.cat)||{}).name).toLowerCase().includes(q));
  res.innerHTML = "";
  if (!matches.length){ res.innerHTML = `<div class="gal-section"><p class="sub">No templates match “${esc(q)}”. Try “poster”, “resume”, “instagram”…</p></div>`; return; }
  const grid = document.createElement("div"); grid.className = "tpl-grid";
  matches.forEach(t => grid.appendChild(makeTplCard(t)));
  res.appendChild(grid);
}

/* ================= MINI RENDERER (thumbs) ================= */
function renderMini(page, w, h, scale){
  const d = document.createElement("div");
  d.style.cssText = `position:relative;width:${w}px;height:${h}px;background:${page.bg||"#fff"};overflow:hidden;transform:scale(${scale});transform-origin:top left;`;
  (page.elements||[]).forEach(el => d.appendChild(buildElNode(el, false)));
  const box = document.createElement("div");
  box.style.cssText = `width:${w*scale}px;height:${h*scale}px;overflow:hidden;`;
  box.appendChild(d);
  return box;
}

/* ================= EDITOR ================= */
function openEditor(){
  $("#galleryView").style.display = "none";
  $("#editorView").style.display = "flex";
  $("#editorBar").style.display = "flex";
  $("#projName").value = project.name || "Untitled design";
  renderBoard(); renderPages(); renderProps();
}

function openGallery(){
  $("#galleryView").style.display = "flex";
  $("#editorView").style.display = "none";
  $("#editorBar").style.display = "none";
  saveAutosave();
}

function curPageData(){ return project.pages[curPage]; }
function selElement(){ return curPageData().elements.find(e=>e.id===selId) || null; }

function renderBoard(){
  const board = $("#board");
  board.innerHTML = "";
  board.style.width = project.w + "px";
  board.style.height = project.h + "px";
  board.style.background = curPageData().bg || "#fff";
  curPageData().elements.forEach(el => board.appendChild(buildElNode(el, true)));
  drawGuides();
  renderWatermarkOverlay();
  applyZoom();
}

function buildElNode(el, interactive){
  const d = document.createElement("div");
  d.className = "el" + (interactive ? "" : " static");
  d.style.left = el.x+"px"; d.style.top = el.y+"px";
  d.style.width = el.w+"px"; d.style.height = el.h+"px";
  d.style.opacity = el.opacity != null ? el.opacity : 1;
  d.style.transform = "rotate(" + (el.rot || 0) + "deg)";
  if (interactive){
    d.dataset.id = el.id;
    if (el.id === selId) d.classList.add("sel");
    d.addEventListener("mousedown", (e) => startDrag(e, el, d));
    d.addEventListener("dblclick", () => { if (el.type==="text"||el.type==="glyph") startTextEdit(el, d); });
  }
  fillNode(d, el);
  return d;
}

function fillNode(d, el){
  d.innerHTML = "";
  if (el.type === "text" || el.type === "glyph"){
    const t = document.createElement("div");
    t.className = "el-text";
    t.style.cssText = `font-family:${el.fontFamily||"Arial"};font-size:${el.fontSize||24}px;`+
      `font-weight:${el.fontWeight||400};font-style:${el.italic?"italic":"normal"};color:${el.color||"#111"};`+
      `text-align:${el.align||"left"};line-height:${el.lineHeight||1.25};letter-spacing:${el.letterSpacing||"0px"};`+
      `text-transform:${el.uppercase?"uppercase":"none"};white-space:pre-wrap;word-break:break-word;`;
    t.textContent = el.text || "";
    d.appendChild(t);
  } else if (el.type === "rect"){
    d.style.background = (el.fill && el.fill !== "none") ? el.fill : "transparent";
    d.style.borderRadius = (el.radius||0) + "px";
    if (el.stroke && el.stroke !== "none") d.style.border = `${el.strokeWidth||1}px solid ${el.stroke}`;
  } else if (el.type === "ellipse"){
    d.style.background = (el.fill && el.fill !== "none") ? el.fill : "transparent";
    d.style.borderRadius = "50%";
    if (el.stroke && el.stroke !== "none") d.style.border = `${el.strokeWidth||1}px solid ${el.stroke}`;
  } else if (el.type === "line"){
    const horiz = (el.y2a - el.y1) < 2;
    d.style.background = el.stroke || "#111";
    if (horiz){ d.style.top = (el.y + (el.h-el.strokeWidth)/2) + "px"; d.style.height = el.strokeWidth+"px"; d.style.left = el.x+"px"; d.style.width = el.w+"px"; }
    else { d.style.left = (el.x + (el.w-el.strokeWidth)/2) + "px"; d.style.width = el.strokeWidth+"px"; d.style.top = el.y+"px"; d.style.height = el.h+"px"; }
    d.style.borderRadius = el.strokeWidth+"px";
  } else if (el.type === "image"){
    const img = document.createElement("img");
    img.src = el.src; img.draggable = false;
    img.style.cssText = `width:100%;height:100%;object-fit:${el.fit||"cover"};display:block;`+
      `border-radius:${el.radius||0}px;pointer-events:none;filter:${el.filter||"none"};`;
    d.appendChild(img);
  }
}

/* ---------- zoom ---------- */
function applyZoom(){
  if (!project) return;
  const wrap = $("#boardWrap");
  if (zoomMode === "fit"){
    zoom = Math.min((wrap.clientWidth - 60) / project.w, (wrap.clientHeight - 40) / project.h, 1);
  } else zoom = parseFloat(zoomMode);
  const b = $("#board");
  b.style.transform = `scale(${zoom})`;
  b.style.marginBottom = (project.h * (zoom-1)) + "px";
  $("#zoomSel").value = zoomMode;
}

/* ---------- drag / resize ---------- */
function boardScale(){
  const r = $("#board").getBoundingClientRect();
  return r.width / $("#board").offsetWidth;
}

function startDrag(e, el, node){
  if (e.button !== 0) return;
  e.stopPropagation(); e.preventDefault();
  select(el.id);
  const scale = boardScale();
  const startX = e.clientX, startY = e.clientY;
  const ox = el.x, oy = el.y, ow = el.w, oh = el.h;
  let moved = false, histPushed = false;
  const move = (ev) => {
    const dx = (ev.clientX - startX)/scale, dy = (ev.clientY - startY)/scale;
    if (!moved && (Math.abs(dx)>2||Math.abs(dy)>2)){ moved = true; pushHistory(); histPushed = true; }
    if (!moved) return;
    let nx = ox + dx, ny = oy + dy;
    // snap
    const th = 7/scale;
    const snapTargets = [{v:0,ax:"x"},{v:project.w/2,ax:"xc"},{v:project.w,ax:"xr"}];
    [nx, ny] = applySnap(el, nx, ny, th);
    el.x = Math.round(nx); el.y = Math.round(ny);
    node.style.left = el.x+"px"; node.style.top = el.y+"px";
  };
  const up = () => {
    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", up);
    if (histPushed){ renderProps(); saveAutosave(); }
  };
  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", up);
  attachHandles(node, el, scale);
}

function applySnap(el, nx, ny, th){
  const others = curPageData().elements.filter(e=>e.id!==el.id);
  const linesX = [0, project.w/2, project.w];
  const linesY = [0, project.h/2, project.h];
  others.forEach(o=>{ linesX.push(o.x, o.x+o.w, o.x+o.w/2); linesY.push(o.y, o.y+o.h, o.y+o.h/2); });
  const cx = nx + el.w/2, cy = ny + el.h/2;
  for (const L of linesX){
    if (Math.abs(nx - L) < th) { nx = L; break; }
    if (Math.abs(nx + el.w - L) < th) { nx = L - el.w; break; }
    if (Math.abs(cx - L) < th) { nx = L - el.w/2; break; }
  }
  for (const L of linesY){
    if (Math.abs(ny - L) < th) { ny = L; break; }
    if (Math.abs(ny + el.h - L) < th) { ny = L - el.h; break; }
    if (Math.abs(cy - L) < th) { ny = L - el.h/2; break; }
  }
  return [nx, ny];
}

function attachHandles(node, el, scale){
  $$(".handle").forEach(h=>h.remove());
  const addRotate = () => {
    const rh = document.createElement("div");
    rh.className = "handle rot";
    rh.title = "Rotate (hold Shift to snap 15\u00b0)";
    node.appendChild(rh);
    rh.addEventListener("mousedown", (e) => {
      e.stopPropagation(); e.preventDefault();
      const sc2 = boardScale();
      const br = $("#board").getBoundingClientRect();
      const cx = el.x + el.w/2, cy = el.y + el.h/2;
      const ang0 = Math.atan2((e.clientY - br.top)/sc2 - cy, (e.clientX - br.left)/sc2 - cx) * 180/Math.PI;
      const rot0 = el.rot || 0;
      pushHistory();
      const mv = (ev) => {
        const a = Math.atan2((ev.clientY - br.top)/sc2 - cy, (ev.clientX - br.left)/sc2 - cx) * 180/Math.PI;
        let rot = rot0 + (a - ang0);
        if (ev.shiftKey) rot = Math.round(rot/15)*15;
        el.rot = Math.round(((rot % 360) + 360) % 360);
        node.style.transform = "rotate(" + el.rot + "deg)";
      };
      const up = () => { document.removeEventListener("mousemove", mv); document.removeEventListener("mouseup", up); renderProps(); saveAutosave(); };
      document.addEventListener("mousemove", mv);
      document.addEventListener("mouseup", up);
    });
  };
  if (el.type === "line"){ addRotate(); return; }
  ["nw","ne","sw","se"].forEach(pos=>{
    const h = document.createElement("div");
    h.className = "handle " + pos;
    node.appendChild(h);
    h.addEventListener("mousedown", (e)=>{
      e.stopPropagation(); e.preventDefault();
      pushHistory();
      const sx = e.clientX, sy = e.clientY;
      const ox = el.x, oy = el.y, ow = el.w, oh = el.h;
      const move = (ev)=>{
        let dx = (ev.clientX - sx)/scale, dy = (ev.clientY - sy)/scale;
        if (pos.includes("e")) el.w = Math.max(16, Math.round(ow + dx));
        if (pos.includes("s")) el.h = Math.max(16, Math.round(oh + dy));
        if (pos.includes("w")){ el.w = Math.max(16, Math.round(ow - dx)); el.x = Math.round(ox + dx); }
        if (pos.includes("n")){ el.h = Math.max(16, Math.round(oh - dy)); el.y = Math.round(oy + dy); }
        node.style.left = el.x+"px"; node.style.top = el.y+"px";
        node.style.width = el.w+"px"; node.style.height = el.h+"px";
      };
      const up = ()=>{ document.removeEventListener("mousemove",move); document.removeEventListener("mouseup",up); renderProps(); saveAutosave(); };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });
  });
  addRotate();
}

/* ---------- text editing ---------- */
function startTextEdit(el, node){
  pushHistory();
  const board = $("#board");
  const ta = document.createElement("textarea");
  ta.id = "el-textarea";
  ta.value = el.text != null ? el.text : (el.ch || "");
  ta.style.left = el.x+"px"; ta.style.top = el.y+"px";
  ta.style.width = el.w+"px"; ta.style.height = Math.max(el.h, el.fontSize*1.6)+"px";
  ta.style.cssText += `font-family:${el.fontFamily};font-size:${el.fontSize}px;font-weight:${el.fontWeight};
    font-style:${el.italic?"italic":"normal"};color:${el.color};text-align:${el.align};line-height:${el.lineHeight};
    letter-spacing:${el.letterSpacing||"0px"};text-transform:${el.uppercase?"uppercase":"none"};`;
  board.appendChild(ta);
  ta.style.display = "block";
  node.style.opacity = "0.15";
  ta.focus(); ta.select();
  const commit = (save) => {
    if (save) el.text = ta.value;
    ta.remove(); node.style.opacity = el.opacity != null ? el.opacity : 1;
    fillNode(node, el); renderProps(); saveAutosave();
  };
  ta.addEventListener("blur", ()=>commit(true));
  ta.addEventListener("keydown", (e)=>{
    if (e.key==="Escape"){ e.preventDefault(); ta.blur(); }
    if (e.key==="Enter" && (e.ctrlKey||e.metaKey)){ e.preventDefault(); ta.blur(); }
    e.stopPropagation();
  });
}

/* ---------- selection / props ---------- */
function select(id){
  selId = id;
  $$("#board .el").forEach(n=>{
    const on = n.dataset.id === id;
    n.classList.toggle("sel", on);
    $$(".handle").forEach(h=>{ if (h.parentElement!==n || !on) h.remove(); });
    if (on) attachHandles(n, curPageData().elements.find(e=>e.id===id), boardScale());
  });
  renderProps();
}

$("#board") && null; // noop guard

document.addEventListener("mousedown", (e)=>{
  if (e.target.id === "board" || e.target.id === "boardWrap") select(null);
});

function renderProps(){
  const el = selElement();
  const body = $("#propsBody");
  $("#propsTitle").textContent = el ? (el.type==="image"?"Image":el.type==="text"?"Text":el.type.charAt(0).toUpperCase()+el.type.slice(1)) : "Properties";
  body.innerHTML = "";
  if (!el){
    const pg = curPageData();
    body.innerHTML = `<div class="prop-group"><div class="prop-label" style="width:auto;margin-bottom:6px">Page background</div></div>`;
    const row = document.createElement("div"); row.className="prop-row";
    row.innerHTML = `<input type="color" class="prop-input" value="${pg.bg && pg.bg[0]==="#" ? pg.bg : "#ffffff"}">`;
    row.querySelector("input").addEventListener("input", (e)=>{ pushHistory(); pg.bg = e.target.value; pg.cmyk = rgbToCmyk(pg.bg); renderBoard(); renderPages(); saveAutosave(); });
    body.appendChild(row);
    addSwatches(row, body, (c, cm)=>{ pushHistory(); pg.bg = c; pg.cmyk = cm ? {c:cm[0],m:cm[1],y:cm[2],k:cm[3]} : rgbToCmyk(c); renderBoard(); renderPages(); saveAutosave(); });
    addCmykRow(row, body, ()=> pg.cmyk || rgbToCmyk(pg.bg||"#ffffff"),
      (v)=>{ pushHistory(); pg.bg = cmykToHex(v.c,v.m,v.y,v.k); pg.cmyk = v; renderBoard(); renderPages(); saveAutosave(); });
    const note = document.createElement("div"); note.className = "prop-empty";
    note.textContent = "Select an element on the canvas to edit it, or add new elements from the left panel.";
    body.appendChild(note);
    return;
  }
  const grp = (title) => { const g=document.createElement("div"); g.className="prop-group"; if(title) g.innerHTML=`<div class="prop-label" style="width:auto;margin-bottom:6px">${title}</div>`; body.appendChild(g); return g; };
  const row = (g, label, inputHtml) => {
    const r = document.createElement("div"); r.className = "prop-row";
    r.innerHTML = `<span class="prop-label">${label}</span>` + inputHtml;
    g.appendChild(r); return r;
  };
  const bind = (r, sel, evt, fn) => { const n = r.querySelector(sel); if(n) n.addEventListener(evt, fn); return n; };

  // position & size
  const g1 = grp("Position & size");
  const num = (v)=>`<input type="number" class="prop-input" value="${Math.round(v)}">`;
  [["X", "x"],["Y","y"],["W","w"],["H","h"]].forEach(([lab,key])=>{
    const r = row(g1, lab, num(el[key]));
    bind(r, "input", "change", (e)=>{ pushHistory(); el[key] = Math.round(+e.target.value||0); refreshEl(el); });
  });
  const rr = row(g1, "Rotate", `<input type="number" min="0" max="360" step="1" class="prop-input" value="${el.rot||0}" title="0\u2013360 degrees">`);
  bind(rr, "input", "change", (e)=>{ pushHistory(); el.rot = ((+e.target.value||0) % 360 + 360) % 360; refreshEl(el); });
  const ga = row(g1, "Align", ["left","hcenter","right","top","vcenter","bottom"]
    .map(m=>`<button class="align-btn" data-al="${m}" title="Align ${m}">${{left:"\u2b05",hcenter:"\u2194",right:"\u27a1",top:"\u2b06",vcenter:"\u2195",bottom:"\u2b07"}[m]}</button>`).join(""));
  ga.querySelectorAll(".align-btn").forEach(btn=> btn.onclick = ()=> alignSel(el, btn.dataset.al));

  if (el.type==="text" || el.type==="glyph"){
    const g2 = grp("Typography");
    if (el.type==="text"){
      const r = row(g2, "Content", `<textarea class="prop-input" rows="3" style="resize:vertical">${esc(el.text||"")}</textarea>`);
      bind(r, "textarea", "change", (e)=>{ pushHistory(); el.text = e.target.value; refreshEl(el); });
    }
    const bFont = getBrand().font;
    const fontOpts = (bFont ? `<option value="${esc(bFont)}" ${el.fontFamily===bFont?"selected":""}>\u2605 ${bFont.split(",")[0].replace(/'/g,"")}</option>` : "")
      + FONT_LIST.map(f=>`<option value="${esc(f)}" ${el.fontFamily===f?"selected":""}>${f.split(",")[0].replace(/'/g,"")}</option>`).join("");
    const rf = row(g2, "Font", `<select class="prop-select">${fontOpts}</select>`);
    bind(rf, "select", "change", (e)=>{ pushHistory(); el.fontFamily = e.target.value; refreshEl(el); });
    const rs = row(g2, "Size", `<input type="number" class="prop-input" value="${el.fontSize||24}">`);
    bind(rs, "input", "change", (e)=>{ pushHistory(); el.fontSize = +e.target.value||24; refreshEl(el); });
    const rw = row(g2, "Weight", `<select class="prop-select">${[300,400,600,700,800,900].map(w=>`<option ${el.fontWeight==w?"selected":""} value="${w}">${w}</option>`).join("")}</select>`);
    bind(rw, "select", "change", (e)=>{ pushHistory(); el.fontWeight = e.target.value; refreshEl(el); });
    const rc = row(g2, "Color", `<input type="color" class="prop-input" value="${el.color && el.color[0]==="#" ? el.color.slice(0,7) : "#111111"}">`);
    bind(rc, "input", "input", (e)=>{ pushHistory(); el.color = e.target.value; el.cmyk = rgbToCmyk(el.color); refreshEl(el); });
    addSwatches(rc, g2, (c, cm)=>{ pushHistory(); el.color = c; el.cmyk = cm ? {c:cm[0],m:cm[1],y:cm[2],k:cm[3]} : rgbToCmyk(c); refreshEl(el); });
    addCmykRow(rc, g2, ()=> el.cmyk || rgbToCmyk(el.color||"#111111"),
      (v)=>{ pushHistory(); el.color = cmykToHex(v.c,v.m,v.y,v.k); el.cmyk = v; refreshEl(el); });
    const ra = row(g2, "Align", `<select class="prop-select">${["left","center","right"].map(a=>`<option ${el.align===a?"selected":""}>${a}</option>`).join("")}</select>`);
    bind(ra, "select", "change", (e)=>{ pushHistory(); el.align = e.target.value; refreshEl(el); });
    const rl = row(g2, "Line H", `<input type="number" step="0.05" class="prop-input" value="${el.lineHeight||1.25}">`);
    bind(rl, "input", "change", (e)=>{ pushHistory(); el.lineHeight = +e.target.value||1.25; refreshEl(el); });
    if (el.type==="text"){
      const ru = row(g2, "Caps", `<input type="checkbox" ${el.uppercase?"checked":""}>`);
      bind(ru, "input", "change", (e)=>{ pushHistory(); el.uppercase = e.target.checked; refreshEl(el); });
    }
  }

  if (el.type==="rect" || el.type==="ellipse"){
    const g3 = grp("Appearance");
    const rc = row(g3, "Fill", `<input type="color" class="prop-input" value="${(el.fill&&el.fill[0]==="#")?el.fill.slice(0,7):"#222222"}">`);
    bind(rc, "input", "input", (e)=>{ pushHistory(); el.fill = e.target.value; el.cmyk = rgbToCmyk(el.fill); refreshEl(el); });
    addSwatches(rc, g3, (c, cm)=>{ pushHistory(); el.fill = c; el.cmyk = cm ? {c:cm[0],m:cm[1],y:cm[2],k:cm[3]} : rgbToCmyk(c); refreshEl(el); });
    addCmykRow(rc, g3, ()=> el.cmyk || rgbToCmyk(el.fill||"#222222"),
      (v)=>{ pushHistory(); el.fill = cmykToHex(v.c,v.m,v.y,v.k); el.cmyk = v; refreshEl(el); });
    const rs = row(g3, "Stroke", `<input type="color" class="prop-input" value="${(el.stroke&&el.stroke[0]==="#")?el.stroke.slice(0,7):"#000000"}">`);
    bind(rs, "input", "input", (e)=>{ pushHistory(); el.stroke = e.target.value; el.cmyk = rgbToCmyk(el.stroke); refreshEl(el); });
    addSwatches(rs, g3, (c, cm)=>{ pushHistory(); el.stroke = c; el.cmyk = cm ? {c:cm[0],m:cm[1],y:cm[2],k:cm[3]} : rgbToCmyk(c); refreshEl(el); });
    addCmykRow(rs, g3, ()=> el.cmyk || rgbToCmyk(el.stroke||"#000000"),
      (v)=>{ pushHistory(); el.stroke = cmykToHex(v.c,v.m,v.y,v.k); el.cmyk = v; refreshEl(el); });
    const rsw = row(g3, "Stroke W", `<input type="number" class="prop-input" value="${el.strokeWidth||0}">`);
    bind(rsw, "input", "change", (e)=>{ pushHistory(); el.strokeWidth = +e.target.value||0; refreshEl(el); });
    if (el.type==="rect"){
      const rr = row(g3, "Radius", `<input type="number" class="prop-input" value="${el.radius||0}">`);
      bind(rr, "input", "change", (e)=>{ pushHistory(); el.radius = +e.target.value||0; refreshEl(el); });
    }
  }

  if (el.type==="image"){
    const g4 = grp("Image");
    const rb = row(g4, "", `<button class="prop-btn">🔄 Replace image…</button>`);
    bind(rb, "button", "click", ()=> pickImage(el));
    const rcut = row(g4, "", `<button class="prop-btn">\u2702 Crop image…</button>`);
    bind(rcut, "button", "click", ()=> showCropModal(el));
    const rf2 = row(g4, "Fit", `<select class="prop-select">${["cover","contain","fill"].map(f=>`<option ${el.fit===f?"selected":""}>${f}</option>`).join("")}</select>`);
    bind(rf2, "select", "change", (e)=>{ pushHistory(); el.fit = e.target.value; refreshEl(el); });
    const rflt = row(g4, "Filter", `<select class="prop-select">${IMG_FILTERS.map(f=>`<option value="${f.v}" ${(el.filter||"none")===f.v?"selected":""}>${f.n}</option>`).join("")}</select>`);
    bind(rflt, "select", "change", (e)=>{ pushHistory(); el.filter = e.target.value; refreshEl(el); });
    const rr = row(g4, "Radius", `<input type="number" class="prop-input" value="${el.radius||0}">`);
    bind(rr, "input", "change", (e)=>{ pushHistory(); el.radius = +e.target.value||0; refreshEl(el); });
  }

  const gL = grp("Link");
  const rlu = row(gL, "URL", `<input class="prop-input" value="${esc(el.link || "")}" placeholder="https://\u2026">`);
  bind(rlu, "input", "change", (e)=>{ pushHistory(); const v = e.target.value.trim(); if (v) el.link = v; else delete el.link; refreshEl(el); });
  const rlo = row(gL, "", `<button class="prop-btn">\u{1F517} Open link</button>`);
  bind(rlo, "button", "click", ()=>{ if (el.link) window.open(el.link, "_blank", "noopener"); else toast("No link set on this element"); });
  const g5 = grp("Layer");
  const g5r = row(g5, "Opacity", `<input type="range" min="0.05" max="1" step="0.05" class="prop-input" value="${el.opacity!=null?el.opacity:1}">`);
  bind(g5r, "input", "input", (e)=>{ el.opacity = +e.target.value; $("#board").querySelector(`[data-id="${el.id}"]`).style.opacity = el.opacity; saveAutosave(); });
  const b1 = document.createElement("button"); b1.className="prop-btn"; b1.textContent="⬆ Bring to front";
  b1.onclick = ()=>{ pushHistory(); reorder(el, "front"); };
  const b2 = document.createElement("button"); b2.className="prop-btn"; b2.textContent="⬇ Send to back";
  b2.onclick = ()=>{ pushHistory(); reorder(el, "back"); };
  const b3 = document.createElement("button"); b3.className="prop-btn"; b3.textContent="⧉ Duplicate";
  b3.onclick = ()=> duplicateSel();
  const b4 = document.createElement("button"); b4.className="prop-btn"; b4.textContent="🗑 Delete element";
  b4.onclick = ()=> deleteSel();
  body.appendChild(b1); body.appendChild(b2); body.appendChild(b3); body.appendChild(b4);
}

function refreshEl(el){
  const node = $(`#board [data-id="${el.id}"]`);
  if (node){ node.style.left=el.x+"px"; node.style.top=el.y+"px"; node.style.width=el.w+"px"; node.style.height=el.h+"px"; node.style.transform="rotate(" + (el.rot||0) + "deg)"; fillNode(node, el); }
  renderProps(); saveAutosave();
}

function reorder(el, dir){
  const arr = curPageData().elements;
  const i = arr.indexOf(el); if (i<0) return;
  arr.splice(i,1);
  if (dir==="front") arr.push(el); else arr.unshift(el);
  renderBoard(); select(el.id); saveAutosave();
}

/* ---------- pages ---------- */
function renderPages(){
  const strip = $("#pageStrip");
  strip.innerHTML = "";
  project.pages.forEach((pg, i)=>{
    const th = document.createElement("div");
    th.className = "page-thumb" + (i===curPage?" active":"");
    th.appendChild(renderMini(pg, project.w, project.h, 70/project.w));
    const n = document.createElement("span"); n.className="num"; n.textContent=(i+1); th.appendChild(n);
    if (project.pages.length>1){
      const del = document.createElement("span"); del.className="del"; del.textContent="×";
      del.onclick = (e)=>{ e.stopPropagation(); pushHistory(); project.pages.splice(i,1); if(curPage>=project.pages.length) curPage=project.pages.length-1; renderBoard(); renderPages(); renderProps(); saveAutosave(); };
      th.appendChild(del);
    }
    th.onclick = ()=>{ curPage=i; selId=null; renderBoard(); renderPages(); renderProps(); };
    strip.appendChild(th);
  });
  const dupBtn = document.createElement("button");
  dupBtn.className = "pstrip-btn"; dupBtn.textContent = "\u29C9"; dupBtn.title = "Duplicate current page (elements included)";
  dupBtn.onclick = duplicatePage;
  strip.appendChild(dupBtn);
  const add = document.createElement("button");
  add.className = "pstrip-btn"; add.textContent = "+"; add.title = "Add page";
  add.onclick = ()=>{
    pushHistory();
    project.pages.splice(curPage+1, 0, { bg:"#ffffff", elements:[] });
    curPage++; selId=null; renderBoard(); renderPages(); renderProps(); saveAutosave();
  };
  strip.appendChild(add);
}

/* ---------- element factory ---------- */
function addElement(type){
  pushHistory();
  const pg = curPageData();
  const cx = project.w/2, cy = project.h/2;
  let el;
  if (type==="text") el = {type:"text",x:cx-220,y:cy-40,w:440,h:80,text:"Double-click to edit",fontSize:36,fontFamily:FONT_LIST[0],fontWeight:"400",color:"#111",align:"center",lineHeight:1.25,letterSpacing:"0px",opacity:1};
  else if (type==="heading") el = {type:"text",x:cx-320,y:cy-60,w:640,h:100,text:"Your heading",fontSize:64,fontFamily:FONT_LIST[0],fontWeight:"700",color:"#111",align:"center",lineHeight:1.15,letterSpacing:"0px",opacity:1};
  else if (type==="subheading") el = {type:"text",x:cx-260,y:cy-30,w:520,h:60,text:"Subheading",fontSize:30,fontFamily:FONT_LIST[3],fontWeight:"600",color:"#333",align:"center",lineHeight:1.3,letterSpacing:"1px",opacity:1};
  else if (type==="body") el = {type:"text",x:cx-240,y:cy-70,w:480,h:140,text:"Body text — write your paragraph here.",fontSize:17,fontFamily:FONT_LIST[3],fontWeight:"400",color:"#444",align:"left",lineHeight:1.7,letterSpacing:"0px",opacity:1};
  else if (type==="rect") el = {type:"rect",x:cx-140,y:cy-90,w:280,h:180,fill:"#7c5cff",stroke:"none",strokeWidth:0,radius:0,opacity:1};
  else if (type==="ellipse") el = {type:"ellipse",x:cx-100,y:cy-100,w:200,h:200,fill:"#ff5c8a",stroke:"none",strokeWidth:0,opacity:1};
  else if (type==="line") el = {type:"line",x:cx-150,y:cy,w:300,h:4,x1:cx-150,y1:cy,x2a:cx+150,y2a:cy,stroke:"#111",strokeWidth:3,opacity:1};
  else if (type==="glyph") { pickGlyph((ch)=>{ if(!ch) return; pushHistory(); const g={type:"glyph",x:cx-60,y:cy-60,w:120,h:120,ch,fontSize:96,color:"#111",opacity:1}; g.id=uid(); pg.elements.push(g); select(g.id); renderBoard(); saveAutosave(); }); undoLast(); return; }
  else if (type==="image") { pickImage(null); undoLast(); return; }
  el.id = uid();
  pg.elements.push(el);
  select(el.id); renderBoard(); saveAutosave();
}
function undoLast(){ if (undoStack.length) undoStack.pop(); }

function pickImage(existing, forBrand){
  const inp = $("#fileImg");
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      if (forBrand){
        const b = getBrand(); b.logo = rd.result; setBrand(b);
        const prev = $("#bkLogoPrev"); if (prev) prev.innerHTML = `<img src="${rd.result}" style="height:36px;border-radius:6px">`;
        const place = $("#bkPlace"); if (place){ place.disabled = false; place.onclick = placeBrandLogo; }
        toast("Logo saved to brand kit");
        return;
      }
      if (existing){ pushHistory(); existing.src = rd.result; refreshEl(existing); }
      else {
        pushHistory();
        // archive a copy in the persistent media library (IndexedDB)
        try { mediaStore({ id: uid(), name: f.name, type: f.type, data: rd.result, added: Date.now() }); } catch(e){}
        const el = {id:uid(), type:"image", x:project.w*0.2, y:project.h*0.2, w:project.w*0.6, h:project.h*0.4, src:rd.result, fit:"cover", radius:0, opacity:1};
        curPageData().elements.push(el); select(el.id); renderBoard(); saveAutosave();
      }
      toast("Image added");
    };
    rd.readAsDataURL(f);
    inp.value = "";
  };
  inp.click();
}

function pickGlyph(cb){
  const chars = ["★","❤","☀","☾","✿","☕","✈","⚓","♫","⚡","🌿","🔥","💫","🎯","🏆","👑","🐱","🌸","🎉","📌","✉","☑","♥","❝","⚙","🔔","🍋","🥑","🌈","🦋"];
  showModal(`<h3>Choose an icon / emoji</h3><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px">${
    chars.map(c=>`<button class="pal-btn" style="text-align:center;font-size:22px" data-ch="${c}">${c}</button>`).join("")
  }</div><div class="m-actions"><button class="abtn ghost" data-close>Cancel</button></div>`);
  $$("#modalCard [data-ch]").forEach(b=>b.onclick=()=>{ closeModal(); cb(b.dataset.ch); });
  $("#modalCard [data-close]").onclick = ()=>{ closeModal(); cb(null); };
}

/* ---------- actions ---------- */
function duplicateSel(){
  const el = selElement();
  if (!el){ toast("Select an element first \u2014 then Duplicate copies it"); return; }
  pushHistory();
  const c = clone(el); c.id = uid(); c.x += 20; c.y += 20;
  curPageData().elements.push(c);
  select(c.id); renderBoard(); saveAutosave(); toast("Duplicated");
}
function deleteSel(){
  const el = selElement(); if (!el) return;
  pushHistory();
  const arr = curPageData().elements;
  arr.splice(arr.indexOf(el),1);
  selId = null; renderBoard(); renderProps(); saveAutosave();
}
function pushHistory(){
  if (suppressHistory || !project) return;
  undoStack.push(JSON.stringify(project));
  if (undoStack.length > 60) undoStack.shift();
  redoStack = [];
}
function doUndo(){
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(project));
  project = hydrate(JSON.parse(undoStack.pop()));
  if (curPage >= project.pages.length) curPage = project.pages.length-1;
  selId = null; renderBoard(); renderPages(); renderProps(); saveAutosave(); toast("Undo");
}
function doRedo(){
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(project));
  project = hydrate(JSON.parse(redoStack.pop()));
  if (curPage >= project.pages.length) curPage = project.pages.length-1;
  selId = null; renderBoard(); renderPages(); renderProps(); saveAutosave(); toast("Redo");
}

/* ---------- persistence ---------- */
function saveAutosave(){
  if (!project) return;
  try { localStorage.setItem(mkey(LS.autosave), JSON.stringify(project)); $("#saveState").textContent = "Saved"; }
  catch(e){ $("#saveState").textContent = "Storage full"; }
}

/* ================= TOPBAR / EVENTS ================= */
function bindTopbar(){
  $("#brandHome").onclick = openGallery;
  $("#projName").addEventListener("change", ()=>{ if(project){ project.name = $("#projName").value; saveAutosave(); } });
  $("#btnUndo").onclick = doUndo; $("#btnRedo").onclick = doRedo;
  $("#btnDup").onclick = duplicateSel; $("#btnDel").onclick = deleteSel;
  $("#btnFront").onclick = ()=>{ const el=selElement(); if(el){ pushHistory(); reorder(el,"front"); } };
  $("#btnBack").onclick = ()=>{ const el=selElement(); if(el){ pushHistory(); reorder(el,"back"); } };
  $("#zoomSel").onchange = (e)=>{ zoomMode = e.target.value; applyZoom(); };
  $("#btnGuides").onclick = ()=>{
    guidesOn = !guidesOn;
    $("#btnGuides").classList.toggle("on", guidesOn);
    drawGuides();
    toast(guidesOn ? "Print guides on \u2014 backgrounds to the edge, text inside cyan" : "Print guides off");
  };
  $("#btnWatermark").onclick = showWatermarkModal;
  $("#memberChip").onclick = showMemberMenu;
  $("#btnAdmin").onclick = openAdminOverlay;
  const sel = document.getElementById("templateType");
  if (sel){
    sel.innerHTML = '<option value="all">All template types</option>' +
      CATS.map(c => '<option value="' + c.id + '">' + c.icon + " " + c.name + '</option>').join("");
    sel.value = activeCat;
    sel.addEventListener("change", () => { activeCat = sel.value; buildCategoryRail(); renderGallery(); });
  }

  // dropdowns
  $$(".dropdown > button").forEach(btn=>{
    btn.addEventListener("click", (e)=>{ e.stopPropagation(); const dd = btn.parentElement; $$(".dropdown").forEach(d=>d!==dd&&d.classList.remove("open")); dd.classList.toggle("open"); });
  });
  document.addEventListener("click", ()=> $$(".dropdown").forEach(d=>d.classList.remove("open")));

  $("#menuProject").addEventListener("click", (e)=>{
    const act = e.target.dataset.act; if(!act) return;
    $$(".dropdown").forEach(d=>d.classList.remove("open"));
    if (act==="save-local"){ if(project){ saveAutosave(); toast("Saved to browser storage"); } }
    if (act==="open-local") showOpenSaved();
    if (act==="export-json"){ downloadBlob(JSON.stringify(project,null,2), (project.name||"design")+".aura.json", "application/json"); }
    if (act==="import-json"){ $("#fileJson").onchange = ()=>{ const f=$("#fileJson").files[0]; if(!f)return; const rd=new FileReader(); rd.onload=()=>{ try{ project = hydrate(JSON.parse(rd.result)); curPage=0; undoStack=[]; openEditor(); saveAutosave(); toast("Project imported"); }catch(err){ toast("Invalid project file"); } }; rd.readAsText(f); $("#fileJson").value=""; }; $("#fileJson").click(); }
    if (act==="new-blank"){ showModal(`<h3>New blank design</h3><div class="m-row"><select id="npPreset">
      <option value="1080x1080">Square — 1080×1080</option><option value="850x1100">Document — 850×1100</option>
      <option value="1280x720">Presentation 16:9 — 1280×720</option><option value="720x1280">Story 9:16 — 720×1280</option>
      <option value="600x900">Poster — 600×900</option><option value="1050x600">Business card — 1050×600</option></select></div>
      <div class="m-actions"><button class="abtn ghost" data-close>Cancel</button><button class="abtn primary" id="npGo">Create</button></div>`);
      $("#npGo").onclick = ()=>{ const [w,h] = $("#npPreset").value.split("x").map(Number); closeModal();
        project = hydrate({name:"Untitled design",cat:"custom",w,h,pages:[{bg:"#ffffff",elements:[]}]}); curPage=0; undoStack=[]; openEditor(); saveAutosave(); };
    }
    if (act==="watermark"){ showWatermarkModal(); }
    if (act==="manuscript"){ window.open("email-submittal/index.html", "_blank"); }
    if (act==="sanctuary"){ window.open("sanctuary/sanctuarymagazine/login.php", "_blank"); }
    if (act==="members"){ showMemberMenu(); }
    if (act==="library"){ showProjectLibrary(); }
    if (act==="save-lib"){ saveProjectToLibrary("draft").then(rec => { if (rec) toast("Saved to library \u2014 Drafts folder"); }); }
    if (act==="help") showHelp();
  });

  $("#menuExport").addEventListener("click", async (e)=>{
    const act = e.target.dataset.act; if(!act || !project) return;
    $$(".dropdown").forEach(d=>d.classList.remove("open"));
    try {
      if (act==="png"){ const c = await renderPageCanvas(curPageData(), 2);
        exportDiagnostics(c, "PNG");
        const blob = await new Promise(res => c.toBlob(res, "image/png"));
        downloadBlob(blob, pageFile("png"), "image/png"); toast("PNG exported"); }
      if (act==="jpeg"){ const c = await renderPageCanvas(curPageData(), 2);
        exportDiagnostics(c, "JPEG");
        c.toBlob(b => { downloadBlob(b, pageFile("jpg"), "image/jpeg"); toast("JPEG exported"); }, "image/jpeg", 0.92); }
      if (act==="pdf"){
        const pages = [];
        for (const pg of project.pages){
          const c = await renderPageCanvas(pg, 2);
          exportDiagnostics(c, "PDF page");
          const b64 = c.toDataURL("image/jpeg", 0.9).split(",")[1];
          const bin = atob(b64); const u8 = new Uint8Array(bin.length);
          for (let i=0;i<bin.length;i++) u8[i] = bin.charCodeAt(i);
          pages.push({ jpeg: u8, w: c.width, h: c.height });
        }
        downloadBlob(new Blob([buildPdf(pages)], { type: "application/pdf" }), baseName() + ".pdf");
        toast("PDF exported");
      }
      if (act==="mp4"){
        const mime = pvRecorderMime();
        if (!mime){ toast("No supported video codec in this browser"); return; }
        showModal(`<h3>\u23F8 Rendering MP4 slideshow\u2026</h3><div style="height:8px;background:var(--bg2);border-radius:4px;overflow:hidden"><div id="slBar" style="height:100%;width:0%;background:var(--accent)"></div></div><p style="font-size:12px;color:var(--ink-dim);margin-top:6px">One page at a time \u2014 rendering happens in real time.</p>`);
        const scale = Math.min(1, 1280/project.w, 720/project.h);
        const w = Math.round(project.w*scale/2)*2, h = Math.round(project.h*scale/2)*2;
        const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
        const frames = [];
        for (const pg of project.pages){
          const c = document.createElement("canvas"); c.width = w; c.height = h;
          c.getContext("2d").drawImage(await renderPageCanvas(pg, w/project.w), 0, 0);
          frames.push({ img: c, motion: "walkfwd" });
        }
        const wm = (project.watermark && project.watermark.enabled) ? project.watermark : null;
        let logoImg = null;
        if (wm){ const src = resolveWatermarkLogo(wm); if (src) logoImg = await loadImage(src); }
        const blob = await pvRenderClip({ canvas, frames, per: 4000, mime, wm, logoImg, fit: "cover",
          onProgress: p => { const bar = $("#slBar"); if (bar) bar.style.width = Math.round(p*100) + "%"; } });
        const ext = blob.type.includes("mp4") ? "mp4" : "webm";
        await mediaPut({ id: uid(), name: baseName() + "-slideshow." + ext, type: blob.type, blob, added: Date.now() });
        closeModal();
        downloadBlob(new Blob([blob], { type: blob.type }), baseName() + "-slideshow." + ext);
        toast("MP4 slideshow exported and stored in the Media Library");
      }
      if (act==="png-all"){ const files = []; for (let i=0;i<project.pages.length;i++){ const b = await renderPagePng(project.pages[i], 2); files.push({name:`page-${i+1}.png`, data:new Uint8Array(await b.arrayBuffer())}); }
        const zip = ZipWriter.build(files); downloadBlob(new Blob([zip]), baseName()+".png-pages.zip", "application/zip"); toast("All pages exported"); }
      if (act==="svg"){ downloadBlob(renderPageSvg(curPageData()), pageFile("svg"), "image/svg+xml"); toast("SVG exported"); }
      if (act==="odt"){ downloadBlob(new Blob([buildOdt(project)]), baseName()+".odt", "application/vnd.oasis.opendocument.text"); toast("ODT exported — opens in LibreOffice"); }
      if (act==="fodt"){ downloadBlob(new Blob([buildFodt(project)]), baseName()+".fodt", "application/vnd.oasis.opendocument.text"); toast("Flat ODF exported — opens in LibreOffice"); }
      if (act==="print"){ printProject(); }
    } catch(err){ console.error(err); toast("Export failed: "+err.message); }
  });
}

function baseName(){ return (project.name||"design").replace(/[^\w\- ]+/g,"").trim().replace(/ +/g,"-") || "design"; }
function pageFile(ext){ return baseName() + "-p" + (curPage+1) + "." + ext; }
function downloadBlob(blob, name, type){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob], {type}));
  a.download = name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
}

function showOpenSaved(){
  const keys = Object.keys(localStorage).filter(k=>k.startsWith("aura.project."));
  if (!keys.length){ toast("No saved designs yet — use Save to browser first"); return; }
  showModal(`<h3>Open saved design</h3>` + keys.map(k=>{
    let p; try{ p = JSON.parse(localStorage.getItem(k)); }catch(e){ return ""; }
    return `<button class="prop-btn" data-k="${k}">📄 ${esc(p.name||k)} <span style="color:#888">(${p.w}×${p.h})</span></button>`;
  }).join("") + `<div class="m-actions"><button class="abtn ghost" data-close>Close</button></div>`);
  $$("#modalCard [data-k]").forEach(b=>b.onclick=()=>{ closeModal();
    project = hydrate(JSON.parse(localStorage.getItem(b.dataset.k))); curPage=0; undoStack=[]; openEditor(); });
  $("#modalCard [data-close]").onclick = closeModal;
}

function showHelp(){
  showModal(`<h3>Help & shortcuts</h3>
  <p><b>Double-click</b> any text to edit it. Drag to move — snapping guides appear near edges and centers. Drag the corner handles to resize.</p>
  <p><b>Pages:</b> add pages with + in the bottom strip. Presentations, storyboards and multi-page documents are all just pages.</p>
  <p><b>Shortcuts:</b> Del = delete · Ctrl+D = duplicate · Ctrl+Z / Ctrl+Y = undo/redo · Arrow keys = nudge (Shift = 10px) · Ctrl+S = save</p>
  <p><b>Documents & LibreOffice:</b> any design can be exported as <b>.odt</b> or <b>.fodt</b> (flat ODF) and opens directly in LibreOffice Writer — text, fonts, colors and alignment are preserved. Documents-category templates are designed for this.</p>
  <p><b>Admin agent:</b> the ⚙ Admin button opens the local admin panel for template management, updates and upgrades.</p>
  <div class="m-actions"><button class="abtn primary" data-close>Got it</button></div>`);
  $("#modalCard [data-close]").onclick = closeModal;
}

/* ---------------- CMYK swatch-book palette modal ---------------- */
function openCmykPalette(target){
  const apply = (target && target.apply) ? target.apply : defaultCmykApply;
  showModal(`<h3>\u{1F5A8}\uFE0F CMYK Palette</h3>
    <p>Solid-ink reference swatches. The screen previews in RGB; the exact C/M/Y/K recipe is stored with your design and exported as print metadata.</p>
    <input id="cmkFilter" class="prop-input" style="width:100%;margin-top:4px" placeholder="Filter\u2026 try \u201cteal\u201d, \u201cnavy\u201d, or \u201c100 60\u201d">
    <div class="cmyk-grid" id="cmkGrid"></div>
    <div class="m-actions"><button class="abtn primary" data-close>Done</button></div>`);
  const render = () => {
    const q = ($("#cmkFilter").value||"").toLowerCase().trim();
    const items = CMYK_PALETTE.filter(p => !q || p.n.toLowerCase().includes(q) || `${p.c} ${p.m} ${p.y} ${p.k}`.includes(q));
    $("#cmkGrid").innerHTML = items.length ? items.map(p=>`
      <div class="cmyk-cell" data-i="${CMYK_PALETTE.indexOf(p)}">
        <div class="chip" style="background:${cmykToHex(p.c,p.m,p.y,p.k)}"><button class="star" data-hex="${cmykToHex(p.c,p.m,p.y,p.k)}" data-cmyk="${p.c},${p.m},${p.y},${p.k}" title="Add to Brand Kit">\u2605</button></div>
        <div class="nm">${esc(p.n)}</div>
        <div class="rc">${p.c}\u00b7${p.m}\u00b7${p.y}\u00b7${p.k}</div>
      </div>`).join("") : `<div style="color:var(--ink-dim);font-size:12.5px">No swatches match \u201c${esc(q)}\u201d \u2014 try a name or four numbers.</div>`;
    $$("#cmkGrid .cmyk-cell").forEach(cell => cell.onclick = ()=>{
      const p = CMYK_PALETTE[+cell.dataset.i];
      apply({ c:p.c, m:p.m, y:p.y, k:p.k });
      toast(`${p.n} \u2014 ${cmykLabel(p)}`);
    });
    $$("#cmkGrid .star").forEach(st => st.onclick = (e)=>{
      e.stopPropagation();
      addBrandColor(st.dataset.hex, st.dataset.cmyk.split(",").map(Number));
      toast(`${st.dataset.hex.toUpperCase()} added to Brand Kit (${st.dataset.cmyk.split(",").join("\u00b7")})`);
    });
  };
  render();
  $("#cmkFilter").addEventListener("input", render);
  $$("#modalCard [data-close]").forEach(x=> x.onclick = closeModal);
}

function defaultCmykApply(v){
  const el = selElement();
  if (!el){ toast("Select an element first \u2014 or use the \u25a6 button next to a color"); return; }
  pushHistory();
  if (el.type==="text" || el.type==="glyph") el.color = cmykToHex(v.c,v.m,v.y,v.k);
  else if (el.type==="line") el.stroke = cmykToHex(v.c,v.m,v.y,v.k);
  else el.fill = cmykToHex(v.c,v.m,v.y,v.k);
  el.cmyk = v;
  refreshEl(el);
}

function placeBrandLogo(){
  const b = getBrand(); if (!b.logo) return;
  closeModal();
  pushHistory();
  const el = { id:uid(), type:"image", x:Math.round(project.w*0.06), y:Math.round(project.h*0.06), w:Math.min(200,Math.round(project.w*0.25)), h:Math.min(200,Math.round(project.w*0.25)), src:b.logo, fit:"contain", radius:0, opacity:1, filter:"none" };
  curPageData().elements.push(el); select(el.id); renderBoard(); saveAutosave(); toast("Logo placed");
}

function alignSel(el, mode){
  pushHistory();
  if (mode==="left") el.x = 0;
  if (mode==="hcenter") el.x = Math.round((project.w - el.w)/2);
  if (mode==="right") el.x = project.w - el.w;
  if (mode==="top") el.y = 0;
  if (mode==="vcenter") el.y = Math.round((project.h - el.h)/2);
  if (mode==="bottom") el.y = project.h - el.h;
  refreshEl(el);
}

/* CMYK input row + process-color presets, under a color control */
function addCmykRow(afterEl, container, getVal, setVal){
  const cur = getVal();
  const r = document.createElement("div");
  r.className = "prop-row";
  r.innerHTML = `<span class="prop-label">CMYK</span>` +
    ["c","m","y","k"].map(k=>`<input type="number" min="0" max="100" step="1" class="prop-input cmyk-in" data-k="${k}" value="${cur[k]||0}">`).join("") +
    `<button class="align-btn" data-pal="1" title="Browse the full CMYK palette">\u25a6</button>`;
  container.insertBefore(r, afterEl.nextSibling);
  r.querySelector("[data-pal]").onclick = ()=> openCmykPalette({ apply: setVal });
  const read = () => ({
    c: Math.max(0,Math.min(100,+r.querySelector('[data-k="c"]').value||0)),
    m: Math.max(0,Math.min(100,+r.querySelector('[data-k="m"]').value||0)),
    y: Math.max(0,Math.min(100,+r.querySelector('[data-k="y"]').value||0)),
    k: Math.max(0,Math.min(100,+r.querySelector('[data-k="k"]').value||0)),
  });
  r.querySelectorAll(".cmyk-in").forEach(inp=> inp.addEventListener("change", ()=> setVal(read())));
  const pr = document.createElement("div");
  pr.className = "prop-row";
  pr.innerHTML = `<span class="prop-label">Process</span><div class="swatches">` +
    CMYK_PRESETS.map((p,i)=>`<button class="sw" data-i="${i}" title="${p.n} \u00b7 ${cmykLabel({c:p.cmyk[0],m:p.cmyk[1],y:p.cmyk[2],k:p.cmyk[3]})}" style="background:${cmykToHex(p.cmyk[0],p.cmyk[1],p.cmyk[2],p.cmyk[3])}"></button>`).join("") + `</div>`;
  container.insertBefore(pr, r.nextSibling);
  pr.querySelectorAll(".sw").forEach(btn=> btn.onclick = ()=>{
    const p = CMYK_PRESETS[+btn.dataset.i];
    setVal({ c:p.cmyk[0], m:p.cmyk[1], y:p.cmyk[2], k:p.cmyk[3] });
  });
}

/* brand-color quick swatches under a color input */
function addSwatches(afterEl, container, apply){
  const b = getBrand();
  if (!b.colors || !b.colors.length) return;
  const r = document.createElement("div");
  r.className = "prop-row";
  r.innerHTML = `<span class="prop-label"></span><div class="swatches">`+
    b.colors.map(c=>`<button class="sw" style="background:${c}" title="${c}" data-c="${c}"></button>`).join("")+`</div>`;
  r.querySelectorAll(".sw").forEach(s=> s.onclick = ()=> apply(s.dataset.c, (b.cmyk||{})[s.dataset.c]));
  container.insertBefore(r, afterEl.nextSibling);
}

/* ---------------- brand kit modal ---------------- */
function showBrandKit(){
  const b = getBrand();
  showModal(`<h3>\u{1F3A8} Brand Kit</h3>
    <p>Your colors, font and logo \u2014 saved on this computer and offered in every design.</p>
    <div class="m-row"><span style="font-size:12px;color:var(--ink-dim);width:70px;flex-shrink:0">Add color</span>
      <input type="color" id="bkColor" value="#7c5cff" style="flex:0 0 64px;padding:2px;height:34px">
      <button class="abtn ghost" id="bkAdd" style="padding:8px 12px">+ Add</button></div>
    <div id="bkColors" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px"></div>
    <div class="m-row"><span style="font-size:12px;color:var(--ink-dim);width:70px;flex-shrink:0">Font</span>
      <select id="bkFont" class="prop-select">${FONT_LIST.map(f=>`<option value="${esc(f)}" ${b.font===f?"selected":""}>${f.split(",")[0].replace(/'/g,"")}</option>`).join("")}</select></div>
    <div class="m-row"><span style="font-size:12px;color:var(--ink-dim);width:70px;flex-shrink:0">Logo</span>
      <button class="abtn ghost" id="bkLogo" style="padding:8px 12px">Upload logo\u2026</button>
      <span id="bkLogoPrev" style="display:flex;align-items:center;gap:8px">${b.logo?`<img src="${b.logo}" style="height:36px;border-radius:6px">`:""}</span></div>
    <div class="m-actions">
      <button class="abtn ghost" id="bkPlace" ${b.logo?"":"disabled"} style="padding:8px 12px;margin-right:auto">\u2197 Place logo on page</button>
      <button class="abtn ghost" id="bkClear">Clear kit</button>
      <button class="abtn primary" data-close>Done</button></div>`);

  const renderColors = () => {
    const bb = getBrand();
    $("#bkColors").innerHTML = bb.colors.length
      ? bb.colors.map((c,i)=>`<span class="bk-swatch" style="background:${c}"><button data-i="${i}" title="Remove">\u00d7</button></span>`).join("")
      : `<span style="font-size:12px;color:var(--ink-dim)">No colors yet \u2014 add one above. They will appear as quick swatches next to every color picker.</span>`;
    $$("#bkColors button[data-i]").forEach(btn=> btn.onclick = ()=>{
      const arr = getBrand(); arr.colors.splice(+btn.dataset.i,1); setBrand(arr); renderColors(); renderProps();
    });
  };
  renderColors();

  $("#bkAdd").onclick = ()=>{
    const arr = getBrand();
    const c = $("#bkColor").value;
    if (!arr.colors.includes(c)) arr.colors.push(c);
    if (arr.colors.length > 12) arr.colors = arr.colors.slice(-12);
    setBrand(arr); renderColors(); renderProps(); toast("Color added to brand kit");
  };
  $("#bkFont").onchange = (e)=>{ const arr = getBrand(); arr.font = e.target.value; setBrand(arr); renderProps(); toast("Brand font saved"); };
  $("#bkLogo").onclick = ()=> pickImage(null, true); // dataURL-only capture via brand hook
  if (b.logo) $("#bkPlace").onclick = placeBrandLogo;
  $("#bkClear").onclick = ()=>{ setBrand({colors:[],font:"",logo:""}); renderColors(); renderProps(); toast("Brand kit cleared"); };
  $$("#modalCard [data-close]").forEach(x=> x.onclick = closeModal);
}

function addBrandColor(hex, cmykArr){
  const b = getBrand();
  if (!b.colors.includes(hex)) b.colors.push(hex);
  if (b.colors.length > 12) b.colors = b.colors.slice(-12);
  if (cmykArr){ b.cmyk = b.cmyk || {}; b.cmyk[hex] = cmykArr; }
  setBrand(b);
}

/* ---------------- print guides (bleed + safe area) ----------------
   The artboard edge is the final trim size. The magenta line marks the
   bleed minimum (background ink must reach the true page edge) and the
   cyan line is the safe zone for text & logos. DOM overlay only —
   never included in PNG/SVG/ODT exports. */
function drawGuides(){
  $$("#board .guide").forEach(g=>g.remove());
  if (!guidesOn || !project) return;
  const board = $("#board");
  const bleed = 12, safe = 30;
  const mk = (cls, inset, label) => {
    const d = document.createElement("div");
    d.className = "guide " + cls;
    d.style.cssText = `left:${inset}px;top:${inset}px;width:${project.w - 2*inset}px;height:${project.h - 2*inset}px;`;
    d.innerHTML = `<span>${label}</span>`;
    board.appendChild(d);
  };
  mk("guide-bleed", bleed, "BLEED 0.125\u2033 \u2014 background ink must reach the page edge");
  mk("guide-safe", safe, "SAFE ZONE 0.25\u2033 \u2014 keep text & logos inside");
}

function bindPalette(){
  $$("#elemPalette .pal-btn").forEach(b=>{
    if (b.dataset.brand){ b.onclick = showBrandKit; return; }
    if (b.dataset.cmykpal){ b.onclick = ()=> openCmykPalette(null); return; }
    if (b.dataset.aivideo){ b.onclick = showAiVideoWizard; return; }
    if (b.dataset.medialib){ b.onclick = showMediaLibrary; return; }
    if (b.dataset.photovid){ b.onclick = showPhotoToVideo; return; }
    if (b.dataset.aicreate){ b.onclick = showAiCreate; return; }
    if (b.dataset.community){ b.onclick = showCommunityRepo; return; }
    b.onclick = ()=> addElement(b.dataset.add);
  });
}

function bindKeyboard(){
  document.addEventListener("keydown", (e)=>{
    if (e.target.matches("input,textarea,select")) return;
    if (!project) return;
    const el = selElement();
    if ((e.key==="Delete"||e.key==="Backspace") && el){ e.preventDefault(); deleteSel(); }
    if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="d"){ e.preventDefault(); duplicateSel(); }
    if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="z"){ e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
    if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="y"){ e.preventDefault(); doRedo(); }
    if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="s"){ e.preventDefault(); saveAutosave(); toast("Saved to browser storage"); }
    if (el && e.key.startsWith("Arrow")){
      e.preventDefault(); pushHistory();
      const d = e.shiftKey ? 10 : 1;
      if (e.key==="ArrowLeft") el.x -= d; if (e.key==="ArrowRight") el.x += d;
      if (e.key==="ArrowUp") el.y -= d; if (e.key==="ArrowDown") el.y += d;
      refreshEl(el);
    }
  });
}

/* ---------- modal ---------- */
function showModal(html){ $("#modalCard").innerHTML = html; $("#modal").style.display = "flex"; }
function closeModal(){ $("#modal").style.display = "none"; }
$("#modal") && null;

/* ============================================================
   RENDERERS — canvas (PNG), SVG, ODF
   ============================================================ */
function wrapText(ctx, text, maxWidth){
  const out = [];
  for (const raw of String(text).split("\n")){
    if (!raw){ out.push(""); continue; }
    let line = "";
    for (const word of raw.split(" ")){
      const test = line ? line+" "+word : word;
      if (ctx.measureText(test).width > maxWidth && line){ out.push(line); line = word; }
      else line = test;
    }
    out.push(line);
  }
  return out;
}

function loadImage(src){
  return new Promise((res, rej)=>{
    const img = new Image();
    img.onload = ()=>res(img); img.onerror = ()=>res(null);
    img.src = src;
  });
}

async function renderPageCanvas(page, scale){
  // I-019 hardening: sane scale + validated background + per-element isolation
  let sc = Number(scale); if (!isFinite(sc) || sc <= 0 || sc > 8) sc = 1;
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(project.w * sc)); c.height = Math.max(1, Math.round(project.h * sc));
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.scale(sc, sc);
  // preload images
  const imgs = {};
  await Promise.all(page.elements.filter(e=>e.type==="image").map(async e=>{ imgs[e.id] = await loadImage(e.src); }));
  const wmSrc = resolveWatermarkLogo(project.watermark);
  if (wmSrc) imgs["__wm"] = await loadImage(wmSrc);
  drawPage(ctx, page, imgs);
  return c;
}
async function renderPagePng(page, scale){
  const c = await renderPageCanvas(page, scale);
  return new Promise(res => c.toBlob(res, "image/png"));
}
function canvasLooksBlank(canvas){
  // I-019 diagnostics: downsample and test whether the render is one flat color
  try {
    const n = 64;
    const s = document.createElement("canvas");
    s.width = n; s.height = n;
    const x = s.getContext("2d");
    x.drawImage(canvas, 0, 0, n, n);
    const d = x.getImageData(0, 0, n, n).data;
    const first = [d[0], d[1], d[2], d[3]];
    let same = 0;
    for (let i = 0; i < d.length; i += 4){
      if (Math.abs(d[i]-first[0]) <= 2 && Math.abs(d[i+1]-first[1]) <= 2 &&
          Math.abs(d[i+2]-first[2]) <= 2 && Math.abs(d[i+3]-first[3]) <= 2) same++;
    }
    return same / (n*n) > 0.995;
  } catch(e){ return false; }   // tainted canvas: cannot inspect; assume fine
}
function exportDiagnostics(c, label){
  const failed = c.__auraFailedElements || 0;
  const blank = canvasLooksBlank(c);
  if (blank || failed){
    const msg = `Export check (${label}): ${blank ? "output looks BLANK/solid" : "ok"}` +
      `${failed ? " \u2014 " + failed + " element(s) failed to render" : ""}` +
      ` \u2014 page ${curPage+1}/${project.pages.length}, ${curPageData().elements.length} element(s). Details in console (F12).`;
    console.error("[Aura Studio]", msg);
    try { const _t = {}; curPageData().elements.forEach(function(e) { _t[e.type] = (_t[e.type] || 0) + 1; }); console.error("[Aura Studio] element summary:", JSON.stringify(_t)); } catch(e){}
    toast("\u26A0 " + msg, 6000);
  }
  return !blank && !failed;
}

function drawPage(ctx, page, imgs){
  // I-019: normalize the background — an invalid color silently keeps the
  // previous fillStyle (black), which produced solid-color exports.
  const bg = (page.bg && /^(#|rgb|hsl)/.test(page.bg)) ? page.bg : "#ffffff";
  ctx.fillStyle = bg;
  ctx.fillRect(0,0,project.w,project.h);
  let failed = 0;
  for (const el of page.elements){
    ctx.save();
    ctx.globalAlpha = el.opacity != null ? el.opacity : 1;
    if (el.rot){ ctx.translate(el.x + el.w/2, el.y + el.h/2); ctx.rotate(el.rot * Math.PI/180); ctx.translate(-(el.x + el.w/2), -(el.y + el.h/2)); }
    try {
    if (el.type==="rect"){
      const r = el.radius||0;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(el.x, el.y, el.w, el.h, r); else ctx.rect(el.x, el.y, el.w, el.h);
      if (el.fill && el.fill!=="none"){ ctx.fillStyle = el.fill; ctx.fill(); }
      if (el.stroke && el.stroke!=="none"){ ctx.strokeStyle = el.stroke; ctx.lineWidth = el.strokeWidth||1; ctx.stroke(); }
    } else if (el.type==="ellipse"){
      ctx.beginPath(); ctx.ellipse(el.x+el.w/2, el.y+el.h/2, el.w/2, el.h/2, 0, 0, Math.PI*2);
      if (el.fill && el.fill!=="none"){ ctx.fillStyle = el.fill; ctx.fill(); }
      if (el.stroke && el.stroke!=="none"){ ctx.strokeStyle = el.stroke; ctx.lineWidth = el.strokeWidth||1; ctx.stroke(); }
    } else if (el.type==="line"){
      ctx.fillStyle = el.stroke||"#111";
      const horiz = (el.y2a - el.y1) < 2;
      if (horiz) ctx.fillRect(el.x, el.y + (el.h-el.strokeWidth)/2, el.w, el.strokeWidth);
      else ctx.fillRect(el.x + (el.w-el.strokeWidth)/2, el.y, el.strokeWidth, el.h);
    } else if (el.type==="image" && imgs[el.id]){
      const img = imgs[el.id];
      const iw = img.width, ih = img.height;
      let sw=iw, sh=ih, sx=0, sy=0, dx=el.x, dy=el.y, dw=el.w, dh=el.h;
      if (el.fit!=="fill"){
        const s = el.fit==="contain" ? Math.min(el.w/iw, el.h/ih) : Math.max(el.w/iw, el.h/ih);
        if (el.fit==="cover"){ sw = el.w/s; sh = el.h/s; sx = (iw-sw)/2; sy = (ih-sh)/2; }
        else { dw = iw*s; dh = ih*s; dx = el.x + (el.w-dw)/2; dy = el.y + (el.h-dh)/2; }
      }
      const r = el.radius||0;
      if (r > 0){
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(el.x, el.y, el.w, el.h, r);
        ctx.clip();
      }
      if (el.filter && el.filter !== "none"){ try { ctx.filter = el.filter; } catch(e){} }
      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    } else if (el.type==="text" || el.type==="glyph"){
      const txt = el.uppercase ? String(el.text||"").toUpperCase() : String(el.text||"");
      const italic = el.italic ? "italic " : "";
      ctx.font = `${italic}${el.fontWeight||400} ${el.fontSize||24}px ${(el.fontFamily||"Arial").split(",").map(s=>s.trim()).join(", ")}`;
      try { ctx.letterSpacing = el.letterSpacing || "0px"; } catch(e){}
      ctx.fillStyle = el.color || "#111";
      ctx.textBaseline = "top";
      const lines = wrapText(ctx, txt, el.w);
      const lh = (el.fontSize||24) * (el.lineHeight||1.25);
      lines.forEach((line, i)=>{
        let tx = el.x;
        if (el.align==="center") tx = el.x + (el.w - ctx.measureText(line).width)/2;
        else if (el.align==="right") tx = el.x + el.w - ctx.measureText(line).width;
        ctx.fillText(line, tx, el.y + i*lh + (lh-(el.fontSize||24))/2.6);
      });
    }
    } catch(err){
      failed++;
      if (window.console && console.warn) console.warn("Aura export: element failed to render:", el.type, el.id, err && err.message);
    }
    ctx.restore();
  }
  drawWatermarkCanvas(ctx, imgs);
  try { ctx.canvas.__auraFailedElements = failed; } catch(e){}
}

function renderPageSvg(page){
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${project.w}" height="${project.h}" viewBox="0 0 ${project.w} ${project.h}">`);
  parts.push(`<rect width="100%" height="100%" fill="${page.bg||"#fff"}"/>`);
  const meas = document.createElement("canvas").getContext("2d");
  for (const el of page.elements){
    const elStart = parts.length;
    const op = el.opacity != null ? el.opacity : 1;
    if (el.type==="rect"){
      parts.push(`<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="${el.radius||0}" fill="${el.fill&&el.fill!=="none"?el.fill:"none"}" stroke="${el.stroke&&el.stroke!=="none"?el.stroke:"none"}" stroke-width="${el.strokeWidth||0}" opacity="${op}"${cmykAttr(el)}${svgRot(el)}/>`);
    } else if (el.type==="ellipse"){
      parts.push(`<ellipse cx="${el.x+el.w/2}" cy="${el.y+el.h/2}" rx="${el.w/2}" ry="${el.h/2}" fill="${el.fill&&el.fill!=="none"?el.fill:"none"}" stroke="${el.stroke&&el.stroke!=="none"?el.stroke:"none"}" stroke-width="${el.strokeWidth||0}" opacity="${op}"${cmykAttr(el)}${svgRot(el)}/>`);
    } else if (el.type==="line"){
      const horiz = (el.y2a-el.y1)<2;
      if (horiz) parts.push(`<rect x="${el.x}" y="${el.y+(el.h-el.strokeWidth)/2}" width="${el.w}" height="${el.strokeWidth}" fill="${el.stroke}" opacity="${op}"${svgRot(el)}/>`);
      else parts.push(`<rect x="${el.x+(el.w-el.strokeWidth)/2}" y="${el.y}" width="${el.strokeWidth}" height="${el.h}" fill="${el.stroke}" opacity="${op}"${svgRot(el)}/>`);
    } else if (el.type==="image"){
      parts.push(`<clipPath id="c${el.id}"><rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="${el.radius||0}"/></clipPath>`+
        `<image href="${el.src}" x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" preserveAspectRatio="${el.fit==="contain"?"xMidYMid meet":"xMidYMid slice"}" clip-path="url(#c${el.id})" opacity="${op}" style="filter:${el.filter||'none'}"${svgRot(el)}/>`);
    } else if (el.type==="text" || el.type==="glyph"){
      const txt = el.uppercase ? String(el.text||"").toUpperCase() : String(el.text||"");
      const style = `font-family="${(el.fontFamily||"Arial").replace(/"/g,"'")}" font-size="${el.fontSize||24}" font-weight="${el.fontWeight||400}" ${el.italic?'font-style="italic"':""} fill="${el.color||"#111"}" letter-spacing="${el.letterSpacing||0}" opacity="${op}"`;
      const anchor = el.align==="center" ? "middle" : el.align==="right" ? "end" : "start";
      const ax = el.align==="center" ? el.x+el.w/2 : el.align==="right" ? el.x+el.w : el.x;
      const italic = el.italic ? "italic " : "";
      meas.font = `${italic}${el.fontWeight||400} ${el.fontSize||24}px ${el.fontFamily||"Arial"}`;
      const lines = wrapText(meas, txt, el.w);
      const lh = (el.fontSize||24)*(el.lineHeight||1.25);
      lines.forEach((line,i)=>{
        parts.push(`<text x="${ax}" y="${el.y + i*lh + (el.fontSize||24)}" text-anchor="${anchor}" ${style}${cmykAttr(el)}${svgRot(el)}>${esc(line)}</text>`);
      });
    }
    // hyperlink: wrap the element's SVG markup in an anchor so exports stay clickable
    if (el.link && String(el.link).trim()){
      const inner = parts.splice(elStart).join("");
      parts.push(`<a href="${esc(String(el.link).trim())}" target="_blank" rel="noopener">${inner}</a>`);
    }
  }
  parts.push(watermarkSvg());
  parts.push("</svg>");
  return new Blob(parts, {type:"image/svg+xml"});
}

/* ---------- ODF (LibreOffice) ---------- */
function odfEscape(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

function buildFodt(projectData){
  return odfDoc(projectData, true);
}
function buildOdt(projectData){
  return ZipWriter.build([
    { name:"mimetype", data:"application/vnd.oasis.opendocument.text", store:true },
    { name:"META-INF/manifest.xml", data: odfManifest() },
    { name:"styles.xml", data: odfStyles() },
    { name:"content.xml", data: odfDoc(projectData, false) },
  ]);
}
function odfManifest(){
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
 <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>
 <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
 <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`;
}
function odfStyles(){
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
 xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
 xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.2">
 <office:styles>
  <style:default-style style:family="paragraph">
   <style:text-properties fo:font-size="12pt"/>
  </style:default-style>
 </office:styles>
</office:document-styles>`;
}

function odfDoc(projectData, flat){
  // Build automatic text styles from text elements
  const styles = [];
  const usedStyles = new Map();
  let styleIdx = 0;
  const styleFor = (el) => {
    const key = [el.fontSize, el.fontFamily, el.fontWeight, el.color, el.align, el.italic, el.uppercase, el.lineHeight].join("|");
    if (usedStyles.has(key)) return usedStyles.get(key);
    const name = "P" + (++styleIdx);
    usedStyles.set(key, name);
    const fam = (el.fontFamily||"Arial").split(",")[0].replace(/'/g,"").trim();
    const color = (el.color||"#111111");
    const align = el.align==="center" ? "center" : el.align==="right" ? "end" : "start";
    const weight = (+el.fontWeight>=600) ? "bold" : "normal";
    const lh = (el.lineHeight||1.25)*100;
    styles.push(
     `<style:style style:name="${name}" style:family="paragraph">`+
     `<style:paragraph-properties fo:text-align="${align}" fo:line-height="${lh}%"/>`+
     `<style:text-properties style:font-name="${odfEscape(fam)}" fo:font-size="${Math.round((el.fontSize||24)*0.75)}pt" fo:color="${color}" fo:font-weight="${weight}" ${el.italic?'fo:font-style="italic"':""} ${el.uppercase?'fo:text-transform="uppercase"':""}/>`.replace("  "," ")+
     `</style:style>`);
    return name;
  };

  const bodyPages = projectData.pages.map((pg, pi) => {
    const paras = [];
    // sort text elements by y for sensible reading order
    const texts = pg.elements.filter(e=>e.type==="text"||e.type==="glyph").sort((a,b)=>a.y-b.y || a.x-b.x);
    for (const el of texts){
      const st = styleFor(el);
      const txt = el.uppercase ? String(el.text||"").toUpperCase() : String(el.text||"");
      for (const line of txt.split("\n")){
        paras.push(`<text:p text:style-name="${st}">${odfEscape(line)}</text:p>`);
      }
    }
    const first = pi===0 ? "" : `<text:p text:style-name="PageBreak"/>`;
    return first + paras.join("");
  }).join("");

  const autoStyles = `<office:automatic-styles>
   <style:style style:name="PageBreak" style:family="paragraph"><style:paragraph-properties fo:break-before="page"/></style:style>
   ${styles.join("\n   ")}
  </office:automatic-styles>`;

  if (flat){
    return `<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
 xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
 xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
 xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
 office:version="1.2" office:mimetype="application/vnd.oasis.opendocument.text">
 <office:automatic-styles>
   <style:style style:name="PageBreak" style:family="paragraph"><style:paragraph-properties fo:break-before="page"/></style:style>
   ${styles.join("\n   ")}
 </office:automatic-styles>
 <office:body><office:text>${bodyPages}</office:text></office:body>
</office:document>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
 xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
 xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
 xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
 office:version="1.2">
 ${autoStyles}
 <office:body><office:text>${bodyPages}</office:text></office:body>
</office:document-content>`;
}

/* ---------- print ---------- */
async function printProject(){
  const imgs = [];
  for (const pg of project.pages) imgs.push(await blobToDataUrl(await renderPagePng(pg, 2)));
  const w = window.open("", "_blank");
  w.document.write(`<html><head><title>${esc(project.name)}</title><style>
    body{margin:0;font-family:Arial} .pg{page-break-after:always;text-align:center}
    img{max-width:100vw;max-height:100vh} @page{size:auto;margin:0}</style></head><body>${
    imgs.map(d=>`<div class="pg"><img src="${d}"></div>`).join("")
  }<script>setTimeout(()=>window.print(),400)<\/script></body></html>`);
  w.document.close();
}
function blobToDataUrl(blob){
  return new Promise(res=>{ const r = new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(blob); });
}

/* ============================================================
   AI VIDEO COMPOSER — storyboard generator + cloud-AI hook
   ============================================================ */
const AI_CLOUD_LS = "aura.aiCloud";
function getAiCloud(){ try { return JSON.parse(localStorage.getItem(AI_CLOUD_LS) || "") || { endpoint:"", key:"" }; } catch(e){ return { endpoint:"", key:"" }; } }
function setAiCloud(v){ localStorage.setItem(AI_CLOUD_LS, JSON.stringify(v)); }

const VIDEO_STYLES = {
  energetic: {
    label:"Energetic / hype", pal:{ bg:"#0f0c29", fg:"#ffffff", accent:"#ff5c8a", sub:"#c9c3ec" },
    hooks:["Stop scrolling \u2014 {p} just changed everything.","POV: you finally upgraded to {p}.","Nobody expected {p} to do THIS."],
    benefits:["Fast. Ridiculously fast.","Built to keep up with you.","Zero waiting. Zero excuses.","Your old one just became a backup.","Once you try it, there's no going back."],
    ctas:["Get yours today","Tap the link \u2014 before it sells out"], vo:{ pace:"quick cuts every 2\u20133s" }
  },
  luxury: {
    label:"Luxury / elegant", pal:{ bg:"#101828", fg:"#f5efe4", accent:"#d4af37", sub:"#9aa7b8" },
    hooks:["Some things aren't bought. They're chosen.","Introducing {p}.","Quietly extraordinary."],
    benefits:["Crafted without compromise.","Details you can feel.","Made in small batches, never rushed.","Designed to outlast trends.","For those who notice."],
    ctas:["Experience {p}","By appointment only"], vo:{ pace:"slow, deliberate pushes; 40% speed ramp" }
  },
  friendly: {
    label:"Friendly / warm", pal:{ bg:"#fdf6ec", fg:"#3d2b1f", accent:"#e8833a", sub:"#8a6f5c" },
    hooks:["Meet the easiest way to {c}.","You asked. We built {p}.","This is your sign to try {p}."],
    benefits:["Set up in minutes, not weekends.","Made for real, messy, everyday life.","Loved by thousands of people like you.","No manuals. No jargon. Just works.","We're with you all the way."],
    ctas:["Start your free trial","Say hi \u2014 we answer fast"], vo:{ pace:"natural handheld, warm morning light" }
  },
  bold: {
    label:"Bold / high-contrast", pal:{ bg:"#111111", fg:"#ffffff", accent:"#ffd400", sub:"#bbbbbb" },
    hooks:["Everything you know about {c} is wrong.","This is not another {c}.","We removed everything. Then we improved it."],
    benefits:["Obsessively engineered.","Tested to destruction.","No gimmicks. No filler.","The spec sheet speaks for itself.","Built by people who use it daily."],
    ctas:["See the proof","Order now \u2014 ships worldwide"], vo:{ pace:"hard cuts on beat; macro inserts" }
  },
  minimal: {
    label:"Minimal / clean", pal:{ bg:"#f7f7f5", fg:"#1a1a1a", accent:"#5b8def", sub:"#8a8a86" },
    hooks:["{p}. Simply.","Less, but better.","The essentials of {c}."],
    benefits:["One purpose, perfected.","Nothing you don't need.","Thoughtful down to the last screw.","Quietly efficient.","It just fits."],
    ctas:["Learn more","Available now"], vo:{ pace:"locked-off frames, soft daylight, slow dissolves" }
  },
};

const VIDEO_FORMATS = {
  youtube: { label:"YouTube / landscape 16:9", w:1280, h:720, img:[80,80,1120,470], notes:[80,590,760,60], txtY:200 },
  reels:   { label:"Reels / TikTok 9:16",      w:720,  h:1280, img:[60,70,600,900], notes:[60,1010,600,80], txtY:1010 },
  square:  { label:"Square feed 1:1",          w:800,  h:800,  img:[70,70,660,500], notes:[70,640,660,70], txtY:590 },
};

function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function fillTpl(s, map){ return s.replace(/\{(\w+)\}/g, (m,k)=> map[k] != null ? map[k] : m); }

function showAiVideoWizard(){
  const b = getBrand();
  showModal(`<h3>\u{1F3AC} AI Video Composer</h3>
    <p>Describe your product or topic \u2014 the composer auto-writes a full storyboard: hook, benefit scenes, CTA, camera notes, voice-over lines, and captions you can export.</p>
    <div class="m-row"><span style="font-size:12px;color:var(--ink-dim);width:80px;flex-shrink:0">Topic</span>
      <input id="avTopic" placeholder="e.g. stainless water bottle, my bakery, tax software\u2026"></div>
    <div class="m-row"><span style="font-size:12px;color:var(--ink-dim);width:80px;flex-shrink:0">Style</span>
      <select id="avStyle" class="prop-select">${Object.entries(VIDEO_STYLES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join("")}</select></div>
    <div class="m-row"><span style="font-size:12px;color:var(--ink-dim);width:80px;flex-shrink:0">Format</span>
      <select id="avFormat" class="prop-select">${Object.entries(VIDEO_FORMATS).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join("")}</select></div>
    <div class="m-row"><span style="font-size:12px;color:var(--ink-dim);width:80px;flex-shrink:0">Length</span>
      <select id="avLen" class="prop-select"><option value="15">15s \u2014 3 scenes</option><option value="30" selected>30s \u2014 5 scenes</option><option value="60">60s \u2014 8 scenes</option></select></div>
    <div class="m-row"><label style="font-size:12.5px;display:flex;gap:8px;align-items:center"><input type="checkbox" id="avBrand" ${b.colors.length?"checked":"disabled"}> Use Brand Kit colors${b.colors.length?"":" (add colors in Brand Kit first)"}</label></div>
    <div class="m-actions">
      <button class="abtn ghost" id="avCloud" style="margin-right:auto">\u2601 Cloud AI (beta)</button>
      <button class="abtn primary" id="avGo">\u2728 Generate storyboard</button></div>`);
  $("#avGo").onclick = ()=>{
    const topic = ($("#avTopic").value||"").trim() || "your product";
    closeModal();
    generateAiStoryboard({ topic, style:$("#avStyle").value, format:$("#avFormat").value,
      seconds:+$("#avLen").value, useBrand:$("#avBrand").checked });
  };
  $("#avCloud").onclick = showAiCloudSettings;
}

function generateAiStoryboard(opts){
  const style = VIDEO_STYLES[opts.style] || VIDEO_STYLES.energetic;
  const fmt = VIDEO_FORMATS[opts.format] || VIDEO_FORMATS.youtube;
  const pal = opts.useBrand ? { bg:getBrand().colors[0] || style.pal.bg, fg:"#ffffff", accent:getBrand().colors[1] || style.pal.accent, sub:style.pal.sub } : style.pal;
  const words = opts.topic.split(/\s+/);
  const cat = words.length > 2 ? words.slice(-2).join(" ") : opts.topic;
  const map = { p:opts.topic, c:cat };
  const sceneCount = opts.seconds === 15 ? 3 : opts.seconds === 30 ? 5 : 8;
  const per = opts.seconds / sceneCount;

  const hook = fillTpl(pick(style.hooks), map);
  const ctas = pick(style.ctas);
  const cta = fillTpl(ctas, map);
  const benefits = [];
  const pool = [...style.benefits];
  for (let i=0;i<sceneCount-2 && pool.length;i++) benefits.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);

  const voLines = [];
  const shots = ["Slow push-in on product","Hands using it, natural light","Detail macro insert","Lifestyle shot \u2014 real environment","Overhead flat-lay","Reaction shot \u2014 genuine smile","Split-screen before/after","Logo resolve with tagline"];
  const pages = [];
  for (let i=0;i<sceneCount;i++){
    const isHook = i===0, isCta = i===sceneCount-1;
    const headline = isHook ? hook : isCta ? cta : benefits[i-1] || pick(style.benefits);
    const shot = isHook ? shots[0] : isCta ? shots[shots.length-1] : pick(shots.slice(1,-1));
    const vo = isHook ? hook : isCta ? `${cta} \u2014 link in bio.` : headline;
    voLines.push({ start:(i*per).toFixed(1), end:((i+1)*per).toFixed(1), text:vo });
    const [ix,iy,iw,ih] = fmt.img, [nx,ny,nw,nh] = fmt.notes;
    const bigY = isHook || isCta ? Math.round(fmt.img[3]*0.25) : Math.round(fmt.img[3]*0.3);
    pages.push({ bg:pal.bg, elements:[
      IM(ix,iy,iw,ih,`Scene ${i+1} \u2014 ${shot}`,pal.accent,pal.bg,{r:12}),
      T(ix+20,iy+bigY,iw-40,120,headline,{fs:fmt.h===720?54:fmt.h===800?46:64,ff:"'Segoe UI', Arial, sans-serif",fw:"800",c:pal.fg,lh:1.15}),
      R(nx,ny,nw,nh,{f:"#16161d",op:.85,r:10}),
      T(nx+16,ny+8,nw-32,nh-16,`SCENE ${i+1}/${sceneCount} (${(i*per).toFixed(0)}\u2013${((i+1)*per).toFixed(0)}s) \u00b7 ${shot} \u00b7 VO: \u201c${vo}\u201d`,{fs:fmt.h===1280?15:16,ff:"'Courier New', monospace",c:pal.accent,lh:1.4}),
      T(fmt.w-160,12,150,30,`SC ${i+1}/${sceneCount}`,{fs:16,ff:"Arial",c:pal.sub,al:"right"})
    ]});
  }
  // end-card logo from brand kit
  const b = getBrand();
  if (b.logo){ const [ix,iy,iw,ih] = fmt.img; const last = pages[pages.length-1];
    last.elements.push({ type:"image", id:"logo", x:ix+Math.round(iw/2-60), y:iy+Math.round(ih*0.72), w:120, h:120, src:b.logo, fit:"contain", radius:0, opacity:1, filter:"none" });
  }
  project = hydrate({ name:`${opts.topic} \u2014 AI storyboard (${opts.seconds}s)`, cat:"video", w:fmt.w, h:fmt.h, pages,
    meta:{ vo:voLines, style:opts.style, topic:opts.topic } });
  curPage = 0; selId = null; undoStack = []; redoStack = [];
  openEditor(); saveAutosave();
  toast(`Storyboard generated \u2014 ${sceneCount} scenes, ${opts.seconds}s`);
  setTimeout(showAiScriptModal, 400);
}

function showAiScriptModal(){
  if (!project || !project.meta || !project.meta.vo) return;
  const vo = project.meta.vo;
  showModal(`<h3>\u{1F4C4} \u201c${esc(project.meta.topic)}\u201d \u2014 script & captions</h3>
    <p>Style: <b>${esc((VIDEO_STYLES[project.meta.style]||{}).label || project.meta.style)}</b> \u00b7 ${vo.length} scenes. Frames export via <b>Export \u2192 PNG all pages (zip)</b>.</p>
    <div style="max-height:32vh;overflow-y:auto;font-family:'Courier New',monospace;font-size:12px;line-height:1.7;background:var(--bg2);border:1px solid var(--line);border-radius:8px;padding:10px">${
      vo.map(l=>`<div><span style="color:var(--accent)">[${l.start}s\u2013${l.end}s]</span> ${esc(l.text)}</div>`).join("")}</div>
    <div class="m-actions">
      <button class="abtn ghost" id="srtBtn" style="margin-right:auto">\u2b07 Captions (.srt)</button>
      <button class="abtn ghost" id="txtBtn">\u2b07 Script (.txt)</button>
      <button class="abtn primary" data-close>Done</button></div>`);
  const srt = vo.map((l,i)=>`${i+1}\n${srtTime(l.start)} --> ${srtTime(l.end)}\n${l.text}\n`).join("\n");
  const txt = `${project.name}\nStyle: ${project.meta.style}\n\n` + vo.map((l,i)=>`SCENE ${i+1} (${l.start}\u2013${l.end}s)\n  VO: ${l.text}\n`).join("\n");
  $("#srtBtn").onclick = ()=> downloadBlob(new Blob([srt],{type:"text/plain"}), baseName()+".srt");
  $("#txtBtn").onclick = ()=> downloadBlob(new Blob([txt],{type:"text/plain"}), baseName()+"-script.txt");
  $$("#modalCard [data-close]").forEach(x=> x.onclick = closeModal);
}
function srtTime(sec){
  const s = parseFloat(sec) || 0;
  const h = String(Math.floor(s/3600)).padStart(2,"0");
  const m = String(Math.floor((s%3600)/60)).padStart(2,"0");
  const ss = String(Math.floor(s%60)).padStart(2,"0");
  const ms = String(Math.round((s%1)*1000)).padStart(3,"0");
  return `${h}:${m}:${ss},${ms}`;
}

function showAiCloudSettings(){
  const c = getAiCloud();
  showModal(`<h3>\u2601 Cloud AI settings</h3>
    <p>Connect a generation backend. Since browsers block direct calls to most AI APIs (CORS), the recommended setup is a tiny proxy on your own server \u2014 we'll deploy one on your Oracle box when we connect it. Anything you paste here stays in this browser.</p>
    <div class="m-row"><span style="font-size:12px;color:var(--ink-dim);width:80px;flex-shrink:0">Endpoint</span>
      <input id="cldUrl" placeholder="https://your-server/api" value="${esc(c.endpoint)}"></div>
    <div class="m-row"><span style="font-size:12px;color:var(--ink-dim);width:80px;flex-shrink:0">API key</span>
      <input id="cldKey" type="password" placeholder="sk-\u2026 (stored locally only)" value="${esc(c.key)}"></div>
    <div class="m-actions">
      <button class="abtn ghost" id="cldTest" style="margin-right:auto">\u{1F517} Test connection</button>
      <button class="abtn primary" id="cldSave">Save</button></div>`);
  $("#cldSave").onclick = ()=>{ setAiCloud({ endpoint:$("#cldUrl").value.trim(), key:$("#cldKey").value.trim() }); toast("Cloud AI settings saved locally"); };
  $("#cldTest").onclick = async ()=>{
    const url = $("#cldUrl").value.trim();
    if (!url){ toast("Enter an endpoint first"); return; }
    toast("Testing " + url + "\u2026");
    try {
      const ctl = new AbortController(); setTimeout(()=>ctl.abort(), 6000);
      const r = await fetch(url.replace(/\/$/,"") + "/health", { signal:ctl.signal });
      toast(r.ok ? "\u2705 Server reachable \u2014 ready for cloud generation" : "\u26a0\uFE0F Server replied HTTP " + r.status);
    } catch(e){ toast("\u274c Not reachable \u2014 connect the Oracle server first"); }
  };
  $$("#modalCard [data-close]").forEach(x=> x.onclick = closeModal);
}

/* App identity: S³ logo in the header + favicon (falls back gracefully) */
function applyAppBranding(){
  if (typeof S3_LOGO_DATAURL === "undefined") return;
  const dot = document.querySelector(".brand-dot");
  if (dot) dot.innerHTML = `<img src="${S3_LOGO_DATAURL}" alt="VMSB LLP" style="width:100%;height:100%;object-fit:contain;background:#fff;border-radius:8px">`;
  const fav = document.querySelector('link[rel="icon"]');
  if (fav) fav.href = S3_LOGO_DATAURL;
}

/* Admin Agent embedded in-page (avoids popup blockers entirely) */
function openAdminOverlay(){
  const old = $("#adminOverlay"); if (old) old.remove();
  const d = document.createElement("div");
  d.id = "adminOverlay";
  d.innerHTML = `<div class="admin-frame">
    <div class="admin-bar"><span>\u2699 Admin Agent</span>
      <button id="adminClose" title="Close">\u2715 Close</button></div>
    <iframe id="adminFrame" src="admin.html" title="Aura Studio Admin Agent"></iframe>
  </div>`;
  document.body.appendChild(d);
  $("#adminClose").onclick = ()=> d.remove();
}

/* ============================================================
   WATERMARK — stamp text and/or logo on ALL pages.
   Stored at project level; rendered in editor preview (DOM),
   PNG/print (canvas) and SVG. Never in ODT (text-only export).
   ============================================================ */
function resolveWatermarkLogo(wm){
  if (!wm || !wm.logo || wm.logo === "none") return null;
  if (wm.logo === "s3") return (typeof S3_LOGO_DATAURL !== "undefined") ? S3_LOGO_DATAURL : null;
  if (wm.logo === "brand") return getBrand().logo || null;
  return null;
}

function showWatermarkModal(){
  if (!project){ toast("Open a design first"); return; }
  const wm = project.watermark || { enabled:true, text:"CONFIDENTIAL", logo:"s3", opacity:0.12, angle:"diagonal", fontScale:0.12, logoScale:0.45, color:"#7a7a7a" };
  const b = getBrand();
  showModal(`<h3>\u{1F4A7} Watermark \u2014 all pages</h3>
    <p>Stamp applied to every page \u2014 visible in the editor and baked into PNG, SVG and print exports.</p>
    <div class="m-row"><label style="font-size:13px;display:flex;gap:8px;align-items:center"><input type="checkbox" id="wmOn" ${wm.enabled?"checked":""}> <b>Enable watermark on ALL pages</b></label></div>
    <div class="m-row"><span style="font-size:12px;color:var(--ink-dim);width:80px;flex-shrink:0">Text</span>
      <input id="wmText" value="${esc(wm.text || "")}" placeholder="CONFIDENTIAL"></div>
    <div class="m-row"><span style="font-size:12px;color:var(--ink-dim);width:80px;flex-shrink:0">Logo</span>
      <select id="wmLogo" class="prop-select">
        <option value="s3" ${wm.logo==="s3"?"selected":""}>S3 PRGDUCTION & PUBLISHING HOUSE logo (built-in)</option>
        ${b.logo?`<option value="brand" ${wm.logo==="brand"?"selected":""}>Brand Kit logo</option>`:""}
        <option value="none" ${(!wm.logo || wm.logo==="none")?"selected":""}>Text only</option>
      </select></div>
    <div class="m-row"><span style="font-size:12px;color:var(--ink-dim);width:80px;flex-shrink:0">Angle</span>
      <select id="wmAngle" class="prop-select">
        <option value="diagonal" ${wm.angle!=="horizontal"?"selected":""}>Diagonal</option>
        <option value="horizontal" ${wm.angle==="horizontal"?"selected":""}>Horizontal</option>
      </select></div>
    <div class="m-row"><span style="font-size:12px;color:var(--ink-dim);width:80px;flex-shrink:0">Opacity</span>
      <input type="range" id="wmOp" min="0.04" max="0.5" step="0.01" value="${wm.opacity!=null?wm.opacity:0.12}" class="prop-input"></div>
    <div class="m-row"><span style="font-size:12px;color:var(--ink-dim);width:80px;flex-shrink:0">Text size</span>
      <input type="range" id="wmFs" min="0.06" max="0.25" step="0.01" value="${wm.fontScale||0.12}" class="prop-input"></div>
    <div class="m-row"><span style="font-size:12px;color:var(--ink-dim);width:80px;flex-shrink:0">Logo size</span>
      <input type="range" id="wmLs" min="0.2" max="0.9" step="0.05" value="${wm.logoScale||0.45}" class="prop-input"></div>
    ${!b.logo?`<p style="font-size:11.5px">Tip: upload your own logo in the Brand Kit to use it as the watermark.</p>`:""}
    <div class="m-actions">
      <button class="abtn ghost" id="wmRemove" style="margin-right:auto">Remove watermark</button>
      <button class="abtn primary" id="wmApply">Apply to ALL pages</button></div>`);
  $("#wmApply").onclick = ()=>{
    // snapshot BEFORE mutating so undo can revert the watermark (defect fix)
    pushHistory();
    project.watermark = { enabled: $("#wmOn").checked,
      text: $("#wmText").value.trim() || "CONFIDENTIAL",
      logo: $("#wmLogo").value, angle: $("#wmAngle").value,
      opacity: +$("#wmOp").value, fontScale: +$("#wmFs").value,
      logoScale: +$("#wmLs").value, color: "#7a7a7a" };
    renderBoard(); renderPages(); saveAutosave(); closeModal();
    toast(project.watermark.enabled ? "Watermark applied to ALL pages" : "Watermark disabled");
  };
  $("#wmRemove").onclick = ()=>{
    pushHistory();   // snapshot before mutation (undoable)
    project.watermark = { enabled:false };
    renderBoard(); renderPages(); saveAutosave(); closeModal();
    toast("Watermark removed from all pages");
  };
  $$("#modalCard [data-close]").forEach(x=> x.onclick = closeModal);
}

function renderWatermarkOverlay(){
  $$("#board .wm-layer").forEach(x=>x.remove());
  const wm = project && project.watermark;
  if (!wm || !wm.enabled) return;
  const src = resolveWatermarkLogo(wm);
  if (!src && !wm.text) return;
  const d = document.createElement("div");
  d.className = "wm-layer";
  const fs = Math.round(Math.min(project.w, project.h) * (wm.fontScale || 0.12));
  d.style.cssText = `position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;`+
    `gap:4%;pointer-events:none;z-index:15;transform:${wm.angle==="diagonal"?"rotate(-30deg)":"none"};`+
    `opacity:${wm.opacity!=null?wm.opacity:0.12};`;
  d.innerHTML = `${src?`<img src="${src}" style="width:${Math.round((wm.logoScale||0.45)*100)}%;max-width:92%;object-fit:contain">`:""}`+
    `${wm.text?`<div style="font:800 ${fs}px Arial, sans-serif;color:${wm.color||"#7a7a7a"};white-space:nowrap">${esc(wm.text)}</div>`:""}`;
  $("#board").appendChild(d);
}

function drawWatermarkCanvas(ctx, imgs){
  const wm = project && project.watermark;
  if (!wm || !wm.enabled) return;
  const w = project.w, h = project.h;
  const src = resolveWatermarkLogo(wm);
  if (!src && !wm.text) return;
  ctx.save();
  ctx.globalAlpha = wm.opacity != null ? wm.opacity : 0.12;
  ctx.translate(w/2, h/2);
  if (wm.angle !== "horizontal") ctx.rotate(-Math.PI/6);
  if (src && imgs["__wm"]){
    const img = imgs["__wm"];
    const diag = Math.sqrt(w*w + h*h);
    const lw = diag * (wm.logoScale || 0.45);
    const lh = img.height ? lw * (img.height / img.width) : lw * 0.6;
    try { ctx.drawImage(imgs["__wm"], -lw/2, -lh/2 - h*0.02, lw, lh); } catch(e){}
  }
  if (wm.text){
    const fs = Math.round(Math.min(w,h) * (wm.fontScale || 0.12));
    ctx.font = `800 ${fs}px Arial, sans-serif`;
    ctx.fillStyle = wm.color || "#7a7a7a";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(wm.text, 0, Math.min(w,h) * 0.2);
  }
  ctx.restore();
}

function watermarkSvg(){
  const wm = project && project.watermark;
  if (!wm || !wm.enabled) return "";
  const w = project.w, h = project.h, cx = w/2, cy = h/2;
  const src = resolveWatermarkLogo(wm);
  if (!src && !wm.text) return "";
  const rot = wm.angle !== "horizontal" ? ` transform="rotate(-30 ${cx} ${cy})"` : "";
  const fs = Math.round(Math.min(w,h) * (wm.fontScale || 0.12));
  const diag = Math.sqrt(w*w + h*h);
  const lw = diag * (wm.logoScale || 0.45);
  const lh = lw * 0.6;
  const logo = src ? `<image href="${src}" x="${cx-lw/2}" y="${cy-lh/2-h*0.02}" width="${lw}" height="${lh}" preserveAspectRatio="xMidYMid meet"/>` : "";
  const txt = wm.text ? `<text x="${cx}" y="${cy + Math.min(w,h)*0.2}" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-weight="800" font-size="${fs}" fill="${wm.color||"#7a7a7a"}">${esc(wm.text)}</text>` : "";
  return `<g opacity="${wm.opacity!=null?wm.opacity:0.12}"${rot}>${logo}${txt}</g>`;
}

/* ============================================================
   MEDIA LIBRARY — persistent images & videos via IndexedDB.
   Local tier now; Oracle object storage becomes the cloud tier
   of this same library in Phase II.
   ============================================================ */
const MEDIA_DB = "auraMedia";
const MEDIA_MAX_BYTES = 2 * 1024 * 1024;   // per-record image storage cap (2 MB)
const MEDIA_LOC_LOCAL = "local-idb";       // DB record location (cloud tier writes "cloud-oracle")

function dataUrlBytes(dataUrl){
  const i = String(dataUrl || "").indexOf(",");
  return i < 0 ? 0 : Math.round((String(dataUrl).length - i - 1) * 0.75);
}
async function compressImageToCap(dataUrl, type){
  const img = await loadImage(dataUrl);
  if (!img) return { dataUrl: dataUrl, bytes: dataUrlBytes(dataUrl), compressed: false, ok: false };
  let scale = 1, q = 0.9, out = dataUrl, bytes = dataUrlBytes(dataUrl);
  for (let attempt = 0; attempt < 9; attempt++){
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * scale));
    c.height = Math.max(1, Math.round(img.height * scale));
    const x = c.getContext("2d");
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
    x.drawImage(img, 0, 0, c.width, c.height);
    const t = (attempt === 0 && type === "image/png") ? "image/png" : "image/jpeg";
    out = c.toDataURL(t, q);
    bytes = dataUrlBytes(out);
    if (bytes <= MEDIA_MAX_BYTES) return { dataUrl: out, bytes: bytes, compressed: attempt > 0, ok: true };
    scale *= 0.8; q = Math.max(0.5, q - 0.06);
  }
  return { dataUrl: out, bytes: bytes, compressed: true, ok: bytes <= MEDIA_MAX_BYTES };
}
async function mediaStore(rec){
  const isImage = (rec.type || "").startsWith("image");
  if (isImage && rec.data && dataUrlBytes(rec.data) > MEDIA_MAX_BYTES){
    const r = await compressImageToCap(rec.data, rec.type || "image/jpeg");
    if (!r.ok) return { stored: false, reason: "exceeds the 2 MB storage limit even after compression" };
    rec.data = r.dataUrl; rec.type = "image/jpeg";
    rec.bytes = r.bytes; rec.compressed = true; rec.origBytes = dataUrlBytes(rec.data);
  } else {
    rec.bytes = rec.blob ? rec.blob.size : dataUrlBytes(rec.data);
  }
  rec.loc = MEDIA_LOC_LOCAL;              // DB record location (cloud tier writes "cloud-oracle")
  await mediaPut(rec);
  return { stored: true, bytes: rec.bytes, compressed: !!rec.compressed };
}

/* ============================================================
   PROJECT LIBRARY — Drafts / Complete / Trash (Phase III).
   Projects persist in IndexedDB ("projects" store), scoped per
   member. Trash auto-purges after 30 days. The full project JSON
   travels with the record, so Open restores everything.
   ============================================================ */
const PROJ_TRASH_DAYS = 30;
async function projPut(rec){
  const db = await openMediaDb();
  return new Promise((res, rej) => {
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").put(rec);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}
async function projAll(){
  const db = await openMediaDb();
  return new Promise((res, rej) => {
    const rq = db.transaction("projects").objectStore("projects").getAll();
    rq.onsuccess = () => res(rq.result || []); rq.onerror = () => rej(rq.error);
  });
}
async function projDelete(id){
  const db = await openMediaDb();
  return new Promise((res, rej) => {
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").delete(id);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}
async function projPurgeTrash(){
  try {
    const cutoff = Date.now() - PROJ_TRASH_DAYS * 864e5;
    for (const r of await projAll()){
      if (r.state === "trash" && (r.updated || 0) < cutoff) await projDelete(r.id);
    }
  } catch(e){}
}
async function saveProjectToLibrary(state){
  if (!project) return null;
  if (!project.id) project.id = uid();
  const me = currentUser() || "Guest";
  const all = await projAll();
  const existing = all.find(r => r.id === project.id && r.by === me);
  const rec = { id: project.id, by: me,
    name: project.name || "Untitled design",
    state: state || (existing ? existing.state : "draft"),
    created: existing ? existing.created : Date.now(), updated: Date.now(),
    pages: project.pages.length, project: JSON.parse(JSON.stringify(project)) };
  await projPut(rec);
  return rec;
}
function openLibraryProject(rec){
  project = hydrate(JSON.parse(JSON.stringify(rec.project)));
  project.id = rec.id;
  project.name = rec.name;
  curPage = 0; selId = null; undoStack = []; redoStack = [];
  openEditor(); saveAutosave();
  toast("Opened \u201c" + rec.name + "\u201d");
}
let pjView = "draft";
async function showProjectLibrary(){
  if (typeof indexedDB === "undefined"){ toast("Project library unavailable in this browser"); return; }
  await projPurgeTrash();
  const me = currentUser() || "Guest";
  const all = (await projAll()).filter(r => r.by === me).sort((a,b) => (b.updated||0) - (a.updated||0));
  const counts = { draft: 0, complete: 0, trash: 0 };
  all.forEach(r => { counts[r.state] = (counts[r.state] || 0) + 1; });
  const list = all.filter(r => r.state === pjView);
  const card = (r) => {
    const inTrash = r.state === "trash";
    const sz = r.project ? JSON.stringify(r.project).length : 0;
    const szTxt = sz > 1048576 ? (sz/1048576).toFixed(1) + " MB" : Math.round(sz/1024) + " KB";
    const acts = [];
    acts.push('<button data-open="1" title="Open this project">▶ Open</button>');
    if (r.state === "draft") acts.push('<button data-cmp="1" title="Mark as complete">✓ Complete</button>');
    if (r.state === "complete") acts.push('<button data-draft="1" title="Reopen as draft">↩ Reopen</button>');
    if (!inTrash) acts.push('<button data-trash="1" title="Move to trash">✕ Trash</button>');
    else {
      acts.push('<button data-rest="1" title="Restore to drafts">↩ Restore</button>');
      acts.push('<button data-del="1" title="Delete permanently">✕ Delete</button>');
    }
    return '<div class="pj-card" data-id="' + r.id + '">' +
      '<div class="pj-name">' + (r.name || "Untitled").replace(/</g, "&lt;") + '</div>' +
      '<div class="pj-meta">' + r.pages + ' page(s) · ~' + szTxt + ' · updated ' +
      new Date(r.updated || Date.now()).toLocaleDateString() + '</div>' +
      '<div class="pj-acts">' + acts.join("") + '</div></div>';
  };
  const tabs = '<div class="pj-tabs">' +
    '<button data-tab="draft" class="' + (pjView === "draft" ? "on" : "") + '">\u{1F4C1} Drafts (' + counts.draft + ')</button>' +
    '<button data-tab="complete" class="' + (pjView === "complete" ? "on" : "") + '">✓ Complete (' + counts.complete + ')</button>' +
    '<button data-tab="trash" class="' + (pjView === "trash" ? "on" : "") + '">✕ Trash (' + counts.trash + ')</button></div>';
  const rows = list.length ? list.map(card).join("") :
    (pjView === "draft" ? "<p style=\"color:var(--ink-dim);font-size:12.5px\">No drafts — open a template or start a new design, then Project ▸ Save to library.</p>"
     : pjView === "complete" ? "<p style=\"color:var(--ink-dim);font-size:12.5px\">No completed projects yet.</p>"
     : "<p style=\"color:var(--ink-dim);font-size:12.5px\">Trash is empty. Deleted projects rest here for 30 days.</p>");
  showModal('<h3>\u{1F4C1} Project library <span style="font-size:12px;color:var(--ink-dim)">— member: ' + me + '</span></h3>' +
    tabs + '<div class="pj-grid" id="pjGrid">' + rows + '</div>' +
    '<div class="m-actions" style="justify-content:space-between">' +
    '<button class="abtn ghost" id="pjNew">➕ New blank design</button>' +
    '<button class="abtn primary" data-close style="margin-left:auto">Done</button></div>');
  $$("#pjGrid .pj-card").forEach(cardEl => {
    const id = cardEl.dataset.id;
    const rec = list.find(r => r.id === id);
    cardEl.querySelector("[data-open]").onclick = () => { closeModal(); openLibraryProject(rec); };
    const cmp = cardEl.querySelector("[data-cmp]");
    if (cmp) cmp.onclick = async () => { rec.state = "complete"; rec.updated = Date.now(); await projPut(rec); showProjectLibrary(); };
    const drft = cardEl.querySelector("[data-draft]");
    if (drft) drft.onclick = async () => { rec.state = "draft"; rec.updated = Date.now(); await projPut(rec); showProjectLibrary(); };
    const tr = cardEl.querySelector("[data-trash]");
    if (tr) tr.onclick = async () => { rec.state = "trash"; rec.updated = Date.now(); await projPut(rec); showProjectLibrary(); };
    const rst = cardEl.querySelector("[data-rest]");
    if (rst) rst.onclick = async () => { rec.state = "draft"; rec.updated = Date.now(); await projPut(rec); showProjectLibrary(); };
    const del = cardEl.querySelector("[data-del]");
    if (del) del.onclick = async () => {
      if (!confirm("“" + rec.name + "” will be permanently deleted. Continue?")) return;
      await projDelete(rec.id); showProjectLibrary();
    };
  });
  $$("#modalCard [data-tab]").forEach(b => b.onclick = () => { pjView = b.dataset.tab; showProjectLibrary(); });
  $("#pjNew").onclick = () => {
    closeModal();
    project = hydrate({ name: "Untitled design", cat: "custom", w: 850, h: 1100, pages: [{ bg: "#ffffff", elements: [] }] });
    curPage = 0; selId = null; undoStack = []; redoStack = [];
    openEditor(); saveAutosave(); toast("New blank design");
  };
  $$("#modalCard [data-close]").forEach(x => x.onclick = closeModal);
}
let _mediaDb = null;
function openMediaDb(){
  return new Promise((res, rej) => {
    if (_mediaDb) return res(_mediaDb);
    const rq = indexedDB.open(MEDIA_DB, 1);
    rq.onupgradeneeded = () => { rq.result.createObjectStore("media", { keyPath: "id" }); };
    rq.onsuccess = () => { _mediaDb = rq.result; res(_mediaDb); };
    rq.onerror = () => rej(rq.error);
  });
}
async function mediaPut(rec){
  const db = await openMediaDb();
  return new Promise((res, rej) => {
    const tx = db.transaction("media", "readwrite");
    tx.objectStore("media").put(rec);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}
async function mediaAll(){
  const db = await openMediaDb();
  return new Promise((res, rej) => {
    const rq = db.transaction("media").objectStore("media").getAll();
    rq.onsuccess = () => res(rq.result || []); rq.onerror = () => rej(rq.error);
  });
}
async function mediaDelete(id){
  const db = await openMediaDb();
  return new Promise((res, rej) => {
    const tx = db.transaction("media", "readwrite");
    tx.objectStore("media").delete(id);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}
function mediaSrcOf(rec){ return rec.data || rec.src || ""; }

async function showMediaLibrary(){
  let items = [];
  try { items = (await mediaAll()).sort((a,b) => (b.added||0) - (a.added||0)); }
  catch(e){ toast("Media library unavailable: " + e.message); return; }
  const cells = items.length ? items.map(m => {
    const isVid = (m.type || "").startsWith("video") || !!m.blob;
    const isAud = (m.type || "").startsWith("audio");
    const thumb = isAud ? `<div class="ml-thumb ml-video">\uD83D\uDD0A</div>`
      : isVid ? `<div class="ml-thumb ml-video">\uD83D\uDCFD\uFE0F</div>`
      : `<div class="ml-thumb"><img src="${mediaSrcOf(m)}" alt=""></div>`;
    return `<div class="ml-cell" data-id="${esc(m.id)}">
      ${thumb}<div class="ml-nm">${esc((m.name || "asset").slice(0,26))}</div>
      <div class="ml-ops"><button data-ins="1" title="${isVid ? "Videos become insertable in Phase II" : "Insert into page"}">${isVid ? "\u2b07" : "\u2795"}</button>
      <button data-dl="1" title="Download">\u2b07</button><button data-del="1" title="Delete">\u2715</button><button data-pub="1" title="Publish to community repository">\uD83D\uDF10</button></div></div>`;
  }).join("") : `<p style="color:var(--ink-dim);font-size:12.5px">Library is empty \u2014 upload images or videos below. Files persist in this browser (IndexedDB), well beyond the 5 MB localStorage limit.</p>`;
  showModal(`<h3>\uD83D\uDDBC\uFE0F Media Library</h3>
    <p>Persistent local storage for images and videos. Images can be re-inserted into any design; videos are stored and downloadable (insertable video elements arrive in Phase II).</p>
    <div class="ml-grid" id="mlGrid">${cells}</div>
    <div class="m-actions" style="justify-content:space-between">
      <button class="abtn ghost" id="mlAdd">\u2b06 Upload images / videos</button>
      <button class="abtn ghost" id="mlPv">\u{1F3AC} Photo \u2192 Video</button>
      <button class="abtn primary" data-close>Done</button></div>`);
  const rerun = () => { closeModal(); showMediaLibrary(); };
  $("#mlPv").onclick = () => { closeModal(); showPhotoToVideo(); };
  $("#mlAdd").onclick = () => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*,video/*,audio/*"; inp.multiple = true;
    inp.onchange = async () => {
      let n = 0, skipped = 0, shrunk = 0;
      for (const f of inp.files){
        try {
          const src = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
          const r = await mediaStore({ id: uid(), name: f.name, type: f.type, data: src, added: Date.now() });
          if (r.stored){ n++; if (r.compressed) shrunk++; }
          else { skipped++; toast(f.name + ": " + r.reason, 4000); }
        } catch(e){ toast("Failed to store " + f.name); }
      }
      if (n) toast(n + " stored \u00b7 " + (shrunk ? shrunk + " compressed to fit 2 MB \u00b7 " : "") + (skipped ? skipped + " skipped" : ""));
      rerun();
    };
    inp.click();
  };
  $$("#mlGrid .ml-cell").forEach(cell => {
    const id = cell.dataset.id;
    const rec = items.find(m => m.id === id);
    const ins = cell.querySelector("[data-ins]"), dl = cell.querySelector("[data-dl]"), del = cell.querySelector("[data-del]"), pub = cell.querySelector("[data-pub]");
    if (ins) ins.onclick = () => {
      const isVid = (rec.type || "").startsWith("video");
      const isAud = (rec.type || "").startsWith("audio");   // I-018 fix: was scoped to the builder only
      if (isVid || isAud){ toast((isAud ? "Audio elements arrive with the music editor" : "Video elements arrive in Phase II") + " \u2014 use the download button for now"); return; }
      closeModal();
      pushHistory();
      const el = { id: uid(), type: "image", x: Math.round(project.w*0.2), y: Math.round(project.h*0.2),
        w: Math.round(project.w*0.6), h: Math.round(project.h*0.4), src: mediaSrcOf(rec), fit: "cover", radius: 0, opacity: 1, filter: "none" };
      curPageData().elements.push(el); select(el.id); renderBoard(); saveAutosave(); toast("Inserted from library");
    };
    if (dl) dl.onclick = () => {
      const a = document.createElement("a");
      a.href = rec.blob ? URL.createObjectURL(rec.blob) : mediaSrcOf(rec);
      a.download = rec.name || "asset"; a.click();
    };
    if (pub) pub.onclick = async () => { await publishToCommunity(rec); rerun(); };
    if (del) del.onclick = async () => { await mediaDelete(id); rerun(); };
  });
  $$("#modalCard [data-close]").forEach(x => x.onclick = closeModal);
}

/* ============================================================
   PHOTO → VIDEO GENERATOR — animate photo(s) into a video clip,
   rendered in-browser (canvas + MediaRecorder) and stored in the
   Media Library (IndexedDB now; Oracle object storage in Phase II).
   Motion presets: zoom in/out, pans, Ken Burns auto. Watermark from
   project settings (logo + CONFIDENTIAL) is baked into every frame.
   ============================================================ */
const PV_MIMES = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
function pvRecorderMime(){
  if (typeof MediaRecorder === "undefined") return "";
  return PV_MIMES.find(m => { try { return MediaRecorder.isTypeSupported(m); } catch(e){ return false; } }) || "";
}
function pvMotionScale(motion, local){
  if (motion === "zoomin") return 1.02 + 0.16*local;
  if (motion === "zoomout") return 1.18 - 0.16*local;
  if (motion === "walkfwd") return 1.04 + 0.14*local;   // Villa Walking forward
  if (motion === "walkback") return 1.18 - 0.14*local;  // Villa Walking backward
  return 1.15;
}
function pvDrawPhoto(ctx, img, motion, local, w, h, fit, bg, idx){
  // I-017 fix: high-quality resampling - no more blurry/jagged distortion
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const iw = img.width, ih = img.height;
  if (fit === "blur" && bg){
    // Contained mode: pre-rendered blurred backdrop (no crop, no stretch) + full image on top
    ctx.drawImage(bg, 0, 0, w, h);
    let s = 1.0, dx = 0, dy = 0;
    if (motion === "zoomin" || motion === "walkfwd") s = 1.0 + 0.06*local;
    else if (motion === "zoomout" || motion === "walkback") s = 1.06 - 0.06*local;
    else if (motion === "panright") dx = (0.5 - local) * (w - iw*Math.min(w/iw, h/ih)) * 0.4;
    else if (motion === "panleft") dx = (local - 0.5) * (w - iw*Math.min(w/iw, h/ih)) * 0.4;
    else s = 1.0 + 0.05*local;
    let bob = 0;
    if (motion === "walkfwd" || motion === "walkback") bob = -Math.abs(Math.sin(local * Math.PI * 4)) * h * 0.006;
    const base = Math.min(w/iw, h/ih) * s;
    const dw = iw*base, dh = ih*base;
    ctx.drawImage(img, (w-dw)/2 + dx, (h-dh)/2 + dy + bob, dw, dh);
    return;
  }
  // Cover mode (fill frame)
  const base = Math.max(w/iw, h/ih);
  let s = 1.08, dx = 0, dy = 0;
  if (motion === "zoomin"){ s = 1.02 + 0.16*local; }
  else if (motion === "zoomout"){ s = 1.18 - 0.16*local; }
  else if (motion === "panright"){ s = 1.2; dx = (0.5 - local) * (iw*base*s - w); }
  else if (motion === "panleft"){ s = 1.2; dx = (local - 0.5) * (iw*base*s - w); }
  else if (motion === "panup"){ s = 1.2; dy = (local - 0.5) * (ih*base*s - h); }
  else if (motion === "walkfwd"){
    s = 1.04 + 0.14*local; dy = -Math.abs(Math.sin(local * Math.PI * 4)) * h * 0.008;
  }
  else if (motion === "walkback"){
    s = 1.18 - 0.14*local; dy = -Math.abs(Math.sin(local * Math.PI * 4)) * h * 0.008;
  }
  else { s = 1.02 + 0.14*local; dx = (local - 0.5) * (iw*base*s - w) * 0.25; }
  const sc = base * s, dw = iw*sc, dh = ih*sc;
  ctx.drawImage(img, (w-dw)/2 + dx, (h-dh)/2 + dy, dw, dh);
}
function makeBlurredBg(img, w, h){
  // Pre-render the blurred backdrop once per photo (fast per-frame compositing)
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d");
  x.imageSmoothingQuality = "high";
  const iw = img.width, ih = img.height;
  const base = Math.max(w/iw, h/ih) * 1.18;   // oversize so blur never shows edges
  const dw = iw*base, dh = ih*base;
  x.filter = "blur(" + Math.max(8, Math.round(Math.min(w,h) * 0.035)) + "px)";
  x.drawImage(img, (w-dw)/2, (h-dh)/2, dw, dh);
  return c;
}

function pvPaintWatermark(ctx, w, h, wm, logoImg){
  if (!wm) return;
  ctx.save();
  ctx.globalAlpha = wm.opacity != null ? wm.opacity : 0.12;
  ctx.translate(w/2, h/2);
  if (wm.angle !== "horizontal") ctx.rotate(-Math.PI/6);
  if (logoImg){
    const diag = Math.sqrt(w*w + h*h);
    const lw = diag * (wm.logoScale || 0.45);
    const lh = logoImg.height ? lw * (logoImg.height / logoImg.width) : lw * 0.6;
    try { ctx.drawImage(logoImg, -lw/2, -lh/2 - h*0.02, lw, lh); } catch(e){}
  }
  if (wm.text){
    const fs = Math.round(Math.min(w,h) * (wm.fontScale || 0.12));
    ctx.font = `800 ${fs}px Arial, sans-serif`;
    ctx.fillStyle = wm.color || "#7a7a7a";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(wm.text, 0, Math.min(w,h) * 0.2);
  }
  ctx.restore();
}

async function pvRenderClip(opts){
  // Shared render core: canvas frames -> MediaRecorder -> Blob.
  // opts: { canvas, frames:[{img,motion}], per(ms), mime, wm, logoImg, onProgress, cancelToken }
  const { canvas, frames, per, mime, wm, logoImg, onProgress, cancelToken, fit, bgCache } = opts;
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext("2d");
  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6000000 });
  const chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise(res => rec.onstop = () => res(new Blob(chunks, { type: mime })));
  rec.start(250);
  const fade = Math.min(700, per * 0.22);
  const total = per * frames.length;
  const t0 = performance.now();
  await new Promise(res => {
    const frame = () => {
      const t = performance.now() - t0;
      if (cancelToken && cancelToken.cancelled){ rec.stop(); res(); return; }   // Cancel button
      if (t >= total + 120){ rec.stop(); res(); return; }
      const idx = Math.min(frames.length - 1, Math.floor(t / per));
      const localT = t - idx*per;
      const local = Math.min(1, localT / per);
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
      if (idx > 0 && localT < fade){
        pvDrawPhoto(ctx, frames[idx-1].img, frames[idx-1].motion, 1, w, h, fit, bgCache && bgCache[idx-1], idx-1);
        ctx.save(); ctx.globalAlpha = localT / fade;
        pvDrawPhoto(ctx, frames[idx].img, frames[idx].motion, local, w, h, fit, bgCache && bgCache[idx], idx);
        ctx.restore();
      } else {
        pvDrawPhoto(ctx, frames[idx].img, frames[idx].motion, local, w, h, fit, bgCache && bgCache[idx], idx);
      }
      if (wm) pvPaintWatermark(ctx, w, h, wm, logoImg);
      if (onProgress) onProgress(Math.min(1, t / total));
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  return await stopped;
}

async function showPhotoToVideo(){
  let cancelToken = null;   // hoisted so Close can abort an in-flight render
  let items = [];
  try { items = (await mediaAll()).filter(m => !(m.type || "").startsWith("video")); }
  catch(e){ toast("Media library unavailable: " + e.message); return; }
  items.sort((a,b) => (b.added||0) - (a.added||0));
  const wmBase = (project && project.watermark && project.watermark.enabled) ? project.watermark
    : { text: "CONFIDENTIAL", logo: "s3", opacity: 0.12, angle: "diagonal", fontScale: 0.12, logoScale: 0.45, color: "#7a7a7a" };
  const cells = items.length ? items.map((m,i) =>
    `<div class="ml-cell pv-pick ${i===0?"sel":""}" data-id="${esc(m.id)}"><div class="ml-thumb"><img src="${mediaSrcOf(m)}"></div><div class="ml-nm">${esc((m.name||"photo").slice(0,22))}</div></div>`
  ).join("") : `<p style="color:var(--ink-dim);font-size:12.5px">No photos in the library yet \u2014 upload below.</p>`;
  showModal(`<h3>\u{1F3AC} Photo \u2192 Video</h3>
    <p>Pick one or more photos, choose a motion style \u2014 the clip is rendered in your browser and saved to the Media Library (downloadable MP4/WebM). Watermark is baked in.</p>
    <div class="ml-grid" id="pvGrid">${cells}</div>
    <div class="m-row"><span style="font-size:12px;color:var(--ink-dim);width:80px;flex-shrink:0">Motion</span>
      <select id="pvMotion" class="prop-select">
        <option value="walk" selected>Villa Walking (forward / backward)</option>
        <option value="zoomin">Zoom in</option><option value="zoomout">Zoom out</option>
        <option value="panright">Pan right</option><option value="panleft">Pan left</option><option value="panup">Pan up</option>
      </select></div>
    <div class="m-row"><span style="font-size:12px;color:var(--ink-dim);width:80px;flex-shrink:0">Per photo</span>
      <select id="pvPer" class="prop-select"><option value="3000">3 s</option><option value="5000" selected>5 s</option><option value="8000">8 s</option></select></div>
    <div class="m-row"><span style="font-size:12px;color:var(--ink-dim);width:80px;flex-shrink:0">Size</span>
      <select id="pvSize" class="prop-select">
        <option value="1280x720">1280\u00d7720 landscape</option>
        <option value="720x1280">720\u00d71280 vertical</option>
        <option value="1080x1080">1080\u00d71080 square</option>
      </select></div>
    <div class="m-row"><span style="font-size:12px;color:var(--ink-dim);width:80px;flex-shrink:0">Fit</span>
      <select id="pvFit" class="prop-select">
        <option value="blur" selected>Blurred background \u2014 no crop, no distortion</option>
        <option value="cover">Fill frame \u2014 crops edges</option>
      </select></div>
    <div class="m-row"><label style="font-size:12.5px;display:flex;gap:8px;align-items:center"><input type="checkbox" id="pvWm" checked> Bake watermark into the video</label></div>
    <div id="pvProg" style="display:none;margin:8px 0"><div style="height:8px;background:var(--bg2);border-radius:4px;overflow:hidden"><div id="pvBar" style="height:100%;width:0%;background:var(--accent)"></div></div><div id="pvPct" style="font-size:11px;color:var(--ink-dim);margin-top:4px">0%</div></div>
    <div id="pvResult"></div>
    <div class="m-actions" style="justify-content:space-between">
      <button class="abtn ghost" id="pvAdd">\u2b06 Upload photos</button>
      <span style="display:flex;gap:8px">
        <button class="abtn ghost" id="pvClose">\u2715 Close</button>
        <button class="abtn ghost" id="pvCancel" style="display:none">\u2715 Cancel</button>
        <button class="abtn primary" id="pvGo">\u25B6 Generate video</button></span></div>`);
  let selected = items.length ? [items[0].id] : [];
  $$("#pvGrid .pv-pick").forEach(cell => cell.onclick = () => {
    const id = cell.dataset.id;
    const at = selected.indexOf(id);
    if (at >= 0){ selected.splice(at,1); cell.classList.remove("sel"); }
    else { selected.push(id); cell.classList.add("sel"); }
  });
  $("#pvAdd").onclick = () => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*"; inp.multiple = true;
    inp.onchange = async () => {
      for (const f of inp.files){
        const src = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
        const rec = { id: uid(), name: f.name, type: f.type, data: src, added: Date.now() };
        await mediaPut(rec); items.push(rec); selected.push(rec.id);
      }
      closeModal(); showPhotoToVideo();
    };
    inp.click();
  };
  $("#pvGo").onclick = async () => {
    if (!selected.length){ toast("Select at least one photo"); return; }
    const mime = pvRecorderMime();
    if (!mime){ toast("No supported video codec in this browser"); return; }
    const photos = selected.map(id => items.find(m => m.id === id));
    const imgs = [];
    for (const p of photos){ const im = await loadImage(mediaSrcOf(p)); if (im) imgs.push(im); }
    if (!imgs.length){ toast("Could not load photos"); return; }
    const [w,h] = $("#pvSize").value.split("x").map(Number);
    const per = +$("#pvPer").value;
    const motionMode = $("#pvMotion").value;
    const fit = $("#pvFit").value;
    const useWm = $("#pvWm").checked;
    $("#pvProg").style.display = "block"; $("#pvGo").disabled = true;
    cancelToken = { cancelled: false };
    const cancelBtn = $("#pvCancel");
    cancelBtn.style.display = "";
    cancelBtn.onclick = () => { cancelToken.cancelled = true; toast("Cancelling\u2026"); };
    $("#pvClose").onclick = () => { cancelToken.cancelled = true; closeModal(); toast("Rendering cancelled \u2014 nothing was saved"); };
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const wm = useWm ? ((project && project.watermark && project.watermark.enabled) ? project.watermark
      : { text:"CONFIDENTIAL", logo:"s3", opacity:0.12, angle:"diagonal", fontScale:0.12, logoScale:0.45, color:"#7a7a7a" }) : null;
    let logoImg = null;
    if (wm){ const src = resolveWatermarkLogo(wm); if (src) logoImg = await loadImage(src); }
    const motions = motionMode === "walk"
      ? imgs.map((_,i) => i % 2 ? "walkback" : "walkfwd")
      : imgs.map(() => motionMode);
    const bgCache = {};
    if (fit === "blur") imgs.forEach((im, i) => { bgCache[i] = makeBlurredBg(im, w, h); });
    const blob = await pvRenderClip({ canvas, frames: imgs.map((im,i)=>({ img:im, motion:motions[i] })),
      per, mime, wm, logoImg, cancelToken, fit, bgCache,
      onProgress: p => {
        const bar = $("#pvBar"), pctEl = $("#pvPct");   // modal may be closed mid-render
        if (bar) bar.style.width = Math.round(p*100) + "%";
        if (pctEl) pctEl.textContent = Math.round(p*100) + "% \u2014 rendering in real time\u2026";
    } });
    cancelBtn.style.display = "none";
    const prog = $("#pvProg"); if (prog) prog.style.display = "none";
    if (cancelToken.cancelled){ const go = $("#pvGo"); if (go) go.disabled = false; toast("Rendering cancelled \u2014 nothing was saved"); return; }
    const ext = blob.type.includes("mp4") ? "mp4" : "webm";
    const name = `photo-video-${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.${ext}`;
    await mediaPut({ id: uid(), name, type: blob.type, blob, added: Date.now() });
    const res = $("#pvResult"), go = $("#pvGo");   // may be gone if modal was closed
    if (res){
      const url = URL.createObjectURL(blob);
      res.innerHTML = `<p style="font-size:12.5px;color:#4ad48a">\u2705 Saved to Media Library as <b>${esc(name)}</b> (${(blob.size/1048576).toFixed(1)} MB)</p>
        <video controls src="${url}" style="width:100%;max-height:280px;border-radius:8px;background:#000"></video>`;
    }
    if (go){ go.disabled = false; go.textContent = "\u25B6 Generate again"; }
    toast("Video generated and stored locally");
  };
}

/* ============================================================
   IMAGE CROP — drag-select crop applied as a true pixel crop.
   Works on any image element; undo restores the original.
   ============================================================ */
function showCropModal(el){
  if (!el || el.type !== "image"){ toast("Select an image first"); return; }
  const img = new Image();
  img.onload = () => openCropUI(el, img);
  img.onerror = () => toast("Could not load image for cropping");
  img.src = el.src;
}
function openCropUI(el, img){
  const maxW = 480;
  const scale = Math.min(1, maxW / img.width, 340 / img.height);
  const dw = Math.max(1, Math.round(img.width * scale));
  const dh = Math.max(1, Math.round(img.height * scale));
  showModal(`<h3>\u2702 Crop image</h3>
    <p>Drag on the image to select the region to keep, then apply. Undo (Ctrl+Z) restores the original.</p>
    <canvas id="cropCv" width="${dw}" height="${dh}" style="max-width:100%;cursor:crosshair;border:1px solid var(--line);border-radius:8px;display:block;margin:0 auto"></canvas>
    <div class="m-actions">
      <button class="abtn ghost" id="cropReset" style="margin-right:auto">Reset</button>
      <button class="abtn ghost" data-close>Cancel</button>
      <button class="abtn primary" id="cropApply">\u2702 Apply crop</button></div>`);
  const cv = $("#cropCv"), ctx = cv.getContext("2d");
  let rect = { x:0, y:0, w:dw, h:dh };
  let dragStart = null;
  function paint(){
    ctx.drawImage(img, 0, 0, dw, dh);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, dw, dh);
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fill("evenodd");
    ctx.restore();
    ctx.strokeStyle = "#7c5cff"; ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  }
  function toCanvas(e){
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (dw / r.width), y: (e.clientY - r.top) * (dh / r.height) };
  }
  function clampRect(x0, y0, x1, y1){
    const x = Math.max(0, Math.min(x0, x1)), y = Math.max(0, Math.min(y0, y1));
    return { x, y, w: Math.min(dw, Math.max(x0, x1)) - x, h: Math.min(dh, Math.max(y0, y1)) - y };
  }
  cv.addEventListener("mousedown", (e) => {
    e.preventDefault();
    dragStart = toCanvas(e);
    rect = { x: dragStart.x, y: dragStart.y, w: 0, h: 0 };
    paint();
    const mv = (ev) => { const p = toCanvas(ev); rect = clampRect(dragStart.x, dragStart.y, p.x, p.y); paint(); };
    const up = () => { dragStart = null; document.removeEventListener("mousemove", mv); document.removeEventListener("mouseup", up); };
    document.addEventListener("mousemove", mv);
    document.addEventListener("mouseup", up);
  });
  $("#cropApply").onclick = () => {
    if (rect.w < 4 || rect.h < 4){ toast("Drag a region on the image first"); return; }
    const sx = rect.x / scale, sy = rect.y / scale, sw = rect.w / scale, sh = rect.h / scale;
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(sw)); out.height = Math.max(1, Math.round(sh));
    out.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height);
    const type = el.src.startsWith("data:image/png") ? "image/png" : "image/jpeg";
    pushHistory();
    el.src = out.toDataURL(type, 0.92);
    refreshEl(el); closeModal();
    toast("Image cropped \u2014 " + out.width + "\u00d7" + out.height);
  };
  $("#cropReset").onclick = () => { rect = { x:0, y:0, w:dw, h:dh }; dragStart = null; paint(); };
  $$("#modalCard [data-close]").forEach(x => x.onclick = closeModal);
  paint();
}

/* ============================================================
   PDF WRITER — minimal PDF 1.4: each page embedded as a full-bleed
   JPEG (DCTDecode) on a page sized 0.75pt/px (96dpi → 72dpi).
   Binary-safe, correct xref offsets, no dependencies.
   ============================================================ */
function buildPdf(pages){
  const enc = new TextEncoder();
  const chunks = []; let offset = 0; const offs = [];
  const push = (data) => { const u8 = (typeof data === "string") ? enc.encode(data) : data; chunks.push(u8); offset += u8.length; };
  const W = (pages[0].w * 0.75).toFixed(2), H = (pages[0].h * 0.75).toFixed(2);
  const n = pages.length;
  const objBegin = (id) => { offs[id] = offset; push(id + " 0 obj\n"); };
  const objEnd = () => push("endobj\n");
  push("%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n");
  objBegin(1); push("<< /Type /Catalog /Pages 2 0 R >>\n"); objEnd();
  const kids = pages.map((_, i) => (3 + i*3) + " 0 R").join(" ");
  objBegin(2); push(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>\n`); objEnd();
  pages.forEach((pg, i) => {
    const pid = 3 + i*3, cid = 4 + i*3, iid = 5 + i*3;
    const ops = `q ${W} 0 0 ${H} 0 0 cm /Im${i} Do Q`;
    objBegin(cid); push(`<< /Length ${ops.length} >>\nstream\n${ops}\nendstream\n`); objEnd();
    objBegin(iid);
    push(`<< /Type /XObject /Subtype /Image /Width ${pg.w} /Height ${pg.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.jpeg.length} >>\nstream\n`);
    push(pg.jpeg);
    push("\nendstream\n"); objEnd();
    objBegin(pid); push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im${i} ${iid} 0 R >> >> /Contents ${cid} 0 R >>\n`); objEnd();
  });
  const xrefPos = offset;
  let xref = `xref\n0 ${3*n + 3}\n0000000000 65535 f \n`;
  for (let id = 1; id <= 3*n + 2; id++) xref += String(offs[id]).padStart(10, "0") + " 00000 n \n";
  push(xref);
  push(`trailer\n<< /Size ${3*n + 3} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);
  let totalLen = 0; chunks.forEach(c => totalLen += c.length);
  const outBuf = new Uint8Array(totalLen); let p = 0;
  chunks.forEach(c => { outBuf.set(c, p); p += c.length; });
  return outBuf;
}

/* ============================================================
   AI CREATE — text-to-image + animation hand-off.
   Offline tier: prompt-seeded procedural artwork (deterministic,
   keyword-driven palettes/scenes). Cloud tier: POST {endpoint}/api/image
   through the Oracle proxy (provider keys stay server-side).
   Generated art flows to: design canvas, Media Library, Photo→Video.
   ============================================================ */
function aiHash(str){
  let h = 2166136261;
  for (let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const AI_PALETTES = [
  { k:["sunset","dusk","evening","golden"],        sky:["#2b1f5c","#ff5e62","#ff9a56"], sun:"#ffd166", sil:"#241b3a" },
  { k:["ocean","sea","beach","water","wave"],      sky:["#1d3557","#457b9d","#a8dadc"], sun:"#f1faee", sil:"#16324f", waves:true },
  { k:["night","star","space","galaxy","moon"],    sky:["#0b1026","#1b2a4a","#101736"], sun:"#e8e8ff", sil:"#05070f", stars:130 },
  { k:["forest","tree","jungle","green","nature"], sky:["#1b4332","#95d5b2","#d8f3dc"], sun:"#ffe066", sil:"#081c15" },
  { k:["desert","sand","canyon","dune"],           sky:["#bc6c25","#fb8500","#ffb703"], sun:"#fff3b0", sil:"#3d2b1f" },
  { k:["neon","cyber","city","tech","future","synth"], sky:["#12002b","#2b0f54","#c300ff"], sun:"#00fff5", sil:"#0d0022", city:true, stars:70 },
  { k:["snow","winter","ice","arctic","frozen"],   sky:["#293241","#98c1d9","#e0fbfc"], sun:"#ffffff", sil:"#1b3a4b" },
  { k:["flower","garden","spring","pastel","rose"], sky:["#6d2336","#fb6f92","#ffe5ec"], sun:"#fff0f6", sil:"#40182a" },
];
const AI_DEFAULT_PALETTE = { sky:["#1b1035","#7c5cff","#ff5c8a"], sun:"#ffd479", sil:"#160f2e", stars:90 };

function aiPickPalette(prompt){
  const p = prompt.toLowerCase();
  return AI_PALETTES.find(pl => pl.k.some(k => p.includes(k))) || AI_DEFAULT_PALETTE;
}
function aiOfflineArtwork(prompt, w, h, variation){
  const seed = (aiHash(prompt.toLowerCase()) + variation * 7919) >>> 0;
  const rnd = mulberry32(seed);
  const pl = aiPickPalette(prompt);
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d");
  // sky gradient (lightest at horizon)
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, pl.sky[0]); sky.addColorStop(0.55, pl.sky[1]); sky.addColorStop(1, pl.sky[2]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  // stars
  if (pl.stars){
    for (let i = 0; i < pl.stars; i++){
      ctx.globalAlpha = 0.25 + rnd() * 0.75;
      ctx.fillStyle = "#ffffff";
      const r = rnd() * w * 0.0022 + 0.6;
      ctx.beginPath(); ctx.arc(rnd() * w, rnd() * h * 0.6, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // sun / moon with glow
  const sx = w * (0.2 + rnd() * 0.6), sy = h * (0.22 + rnd() * 0.2), sr = Math.min(w,h) * (0.05 + rnd() * 0.05);
  const glow = ctx.createRadialGradient(sx, sy, sr * 0.4, sx, sy, sr * 3.2);
  glow.addColorStop(0, pl.sun); glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = pl.sun; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
  // layered ridges / city / waves
  const layers = 3;
  for (let L = 0; L < layers; L++){
    ctx.globalAlpha = 0.45 + L * 0.28;
    ctx.fillStyle = pl.sil;
    const baseY = h * (0.52 + L * 0.14);
    if (pl.city){
      let x = -w * 0.02;
      while (x < w * 1.02){
        const bw = w * (0.03 + rnd() * 0.06), bh = h * (0.06 + rnd() * (0.24 - L * 0.06));
        ctx.fillRect(x, baseY - bh, bw, h - baseY + bh);
        x += bw + w * 0.004;
      }
    } else {
      ctx.beginPath(); ctx.moveTo(0, h);
      let x = 0;
      const amp = h * (0.16 - L * 0.04);
      ctx.lineTo(0, baseY);
      while (x < w){
        x += w / 14;
        ctx.lineTo(x, baseY - rnd() * amp);
      }
      ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  if (pl.waves){
    for (let L = 0; L < 3; L++){
      ctx.globalAlpha = 0.35 + L * 0.2;
      ctx.fillStyle = pl.sky[1];
      ctx.beginPath();
      const y0 = h * (0.72 + L * 0.09);
      ctx.moveTo(0, y0);
      for (let x = 0; x <= w; x += w / 40) ctx.lineTo(x, y0 + Math.sin((x / w) * Math.PI * (2 + L) + rnd() * 6) * h * 0.012);
      ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // floating particles
  for (let i = 0; i < 14; i++){
    ctx.globalAlpha = 0.15 + rnd() * 0.5;
    ctx.fillStyle = pl.sun;
    ctx.beginPath(); ctx.arc(rnd() * w, h * (0.3 + rnd() * 0.6), Math.min(w,h) * (0.002 + rnd() * 0.006), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // vignette
  const vg = ctx.createRadialGradient(w/2, h/2, Math.min(w,h) * 0.35, w/2, h/2, Math.max(w,h) * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  return cv.toDataURL("image/png");
}
async function aiCloudImage(prompt, size){
  const c = getAiCloud();
  if (!c.endpoint) throw new Error("Connect a cloud AI endpoint first (\u2601 Cloud AI settings)");
  const r = await fetch(c.endpoint.replace(/\/$/, "") + "/api/image", {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, c.key ? { "Authorization": "Bearer " + c.key } : {}),
    body: JSON.stringify({ prompt, size })
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const j = await r.json();
  if (j.image) return j.image;                    // dataURL from the proxy
  if (j.b64) return "data:image/png;base64," + j.b64;
  throw new Error("Unexpected response shape");
}

async function showAiCreate(){
  const cloud = getAiCloud();
  let lastArt = null, variation = 0, lastPrompt = "", lastSize = "1024x1024";
  showModal(`<h3>\u2728 AI Create — picture & animation</h3>
    <p>Describe the image you want. The <b>offline studio</b> renders prompt-seeded generative art instantly; the <b>cloud tier</b> produces photorealistic images once your Oracle proxy is connected.</p>
    <div class="m-row"><span style="font-size:12px;color:var(--ink-dim);width:80px;flex-shrink:0">Prompt</span>
      <input id="aiPrompt" placeholder="e.g. neon city at night \u00b7 ocean sunset \u00b7 snowy mountains\u2026"></div>
    <div class="m-row"><span style="font-size:12px;color:var(--ink-dim);width:80px;flex-shrink:0">Size</span>
      <select id="aiSize" class="prop-select"><option value="1024x1024">1024\u00d71024</option><option value="1280x720">1280\u00d7720</option><option value="720x1280">720\u00d71280</option></select></div>
    <div class="m-actions" style="justify-content:flex-start;flex-wrap:wrap">
      <button class="abtn primary" id="aiGo">\u2728 Generate (offline studio)</button>
      ${cloud.endpoint ? `<button class="abtn ghost" id="aiCloudGo">\u2601 Generate with cloud AI</button>` : `<button class="abtn ghost" id="aiCloudCfg">\u2601 Connect cloud AI\u2026</button>`}</div>
    <div id="aiPrevWrap" style="text-align:center;margin:10px 0"><img id="aiPrev" style="max-width:100%;max-height:300px;border-radius:10px;display:none"></div>
    <div class="m-actions" style="justify-content:flex-start;flex-wrap:wrap;display:none" id="aiActs">
      <button class="abtn ghost" id="aiIns" style="margin-right:auto">\u2795 Insert into design</button>
      <button class="abtn ghost" id="aiSave">\uD83D\uDCBE Save to Media Library</button>
      <button class="abtn primary" id="aiAnim">\uD83D\uDFAC Animate (Photo \u2192 Video)</button></div>
    <div class="m-actions"><button class="abtn ghost" data-close style="margin-left:auto">Close</button></div>`);
  const render = async (cloudMode) => {
    const prompt = ($("#aiPrompt").value || "").trim();
    if (!prompt){ toast("Describe what to create first"); return; }
    lastPrompt = prompt; lastSize = $("#aiSize").value;
    const [w, h] = lastSize.split("x").map(Number);
    const btn = cloudMode ? $("#aiCloudGo") : $("#aiGo");
    btn.disabled = true; const old = btn.textContent; btn.textContent = "\u23F3 Generating\u2026";
    try {
      lastArt = cloudMode ? await aiCloudImage(prompt, lastSize) : aiOfflineArtwork(prompt, w, h, variation++);
      const prev = $("#aiPrev"); prev.src = lastArt; prev.style.display = "";
      $("#aiActs").style.display = "flex";
    } catch(e){ toast("\u274C " + e.message); }
    btn.disabled = false; btn.textContent = old;
  };
  $("#aiGo").onclick = () => render(false);
  if ($("#aiCloudGo")) $("#aiCloudGo").onclick = () => render(true);
  if ($("#aiCloudCfg")) $("#aiCloudCfg").onclick = () => { closeModal(); showAiCloudSettings(); };
  const arm = (fn) => { if (lastArt) fn(); else toast("Generate an image first"); };
  $("#aiIns").onclick = () => arm(() => {
    closeModal(); pushHistory();
    const [w, h] = lastSize.split("x").map(Number);
    const el = { id: uid(), type: "image", x: Math.round(project.w*0.1), y: Math.round(project.h*0.1),
      w: Math.round(project.w*0.6), h: Math.round(project.w*0.6*(h/w)), src: lastArt, fit: "cover", radius: 0, opacity: 1, filter: "none" };
    curPageData().elements.push(el); select(el.id); renderBoard(); saveAutosave(); toast("AI artwork inserted");
  });
  $("#aiSave").onclick = () => arm(async () => {
    const r = await mediaStore({ id: uid(), name: `ai-${lastPrompt.slice(0,20).replace(/\W+/g,"-")}.png`, type: "image/png", data: lastArt, added: Date.now() });
    toast(r.stored ? (r.compressed ? "Saved (compressed to fit 2 MB)" : "Saved to Media Library") : r.reason);
  });
  $("#aiAnim").onclick = () => arm(async () => {
    await mediaStore({ id: uid(), name: `ai-${lastPrompt.slice(0,20).replace(/\W+/g,"-")}.png`, type: "image/png", data: lastArt, added: Date.now() });
    closeModal(); showPhotoToVideo();      // newest library item auto-selected
  });
  $$("#modalCard [data-close]").forEach(x => x.onclick = closeModal);
}

function duplicatePage(){
  if (!project) return;
  pushHistory();
  const clonePage = JSON.parse(JSON.stringify(curPageData()));
  (clonePage.elements || []).forEach(el => { el.id = uid(); });
  project.pages.splice(curPage + 1, 0, clonePage);
  curPage++;
  selId = null;
  renderBoard(); renderPages(); renderProps(); saveAutosave();
  toast("Page duplicated \u2014 now editing the copy");
}

/* ============================================================
   COMMUNITY REPOSITORY — "created by u" shared gallery for ALL members.
   Foldered: 🖼 Images · 🎬 Animated · ✨ Templates (per category).
   Superuser moderates. Stored in localStorage (aura.community);
   AuraDB cloud tier syncs it across devices in Phase III.
   ============================================================ */
const COMM_LS = "aura.community";
function commAll(){ try { return JSON.parse(localStorage.getItem(COMM_LS) || "[]"); } catch(e){ return []; } }
function commSave(a){ localStorage.setItem(COMM_LS, JSON.stringify(a.slice(0, 500))); }
async function publishToCommunity(rec){
  const a = commAll();
  a.unshift({ id: uid(), kind: "media", name: rec.name || "asset", type: rec.type || "image/png",
    data: rec.data || rec.src || "", blob: rec.blob || null,
    by: currentUser() || "Guest", added: Date.now() });
  commSave(a);
  toast("Published to the community repository — created by " + (currentUser() || "Guest"));
}
function publishCommunityTemplate(tpl, by){
  const a = commAll();
  a.unshift({ id: uid(), kind: "template", name: tpl.name, by: by || (currentUser() || "Guest"),
    added: Date.now(), tpl: JSON.parse(JSON.stringify(tpl)) });
  commSave(a);
}
function commClassOf(m){
  if (m.kind === "template") return "template";
  const t = m.type || "";
  if (t.indexOf("audio") === 0) return "audio";
  if (t.indexOf("video") === 0 || m.blob || t === "image/gif") return "animated";
  return "image";
}
function commTemplateCell(m){
  const canDelete = isSuperuser() || m.by === (currentUser() || "Guest");
  return '<div class="ml-cell"><div class="ml-thumb" style="font-size:26px">✨</div>' +
    '<div class="ml-nm">' + (m.name || "template").slice(0, 26) + '</div>' +
    '<div class="ml-by">created by <b>' + (m.by || "unknown").replace(/</g, "&lt;") + '</b></div>' +
    '<div class="ml-ops"><button data-use="1" title="Open as a new design">▶ Use</button>' +
    '<button data-dl="1" title="Download template .json">⬇</button>' +
    (canDelete ? '<button data-del="1" title="Remove">✕</button>' : '') + '</div></div>';
}
function commMediaCell(m, su, me){
  const isAud = (m.type || "").indexOf("audio") === 0;
  const isVid = (m.type || "").indexOf("video") === 0 || !!m.blob;
  const icon = isAud ? "🔊" : isVid ? "📽️" : "";
  const canDelete = su || m.by === me;
  return '<div class="ml-cell" data-id="' + m.id + '">' +
    '<div class="ml-thumb">' + (icon ? '<span style="font-size:26px">' + icon + '</span>' : '<img src="' + (m.data || "") + '" alt="">') + '</div>' +
    '<div class="ml-nm">' + (m.name || "asset").slice(0, 22) + '</div>' +
    '<div class="ml-by">created by <b>' + (m.by || "unknown") + '</b></div>' +
    '<div class="ml-ops">' + (isVid || isAud ? "" : '<button data-ins="1" title="Insert into page">➕</button>') +
    '<button data-dl="1" title="Download">⬇</button>' +
    (canDelete ? '<button data-del="1" title="Remove">✕</button>' : '') + '</div></div>';
}
function showCommunityRepo(){
  const items = commAll().sort((a,b) => (b.added||0) - (a.added||0));
  const su = isSuperuser();
  const me = currentUser() || "Guest";
  const groups = { image: [], animated: [], audio: [], template: [] };
  items.forEach(m => groups[commClassOf(m)].push(m));
  const view = (window.__commView || (window.__commView = { tab: "images", cat: "all" }));
  const tab = view.tab;
  const cats = [["all","All categories"]].concat(CATS.map(c => [c.id, c.icon + " " + c.name]));
  const catSel = tab === "templates"
    ? '<div class="m-row"><span style="font-size:12px;color:var(--ink-dim);width:110px;flex-shrink:0">Category</span>' +
      '<select id="commCat" class="prop-select">' + cats.map(c =>
        '<option value="' + c[0] + '"' + (view.cat === c[0] ? " selected" : "") + '>' + c[1] + '</option>').join("") + '</select></div>'
    : "";
  const list = tab === "templates"
    ? groups.template.filter(m => view.cat === "all" || (m.tpl && m.tpl.cat === view.cat))
    : tab === "animated" ? groups.animated.concat(groups.audio)
    : groups.image;
  const cell = (m) => tab === "templates" ? commTemplateCell(m) : commMediaCell(m, su, me);
  const empty = (msg) => '<p style="color:var(--ink-dim);font-size:12.5px">' + msg + '</p>';
  const body = list.length ? list.map(cell).join("")
    : empty(tab === "templates" ? "No community templates in this category yet — seed the bundled suite from the Admin Agent (superuser)."
      : tab === "animated" ? "No animated assets yet — generate one with Photo → Video."
      : "No images yet — publish from the Media Library (🌐 button).");
  showModal('<h3>🌐 Community repository — "created by u"</h3>' +
    '<p>Shared by <b>all members</b> — every item credited to its maker. Shared assets are name-attributed and copyright-protected. Royalties accrue through VMSB LLP. Content stored on the Oracle database remains strictly your property. *Rules and regulations apply.' +
    (su ? ' You have <b>superuser</b> moderation rights.' : '') + '</p>' +
    '<div class="pj-tabs">' +
    '<button data-folder="images" class="' + (tab === "images" ? "on" : "") + '">🖼 Images (' + groups.image.length + ')</button>' +
    '<button data-folder="animated" class="' + (tab === "animated" ? "on" : "") + '">🎬 Animated (' + (groups.animated.length + groups.audio.length) + ')</button>' +
    '<button data-folder="templates" class="' + (tab === "templates" ? "on" : "") + '">✨ Templates (' + groups.template.length + ')</button></div>' +
    catSel +
    '<div class="ml-grid" id="commGrid">' + body + '</div>' +
    '<div class="m-actions"><button class="abtn primary" data-close style="margin-left:auto">Done</button></div>');
  $$("#modalCard [data-folder]").forEach(b => b.onclick = () => { view.tab = b.dataset.folder; showCommunityRepo(); });
  const catSelEl = document.getElementById("commCat");
  if (catSelEl) catSelEl.onchange = () => { view.cat = catSelEl.value; showCommunityRepo(); };
  $$("#commGrid .ml-cell").forEach(cellEl => {
    const id = cellEl.dataset.id;
    const rec = list.find(m => m.id === id);
    const use = cellEl.querySelector("[data-use]"), dl = cellEl.querySelector("[data-dl]"), del = cellEl.querySelector("[data-del]");
    if (tab === "templates" && use) use.onclick = () => {
      if (!rec.tpl || !rec.tpl.pages){ toast("Template data missing"); return; }
      closeModal();
      project = hydrate(JSON.parse(JSON.stringify(rec.tpl)));
      project.name = (rec.tpl.name || "Community template") + " — by " + rec.by;
      project.cat = rec.tpl.cat || "community";
      curPage = 0; selId = null; undoStack = []; redoStack = [];
      openEditor(); saveAutosave();
      toast("Opened community template — by " + rec.by);
    };
    if (tab !== "templates" && ins) ins.onclick = () => {
      closeModal(); pushHistory();
      const el = { id: uid(), type: "image", x: Math.round(project.w*0.2), y: Math.round(project.h*0.2),
        w: Math.round(project.w*0.6), h: Math.round(project.h*0.4), src: rec.data || "", fit: "cover", radius: 0, opacity: 1, filter: "none" };
      curPageData().elements.push(el); select(el.id); renderBoard(); saveAutosave();
      toast("Inserted from community repository");
    };
    if (dl) dl.onclick = () => {
      const a = document.createElement("a");
      a.href = rec.blob ? URL.createObjectURL(rec.blob) : (rec.data || "");
      a.download = rec.name || "asset"; a.click();
    };
    if (del) del.onclick = () => { commSave(commAll().filter(m => m.id !== id)); showCommunityRepo(); };
  });
  $$("#modalCard [data-close]").forEach(x => x.onclick = closeModal);
}

/* expose for admin page debugging */
if (typeof window !== "undefined"){ window.__aura = { APP_VERSION, LS, allTemplates }; }
