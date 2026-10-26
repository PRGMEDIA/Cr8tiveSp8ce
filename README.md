# 🎨 Aura Studio — Local Creative Suite

A Canva-style design studio that runs **entirely in your browser** — no server, no install, no internet required. Just open `index.html`.

## Starting the app
- Double-click **`index.html`** (or open it in Chrome / Edge / Firefox).
- Everything runs locally. Designs autosave to your browser.

## What's inside
| File | Purpose |
|---|---|
| `index.html` | The studio — template gallery + full editor |
| `templates.js` | Built-in template library (36 templates, 10 categories) |
| `app.js` | Editor engine + exporters |
| `zip.js` | Minimal ZIP writer (powers `.zip` page export & real `.odt`) |
| `admin.html` | **Local Admin Agent** — template manager, updates, upgrades |
| `styles.css` | UI styling |

## Template categories
📱 Social Media · 📰 Magazine · 📚 Books · 📄 Documents (LibreOffice) · 🖥 Presentations · ✒️ Logos · 🖼 Posters · 🎬 Marketing Videos (storyboards) · 🎞 Photo Collages · 📣 Print & Marketing

## Editing
- **Double-click text** to edit · drag to move (with snapping guides) · corner handles to resize
- Add text, headings, shapes, lines, images (your own files), and emoji/icons
- Multi-page: use **+** in the bottom strip (presentations, books, storyboards)
- Shortcuts: `Del` delete · `Ctrl+D` duplicate · `Ctrl+Z/Y` undo/redo · arrows nudge · `Ctrl+S` save

## Exporting
- **PNG** (current page or all pages as a zip), **SVG** vector
- **.odt / .fodt** — real OpenDocument files that open directly in **LibreOffice Writer** (text, fonts, colors, alignment preserved). Document-category templates are built for this.
- **Print / Save as PDF** — one page per sheet
- Project files as `.json` (share, back up, re-import)

## Admin Agent (`admin.html`)
Open via the **⚙ Admin** button. It manages the app locally:

- **Status** — versions, template counts, autosave state
- **Updates & upgrades** — check `aura-update.json` (place it next to the app files), check any URL, or import an update package. An update package looks like:
  ```json
  {
    "version": "1.1.0",
    "notes": "Adds 5 holiday templates.",
    "templates": [ { "name": "Holiday Card", "cat": "marketing", "w": 850, "h": 1100,
                     "pages": [ { "bg": "#ffffff", "elements": [] } ] } ]
  }
  ```
  Applying an update installs/refreshes its templates instantly in the gallery.
- **Template manager** — import/export template packs as JSON
- **Maintenance** — clear autosave, remove custom templates, factory reset

## Custom template packs
Create templates as JSON (same shape as above) and share them — import via Admin → Template manager.
