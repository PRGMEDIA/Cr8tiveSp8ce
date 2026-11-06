/* ============================================================
   Aura Suite — community template collection (21 templates)
   Inspired by classic print/digital layouts (guides), rebuilt as
   native, fully-editable Aura Studio templates.
   Exposes: AURA_SUITE_TEMPLATES (array, same schema as TEMPLATES)
   ============================================================ */
const AURA_SUITE_TEMPLATES = (() => {
  const S = [];
  const T = (x,y,w,h,text,o={}) => ({type:"text",x,y,w,h,text,
    fontSize:o.fs||20,fontFamily:o.ff||"'Segoe UI', Arial, sans-serif",fontWeight:o.fw||"400",
    color:o.c||"#222",align:o.al||"left",italic:o.it||false,uppercase:o.up||false,
    lineHeight:o.lh||1.3,letterSpacing:(o.ls||0)+"px",opacity:(o.op!=null?o.op:1)});
  const R = (x,y,w,h,o={}) => ({type:"rect",x,y,w,h,fill:o.f||"#ffffff",
    stroke:o.s||"none",strokeWidth:o.sw||0,radius:o.r||0,opacity:(o.op!=null?o.op:1)});
  const E = (x,y,w,h,o={}) => ({type:"ellipse",x,y,w,h,fill:o.f||"none",
    stroke:o.s||"none",strokeWidth:o.sw||0,opacity:(o.op!=null?o.op:1)});
  const LN = (x,y,x2,y2,o={}) => ({type:"line",x,y,w:Math.abs(x2-x),h:Math.abs(y2-y),
    x1:Math.min(x,x2),y1:Math.min(y,y2),x2a:Math.max(x,x2),y2a:Math.max(y,y2),
    stroke:o.s||"#999",strokeWidth:o.sw||1,opacity:(o.op!=null?o.op:1)});
  const IM = (x,y,w,h,label,c1,c2,o={}) => ({type:"image",x,y,w,h,
    src:"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'">'+
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'+
      '<stop offset="0" stop-color="'+c1+'"/><stop offset="1" stop-color="'+c2+'"/></linearGradient></defs>'+
      '<rect width="100%" height="100%" fill="url(#g)"/>'+
      '<text x="50%" y="50%" font-family="Segoe UI,Arial" font-size="'+Math.max(11,Math.min(w,h)*0.08)+
      '" fill="#fff" text-anchor="middle" dominant-baseline="middle">'+label+'</text></svg>'),
    fit:"cover",radius:o.r||0,opacity:(o.op!=null?o.op:1)});
  const GL = (x,y,w,h,ch,o={}) => ({type:"glyph",x,y,w,h,ch,text:ch,fontSize:o.fs||64,color:o.c||"#333",opacity:(o.op!=null?o.op:1)});
  const tpl = (name,cat,desc,tags,w,h,pages) => S.push({name,cat,desc,tags:tags.toLowerCase(),w,h,pages});

  /* ---- 1) Business Card Sheet — Classic (guide: 10-up card sheet) ---- */
  {
    const els = [ T(60,40,730,44,"Business Cards \u2014 10-up sheet (3.5\u00d72\u2033)",{fs:26,fw:"700"}),
      T(60,88,730,26,"Trim guides: cut along the card edges \u00b7 standard 3.5\u00d72\u2033 cards",{fs:13,c:"#888"}) ];
    for (let row = 0; row < 5; row++) for (let col = 0; col < 2; col++){
      const x = 70 + col*360, y = 140 + row*186;
      els.push(R(x, y, 340, 170, {f:"#ffffff", s:"#b9b4a8", sw:1, r:6}));
      els.push(T(x+20, y+22, 300, 34, "YOUR NAME", {fs:22, fw:"700", c:"#2b2b2b", ls:"2"}));
      els.push(T(x+20, y+58, 300, 24, "Title / Business", {fs:14, c:"#777"}));
      els.push(LN(x+20, y+92, x+320, y+92, {s:"#ddd"}));
      els.push(T(x+20, y+102, 300, 22, "+1 (555) 000-0000", {fs:12, c:"#555"}));
      els.push(T(x+20, y+126, 300, 22, "hello@yourbrand.com", {fs:12, c:"#555"}));
    }
    tpl("Business Card Sheet \u2014 Classic 10-up","marketing","Ten standard 3.5\u00d72\u2033 business cards on a letter sheet \u2014 editable name/title/contact on every card.","business card, print, sheet, 10-up",850,1100,[{bg:"#f6f4ef",elements:els}]);
  }
  /* ---- 2) Business Card Sheet — Noir (different) ---- */
  {
    const els = [ T(60,40,730,44,"Business Cards \u2014 Noir 10-up",{fs:26,fw:"700",c:"#e8b84b"}),
      T(60,88,730,26,"Gold-accented dark cards \u00b7 cut along the edges",{fs:13,c:"#8a8a7a"}) ];
    for (let row = 0; row < 5; row++) for (let col = 0; col < 2; col++){
      const x = 70 + col*360, y = 140 + row*186;
      els.push(R(x, y, 340, 170, {f:"#191919", s:"#e8b84b", sw:1, r:6}));
      els.push(T(x+20, y+24, 300, 34, "YOUR NAME", {fs:22, fw:"700", c:"#e8b84b", ls:"3"}));
      els.push(T(x+20, y+60, 300, 24, "CONSULTANT", {fs:12, c:"#bbb", ls:"3"}));
      els.push(LN(x+20, y+94, x+320, y+94, {s:"#e8b84b"}));
      els.push(T(x+20, y+104, 300, 22, "+1 (555) 000-0000", {fs:12, c:"#ddd"}));
      els.push(T(x+20, y+128, 300, 22, "studio@noir.example", {fs:12, c:"#ddd"}));
    }
    tpl("Business Card Sheet \u2014 Noir 10-up","marketing","Dark gold-accented business card sheet \u2014 ten editable cards.","business card, print, noir, gold",850,1100,[{bg:"#101010",elements:els}]);
  }
  /* ---- 3) Case Study — Clean (guide) ---- */
  tpl("Case Study \u2014 Clean","docs","Beginner-friendly case study layout: overview, challenge, solution and results with image slots.","case study, portfolio, project",850,1100,[
    {bg:"#ffffff",elements:[
      T(60,70,500,60,"Case Study",{fs:44,fw:"800",c:"#1a1a1a"}),
      T(60,140,500,90,"A short summary of the project \u2014 who it was for, what it changed, and the outcome.",{fs:16,c:"#555",lh:1.5}),
      IM(60,250,350,200,"Project image","#9db4d0","#5a7ba6",{r:8}),
      IM(440,250,350,200,"Result image","#b4c9d9","#6a8aa6",{r:8}),
      T(60,480,730,36,"The challenge",{fs:22,fw:"700",c:"#1a1a1a"}),
      T(60,520,730,70,"Describe the problem your client faced \u2014 context, constraints and stakes.",{fs:14,c:"#444",lh:1.6}),
      T(60,610,730,36,"The solution",{fs:22,fw:"700",c:"#1a1a1a"}),
      T(60,650,730,70,"What you built or changed, and why it worked.",{fs:14,c:"#444",lh:1.6}),
      T(60,740,730,36,"The results",{fs:22,fw:"700",c:"#1a1a1a"}),
      T(60,780,730,70,"\u2022 Result one \u2014 metric or outcome\n\u2022 Result two \u2014 metric or outcome\n\u2022 Result three \u2014 metric or outcome",{fs:14,c:"#444",lh:1.7}),
      R(60,900,180,44,{f:"#1a1a1a",r:6}),
      T(60,912,180,26,"See the work",{fs:14,fw:"600",c:"#fff",al:"center"}),
      T(60,990,730,26,"Made with Aura Studio \u00b7 yourname.example",{fs:12,c:"#999",al:"center"})
    ]}]);
  /* ---- 4) Case Study — Purple Tech (different) ---- */
  tpl("Case Study \u2014 Purple Tech","docs","Tech-flavoured case study with gradient header, product shot and metric cards.","case study, tech, saas, purple",850,1100,[
    {bg:"#f6f5ff",elements:[
      R(0,0,850,190,{f:"#3b2a78"}),
      T(60,50,700,60,"SaaS relaunch: +38% activation",{fs:34,fw:"800",c:"#fff"}),
      T(60,120,700,40,"A redesign story in three moves.",{fs:17,c:"#cfc6ff"}),
      IM(60,230,730,240,"Product screenshot","#7c5cff","#3b2a78",{r:12}),
      R(60,510,230,140,{f:"#ffffff",s:"#ded8ff",sw:1,r:12}),
      T(80,530,190,50,"+38%",{fs:32,fw:"800",c:"#3b2a78"}),
      T(80,582,190,50,"activation in 60 days",{fs:13,c:"#666",lh:1.4}),
      R(310,510,230,140,{f:"#ffffff",s:"#ded8ff",sw:1,r:12}),
      T(330,530,190,50,"\u221245%",{fs:32,fw:"800",c:"#3b2a78"}),
      T(330,582,190,50,"support tickets",{fs:13,c:"#666",lh:1.4}),
      R(560,510,230,140,{f:"#ffffff",s:"#ded8ff",sw:1,r:12}),
      T(580,530,190,50,"4.8/5",{fs:32,fw:"800",c:"#3b2a78"}),
      T(580,582,190,50,"user rating",{fs:13,c:"#666",lh:1.4}),
      T(60,690,730,36,"What changed",{fs:22,fw:"700",c:"#1a1a1a"}),
      T(60,732,730,120,"Onboarding rebuilt around a single checklist \u2014 three screens instead of nine, with progress saved at every step.",{fs:14,c:"#444",lh:1.6}),
      R(60,880,730,1,{f:"#ded8ff"}),
      T(60,905,730,60,"Team: 2 designers \u00b7 3 engineers \u00b7 8 weeks",{fs:13,c:"#777"}),
      T(60,990,730,26,"Made with Aura Studio",{fs:12,c:"#999",al:"center"})
    ]}]);
  /* ---- 5) Build A Bee — cut & color (guide: build-a-bee) ---- */
  {
    const els = [ T(60,60,560,70,"Build a Bee",{fs:44,fw:"800",c:"#2b2b2b",al:"center"}),
      T(650,80,140,110,"\uD83D\uDC1D",{fs:88}),
      T(60,150,730,30,"Color each part, cut along the edges, and glue your bee together.",{fs:15,c:"#777",al:"center"}),
      E(90,240,300,220,{s:"#333",sw:2}), T(90,470,300,26,"body",{fs:14,c:"#555",al:"center"}),
      E(430,240,180,180,{s:"#333",sw:2}), T(430,430,180,26,"head",{fs:14,c:"#555",al:"center"}),
      E(640,250,130,90,{s:"#333",sw:2}), T(620,350,170,26,"wing",{fs:14,c:"#555",al:"center"}),
      LN(100,560,240,560,{s:"#333",sw:2}), LN(140,590,260,590,{s:"#333",sw:2}), LN(180,620,240,650,{s:"#333",sw:2}),
      T(100,660,300,26,"stripes",{fs:14,c:"#555"}),
      E(470,520,120,70,{s:"#333",sw:2}), T(450,600,170,26,"antenna",{fs:14,c:"#555",al:"center"}),
      E(650,480,110,70,{s:"#333",sw:2}), T(640,560,150,26,"stinger",{fs:14,c:"#555",al:"center"}),
      T(60,990,730,26,"Made with Aura Studio \u00b7 print on card stock for best results",{fs:12,c:"#999",al:"center"}) ];
    tpl("Build a Bee \u2014 Cut & Color","docs","Kids craft page: color and cut bee parts (body, head, wings, stripes) and assemble.","coloring, kids, bee, craft, cut and paste",850,1100,[{bg:"#fdf9ee",elements:els}]);
  }
  /* ---- 6) Build a Bug — ladybug (different) ---- */
  {
    const els = [ T(60,60,560,70,"Build a Ladybug",{fs:44,fw:"800",c:"#7a1f2b",al:"center"}),
      GL(650,80,140,110,"\uD83D\uDC1E",{fs:88}),
      T(60,150,730,30,"Color the pieces, cut them out and build your ladybug.",{fs:15,c:"#777",al:"center"}),
      E(110,230,320,260,{s:"#5a1a24",sw:2}),
      E(120,300,140,140,{s:"#5a1a24",sw:2}),
      E(280,300,140,140,{s:"#5a1a24",sw:2}),
      T(110,500,320,26,"wing covers",{fs:14,c:"#8a4a55",al:"center"}),
      E(480,240,160,150,{s:"#5a1a24",sw:2}),
      T(470,400,190,26,"head",{fs:14,c:"#8a4a55",al:"center"}),
      LN(500,430,560,470,{s:"#5a1a24",sw:2}), LN(560,470,620,430,{s:"#5a1a24",sw:2}),
      T(480,480,190,26,"antennae",{fs:14,c:"#8a4a55",al:"center"}),
      E(120,620,100,70,{s:"#5a1a24",sw:2}), T(100,700,150,26,"leg \u00d76",{fs:14,c:"#8a4a55",al:"center"}),
      E(480,600,140,80,{s:"#5a1a24",sw:2}), T(460,690,190,26,"spots",{fs:14,c:"#8a4a55",al:"center"}) ];
    tpl("Build a Bug \u2014 Cut & Color","docs","Ladybug cut-and-color craft page for kids.","coloring, kids, ladybug, craft",850,1100,[{bg:"#fff5f5",elements:els}]);
  }
  /* ---- 7) Fall Leaves — color & cut (guide) ---- */
  {
    const els = [ T(60,60,730,60,"Fall Leaves \u2014 color & cut",{fs:40,fw:"800",c:"#5a3a1a",al:"center"}),
      T(60,130,730,28,"Twelve leaves \u2014 color them, cut them out, decorate anything.",{fs:15,c:"#8a6a45",al:"center"}) ];
    const pos = [[80,190],[320,180],[580,190],[80,380],[330,370],[600,380],[90,560],[350,560],[600,560],[80,760],[330,760],[590,760]];
    pos.forEach((p,i)=>{
      els.push(E(p[0], p[1], 170, 150, {s:"#8a6a45", sw:2}));
      els.push(LN(p[0]+83, p[1]+150, p[0]+83, p[1]+185, {s:"#8a6a45", sw:2}));
      els.push(T(p[0], p[1]+190, 170, 22, "leaf "+(i+1), {fs:11, c:"#a88a65", al:"center"}));
    });
    els.push(T(60,1000,730,26,"Made with Aura Studio",{fs:12,c:"#b09a78",al:"center"}));
    tpl("Fall Leaves \u2014 Color & Cut","docs","Twelve outline leaves to color and cut \u2014 autumn craft sheet.","coloring, leaves, autumn, craft",850,1100,[{bg:"#fffdf6",elements:els}]);
  }
  /* ---- 8) Fall Leaves — mini 12-up (different) ---- */
  {
    const els = [ T(60,50,730,50,"Mini Leaves \u2014 12-up",{fs:34,fw:"800",c:"#4a6b3a",al:"center"}) ];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++){
      const x = 120 + c*230, y = 130 + r*230;
      els.push(E(x, y, 150, 190, {s:"#4a6b3a", sw:2}));
      els.push(LN(x+75, y+190, x+75, y+215, {s:"#4a6b3a", sw:2}));
    }
    els.push(T(60,1060,730,26,"Cut along the outlines \u00b7 garland, table d\u00e9cor, gift tags",{fs:13,c:"#7a9a6a",al:"center"}));
    tpl("Mini Leaves \u2014 12-up Garland","docs","Small leaf outlines for garlands and gift tags.","leaves, garland, autumn, mini",850,1100,[{bg:"#f7fbf3",elements:els}]);
  }
  /* ---- 9) Recipe Page — script title (guide) ---- */
  {
    const els = [ T(60,50,730,80,"Recipe",{fs:72,ff:"'Brush Script MT', cursive",c:"#222"}),
      T(60,150,300,28,"From the kitchen of",{fs:15,it:true,c:"#777"}),
      LN(60,185,790,185,{s:"#222",sw:2}),
      T(60,210,200,28,"Title:",{fs:16,fw:"600",c:"#333"}), LN(140,238,790,238,{s:"#bbb"}),
      T(60,270,340,28,"Ingredients:",{fs:16,fw:"600",c:"#333"}),
      T(430,270,340,28,"Directions:",{fs:16,fw:"600",c:"#333"}) ];
    for (let i = 0; i < 9; i++) els.push(LN(60, 320 + i*34, 400, 320 + i*34, {s:"#999"}));
    for (let i = 0; i < 9; i++) els.push(LN(430, 320 + i*34, 790, 320 + i*34, {s:"#999"}));
    els.push(T(60,650,200,28,"Notes:",{fs:16,fw:"600",c:"#333"}));
    for (let i = 0; i < 5; i++) els.push(LN(60, 700 + i*36, 790, 700 + i*36, {s:"#999"}));
    els.push(T(60,990,730,26,"Made with Aura Studio",{fs:12,c:"#999",al:"center"}));
    tpl("Recipe Page \u2014 Script Title","docs","Classic recipe page with script title, ingredients/directions columns and notes.","recipe, kitchen, printable, cooking",850,1100,[{bg:"#ffffff",elements:els}]);
  }
  /* ---- 10) Recipe Card — Rustic (different) ---- */
  {
    const els = [ R(40,40,770,1020,{f:"#f5efe4",r:14}),
      R(60,60,730,120,{f:"#e8dfcc",r:10}),
      T(80,80,690,70,"Grandma\u2019s Kitchen",{fs:40,ff:"Georgia, serif",c:"#5a4632",al:"center"}),
      T(80,150,690,26,"RECIPE CARD",{fs:14,c:"#8a7a5a",al:"center",ls:"6"}),
      T(80,220,300,30,"Ingredients",{fs:20,fw:"700",c:"#5a4632"}),
      T(430,220,300,30,"Method",{fs:20,fw:"700",c:"#5a4632"}) ];
    for (let i = 0; i < 8; i++) els.push(LN(80, 280 + i*36, 380, 280 + i*36, {s:"#b8a888"}));
    for (let i = 0; i < 8; i++) els.push(LN(430, 280 + i*36, 770, 280 + i*36, {s:"#b8a888"}));
    els.push(T(80,600,300,30,"Notes",{fs:20,fw:"700",c:"#5a4632"}));
    for (let i = 0; i < 4; i++) els.push(LN(80, 650 + i*40, 770, 650 + i*40, {s:"#b8a888"}));
    els.push(T(80,850,690,60,"Serves: ____  \u00b7  Time: ____  \u00b7  Oven: ____\u00b0F",{fs:16,c:"#8a7a5a"}));
    els.push(T(80,990,690,26,"From our kitchen to yours \u00b7 Aura Studio",{fs:12,c:"#a89878",al:"center"}));
    tpl("Recipe Card \u2014 Rustic Kitchen","docs","Kraft-toned recipe card with columns for ingredients and method.","recipe, rustic, kitchen, card",850,1100,[{bg:"#efe9db",elements:els}]);
  }
  /* ---- 11) Daily Schedule — hourly (guide) ---- */
  {
    const els = [ T(60,50,480,50,"Daily Schedule",{fs:34,fw:"700",c:"#2b3a2e"}),
      T(600,58,120,30,"Date",{fs:16,c:"#5a7a5a"}),
      R(710,52,80,34,{f:"#c8e6c9",r:17}),
      T(60,120,220,30,"Top priorities",{fs:16,fw:"700",c:"#2b3a2e"}) ];
    for (let i = 0; i < 3; i++){
      els.push(E(70, 165 + i*42, 22, 22, {s:"#5a7a5a", sw:2}));
      els.push(R(105, 163 + i*42, 180, 26, {f:"#c8e6c9", r:13}));
    }
    els.push(T(60,320,220,30,"To-do list",{fs:16,fw:"700",c:"#2b3a2e"}));
    for (let i = 0; i < 5; i++){
      els.push(T(70, 355 + i*36, 20, 24, String(i+1)+".", {fs:13, c:"#5a7a5a"}));
      els.push(LN(95, 375 + i*36, 260, 375 + i*36, {s:"#9ab89a"}));
    }
    els.push(T(60,560,220,30,"Notes",{fs:16,fw:"700",c:"#2b3a2e"}));
    for (let i = 0; i < 6; i++) els.push(LN(60, 600 + i*38, 290, 600 + i*38, {s:"#9ab89a"}));
    const times = ["6:00","6:30","7:00","7:30","8:00","8:30","9:00","9:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30","21:00","21:30"];
    times.forEach((t, i) => {
      const y = 120 + i*28;
      els.push(T(320, y, 60, 24, t, {fs:11, c:"#5a7a5a"}));
      els.push(LN(385, y+22, 790, y+22, {s:"#bcd8bc"}));
    });
    els.push(T(60,1080,730,20,"Download free printable planners on bordio.com \u2192 replace with your brand",{fs:10,c:"#a8c0a8",al:"center"}));
    tpl("Daily Schedule \u2014 Hourly","docs","Half-hour schedule 6:00\u201321:30 with priorities, to-dos and notes.","planner, schedule, daily, productivity",850,1100,[{bg:"#fbfdf9",elements:els}]);
  }
  /* ---- 12) Daily Schedule — minimal (different) ---- */
  {
    const els = [ T(60,50,500,54,"Today",{fs:40,fw:"800",c:"#1d3a5f"}),
      R(620,55,170,40,{f:"#e3edf7",r:20}), T(640,64,130,24,"date",{fs:13,c:"#5a7a9a"}) ];
    for (let i = 0; i < 12; i++){
      const y = 140 + i*72;
      els.push(T(60, y, 90, 30, ["6 am","7 am","8 am","9 am","10 am","11 am","12 pm","1 pm","2 pm","3 pm","4 pm","5 pm"][i], {fs:14, fw:"600", c:"#5a7a9a"}));
      els.push(LN(160, y+34, 790, y+34, {s:"#c3d5e8"}));
    }
    els.push(T(60,1030,730,26,"One line per hour \u2014 keep it light.",{fs:12,c:"#8aa8c8",al:"center"}));
    tpl("Daily Schedule \u2014 Minimal Blue","docs","One-hour rows, calm blue palette \u2014 a lighter daily plan.","planner, schedule, minimal",850,1100,[{bg:"#fbfdff",elements:els}]);
  }
  /* ---- 13) Polka labels — 6-up (guide) ---- */
  {
    const els = [ T(60,40,730,44,"Labels \u2014 6-up (3.3\u00d74\u2033)",{fs:26,fw:"700",c:"#333"}) ];
    const cols = ["#5b8def","#ef5da8","#8e44ad","#6aa84f","#c0392b","#2e7d32"];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++){
      const x = 70 + c*360, y = 110 + r*320;
      els.push(R(x, y, 340, 290, {f: cols[r*2+c], r:8}));
      els.push(R(x+28, y+30, 284, 230, {f:"#ffffff", r:14}));
      els.push(T(x+40, y+130, 260, 40, "Label", {fs:26, c:"#444", al:"center"}));
    }
    els.push(T(60,1090,730,20,"Write-on labels \u00b7 print on sticker paper",{fs:11,c:"#999",al:"center"}));
    tpl("Labels \u2014 Polka 6-up","marketing","Six bold label frames \u2014 print on sticker paper and cut.","labels, print, stickers",850,1100,[{bg:"#ffffff",elements:els}]);
  }
  /* ---- 14) Labels — pastel (different) ---- */
  {
    const els = [ T(60,40,730,44,"Pastel Labels \u2014 6-up",{fs:26,fw:"700",c:"#6a5a6a"}) ];
    const cols = ["#ffe5ec","#e2ece9","#fff3e0","#e8eaf6","#f3e5f5","#e0f2f1"];
    const brd = ["#c48b9f","#7aa89a","#c9a227","#7986cb","#a56baf","#4db6ac"];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++){
      const x = 70 + c*360, y = 110 + r*320, i = r*2+c;
      els.push(R(x, y, 340, 290, {f: cols[i], r:8}));
      els.push(R(x+28, y+30, 284, 230, {f:"#ffffff", r:14, s: brd[i], sw:2}));
      els.push(T(x+40, y+130, 260, 40, "Label", {fs:26, c:"#666", al:"center"}));
    }
    els.push(T(60,1090,730,20,"Soft pastel set \u00b7 jam jars, pantry, gifts",{fs:11,c:"#a89aa8",al:"center"}));
    tpl("Labels \u2014 Pastel 6-up","marketing","Six soft-pastel label frames with colored borders.","labels, pastel, print",850,1100,[{bg:"#fdfcfe",elements:els}]);
  }
  /* ---- 15) Album layouts — 12×36 pink (guide) ---- */
  {
    const els = [ R(0,0,1320,440,{f:"#f3e3e3"}),
      T(40,20,400,30,"12\u00d736 spreads \u2014 pink collection",{fs:20,fw:"700",c:"#7a4a4a"}) ];
    const cells = [[40,60,300,340],[360,60,220,160],[360,230,220,170],[600,60,160,340],[780,60,250,170],[1050,60,230,340],[1050,210,230,190],[600,230,160,170],[40,60,120,340]];
    cells.forEach((c,i)=>{
      const pinks = ["#c98a8a","#e8c8c8","#8a5555","#f0dede","#a86a6a","#d4a0a0","#b88a8a","#e8d0d0","#c98a8a"];
      els.push(R(c[0], c[1], c[2], c[3], {f: pinks[i % pinks.length], r:4}));
    });
    els.push(T(40,415,400,20,"wedding \u00b7 family \u00b7 newborn \u2014 swap in your photos",{fs:11,c:"#a87a7a"}));
    tpl("Album Layouts \u2014 12\u00d736 Pink","marketing","Photography album spread (12\u00d736 in) \u2014 pink mosaic of photo wells.","album, photography, 12x36, wedding",1320,440,[{bg:"#f8f0f0",elements:els}]);
  }
  /* ---- 16) Album layouts — mono (different) ---- */
  {
    const els = [ R(0,0,1320,440,{f:"#f2f2f2"}),
      T(40,20,400,30,"12\u00d736 spreads \u2014 mono",{fs:20,fw:"700",c:"#333"}) ];
    const cells = [[40,60,260,340],[320,60,300,160],[320,240,140,160],[480,240,140,160],[640,60,300,340],[960,60,160,160],[1140,60,140,160],[960,240,320,160],[40,415,600,20]];
    const grays = ["#2b2b2b","#e8e8e8","#8a8a8a","#d4d4d4","#3a3a3a","#c0c0c0","#5a5a5a","#eee","#bbb"];
    cells.forEach((c,i)=>{ if (c[3] > 20) els.push(R(c[0], c[1], c[2], c[3], {f: grays[i % grays.length], r:2})); });
    els.push(T(40,415,400,20,"black & white editorial spread",{fs:11,c:"#888"}));
    tpl("Album Layouts \u2014 12\u00d736 Mono","marketing","Black-and-white editorial album spread (12\u00d736 in).","album, photography, mono, editorial",1320,440,[{bg:"#fafafa",elements:els}]);
  }
  /* ---- 17) Business infographic — 4 steps (guide) ---- */
  {
    const els = [ T(60,40,1160,50,"Business infographic \u2014 four steps",{fs:30,fw:"800",c:"#222",al:"center"}) ];
    const pos = [[80,140],[740,140],[80,430],[740,430]];
    const num = ["01","02","03","04"];
    const cols = ["#5b8def","#ef5da8","#f2a33c","#41b883"];
    pos.forEach((p,i)=>{
      els.push(R(p[0], p[1], 460, 220, {f:"#ffffff", s:"#e2e6ef", sw:1, r:14}));
      els.push(R(p[0], p[1], 64, 64, {f: cols[i], r:32}));
      els.push(T(p[0], p[1]+12, 64, 40, num[i], {fs:22, fw:"800", c:"#fff", al:"center"}));
      els.push(T(p[0]+84, p[1]+16, 360, 34, "Step title",{fs:20, fw:"700", c:"#222"}));
      els.push(T(p[0]+84, p[1]+58, 360, 120, "Describe this step in one or two short sentences \u2014 what happens and why it matters.",{fs:14, c:"#666", lh:1.5}));
    });
    els.push(E(540,290,200,200,{f:"#41b883"}));
    els.push(T(540,350,200,90,"business\ninfographics",{fs:20,fw:"700",c:"#fff",al:"center",lh:1.2}));
    els.push(T(60,700,1160,20,"Replace the step titles and copy \u2014 colors follow your Brand Kit",{fs:12,c:"#999",al:"center"}));
    tpl("Business Infographic \u2014 4 Steps","presentation","Four-step process infographic with numbered cards around a central hub.","infographic, business, steps, presentation",1280,720,[{bg:"#f7f8fc",elements:els}]);
  }
  /* ---- 18) Infographic — timeline (different) ---- */
  {
    const els = [ T(60,50,1160,50,"Project timeline",{fs:30,fw:"800",c:"#222",al:"center"}),
      LN(120,380,1160,380,{s:"#c9d2e8",sw:4}) ];
    const x0 = [200,450,700,950];
    const cols = ["#7c5cff","#41b883","#f2a33c","#ef5da8"];
    x0.forEach((x,i)=>{
      els.push(E(x-28, 352, 56, 56, {f: cols[i]}));
      els.push(T(x-28, 366, 56, 30, "Q"+(i+1), {fs:16, fw:"800", c:"#fff", al:"center"}));
      els.push(T(x-90, 240, 180, 30, "Milestone "+(i+1), {fs:16, fw:"700", c:"#222", al:"center"}));
      els.push(T(x-90, 272, 180, 60, "What ships this quarter.",{fs:12, c:"#666", al:"center", lh:1.4}));
    });
    els.push(T(60,650,1160,20,"Horizontal roadmap \u2014 four quarters",{fs:12,c:"#999",al:"center"}));
    tpl("Infographic \u2014 Quarterly Timeline","presentation","Four-quarter roadmap with milestone markers on a timeline.","timeline, roadmap, infographic, quarters",1280,720,[{bg:"#fbfcff",elements:els}]);
  }
  /* ---- 19) Tech blog — homepage (guide) ---- */
  {
    const els = [ R(0,0,1280,64,{f:"#1b1f27"}),
      T(30,16,160,32,"techblog",{fs:20,fw:"800",c:"#fff"}),
      T(200,20,600,24,"Reviews \u00b7 How-to \u00b7 News \u00b7 Deals",{fs:13,c:"#a8b0bc"}),
      IM(0,64,1280,300,"Hero image \u2014 latest review","#3a4a5c","#1b1f27"),
      T(40,400,700,40,"The 25 best gadgets we tested this year",{fs:26,fw:"800",c:"#111"}) ];
    for (let i = 0; i < 4; i++){
      const x = 40 + i*305;
      els.push(IM(x, 470, 285, 150, "Article image","#5a6a7a","#2a3a4a",{r:8}));
      els.push(T(x, 634, 285, 50, "Article title goes here in two lines",{fs:15, fw:"700", c:"#222", lh:1.3}));
    }
    tpl("Tech Blog \u2014 Homepage","marketing","Tech blog homepage: header, hero story and a four-card article grid.","blog, tech, homepage, magazine",1280,720,[{bg:"#ffffff",elements:els}]);
  }
  /* ---- 20) Tech blog — magazine (different) ---- */
  {
    const els = [ T(40,30,600,44,"The Weekly Byte",{fs:30,fw:"800",c:"#0a3d62"}),
      T(660,36,580,30,"Issue 42 \u00b7 this week in tech",{fs:13,c:"#666",al:"right"}),
      LN(40,84,1240,84,{s:"#0a3d62",sw:2}) ];
    for (let c = 0; c < 3; c++){
      const x = 40 + c*410;
      els.push(IM(x, 110, 390, 200, "Cover story","#4a90d9","#0a3d62",{r:6}));
      els.push(T(x, 324, 390, 30, "COVER STORY",{fs:11, fw:"700", c:"#0a3d62", ls:"2"}));
      els.push(T(x, 350, 390, 60, "Big headline for the lead article of the week",{fs:17, fw:"700", c:"#111", lh:1.3}));
      els.push(T(x, 416, 390, 60, "A short standfirst summarising the story in two sentences.",{fs:12, c:"#555", lh:1.5}));
    }
    for (let i = 0; i < 4; i++){
      const y = 500 + i*55;
      els.push(R(40, y, 70, 44, {f:"#d9e4f1", r:4}));
      els.push(T(124, y+4, 1116, 36, "Short headline for story number "+(i+1)+" \u2014 one line",{fs:14, fw:"600", c:"#222"}));
    }
    tpl("Tech Blog \u2014 Magazine Layout","marketing","Magazine-style tech blog front page: cover story plus a briefing list.","blog, magazine, tech, editorial",1280,720,[{bg:"#ffffff",elements:els}]);
  }
  /* ---- 21) To Do — pastel floral (guide) ---- */
  {
    const els = [ T(60,50,420,60,"To Do List",{fs:40,ff:"'Comic Sans MS', 'Segoe UI', cursive",c:"#4a3a4a"}),
      R(560,58,200,40,{f:"#c8d8e8",r:20}), T(580,66,160,24,"date",{fs:13,c:"#5a6a7a"}),
      GL(760,30,120,110,"\uD83C\uDF3C",{fs:80}) ];
    const quads = [[60,180,"MUST DO","#f8dce4"],[450,180,"SHOULD DO","#e8ddd0"],[60,600,"COULD DO","#d8e4f0"],[450,600,"IF I HAVE TIME","#e4dcf0"]];
    quads.forEach(q=>{
      els.push(R(q[0], q[1], 340, 380, {f: q[3], r:14}));
      els.push(T(q[0]+24, q[1]+24, 290, 30, q[2], {fs:15, fw:"700", c:"#5a4a5a", ls:"2"}));
      for (let i = 0; i < 5; i++){
        els.push(R(q[0]+24, q[1]+72 + i*56, 20, 20, {f:"#ffffff", s:"#b8a8b8", sw:1}));
        els.push(LN(q[0]+56, q[1]+88 + i*56, q[0]+316, q[1]+88 + i*56, {s:"#b8a8b8"}));
      }
    });
    GL(60,980,140,100,"\uD83C\uDF3C",{fs:70});
    tpl("To Do \u2014 Pastel Floral","docs","Four-quadrant pastel to-do board with checkboxes and floral accents.","todo, planner, pastel, checklist",850,1100,[{bg:"#fdfbfc",elements:els}]);
  }
  /* ---- 22) To Do — bold checklist (different) ---- */
  {
    const els = [ T(60,50,600,60,"TODAY\u2019S HITS",{fs:44,fw:"900",c:"#111"}),
      T(60,120,600,30,"Cross them off. Every single one.",{fs:16,c:"#666"}) ];
    for (let i = 0; i < 7; i++){
      const y = 180 + i*108;
      els.push(R(60, y, 720, 92, {f:"#f4f4f4", r:12}));
      els.push(R(84, y+26, 40, 40, {f:"#111", r:6}));
      els.push(T(84, y+34, 40, 24, "\u2713", {fs:16, fw:"900", c:"#f4f4f4", al:"center"}));
      els.push(T(148, y+22, 600, 30, "Task "+(i+1)+" \u2014 what needs to happen", {fs:18, fw:"700", c:"#111"}));
      els.push(T(148, y+54, 600, 24, "notes / deadline / who", {fs:12, c:"#888"}));
    }
    tpl("To Do \u2014 Bold Checklist","docs","High-contrast checklist \u2014 seven task cards with bold checkboxes.","todo, checklist, bold, productivity",850,1100,[{bg:"#ffffff",elements:els}]);
  }
  return S;
})();
if (typeof window !== "undefined") window.AURA_SUITE_TEMPLATES = AURA_SUITE_TEMPLATES;
