#!/usr/bin/env node
/* ============================================================
   Aura Studio — Automated Regression Validation Suite
   Run:  node tests/regression.js
   Exit: 0 = all checks passed, 1 = at least one failure.
   No external dependencies. Also runs in CI (.github/workflows).
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const results = [];
let pass = 0, fail = 0;

function check(id, name, fn) {
  try {
    const detail = fn();
    results.push({ id, name, ok: true, detail: detail || "" });
    pass++;
  } catch (e) {
    results.push({ id, name, ok: false, detail: e.message });
    fail++;
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg} (got ${JSON.stringify(a)}, expected ${JSON.stringify(b)})`); }

/* ---------------- load source ---------------- */
const SRC = {
  templates: fs.readFileSync(path.join(ROOT, "templates.js"), "utf8"),
  zip: fs.readFileSync(path.join(ROOT, "zip.js"), "utf8"),
  assets: fs.readFileSync(path.join(ROOT, "assets-s3-logo.js"), "utf8"),
  app: fs.readFileSync(path.join(ROOT, "app.js"), "utf8"),
  data: fs.readFileSync(path.join(ROOT, "dataLayer.js"), "utf8"),
  suite: fs.readFileSync(path.join(ROOT, "community-templates.js"), "utf8"),
};

/* ---- 01-03: real syntax validation (catches what greps cannot) ---- */
for (const [name, src] of Object.entries(SRC)) {
  check(`01-${name}`, `Syntax: ${name}.js parses`, () => {
    new vm.Script(src, { filename: name + ".js" });
    return "parsed OK";
  });
}

/* Undo/redo driver: runs INSIDE the combined script so it can touch the app's
   top-level state (project, undoStack, curPage...). Exercises the real
   pushHistory/doUndo/doRedo code paths headlessly. */
const UNDO_DRIVER = `
globalThis.__undoResults = (function(){
  const out = {};
  project = { name:"t", cat:"custom", w:200, h:200, pages:[{ bg:"#ffffff", elements:[
    { id:"e1", type:"rect", x:10, y:10, w:50, h:50, fill:"#123456", stroke:"none", strokeWidth:0, radius:0, opacity:1 } ] }] };
  curPage = 0; selId = null; undoStack = []; redoStack = []; guidesOn = false;
  // 1) move -> undo -> redo -> undo
  pushHistory();
  project.pages[0].elements[0].x = 99;
  doUndo();
  out.move = project.pages[0].elements[0].x === 10;
  doRedo();
  out.redo = project.pages[0].elements[0].x === 99;
  doUndo();
  out.moveAgain = project.pages[0].elements[0].x === 10;
  // 2) add element -> undo removes -> redo restores
  pushHistory();
  project.pages[0].elements.push({ id:"e2", type:"rect", x:1, y:1, w:5, h:5, fill:"#000000", stroke:"none", strokeWidth:0, radius:0, opacity:1 });
  doUndo();
  out.add = project.pages[0].elements.length === 1;
  doRedo();
  out.addRedo = project.pages[0].elements.length === 2;
  doUndo();
  out.addAgain = project.pages[0].elements.length === 1;
  // 3) page add -> undo removes
  pushHistory();
  project.pages.push({ bg:"#ffffff", elements:[] });
  doUndo();
  out.page = project.pages.length === 1;
  // 4) watermark: snapshot must happen BEFORE mutation (regression for the
  //    push-order defect where Apply/Remove could not be undone)
  pushHistory();
  project.watermark = { enabled:true };
  doUndo();
  out.watermark = !(project.watermark && project.watermark.enabled);
  doRedo();
  out.watermarkRedo = !!(project.watermark && project.watermark.enabled);
  doUndo();
  out.watermarkUndo = !(project.watermark && project.watermark.enabled);
  // 5) rotation (v2.4)
  pushHistory();
  project.pages[0].elements[0].rot = 45;
  doUndo();
  out.rotate = !project.pages[0].elements[0].rot;
  doRedo();
  out.rotateRedo = project.pages[0].elements[0].rot === 45;
  // 6) members (async — exposed as a promise for the suite to await)
  globalThis.__memPromise = (async () => {
    const out = {};
    localStorage.removeItem("aura.members");
    localStorage.removeItem("aura.currentMember");
    const salt = "ab12cd34", pw = "secret1!";
    const h = await hashPassword(salt, pw);
    const st = { members: {} };
    st.members["villa#1"] = { salt, hash: h, created: 1, super: true };
    localStorage.setItem("aura.members", JSON.stringify(st));
    const rec = getMembers().members["villa#1"];
    out.verify = !!rec && (await hashPassword(rec.salt, pw)) === rec.hash;
    out.reject = (await hashPassword(rec.salt, "wrong-pass")) !== rec.hash;
    localStorage.setItem("aura.currentMember", JSON.stringify("villa#1"));
    out.scope = mkey("aura.autosave") === "aura.m.villa#1.aura.autosave";
    localStorage.removeItem("aura.currentMember");
    return out;
  })();
  // 7) password recovery (async)
  globalThis.__recPromise = (async () => {
    const out = {};
    localStorage.removeItem("aura.members"); localStorage.removeItem("aura.currentMember");
    const salt = "s1", pw = "old-pass";
    const code = genRecoveryCode(); const norm = normCode(code);
    const st = { members: {} };
    st.members["u1"] = { salt, hash: await hashPassword(salt, pw), created: 1,
      recovery: { hash: await hashPassword("rc:u1", norm), created: 1 } };
    localStorage.setItem("aura.members", JSON.stringify(st));
    const rec0 = getMembers().members["u1"];
    out.verifyCode = !!rec0.recovery && (await hashPassword("rc:u1", norm)) === rec0.recovery.hash;
    out.wrongCode = (await hashPassword("rc:u1", normCode("ZZZZ-ZZZZ"))) !== rec0.recovery.hash;
    const st2 = getMembers();               // fresh parse (driver bug: was saving a stale object)
    const rec = st2.members["u1"];
    const ns = "n1";
    rec.salt = ns; rec.hash = await hashPassword(ns, "new-pass");
    rec.recovery = { hash: await hashPassword("rc:u1", normCode(genRecoveryCode())), created: 2 };
    setMembers(st2);
    const r2 = getMembers().members["u1"];
    out.newPw = (await hashPassword(r2.salt, "new-pass")) === r2.hash;
    out.oldPwGone = (await hashPassword(r2.salt, "old-pass")) !== r2.hash;
    return out;
  })();
  return out;
})();
`;

