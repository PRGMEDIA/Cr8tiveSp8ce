/* ============================================================
   Aura Studio — Template Library
   Every template is pure data: pages -> elements.
   Element types: text, rect, ellipse, line, image, glyph
   ============================================================ */
"use strict";

const TEMPLATES = [];
const CATS = [
  { id:"social",       name:"Social Media",      icon:"📱" },
  { id:"magazine",     name:"Magazine",          icon:"📰" },
  { id:"books",        name:"Books",             icon:"📚" },
  { id:"docs",         name:"Documents (ODF)",   icon:"📄" },
  { id:"presentation", name:"Presentations",     icon:"🖥" },
  { id:"logos",        name:"Logos",             icon:"✒️" },
  { id:"posters",      name:"Posters",           icon:"🖼" },
  { id:"video",        name:"Marketing Videos",  icon:"🎬" },
  { id:"collages",     name:"Photo Collages",    icon:"🎞" },
  { id:"marketing",    name:"Print & Marketing", icon:"📣" },
];

/* ---------- tiny builders ---------- */
const T = (x,y,w,h,text,o={}) => ({type:"text",x,y,w,h,text,
  fontSize:o.fs||24, fontFamily:o.ff||"Georgia, 'Times New Roman', serif",
  fontWeight:o.fw||"400", color:o.c||"#111", align:o.al||"left",
  italic:o.it||false, uppercase:o.up||false, lineHeight:o.lh||1.25,
  letterSpacing:(o.ls||0)+"px", opacity:(o.op!=null?o.op:1)});
const R = (x,y,w,h,o={}) => ({type:"rect",x,y,w,h,fill:o.f||"#222",
  stroke:o.s||"none",strokeWidth:o.sw||0,radius:o.r||0,opacity:(o.op!=null?o.op:1)});
const EL = (x,y,w,h,o={}) => ({type:"ellipse",x,y,w,h,fill:o.f||"#222",
  stroke:o.s||"none",strokeWidth:o.sw||0,opacity:(o.op!=null?o.op:1)});
const LN = (x,y,x2,y2,o={}) => ({type:"line",x,y,w:Math.abs(x2-x),h:Math.abs(y2-y),
  x1:Math.min(x,x2),y1:Math.min(y,y2),x2a:Math.max(x,x2),y2a:Math.max(y,y2),
  stroke:o.s||"#111",strokeWidth:o.sw||2,opacity:(o.op!=null?o.op:1)});
const IM = (x,y,w,h,label,c1,c2,o={}) => ({type:"image",x,y,w,h,
  src:ph(w,h,label||"Image",c1||"#aab6ff",c2||"#7c5cff"),fit:"cover",radius:o.r||0,opacity:(o.op!=null?o.op:1)});
const GL = (x,y,w,h,ch,o={}) => ({type:"glyph",x,y,w,h,ch,fontSize:o.fs||64,color:o.c||"#111",opacity:(o.op!=null?o.op:1)});

