import { VENUES, CARD_W, CARD_H, findRoom, roomSeats } from './venues.js';
import { encodeState, decodeState, newKey } from './share.js';
import { parseGuests } from './paste.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let state = null;      // { venue, room, title, key, guests:[{id,name,company}], seats:{seatId: guestId|null} }
let room = null;
let undoStack = [];
let lastHash = '';

// ───────────────────────── routing ─────────────────────────

async function route() {
  const m = location.hash.match(/^#c=(.+)$/);
  if (!m) return showPicker();
  if (location.hash === lastHash && state) return; // our own update
  try {
    state = await decodeState(m[1]);
    room = findRoom(state.venue, state.room).room;
    undoStack = [];
    lastHash = location.hash;
    showEditor();
  } catch (e) {
    console.error(e);
    show('error');
    $('errorMsg').textContent = e.message?.startsWith('This link') ? e.message : 'The link looks incomplete or damaged. Ask the sender to copy it again.';
    setCrumbs('');
  }
}

function show(id) {
  for (const v of ['picker', 'editor', 'error']) $(v).hidden = v !== id;
}

function setCrumbs(html) { $('crumbs').innerHTML = html; }

// ───────────────────────── picker ─────────────────────────

function showPicker() {
  state = null;
  show('picker');
  setCrumbs('');
  const vs = $('venueSelect');
  vs.innerHTML = VENUES.map((v) => `<option value="${v.id}">${esc(v.name)}</option>`).join('');
  const fillRooms = () => {
    const v = VENUES.find((x) => x.id === vs.value);
    $('roomSelect').innerHTML = v.rooms.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
    describeRoom();
  };
  const describeRoom = () => {
    const r = findRoom(vs.value, $('roomSelect').value)?.room;
    if (!r) return;
    const n = roomSeats(r).length;
    $('roomInfo').textContent = `${r.tables.length} table${r.tables.length > 1 ? 's' : ''} · ${n} seats`;
  };
  vs.onchange = fillRooms;
  $('roomSelect').onchange = describeRoom;
  fillRooms();
  $('startBtn').onclick = () => {
    const found = findRoom(vs.value, $('roomSelect').value);
    room = found.room;
    state = { venue: found.venue.id, room: room.id, title: '', key: newKey(), guests: [], seats: {} };
    roomSeats(room).forEach((s) => (state.seats[s.id] = null));
    undoStack = [];
    showEditor();
    commit(false);
  };
}

// ───────────────────────── editor ─────────────────────────

function showEditor() {
  show('editor');
  const { venue } = findRoom(state.venue, state.room);
  setCrumbs(`<span>${esc(venue.name)}</span><span class="sep">/</span><span>${esc(room.name)}</span>`);
  $('titleInput').value = state.title;
  buildStage();
  render();
}

/** Lays out tables and empty seat slots once per room; guests are rendered into them by render(). */
function buildStage() {
  const seats = roomSeats(room);
  const pad = 24;
  const xs = [...seats.map((s) => s.x - CARD_W / 2), ...room.tables.map((t) => t.x)];
  const ys = [...seats.map((s) => s.y - CARD_H / 2), ...room.tables.map((t) => t.y)];
  const xe = [...seats.map((s) => s.x + CARD_W / 2), ...room.tables.map((t) => t.x + t.w)];
  const ye = [...seats.map((s) => s.y + CARD_H / 2), ...room.tables.map((t) => t.y + t.h)];
  const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad;
  const W = Math.max(...xe) + pad - minX, H = Math.max(...ye) + pad - minY;

  const stage = $('stage');
  stage.style.width = W + 'px';
  stage.style.height = H + 'px';
  stage.dataset.w = W;
  stage.dataset.h = H;

  const tables = room.tables.map((t) => `
    <div class="table" style="left:${t.x - minX}px;top:${t.y - minY}px;width:${t.w}px;height:${t.h}px">
      <span>${esc(t.label || '')}</span>
    </div>`).join('');

  const slots = seats.map((s, i) => `
    <div class="seat" data-seat="${s.id}" style="left:${s.x - minX - CARD_W / 2}px;top:${s.y - minY - CARD_H / 2}px;width:${CARD_W}px;height:${CARD_H}px">
      <span class="seat-no">${i + 1}</span>
    </div>`).join('');

  stage.innerHTML = tables + slots;
  fitStage();
}

function fitStage() {
  const stage = $('stage');
  const wrap = $('stageWrap');
  if (!stage.dataset.w) return;
  const W = +stage.dataset.w, H = +stage.dataset.h;
  const avail = wrap.clientWidth - 32;
  const scale = Math.max(0.62, Math.min(1.25, avail / W)); // below ~0.62 cards get unreadable, so scroll instead
  stage.style.transform = `scale(${scale})`;
  wrap.style.height = H * scale + 32 + 'px';
  stage.parentElement.style.setProperty('--stage-w', W * scale + 'px');
}

function guestCard(g, seated) {
  return `<div class="guest${seated ? ' seated' : ''}" data-guest="${g.id}" title="${esc(g.name)}${g.company ? ' — ' + esc(g.company) : ''}">
    <div class="g-name">${esc(g.name) || '<i>No name</i>'}</div>
    <div class="g-co">${esc(g.company)}</div>
    <button class="g-x" data-action="${seated ? 'unseat' : 'remove'}" title="${seated ? 'Unseat' : 'Remove from list'}" aria-label="${seated ? 'Unseat' : 'Remove'}">×</button>
  </div>`;
}

function render() {
  const byId = Object.fromEntries(state.guests.map((g) => [g.id, g]));
  document.querySelectorAll('#stage .seat').forEach((el) => {
    el.querySelector('.guest')?.remove();
    const gid = state.seats[el.dataset.seat];
    el.classList.toggle('filled', !!gid);
    if (gid && byId[gid]) el.insertAdjacentHTML('beforeend', guestCard(byId[gid], true));
  });
  const seated = new Set(Object.values(state.seats).filter(Boolean));
  const unseated = state.guests.filter((g) => !seated.has(g.id));
  $('tray').innerHTML = unseated.length
    ? unseated.map((g) => guestCard(g, false)).join('')
    : `<div class="tray-empty">${state.guests.length ? 'Everyone has a seat.' : 'No guests yet — paste a list above.'}</div>`;
  $('trayCount').textContent = unseated.length;
  $('undoBtn').disabled = !undoStack.length;
}

// ───────────────────────── state changes ─────────────────────────

function snapshot() {
  return JSON.stringify({ guests: state.guests, seats: state.seats, title: state.title });
}

/** Wraps a mutation: saves undo point, applies it, re-renders, updates URL. */
function change(fn) {
  undoStack.push(snapshot());
  if (undoStack.length > 100) undoStack.shift();
  fn();
  render();
  commit();
}

let commitTimer;
function commit(debounce = true) {
  clearTimeout(commitTimer);
  const run = async () => {
    const hash = '#c=' + (await encodeState(state));
    lastHash = hash;
    history.replaceState(null, '', hash);
  };
  return debounce ? (commitTimer = setTimeout(run, 250)) : run();
}

function undo() {
  const prev = undoStack.pop();
  if (!prev) return;
  Object.assign(state, JSON.parse(prev));
  $('titleInput').value = state.title;
  render();
  commit();
}

function seatOf(gid) {
  return Object.keys(state.seats).find((s) => state.seats[s] === gid) || null;
}

/** Move a guest to a seat (swapping with the occupant) or to the tray. */
function moveGuest(gid, target) {
  const from = seatOf(gid);
  if (target === from) return;
  change(() => {
    if (target === 'tray') {
      if (from) state.seats[from] = null;
      return;
    }
    const occupant = state.seats[target];
    state.seats[target] = gid;
    if (from) state.seats[from] = occupant || null; // swap (or vacate)
    // if dragged from tray, a displaced occupant falls back to the tray automatically
  });
}

function emptySeats() {
  return roomSeats(room).map((s) => s.id).filter((id) => !state.seats[id]);
}

function nextGuestId() {
  let n = state.guests.length;
  const used = new Set(state.guests.map((g) => g.id));
  while (used.has('g' + n)) n++;
  return 'g' + n;
}

function addGuests(list, replace) {
  change(() => {
    if (replace) {
      state.guests = [];
      for (const k in state.seats) state.seats[k] = null;
    }
    const free = emptySeats();
    for (const g of list) {
      const id = nextGuestId();
      state.guests.push({ id, name: g.name, company: g.company });
      if (free.length) state.seats[free.shift()] = id;
    }
  });
  const overflow = Math.max(0, state.guests.length - roomSeats(room).length);
  toast(`Added ${list.length} guest${list.length === 1 ? '' : 's'}${overflow ? ` · ${overflow} unseated (room is full)` : ''}`);
}

// ───────────────────────── drag & drop ─────────────────────────

let drag = null;

function onPointerDown(e) {
  if (e.button !== 0) return;
  const card = e.target.closest('.guest');
  if (!card || e.target.closest('.g-x')) return;
  drag = { gid: card.dataset.guest, card, sx: e.clientX, sy: e.clientY, started: false, target: null, pid: e.pointerId };
  card.setPointerCapture(e.pointerId);
}

function onPointerMove(e) {
  if (!drag || e.pointerId !== drag.pid) return;
  const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
  if (!drag.started) {
    if (Math.hypot(dx, dy) < 5) return;
    drag.started = true;
    const r = drag.card.getBoundingClientRect();
    drag.offX = drag.sx - r.left;
    drag.offY = drag.sy - r.top;
    drag.ghost = drag.card.cloneNode(true);
    drag.ghost.classList.add('ghost');
    drag.ghost.style.width = r.width + 'px';
    drag.ghost.style.height = r.height + 'px';
    document.body.appendChild(drag.ghost);
    drag.card.classList.add('lifted');
    document.body.classList.add('dragging');
  }
  drag.ghost.style.left = e.clientX - drag.offX + 'px';
  drag.ghost.style.top = e.clientY - drag.offY + 'px';
  setTarget(findTarget(e.clientX, e.clientY));
}

function onPointerUp(e) {
  if (!drag || e.pointerId !== drag.pid) return;
  const { started, gid, target, ghost, card } = drag;
  drag = null;
  if (!started) return;
  document.body.classList.remove('dragging');
  setTarget(null);
  card.classList.remove('lifted');
  if (target) {
    ghost.remove();
    moveGuest(gid, target);
  } else {
    // no snap target: float back home
    const r = card.getBoundingClientRect();
    ghost.classList.add('returning');
    ghost.style.left = r.left + 'px';
    ghost.style.top = r.top + 'px';
    setTimeout(() => ghost.remove(), 180);
  }
}

/** Nearest seat within snap radius, or the tray if the pointer is over it. */
function findTarget(x, y) {
  const tray = $('tray').closest('.tray-panel').getBoundingClientRect();
  if (x >= tray.left && x <= tray.right && y >= tray.top && y <= tray.bottom) return 'tray';
  let best = null, bestD = Infinity;
  document.querySelectorAll('#stage .seat').forEach((el) => {
    const r = el.getBoundingClientRect();
    const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
    const radius = Math.max(r.width, r.height) * 0.75;
    if (d < radius && d < bestD) { best = el.dataset.seat; bestD = d; }
  });
  return best;
}

function setTarget(t) {
  if (drag) drag.target = t;
  document.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target', 'will-swap'));
  if (!t) return;
  if (t === 'tray') return $('tray').closest('.tray-panel').classList.add('drop-target');
  const el = document.querySelector(`#stage .seat[data-seat="${t}"]`);
  el.classList.add('drop-target');
  if (state.seats[t] && drag && state.seats[t] !== drag.gid) el.classList.add('will-swap');
}

// ───────────────────────── misc actions ─────────────────────────

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2400);
}

