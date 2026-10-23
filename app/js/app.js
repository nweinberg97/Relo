// Relo prototype: app shell, views, and interactions.
import * as S from './store.js';
import { state } from './store.js';
import { TEMPLATES, BLANK_TEMPLATE, CARD_TYPES, TYPE_FIELDS } from './templates.js';
import { icon } from './icons.js';
import { initBoardDnd } from './dnd.js';
import {
  $, $$, esc, initials, typeColor, announce, toast, modal, anyModalOpen, confirmDialog, promptDialog,
  menu, closeMenu, dueLabel, relTime, toLocalInput, fromLocalInput, quickDate, download, trapFocus,
} from './ui.js';

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

const ui = {
  route: { view: 'today' },
  openCardId: null,
  query: '',
  typeFilter: null,
  showArchived: false,
  flash: new Map(), // cardId -> class to play once after render ('appear' | 'celebrate')
  kbd: null,        // keyboard move session
};

// ---------- routing ----------
function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  if (h.startsWith('b/')) return { view: 'board', boardId: h.slice(2) };
  if (h === 'all') return { view: 'all' };
  return { view: 'today' };
}
function go(route) {
  const h = route.view === 'board' ? `#/b/${route.boardId}` : route.view === 'all' ? '#/all' : '#/today';
  if (location.hash !== h) location.hash = h; else { ui.route = route; render(); }
  $('#app').classList.remove('nav-open');
}
window.addEventListener('hashchange', () => {
  ui.route = parseHash();
  ui.kbd = null;
  render({ resetScroll: true });
  $('#app').classList.remove('nav-open');
});

// ---------- rendering ----------
function render({ resetScroll = false, flipSkip = null } = {}) {
  if (ui.route.view === 'board' && !state.boards.has(ui.route.boardId)) {
    const first = S.boards()[0];
    ui.route = first ? { view: 'board', boardId: first.id } : { view: 'today' };
  }
  renderSidebar();
  renderTopbar();
  renderBanner();
  const view = $('#view');
  const before = flipRects(view);
  const scroll = { left: view.scrollLeft, top: view.scrollTop };
  view.className = 'view' + (ui.route.view === 'board' ? ' board-view' : '');
  if (ui.route.view === 'board') view.innerHTML = boardHTML(state.boards.get(ui.route.boardId));
  else if (ui.route.view === 'all') renderAll(view);
  else view.innerHTML = todayHTML();
  if (resetScroll) view.scrollTo(0, 0); else { view.scrollLeft = scroll.left; view.scrollTop = scroll.top; }
  playFlip(view, before, flipSkip);
  playFlash(view);
  if (ui.openCardId) renderPanel();
  if (ui.kbd) paintKbd();
}

function flipRects(root) {
  const m = new Map();
  for (const c of root.querySelectorAll('.card[data-card]')) m.set(c.dataset.card, c.getBoundingClientRect());
  return m;
}
function playFlip(root, before, skip) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (const c of root.querySelectorAll('.card[data-card]')) {
    const id = c.dataset.card;
    if (id === skip || !before.has(id)) continue;
    const a = before.get(id), b = c.getBoundingClientRect();
    const dx = a.left - b.left, dy = a.top - b.top;
    if (!dx && !dy) continue;
    c.style.transition = 'none';
    c.style.transform = `translate(${dx}px, ${dy}px)`;
    requestAnimationFrame(() => {
      c.style.transition = 'transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)';
      c.style.transform = '';
      setTimeout(() => { c.style.transition = ''; }, 200);
    });
  }
}
function playFlash(root) {
  for (const [id, cls] of ui.flash) {
    const el = root.querySelector(`.card[data-card="${CSS.escape(id)}"]`);
    if (el) { el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 800); }
  }
  ui.flash.clear();
}

// ---------- sidebar ----------
function renderSidebar() {
  const due = S.dueCount();
  const r = ui.route;
  const boards = S.boards();
  $('#sidebar').innerHTML = `
    <a class="brand" href="../" title="About Relo">${icon('logo', 22)}<span>Relo</span></a>
    <button class="nav-item" data-go="today" ${r.view === 'today' ? 'aria-current="page"' : ''}>${icon('today')}<span class="name">Today</span>${due ? `<span class="badge" aria-label="${due} due">${due}</span>` : ''}</button>
    <button class="nav-item" data-go="all" ${r.view === 'all' ? 'aria-current="page"' : ''}>${icon('grid')}<span class="name">All cards</span><span class="count">${[...state.cards.values()].filter(S.isLive).length || ''}</span></button>
    <div class="nav-label"><span>Boards</span><button class="icon-btn" data-new-board aria-label="New board" title="New board">${icon('plus', 15)}</button></div>
    ${boards.map((b) => {
      const st = S.stagesOf(b.id);
      const tint = st.find((x) => x.celebrate)?.colorToken || 'neutral';
      return `<button class="nav-item" data-board="${b.id}" ${r.view === 'board' && r.boardId === b.id ? 'aria-current="page"' : ''}><span class="dot" data-c="${TEMPLATES.find((t) => t.key === b.templateKey) ? typeColor(b.defaultType) : tint}"></span><span class="name">${esc(b.name)}</span><span class="count">${S.activeCount(b.id) || ''}</span></button>`;
    }).join('')}
    ${boards.length ? '' : `<button class="nav-item" data-new-board>${icon('plus')}<span class="name">New board</span></button>`}
    <div class="spacer"></div>
    <button class="nav-item" data-settings>${icon('settings')}<span class="name">Settings</span></button>`;
}

$('#sidebar').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.go) go({ view: b.dataset.go });
  else if (b.dataset.board) go({ view: 'board', boardId: b.dataset.board });
  else if ('newBoard' in b.dataset) newBoardDialog();
  else if ('settings' in b.dataset) settingsDialog();
});

// ---------- topbar ----------
function renderTopbar() {
  const r = ui.route;
  let title = 'Today', sub = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }), extra = '';
  if (r.view === 'all') { title = 'All cards'; sub = ''; }
  if (r.view === 'board') {
    const b = state.boards.get(r.boardId);
    title = b.name; sub = '';
    const n = S.activeCount(b.id), cap = b.attentionCap;
    const pct = Math.min(100, Math.round((n / cap) * 100));
    const cls = n >= cap ? 'full' : pct >= 80 ? 'warn' : '';
    extra = `<div class="cap ${cls}" title="Cards in play. Parked cards don't count."><div class="cap-bar"><span style="width:${pct}%"></span></div><span>${n}<span class="cap-label"> of ${cap} in play</span></span></div>
      <button class="icon-btn" data-board-menu aria-label="Board options">${icon('more')}</button>`;
  }
  $('#topbar').innerHTML = `
    <button class="icon-btn menu-toggle" data-nav aria-label="Open navigation">${icon('menu', 18)}</button>
    <h1>${esc(title)}</h1>${sub ? `<span class="sub">${esc(sub)}</span>` : ''}${extra}
    <div class="grow"></div>
    <button class="search-trigger" data-palette aria-label="Search or run a command">${icon('search', 15)}<span>Search or jump to…</span><kbd>${MOD} K</kbd></button>
    <button class="btn btn-primary btn-new" data-new title="New card (C)">${icon('plus', 15)}<span>New card</span></button>`;
}

$('#topbar').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if ('nav' in b.dataset) $('#app').classList.toggle('nav-open');
  if ('palette' in b.dataset) openPalette();
  if ('new' in b.dataset) quickAdd();
  if ('boardMenu' in b.dataset) boardMenu(b);
});

function boardMenu(anchor) {
  const b = state.boards.get(ui.route.boardId);
  menu(anchor, [
    { label: 'Rename board', icon: 'edit', run: async () => { const v = await promptDialog({ title: 'Rename board', value: b.name }); if (v?.trim()) await S.updateBoard(b.id, { name: v.trim() }); } },
    { label: 'Change attention cap', icon: 'sliders', run: () => changeCap(b) },
    { label: 'Add stage', icon: 'plus', run: () => addStage(b.id) },
    { label: 'Duplicate board', icon: 'copy', run: async () => { const c = await S.duplicateBoard(b.id); toast('Board duplicated without its cards.', undoAction()); go({ view: 'board', boardId: c.id }); } },
    '-',
    { label: 'Delete board', icon: 'trash', danger: true, run: async () => {
      const ok = await confirmDialog({ title: `Delete ${b.name}?`, body: 'Its cards stay in All cards. You can undo this.', confirm: 'Delete board', danger: true });
      if (ok) { await S.deleteBoard(b.id); toast('Board deleted.', undoAction()); go({ view: 'today' }); }
    } },
  ]);
}