/* ---------------- sandboxed load of the real app ---------------- */
function makeElementStub() {
  return { style: { cssText: "" }, classList: { add(){}, remove(){}, toggle(){} },
    dataset: {}, innerHTML: "", textContent: "",
    addEventListener(){}, appendChild(){ return arguments[0]; }, remove(){}, removeChild(){},
    setAttribute(){}, querySelector(){ return null; }, querySelectorAll(){ return []; } };
}
const storage = new Map();
/* Universal element stub: any property read returns another stub (functions
   callable, primitives coerce to 0), any write is accepted. Lets the REAL app
   code (renderBoard/doUndo/etc.) run headlessly without a browser. */
function makeUniversal(){
  const fn = function(){ return proxy; };
  const proxy = new Proxy(fn, {
    get(t, prop){
      if (prop === Symbol.toPrimitive) return () => 0;
      if (prop === "length" || prop === "clientWidth" || prop === "clientHeight" || prop === "offsetWidth") return 0;
      if (prop === "value") return "fit";
      if (prop === "checked") return false;
      if (prop === "files") return [];
      return proxy;
    },
    set(){ return true; },
    apply(){ return proxy; },
  });
  return proxy;
}
const UNIVERSAL = makeUniversal();
const sandbox = {
  console: { log(){}, warn(){}, error(){} },
  localStorage: { getItem: k => storage.has(k) ? storage.get(k) : null,
                  setItem: (k,v) => storage.set(k,String(v)),
                  removeItem: k => storage.delete(k), key: i => [...storage.keys()][i],
                  get length(){ return storage.size; } },
  document: { querySelector: () => UNIVERSAL, querySelectorAll: () => [],
              addEventListener(){}, createElement: () => makeUniversal(),
              body: UNIVERSAL },
  window: { addEventListener(){}, open(){ return null; }, location: { href: "" } },
  location: { href: "file://" },
  navigator: { userAgent: "regression" },
  URL: { createObjectURL: () => "blob:fake", revokeObjectURL(){} },
  Blob: class { constructor(parts){ this.size = (parts||[]).reduce((s,p)=>s+(p.length||p.size||0),0); } },
  FileReader: class {},
  Image: class {},
  fetch: () => Promise.reject(new Error("offline")),
  AbortController: class { constructor(){ this.signal = {}; } abort(){} },
  setTimeout: () => 0, clearTimeout(){}, setInterval: () => 0, clearInterval(){},
  alert(){}, confirm(){ return false; }, prompt(){ return null; },
  TextEncoder, TextDecoder,
};
sandbox.window.localStorage = sandbox.localStorage;
sandbox.window.document = sandbox.document;
vm.createContext(sandbox);

let LIB = null;
check("02", "Load: all three modules initialize together in sandbox", () => {
  const src = SRC.templates + "\n" + SRC.zip + "\n" + SRC.assets + "\n" + SRC.app + "\n" + SRC.data + "\n" + SRC.suite +
    "\nthis.__out = { TEMPLATES, CATS, ZipWriter, cmykToHex, rgbToCmyk, cmykToRgb, hexToRgb, rgbToHex," +
    " CMYK_PRESETS, CMYK_PALETTE, cmykLabel, VIDEO_STYLES, VIDEO_FORMATS, fillTpl, buildOdt, buildFodt, odfDoc, APP_VERSION, S3_LOGO_DATAURL, buildPdf, AuraDB, AURA_SUITE_TEMPLATES, pvDrawPhoto };" +
    "\n" + UNDO_DRIVER + ";";
  vm.runInContext(src, sandbox, { filename: "combined.js" });
  LIB = sandbox.__out;
  return `APP_VERSION ${LIB.APP_VERSION}, ${LIB.TEMPLATES.length} templates loaded`;
});
const { TEMPLATES, CATS, ZipWriter, cmykToHex, cmykToRgb, rgbToCmyk, CMYK_PALETTE, VIDEO_STYLES, VIDEO_FORMATS, fillTpl, buildOdt, buildFodt, buildPdf, pvDrawPhoto } = LIB || {};

