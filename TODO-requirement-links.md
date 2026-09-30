# TODO: System requirement links (English crypto store)

## Background
The Myanmar store is switching its product-detail "system requirements" section
from hand-written Burmese spec tables to official vendor spec links:
- If an official link exists → show a "📋 Official System Requirements" button
- If no official link → hide the section entirely
(User decision, 2026-09-30. His words: "Link မရှိရင် section ကို မပြနဲ့")

## Status of the English side
- The English export (`tools/export_en.py`) currently skips requirements
  entirely (`ec.REQUIREMENTS = {}`) because the old tables were Burmese-only.
- The new official links are language-neutral URLs, so they CAN be shown
  on the English store — the button label is already English.

## What to do (after the Myanmar side is done and deployed)
1. Check that `~/workspace/software-store/tools/official_links.json` exists
   (research task running 2026-09-30 in the Myanmar store work).
2. The English export imports `export_catalog` and will pick up
   `OFFICIAL_LINKS` / the `reqlink` field automatically — verify with a
   re-export that `dist/data/products/<pid>.json` contains `reqlink`.
3. Add the link-button rendering to the English `dist/app.js` detail view
   (mirror the Myanmar `app.js`: `if (d.reqlink)` → `.req-link` button;
   no section at all when absent) + the `.req-link` CSS in `dist/styles.css`.
4. Re-export EN, deploy (crypto repo workflow: work on `master`, deploy to
   `main` via `git show master:dist/app.js > app.js` etc.), verify live.
5. Hard-refresh reminder (Ctrl+F5) when telling him.
