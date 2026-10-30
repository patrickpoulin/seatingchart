// Venue and room definitions.
// To add a room: add an entry to `rooms`. To add a table: add another rectTable(...) to `tables`.
// Coordinates are in "room units" (roughly pixels at 100% zoom); the room auto-fits the screen.

export const CARD_W = 132;   // seat card width
export const CARD_H = 60;    // seat card height

/**
 * Builds a rectangular table with seats numbered clockwise:
 * head (left end) → top side left-to-right → foot (right end) → bottom side right-to-left.
 */
export function rectTable({ id, label, x, y, perSide, ends = 1, spacing = CARD_W + 22, depth = 120 }) {
  const w = perSide * spacing;
  const h = depth;
  const gap = 14;
  const seats = [];
  const push = (sx, sy) => seats.push({ id: `${id}-${seats.length + 1}`, x: sx, y: sy });

  const endY = y + h / 2;
  const leftX = x - gap - CARD_W / 2;
  const rightX = x + w + gap + CARD_W / 2;
  const topY = y - gap - CARD_H / 2;
  const botY = y + h + gap + CARD_H / 2;
  const colX = (i) => x + spacing * (i + 0.5);

  if (ends >= 1) push(leftX, endY);
  for (let i = 0; i < perSide; i++) push(colX(i), topY);
  if (ends >= 1) push(rightX, endY);
  for (let i = perSide - 1; i >= 0; i--) push(colX(i), botY);

  return { id, label, shape: 'rect', x, y, w, h, seats };
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
          rectTable({ id: 't1', label: 'Table 1', x: 0, y: 0, perSide: 5, ends: 1 }),
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

/** All seats in a room, in a stable order (table order, then clockwise). */
export function roomSeats(room) {
  return room.tables.flatMap((t) => t.seats.map((s) => ({ ...s, tableId: t.id })));
}
