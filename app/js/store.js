// Workspace state and domain commands.
// State lives in memory (Maps keyed by id). Every command runs inside commit(),
// which records the previous value of each changed record (for undo) and writes
// the changes to IndexedDB in one transaction.

import { loadAll, writeOps, clearAll, STORES } from './db.js';
import { TEMPLATES, BLANK_TEMPLATE, SAMPLES, CARD_TYPES } from './templates.js';

export const SCHEMA_VERSION = 1;
const DATA_STORES = STORES.filter((s) => s !== 'meta');

export const state = Object.fromEntries(STORES.map((s) => [s, new Map()]));

const listeners = new Set();
const undoStack = [];
const UNDO_LIMIT = 50;

export const uid = (p = '') => p + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
export const now = () => new Date().toISOString();
export const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(info) { for (const fn of listeners) fn(info); }

export async function load() {
  const data = await loadAll();
  for (const s of STORES) {
    state[s].clear();
    for (const rec of data[s] || []) state[s].set(rec.id, rec);
  }
  emit({ type: 'load' });
}

// ---------- commit / undo ----------

export class CapError extends Error {
  constructor(board) { super(`${board.name} is at its attention cap (${board.attentionCap}).`); this.board = board; }
}

async function commit(label, fn, { undoable = true, silent = false } = {}) {
  const changes = new Map(); // key store:id -> { store, id, before }
  const ops = [];
  const api = {
    put(store, rec) {
      const key = store + ':' + rec.id;
      if (!changes.has(key)) changes.set(key, { store, id: rec.id, before: clone(state[store].get(rec.id) ?? null) });
      state[store].set(rec.id, rec);
      ops.push({ store, id: rec.id, value: rec });
    },
    del(store, id) {
      const key = store + ':' + id;
      if (!changes.has(key)) changes.set(key, { store, id, before: clone(state[store].get(id) ?? null) });
      state[store].delete(id);
      ops.push({ store, id, value: null });
    },
  };
  let result;
  try {
    result = fn(api);
  } catch (err) {
    // Roll back memory for anything already touched.
    for (const c of changes.values()) {
      if (c.before) state[c.store].set(c.id, c.before); else state[c.store].delete(c.id);
    }
    throw err;
  }
  if (!ops.length) return result;
  try {
    await writeOps(ops);
  } catch (err) {
    for (const c of changes.values()) {
      if (c.before) state[c.store].set(c.id, c.before); else state[c.store].delete(c.id);
    }
    emit({ type: 'error', error: err });
    throw err;
  }
  if (undoable) {
    undoStack.push({ label, changes: [...changes.values()] });
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  }
  if (!silent) emit({ type: 'change', label });
  return result;
}

export function canUndo() { return undoStack.length > 0; }
export function lastUndoLabel() { return undoStack.at(-1)?.label; }

export async function undo() {
  const entry = undoStack.pop();
  if (!entry) return null;
  const ops = [];
  for (const c of entry.changes) {
    if (c.before) { state[c.store].set(c.id, c.before); ops.push({ store: c.store, id: c.id, value: c.before }); }
    else { state[c.store].delete(c.id); ops.push({ store: c.store, id: c.id, value: null }); }
  }
  await writeOps(ops);
  emit({ type: 'change', label: 'Undo', undo: true });
  return entry.label;
}

// ---------- selectors ----------

export const getMeta = (key, fallback = null) => state.meta.get(key)?.value ?? fallback;
export async function setMeta(key, value) {
  await commit('meta', (t) => t.put('meta', { id: key, value }), { undoable: false, silent: true });
}

export const boards = () => [...state.boards.values()].sort((a, b) => a.order - b.order);
export const stagesOf = (boardId) => [...state.stages.values()].filter((s) => s.boardId === boardId).sort((a, b) => a.order - b.order);
export const isLive = (card) => card && !card.archivedAt && !card.deletedAt;

export function placementsIn(boardId, stageId) {
  return [...state.placements.values()]
    .filter((p) => p.boardId === boardId && p.stageId === stageId && isLive(state.cards.get(p.cardId)))
    .sort((a, b) => a.order - b.order);
}
export const placementsOf = (cardId) => [...state.placements.values()].filter((p) => p.cardId === cardId);

export function activeCount(boardId) {
  let n = 0;
  for (const p of state.placements.values()) {
    if (p.boardId !== boardId) continue;
    const st = state.stages.get(p.stageId);
    if (st && !st.isTerminal && isLive(state.cards.get(p.cardId))) n++;
  }
  return n;
}