async function changeCap(b) {
  const v = await promptDialog({ title: 'Attention cap', label: 'Cards in play on this board', value: String(b.attentionCap), type: 'number' });
  const n = parseInt(v, 10);
  if (n > 0 && n < 1000) { await S.updateBoard(b.id, { attentionCap: n }); toast(`Cap set to ${n}.`, undoAction()); }
}

async function addStage(boardId) {
  const v = await promptDialog({ title: 'New stage', value: '', confirm: 'Add stage' });
  if (v?.trim()) { await S.addStage(boardId, v); }
}

// ---------- banner ----------
function renderBanner() {
  const show = S.hasSamples() && !S.getMeta('samplesDismissed');
  $('#banner').innerHTML = show ? `<div class="sample-banner">${icon('sparkle')}<span class="grow">These are example cards. Clear them whenever you're ready. Your own cards stay.</span><button class="btn btn-sm btn-secondary" data-clear-samples>Clear examples</button><button class="icon-btn" data-dismiss-banner aria-label="Hide">${icon('x', 14)}</button></div>` : '';
}
$('#banner').addEventListener('click', async (e) => {
  if (e.target.closest('[data-clear-samples]')) { await S.clearSamples(); toast('Examples cleared.', undoAction()); }
  if (e.target.closest('[data-dismiss-banner]')) { await S.setMeta('samplesDismissed', true); renderBanner(); }
});

// ---------- card HTML ----------
function cardHTML(card, { where = false } = {}) {
  const c = typeColor(card.type);
  const r = S.nextReminder(card.id);
  const due = r ? dueLabel(S.effectiveDue(r)) : null;
  const placements = where ? S.placementsOf(card.id) : [];
  const whereText = placements.map((p) => `${state.boards.get(p.boardId)?.name} · ${state.stages.get(p.stageId)?.name}`).join(', ');
  return `<div class="card${card.archivedAt ? ' archived' : ''}" data-card="${card.id}" tabindex="0" role="button" aria-label="${esc(card.title)}, ${esc(CARD_TYPES[card.type]?.label)}${due ? ', next step ' + esc(due.short) : ''}">
    <div class="card-top"><span class="avatar" data-c="${c}">${esc(initials(card.title))}</span><div class="card-title">${esc(card.title)}</div></div>
    ${card.description ? `<div class="card-desc">${esc(card.description)}</div>` : ''}
    <div class="card-meta"><span class="chip" data-c="${c}">${esc(CARD_TYPES[card.type]?.label || 'Card')}</span>
      ${due ? `<span class="chip due ${due.state}" title="${esc(r.title)}">${icon('clock', 12)}${esc(due.short)}</span>` : ''}
      ${card.links.length ? `<span class="meta-icon">${icon('link', 12)}${card.links.length > 1 ? card.links.length : ''}</span>` : ''}
    </div>
    ${where ? `<div class="where">${whereText ? esc(whereText) : 'Not on a board'}${card.archivedAt ? ' · Archived' : ''}</div>` : ''}
  </div>`;
}

// ---------- board view ----------
function boardHTML(board) {
  const stages = S.stagesOf(board.id);
  const n = S.activeCount(board.id);
  const full = n >= board.attentionCap;
  const total = stages.reduce((acc, s) => acc + S.placementsIn(board.id, s.id).length, 0);
  return `<div class="board" data-board="${board.id}">
    ${stages.map((st, i) => {
      const items = S.placementsIn(board.id, st.id);
      const blockedAdd = full && !st.isTerminal;
      return `<section class="column${st.isTerminal ? ' terminal' : ''}" data-stage="${st.id}" data-c="${st.colorToken}" aria-label="${esc(st.name)}, ${items.length} cards">
        <div class="col-head"><span class="stage-dot"></span><span class="col-title" contenteditable="plaintext-only" spellcheck="false" data-rename="${st.id}" role="textbox" aria-label="Stage name">${esc(st.name)}</span><span class="col-count">${items.length}</span>
          <button class="icon-btn" data-stage-menu="${st.id}" aria-label="${esc(st.name)} options">${icon('more', 15)}</button></div>
        <div class="cards">${items.map((p) => cardHTML(state.cards.get(p.cardId))).join('')}
          ${!total && i === 0 ? `<div class="col-empty">${esc(board.empty?.[0] || 'A few good people to start with.')}</div>` : ''}
          ${st.isTerminal && !items.length ? `<div class="col-empty">Parked cards don't count toward your cap.</div>` : ''}
          ${!st.isTerminal && !items.length && (total || i > 0) ? '<div class="col-drop" aria-hidden="true"></div>' : ''}
        </div>
        <button class="col-add" data-add-to="${st.id}" ${blockedAdd ? 'title="This board is at its attention cap"' : ''}>${icon('plus', 15)}${i === 0 && !total ? esc(board.empty?.[1] || 'Add a card') : 'Add card'}</button>
      </section>`;
    }).join('')}
    <button class="add-stage" data-add-stage>${icon('plus', 15)}Add stage</button>
  </div>`;
}

const view = $('#view');

view.addEventListener('click', async (e) => {
  const t = e.target;
  const addTo = t.closest('[data-add-to]');
  if (addTo) return quickAdd({ boardId: ui.route.boardId, stageId: addTo.dataset.addTo });
  if (t.closest('[data-add-stage]')) return addStage(ui.route.boardId);
  const sm = t.closest('[data-stage-menu]');
  if (sm) return stageMenu(sm, sm.dataset.stageMenu);
  if (t.closest('[data-rename]')) return;
  const action = t.closest('[data-action]');
  if (action) return todayAction(action);
  const card = t.closest('.card[data-card]');
  if (card) openCard(card.dataset.card);
});

function stageMenu(anchor, stageId) {
  const st = state.stages.get(stageId);
  menu(anchor, [
    { label: 'Add card here', icon: 'plus', run: () => quickAdd({ boardId: st.boardId, stageId }) },
    { label: 'Rename', icon: 'edit', run: () => { const el = view.querySelector(`[data-rename="${stageId}"]`); el.focus(); document.getSelection().selectAllChildren(el); } },
    { label: st.isTerminal ? 'Count toward cap' : 'Treat as parked', icon: 'archive', run: () => toggleTerminal(st) },
    '-',
    { label: 'Delete stage', icon: 'trash', danger: true, run: async () => {
      const n = S.placementsIn(st.boardId, stageId).length;
      const ok = await confirmDialog({ title: `Delete ${st.name}?`, body: n ? `Its ${n} card${n > 1 ? 's' : ''} will move to the previous stage.` : 'This stage is empty.', confirm: 'Delete stage', danger: true });
      if (!ok) return;
      try { const dest = await S.deleteStage(stageId); toast(n ? `Stage deleted. Cards moved to ${dest.name}.` : 'Stage deleted.', undoAction()); }
      catch (err) { toast(err.message); }
    } },
  ]);
}

async function toggleTerminal(st) {
  try { await S.setStageTerminal(st.id, !st.isTerminal); } catch (err) { capOrError(err); return; }
  toast(st.isTerminal ? `${st.name} now counts toward the cap.` : `${st.name} no longer counts toward the cap.`, undoAction());
}

// Stage rename (contenteditable)
view.addEventListener('keydown', (e) => {
  const el = e.target.closest?.('[data-rename]');
  if (el) {
    if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
    if (e.key === 'Escape') { el.textContent = state.stages.get(el.dataset.rename)?.name || ''; el.blur(); }
    e.stopPropagation();
  }
});
view.addEventListener('focusout', async (e) => {
  const el = e.target.closest?.('[data-rename]');
  if (!el) return;
  const st = state.stages.get(el.dataset.rename);
  const v = el.textContent.trim();
  if (st && v && v !== st.name) await S.renameStage(st.id, v);
  else if (st) el.textContent = st.name;
});