function ph(w,h,label,c1,c2){
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <circle cx="${w*0.5}" cy="${h*0.42}" r="${Math.min(w,h)*0.13}" fill="rgba(255,255,255,0.35)"/>
  <rect x="${w*0.5-Math.min(w,h)*0.24}" y="${h*0.62}" width="${Math.min(w,h)*0.48}" height="${Math.min(w,h)*0.06}" rx="${Math.min(w,h)*0.03}" fill="rgba(255,255,255,0.45)"/>
  <text x="50%" y="50%" font-family="Segoe UI,Arial" font-size="${Math.max(12,Math.min(w,h)*0.075)}" fill="#fff" text-anchor="middle" dominant-baseline="middle" font-weight="600">${label}</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
function tpl(cat,name,desc,w,h,pages,tags){
  TEMPLATES.push({id:cat+"-"+TEMPLATES.length, cat, name, desc, w, h, pages, tags:(tags||"").toLowerCase()});
}

/* ============================================================
   SOCIAL MEDIA
   ============================================================ */
tpl("social","Bold Gradient Post","Instagram square promo",800,800,[
 {bg:"#0f0c29",elements:[
   EL(-160,-200,520,520,{f:"#7c5cff",op:.5}), EL(500,540,440,440,{f:"#ff5c8a",op:.45}),
   R(70,150,660,4,{f:"#fff"}),
   T(70,230,660,60,"SUMMER DROP",{fs:22,ff:"Arial, sans-serif",fw:"800",c:"#ffd479",ls:"6",al:"center"}),
   T(70,300,660,180,"The New\nCollection",{fs:76,ff:"'Segoe UI', Arial, sans-serif",fw:"800",c:"#fff",al:"center",lh:1.1}),
   T(70,500,660,40,"Up to 40% off — this week only",{fs:24,ff:"Arial, sans-serif",c:"#e8e8ff",al:"center"}),
   R(280,590,240,64,{f:"#fff",r:32}), T(280,608,240,34,"SHOP NOW",{fs:20,ff:"Arial",fw:"700",c:"#0f0c29",al:"center"}),
   T(70,700,660,30,"@yourbrand  •  yourbrand.com",{fs:16,ff:"Arial",c:"#9aa0c7",al:"center"})
 ]}],"instagram post promo sale");

tpl("social","Minimal Quote Story","Vertical story with serif quote",720,1280,[
 {bg:"#f4efe7",elements:[
   R(60,60,600,1160,{f:"none",s:"#c9a24b",sw:2}),
   GL(320,240,80,80,"❝",{fs:90,c:"#c9a24b"}),
   T(110,380,500,320,"Simplicity is the ultimate sophistication.",{fs:52,ff:"Georgia, serif",it:true,c:"#2b2b2b",al:"center",lh:1.3}),
   LN(300,760,420,760,{s:"#c9a24b",sw:3}),
   T(110,800,500,50,"— LEONARDO DA VINCI",{fs:20,ff:"Arial",fw:"600",c:"#7a6a45",al:"center",ls:"3"}),
   T(110,1080,500,40,"Swipe up for the full story",{fs:16,ff:"Arial",c:"#9a8f7d",al:"center"})
 ]}],"instagram story quote minimal");

tpl("social","Facebook Page Cover","Header banner for business pages",1120,416,[
 {bg:"#0b3d91",elements:[
   R(0,0,1120,416,{f:"#0b3d91"}), R(760,0,360,416,{f:"#1252c4"}),
   EL(950,-90,260,260,{f:"#4d8dff",op:.4}),
   T(70,110,620,70,"Northwind Coffee Co.",{fs:46,ff:"Georgia, serif",fw:"700",c:"#fff"}),
   T(70,200,620,44,"Fresh roasts, delivered weekly to your door.",{fs:22,ff:"Arial",c:"#cfe0ff"}),
   R(70,280,200,56,{f:"#ffb703",r:28}), T(70,296,200,34,"Order online",{fs:19,ff:"Arial",fw:"700",c:"#3b2600",al:"center"}),
   GL(830,120,90,90,"☕",{fs:80,c:"#fff"})
 ]}],"facebook cover banner business");

tpl("social","Pinterest Pin — Recipe","Tall pin with hero image",600,900,[
 {bg:"#fff8f0",elements:[
   IM(40,40,520,430,"Food photo","#ffb36b","#ff7b54",{r:16}),
   T(40,510,520,120,"5-Ingredient\nLemon Pasta",{fs:44,ff:"Georgia, serif",fw:"700",c:"#3d2b1f",lh:1.15}),
   R(40,660,120,4,{f:"#ff7b54"}),
   T(40,690,520,60,"Ready in 20 minutes • Vegetarian",{fs:20,ff:"Arial",c:"#8a6f5c"}),
   T(40,780,520,60,"Get the full recipe at the link below 👇",{fs:22,ff:"Arial",fw:"600",c:"#3d2b1f"})
 ]}],"pinterest recipe food pin");

tpl("social","YouTube Thumbnail","High contrast click-worthy title",960,540,[
 {bg:"#111",elements:[
   IM(540,0,420,540,"Host photo","#ff5c8a","#7c5cff"),
   R(0,0,560,540,{f:"#111",op:.85}),
   T(50,90,480,90,"I BUILT",{fs:64,ff:"'Arial Black', Arial",fw:"900",c:"#ffd400",lh:1.05}),
   T(50,190,480,180,"A $10,000\nGAMING PC",{fs:64,ff:"'Arial Black', Arial",fw:"900",c:"#fff",lh:1.05}),
   R(50,410,220,52,{f:"#ff0033",r:6}), T(50,422,220,32,"FULL BUILD",{fs:22,ff:"Arial",fw:"800",c:"#fff",al:"center"})
 ]}],"youtube thumbnail video gaming");

tpl("social","X / Twitter Post","Clean announcement card",800,450,[
 {bg:"#15202b",elements:[
   EL(50,50,80,80,{f:"#7c5cff"}), T(50,72,80,40,"A",{fs:36,ff:"Arial",fw:"800",c:"#fff",al:"center"}),
   T(150,58,300,36,"Aura Labs",{fs:22,ff:"Arial",fw:"700",c:"#fff"}),
   T(150,96,300,28,"@auralabs · 2h",{fs:16,ff:"Arial",c:"#8899a6"}),
   T(50,170,700,80,"v2.0 is here — collaborative boards, offline mode, and 3× faster exports. 🚀",{fs:26,ff:"Arial",c:"#e1e8ed",lh:1.4}),
   R(50,300,340,110,{f:"#1e2f42",s:"#38444d",sw:1,r:12}),
   T(70,318,300,30,"aura.studio/blog",{fs:15,ff:"Arial",c:"#8899a6"}),
   T(70,346,300,44,"Introducing Aura Studio 2.0",{fs:19,ff:"Arial",fw:"600",c:"#e1e8ed",lh:1.2})
 ]}],"twitter x announcement post");

/* ============================================================
   MAGAZINE
   ============================================================ */
tpl("magazine","Modern Magazine Cover","Bold editorial cover",850,1100,[
 {bg:"#f5f1ea",elements:[
   IM(0,300,850,800,"Cover model","#d8c7b0","#8a7355"),
   T(60,50,730,110,"AURORA",{fs:96,ff:"Georgia, serif",fw:"700",c:"#1a1a1a",ls:"18",al:"center"}),
   LN(60,180,790,180,{s:"#1a1a1a",sw:3}),
   T(60,200,730,32,"THE DESIGN ISSUE · SPRING 2026",{fs:16,ff:"Arial",fw:"600",c:"#666",al:"center",ls:"4"}),
   T(60,330,500,260,"The New\nMinimalism",{fs:72,ff:"Georgia, serif",fw:"700",c:"#1a1a1a",lh:1.05}),
   T(60,600,420,120,"Inside: quiet luxury, slow brands,\nand the spaces that shape us.",{fs:20,ff:"Arial",c:"#444",lh:1.5}),
   R(60,760,180,50,{f:"#1a1a1a"}), T(60,774,180,30,"£8.90 · ISSUE 42",{fs:14,ff:"Arial",fw:"700",c:"#fff",al:"center"}),
   T(560,960,240,120,"Interview:\nAna Reyes on\ncolor & light",{fs:22,ff:"Georgia, serif",it:true,c:"#111",lh:1.3})
 ]}],"magazine cover editorial fashion");

tpl("magazine","Editorial Two-Column Spread","Article layout with pull quote",850,1100,[
 {bg:"#ffffff",elements:[
   IM(0,0,850,430,"Hero image","#9db4d0","#5a7ba6"),
   T(50,470,500,60,"The Quiet Return\nof Print",{fs:40,ff:"Georgia, serif",fw:"700",c:"#111",lh:1.15}),
   T(560,470,240,60,"WORDS · MAYA CHEN",{fs:13,ff:"Arial",fw:"600",c:"#888",ls:"2"}),
   LN(50,590,800,590,{s:"#111",sw:1}),
   T(50,620,360,320,"There is something about holding a magazine that a feed can never replicate. The weight of paper. The smell of ink. The deliberate pacing of a well-edited spread.",{fs:15,ff:"Georgia, serif",c:"#333",lh:1.75}),
   T(460,620,340,320,"Publishers who survived the digital decade did so by doubling down on craft. Fewer issues, better paper, sharper photography. The lesson: scarcity creates value.",{fs:15,ff:"Georgia, serif",c:"#333",lh:1.75}),
   R(50,960,4,110,{f:"#c9a24b"}),
   T(74,960,340,110,"“Print isn't dead — it's just expensive on purpose.”",{fs:22,ff:"Georgia, serif",it:true,c:"#111",lh:1.35})
 ]}],"magazine article spread editorial");

tpl("magazine","Fashion Lookbook Page","Product grid editorial",850,1100,[
 {bg:"#fdfbf8",elements:[
   IM(50,80,360,480,"Look 01","#c7b9a8","#8f7d68"), IM(440,80,360,300,"Look 02","#b8c4c9","#6e8189"),
   IM(440,420,360,440,"Look 03","#d9c2c2","#a37676"),
   T(50,600,360,50,"LOOK 01 — Linen Days",{fs:20,ff:"Georgia, serif",c:"#222"}),
   T(50,650,360,60,"Oversized shirt in sand,\ntailored trouser in ink.",{fs:14,ff:"Arial",c:"#777",lh:1.5}),
   T(50,960,750,50,"SS26 · RESORT COLLECTION · PAGES 22–48",{fs:13,ff:"Arial",fw:"600",c:"#999",al:"center",ls:"3"})
 ]}],"magazine lookbook fashion catalog");

/* ============================================================
   BOOKS
   ============================================================ */
tpl("books","Thriller Book Cover","Dark dramatic front cover",800,1200,[
 {bg:"#0a0e1a",elements:[
   EL(100,140,600,600,{f:"#132038",op:.9}),
   T(60,80,680,80,"A. J. MERCER",{fs:26,ff:"Arial",fw:"600",c:"#8fa8d0",al:"center",ls:"6"}),
   LN(280,170,520,170,{s:"#c9a24b",sw:2}),
   T(60,380,680,240,"THE SILENT\nHARBOR",{fs:82,ff:"Georgia, serif",fw:"700",c:"#e8edf7",al:"center",lh:1.1}),
   T(60,660,680,60,"A novel of secrets that refuse to drown.",{fs:22,ff:"Georgia, serif",it:true,c:"#7d92b8",al:"center"}),
   R(60,1020,680,3,{f:"#c9a24b"}),
   T(60,1060,680,50,"FROM THE BESTSELLING AUTHOR OF COLD WATER",{fs:15,ff:"Arial",c:"#8fa8d0",al:"center",ls:"2"})
 ]}],"book cover thriller novel mystery");

tpl("books","Chapter Opening Page","Book interior typography",850,1100,[
 {bg:"#fbf8f2",elements:[
   T(80,110,690,70,"CHAPTER ONE",{fs:24,ff:"Arial",c:"#a89878",al:"center",ls:"8"}),
   LN(360,220,490,220,{s:"#a89878",sw:1}),
   T(80,260,690,90,"The Letter",{fs:44,ff:"Georgia, serif",c:"#222",al:"center"}),
   T(120,420,610,520,"Margaret found the envelope where she always did — wedged between the milk bottles and the morning paper, as if the world were being deliberately ordinary about it.\n\nHer name was written in her father's hand. That was impossible. Her father had been dead for eleven years, and yet there it was, in the looping M she had watched him write a thousand times at this very table.",{fs:18,ff:"Georgia, serif",c:"#333",lh:1.8}),
   T(80,990,690,30,"1",{fs:16,ff:"Georgia, serif",c:"#999",al:"center"})
 ]}],"book interior chapter novel page");

tpl("books","Children's Book Page","Playful illustrated spread",850,1100,[
 {bg:"#e8f6ff",elements:[
   IM(60,80,440,500,"Pip the fox","#ffd166","#ef8354",{r:24}),
   T(60,640,440,140,"Pip looked up at the tallest tree\nin the whole wide wood.",{fs:26,ff:"'Comic Sans MS', 'Segoe UI', sans-serif",c:"#1d3557",lh:1.5}),
   IM(540,80,250,250,"Sun","#ffe29a","#ffb703",{r:120}),
   GL(580,420,180,120,"🌲🌳🐿️",{fs:44}),
   R(60,850,730,150,{f:"#fff",s:"#1d3557",sw:2,r:18}),
   T(90,880,670,100,"What do YOU think Pip will do next?\nTurn the page to find out!",{fs:22,ff:"'Comic Sans MS', sans-serif",c:"#1d3557",lh:1.5})
 ]}],"children book illustration kids story");

/* ============================================================
   DOCUMENTS (LibreOffice-ready)
   ============================================================ */
tpl("docs","Professional Letterhead","Business letter — exports to .odt",850,1100,[
 {bg:"#ffffff",elements:[
   R(60,60,40,40,{f:"#1a4f8b",r:8}), T(115,64,400,36,"MERIDIAN CONSULTING",{fs:20,ff:"Arial",fw:"700",c:"#1a4f8b"}),
   T(115,100,400,24,"strategy · operations · growth",{fs:12,ff:"Arial",c:"#888"}),
   LN(60,150,790,150,{s:"#1a4f8b",sw:2}),
   T(60,200,730,30,"March 12, 2026",{fs:13,ff:"Georgia, serif",c:"#444"}),
   T(60,250,730,60,"Ms. Elena Voss\nDirector of Operations, Halcyon Ltd.",{fs:13,ff:"Georgia, serif",c:"#444",lh:1.6}),
   T(60,340,730,30,"RE: Proposal for Q2 supply-chain review",{fs:13,ff:"Georgia, serif",fw:"700",c:"#222"}),
   T(60,390,730,90,"Dear Ms. Voss,\n\nThank you for the opportunity to present our findings from the initial discovery phase.",{fs:13,ff:"Georgia, serif",c:"#333",lh:1.7}),
   T(60,500,730,260,"Our analysis identified three areas of immediate improvement: consolidation of regional vendors, renegotiation of freight contracts, and automation of the invoice reconciliation cycle. Together these measures represent an estimated 11–14% annualized saving.\n\nWe would welcome the chance to walk your team through the detailed model at your convenience during the week of March 23.",{fs:13,ff:"Georgia, serif",c:"#333",lh:1.7}),
   T(60,790,730,40,"Sincerely,",{fs:13,ff:"Georgia, serif",c:"#333"}),
   T(60,870,730,40,"Jordan Blake, Principal",{fs:13,ff:"Georgia, serif",fw:"700",c:"#222"}),
   LN(60,1000,790,1000,{s:"#ddd",sw:1}),
   T(60,1015,730,50,"12 Harbour Lane, Suite 400 · Boston, MA · +1 (617) 555-0142 · hello@meridian.example",{fs:11,ff:"Arial",c:"#888",al:"center"})
 ]}],"letterhead letter business odt libreoffice");

tpl("docs","Modern Resume / CV","One-page resume — exports to .odt",850,1100,[
 {bg:"#ffffff",elements:[
   R(0,0,280,1100,{f:"#16324f"}),
   T(30,70,220,50,"JAMIE\nRIVERA",{fs:34,ff:"Arial",fw:"800",c:"#fff",lh:1.1}),
   T(30,160,220,40,"Product Designer",{fs:16,ff:"Arial",c:"#9fc3e8"}),
   LN(30,210,250,210,{s:"#4a7aab",sw:1}),
   T(30,240,220,24,"CONTACT",{fs:13,ff:"Arial",fw:"700",c:"#9fc3e8",ls:"2"}),
   T(30,270,220,110,"jamie.rivera@mail.com\n+1 (555) 210-4477\nPortland, OR\njamierivera.design",{fs:12,ff:"Arial",c:"#d8e6f5",lh:1.7}),
   T(30,420,220,24,"SKILLS",{fs:13,ff:"Arial",fw:"700",c:"#9fc3e8",ls:"2"}),
   T(30,450,220,150,"UX Research\nDesign Systems\nPrototyping\nFigma / Adobe CC\nHTML & CSS\nData Storytelling",{fs:12,ff:"Arial",c:"#d8e6f5",lh:1.9}),
   T(30,650,220,24,"LANGUAGES",{fs:13,ff:"Arial",fw:"700",c:"#9fc3e8",ls:"2"}),
   T(30,680,220,60,"English — native\nSpanish — fluent",{fs:12,ff:"Arial",c:"#d8e6f5",lh:1.7}),
   T(320,80,480,40,"EXPERIENCE",{fs:18,ff:"Arial",fw:"800",c:"#16324f",ls:"2"}),
   LN(320,120,790,120,{s:"#16324f",sw:2}),
   T(320,145,480,24,"Senior Product Designer — Nimbus Software",{fs:14,ff:"Arial",fw:"700",c:"#222"}),
   T(320,170,480,20,"2022 – Present",{fs:11,ff:"Arial",c:"#999"}),
   T(320,196,480,80,"Led redesign of the core analytics suite used by 40k teams; cut onboarding drop-off by 31%.",{fs:12,ff:"Arial",c:"#444",lh:1.6}),
   T(320,300,480,24,"Product Designer — Fathom Labs",{fs:14,ff:"Arial",fw:"700",c:"#222"}),
   T(320,325,480,20,"2019 – 2022",{fs:11,ff:"Arial",c:"#999"}),
   T(320,351,480,80,"Shipped 20+ features across web and mobile; built the first company design system.",{fs:12,ff:"Arial",c:"#444",lh:1.6}),
   T(320,460,480,40,"EDUCATION",{fs:18,ff:"Arial",fw:"800",c:"#16324f",ls:"2"}),
   LN(320,500,790,500,{s:"#16324f",sw:2}),
   T(320,525,480,60,"BFA, Interaction Design\nPacific Northwest University, 2019",{fs:12,ff:"Arial",c:"#444",lh:1.6})
 ]}],"resume cv document odt libreoffice job");

tpl("docs","Clean Invoice","Billing document — exports to .odt",850,1100,[
 {bg:"#ffffff",elements:[
   T(60,60,300,50,"INVOICE",{fs:36,ff:"Arial",fw:"800",c:"#222",ls:"4"}),
   T(520,70,270,60,"INVOICE #2047\nIssued: April 2, 2026",{fs:13,ff:"Arial",c:"#666",al:"right",lh:1.6}),
   LN(60,140,790,140,{s:"#2f9e6e",sw:3}),
   T(60,170,300,24,"FROM",{fs:12,ff:"Arial",fw:"700",c:"#2f9e6e",ls:"2"}),
   T(60,198,300,80,"Willow Design Co.\n88 Alder Street\nPortland, OR 97204",{fs:13,ff:"Arial",c:"#333",lh:1.6}),
   T(460,170,330,24,"BILL TO",{fs:12,ff:"Arial",fw:"700",c:"#2f9e6e",ls:"2"}),
   T(460,198,330,80,"Brightside Media LLC\n410 Commerce Ave\nSeattle, WA 98101",{fs:13,ff:"Arial",c:"#333",lh:1.6}),
   R(60,310,730,44,{f:"#eef7f2"}),
   T(76,322,200,24,"DESCRIPTION",{fs:12,ff:"Arial",fw:"700",c:"#2f9e6e"}),
   T(490,322,120,24,"QTY",{fs:12,ff:"Arial",fw:"700",c:"#2f9e6e"}),
   T(560,322,110,24,"RATE",{fs:12,ff:"Arial",fw:"700",c:"#2f9e6e",al:"right"}),
   T(690,322,85,24,"AMOUNT",{fs:12,ff:"Arial",fw:"700",c:"#2f9e6e",al:"right"}),
   T(76,375,400,26,"Brand identity design",{fs:13,ff:"Arial",c:"#333"}),T(490,375,60,26,"1",{fs:13,ff:"Arial",c:"#333"}),T(560,375,110,26,"$4,200.00",{fs:13,ff:"Arial",c:"#333",al:"right"}),T(690,375,85,26,"$4,200.00",{fs:13,ff:"Arial",c:"#333",al:"right"}),
   LN(60,415,790,415,{s:"#e5e5e5",sw:1}),
   T(76,430,400,26,"Website UI refresh (12 screens)",{fs:13,ff:"Arial",c:"#333"}),T(490,430,60,26,"12",{fs:13,ff:"Arial",c:"#333"}),T(560,430,110,26,"$180.00",{fs:13,ff:"Arial",c:"#333",al:"right"}),T(690,430,85,26,"$2,160.00",{fs:13,ff:"Arial",c:"#333",al:"right"}),
   LN(60,470,790,470,{s:"#e5e5e5",sw:1}),
   T(76,485,400,26,"Design system documentation",{fs:13,ff:"Arial",c:"#333"}),T(490,485,60,26,"1",{fs:13,ff:"Arial",c:"#333"}),T(560,485,110,26,"$980.00",{fs:13,ff:"Arial",c:"#333",al:"right"}),T(690,485,85,26,"$980.00",{fs:13,ff:"Arial",c:"#333",al:"right"}),
   T(560,560,110,30,"Subtotal",{fs:13,ff:"Arial",fw:"600",c:"#555",al:"right"}),T(690,560,85,30,"$7,340.00",{fs:13,ff:"Arial",c:"#555",al:"right"}),
   T(560,590,110,30,"Tax (8%)",{fs:13,ff:"Arial",fw:"600",c:"#555",al:"right"}),T(690,590,85,30,"$587.20",{fs:13,ff:"Arial",c:"#555",al:"right"}),
   R(540,630,250,44,{f:"#2f9e6e",r:8}),
   T(556,642,110,24,"TOTAL DUE",{fs:12,ff:"Arial",fw:"700",c:"#eafff5"}),
   T(690,640,85,28,"$7,927.20",{fs:15,ff:"Arial",fw:"800",c:"#fff",al:"right"}),
   T(60,720,730,60,"Payment due within 30 days. Payable to Willow Design Co. — Acct 0043 2219 88, Routing 121000358. Thank you for your business!",{fs:12,ff:"Arial",c:"#888",lh:1.6})
 ]}],"invoice billing document odt libreoffice finance");

tpl("docs","Report Cover Page","Business report title page",850,1100,[
 {bg:"#101828",elements:[
   R(60,80,60,6,{f:"#2f9e6e"}),
   T(60,120,730,60,"2026 Annual\nImpact Report",{fs:56,ff:"Georgia, serif",fw:"700",c:"#fff",lh:1.15}),
   T(60,320,730,40,"Northwind Foundation · Fiscal Year in Review",{fs:20,ff:"Arial",c:"#9fb3c8"}),
   IM(60,700,730,300,"Report hero","#1f3d5c","#2f9e6e",{r:12}),
   R(60,420,300,1,{f:"#2a3a52"}),
   T(60,450,330,140,"Prepared for the Board of Directors\nand program partners.",{fs:15,ff:"Arial",c:"#7e93ab",lh:1.7}),
   T(560,450,230,60,"CONFIDENTIAL\nDRAFT 2.1",{fs:13,ff:"Arial",c:"#4d6481",al:"right",lh:1.8})
 ]}],"report cover business document odt annual");

tpl("docs","Project Memo","Internal memo — exports to .odt",850,1100,[
 {bg:"#ffffff",elements:[
   R(0,0,850,10,{f:"#4361ee"}),
   T(60,60,730,44,"INTERNAL MEMO",{fs:26,ff:"Arial",fw:"800",c:"#1d2438",ls:"3"}),
   LN(60,130,790,130,{s:"#ddd",sw:1}),
   T(60,150,730,120,"TO:       All Engineering Staff\nFROM:   R. Okafor, VP Engineering\nDATE:    April 14, 2026\nRE:        Platform migration timeline update",{fs:13,ff:"'Courier New', monospace",c:"#333",lh:1.9}),
   T(60,300,730,40,"1. Purpose",{fs:15,ff:"Arial",fw:"700",c:"#1d2438"}),
   T(60,335,730,80,"This memo summarizes the revised timeline for the data-platform migration and the support expectations for each team through Q3.",{fs:13,ff:"Arial",c:"#444",lh:1.7}),
   T(60,430,730,40,"2. Revised schedule",{fs:15,ff:"Arial",fw:"700",c:"#1d2438"}),
   T(60,465,730,120,"• May 4 — Staging cutover (services A–C)\n• June 1 — Production wave 1 (read traffic)\n• July 6 — Production wave 2 (write traffic)\n• July 27 — Legacy decommission freeze",{fs:13,ff:"Arial",c:"#444",lh:1.9}),
   T(60,600,730,40,"3. Action required",{fs:15,ff:"Arial",fw:"700",c:"#1d2438"}),
   T(60,635,730,80,"Team leads should confirm migration windows with their on-call rotations by April 25. Questions to #platform-migration.",{fs:13,ff:"Arial",c:"#444",lh:1.7})
 ]}],"memo document odt libreoffice internal";

/* ============================================================
   PRESENTATIONS (16:9)
   ============================================================ */
tpl("presentation","Pitch Deck — Title","Opening slide with impact",1280,720,[
 {bg:"#0e0b1e",elements:[
   EL(900,-140,500,500,{f:"#7c5cff",op:.35}), EL(-120,500,380,380,{f:"#ff5c8a",op:.3}),
   T(90,240,760,50,"SERIES A · 2026",{fs:20,ff:"Arial",fw:"700",c:"#8f7bff",ls:"5"}),
   T(90,300,900,140,"Freight, reinvented\nfor the last mile.",{fs:64,ff:"'Segoe UI', Arial, sans-serif",fw:"800",c:"#fff",lh:1.12}),
   T(90,470,760,40,"CargoLine — the operating system for regional delivery fleets.",{fs:22,ff:"Arial",c:"#b9b3d9"}),
   R(90,550,190,56,{f:"#7c5cff",r:28}), T(90,566,190,30,"cargoline.io",{fs:19,ff:"Arial",fw:"600",c:"#fff",al:"center"})
 ]}],"pitch deck title startup presentation slide");

tpl("presentation","Problem / Solution Slide","Two-column content slide",1280,720,[
 {bg:"#ffffff",elements:[
   T(70,60,1140,50,"The problem is routing, not distance.",{fs:40,ff:"'Segoe UI', Arial",fw:"700",c:"#111"}),
   LN(70,130,1210,130,{s:"#eee",sw:1}),
   R(70,170,550,380,{f:"#fdecec",r:16}),
   T(100,200,490,40,"✕  Today",{fs:24,ff:"Arial",fw:"700",c:"#c0392b"}),
   T(100,260,490,260,"• Drivers wait 47 min/day at docks\n• Paper manifests, no live tracking\n• 22% of loads arrive late\n• Dispatchers juggle 6 tools",{fs:19,ff:"Arial",c:"#6b2d2d",lh:1.9}),
   R(660,170,550,380,{f:"#e8f6ef",r:16}),
   T(690,200,490,40,"✓  With CargoLine",{fs:24,ff:"Arial",fw:"700",c:"#1e8e5a"}),
   T(690,260,490,260,"• Auto-sequenced dock appointments\n• Digital manifests + live ETA\n• 96% on-time delivery\n• One dashboard, all fleets",{fs:19,ff:"Arial",c:"#1d5c43",lh:1.9})
 ]}],"presentation content slide compare business");

tpl("presentation","Section Divider","Bold interstitial slide",1280,720,[
 {bg:"#1d3557",elements:[
   R(0,0,1280,720,{f:"#1d3557"}),
   EL(1020,420,520,520,{f:"#457b9d",op:.5}),
   T(90,260,220,44,"02",{fs:80,ff:"Georgia, serif",fw:"700",c:"#a8dadc"}),
   LN(95,390,300,390,{s:"#a8dadc",sw:2}),
   T(90,420,1000,80,"The Market",{fs:60,ff:"Georgia, serif",fw:"700",c:"#fff"}),
   T(90,510,900,40,"Where the opportunity hides in plain sight.",{fs:20,ff:"Arial",c:"#b8c9dd"})
 ]}],"presentation section divider slide agenda");

tpl("presentation","Quote Slide","Minimal typographic statement",1280,720,[
 {bg:"#f7f4ef",elements:[
   GL(120,120,120,100,"❝",{fs:140,c:"#c9a24b"}),
   T(160,240,960,220,"We don't ship products.\nWe ship decisions people can act on.",{fs:48,ff:"Georgia, serif",it:true,c:"#2b2b2b",lh:1.4}),
   LN(165,510,300,510,{s:"#c9a24b",sw:3}),
   T(160,540,700,40,"— CEO, Annual All-Hands",{fs:20,ff:"Arial",c:"#777"})
 ]}],"presentation quote slide minimal typography");

/* ============================================================
   LOGOS
   ============================================================ */
tpl("logos","Geometric Monogram","Modern lettermark on grid",800,800,[
 {bg:"#111318",elements:[
   EL(190,190,420,420,{f:"none",s:"#e8b84b",sw:3}),
   R(215,215,370,370,{f:"#111318",s:"#e8b84b",sw:1}),
   T(215,300,370,180,"AK",{fs:130,ff:"Georgia, serif",fw:"700",c:"#e8b84b",al:"center"}),
   LN(300,520,500,520,{s:"#e8b84b",sw:2}),
   T(215,545,370,40,"ATELIER KANE",{fs:20,ff:"Arial",c:"#cfcfd8",al:"center",ls:"8"}),
   T(215,585,370,30,"EST. MMXXVI",{fs:13,ff:"Arial",c:"#6d6d7a",al:"center",ls:"4"})
 ]}],"logo monogram brand identity luxury");

tpl("logos","Organic Badge Logo","Circular emblem for cafés & makers",800,800,[
 {bg:"#f6f1e7",elements:[
   EL(140,140,520,520,{f:"#2e5339"}),
   EL(165,165,470,470,{f:"none",s:"#f6f1e7",sw:2}),
   T(140,290,520,120,"WILDSTEM",{fs:56,ff:"Georgia, serif",fw:"700",c:"#f6f1e7",al:"center",ls:"6"}),
   LN(280,400,520,400,{s:"#e8b84b",sw:2}),
   T(140,425,520,50,"BOTANICAL APOTHECARY",{fs:17,ff:"Arial",c:"#e8b84b",al:"center",ls:"3"}),
   GL(370,500,60,60,"🌿",{fs:52}),
   T(140,600,520,40,"SMALL BATCH · SINCE 2019",{fs:13,ff:"Arial",c:"#cde3d2",al:"center",ls:"2"})
 ]}],"logo badge emblem cafe organic brand");

tpl("logos","Tech Wordmark","Clean startup wordmark + tagline",1000,500,[
 {bg:"#ffffff",elements:[
   EL(90,170,90,90,{f:"#7c5cff"}), EL(150,230,60,60,{f:"#ff5c8a",op:.9}),
   T(200,175,560,90,"vorteks",{fs:72,ff:"'Segoe UI', Arial",fw:"800",c:"#171717",ls:"-2"}),
   T(205,280,560,40,"INFRASTRUCTURE THAT DISAPPEARS",{fs:15,ff:"Arial",c:"#8a8a99",ls:"4"})
 ]}],"logo wordmark tech startup brand");

/* ============================================================
   POSTERS
   ============================================================ */
tpl("posters","Concert Event Poster","Music event with bold type",600,900,[
 {bg:"#12081f",elements:[
   EL(-100,300,500,500,{f:"#ff5c8a",op:.4}), EL(300,600,480,480,{f:"#7c5cff",op:.45}),
   T(50,90,500,60,"LIVE IN CONCERT",{fs:22,ff:"Arial",fw:"700",c:"#ffd479",al:"center",ls:"6"}),
   T(40,150,520,200,"NEON\nHOLLOW",{fs:90,ff:"'Arial Black', Arial",fw:"900",c:"#fff",al:"center",lh:1.0}),
   LN(150,380,450,380,{s:"#ffd479",sw:2}),
   T(50,410,500,50,"with special guests VELVET STATIC",{fs:20,ff:"Arial",it:true,c:"#e0d0ff",al:"center"}),
   T(50,530,500,90,"SAT · JUNE 20 · 8PM\nTHE ORPHANAGE, PORTLAND",{fs:24,ff:"Arial",fw:"700",c:"#fff",al:"center",lh:1.6}),
   R(170,700,260,60,{f:"#ffd479",r:30}), T(170,718,260,30,"TICKETS $25",{fs:21,ff:"Arial",fw:"800",c:"#12081f",al:"center"}),
   T(50,800,500,30,"All ages · Doors at 7 · neonsuited.com",{fs:14,ff:"Arial",c:"#9a8fc0",al:"center"})
 ]}],"poster concert event music party");

tpl("posters","Movie Poster","Dramatic one-sheet layout",600,900,[
 {bg:"#0b0f14",elements:[
   IM(0,0,600,640,"Key art","#2b3a4d","#0b0f14"),
   R(0,0,600,640,{f:"#0b0f14",op:.25}),
   T(40,70,520,70,"THE LAST\nLIGHTHOUSE",{fs:56,ff:"Georgia, serif",fw:"700",c:"#f5e9d0",al:"center",lh:1.1}),
   T(40,470,520,40,"Some nights never end.",{fs:22,ff:"Georgia, serif",it:true,c:"#c8b78f",al:"center"}),
   T(40,680,520,50,"MARA VOSS  ·  DANIEL OKAFOR  ·  INGRID HALVORSEN",{fs:14,ff:"Arial",c:"#9aa5b1",al:"center",ls:"1"}),
   T(40,760,520,90,"A film by R. T. Calloway",{fs:26,ff:"Georgia, serif",c:"#e8e0cf",al:"center"}),
   LN(150,880,450,880,{s:"#c8b78f",sw:1}),
   T(40,895,520,30,"IN THEATERS OCTOBER 31",{fs:16,ff:"Arial",fw:"700",c:"#c8b78f",al:"center",ls:"3"})
 ]}],"poster movie film cinema");

tpl("posters","Motivational Quote Poster","Type-driven wall art",600,900,[
 {bg:"#f2b705",elements:[
   EL(60,60,480,480,{f:"#f6d560",op:.6}),
   T(60,220,480,300,"DO THE\nHARD THING\nESPECIALLY\nWHEN IT'S\nBORING.",{fs:44,ff:"'Arial Black', Arial",fw:"900",c:"#20160a",lh:1.18}),
   T(60,600,480,40,"— HABIT > MOTIVATION",{fs:18,ff:"Arial",fw:"700",c:"#5c4a10",ls:"3"})
 ]}],"poster quote motivational typography wall");

/* ============================================================
   MARKETING VIDEOS (storyboards)
   ============================================================ */
tpl("video","Product Ad Storyboard","30s spot — 3 scene frames",1280,720,[
 {bg:"#0d0d0f",elements:[
   IM(80,80,1120,470,"Scene 1 — product hero shot","#3a4a6b","#141a2e",{r:12}),
   R(80,590,720,60,{f:"#1c1c24",r:10}),
   T(100,606,700,36,"SCENE 1 (0–4s) · Slow push-in on product, rim light, no VO.",{fs:17,ff:"'Courier New', monospace",c:"#9be2b0"}),
   T(1010,600,190,40,"SC 1/3",{fs:18,ff:"Arial",c:"#555",al:"right"})
 ]},
 {bg:"#0d0d0f",elements:[
   IM(80,80,1120,470,"Scene 2 — lifestyle usage","#6b3a4a","#2e141b",{r:12}),
   R(80,590,720,60,{f:"#1c1c24",r:10}),
   T(100,606,700,36,"SCENE 2 (4–14s) · Hands using product, natural light, VO begins.",{fs:17,ff:"'Courier New', monospace",c:"#ffd479"}),
   T(1010,600,190,40,"SC 2/3",{fs:18,ff:"Arial",c:"#555",al:"right"})
 ]},
 {bg:"#0d0d0f",elements:[
   IM(80,80,1120,470,"Scene 3 — logo end card","#1f4d3a","#0d1f18",{r:12}),
   R(80,590,720,60,{f:"#1c1c24",r:10}),
   T(100,606,700,36,"SCENE 3 (14–30s) · Logo resolves, tagline, CTA + URL.",{fs:17,ff:"'Courier New', monospace",c:"#9bd0e2"}),
   T(1010,600,190,40,"SC 3/3",{fs:18,ff:"Arial",c:"#555",al:"right"})
 ]}],"marketing video storyboard ad commercial scenes");

tpl("video","Reel / TikTok Storyboard","Vertical short-form script frames",720,1280,[
 {bg:"#101014",elements:[
   IM(60,70,600,900,"Hook frame — talking head","#4a2e3a","#1a1016",{r:14}),
   R(60,1020,600,80,{f:"#1c1c24",r:12}),
   T(80,1040,560,50,"HOOK (0–2s): “Stop scrolling if you\nhate folding laundry.”",{fs:16,ff:"'Courier New', monospace",c:"#ff9ec4",lh:1.4}),
   T(60,1140,600,30,"REEL 1/3 · 9:16 · 30s total",{fs:14,ff:"Arial",c:"#666",al:"center"})
 ]},
 {bg:"#101014",elements:[
   IM(60,70,600,900,"Body — product demo closeup","#2e4a3a","#101a14",{r:14}),
   R(60,1020,600,80,{f:"#1c1c24",r:12}),
   T(80,1040,560,50,"BODY (2–22s): 3 quick cuts of the gadget\nin action, captions burned in.",{fs:16,ff:"'Courier New', monospace",c:"#9be2b0",lh:1.4}),
   T(60,1140,600,30,"REEL 2/3 · 9:16 · 30s total",{fs:14,ff:"Arial",c:"#666",al:"center"})
 ]},
 {bg:"#101014",elements:[
   IM(60,70,600,900,"End card — offer + logo","#3a3a6b","#16162e",{r:14}),
   R(60,1020,600,80,{f:"#1c1c24",r:12}),
   T(80,1040,560,50,"END (22–30s): “20% off with code\nLAUNDRY20” + follow prompt.",{fs:16,ff:"'Courier New', monospace",c:"#ffd479",lh:1.4}),
   T(60,1140,600,30,"REEL 3/3 · 9:16 · 30s total",{fs:14,ff:"Arial",c:"#666",al:"center"})
 ]}],"marketing video reel tiktok storyboard social");

/* ============================================================
   PHOTO COLLAGES
   ============================================================ */
tpl("collages","Classic 2×2 Grid","Four equal photos",800,800,[
 {bg:"#ffffff",elements:[
   IM(0,0,400,400,"Photo 1","#7c9cc4","#3d5a80"), IM(400,0,400,400,"Photo 2","#c49a7c","#805a3d"),
   IM(0,400,400,400,"Photo 3","#8ac49a","#3d805a"), IM(400,400,400,400,"Photo 4","#c47c9a","#803d5a")
 ]}],"collage grid photo 4 square instagram");

tpl("collages","Hero + Strip Collage","One large, three small",800,800,[
 {bg:"#ffffff",elements:[
   IM(0,0,800,520,"Hero photo","#6b7fa3","#2e3d5c"),
   IM(0,540,253,260,"Photo 2","#a37c6b","#5c3d2e"), IM(273,540,253,260,"Photo 3","#7ca36b","#3d5c2e"), IM(547,540,253,260,"Photo 4","#9a7cc4","#5a3d80")
 ]}],"collage photo hero grid memories");

tpl("collages","Moodboard","Editorial mood tiles",900,1100,[
 {bg:"#f5f2ec",elements:[
   IM(60,80,380,300,"Texture","#c9b8a3","#8a7a65",{r:8}), IM(460,80,380,460,"Portrait","#a3b8c9","#65788a",{r:8}),
   IM(60,400,380,340,"Object","#b8c9a3","#7a8a65",{r:8}), IM(460,560,380,200,"Detail","#c9a3a3","#8a6565",{r:8}),
   IM(60,760,780,240,"Wide palette","#c9c2a3","#8a8565",{r:8}),
   T(60,1010,780,40,"SPRING MOODBOARD · WARM NEUTRALS",{fs:16,ff:"Arial",fw:"600",c:"#8a8273",al:"center",ls:"3"})
 ]}],"collage moodboard inspiration design palette");

/* ============================================================
   PRINT & MARKETING
   ============================================================ */
tpl("marketing","Business Card","Standard 3.5×2in card",1050,600,[
 {bg:"#132437",elements:[
   R(0,0,1050,600,{f:"#132437"}),
   EL(760,-140,440,440,{f:"#1e5f8a",op:.6}),
   T(70,180,600,60,"SLOANE & PARTNERS",{fs:38,ff:"Georgia, serif",fw:"700",c:"#fff",ls:"4"}),
   LN(70,260,350,260,{s:"#c9a24b",sw:2}),
   T(70,290,600,40,"ATTORNEYS AT LAW",{fs:16,ff:"Arial",c:"#8fb3d9",ls:"6"}),
   T(70,420,600,90,"M. Sloane, Esq. · (503) 555-0181\nmsloane@sloanelaw.example",{fs:15,ff:"Arial",c:"#c8d9ea",lh:1.7})
 ]}],"business card print professional");

tpl("marketing","Grand Opening Flyer","Retail event flyer",850,1100,[
 {bg:"#fef6e4",elements:[
   R(40,40,770,1020,{f:"none",s:"#d1495b",sw:4}),
   T(90,100,670,60,"GRAND\nOPENING!",{fs:70,ff:"'Arial Black', Arial",fw:"900",c:"#d1495b",al:"center",lh:1.05}),
   IM(90,320,670,330,"Storefront photo","#f2b705","#d1495b",{r:10}),
   T(90,690,670,50,"SUNDAY, MAY 3 · 10AM – 6PM",{fs:24,ff:"Arial",fw:"800",c:"#3d2b1f",al:"center"}),
   T(90,750,670,40,"First 50 customers get a free tote & 15% off everything.",{fs:18,ff:"Arial",c:"#6b5a45",al:"center"}),
   R(280,830,290,64,{f:"#3d2b1f",r:32}),
   T(280,850,290,30,"RSVP ON FACEBOOK",{fs:17,ff:"Arial",fw:"700",c:"#fef6e4",al:"center"}),
   T(90,960,670,60,"128 Maple Street · Downtown · parking behind the store",{fs:15,ff:"Arial",c:"#8a7a65",al:"center"})
 ]}],"flyer event opening retail marketing");

tpl("marketing","Café Menu","Two-column menu board",850,1100,[
 {bg:"#1e1a16",elements:[
   GL(370,60,110,90,"☕",{fs:80,c:"#e8b84b"}),
   T(120,170,610,60,"THE COPPER KETTLE",{fs:40,ff:"Georgia, serif",c:"#f5efe4",al:"center",ls:"4"}),
   LN(300,250,550,250,{s:"#e8b84b",sw:1}),
   T(90,300,320,36,"ESPRESSO",{fs:18,ff:"Arial",fw:"700",c:"#e8b84b",ls:"3"}),
   T(90,345,320,150,"Espresso .......... 3.00\nCortado ............ 3.75\nFlat White ........ 4.25\nMocha .............. 4.75",{fs:16,ff:"Georgia, serif",c:"#d8cfc0",lh:1.9}),
   T(440,300,320,36,"BREWED",{fs:18,ff:"Arial",fw:"700",c:"#e8b84b",ls:"3"}),
   T(440,345,320,150,"Pour Over ......... 4.00\nCold Brew .......... 4.50\nChai ................. 4.25\nMatcha .............. 4.75",{fs:16,ff:"Georgia, serif",c:"#d8cfc0",lh:1.9}),
   T(90,540,320,36,"PASTRY",{fs:18,ff:"Arial",fw:"700",c:"#e8b84b",ls:"3"}),
   T(90,585,320,150,"Croissant .......... 3.50\nMorning Bun .... 4.00\nCardamom Knot .. 4.25",{fs:16,ff:"Georgia, serif",c:"#d8cfc0",lh:1.9}),
   T(440,540,320,36,"TOAST",{fs:18,ff:"Arial",fw:"700",c:"#e8b84b",ls:"3"}),
   T(440,585,320,150,"Avocado ........... 9.50\nRicotta & Honey . 8.50\nHam & Gruyère ... 9.00",{fs:16,ff:"Georgia, serif",c:"#d8cfc0",lh:1.9}),
   T(120,900,610,50,"Open daily 7am – 4pm · 42 Alder St",{fs:15,ff:"Arial",c:"#9a8f7d",al:"center"})
 ]}],"menu cafe restaurant food print");

tpl("marketing","Award Certificate","Elegant recognition document",1100,850,[
 {bg:"#fdfcf8",elements:[
   R(30,30,1040,790,{f:"none",s:"#b98d2f",sw:3}),
   R(42,42,1016,766,{f:"none",s:"#b98d2f",sw:1}),
   T(150,110,800,40,"CERTIFICATE OF ACHIEVEMENT",{fs:22,ff:"Arial",c:"#8a7a55",al:"center",ls:"6"}),
   T(150,170,800,60,"Summit Excellence Award",{fs:44,ff:"Georgia, serif",fw:"700",c:"#2b2b2b",al:"center"}),
   T(150,270,800,40,"This certificate is proudly presented to",{fs:17,ff:"Georgia, serif",it:true,c:"#666",al:"center"}),
   T(150,330,800,80,"Alex Morgan",{fs:54,ff:"'Brush Script MT', cursive",c:"#b98d2f",al:"center"}),
   LN(330,420,770,420,{s:"#b98d2f",sw:1}),
   T(150,440,800,60,"for outstanding leadership in the 2026 Community Innovation Program.",{fs:17,ff:"Georgia, serif",c:"#555",al:"center",lh:1.6}),
   GL(190,600,120,100,"🏅",{fs:80}), GL(790,600,120,100,"🏛️",{fs:80}),
   T(150,690,300,30,"Director, Programs",{fs:14,ff:"Arial",c:"#777",al:"center"}),
   LN(230,680,370,680,{s:"#999",sw:1}),
   T(660,690,300,30,"October 14, 2026",{fs:14,ff:"Arial",c:"#777",al:"center"}),
   LN(740,680,880,680,{s:"#999",sw:1})
 ]}],"certificate award recognition print diploma");

/* expose */
if (typeof window !== "undefined") window.TEMPLATES = TEMPLATES, window.CATS = CATS;
