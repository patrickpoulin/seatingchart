// Encodes the whole chart into the URL fragment (#c=...).
// The fragment is never sent to any server, so a chart only exists for people who have its link.

import { resolveRoom, roomSeats } from './venues.js?v=c79539';

const hasCompression = typeof CompressionStream !== 'undefined';

function toB64url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(str) {
  const b = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
async function pipe(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** state → compact JSON → deflate → base64url. Prefix z = compressed, j = plain. */
export async function encodeState(state) {
  const { room } = resolveRoom(state);
  const seatIds = roomSeats(room).map((s) => s.id);
  const seatOf = {};
  for (const [sid, gid] of Object.entries(state.seats)) if (gid) seatOf[gid] = seatIds.indexOf(sid);
  const compact = {
    v: 1,
    ve: state.venue,
    r: state.room,
    t: state.title || '',
    k: state.key,
    ...(state.venue === 'custom' ? { cr: [state.custom.name || '', state.custom.counts] } : {}),
    g: state.guests.map((g) => [g.name, g.company, seatOf[g.id] ?? -1]),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(compact));
  if (hasCompression) return 'z' + toB64url(await pipe(bytes, new CompressionStream('deflate-raw')));
  return 'j' + toB64url(bytes);
}

export async function decodeState(payload) {
  const kind = payload[0];
  let bytes = fromB64url(payload.slice(1));
  if (kind === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  else if (kind !== 'j') throw new Error('Unknown link format');
  const c = JSON.parse(new TextDecoder().decode(bytes));
  const state = { venue: c.ve, room: c.r, title: c.t || '', key: c.k || newKey(), guests: [], seats: {} };
  if (c.ve === 'custom') {
    if (!Array.isArray(c.cr)) throw new Error('Custom room missing');
    state.custom = { name: String(c.cr[0] || ''), counts: c.cr[1] };
  }
  const found = resolveRoom(state);
  if (!found) throw new Error(`This link points to a room that no longer exists (${c.ve}/${c.r}).`);
  if (state.custom) state.custom = found.room.custom; // normalised counts
  const seatIds = roomSeats(found.room).map((s) => s.id);
  seatIds.forEach((id) => (state.seats[id] = null));
  c.g.forEach(([name, company, idx], i) => {
    const id = 'g' + i;
    state.guests.push({ id, name: String(name ?? ''), company: String(company ?? '') });
    if (idx >= 0 && idx < seatIds.length && !state.seats[seatIds[idx]]) state.seats[seatIds[idx]] = id;
  });
  return state;
}

/** Random chart key — makes every new chart's link unique even when contents are identical. */
export function newKey() {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return toB64url(b);
}