// Drag and drop
initBoardDnd(view, {
  scroller: () => view,
  canDrop(cardId, stageId) {
    const st = state.stages.get(stageId);
    if (!st || st.isTerminal) return true;
    const b = state.boards.get(st.boardId);
    const p = S.placementsOf(cardId).find((x) => x.boardId === b.id);
    const counted = p && !state.stages.get(p.stageId)?.isTerminal;
    return counted || S.activeCount(b.id) < b.attentionCap;
  },
  async onDrop(cardId, stageId, index) {
    return doMove(cardId, ui.route.boardId, stageId, index, { flipSkip: cardId });
  },
});

async function doMove(cardId, boardId, stageId, index, { flipSkip = null } = {}) {
  const p = S.placementsOf(cardId).find((x) => x.boardId === boardId);
  const sameSpot = p && p.stageId === stageId && S.placementsIn(boardId, stageId).findIndex((x) => x.cardId === cardId) === index;
  if (sameSpot) return false;
  let res;
  try {
    res = await quiet(() => S.moveCard(cardId, boardId, stageId, index));
  } catch (err) {
    capOrError(err);
    return false;
  }
  const changed = p?.stageId !== stageId;
  if (changed && res.celebrate) ui.flash.set(cardId, 'celebrate');
  render({ flipSkip });
  if (changed) {
    toast(`Moved to ${res.stage.name}.`, undoAction());
    announce(`${state.cards.get(cardId).title} moved to ${res.stage.name}.`);
  }
  return true;
}

// Run a store command without the automatic re-render, so the caller can render with options.
async function quiet(fn) {
  ui.quiet = true;
  try { return await fn(); } finally { ui.quiet = false; }
}

function capOrError(err) {
  if (err instanceof S.CapError) {
    toast(`${err.board.name} is full. Park or archive something, or raise the cap.`, { action: 'Raise cap', onAction: () => changeCap(err.board), duration: 6000 });
  } else {
    toast(err.message || 'Couldn\'t save that change. Your last saved version is safe.');
  }
}

// Keyboard: Enter opens, Space lifts and arrows move.
view.addEventListener('keydown', async (e) => {
  const card = e.target.closest?.('.card[data-card]');
  if (!card || e.target.closest('[data-rename]')) return;
  const inBoard = !!card.closest('.column');
  if (!ui.kbd) {
    if (e.key === 'Enter') { e.preventDefault(); openCard(card.dataset.card); }
    else if (e.key === ' ' && inBoard) {
      e.preventDefault();
      const stages = S.stagesOf(ui.route.boardId);
      const col = card.closest('.column');
      const si = stages.findIndex((s) => s.id === col.dataset.stage);
      const idx = S.placementsIn(ui.route.boardId, col.dataset.stage).findIndex((p) => p.cardId === card.dataset.card);
      ui.kbd = { cardId: card.dataset.card, si, index: idx, origin: { si, index: idx } };
      paintKbd();
      announce(`Picked up ${state.cards.get(card.dataset.card).title}. Use arrow keys to move, Enter to drop, Escape to cancel.`);
    } else if (inBoard && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      // Plain arrow navigation between cards.
      e.preventDefault();
      const cols = $$('.column', view);
      const ci = cols.indexOf(card.closest('.column'));
      const list = $$('.card[data-card]', cols[ci]);
      const i = list.indexOf(card);
      let next = null;
      if (e.key === 'ArrowDown') next = list[i + 1];
      if (e.key === 'ArrowUp') next = list[i - 1];
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        for (let c = ci + (e.key === 'ArrowRight' ? 1 : -1); c >= 0 && c < cols.length; c += e.key === 'ArrowRight' ? 1 : -1) {
          const l = $$('.card[data-card]', cols[c]);
          if (l.length) { next = l[Math.min(i, l.length - 1)]; break; }
        }
      }
      next?.focus();
    }
    return;
  }
  const k = ui.kbd;
  const stages = S.stagesOf(ui.route.boardId);
  const countIn = (si) => S.placementsIn(ui.route.boardId, stages[si].id).filter((p) => p.cardId !== k.cardId).length;
  if (e.key === 'ArrowRight' && k.si < stages.length - 1) { k.si++; k.index = Math.min(k.index, countIn(k.si)); }
  else if (e.key === 'ArrowLeft' && k.si > 0) { k.si--; k.index = Math.min(k.index, countIn(k.si)); }
  else if (e.key === 'ArrowDown') k.index = Math.min(k.index + 1, countIn(k.si));
  else if (e.key === 'ArrowUp') k.index = Math.max(0, k.index - 1);
  else if (e.key === 'Escape') { ui.kbd = null; render(); refocus(k.cardId); announce('Move cancelled.'); e.preventDefault(); e.stopPropagation(); return; }
  else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    ui.kbd = null;
    await doMove(k.cardId, ui.route.boardId, stages[k.si].id, k.index);
    render();
    refocus(k.cardId);
    return;
  } else return;
  e.preventDefault();
  paintKbd();
  announce(`${stages[k.si].name}, position ${k.index + 1}`);
});

function paintKbd() {
  const k = ui.kbd;
  $$('.insert-line.kbd', view).forEach((l) => l.remove());
  $$('.card.kbd-lifted', view).forEach((c) => c.classList.remove('kbd-lifted'));
  if (!k) return;
  const card = view.querySelector(`.card[data-card="${CSS.escape(k.cardId)}"]`);
  card?.classList.add('kbd-lifted');
  card?.focus({ preventScroll: true });
  const col = $$('.column', view)[k.si];
  if (!col) return;
  const list = col.querySelector('.cards');
  const cards = $$('.card[data-card]', list).filter((c) => c.dataset.card !== k.cardId);
  const line = document.createElement('div');
  line.className = 'insert-line kbd';
  const lr = list.getBoundingClientRect();
  let top = 4;
  if (cards.length && k.index === 0) top = cards[0].getBoundingClientRect().top - lr.top - 5;
  else if (cards.length) top = cards[k.index - 1].getBoundingClientRect().bottom - lr.top + 3;
  line.style.top = top + 'px';
  list.append(line);
  col.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
}
function refocus(cardId) { view.querySelector(`.card[data-card="${CSS.escape(cardId)}"]`)?.focus({ preventScroll: true }); }

