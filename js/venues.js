// Venue and room definitions, plus the layout engine.
//
// A table is a rectangle with seats on its two long sides and (optionally) one at each end.
// Seats are numbered clockwise: head (left end) → top side left-to-right → foot (right end)
// → bottom side right-to-left. On phones every table is turned 90° so long tables run down
// the screen, and tables are stacked in one column.
//
// To add a venue room: add an entry to `rooms`. Custom rooms built on the homepage are
// stored inside the share link instead (see customRoom()).

export const CARD_W = 132;   // seat card width
export const CARD_H = 60;    // seat card height

export const CUSTOM_LIMITS = { tables: [1, 20], seats: [2, 24] };

/** A rectangular table with the same number of seats on both long sides. */
export function rectTable({ id, label, perSide, ends = 1 }) {
  return { id, label, top: perSide, bottom: perSide, ends: ends ? 1 : 0 };
}

/**
 * A table with `n` seats arranged automatically:
 * 6+ seats → one at each end, the rest split across the sides (12 → 1 + 5 + 1 + 5);
 * fewer → sides only (4 → 2 + 2, 5 → 3 + 2).
 */
export function seatsTable({ id, label, seats }) {
  const ends = seats >= 6 ? 1 : 0;
  const sides = seats - ends * 2;
  return { id, label, top: Math.ceil(sides / 2), bottom: Math.floor(sides / 2), ends };
}

export const tableSeatCount = (t) => t.top + t.bottom + t.ends * 2;

/** Geometry for one table, relative to its own top-left corner (including its seats). */
function layoutTable(t, orientation) {
  const seats = [];
  const long = Math.max(t.top, t.bottom, 1);
  const centers = (n, step) => {
    const offset = ((long - n) * step) / 2; // centre the shorter side
    return Array.from({ length: n }, (_, i) => offset + step * (i + 0.5));
  };
  const push = (x, y) => seats.push({ id: `${t.id}-${seats.length + 1}`, x, y });

  let tw, th, minX, minY, maxX, maxY;
  if (orientation === 'wide') {
    const step = CARD_W + 22, gap = 14;
    tw = long * step; th = 120;
    const top = centers(t.top, step), bottom = centers(t.bottom, step);
    if (t.ends) push(-gap - CARD_W / 2, th / 2);
    top.forEach((x) => push(x, -gap - CARD_H / 2));
    if (t.ends) push(tw + gap + CARD_W / 2, th / 2);
    [...bottom].reverse().forEach((x) => push(x, th + gap + CARD_H / 2));
  } else {
    // tall: the wide table turned 90° clockwise (head → top, top side → right, foot → bottom, bottom side → left)
    const step = CARD_H + 16, gap = 10;
    tw = 64; th = long * step;
    const right = centers(t.top, step), left = centers(t.bottom, step);
    if (t.ends) push(tw / 2, -gap - CARD_H / 2);
    right.forEach((y) => push(tw + gap + CARD_W / 2, y));
    if (t.ends) push(tw / 2, th + gap + CARD_H / 2);
    [...left].reverse().forEach((y) => push(-gap - CARD_W / 2, y));
  }
  // bounding box of table + seat cards
  minX = Math.min(0, ...seats.map((s) => s.x - CARD_W / 2));
  minY = Math.min(0, ...seats.map((s) => s.y - CARD_H / 2));
  maxX = Math.max(tw, ...seats.map((s) => s.x + CARD_W / 2));
  maxY = Math.max(th, ...seats.map((s) => s.y + CARD_H / 2));
  return { tw, th, seats, box: { x: minX, y: minY, w: maxX - minX, h: maxY - minY } };
}

/**
 * Places every table in the room. Tables flow left-to-right and wrap into centred rows
 * (wide), or stack in a single column (tall).
 */
export function roomLayout(room, orientation = 'wide') {
  const maxRow = orientation === 'wide' ? 1250 : 1; // tall: 1 → every table gets its own row
  const gapX = 70, gapY = orientation === 'wide' ? 56 : 44;
  const items = room.tables.map((t) => ({ t, g: layoutTable(t, orientation) }));

  const rows = [];
  for (const it of items) {
    const row = rows[rows.length - 1];
    const w = row ? row.w + gapX + it.g.box.w : Infinity;
    if (!row || w > maxRow) rows.push({ items: [it], w: it.g.box.w, h: it.g.box.h });
    else { row.items.push(it); row.w = w; row.h = Math.max(row.h, it.g.box.h); }
  }
  const W = Math.max(...rows.map((r) => r.w));

  const out = [];
  let y = 0;
  for (const row of rows) {
    let x = (W - row.w) / 2;
    for (const { t, g } of row.items) {
      const ox = x - g.box.x, oy = y + (row.h - g.box.h) / 2 - g.box.y; // table origin
      out.push({
        id: t.id, label: t.label,
        x: ox, y: oy, w: g.tw, h: g.th,
        seats: g.seats.map((s) => ({ ...s, x: s.x + ox, y: s.y + oy })),
      });
      x += g.box.w + gapX;
    }
    y += row.h + gapY;
  }
  return out;
}

export const VENUES = [
  {
    id: 'opto',
    name: 'Opto',
    rooms: [
      {
        id: 'copper-room',
        name: 'Copper Room',
        tables: [
          // One long table: 1 seat at each end + 5 per side = 12 seats
          rectTable({ id: 't1', label: 'Table 1', perSide: 5, ends: 1 }),
        ],
      },
    ],
  },
];

/** A room built from the homepage: `counts` = seats per table. */
export function customRoom(name, counts) {
  const [tMin, tMax] = CUSTOM_LIMITS.tables, [sMin, sMax] = CUSTOM_LIMITS.seats;
  const clean = counts.slice(0, tMax).map((n) => Math.min(sMax, Math.max(sMin, Math.round(+n) || sMin)));
  if (clean.length < tMin) throw new Error('A custom room needs at least one table.');
  return {
    id: 'custom',
    name: name || 'Custom room',
    custom: { name: name || '', counts: clean },
    tables: clean.map((n, i) => seatsTable({ id: `t${i + 1}`, label: `Table ${i + 1}`, seats: n })),
  };
}

export const CUSTOM_VENUE = { id: 'custom', name: 'Custom' };

export function findRoom(venueId, roomId) {
  const venue = VENUES.find((v) => v.id === venueId);
  const room = venue?.rooms.find((r) => r.id === roomId);
  return venue && room ? { venue, room } : null;
}

/** The venue + room for a chart state (venue rooms or a custom room carried in the state). */
export function resolveRoom(state) {
  if (state.venue === 'custom') return { venue: CUSTOM_VENUE, room: customRoom(state.custom.name, state.custom.counts) };
  return findRoom(state.venue, state.room);
}

/** All seats in a room, in a stable order (table order, then clockwise). Same ids in every orientation. */
export function roomSeats(room) {
  return roomLayout(room).flatMap((t) => t.seats.map((s, i) => ({ ...s, tableId: t.id, num: i + 1 })));
}
