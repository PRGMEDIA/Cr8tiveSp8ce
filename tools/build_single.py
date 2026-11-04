#!/usr/bin/env python3
"""
Aura Studio — single-file bundle builder.

Merges styles.css, templates.js, zip.js and app.js into one standalone
HTML file (dist/aura-studio-single.html) with the Admin Agent embedded.
Used locally and by GitHub Actions on every push.

Usage:  python tools/build_single.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = ["index.html", "styles.css", "assets-s3-logo.js", "templates.js", "zip.js", "app.js", "admin.html"]

content = {}
for name in FILES:
    with open(os.path.join(ROOT, name), "r", encoding="utf-8") as fh:
        content[name] = fh.read()

idx = content["index.html"]

# inline the stylesheet
idx = idx.replace(
    '<link rel="stylesheet" href="styles.css">',
    "<style>\n" + content["styles.css"] + "\n</style>",
)

# inline the scripts, in order
for name in ["assets-s3-logo.js", "templates.js", "zip.js", "app.js"]:
    idx = idx.replace(
        f'<script src="{name}"></script>',
        "<script>\n" + content[name] + "\n</script>",
    )

# embed the (self-contained) admin agent and rebind the Admin button
# NOTE: "</" must be escaped as "<\\/" inside inline <script> strings, otherwise
# the HTML parser terminates the script block at the first </script> in the
# embedded admin source. ("<\\/" is a valid JS escape for "/".)
admin = content["admin.html"]
inject = """
<script>
/* --- single-file build: admin embedded --- */
(function(){
  const ADMIN_HTML = %s;
  const btn = document.getElementById("btnAdmin");
  btn.onclick = function(){
    // Phase II change (v1.6.2): popup-free. Renders the Admin Agent inside an
    // isolated srcdoc iframe overlay — styles are sandboxed, localStorage is
    // shared with the app, and no popup permission is ever required.
    let ov = document.getElementById("adminOverlaySF");
    if (ov) ov.remove();
    ov = document.createElement("div");
    ov.id = "adminOverlaySF";
    ov.style.cssText = "position:fixed;inset:0;background:rgba(5,6,15,.82);z-index:300;display:flex;align-items:center;justify-content:center";
    const card = document.createElement("div");
    card.style.cssText = "width:min(1040px,94vw);height:min(780px,92vh);background:#141831;border:1px solid #2a2f55;border-radius:14px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.6)";
    card.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid #2a2f55;font:600 14px Segoe UI,sans-serif;color:#eef0ff"><span>\u2699 Admin Agent</span><button id="admCls" style="background:#171b31;border:1px solid #2a2f55;color:#eef0ff;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px">\u2715 Close</button></div>';
    const ifr = document.createElement("iframe");
    ifr.style.cssText = "flex:1;border:none;background:#0f1222";
    ifr.setAttribute("title", "Aura Studio Admin Agent");
    ifr.srcdoc = ADMIN_HTML;
    card.appendChild(ifr);
    ov.appendChild(card);
    document.body.appendChild(ov);
    document.getElementById("admCls").onclick = () => ov.remove();
  };
})();
</script>
""" % json.dumps(admin).replace("</", "<\\/")
# sanity checks BEFORE admin injection: the embedded Admin HTML legitimately
# contains <script src="assets-s3-logo.js"> (resolves against the opener when
# the popup opens), so external-ref validation must run on the pre-injection page.
assert '<script src=' not in idx, "unresolved external script reference"
assert 'href="styles.css"' not in idx, "unresolved external stylesheet"

idx = idx.replace("</body>", inject + "</body>")

out_dir = os.path.join(ROOT, "dist")
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "aura-studio-single.html")
with open(out_path, "w", encoding="utf-8", newline="\n") as fh:
    fh.write(idx)

print(f"Built {out_path} ({len(idx):,} chars)")

# post-injection sanity checks
assert "ADMIN_HTML" in idx, "admin not embedded"
print("Sanity checks passed.")
