# Seating Chart

A static seating-chart tool for GitHub Pages. Pick a venue and room, paste a guest list, drag people between seats, and share the result as a link.

## Deploy
1. Create a GitHub repo named `seatingchart` and upload these files to the root.
2. Repo **Settings → Pages → Source: Deploy from a branch → `main` / root**.
3. Open `https://<your-username>.github.io/seatingchart/`.

## How sharing works
The whole chart is compressed into the link after `#c=`. Nothing is stored on a server, and the part after `#` is never sent to GitHub, so a chart can only be opened by someone who has its link. Every edit updates the link in the address bar. To send your version, click **Copy share link**. If someone edits it and sends theirs back, that is a new, separate version — the original link is unchanged.

## Custom rooms
The homepage has a **Set up your own room** section: pick the number of tables (1–20) and the seats at each (2–24). Tables with 6+ seats get one seat at each end and the rest split across the sides; smaller tables use the sides only. A custom room's layout is stored inside its share link, so nothing needs to be added to the code.

## Adding venues, rooms, tables
Edit `js/venues.js`. Each room has a list of `tables`; `rectTable({ id, label, x, y, perSide, ends })` builds a rectangular table with seats numbered clockwise from the left end. Add more `rectTable(...)` entries (with different `x`/`y`) for rooms with several tables. The room auto-fits the screen.

Note: links store seats by position, so changing the seat count of an existing room will shift people in old links.

## Files
- `index.html` – picker + editor
- `js/app.js` – UI, drag/snap/swap, undo, CSV, print
- `js/share.js` – link encoding (deflate + base64url)
- `js/paste.js` – parses pasted Excel/Sheets/CSV rows
- `js/venues.js` – venue/room/table definitions

## Cache busting
Phones and GitHub Pages cache CSS/JS for a while. After changing any file in `css/` or `js/`, bump the `?v=` tag everywhere it appears (`index.html`, the imports at the top of `js/app.js` and `js/share.js`), e.g.:

```sh
V=$(date +%s); sed -i -E "s/\?v=[A-Za-z0-9]+/?v=$V/g" index.html js/app.js js/share.js
```

## SEO
- `sitemap.xml` – submit `https://patrickpoulin.github.io/seatingchart/sitemap.xml` in Google Search Console (URL-prefix property for `https://patrickpoulin.github.io/seatingchart/`). Update `<lastmod>` when the homepage content changes.
- `llms.txt` – plain-language summary for AI assistants.
- `og-image.png` – link preview image (1200×630). Title, description, Open Graph tags and JSON-LD (WebApplication + FAQPage) are in `index.html`; keep the FAQ JSON-LD in sync with the visible FAQ.
- `robots.txt` only works at the domain root (`patrickpoulin.github.io/robots.txt`), so it would live in a `patrickpoulin.github.io` repo, not here. Without one, everything is crawlable, which is what we want.