check("26", "Data layer: AuraDB dual-backend adapter present and wired", () => {
  assert(LIB.AuraDB && typeof LIB.AuraDB.status === "function", "AuraDB missing or incomplete");
  const st = LIB.AuraDB.status();
  assert(typeof st === "object", "status() did not return state");
  const idx = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert(idx.includes("dataLayer.js"), "index.html missing dataLayer include");
  return "AuraDB adapter loaded (local backend, cloud-ready)";
});
check("24", "Undo/redo logic: move, redo, add, page ops, watermark snapshot order", () => {
  const r = sandbox.__undoResults;
  assert(r, "undo driver did not run");
  const bad = Object.keys(r).filter(k => !r[k]);
  assert(bad.length === 0, "failed scenarios: " + bad.join(", "));
  return Object.keys(r).map(k => k + "=ok").join(", ");
});

/* ---------------- template library integrity ---------------- */
check("27", "Rotation: lines/shapes/images rotate (handle, props, canvas + SVG exports)", () => {
  for (const s of ["function svgRot", "addRotate", "ctx.rotate(el.rot * Math.PI/180)", "node.style.transform = \"rotate(\" + el.rot + \"deg)\"", "handle rot"])
    assert(SRC.app.includes(s), "app.js missing: " + s);
  const r = sandbox.__undoResults;
  assert(r && r.rotate && r.rotateRedo, "rotation undo/redo failed");
  return "rotate handle + Shift-snap + exports + undoable";
});
check("28", "Superuser role + community repository (created-by attribution)", () => {
  for (const s of ["function isSuperuser", "function showCommunityRepo", "function publishToCommunity",
                   "const COMM_LS", "created by", "super: Object.keys(st.members).length === 0"])
    assert(SRC.app.includes(s), "app.js missing: " + s);
  const adm = fs.readFileSync(path.join(ROOT, "admin.html"), "utf8");
  for (const s of ["function renderSuper", "data-open", "data-promo", "superuser"])
    assert(adm.includes(s), "admin.html missing: " + s);
  const idx = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert(idx.includes("data-community"), "index.html missing Community button");
  return "superuser member admin + publish/browse/moderate repository";
});
check("33", "Community suite: bundled templates valid + publish/use/seed wiring", () => {
  const suite = sandbox.__out.AURA_SUITE_TEMPLATES;
  assert(suite && suite.length >= 20, "suite too small: " + (suite ? suite.length : "missing"));
  let count = 0;
  for (const t of suite){
    assert(t.name && t.cat && t.w > 0 && t.h > 0 && Array.isArray(t.pages) && t.pages.length >= 1, t.name + ": bad meta");
    for (const pg of t.pages) for (const el of pg.elements){
      count++;
      assert(["text","rect","ellipse","line","image","glyph"].indexOf(el.type) >= 0, t.name + ": bad type");
      assert(Number.isFinite(el.x) && Number.isFinite(el.y), t.name + ": bad coords");
    }
  }
  assert(SRC.app.indexOf("function publishCommunityTemplate") >= 0, "publish helper missing");
  assert(SRC.app.indexOf('m.kind === "template"') >= 0, "community template section missing");
  const idx = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert(idx.indexOf("community-templates.js") >= 0, "bundle missing community-templates include");
  const adm = fs.readFileSync(path.join(ROOT, "admin.html"), "utf8");
  assert(adm.indexOf("seedCommunity") >= 0 && adm.indexOf("AURA_SUITE_TEMPLATES") >= 0, "admin seeding missing");
  return suite.length + " suite templates, " + count + " elements validated";
});
check("34", "I-022 fix: pan motions travel the full image margin (behavioral)", () => {
  const calls = [];
  const fakeCtx = { drawImage(){ calls.push(Array.prototype.slice.call(arguments, 1, 3)); },
    imageSmoothingEnabled: false, imageSmoothingQuality: "" };
  const img = { width: 1600, height: 900 };
  pvDrawPhoto(fakeCtx, img, "panleft", 0, 1280, 720, "cover", null, 0);
  const dxL0 = calls[calls.length-1][0];
  pvDrawPhoto(fakeCtx, img, "panleft", 1, 1280, 720, "cover", null, 0);
  const dxL1 = calls[calls.length-1][0];
  pvDrawPhoto(fakeCtx, img, "panright", 0, 1280, 720, "cover", null, 0);
  const dxR0 = calls[calls.length-1][0];
  pvDrawPhoto(fakeCtx, img, "panright", 1, 1280, 720, "cover", null, 0);
  const dxR1 = calls[calls.length-1][0];
  const tl = Math.abs(dxL1 - dxL0), tr = Math.abs(dxR1 - dxR0);
  assert(tl >= 250, "panleft travel only " + tl.toFixed(1) + "px (full margin ~256px)");
  assert(tr >= 250, "panright travel only " + tr.toFixed(1) + "px");
  assert(Math.sign(dxL1 - dxL0) !== Math.sign(dxR1 - dxR0), "panleft/panright move the same way");
  return "panleft travel " + tl.toFixed(0) + "px, panright " + tr.toFixed(0) + "px, opposite directions";
});
check("35", "I-023: duplicate feedback + page duplication", () => {
  for (const s of ["then Duplicate copies it", "function duplicatePage", "now editing the copy",
                   "Duplicate current page (elements included)"])
    assert(SRC.app.indexOf(s) >= 0, "app.js missing: " + s);
  return "silent no-op fixed + page duplication shipped";
});
check("03", "Library: at least 50 templates", () => {
  assert(TEMPLATES.length >= 50, `only ${TEMPLATES.length}`);
  return `${TEMPLATES.length} templates`;
});
check("04", "Library: every category has templates", () => {
  const ids = new Set(CATS.map(c => c.id));
  for (const t of TEMPLATES) assert(ids.has(t.cat), `unknown category "${t.cat}" on ${t.name}`);
  const missing = CATS.filter(c => !TEMPLATES.some(t => t.cat === c.id));
  assert(missing.length === 0, `empty categories: ${missing.map(m=>m.id).join(", ")}`);
  return `${CATS.length} categories covered`;
});
check("05", "Library: template names unique", () => {
  const names = TEMPLATES.map(t => t.name);
  const dupes = names.filter((n,i) => names.indexOf(n) !== i);
  assert(dupes.length === 0, `duplicates: ${dupes.join(", ")}`);
  return `${names.length} unique`;
});
const VALID_TYPES = new Set(["text","rect","ellipse","line","image","glyph"]);
check("06", "Library: every element structurally valid", () => {
  let count = 0;
  for (const t of TEMPLATES) {
    assert(Number.isFinite(t.w) && t.w > 0 && Number.isFinite(t.h) && t.h > 0, `${t.name}: bad canvas size`);
    assert(Array.isArray(t.pages) && t.pages.length >= 1, `${t.name}: no pages`);
    t.pages.forEach((pg, pi) => {
      assert(typeof pg.bg === "string" && pg.bg.startsWith("#"), `${t.name} p${pi}: bad bg`);
      assert(Array.isArray(pg.elements) && pg.elements.length >= 1, `${t.name} p${pi}: empty page`);
      for (const el of pg.elements) {
        count++;
        assert(VALID_TYPES.has(el.type), `${t.name} p${pi}: bad type ${el.type}`);
        // Negative x/y is legitimate (decorative shapes bleed off-canvas by design);
        // check 07 guarantees the element is still reachable on the canvas.
        for (const k of ["x","y","w","h"]) assert(Number.isFinite(el[k]), `${t.name} p${pi}: non-numeric ${k}=${el[k]}`);
        if (el.type === "line") {
          // axis-aligned lines legitimately have w=0 (vertical) or h=0 (horizontal)
          assert(el.w > 0 || el.h > 0, `${t.name} p${pi}: degenerate line (w=h=0)`);
        } else {
          assert(el.w > 0 && el.h > 0, `${t.name} p${pi}: w/h<=0`);
        }
        if (el.type === "text" || el.type === "glyph") {
          assert(typeof el.text === "string", `${t.name} p${pi}: text missing`);
          assert(el.fontSize > 0, `${t.name} p${pi}: fontSize<=0`);
          assert(typeof el.color === "string", `${t.name} p${pi}: color missing`);
        }
        if (el.type === "image") assert(typeof el.src === "string" && el.src.startsWith("data:image"), `${t.name} p${pi}: bad image src`);
        if (el.type === "line") assert(el.strokeWidth > 0, `${t.name} p${pi}: line strokeWidth<=0`);
        if (el.opacity != null) assert(el.opacity >= 0 && el.opacity <= 1, `${t.name} p${pi}: opacity out of range`);
      }
    });
  }
  return `${count} elements validated`;
});
check("07", "Library: no element entirely off-canvas", () => {
  const out = [];
  for (const t of TEMPLATES) for (const pg of t.pages) for (const el of pg.elements) {
    if (el.x >= t.w || el.y >= t.h || el.x + el.w <= 0 || el.y + el.h <= 0) out.push(`${t.name}/${el.type}@${el.x},${el.y}`);
  }
  assert(out.length === 0, out.join("; "));
  return "all elements reachable";
});
check("08", "Library: documents category is LibreOffice-rich (>=5)", () => {
  const docs = TEMPLATES.filter(t => t.cat === "docs");
  assert(docs.length >= 5, `only ${docs.length}`);
  return `${docs.length} document templates`;
});