export const remindersFor = (cardId) => [...state.reminders.values()].filter((r) => r.cardId === cardId).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
export const touchpointsFor = (cardId) => [...state.touchpoints.values()].filter((t) => t.cardId === cardId).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

export function nextReminder(cardId) {
  const t = Date.now();
  return remindersFor(cardId).find((r) => r.status !== 'completed' && !(r.status === 'snoozed' && Date.parse(r.snoozedUntil) > t)) || null;
}

const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export function effectiveDue(r) { return r.status === 'snoozed' && r.snoozedUntil ? r.snoozedUntil : r.dueAt; }

export function dueBuckets() {
  const today = dayStart(new Date());
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const week = new Date(today); week.setDate(today.getDate() + 8);
  const out = { overdue: [], today: [], upcoming: [] };
  for (const r of state.reminders.values()) {
    if (r.status === 'completed') continue;
    if (!isLive(state.cards.get(r.cardId))) continue;
    const due = new Date(effectiveDue(r));
    if (due < today) out.overdue.push(r);
    else if (due < tomorrow) out.today.push(r);
    else if (due < week) out.upcoming.push(r);
  }
  const by = (a, b) => effectiveDue(a).localeCompare(effectiveDue(b));
  out.overdue.sort(by); out.today.sort(by); out.upcoming.sort(by);
  return out;
}

export function dueCount() { const b = dueBuckets(); return b.overdue.length + b.today.length; }