async function copyLink() {
  await commit(false);
  const url = location.href;
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied — anyone with it can open and edit their own copy');
  } catch {
    prompt('Copy this link:', url);
  }
}

function exportCsv() {
  const byId = Object.fromEntries(state.guests.map((g) => [g.id, g]));
  const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const rows = [['Seat', 'Table', 'Name', 'Company']];
  roomSeats(room).forEach((s, i) => {
    const g = byId[state.seats[s.id]];
    const t = room.tables.find((x) => x.id === s.tableId);
    rows.push([i + 1, t.label || t.id, g?.name || '', g?.company || '']);
  });
  const seated = new Set(Object.values(state.seats));
  state.guests.filter((g) => !seated.has(g.id)).forEach((g) => rows.push(['', 'Unseated', g.name, g.company]));
  const blob = new Blob([rows.map((r) => r.map(q).join(',')).join('\r\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(state.title || room.name).replace(/[^\w\- ]+/g, '').trim() || 'seating'}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function editGuest(gid) {
  const g = state.guests.find((x) => x.id === gid);
  if (!g) return;
  const name = prompt('Name', g.name);
  if (name === null) return;
  const company = prompt('Company', g.company);
  if (company === null) return;
  change(() => { g.name = name.trim(); g.company = company.trim(); });
}

function shuffle() {
  if (!state.guests.length) return;
  change(() => {
    const ids = roomSeats(room).map((s) => s.id);
    const seated = ids.map((id) => state.seats[id]).filter(Boolean);
    for (let i = seated.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [seated[i], seated[j]] = [seated[j], seated[i]];
    }
    ids.forEach((id) => (state.seats[id] = null));
    const order = [...ids].sort(() => Math.random() - 0.5);
    seated.forEach((gid, i) => (state.seats[order[i]] = gid));
  });
}

// ───────────────────────── wiring ─────────────────────────

function wire() {
  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerUp);

  document.addEventListener('click', (e) => {
    const x = e.target.closest('.g-x');
    if (!x) return;
    const gid = x.closest('.guest').dataset.guest;
    if (x.dataset.action === 'unseat') moveGuest(gid, 'tray');
    else change(() => { state.guests = state.guests.filter((g) => g.id !== gid); });
  });
  document.addEventListener('dblclick', (e) => {
    const card = e.target.closest('.guest');
    if (card) editGuest(card.dataset.guest);
  });

  const box = $('pasteBox');
  box.addEventListener('input', () => {
    const list = parseGuests(box.value);
    $('pastePreview').innerHTML = list.length
      ? `${list.length} guest${list.length === 1 ? '' : 's'} detected — first: <b>${esc(list[0].name)}</b>${list[0].company ? ' · ' + esc(list[0].company) : ''}`
      : '&nbsp;';
    $('addBtn').disabled = $('replaceBtn').disabled = !list.length;
  });
  $('addBtn').onclick = () => { addGuests(parseGuests(box.value), false); box.value = ''; box.dispatchEvent(new Event('input')); };
  $('replaceBtn').onclick = () => {
    if (state.guests.length && !confirm('Replace all current guests with this list?')) return;
    addGuests(parseGuests(box.value), true); box.value = ''; box.dispatchEvent(new Event('input'));
  };

  $('titleInput').addEventListener('change', (e) => change(() => (state.title = e.target.value.trim())));
  $('undoBtn').onclick = undo;
  $('shuffleBtn').onclick = shuffle;
  $('clearBtn').onclick = () => change(() => { for (const k in state.seats) state.seats[k] = null; });
  $('csvBtn').onclick = exportCsv;
  $('printBtn').onclick = () => window.print();
  $('shareBtn').onclick = copyLink;

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey && !$('editor').hidden
        && !['TEXTAREA', 'INPUT'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      undo();
    }
  });

  window.addEventListener('resize', fitStage);
  window.addEventListener('hashchange', route);
  window.addEventListener('beforeprint', () => {
    const s = $('stage');
    const scale = Math.min(1, 980 / +s.dataset.w);
    s.style.transform = `scale(${scale})`;
    $('stageWrap').style.height = +s.dataset.h * scale + 'px';
  });
  window.addEventListener('afterprint', fitStage);
}

wire();
route();
