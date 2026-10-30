// Venue and room definitions.
// To add a room: add an entry to `rooms`. To add a table: add another rectTable(...) to `tables`.
// Positions are in "room units" (roughly pixels at 100% zoom) for the wide (desktop) layout;
// the room auto-fits the screen. On phones every room is rotated 90° clockwise so long tables
// run down the screen instead of off the side.

export const CARD_W = 132;   // seat card width
export const CARD_H = 60;    // seat card height

/**
 * A rectangular table. Seats are numbered clockwise:
 * head (left end) → top side left-to-right → foot (right end) → bottom side right-to-left.
 * (In the rotated phone layout that becomes: top end → right side → bottom end → left side.)
 */
export function rectTable({ id, label, x = 0, y = 0, perSide, ends = 1 }) {
  return { id, label, shape: 'rect', x, y, perSide, ends };
}

/** Geometry for one table in a given orientation ('wide' or 'tall'). */
function layoutTable(t, orientation) {
  const seats = [];
  const push = (sx, sy) => seats.push({ id: `${t.id}-${seats.length + 1}`, x: sx, y: sy });
  const cols = (n, start, step) => Array.from({ length: n }, (_, i) => start + step * (i + 0.5));

  if (orientation === 'wide') {
    const spacing = CARD_W + 22, gap = 14;
    const w = t.perSide * spacing, h = 120;
    const xs = cols(t.perSide, t.x, spacing);
    if (t.ends) push(t.x - gap - CARD_W / 2, t.y + h / 2);                 // head
    xs.forEach((x) => push(x, t.y - gap - CARD_H / 2));                      // top
    if (t.ends) push(t.x + w + gap + CARD_W / 2, t.y + h / 2);             // foot
    [...xs].reverse().forEach((x) => push(x, t.y + h + gap + CARD_H / 2));  // bottom
    return { x: t.x, y: t.y, w, h, seats };
  }

  // tall: the wide layout turned 90° clockwise. Table x/y are swapped so multi-table rooms rotate too.
  const spacing = CARD_H + 16, gap = 10;
  const ox = -t.y, oy = t.x;
  const w = 64, h = t.perSide * spacing;
  const ys = cols(t.perSide, oy, spacing);
  if (t.ends) push(ox + w / 2, oy - gap - CARD_H / 2);                       // head → top
  ys.forEach((y) => push(ox + w + gap + CARD_W / 2, y));                     // top side → right
  if (t.ends) push(ox + w / 2, oy + h + gap + CARD_H / 2);                   // foot → bottom
  [...ys].reverse().forEach((y) => push(ox - gap - CARD_W / 2, y));          // bottom side → left
  return { x: ox, y: oy, w, h, seats };
}

/** The room's tables with positions and seats for an orientation. */
export function roomLayout(room, orientation = 'wide') {
  return room.tables.map((t) => ({ id: t.id, label: t.label, ...layoutTable(t, orientation) }));
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

export function findRoom(venueId, roomId) {
  const venue = VENUES.find((v) => v.id === venueId);
  const room = venue?.rooms.find((r) => r.id === roomId);
  return venue && room ? { venue, room } : null;
}

/** All seats in a room, in a stable order (table order, then clockwise). Same ids in every orientation. */
export function roomSeats(room) {
  return roomLayout(room).flatMap((t) => t.seats.map((s) => ({ ...s, tableId: t.id })));
}