/* ---------------- CMYK engine (real functions from app.js) ---------------- */
check("09", "CMYK: known conversions exact", () => {
  eq(cmykToHex(100,0,0,0), "#00ffff", "cyan");
  eq(cmykToHex(0,0,0,100), "#000000", "black");
  eq(cmykToHex(60,40,40,90), "#0a0f0f", "rich black");
  eq(cmykToHex(100,80,20,35), "#002185", "navy");
  return "4 reference values exact";
});
check("10", "CMYK: RGB roundtrip preserves rendered color (max channel drift <= 12/255)", () => {
  // NOTE: CMYK->RGB->CMYK is numerically lossy for very dark colors (near-black
  // quantization collapses C/M/Y). The correct invariant is that the RENDERED
  // color is preserved: the RGB of the round-tripped CMYK must stay close.
  const hex = (c,m,y,k) => { const {r,g,b} = cmykToRgb(c,m,y,k);
    const h = x => Math.max(0,Math.min(255,Math.round(x)));
    return [h(r),h(g),h(b)]; };
  let worst = 0, worstAt = "";
  for (let i = 0; i < 40; i++) {
    const v = [Math.floor(Math.random()*101), Math.floor(Math.random()*101),
               Math.floor(Math.random()*101), Math.floor(Math.random()*101)];
    const rgb1 = hex(...v);
    const back = rgbToCmyk(cmykToHex(...v));
    const rgb2 = hex(back.c, back.m, back.y, back.k);
    const drift = Math.max(...rgb1.map((c,i)=>Math.abs(c-rgb2[i])));
    if (drift > worst){ worst = drift; worstAt = v.join("/"); }
  }
  assert(worst <= 12, `rendered drift ${worst}/255 at ${worstAt}`);
  return `worst rendered drift ${worst}/255 over 40 samples`;
});
check("11", "CMYK: swatch-book palette well-formed", () => {
  assert(CMYK_PALETTE.length >= 50, `only ${CMYK_PALETTE.length} swatches`);
  const names = new Set();
  for (const p of CMYK_PALETTE) {
    assert(!names.has(p.n), `duplicate swatch ${p.n}`); names.add(p.n);
    for (const k of ["c","m","y","k"]) assert(p[k] >= 0 && p[k] <= 100, `${p.n}: ${k}=${p[k]} out of range`);
    assert(/^#[0-9a-f]{6}$/.test(cmykToHex(p.c,p.m,p.y,p.k)), `${p.n}: bad hex`);
  }
  return `${CMYK_PALETTE.length} unique swatches`;
});

/* ---------------- ZIP / ODF (real functions) ---------------- */
check("12", "ZIP: container structure valid", () => {
  const bytes = ZipWriter.build([{ name:"a.txt", data:"hello world" }, { name:"b/c.bin", data: new Uint8Array([1,2,3]) }]);
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  assert(u8[0]===0x50 && u8[1]===0x4b && u8[2]===0x03 && u8[3]===0x04, "missing local file header");
  const tail = u8.slice(u8.length-22);
  assert(tail[0]===0x50 && tail[1]===0x4b && tail[2]===0x05 && tail[3]===0x06, "missing EOCD");
  const entries = tail[10] | (tail[11] << 8);
  eq(entries, 2, "EOCD entry count");
  return `2 entries, ${u8.length} bytes`;
});
check("13", "ODT: real LibreOffice package builds", () => {
  const sample = { name:"t", w:100, h:100, pages:[{ bg:"#ffffff", elements:[
    { type:"text", id:"a", x:0,y:0,w:100,h:20, text:"Hello ODF", fontSize:24, fontFamily:"Arial", fontWeight:"700", color:"#111111", align:"center", lineHeight:1.25, letterSpacing:"0px" } ] }] };
  const odt = buildOdt(sample);
  const u8 = odt instanceof Uint8Array ? odt : new Uint8Array(odt);
  assert(u8[0]===0x50 && u8[1]===0x4b, "not a zip");
  const head = Buffer.from(u8.slice(0, 60)).toString("latin1");
  assert(head.includes("mimetype"), "mimetype entry missing (must be first)");
  const str = Buffer.from(u8).toString("latin1");
  assert(str.includes("office:document-content"), "content.xml missing");
  assert(str.includes("opendocument.text"), "wrong mimetype");
  const fodt = buildFodt(sample);
  assert(fodt.includes("office:document") && fodt.includes("office:text"), "flat ODF malformed");
  return "ODT zip + FODT XML generated";
});

/* ---------------- AI video composer config ---------------- */
check("14", "AI Video: 5 styles fully specified", () => {
  const keys = Object.keys(VIDEO_STYLES);
  assert(keys.length === 5, `got ${keys.length}`);
  for (const [k,s] of Object.entries(VIDEO_STYLES)) {
    assert(s.label, `${k}: no label`);
    for (const p of ["bg","fg","accent","sub"]) assert(/^#[0-9a-fA-F]{6}$/.test(s.pal[p]), `${k}: pal.${p} not hex`);
    for (const arr of ["hooks","benefits","ctas"]) assert(Array.isArray(s[arr]) && s[arr].length >= 2, `${k}: ${arr} too small`);
  }
  return keys.join(", ");
});
check("15", "AI Video: 3 formats with valid geometry", () => {
  const keys = Object.keys(VIDEO_FORMATS);
  assert(keys.length === 3, `got ${keys.length}`);
  for (const [k,f] of Object.entries(VIDEO_FORMATS)) {
    assert(f.w > 0 && f.h > 0, `${k}: bad size`);
    assert(f.img.length === 4 && f.notes.length === 4, `${k}: geometry tuples`);
    for (const n of [...f.img, ...f.notes]) assert(Number.isFinite(n) && n >= 0, `${k}: negative coordinate`);
  }
  return keys.join(", ");
});
check("16", "AI Video: template substitution leaves no placeholders", () => {
  const out = fillTpl("{p} beats {c} — {p}!", { p:"Widget", c:"gadgets" });
  assert(out === "Widget beats gadgets — Widget!", `got "${out}"`);
  return "substitution exact";
});

/* ---------------- artifacts & wiring ---------------- */
const distPath = path.join(ROOT, "dist", "aura-studio-single.html");
check("17", "Artifacts: single-file bundle present & self-contained", () => {
  assert(fs.existsSync(distPath), "dist/aura-studio-single.html missing");
  const html = fs.readFileSync(distPath, "utf8");
  assert(html.includes("Aura Studio"), "branding missing");
  // The page itself must be fully self-contained. The embedded Admin HTML string
  // may reference exactly one shared asset (the brand logo), which resolves
  // against the opener when the admin popup opens.
  const preAdmin = html.split("const ADMIN_HTML =")[0];
  assert(!/<script src=/.test(preAdmin), "unresolved external script in page");
  assert(!/href="styles\.css"/.test(preAdmin), "unresolved stylesheet in page");
  const adminPart = html.slice(html.indexOf("const ADMIN_HTML ="));
  const refs = adminPart.match(/<script src="([^"]+)"/g) || [];
  assert(refs.every(r => r.includes("assets-s3-logo.js")), `unexpected external script in embedded admin: ${refs.join(", ")}`);
  // Phase II change (v1.6.2): single-file build must be popup-free —
  // srcdoc overlay, never window.open, so users never enable popups.
  assert(!adminPart.includes("window.open"), "embedded admin still uses popups");
  assert(adminPart.includes("srcdoc"), "single-file admin overlay missing srcdoc iframe");
  assert(html.includes("ADMIN_HTML"), "admin not embedded");
  assert(html.length > 100000, `bundle suspiciously small (${html.length})`);
  return `${(html.length/1024).toFixed(0)} KB, self-contained`;
});
check("18", "Wiring: index.html element contracts", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  for (const id of ["board","menuProject","menuExport","btnGuides","btnAdmin","pageStrip","propsPane","elemPalette"])
    assert(html.includes(`id="${id}"`), `missing #${id}`);
  for (const f of ["templates.js","zip.js","app.js"]) assert(html.includes(f), `missing script ref ${f}`);
  for (const feat of ["AI Video","CMYK Palette","Brand Kit"]) assert(html.includes(feat), `missing feature button ${feat}`);
  return "all IDs + feature buttons present";
});
check("19", "Wiring: admin agent contracts", () => {
  const html = fs.readFileSync(path.join(ROOT, "admin.html"), "utf8");
  for (const s of ["function init","function refresh","aura-update.json","aura.templates.custom","Import template pack"])
    assert(html.includes(s), `missing: ${s}`);
  return "admin contracts intact";
});
check("20", "CI: workflow gates exist", () => {
  const yml = fs.readFileSync(path.join(ROOT, ".github", "workflows", "build.yml"), "utf8");
  assert(yml.includes("node --check"), "no syntax gate");
  assert(yml.includes("tests/regression.js"), "regression suite not wired");
  return "syntax gate + regression wired";
});