export function search(query, { type = null, includeArchived = false } = {}) {
  const q = query.trim().toLowerCase();
  const terms = q ? q.split(/\s+/) : [];
  const tagName = (id) => state.tags.get(id)?.name || '';
  return [...state.cards.values()]
    .filter((c) => !c.deletedAt && (includeArchived || !c.archivedAt) && (!type || c.type === type))
    .filter((c) => {
      if (!terms.length) return true;
      const hay = [c.title, c.description, c.notes, ...c.links.map((l) => l.url), ...c.tagIds.map(tagName), ...Object.values(c.customFields || {})].join(' ').toLowerCase();
      return terms.every((t) => hay.includes(t));
    })
    .sort((a, b) => {
      if (q) {
        const at = a.title.toLowerCase().startsWith(q) ? 0 : 1;
        const bt = b.title.toLowerCase().startsWith(q) ? 0 : 1;
        if (at !== bt) return at - bt;
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}

// ---------- link helpers ----------

const SOCIAL = [
  [/instagram\.com/i, 'instagram'], [/youtube\.com|youtu\.be/i, 'youtube'], [/tiktok\.com/i, 'tiktok'],
  [/(^|\.)x\.com|twitter\.com/i, 'x'], [/linkedin\.com/i, 'linkedin'], [/podcasts\.apple|spotify\.com\/show/i, 'podcast'],
];

export function normalizeUrl(raw) {
  let v = raw.trim();
  if (!v) return null;
  if (/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(v)) return 'mailto:' + v;
  if (!/^https?:\/\//i.test(v)) {
    if (!/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(v)) return null;
    v = 'https://' + v;
  }
  try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null; } catch { return null; }
}

export function linkKind(url) {
  if (url.startsWith('mailto:')) return 'email';
  try {
    const host = new URL(url).hostname;
    for (const [re, kind] of SOCIAL) if (re.test(host)) return kind;
  } catch {}
  return 'website';
}

// Best-effort name and type from a pasted URL or @handle. Never fetches.
export function inferFromInput(text) {
  const raw = text.trim();
  if (/^@[\w.]{2,}$/.test(raw)) {
    return { title: titleCase(raw.slice(1)), link: null, type: 'creator', handle: raw };
  }
  const url = /\s/.test(raw) ? null : normalizeUrl(raw);
  if (!url || url.startsWith('mailto:')) return null;
  const kind = linkKind(url);
  const u = new URL(url);
  let title = '';
  if (kind !== 'website') {
    const seg = u.pathname.split('/').filter(Boolean).filter((p) => !['in', 'c', 'channel', 'user', 'show', 'company'].includes(p));
    title = titleCase((seg[0] || '').replace(/^@/, ''));
  } else {
    const host = u.hostname.replace(/^www\./, '').split('.');
    title = titleCase(host.length > 1 ? host[host.length - 2] : host[0]);
  }
  const type = kind === 'linkedin' ? (u.pathname.startsWith('/company') ? 'company' : 'person') : kind === 'website' ? null : kind === 'podcast' ? 'creator' : 'creator';
  return { title, link: url, type, kind };
}

function titleCase(s) {
  return s.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------- commands ----------

function makeBoard(t, tmpl, { name, order, sample = false } = {}) {
  const board = {
    id: uid('b_'), name: name || tmpl.name, description: tmpl.description, templateKey: tmpl.key,
    attentionCap: tmpl.cap, defaultType: tmpl.defaultType, empty: tmpl.empty, order,
    createdAt: now(), updatedAt: now(), sample,
  };
  t.put('boards', board);
  const stageIds = tmpl.stages.map((st, i) => {
    const stage = { id: uid('s_'), boardId: board.id, name: st.name, colorToken: st.colorToken, order: i, isTerminal: !!st.isTerminal, celebrate: !!st.celebrate };
    t.put('stages', stage);
    return stage.id;
  });
  return { board, stageIds };
}

const nextBoardOrder = () => boards().reduce((m, b) => Math.max(m, b.order + 1), 0);

export function createBoard(templateKey, name) {
  const tmpl = TEMPLATES.find((x) => x.key === templateKey) || BLANK_TEMPLATE;
  return commit('Created board', (t) => makeBoard(t, tmpl, { name, order: nextBoardOrder() }).board);
}

export function seedWorkspace(templateKeys, { withSamples }) {
  return commit('Set up workspace', (t) => {
    let order = nextBoardOrder();
    const created = [];
    for (const key of templateKeys) {
      const tmpl = TEMPLATES.find((x) => x.key === key);
      if (!tmpl) continue;
      const { board, stageIds } = makeBoard(t, tmpl, { order: order++ });
      created.push(board);
      if (!withSamples) continue;
      const counters = {};
      for (const [title, type, stageIdx, description, links, fields, rem] of SAMPLES[key] || []) {
        const card = newCard({ title, type, description, source: 'sample', links: links.map((u) => ({ id: uid('l_'), kind: linkKind(u), url: u })), customFields: fields });
        card.sample = true;
        t.put('cards', card);
        const stageId = stageIds[stageIdx];
        counters[stageId] = (counters[stageId] || 0) + 1;
        t.put('placements', { id: uid('p_'), cardId: card.id, boardId: board.id, stageId, order: counters[stageId], createdAt: now(), updatedAt: now() });
        t.put('touchpoints', { id: uid('t_'), cardId: card.id, kind: 'note', summary: 'Added as an example', occurredAt: now(), createdAt: now(), source: 'system' });
        if (rem) {
          const [rtitle, dayOffset, hour] = rem;
          const d = new Date(); d.setDate(d.getDate() + dayOffset); d.setHours(hour, 0, 0, 0);
          t.put('reminders', { id: uid('r_'), cardId: card.id, title: rtitle, dueAt: d.toISOString(), timeZone: tz(), status: 'open', createdAt: now() });
        }
      }
    }
    return created;
  }, { undoable: false });
}

function newCard({ title, type = 'person', description = '', notes = '', links = [], customFields = {}, source = 'manual' }) {
  return { id: uid('c_'), title: title.trim() || 'Untitled', type, description, notes, links, tagIds: [], customFields, createdAt: now(), updatedAt: now(), source };
}

function assertCap(boardId, stageId, ignoreCardId = null) {
  const stage = state.stages.get(stageId);
  const board = state.boards.get(boardId);
  if (!stage || !board || stage.isTerminal) return;
  let n = activeCount(boardId);
  if (ignoreCardId) {
    // Card already counted on this board (moving within active stages).
    const existing = placementsOf(ignoreCardId).find((p) => p.boardId === boardId);
    if (existing && !state.stages.get(existing.stageId)?.isTerminal) n--;
  }
  if (n >= board.attentionCap) throw new CapError(board);
}

function topOrder(boardId, stageId) {
  const list = placementsIn(boardId, stageId);
  return list.length ? list[0].order - 1 : 0;
}

export function createCard({ title, type, boardId, stageId, link, description = '', reminder = null }) {
  return commit('Added card', (t) => {
    if (boardId && stageId) assertCap(boardId, stageId);
    const links = link ? [{ id: uid('l_'), kind: linkKind(link), url: link }] : [];
    const card = newCard({ title, type, links, description });
    t.put('cards', card);
    if (boardId && stageId) {
      t.put('placements', { id: uid('p_'), cardId: card.id, boardId, stageId, order: topOrder(boardId, stageId), createdAt: now(), updatedAt: now() });
    }
    t.put('touchpoints', { id: uid('t_'), cardId: card.id, kind: 'note', summary: 'Card created', occurredAt: now(), createdAt: now(), source: 'user' });
    if (reminder?.dueAt) {
      t.put('reminders', { id: uid('r_'), cardId: card.id, title: reminder.title || 'Follow up', dueAt: reminder.dueAt, timeZone: tz(), status: 'open', createdAt: now() });
    }
    return card;
  });
}

const EDITABLE = ['title', 'type', 'description', 'notes', 'links', 'tagIds', 'customFields'];

export function updateCard(cardId, patch, label = 'Edited card') {
  return commit(label, (t) => {
    const card = state.cards.get(cardId);
    if (!card) throw new Error('Card not found');
    const next = { ...card, updatedAt: now() };
    for (const k of EDITABLE) if (k in patch) next[k] = patch[k];
    if (typeof next.title === 'string' && !next.title.trim()) next.title = 'Untitled';
    t.put('cards', next);
    return next;
  });
}

// Move a card to boardId/stageId at index (position among visible cards in that stage).
export function moveCard(cardId, boardId, stageId, index) {
  return commit('Moved card', (t) => {
    const existing = placementsOf(cardId).find((p) => p.boardId === boardId);
    const fromStage = existing ? state.stages.get(existing.stageId) : null;
    const toStage = state.stages.get(stageId);
    if (!toStage || toStage.boardId !== boardId) throw new Error('Invalid stage');
    if (!existing || existing.stageId !== stageId) assertCap(boardId, stageId, existing ? cardId : null);

    const siblings = placementsIn(boardId, stageId).filter((p) => p.cardId !== cardId);
    const i = Math.max(0, Math.min(index, siblings.length));
    siblings.splice(i, 0, existing ? { ...existing } : { id: uid('p_'), cardId, boardId, createdAt: now() });
    siblings.forEach((p, n) => {
      const isMoving = p.cardId === cardId;
      if (!isMoving && p.order === n) return;
      t.put('placements', { ...p, stageId: isMoving ? stageId : p.stageId, order: n, updatedAt: isMoving ? now() : p.updatedAt });
    });
    if (!existing || existing.stageId !== stageId) {
      t.put('touchpoints', { id: uid('t_'), cardId, kind: 'status_change', summary: `Moved to ${toStage.name}` + (fromStage ? ` from ${fromStage.name}` : ''), occurredAt: now(), createdAt: now(), source: 'user' });
      const card = state.cards.get(cardId);
      t.put('cards', { ...card, updatedAt: now() });
    }
    return { celebrate: !!toStage.celebrate && fromStage?.id !== toStage.id, stage: toStage };
  });
}

export function removeFromBoard(cardId, boardId) {
  return commit('Removed from board', (t) => {
    for (const p of placementsOf(cardId)) if (p.boardId === boardId) t.del('placements', p.id);
  });
}

export function duplicateCard(cardId) {
  return commit('Duplicated card', (t) => {
    const src = state.cards.get(cardId);
    const copy = { ...clone(src), id: uid('c_'), title: src.title + ' copy', createdAt: now(), updatedAt: now(), source: 'manual', sample: false };
    copy.links = copy.links.map((l) => ({ ...l, id: uid('l_') }));
    t.put('cards', copy);
    for (const p of placementsOf(cardId)) {
      const st = state.stages.get(p.stageId);
      if (!st?.isTerminal) assertCap(p.boardId, p.stageId);
      // Insert right after the original.
      const list = placementsIn(p.boardId, p.stageId);
      const idx = list.findIndex((x) => x.id === p.id);
      list.splice(idx + 1, 0, { id: uid('p_'), cardId: copy.id, boardId: p.boardId, stageId: p.stageId, createdAt: now() });
      list.forEach((x, n) => { if (x.order !== n || x.cardId === copy.id) t.put('placements', { ...x, order: n, updatedAt: now() }); });
    }
    t.put('touchpoints', { id: uid('t_'), cardId: copy.id, kind: 'note', summary: `Duplicated from ${src.title}`, occurredAt: now(), createdAt: now(), source: 'user' });
    return copy;
  });
}

export function archiveCard(cardId) {
  return commit('Archived card', (t) => {
    const c = state.cards.get(cardId);
    t.put('cards', { ...c, archivedAt: now(), updatedAt: now() });
  });
}

export function restoreCard(cardId) {
  return commit('Restored card', (t) => {
    const c = state.cards.get(cardId);
    for (const p of placementsOf(cardId)) assertCap(p.boardId, p.stageId);
    const { archivedAt, ...rest } = c;
    t.put('cards', { ...rest, updatedAt: now() });
  });
}

export function setReminder(cardId, { title, dueAt }) {
  return commit('Set next step', (t) => {
    const r = { id: uid('r_'), cardId, title: title || 'Follow up', dueAt, timeZone: tz(), status: 'open', createdAt: now() };
    t.put('reminders', r);
    return r;
  });
}

export function completeReminder(id) {
  return commit('Completed next step', (t) => {
    const r = state.reminders.get(id);
    t.put('reminders', { ...r, status: 'completed', completedAt: now() });
    t.put('touchpoints', { id: uid('t_'), cardId: r.cardId, kind: 'note', summary: `Done: ${r.title}`, occurredAt: now(), createdAt: now(), source: 'user' });
  });
}

export function snoozeReminder(id, days) {
  return commit('Snoozed', (t) => {
    const r = state.reminders.get(id);
    const base = new Date(Math.max(Date.now(), Date.parse(effectiveDue(r))));
    const d = new Date(); d.setDate(d.getDate() + days);
    d.setHours(new Date(r.dueAt).getHours(), new Date(r.dueAt).getMinutes(), 0, 0);
    if (d <= base && days > 0) d.setDate(d.getDate() + 1);
    t.put('reminders', { ...r, status: 'snoozed', snoozedUntil: d.toISOString() });
  });
}

export function deleteReminder(id) {
  return commit('Removed next step', (t) => t.del('reminders', id));
}

export function logTouchpoint(cardId, kind, summary) {
  return commit('Logged', (t) => {
    t.put('touchpoints', { id: uid('t_'), cardId, kind, summary, occurredAt: now(), createdAt: now(), source: 'user' });
    const c = state.cards.get(cardId);
    t.put('cards', { ...c, updatedAt: now() });
  });
}

export function updateBoard(boardId, patch) {
  return commit('Updated board', (t) => {
    const b = state.boards.get(boardId);
    t.put('boards', { ...b, ...patch, updatedAt: now() });
  });
}

export function deleteBoard(boardId) {
  return commit('Deleted board', (t) => {
    for (const p of [...state.placements.values()]) if (p.boardId === boardId) t.del('placements', p.id);
    for (const s of stagesOf(boardId)) t.del('stages', s.id);
    t.del('boards', boardId);
  });
}

export function duplicateBoard(boardId) {
  return commit('Duplicated board', (t) => {
    const b = state.boards.get(boardId);
    const copy = { ...b, id: uid('b_'), name: b.name + ' copy', order: nextBoardOrder(), createdAt: now(), updatedAt: now(), sample: false };
    t.put('boards', copy);
    for (const s of stagesOf(boardId)) t.put('stages', { ...s, id: uid('s_'), boardId: copy.id });
    return copy;
  });
}

export function renameStage(stageId, name) {
  return commit('Renamed stage', (t) => { const s = state.stages.get(stageId); t.put('stages', { ...s, name: name.trim() || s.name }); });
}

export function addStage(boardId, name) {
  return commit('Added stage', (t) => {
    const list = stagesOf(boardId);
    // Insert before the first terminal stage so Parked stays last.
    const termIdx = list.findIndex((s) => s.isTerminal);
    const at = termIdx === -1 ? list.length : termIdx;
    const stage = { id: uid('s_'), boardId, name: name.trim() || 'New stage', colorToken: 'community', order: at, isTerminal: false, celebrate: false };
    list.splice(at, 0, stage);
    list.forEach((s, i) => t.put('stages', { ...s, order: i }));
    return stage;
  });
}

export function deleteStage(stageId) {
  return commit('Deleted stage', (t) => {
    const stage = state.stages.get(stageId);
    const list = stagesOf(stage.boardId).filter((s) => s.id !== stageId);
    if (!list.length) throw new Error('A board needs at least one stage.');
    const dest = list.filter((s) => s.order < stage.order).at(-1) || list[0];
    let n = placementsIn(stage.boardId, dest.id).length;
    for (const p of [...state.placements.values()]) if (p.stageId === stageId) t.put('placements', { ...p, stageId: dest.id, order: n++, updatedAt: now() });
    t.del('stages', stageId);
    list.forEach((s, i) => { if (s.order !== i) t.put('stages', { ...s, order: i }); });
    return dest;
  });
}

export function clearSamples() {
  return commit('Cleared examples', (t) => {
    const sampleIds = new Set([...state.cards.values()].filter((c) => c.source === 'sample').map((c) => c.id));
    for (const id of sampleIds) t.del('cards', id);
    for (const s of ['placements', 'reminders', 'touchpoints']) {
      for (const r of [...state[s].values()]) if (sampleIds.has(r.cardId)) t.del(s, r.id);
    }
    for (const r of [...state.relationships.values()]) if (sampleIds.has(r.fromCardId) || sampleIds.has(r.toCardId)) t.del('relationships', r.id);
  });
}

export const hasSamples = () => [...state.cards.values()].some((c) => c.source === 'sample');

// ---------- import / export ----------

export function exportJSON() {
  const out = { app: 'relo', schemaVersion: SCHEMA_VERSION, exportedAt: now() };
  for (const s of DATA_STORES) out[s] = [...state[s].values()];
  return JSON.stringify(out, null, 2);
}

const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

export function exportCSV() {
  const rows = [['title', 'type', 'boards', 'description', 'notes', 'links', 'next_step', 'next_step_due', 'archived', 'created_at', 'updated_at']];
  for (const c of [...state.cards.values()].filter((c) => !c.deletedAt)) {
    const where = placementsOf(c.id).map((p) => `${state.boards.get(p.boardId)?.name} / ${state.stages.get(p.stageId)?.name}`).join('; ');
    const r = nextReminder(c.id);
    rows.push([c.title, CARD_TYPES[c.type]?.label || c.type, where, c.description, c.notes, c.links.map((l) => l.url).join(' '), r?.title || '', r ? effectiveDue(r) : '', c.archivedAt ? 'yes' : '', c.createdAt, c.updatedAt]);
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

// Validates the whole file before replacing anything.
export function validateImport(data) {
  if (!data || typeof data !== 'object') throw new Error('That file isn\'t a Relo backup.');
  if (data.schemaVersion !== SCHEMA_VERSION) throw new Error(`Unsupported backup version (${data.schemaVersion}).`);
  for (const s of DATA_STORES) {
    if (data[s] != null && !Array.isArray(data[s])) throw new Error(`"${s}" should be a list.`);
    for (const rec of data[s] || []) if (!rec || typeof rec.id !== 'string') throw new Error(`A record in "${s}" is missing its id.`);
  }
  const ids = (s) => new Set((data[s] || []).map((r) => r.id));
  const cards = ids('cards'), boardIds = ids('boards'), stageIds = ids('stages');
  for (const p of data.placements || []) {
    if (!cards.has(p.cardId) || !boardIds.has(p.boardId) || !stageIds.has(p.stageId)) throw new Error('A card placement points to something that isn\'t in the file.');
  }
  for (const s of ['reminders', 'touchpoints']) for (const r of data[s] || []) if (!cards.has(r.cardId)) throw new Error(`A ${s.slice(0, -1)} points to a missing card.`);
  for (const c of data.cards || []) {
    if (typeof c.title !== 'string') throw new Error('A card is missing its title.');
    c.links ||= []; c.tagIds ||= []; c.customFields ||= {}; c.description ||= ''; c.notes ||= '';
  }
  return { cards: cards.size, boards: boardIds.size };
}

export async function importJSON(data) {
  const summary = validateImport(data);
  const meta = [...state.meta.values()];
  await clearAll();
  const ops = [];
  for (const s of DATA_STORES) for (const rec of data[s] || []) ops.push({ store: s, id: rec.id, value: rec });
  for (const m of meta) ops.push({ store: 'meta', id: m.id, value: m });
  await writeOps(ops);
  undoStack.length = 0;
  await load();
  return summary;
}

export async function eraseWorkspace() {
  await clearAll();
  undoStack.length = 0;
  await load();
}

export function setStageTerminal(stageId, isTerminal) {
  return commit(isTerminal ? 'Stage set to parked' : 'Stage counts toward cap', (t) => {
    const s = state.stages.get(stageId);
    if (!isTerminal) {
      // Turning a parked stage into an active one must still respect the cap.
      const extra = placementsIn(s.boardId, stageId).length;
      const board = state.boards.get(s.boardId);
      if (activeCount(s.boardId) + extra > board.attentionCap) throw new CapError(board);
    }
    t.put('stages', { ...s, isTerminal });
  });
}