// ---------- Today ----------
function todayHTML() {
  const b = S.dueBuckets();
  const n = b.overdue.length + b.today.length;
  const hr = new Date().getHours();
  const hello = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const sub = n ? `${n} ${n === 1 ? 'thing needs' : 'things need'} you today.` : 'You\'re all caught up.';
  const rows = (list) => `<div class="list">${list.map(reminderRow).join('')}</div>`;
  const recent = [...state.cards.values()].filter(S.isLive).sort((a, b2) => b2.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
  if (!state.boards.size && !state.cards.size) {
    return `<div class="empty"><div class="empty-art"><span></span><span></span></div><h2>Start with someone you want to know.</h2><p>Boards hold the people, brands, and tools you want to follow up with.</p><button class="btn btn-primary" data-action="new-board">${icon('plus', 15)}New board</button></div>`;
  }
  return `<div class="page">
    <h2 class="page-hello">${hello}.</h2>
    <p class="page-sub">${sub}</p>
    ${b.overdue.length ? `<div class="section"><div class="section-head warn"><h2>Earlier</h2><span class="n">${b.overdue.length}</span></div>${rows(b.overdue)}</div>` : ''}
    ${b.today.length ? `<div class="section"><div class="section-head"><h2>Today</h2><span class="n">${b.today.length}</span></div>${rows(b.today)}</div>` : ''}
    ${!n ? `<div class="section"><div class="calm"><strong>Nothing needs your attention today.</strong>${b.upcoming.length ? 'Here\'s what\'s coming up.' : 'Add a next step to any card and it shows up here.'}</div></div>` : ''}
    ${b.upcoming.length ? `<div class="section"><div class="section-head"><h2>Next 7 days</h2><span class="n">${b.upcoming.length}</span></div>${rows(b.upcoming)}</div>` : ''}
    ${recent.length ? `<div class="section"><div class="section-head"><h2>Recently touched</h2></div><div class="recent">${recent.map((c) => cardHTML(c)).join('')}</div></div>` : ''}
  </div>`;
}

function reminderRow(r) {
  const card = state.cards.get(r.cardId);
  const d = dueLabel(S.effectiveDue(r));
  return `<div class="row" data-reminder="${r.id}">
    <button class="check" data-action="complete" data-id="${r.id}" aria-label="Mark “${esc(r.title)}” done">${icon('check')}</button>
    <span class="avatar" data-c="${typeColor(card.type)}">${esc(initials(card.title))}</span>
    <div class="row-main" data-action="open" data-id="${card.id}"><div class="row-title">${esc(r.title)}</div><div class="row-sub">${esc(card.title)} · ${esc(d.text)}${r.status === 'snoozed' ? ' · snoozed' : ''}</div></div>
    <div class="row-actions"><button class="btn btn-ghost btn-sm" data-action="snooze" data-id="${r.id}">${icon('clock', 14)}Snooze</button></div>
  </div>`;
}

async function todayAction(el) {
  const id = el.dataset.id;
  const a = el.dataset.action;
  if (a === 'open') return openCard(id);
  if (a === 'new-board') return newBoardDialog();
  if (a === 'complete') {
    el.classList.add('done');
    el.closest('.row')?.classList.add('leaving');
    setTimeout(async () => {
      await S.completeReminder(id);
      toast('One less thing to hold in your head.', undoAction());
    }, 260);
  }
  if (a === 'snooze') snoozeMenu(el, id);
}

function snoozeMenu(anchor, id) {
  menu(anchor, [1, 3, 7].map((d) => ({
    label: d === 1 ? 'Tomorrow' : d === 3 ? 'In 3 days' : 'Next week', icon: 'clock',
    run: async () => { await S.snoozeReminder(id, d); toast(`Snoozed until ${lowerFirst(dueLabel(S.effectiveDue(state.reminders.get(id))).short)}.`, undoAction()); },
  })));
}

// ---------- All cards ----------
function renderAll(v) {
  const types = [...new Set([...state.cards.values()].filter((c) => !c.deletedAt).map((c) => c.type))];
  const results = S.search(ui.query, { type: ui.typeFilter, includeArchived: ui.showArchived });
  const hadFocus = document.activeElement?.id === 'all-search';
  const sel = hadFocus ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
  v.innerHTML = `<div class="page" style="max-width:1120px">
    <div class="toolbar">
      <input id="all-search" class="search-input" type="search" placeholder="Search names, notes, links…" value="${esc(ui.query)}" aria-label="Search cards">
      <button class="filter-chip" data-type="" aria-pressed="${!ui.typeFilter}">All</button>
      ${types.map((t) => `<button class="filter-chip" data-type="${t}" aria-pressed="${ui.typeFilter === t}">${esc(CARD_TYPES[t]?.label || t)}</button>`).join('')}
      <button class="filter-chip" data-archived aria-pressed="${ui.showArchived}">${icon('archive', 13)} Archived</button>
    </div>
    ${results.length ? `<div class="grid">${results.map((c) => cardHTML(c, { where: true })).join('')}</div>`
      : `<div class="calm"><strong>No cards match.</strong>${ui.query || ui.typeFilter ? '<button class="btn btn-sm btn-secondary" data-clear-filters style="margin-top:12px">Clear filters</button>' : 'Add a card and it shows up here.'}</div>`}
  </div>`;
  if (hadFocus) { const i = $('#all-search'); i.focus(); i.setSelectionRange(...sel); }
}
view.addEventListener('input', (e) => {
  if (e.target.id === 'all-search') { ui.query = e.target.value; renderAll(view); }
});
view.addEventListener('click', (e) => {
  const chip = e.target.closest('.filter-chip');
  if (chip) { if ('archived' in chip.dataset) ui.showArchived = !ui.showArchived; else ui.typeFilter = chip.dataset.type || null; renderAll(view); }
  if (e.target.closest('[data-clear-filters]')) { ui.query = ''; ui.typeFilter = null; renderAll(view); }
});

// ---------- card panel ----------
let panelEl = null, scrimEl = null, panelPrevFocus = null;
const saveTimers = new Map();

function openCard(id) {
  if (!state.cards.has(id)) return;
  ui.openCardId = id;
  if (!panelEl) {
    panelPrevFocus = document.activeElement;
    scrimEl = document.createElement('div'); scrimEl.className = 'scrim';
    panelEl = document.createElement('aside'); panelEl.className = 'panel'; panelEl.setAttribute('role', 'dialog'); panelEl.setAttribute('aria-label', 'Card details');
    document.body.append(scrimEl, panelEl);
    scrimEl.addEventListener('click', closePanel);
    panelEl.addEventListener('click', panelClick);
    panelEl.addEventListener('input', panelInput);
    panelEl.addEventListener('change', panelChange);
    panelEl.addEventListener('keydown', panelKey);
    renderPanel();
    requestAnimationFrame(() => { panelEl.classList.add('open'); scrimEl.classList.add('open'); });
    setTimeout(() => panelEl.querySelector('[data-close]')?.focus(), 60);
  } else renderPanel();
}

function closePanel() {
  if (!panelEl) return;
  flushSaves();
  const p = panelEl, sc = scrimEl;
  panelEl = scrimEl = null;
  const id = ui.openCardId;
  ui.openCardId = null;
  p.classList.remove('open'); sc.classList.remove('open');
  setTimeout(() => { p.remove(); sc.remove(); }, 230);
  const back = view.querySelector(`.card[data-card="${CSS.escape(id)}"]`) || panelPrevFocus;
  back?.focus?.({ preventScroll: true });
}

function renderPanel() {
  const card = state.cards.get(ui.openCardId);
  if (!card || card.deletedAt) return closePanel();
  // Preserve whatever the person is typing.
  const ae = document.activeElement;
  const keep = ae && panelEl.contains(ae) && ae.dataset?.key ? { key: ae.dataset.key, value: ae.value, s: ae.selectionStart, e: ae.selectionEnd } : null;
  const scroll = panelEl.querySelector('.panel-body')?.scrollTop || 0;
  const c = typeColor(card.type);
  const placements = S.placementsOf(card.id);
  const otherBoards = S.boards().filter((b) => !placements.some((p) => p.boardId === b.id));
  const open = S.remindersFor(card.id).filter((r) => r.status !== 'completed');
  const fields = TYPE_FIELDS[card.type] || [];
  const tps = S.touchpointsFor(card.id);

  panelEl.innerHTML = `
    <div class="panel-head">
      <button class="btn btn-ghost btn-sm" data-p="duplicate">${icon('copy', 14)}Duplicate</button>
      <button class="btn btn-ghost btn-sm" data-p="${card.archivedAt ? 'restore' : 'archive'}">${icon('archive', 14)}${card.archivedAt ? 'Restore' : 'Archive'}</button>
      <div class="grow"></div>
      <button class="icon-btn" data-close aria-label="Close" title="Close (Esc)">${icon('x', 16)}</button>
    </div>
    <div class="panel-body">
      <div class="p-id"><span class="avatar lg" data-c="${c}">${esc(initials(card.title))}</span>
        <div style="flex:1;min-width:0">
          <textarea class="p-title" rows="1" data-key="title" aria-label="Name">${esc(card.title)}</textarea>
          <div class="type-pick" role="group" aria-label="Type">${Object.entries(CARD_TYPES).filter(([k]) => k !== 'other' || card.type === 'other').map(([k, t]) => `<button data-settype="${k}" data-c="${t.color}" aria-pressed="${card.type === k}">${esc(t.label)}</button>`).join('')}</div>
        </div>
      </div>
      ${card.archivedAt ? `<div class="next" style="background:var(--warning-soft);color:var(--warning)">${icon('archive')}Archived ${esc(relTime(card.archivedAt).toLowerCase())}. Restore it to put it back on its boards.</div>` : ''}

      <div class="p-sec"><div class="p-label"><span>Where</span>${otherBoards.length ? `<button class="btn btn-ghost btn-sm" data-p="add-board">${icon('plus', 13)}Add to board</button>` : ''}</div>
        ${placements.length ? placements.map((p) => {
          const b = state.boards.get(p.boardId);
          return `<div class="placement"><span class="bname">${esc(b?.name)}</span>
            <select class="field" data-stage-for="${p.boardId}" aria-label="Stage on ${esc(b?.name)}">${S.stagesOf(p.boardId).map((s) => `<option value="${s.id}" ${s.id === p.stageId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
            <button class="icon-btn" data-remove-from="${p.boardId}" aria-label="Remove from ${esc(b?.name)}" title="Remove from board">${icon('x', 14)}</button></div>`;
        }).join('') : '<div class="row-sub">Not on a board yet.</div>'}
      </div>

      <div class="p-sec"><div class="p-label"><span>Next step</span></div>
        ${open.map((r) => { const d = dueLabel(S.effectiveDue(r)); return `<div class="next" style="margin-bottom:8px">
          <button class="check" data-p="complete" data-id="${r.id}" aria-label="Mark done">${icon('check')}</button>
          <div style="flex:1;min-width:0"><div class="row-title">${esc(r.title)}</div><div class="row-sub">${esc(d.text)}${r.status === 'snoozed' ? ' · snoozed' : ''}</div></div>
          <button class="icon-btn" data-p="snooze" data-id="${r.id}" aria-label="Snooze">${icon('clock', 15)}</button>
          <button class="icon-btn" data-p="del-reminder" data-id="${r.id}" aria-label="Remove next step">${icon('x', 14)}</button></div>`; }).join('')}
        <form class="next-form" data-next-form>
          <input class="field" name="title" placeholder="${open.length ? 'Another next step…' : 'What\'s the next step?'}" aria-label="Next step" autocomplete="off">
          <button class="btn btn-secondary btn-sm" style="height:32px">Set</button>
          <div class="when"><input class="field" type="date" name="date" aria-label="Date"><input class="field" type="time" name="time" value="09:00" aria-label="Time" style="max-width:110px"></div>
        </form>
        <div class="quick-dates">${[['today', 'Later today'], ['tomorrow', 'Tomorrow'], ['friday', 'Friday'], ['week', 'Next week']].map(([k, l]) => `<button class="filter-chip" data-quick="${k}">${l}</button>`).join('')}</div>
      </div>

      <div class="p-sec"><div class="p-label"><span>About</span></div>
        <textarea class="field" data-key="description" placeholder="Who they are, why they matter…" rows="2">${esc(card.description)}</textarea></div>

      ${fields.length ? `<div class="p-sec"><div class="p-label"><span>Details</span></div><div class="kv">
        ${fields.map(([k, l]) => `<label for="cf-${k}">${esc(l)}</label><input id="cf-${k}" class="field" data-key="cf:${k}" value="${esc(card.customFields?.[k] ?? '')}" autocomplete="off">`).join('')}
      </div></div>` : ''}

      <div class="p-sec"><div class="p-label"><span>Links</span></div>
        <div class="links">${card.links.map((l) => `<div class="link-row">${icon(l.kind === 'email' ? 'message' : 'link', 14)}<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.url.replace(/^(https?:\/\/(www\.)?|mailto:)/, '').replace(/\/$/, ''))}</a><span class="kind">${esc(l.kind)}</span><button class="icon-btn" data-del-link="${l.id}" aria-label="Remove link">${icon('x', 13)}</button></div>`).join('')}</div>
        <form class="inline-add" data-link-form><input class="field" name="url" placeholder="Paste a link, handle, or email" autocomplete="off" aria-label="Add link"><button class="btn btn-secondary btn-sm" style="height:32px">Add</button></form>
      </div>

      <div class="p-sec"><div class="p-label"><span>Notes</span></div>
        <textarea class="field" data-key="notes" rows="4" placeholder="Anything worth remembering…">${esc(card.notes)}</textarea></div>

      <div class="p-sec"><div class="p-label"><span>Activity</span></div>
        <form class="log-form" data-log-form>
          <select class="field" name="kind" aria-label="Kind">${[['note', 'Note'], ['message', 'Message'], ['meeting', 'Meeting'], ['call', 'Call'], ['email', 'Email'], ['research', 'Research']].map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
          <input class="field" name="summary" placeholder="Log what happened…" autocomplete="off" aria-label="Log activity">
        </form>
        <ul class="timeline">${tps.map((t) => `<li class="k-${t.kind}">${esc(t.summary)}<time datetime="${t.occurredAt}">${esc(relTime(t.occurredAt))}${t.kind !== 'note' && t.kind !== 'status_change' ? ' · ' + esc(t.kind) : ''}${t.source === 'claude' ? ' · via Claude' : ''}</time></li>`).join('')}</ul>
      </div>
    </div>`;

  const ta = panelEl.querySelector('.p-title');
  autoGrow(ta);
  panelEl.querySelector('.panel-body').scrollTop = scroll;
  if (keep) {
    const el = panelEl.querySelector(`[data-key="${CSS.escape(keep.key)}"]`);
    if (el) { el.value = keep.value; el.focus({ preventScroll: true }); try { el.setSelectionRange(keep.s, keep.e); } catch {} autoGrow(el); }
  }
}

function autoGrow(el) { if (el?.classList.contains('p-title')) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }

function panelInput(e) {
  const el = e.target;
  const key = el.dataset.key;
  if (!key) return;
  autoGrow(el);
  clearTimeout(saveTimers.get(key)?.t);
  const cardId = ui.openCardId;
  const save = () => {
    saveTimers.delete(key);
    const card = state.cards.get(cardId);
    if (!card) return;
    if (key.startsWith('cf:')) {
      const k = key.slice(3);
      if ((card.customFields?.[k] ?? '') === el.value) return;
      S.updateCard(cardId, { customFields: { ...card.customFields, [k]: el.value } });
    } else {
      if (card[key] === el.value) return;
      S.updateCard(cardId, { [key]: el.value });
    }
  };
  saveTimers.set(key, { t: setTimeout(save, 400), save });
}
function flushSaves() { for (const { t, save } of [...saveTimers.values()]) { clearTimeout(t); save(); } }

function panelKey(e) {
  if (e.key === 'Escape' && !e.target.closest('.menu')) { e.stopPropagation(); closePanel(); return; }
  if (e.key === 'Enter' && e.target.classList.contains('p-title')) { e.preventDefault(); e.target.blur(); }
  if (e.key === 'Tab') trapFocus(e, panelEl);
}

async function panelChange(e) {
  const sel = e.target.closest('[data-stage-for]');
  if (sel) {
    const boardId = sel.dataset.stageFor;
    const cardId = ui.openCardId;
    const ok = await doMove(cardId, boardId, sel.value, 0);
    if (!ok) renderPanel();
  }
}

async function panelClick(e) {
  const t = e.target;
  const cardId = ui.openCardId;
  if (t.closest('[data-close]')) return closePanel();
  const st = t.closest('[data-settype]');
  if (st) { flushSaves(); return S.updateCard(cardId, { type: st.dataset.settype }, 'Changed type'); }
  const rm = t.closest('[data-remove-from]');
  if (rm) { await S.removeFromBoard(cardId, rm.dataset.removeFrom); return toast('Removed from board.', undoAction()); }
  const dl = t.closest('[data-del-link]');
  if (dl) { const c = state.cards.get(cardId); return S.updateCard(cardId, { links: c.links.filter((l) => l.id !== dl.dataset.delLink) }, 'Removed link'); }
  const qd = t.closest('[data-quick]');
  if (qd) {
    const form = panelEl.querySelector('[data-next-form]');
    const v = toLocalInput(quickDate(qd.dataset.quick));
    form.date.value = v.date; form.time.value = v.time;
    $$('[data-quick]', panelEl).forEach((b) => b.setAttribute('aria-pressed', b === qd));
    if (!form.title.value.trim()) form.title.focus();
    else submitNext(form);
    return;
  }
  const p = t.closest('[data-p]');
  if (!p) return;
  const a = p.dataset.p;
  flushSaves();
  if (a === 'duplicate') {
    try { const copy = await quiet(() => S.duplicateCard(cardId)); ui.flash.set(copy.id, 'appear'); render(); toast('Duplicated.', undoAction()); openCard(copy.id); }
    catch (err) { capOrError(err); }
  }
  if (a === 'archive') { await S.archiveCard(cardId); toast('Archived. Find it in All cards.', undoAction()); closePanel(); }
  if (a === 'restore') { try { await S.restoreCard(cardId); toast('Restored.', undoAction()); } catch (err) { capOrError(err); } }
  if (a === 'complete') { p.classList.add('done'); await S.completeReminder(p.dataset.id); toast('One less thing to hold in your head.', undoAction()); }
  if (a === 'snooze') snoozeMenu(p, p.dataset.id);
  if (a === 'del-reminder') { await S.deleteReminder(p.dataset.id); toast('Next step removed.', undoAction()); }
  if (a === 'add-board') {
    const placed = new Set(S.placementsOf(cardId).map((x) => x.boardId));
    menu(p, S.boards().filter((b) => !placed.has(b.id)).map((b) => ({ label: b.name, icon: 'board', run: () => doMove(cardId, b.id, S.stagesOf(b.id)[0].id, 0) })));
  }
}

panelSubmitHandler();
function panelSubmitHandler() {
  document.addEventListener('submit', async (e) => {
    if (!panelEl || !panelEl.contains(e.target)) return;
    e.preventDefault();
    const f = e.target;
    const cardId = ui.openCardId;
    if ('nextForm' in f.dataset) return submitNext(f);
    if ('linkForm' in f.dataset) {
      const raw = f.url.value.trim();
      if (!raw) return;
      let url = S.normalizeUrl(raw);
      if (!url && /^@[\w.]{2,}$/.test(raw)) url = null;
      if (!url) { toast('That doesn\'t look like a link or email.'); return; }
      const c = state.cards.get(cardId);
      await S.updateCard(cardId, { links: [...c.links, { id: S.uid('l_'), kind: S.linkKind(url), url }] }, 'Added link');
      panelEl?.querySelector('[data-link-form] input')?.focus();
    }
    if ('logForm' in f.dataset) {
      const summary = f.summary.value.trim();
      if (!summary) return;
      await S.logTouchpoint(cardId, f.kind.value, summary);
      panelEl?.querySelector('[data-log-form] input')?.focus();
    }
  });
}

async function submitNext(f) {
  const title = f.title.value.trim();
  if (!title) { f.title.focus(); return; }
  const dueAt = fromLocalInput(f.date.value, f.time.value) || quickDate('tomorrow');
  await S.setReminder(ui.openCardId, { title, dueAt });
  const dl = dueLabel(dueAt).text;
  toast(`Next step set for ${dl.charAt(0).toLowerCase() + dl.slice(1)}.`, undoAction());
}

// ---------- quick add ----------
function quickAdd(pre = {}) {
  if (!state.boards.size) return newBoardDialog({ thenAdd: true });
  const boards = S.boards();
  let boardId = pre.boardId || (ui.route.view === 'board' ? ui.route.boardId : boards[0].id);
  let stageId = pre.stageId || S.stagesOf(boardId)[0]?.id;
  let type = state.boards.get(boardId)?.defaultType || 'person';
  let typeTouched = false;
  let link = null;
  let when = '';

  const stageOptions = () => S.stagesOf(boardId).map((s) => `<option value="${s.id}" ${s.id === stageId ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  const m = modal({
    label: 'New card',
    html: `<form>
      <label class="sr-only" for="qa">Name</label>
      <input id="qa" class="qa-input" placeholder="Name, link, or @handle" autocomplete="off" autofocus>
      <div class="qa-hint" id="qa-hint">A name is enough. Everything else is optional.</div>
      <div class="qa-opts">
        <div class="type-pick" id="qa-types" role="group" aria-label="Type">${Object.entries(CARD_TYPES).filter(([k]) => k !== 'other').map(([k, t]) => `<button type="button" data-t="${k}" data-c="${t.color}" aria-pressed="${k === type}">${esc(t.label)}</button>`).join('')}</div>
        <div class="qa-row">
          <select class="field" id="qa-board" aria-label="Board">${boards.map((b) => `<option value="${b.id}" ${b.id === boardId ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select>
          <select class="field" id="qa-stage" aria-label="Stage">${stageOptions()}</select>
          <select class="field" id="qa-when" aria-label="Next step"><option value="">No next step</option><option value="today">Follow up later today</option><option value="tomorrow">Follow up tomorrow</option><option value="friday">Follow up Friday</option><option value="week">Follow up next week</option></select>
        </div>
      </div>
      <div class="modal-foot"><div class="left"><kbd>Enter</kbd> add <kbd>${MOD} Enter</kbd> add and open</div>
        <button type="button" class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary">Add card</button></div>
    </form>`,
    onMount(box, api) {
      const input = box.querySelector('#qa');
      const hint = box.querySelector('#qa-hint');
      const setType = (t) => { type = t; $$('#qa-types button', box).forEach((b) => b.setAttribute('aria-pressed', b.dataset.t === t)); };
      box.querySelector('#qa-types').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { typeTouched = true; setType(b.dataset.t); } });
      box.querySelector('#qa-board').addEventListener('change', (e) => {
        boardId = e.target.value; stageId = S.stagesOf(boardId)[0]?.id;
        box.querySelector('#qa-stage').innerHTML = stageOptions();
        if (!typeTouched) setType(state.boards.get(boardId).defaultType || type);
      });
      box.querySelector('#qa-stage').addEventListener('change', (e) => { stageId = e.target.value; });
      box.querySelector('#qa-when').addEventListener('change', (e) => { when = e.target.value; });
      input.addEventListener('input', () => {
        const inf = S.inferFromInput(input.value);
        link = inf?.link || null;
        if (inf) {
          hint.className = 'qa-hint found';
          hint.textContent = inf.title ? `Will save as “${inf.title}”${link ? ' with the link attached' : ''}.` : 'Link will be attached.';
          if (inf.type && !typeTouched) setType(inf.type);
          input.dataset.inferred = inf.title || '';
        } else {
          hint.className = 'qa-hint';
          hint.textContent = 'A name is enough. Everything else is optional.';
          delete input.dataset.inferred;
        }
      });
      let openAfter = false;
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { openAfter = true; } });
      box.querySelector('[data-x]').onclick = () => api.close();
      box.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const raw = input.value.trim();
        if (!raw) { input.focus(); return; }
        const title = input.dataset.inferred ?? raw;
        const desc = '';
        try {
          const card = await quiet(() => S.createCard({ title: title || raw, type, boardId, stageId, link, description: desc, reminder: when ? { title: 'Follow up', dueAt: quickDate(when) } : null }));
          if (raw.startsWith('@') && !link) await quiet(() => S.updateCard(card.id, { customFields: { ...card.customFields, handle: raw } }, 'Added card'));
          api.close();
          ui.flash.set(card.id, 'appear');
          const st = state.stages.get(stageId);
          if (ui.route.view !== 'board' || ui.route.boardId !== boardId) {
            toast(`Added to ${state.boards.get(boardId).name} · ${st.name}.`, { action: 'View', onAction: () => go({ view: 'board', boardId }) });
            render();
          } else {
            render();
            toast(`Added to ${st.name}.`, undoAction());
          }
          if (openAfter) openCard(card.id);
        } catch (err) { openAfter = false; capOrError(err); }
      });
    },
  });
  return m;
}

// ---------- command palette ----------
function openPalette() {
  let items = [];
  let sel = 0;
  const actions = () => [
    { label: 'New card', icon: 'plus', hint: 'C', run: () => quickAdd() },
    { label: 'New board', icon: 'board', run: () => newBoardDialog() },
    { label: 'Go to Today', icon: 'today', run: () => go({ view: 'today' }) },
    { label: 'Go to All cards', icon: 'grid', run: () => go({ view: 'all' }) },
    ...(S.canUndo() ? [{ label: `Undo: ${S.lastUndoLabel()}`, icon: 'undo', hint: `${MOD} Z`, run: doUndo }] : []),
    { label: 'Toggle dark mode', icon: 'moon', run: () => setTheme(effectiveTheme() === 'dark' ? 'light' : 'dark') },
    { label: 'Export backup (JSON)', icon: 'download', run: exportBackup },
    { label: 'Settings', icon: 'settings', run: () => settingsDialog() },
  ];
  const m = modal({
    label: 'Command palette',
    html: `<input class="palette-input" placeholder="Search cards, boards, or actions" aria-label="Search" autofocus role="combobox" aria-expanded="true" aria-controls="pal-list" autocomplete="off"><ul class="palette-list" id="pal-list" role="listbox"></ul>`,
    onMount(box, api) {
      const input = box.querySelector('input');
      const list = box.querySelector('ul');
      const draw = () => {
        const q = input.value.trim().toLowerCase();
        const acts = actions().filter((a) => !q || a.label.toLowerCase().includes(q));
        const bds = S.boards().filter((b) => !q || b.name.toLowerCase().includes(q)).map((b) => ({ label: b.name, icon: 'board', sub: `${S.activeCount(b.id)} in play`, run: () => go({ view: 'board', boardId: b.id }) }));
        const cards = (q ? S.search(q) : [...state.cards.values()].filter(S.isLive).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))).slice(0, q ? 8 : 5)
          .map((c) => ({ label: c.title, card: c, sub: CARD_TYPES[c.type]?.label, run: () => openCard(c.id) }));
        const groups = q ? [['Cards', cards], ['Boards', bds], ['Actions', acts]] : [['Actions', acts], ['Recent cards', cards], ['Boards', bds]];
        items = [];
        let html = '';
        for (const [name, arr] of groups) {
          if (!arr.length) continue;
          html += `<li class="palette-group" role="presentation">${name}</li>`;
          for (const it of arr) {
            const i = items.push(it) - 1;
            const lead = it.card ? `<span class="avatar" data-c="${typeColor(it.card.type)}">${esc(initials(it.card.title))}</span>` : `<span class="pi-icon">${icon(it.icon, 16)}</span>`;
            html += `<li class="palette-item" role="option" id="pi-${i}" data-i="${i}" aria-selected="${i === sel}">${lead}<span>${esc(it.label)}</span>${it.sub ? `<span class="pi-sub">${esc(it.sub)}</span>` : it.hint ? `<span class="pi-sub"><kbd>${esc(it.hint)}</kbd></span>` : ''}</li>`;
          }
        }
        list.innerHTML = html || `<li class="palette-empty">Nothing matches “${esc(input.value)}”.</li>`;
        sel = Math.min(sel, Math.max(0, items.length - 1));
        mark();
      };
      const mark = () => {
        $$('.palette-item', list).forEach((li) => li.setAttribute('aria-selected', +li.dataset.i === sel));
        const cur = list.querySelector(`#pi-${sel}`);
        cur?.scrollIntoView({ block: 'nearest' });
        input.setAttribute('aria-activedescendant', cur ? cur.id : '');
      };
      const run = (i) => { const it = items[i]; if (!it) return; api.close(); setTimeout(() => it.run(), 10); };
      input.addEventListener('input', () => { sel = 0; draw(); });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); mark(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); }
        if (e.key === 'Enter') { e.preventDefault(); run(sel); }
      });
      list.addEventListener('click', (e) => { const li = e.target.closest('.palette-item'); if (li) run(+li.dataset.i); });
      list.addEventListener('mousemove', (e) => { const li = e.target.closest('.palette-item'); if (li && +li.dataset.i !== sel) { sel = +li.dataset.i; mark(); } });
      draw();
    },
  });
  return m;
}

