#!/usr/bin/env python3
"""Build the V1 AURASTD PRG template pack (JSON upload) from the 13 supplied JPGs."""
import base64, json, os, datetime

SRC = r"C:\Users\villa\.lmstudio\scratchpads\sa"
REPO_TP = r"template-packs"
DESK = r"C:\Users\villa\Desktop\AuraStudio-Docs\template-packs"

META = [
    ("V1_AURASTD_BUSCARDTEMP_PRG.jpg",      "Business Card Sheet — 3.5\u00d72\u2033 (8.5\u00d711)", "marketing", "business card, print sheet, drag and drop, 10-up", "Ten 3.5\u00d72\u2033 business cards on a letter sheet with a drag & drop design area \u2014 landscape and portrait card mockups included."),
    ("V1_AURASTD_CASESTUDY_PRG.jpg",        "Case Study Template", "docs", "case study, portfolio, project showcase", "A beginner-friendly case study layout to showcase projects \u2014 replace the sample images and text with your own."),
    ("V1_AURASTD_COLORING_BEE_PRG.jpg",     "Coloring Page — Build A Bee", "docs", "coloring, kids, bee, craft, cut and paste", "Cut-and-build bee activity page for kids \u2014 color, cut along the dashed lines and assemble."),
    ("V1_AURASTD_COLORING_LEAVES_PRG.jpg",  "Coloring Page — Fall Leaves", "docs", "coloring, leaves, autumn, fall, craft", "Twelve fall-leaf outlines to color and cut \u2014 oak, maple and simple leaf shapes."),
    ("V1_AURASTD_COLORING_RECIPE_PRG.jpg",  "Recipe Card — Printable", "docs", "recipe, kitchen, printable, planner", "Printable recipe page \u2014 title, ingredients, directions and notes with ruled lines."),
    ("V1_AURASTD_COLORING_XMAS_PRG.jpg",    "Christmas Templates — Coloring Set", "docs", "christmas, coloring, holiday, xmas", "Christmas printable coloring set \u2014 gift, hat, tree, stocking, candy cane, wreath and bauble."),
    ("V1_AURASTD_COLORING_XMASPACK_PRG.jpg","Christmas Templates — Free Pack", "docs", "christmas, coloring, pack, holiday, kids", "Bigger Christmas pack \u2014 polar bear, snow globes, ornament, snowman, tree and gingerbread templates."),
    ("V1_AURASTD_DAILYSCHEDULE_PRG.jpg",    "Daily Schedule Planner", "docs", "planner, schedule, daily, productivity", "Hour-by-hour daily schedule (6:00\u201321:30) with top priorities, to-do list and notes panel."),
    ("V1_AURASTD_LABELTEMP_PRG.jpg",        "Polka Dot Labels — 6-up", "marketing", "labels, polka dot, print, tags", "Six polka-dot label frames in assorted colors \u2014 print, cut and write."),
    ("V1_AURASTD_PINKTEMP_PRG.jpg",         "12\u00d736 Album Layouts — Pink Collection", "marketing", "album, photography, 12x36, pink, wedding", "Photography album layout set (12\u00d736 spreads) in soft pink tones \u2014 wedding and family collections."),
    ("V1_AURASTD_TASKMANAGEMENT_PRG.jpg",   "Business Infographic — 4 Steps", "presentation", "infographic, business, steps, presentation", "Four-step business infographic with numbered gradient cards around a central hub."),
    ("V1_AURASTD_TECHTEMP_PRG.jpg",         "Tech Blog Templates", "marketing", "blog, tech, web, article", "Tech blog homepage and article layout previews \u2014 grid, list and magazine styles."),
    ("V1_AURASTD_TODO_PRG.jpg",             "To Do List — Pastel Floral", "docs", "todo, planner, pastel, floral, checklist", "Pastel to-do board \u2014 Must Do / Should Do / Could Do / If I Have Time with checkboxes and floral accents."),
]

def page_size(w, h):
    r = w / h
    def close(a, b, tol=0.03): return abs(r - a) <= tol * a
    if close(8.5/11):  return 850, 1100
    if close(2/3):     return 800, 1200
    if close(1.0):     return 900, 900
    if close(16/9):    return 1280, 720
    if close(4/3):     return 1024, 768
    # generic: scale so height = 1100, width rounded to tens (min 400)
    return max(400, int(round(1100 * r / 10.0)) * 10), 1100

templates = []
for fname, name, cat, tags, desc in META:
    p = os.path.join(SRC, fname)
    raw = open(p, "rb").read()
    b64 = base64.b64encode(raw).decode("ascii")
    datauri = "data:image/jpeg;base64," + b64
    # dimensions from JPEG SOF marker (simple scan)
    w = h = None
    i = 2
    while i < len(raw) - 8:
        if raw[i] != 0xFF: break
        marker = raw[i+1]
        if marker in (0xC0, 0xC1, 0xC2, 0xC3):
            h = raw[i+5]*256 + raw[i+6]; w = raw[i+7]*256 + raw[i+8]; break
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7: i += 2; continue
        seglen = raw[i+2]*256 + raw[i+3]; i += 2 + seglen
    if not w or not h: w, h = 850, 1100
    pw, ph = page_size(w, h)
    templates.append({
        "name": name,
        "cat": cat,
        "desc": desc,
        "tags": tags,
        "w": pw, "h": ph,
        "pages": [{
            "bg": "#ffffff",
            "elements": [{
                "type": "image", "id": "bg1",
                "x": 0, "y": 0, "w": pw, "h": ph,
                "src": datauri, "fit": "cover", "radius": 0, "opacity": 1, "filter": "none",
                "note": "Full-design artwork imported from V1 AURASTD PRG. Add text/shape elements on top; use Crop to trim."
            }]
        }],
        "source": fname,
        "sourcePx": w, "sourcePxH": h,
    })

pack = {
    "type": "aura-template-pack",
    "version": 1,
    "pack": "V1 AURASTD PRG \u2014 13 print & digital templates",
    "created": datetime.datetime.now().isoformat(timespec="seconds"),
    "notes": "Imported from the supplied V1 AURASTD PRG artwork. Each template embeds its original artwork as a full-page image layer \u2014 pixel-perfect, with the studio\u2019s text/shape/rotate/crop tools available on top.",
    "templates": templates,
}
update = {
    "version": "2.4.0-prg1",
    "notes": "V1 AURASTD PRG template drop \u2014 13 templates (business card sheet, case study, coloring pages \u00d75, daily schedule, labels, album layouts, infographic, tech blog, to-do list). Imported as full-page artwork layers.",
    "templates": templates,
}

os.makedirs(REPO_TP, exist_ok=True)
os.makedirs(DESK, exist_ok=True)
for path in (os.path.join(REPO_TP, "v1-aurastd-prg-pack.json"), os.path.join(DESK, "AuraStudio_TemplatePack_V1_PRG.json")):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(pack, f, indent=1, ensure_ascii=False)
for path in (os.path.join(REPO_TP, "v1-aurastd-prg-update.json"), os.path.join(DESK, "AuraStudio_UpdatePackage_V1_PRG.json")):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(update, f, indent=1, ensure_ascii=False)

sz = os.path.getsize(os.path.join(REPO_TP, "v1-aurastd-prg-pack.json"))
print("templates:", len(templates))
print("pack size:", round(sz/1024), "KB")
print("page sizes:", [(t["name"][:20], t["w"], t["h"]) for t in templates])
print("JSON valid: parsed back", len(json.loads(json.dumps(pack))["templates"]), "templates")
