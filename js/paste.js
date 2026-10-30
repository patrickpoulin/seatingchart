// Parses pasted guest lists: rows copied from Excel/Google Sheets (tab-separated) or CSV.
// Column 1 = Name, column 2 = Company. A header row ("Name, Company") is skipped.

function splitCsvLine(line) {
  const out = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

export function parseGuests(text) {
  const rows = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (l.includes('\t') ? l.split('\t') : splitCsvLine(l)))
    .map((cols) => cols.map((c) => c.trim()));

  if (rows.length && /^(full\s*)?name$/i.test(rows[0][0] || '')) rows.shift();

  return rows
    .map((cols) => ({ name: cols[0] || '', company: cols[1] || '' }))
    .filter((g) => g.name || g.company);
}