// ---------- boards ----------
function tmplCard(t, pressed) {
  return `<button type="button" class="tmpl" data-tmpl="${t.key}" aria-pressed="${pressed}"><strong>${esc(t.name)}</strong><span>${esc(t.stages.filter((s) => !s.isTerminal).map((s) => s.name).join(' → '))}</span>
    <div class="stages">${t.stages.map((s) => `<i data-c="${s.colorToken}"></i>`).join('')}</div></button>`;
}

function newBoardDialog({ thenAdd = false } = {}) {
  let pick = TEMPLATES.find((t) => !S.boards().some((b) => b.templateKey === t.key))?.key || 'blank';
  modal({
    wide: true, label: 'New board',
    html: `<form><div class="modal-head"><h2>New board</h2><p>Pick a starting point. You can rename and rearrange stages anytime.</p></div>
      <div class="modal-body"><div class="tmpl-grid">${[...TEMPLATES, BLANK_TEMPLATE].map((t) => tmplCard(t, t.key === pick)).join('')}</div>
      <label class="p-label" for="nb-name" style="margin-top:20px">Name</label><input id="nb-name" class="field" value="${esc((TEMPLATES.find((t) => t.key === pick) || BLANK_TEMPLATE).name)}" autocomplete="off"></div>
      <div class="modal-foot"><button type="button" class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary">Create board</button></div></form>`,
    onMount(box, api) {
      const name = box.querySelector('#nb-name');
      let nameTouched = false;
      name.addEventListener('input', () => { nameTouched = true; });
      box.querySelector('.tmpl-grid').addEventListener('click', (e) => {
        const b = e.target.closest('[data-tmpl]');
        if (!b) return;
        pick = b.dataset.tmpl;
        $$('[data-tmpl]', box).forEach((x) => x.setAttribute('aria-pressed', x === b));
        if (!nameTouched) name.value = (TEMPLATES.find((t) => t.key === pick) || BLANK_TEMPLATE).name;
      });
      box.querySelector('[data-x]').onclick = () => api.close();
      box.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const board = await S.createBoard(pick, name.value.trim() || undefined);
        await S.setMeta('onboarded', true);
        api.close();
        go({ view: 'board', boardId: board.id });
        if (thenAdd) setTimeout(() => quickAdd({ boardId: board.id }), 250);
      });
    },
  });
}

