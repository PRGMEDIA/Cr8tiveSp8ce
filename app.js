/* ============================================================
   Aura Studio — Application Engine
   Gallery, editor, exporters, storage. No external dependencies.
   ============================================================ */
"use strict";

const APP_VERSION = "1.3.0";
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
  try { return JSON.parse(localStorage.getItem(LS.brand) || "") || { colors:[], font:"", logo:"" }; }
  catch(e){ return { colors:[], font:"", logo:"" }; }
}
function setBrand(b){ localStorage.setItem(LS.brand, JSON.stringify(b)); }
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

function toast(msg, ms=2200){
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(()=>t.classList.remove("show"), ms);
}

/* ---------------- boot ---------------- */
window.addEventListener("DOMContentLoaded", () => {
  buildCategoryRail();
  renderGallery();
  bindTopbar();
  bindPalette();
  bindKeyboard();
  restoreAutosave();
  window.addEventListener("resize", applyZoom);
});

function restoreAutosave(){
  try {
    const raw = localStorage.getItem(LS.autosave);
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
  p.pages.forEach(pg => pg.elements.forEach(el => { if(!el.id) el.id = uid(); }));
  return p;
}

/* ---------------- all templates (builtin + custom) ---------------- */
function allTemplates(){
  let custom = [];
  try { custom = JSON.parse(localStorage.getItem(LS.customTpl) || "[]"); } catch(e){}
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
  applyZoom();
}

function buildElNode(el, interactive){
  const d = document.createElement("div");
  d.className = "el" + (interactive ? "" : " static");
  d.style.left = el.x+"px"; d.style.top = el.y+"px";
  d.style.width = el.w+"px"; d.style.height = el.h+"px";
  d.style.opacity = el.opacity != null ? el.opacity : 1;
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
  if (el.type === "line") return;
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
}

/* ---------- text editing ---------- */
function startTextEdit(el, node){
  pushHistory();
  const board = $("#board");
  const ta = document.createElement("textarea");
  ta.id = "el-textarea";
  ta.value = el.text || "";
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
    addSwatches(row, body, (c)=>{ pushHistory(); pg.bg = c; pg.cmyk = rgbToCmyk(c); renderBoard(); renderPages(); saveAutosave(); });
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
    addSwatches(rc, g2, (c)=>{ pushHistory(); el.color = c; el.cmyk = rgbToCmyk(c); refreshEl(el); });
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
    addSwatches(rc, g3, (c)=>{ pushHistory(); el.fill = c; el.cmyk = rgbToCmyk(c); refreshEl(el); });
    addCmykRow(rc, g3, ()=> el.cmyk || rgbToCmyk(el.fill||"#222222"),
      (v)=>{ pushHistory(); el.fill = cmykToHex(v.c,v.m,v.y,v.k); el.cmyk = v; refreshEl(el); });
    const rs = row(g3, "Stroke", `<input type="color" class="prop-input" value="${(el.stroke&&el.stroke[0]==="#")?el.stroke.slice(0,7):"#000000"}">`);
    bind(rs, "input", "input", (e)=>{ pushHistory(); el.stroke = e.target.value; el.cmyk = rgbToCmyk(el.stroke); refreshEl(el); });
    addSwatches(rs, g3, (c)=>{ pushHistory(); el.stroke = c; el.cmyk = rgbToCmyk(c); refreshEl(el); });
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
    const rf2 = row(g4, "Fit", `<select class="prop-select">${["cover","contain","fill"].map(f=>`<option ${el.fit===f?"selected":""}>${f}</option>`).join("")}</select>`);
    bind(rf2, "select", "change", (e)=>{ pushHistory(); el.fit = e.target.value; refreshEl(el); });
    const rflt = row(g4, "Filter", `<select class="prop-select">${IMG_FILTERS.map(f=>`<option value="${f.v}" ${(el.filter||"none")===f.v?"selected":""}>${f.n}</option>`).join("")}</select>`);
    bind(rflt, "select", "change", (e)=>{ pushHistory(); el.filter = e.target.value; refreshEl(el); });
    const rr = row(g4, "Radius", `<input type="number" class="prop-input" value="${el.radius||0}">`);
    bind(rr, "input", "change", (e)=>{ pushHistory(); el.radius = +e.target.value||0; refreshEl(el); });
  }

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
  if (node){ node.style.left=el.x+"px"; node.style.top=el.y+"px"; node.style.width=el.w+"px"; node.style.height=el.h+"px"; fillNode(node, el); }
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
  const el = selElement(); if (!el) return;
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
  try { localStorage.setItem(LS.autosave, JSON.stringify(project)); $("#saveState").textContent = "Saved"; }
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
  $("#btnAdmin").onclick = ()=> window.open("admin.html", "_blank");
  $("#searchBox").addEventListener("input", doSearch);

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
    if (act==="help") showHelp();
  });

  $("#menuExport").addEventListener("click", async (e)=>{
    const act = e.target.dataset.act; if(!act || !project) return;
    $$(".dropdown").forEach(d=>d.classList.remove("open"));
    try {
      if (act==="png"){ const blob = await renderPagePng(curPageData(), 2); downloadBlob(blob, pageFile("png"), "image/png"); toast("PNG exported"); }
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
        <div class="chip" style="background:${cmykToHex(p.c,p.m,p.y,p.k)}"></div>
        <div class="nm">${esc(p.n)}</div>
        <div class="rc">${p.c}\u00b7${p.m}\u00b7${p.y}\u00b7${p.k}</div>
      </div>`).join("") : `<div style="color:var(--ink-dim);font-size:12.5px">No swatches match \u201c${esc(q)}\u201d \u2014 try a name or four numbers.</div>`;
    $$("#cmkGrid .cmyk-cell").forEach(cell => cell.onclick = ()=>{
      const p = CMYK_PALETTE[+cell.dataset.i];
      apply({ c:p.c, m:p.m, y:p.y, k:p.k });
      toast(`${p.n} \u2014 ${cmykLabel(p)}`);
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
  r.querySelectorAll(".sw").forEach(s=> s.onclick = ()=> apply(s.dataset.c));
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

function bindPalette(){
  $$("#elemPalette .pal-btn").forEach(b=>{
    if (b.dataset.brand){ b.onclick = showBrandKit; return; }
    if (b.dataset.cmykpal){ b.onclick = ()=> openCmykPalette(null); return; }
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

async function renderPagePng(page, scale){
  const c = document.createElement("canvas");
  c.width = project.w * scale; c.height = project.h * scale;
  const ctx = c.getContext("2d");
  ctx.scale(scale, scale);
  // preload images
  const imgs = {};
  await Promise.all(page.elements.filter(e=>e.type==="image").map(async e=>{ imgs[e.id] = await loadImage(e.src); }));
  drawPage(ctx, page, imgs);
  return new Promise(res => c.toBlob(res, "image/png"));
}

function drawPage(ctx, page, imgs){
  ctx.fillStyle = page.bg || "#fff";
  ctx.fillRect(0,0,project.w,project.h);
  for (const el of page.elements){
    ctx.save();
    ctx.globalAlpha = el.opacity != null ? el.opacity : 1;
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
    ctx.restore();
  }
}

function renderPageSvg(page){
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${project.w}" height="${project.h}" viewBox="0 0 ${project.w} ${project.h}">`);
  parts.push(`<rect width="100%" height="100%" fill="${page.bg||"#fff"}"/>`);
  const meas = document.createElement("canvas").getContext("2d");
  for (const el of page.elements){
    const op = el.opacity != null ? el.opacity : 1;
    if (el.type==="rect"){
      parts.push(`<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="${el.radius||0}" fill="${el.fill&&el.fill!=="none"?el.fill:"none"}" stroke="${el.stroke&&el.stroke!=="none"?el.stroke:"none"}" stroke-width="${el.strokeWidth||0}" opacity="${op}"${cmykAttr(el)}/>`);
    } else if (el.type==="ellipse"){
      parts.push(`<ellipse cx="${el.x+el.w/2}" cy="${el.y+el.h/2}" rx="${el.w/2}" ry="${el.h/2}" fill="${el.fill&&el.fill!=="none"?el.fill:"none"}" stroke="${el.stroke&&el.stroke!=="none"?el.stroke:"none"}" stroke-width="${el.strokeWidth||0}" opacity="${op}"${cmykAttr(el)}/>`);
    } else if (el.type==="line"){
      const horiz = (el.y2a-el.y1)<2;
      if (horiz) parts.push(`<rect x="${el.x}" y="${el.y+(el.h-el.strokeWidth)/2}" width="${el.w}" height="${el.strokeWidth}" fill="${el.stroke}" opacity="${op}"/>`);
      else parts.push(`<rect x="${el.x+(el.w-el.strokeWidth)/2}" y="${el.y}" width="${el.strokeWidth}" height="${el.h}" fill="${el.stroke}" opacity="${op}"/>`);
    } else if (el.type==="image"){
      parts.push(`<clipPath id="c${el.id}"><rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="${el.radius||0}"/></clipPath>`+
        `<image href="${el.src}" x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" preserveAspectRatio="${el.fit==="contain"?"xMidYMid meet":"xMidYMid slice"}" clip-path="url(#c${el.id})" opacity="${op}" style="filter:${el.filter||'none'}"/>`);
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
        parts.push(`<text x="${ax}" y="${el.y + i*lh + (el.fontSize||24)}" text-anchor="${anchor}" ${style}${cmykAttr(el)}>${esc(line)}</text>`);
      });
    }
  }
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

/* expose for admin page debugging */
if (typeof window !== "undefined"){ window.__aura = { APP_VERSION, LS, allTemplates }; }