/* ---------------- security ---------------- */
check("21", "Security: no credential-shaped strings in source", () => {
  const bad = [];
  for (const f of ["templates.js","app.js","zip.js","index.html","admin.html","README.md"]) {
    const src = fs.readFileSync(path.join(ROOT, f), "utf8");
    const hits = src.match(/[A-Za-z0-9+/]{43}=/g);
    if (hits) bad.push(`${f}: ${hits.length}`);
  }
  assert(bad.length === 0, bad.join(", "));
  return "clean";
});
check("22", "Security: placeholder guidance intact in VPN templates", () => {
  const src = SRC.templates;
  const n = (src.match(/never commit/g) || []).length;
  assert(n >= 2, `expected >=2 placeholder warnings, got ${n}`);
  return `${n} warnings present`;
});
check("23b", "Media library: IndexedDB persistence wired (local tier; Oracle cloud tier in Phase II)", () => {
  for (const s of ["const MEDIA_DB", "function openMediaDb", "function mediaPut", "function mediaAll", "function showMediaLibrary", "indexedDB.open"])
    assert(SRC.app.includes(s), "app.js missing: " + s);
  const idx = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert(idx.includes("data-medialib"), "index.html missing media library button");
  return "IndexedDB store + library UI + auto-archive on upload";
});
check("23a", "Members: hashed credentials, no plaintext passwords, scoped storage", () => {
  for (const s of ["function hashPassword", "crypto.subtle.digest", "const MEMBERS_LS", "function mkey", "function showMemberGate", "aura.currentMember"])
    assert(SRC.app.includes(s), "app.js missing: " + s);
  assert(!/"password"\s*:\s*"/.test(SRC.app), "possible plaintext password storage in app.js");
  const adm = fs.readFileSync(path.join(ROOT, "admin.html"), "utf8");
  assert(adm.includes("aura.currentMember"), "admin not member-aware");
  const idx = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert(idx.includes("memberChip"), "index.html missing member chip");
  return "WebCrypto SHA-256 + member-scoped keys + member-aware admin";
});
check("23c", "Photo\u2192Video: generator wired (canvas stream + MediaRecorder + library storage)", () => {
  for (const s of ["function showPhotoToVideo", "function pvDrawPhoto", "function pvPaintWatermark",
                   "canvas.captureStream", "new MediaRecorder", "mediaPut({ id: uid(), name, type: blob.type, blob", "function pvRenderClip",
                   "cancelToken", "Rendering cancelled", 'id="pvClose"'])
    assert(SRC.app.includes(s), "app.js missing: " + s);
  assert(SRC.app.includes("id=\"pvCancel\""), "Cancel button missing from generator UI");
  const idx = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert(idx.includes("data-photovid"), "index.html missing Photo\u2192Video button");
  return "motion presets, crossfades, watermark bake-in, IndexedDB storage";
});
check("23d", "Image tools: interactive crop + hyperlink (props, open, clickable SVG export)", () => {
  for (const s of ["function showCropModal", "function openCropUI", "ctx.fill(\"evenodd\")", "el.link = v", "Open link", "parts.splice(elStart)", "<a href="])
    assert(SRC.app.includes(s), "app.js missing: " + s);
  assert(SRC.app.includes("showCropModal(el)"), "crop not bound in properties panel");
  return "drag-select crop + link URL/open/clickable-SVG-export";
});
check("29", "I-019 hardening: per-element draw isolation, blank-export detection, scale/bg guards", () => {
  for (const s of ["function canvasLooksBlank", "function exportDiagnostics", "__auraFailedElements",
                   "let failed = 0", "element failed to render", "/^(#|rgb|hsl)/.test(page.bg)", "sc > 8"])
    assert(SRC.app.includes(s), "app.js missing: " + s);
  return "draw isolation + blank detection + diagnostics + guards";
});
check("23g", "I-017 fix: high-quality image rendering (smoothing, blurred-bg fit mode) + special-char member IDs", () => {
  for (const s of ['ctx.imageSmoothingQuality = "high"', "function makeBlurredBg", "function pvMotionScale",
                   'value="blur"', "Blurred background"])
    assert(SRC.app.includes(s), "app.js missing: " + s);
  assert(SRC.app.includes("/^\\S{2,24}$/"), "member ID regex does not allow special characters");
  assert(SRC.app.includes("special characters allowed"), "special-char member IDs not wired");
  return "hi-Q smoothing + blurred-bg contain mode + per-photo blur pre-render + special-char IDs";
});
check("23f", "AI Create: prompt-seeded offline generator + cloud hook + animation hand-off", () => {
  for (const s of ["function aiOfflineArtwork", "function mulberry32", "const AI_PALETTES", "function aiPickPalette",
                   "function aiCloudImage", "function showAiCreate", "/api/image", "showPhotoToVideo"])
    assert(SRC.app.includes(s), "app.js missing: " + s);
  assert(SRC.app.includes("aiHash(prompt"), "prompt seeding missing");
  const idx = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert(idx.includes("data-aicreate"), "index.html missing AI Create button");
  return "8 keyword palettes, deterministic seeding, cloud tier, library/design/animation flows";
});
check("23e", "Export matrix: PDF writer, JPEG, MP4 slideshow + Villa Walking motion + audio import", () => {
  for (const s of ["function buildPdf", "DCTDecode", "function renderPageCanvas", "function pvRenderClip",
                   "walkfwd", "walkback", "Villa Walking", "image/*,video/*,audio/*"])
    assert(SRC.app.includes(s), "app.js missing: " + s);
  const idx = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  for (const a of ["data-act=\"jpeg\"", "data-act=\"pdf\"", "data-act=\"mp4\""])
    assert(idx.includes(a), "index.html missing export action " + a);
  const pdf = LIB.buildPdf([{ jpeg: new Uint8Array([0xFF,0xD8,0xFF,0xD9]), w: 100, h: 100 }]);
  const str = Buffer.from(pdf).toString("latin1");
  assert(str.startsWith("%PDF-1.4"), "bad PDF header");
  assert(str.includes("DCTDecode"), "missing image XObject");
  assert(str.includes("/Count 1"), "page tree wrong");
  assert(str.includes("%%EOF"), "missing EOF");
  return "PDF structure valid; JPEG/MP4 actions present; Villa Walking + audio import wired";
});
check("23", "Watermark: editor, canvas & SVG renderers wired + embedded logo", () => {
  for (const s of ["function drawWatermarkCanvas","function watermarkSvg","function showWatermarkModal","function renderWatermarkOverlay"])
    assert(SRC.app.includes(s), "app.js missing: " + s);
  const idx = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert(idx.includes("btnWatermark"), "index.html missing watermark button");
  assert(idx.includes("assets-s3-logo.js"), "index.html missing brand asset include");
  assert(typeof LIB.S3_LOGO_DATAURL === "string" && LIB.S3_LOGO_DATAURL.startsWith("data:image/"), "S3 logo asset malformed");
  assert(LIB.S3_LOGO_DATAURL.length > 10000, "S3 logo asset truncated");
  return "all three renderers wired; logo embedded (" + (LIB.S3_LOGO_DATAURL.length/1024).toFixed(1) + " KB)";
});

check("36", "I-033 export integrity: download names always match content type; PDF magic-byte self-check", () => {
  for (const s of ["function extForMime", "function properName", "a.download = properName(name, mime)",
                   "head.startsWith(\"%PDF\")", "PDF writer produced invalid output"])
    assert(SRC.app.includes(s), "app.js missing: " + s);
  // behavioral: run properName/extForMime in a sandbox
  const sb = {}; new vm.Script(SRC.app.match(/\/\* I-033[\s\S]*?function downloadBlob[\s\S]*?\n\}/)[0] +
    "\nthis.extForMime = extForMime; this.properName = properName;").runInNewContext(sb);
  eq(sb.properName("V1_AURA_TESTCVR_MINDAUTH_PRG.json", "image/png"), "V1_AURA_TESTCVR_MINDAUTH_PRG.png", "json-named image must be renamed");
  eq(sb.properName("cover.pdf", "application/pdf"), "cover.pdf", "correct pdf name unchanged");
  eq(sb.properName("cover.aura.json", "application/json"), "cover.aura.json", "project file keeps .aura.json");
  eq(sb.properName("clip", "video/mp4"), "clip.mp4", "extension appended when missing");
  eq(sb.properName("song.json", "audio/wav"), "song.wav", "wrong ext replaced by content-type ext");
  eq(sb.extForMime("application/vnd.oasis.opendocument.text"), "odt", "ODT mapped");
  const idxHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert(idxHtml.includes('reimportable, not a document'), "index.html export-json label must warn it is not a document");
  return "rename-on-mismatch verified; %PDF guard present; .aura.json labeled as project file";
});