// ---------- settings ----------
function effectiveTheme() {
  const t = document.documentElement.dataset.theme;
  if (t) return t;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function setTheme(t) {
  if (t === 'system') { delete document.documentElement.dataset.theme; try { localStorage.removeItem('relo-theme'); } catch {} }
  else { document.documentElement.dataset.theme = t; try { localStorage.setItem('relo-theme', t); } catch {} }
}

function exportBackup() {
  const d = new Date().toISOString().slice(0, 10);
  download(`relo-backup-${d}.json`, S.exportJSON());
  S.setMeta('lastBackup', new Date().toISOString());
  toast('Backup downloaded.');
}

function settingsDialog() {
  const cur = document.documentElement.dataset.theme || 'system';
  const last = S.getMeta('lastBackup');
  modal({
    label: 'Settings',
    html: `<div class="modal-head"><h2>Settings</h2><p>Everything lives in this browser. Nothing is sent anywhere.</p></div>
    <div class="modal-body">
      <div class="set-row"><div class="txt"><strong>Appearance</strong></div><div class="seg" id="theme-seg">${['system', 'light', 'dark'].map((t) => `<button data-theme-set="${t}" aria-pressed="${cur === t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div></div>
      <div class="set-row"><div class="txt"><strong>Back up your workspace</strong><span>${last ? `Last backup ${esc(relTime(last).toLowerCase())}.` : 'Clearing site data in your browser erases your workspace. Keep a backup.'}</span></div><button class="btn btn-secondary btn-sm" data-s="export">${icon('download', 14)}JSON</button><button class="btn btn-ghost btn-sm" data-s="csv">CSV</button></div>
      <div class="set-row"><div class="txt"><strong>Restore from a backup</strong><span>Replaces this workspace with the file's contents.</span></div><button class="btn btn-secondary btn-sm" data-s="import">${icon('upload', 14)}Import</button><input type="file" accept="application/json,.json" hidden id="import-file"></div>
      ${S.hasSamples() ? `<div class="set-row"><div class="txt"><strong>Example cards</strong><span>Remove the examples. Your own cards stay.</span></div><button class="btn btn-secondary btn-sm" data-s="samples">Clear examples</button></div>` : ''}
      <div class="set-row"><div class="txt"><strong>Claude</strong><span>Coming next: tell Claude to add people, move cards, and set follow-ups. See docs/PRD.md, section G.</span></div></div>
      <div class="set-row"><div class="txt"><strong>Erase workspace</strong><span>Deletes every board and card in this browser.</span></div><button class="btn btn-ghost btn-sm btn-danger" data-s="erase">Erase</button></div>
    </div>`,
    onMount(box, api) {
      box.addEventListener('click', async (e) => {
        const th = e.target.closest('[data-theme-set]');
        if (th) { setTheme(th.dataset.themeSet); $$('[data-theme-set]', box).forEach((b) => b.setAttribute('aria-pressed', b === th)); }
        const s = e.target.closest('[data-s]')?.dataset.s;
        if (s === 'export') exportBackup();
        if (s === 'csv') { download(`relo-cards-${new Date().toISOString().slice(0, 10)}.csv`, S.exportCSV(), 'text/csv'); toast('CSV downloaded.'); }
        if (s === 'import') box.querySelector('#import-file').click();
        if (s === 'samples') { await S.clearSamples(); api.close(); toast('Examples cleared.', undoAction()); }
        if (s === 'erase') {
          api.close();
          const ok = await confirmDialog({ title: 'Erase this workspace?', body: 'Every board, card, and next step in this browser will be deleted. This can\'t be undone. Download a backup first if you might want it back.', confirm: 'Erase everything', danger: true });
          if (ok) { await S.eraseWorkspace(); location.hash = '#/today'; maybeOnboard(); }
        }
      });
      box.querySelector('#import-file').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const data = JSON.parse(await file.text());
          const sum = S.validateImport(data);
          api.close();
          const ok = await confirmDialog({ title: 'Replace this workspace?', body: `The backup has ${sum.boards} board${sum.boards === 1 ? '' : 's'} and ${sum.cards} card${sum.cards === 1 ? '' : 's'}. Your current workspace will be replaced.`, confirm: 'Replace' });
          if (!ok) return;
          await S.importJSON(data);
          await S.setMeta('onboarded', true);
          toast('Backup restored.');
          go({ view: 'today' });
        } catch (err) {
          toast(err instanceof SyntaxError ? 'That file isn\'t valid JSON.' : err.message, { duration: 6000 });
        }
      });
    },
  });
}

// ---------- onboarding ----------
function maybeOnboard() {
  if (state.boards.size || S.getMeta('onboarded')) return;
  let step = 0;
  let picks = new Set(['partnerships', 'creators']);
  const m = modal({
    label: 'Welcome to Relo', className: 'onb-modal',
    html: '<div id="onb"></div>',
    onClose: async () => { if (!state.boards.size) { /* allow skipping entirely */ await S.setMeta('onboarded', true); render(); } },
    onMount(box, api) {
      const host = box.querySelector('#onb');
      const dots = (n) => `<div class="steps">${[0, 1, 2].map((i) => `<i class="${i === n ? 'on' : ''}"></i>`).join('')}</div>`;
      const draw = () => {
        if (step === 0) {
          host.innerHTML = `<div class="onb"><div class="onb-mark">${icon('logo', 30)}</div><h2>Keep good connections moving.</h2>
            <p>A calm place for the people, brands, tools, and opportunities you want to do something with.</p>
            <div class="actions"><button class="btn btn-secondary" data-o="fresh">Start fresh</button><button class="btn btn-primary" data-o="examples" autofocus>Start with examples</button></div>
            <p style="margin-top:20px;font-size:12px;color:var(--ink-400)">No account. Your workspace stays in this browser.</p>${dots(0)}</div>`;
        } else if (step === 1) {
          host.innerHTML = `<div class="modal-head"><h2>Where do you want to start?</h2><p>Pick a board or two. You can add more later.</p></div>
            <div class="modal-body"><div class="tmpl-grid">${TEMPLATES.map((t) => tmplCard(t, picks.has(t.key))).join('')}</div></div>
            <div class="modal-foot"><div class="left">${dots(1).replace('class="steps"', 'class="steps" style="margin:0"')}</div><button class="btn btn-ghost" data-o="back">Back</button><button class="btn btn-primary" data-o="next" ${picks.size ? '' : 'disabled'}>Continue</button></div>`;
        } else {
          host.innerHTML = `<form><div class="modal-head"><h2>Start with someone you want to know.</h2><p>Add a few names. Just the name is enough.</p></div>
            <div class="modal-body"><div class="five">
              ${[['person', 'A person you\'d like to meet'], ['company', 'A brand you\'d love to work with'], ['creator', 'A creator whose work you admire'], ['tool', 'A tool you keep meaning to try'], ['opportunity', 'An opportunity worth a look']]
                .map(([t, ph], i) => `<input class="field" data-type="${t}" placeholder="${esc(ph)}" aria-label="${esc(ph)}" autocomplete="off" ${i === 0 ? 'autofocus' : ''}>`).join('')}
            </div></div>
            <div class="modal-foot"><div class="left">${dots(2).replace('class="steps"', 'class="steps" style="margin:0"')}</div><button type="button" class="btn btn-ghost" data-o="skip">Skip</button><button class="btn btn-primary">Done</button></div></form>`;
          host.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); finishFresh([...host.querySelectorAll('.five input')]); });
        }
        setTimeout(() => (host.querySelector('[autofocus]') || host.querySelector('button'))?.focus(), 30);
      };
      const finishFresh = async (inputs = []) => {
        const keys = TEMPLATES.map((t) => t.key).filter((k) => picks.has(k));
        const created = await S.seedWorkspace(keys, { withSamples: false });
        const byType = { company: 'partnerships', creator: 'creators', tool: 'tools', person: 'people', opportunity: 'opportunities', project: 'projects' };
        for (const inp of inputs) {
          const title = inp.value.trim();
          if (!title) continue;
          const key = byType[inp.dataset.type];
          const board = created.find((b) => b.templateKey === key) || created[0];
          const stageId = S.stagesOf(board.id)[0].id;
          try { await S.createCard({ title, type: inp.dataset.type, boardId: board.id, stageId }); } catch {}
        }
        await S.setMeta('onboarded', true);
        api.close();
        go({ view: 'board', boardId: created[0].id });
        toast('Your workspace is ready.');
      };
      host.addEventListener('click', async (e) => {
        const tm = e.target.closest('[data-tmpl]');
        if (tm) { picks.has(tm.dataset.tmpl) ? picks.delete(tm.dataset.tmpl) : picks.add(tm.dataset.tmpl); tm.setAttribute('aria-pressed', picks.has(tm.dataset.tmpl)); host.querySelector('[data-o="next"]').disabled = !picks.size; return; }
        const o = e.target.closest('[data-o]')?.dataset.o;
        if (o === 'examples') {
          const created = await S.seedWorkspace(['partnerships', 'creators', 'people', 'tools'], { withSamples: true });
          await S.setMeta('onboarded', true);
          api.close();
          go({ view: 'today' });
          toast('Here are a few examples to play with.');
          void created;
        }
        if (o === 'fresh') { step = 1; draw(); }
        if (o === 'back') { step = 0; draw(); }
        if (o === 'next') { step = 2; draw(); }
        if (o === 'skip') finishFresh([]);
      });
      draw();
    },
  });
  return m;
}

const lowerFirst = (t) => t.charAt(0).toLowerCase() + t.slice(1);

// ---------- undo ----------
function undoAction() { return { action: 'Undo', onAction: doUndo }; }
async function doUndo() {
  flushSaves();
  const label = await S.undo();
  if (label) toast(`Undid: ${label.toLowerCase()}.`);
}

// ---------- global keys ----------
document.addEventListener('keydown', (e) => {
  const typing = e.target.closest?.('input, textarea, select, [contenteditable]');
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); if (!anyModalOpen()) { closeMenu(); openPalette(); } return; }
  if (anyModalOpen()) return;
  if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey && !typing) { e.preventDefault(); doUndo(); return; }
  if (typing || mod || e.altKey) return;
  if (e.key === 'c' || e.key === 'n') { e.preventDefault(); quickAdd(); }
  else if (e.key === '/') { e.preventDefault(); openPalette(); }
  else if (e.key === 'Escape' && panelEl) closePanel();
});

// ---------- boot ----------
S.subscribe((info) => {
  if (info.type === 'error') toast('Couldn\'t save that change. Your last saved version is safe.');
  if (info.type === 'change' && !ui.quiet) render();
});

async function boot() {
  try {
    await S.load();
  } catch (err) {
    $('#view').innerHTML = `<div class="empty"><h2>Relo couldn't open its storage.</h2><p>${esc(err.message)} Private browsing can block it.</p></div>`;
    return;
  }
  ui.route = parseHash();
  render({ resetScroll: true });
  maybeOnboard();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(() => {});
  }
}
boot();
