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
FILES = ["index.html", "styles.css", "templates.js", "zip.js", "app.js", "admin.html"]

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
for name in ["templates.js", "zip.js", "app.js"]:
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
    const w = window.open("", "_blank");
    if (!w) { alert("Allow popups to open the Admin Agent."); return; }
    w.document.open(); w.document.write(ADMIN_HTML); w.document.close();
  };
})();
</script>
""" % json.dumps(admin).replace("</", "<\\/")
idx = idx.replace("</body>", inject + "</body>")

out_dir = os.path.join(ROOT, "dist")
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "aura-studio-single.html")
with open(out_path, "w", encoding="utf-8", newline="\n") as fh:
    fh.write(idx)

print(f"Built {out_path} ({len(idx):,} chars)")

# sanity checks
assert "ADMIN_HTML" in idx, "admin not embedded"
assert '<script src=' not in idx, "unresolved external script reference"
assert 'href="styles.css"' not in idx, "unresolved external stylesheet"
print("Sanity checks passed.")