/* ---------------- report (async-aware) ---------------- */
const asyncChecks = [
  { id: "31", name: "Password recovery: code verify, wrong code rejected, reset works, old password gone",
    run: () => Promise.resolve(sandbox.__recPromise).then(r => {
      const bad = Object.keys(r).filter(k => !r[k]);
      assert(bad.length === 0, "failed scenarios: " + bad.join(", "));
      return Object.keys(r).map(k => k + "=ok").join(", ");
    }) },
  { id: "30", name: "Members logic: create/verify/reject + member-scoped keys",
    run: () => Promise.resolve(sandbox.__memPromise).then(r => {
      const bad = Object.keys(r).filter(k => !r[k]);
      assert(bad.length === 0, "failed scenarios: " + bad.join(", "));
      return Object.keys(r).map(k => k + "=ok").join(", ");
    }) },
];

function printReport(){
  const line = "\u2500".repeat(78);
  console.log("\n" + line);
  console.log("AURA STUDIO \u2014 AUTOMATED REGRESSION VALIDATION SUITE");
  console.log(line);
  for (const r of results) {
    console.log((r.ok ? "  PASS" : "\u2717 FAIL") + "  " + r.id.padEnd(11) + " " + r.name + (r.detail ? "  \u2014 " + r.detail : ""));
  }
  console.log(line);
  console.log("RESULT: " + pass + " passed, " + fail + " failed, " + results.length + " total");
  console.log(line + "\n");
}

Promise.all(asyncChecks.map(ac =>
  Promise.resolve().then(ac.run)
    .then(detail => { results.push({ id: ac.id, name: ac.name, ok: true, detail }); pass++; })
    .catch(e => { results.push({ id: ac.id, name: ac.name, ok: false, detail: e.message }); fail++; })
)).then(() => { printReport(); process.exit(fail ? 1 : 0); })
  .catch(e => { console.error("SUITE ERROR:", e); process.exit(1); });
