# Seating Chart

A static seating-chart tool for GitHub Pages. Pick a venue and room, paste a guest list, drag people between seats, and share the result as a link.

## Deploy
1. Create a GitHub repo named `seatingchart` and upload these files to the root.
2. Repo **Settings → Pages → Source: Deploy from a branch → `main` / root**.
3. Open `https://<your-username>.github.io/seatingchart/`.

## How sharing works
The whole chart is compressed into the link after `#c=`. Nothing is stored on a server, and the part after `#` is never sent to GitHub, so a chart can only be opened by someone who has its link. Every edit updates the link in the address bar. To send your version, click **Copy share link**. If someone edits it and sends theirs back, that is a new, separate version — the original link is unchanged.

## Adding venues, rooms, tables
Edit `js/venues.js`. Each room has a list of `tables`; `rectTable({ id, label, x, y, perSide, ends })` builds a rectangular table with seats numbered clockwise from the left end. Add more `rectTable(...)` entries (with different `x`/`y`) for rooms with several tables. The room auto-fits the screen.

Note: links store seats by position, so changing the seat count of an existing room will shift people in old links.

## Files
- `index.html` – picker + editor
- `js/app.js` – UI, drag/snap/swap, undo, CSV, print
- `js/share.js` – link encoding (deflate + base64url)
- `js/paste.js` – parses pasted Excel/Sheets/CSV rows
- `js/venues.js` – venue/room/table definitions
