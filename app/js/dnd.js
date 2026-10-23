// Pointer-based drag and drop for board cards.
// Mouse: drag starts after a 5 px move. Touch: press and hold for 220 ms.
// The card lifts into a ghost that follows the pointer, an insertion line shows
// where it will land, and on drop the new card animates from the ghost's spot.

const DRAG_THRESHOLD = 5;
const TOUCH_HOLD = 220;

export function initBoardDnd(root, { onDrop, canDrop, scroller }) {
  let s = null; // drag session
  let suppressClick = false;

  root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || s) return;
    const card = e.target.closest('.card[data-card]');
    if (!card || !card.closest('.column') || e.target.closest('button, a, input, textarea, select')) return;
    s = {
      card, id: card.dataset.card, fromStage: card.closest('.column').dataset.stage,
      startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY,
      pointerId: e.pointerId, touch: e.pointerType === 'touch', active: false, holdTimer: null,
    };
    if (s.touch) s.holdTimer = setTimeout(() => { if (s && !s.active) begin(); }, TOUCH_HOLD);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  });

  // Suppress the click that follows a real drag.
  root.addEventListener('click', (e) => {
    if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false; }
  }, true);

  // While dragging on touch, stop the page from scrolling.
  root.addEventListener('touchmove', (e) => { if (s?.active) e.preventDefault(); }, { passive: false });

  function begin() {
    const r = s.card.getBoundingClientRect();
    s.offX = s.startX - r.left; s.offY = s.startY - r.top;
    s.w = r.width; s.h = r.height;
    const g = s.card.cloneNode(true);
    g.classList.add('drag-ghost');
    g.classList.remove('settle', 'celebrate', 'appear');
    g.removeAttribute('id');
    g.style.width = r.width + 'px';
    g.style.height = r.height + 'px';
    g.style.transform = `translate(${r.left}px, ${r.top}px)`;
    document.body.append(g);
    s.ghost = g;
    s.active = true;
    s.card.classList.add('is-placeholder');
    document.body.classList.add('dragging');
    requestAnimationFrame(() => position(true));
    if (navigator.vibrate && s.touch) navigator.vibrate(8);
    s.line = document.createElement('div');
    s.line.className = 'insert-line';
    tick();
  }

  function position(lift = false) {
    if (!s?.ghost) return;
    const x = s.x - s.offX, y = s.y - s.offY;
    const tilt = Math.max(-1, Math.min(1, (s.x - (s.lastX ?? s.x)) * 0.15));
    s.lastX = s.x;
    s.ghost.style.transition = lift ? '' : 'none';
    s.ghost.style.transform = `translate(${x}px, ${y - 4}px) rotate(${tilt}deg) scale(1.02)`;
  }

  function onMove(e) {
    if (!s || e.pointerId !== s.pointerId) return;
    s.x = e.clientX; s.y = e.clientY;
    if (!s.active) {
      const dist = Math.hypot(s.x - s.startX, s.y - s.startY);
      if (s.touch) { if (dist > 8) cleanup(); return; } // finger moved: it's a scroll
      if (dist > DRAG_THRESHOLD) begin();
      return;
    }
    position();
    findTarget();
  }

  function findTarget() {
    const el = document.elementFromPoint(s.x, s.y);
    const col = el?.closest?.('.column');
    for (const c of root.querySelectorAll('.column.drop-target, .column.blocked')) if (c !== col) c.classList.remove('drop-target', 'blocked');
    if (!col) { s.target = null; s.line.remove(); return; }
    const stageId = col.dataset.stage;
    const allowed = canDrop(s.id, stageId);
    col.classList.toggle('drop-target', allowed);
    col.classList.toggle('blocked', !allowed);
    const list = col.querySelector('.cards');
    const cards = [...list.querySelectorAll('.card[data-card]')].filter((c) => c !== s.card);
    let index = cards.length;
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect();
      if (s.y < r.top + r.height / 2) { index = i; break; }
    }
    s.target = allowed ? { stageId, index } : null;
    if (!allowed) { s.line.remove(); return; }
    const lr = list.getBoundingClientRect();
    let top;
    if (!cards.length) top = 4;
    else if (index === 0) top = cards[0].getBoundingClientRect().top - lr.top - 5;
    else { const prev = cards[index - 1].getBoundingClientRect(); top = prev.bottom - lr.top + 3; }
    if (s.line.parentNode !== list) list.append(s.line);
    s.line.style.top = top + 'px';
  }

  // Auto-scroll the board near its edges.
  function tick() {
    if (!s?.active) return;
    const sc = scroller();
    if (sc) {
      const r = sc.getBoundingClientRect();
      const edge = 72;
      let dx = 0, dy = 0;
      if (s.x < r.left + edge) dx = -Math.ceil((r.left + edge - s.x) / 6);
      else if (s.x > r.right - edge) dx = Math.ceil((s.x - (r.right - edge)) / 6);
      if (s.y < r.top + edge) dy = -Math.ceil((r.top + edge - s.y) / 8);
      else if (s.y > r.bottom - edge) dy = Math.ceil((s.y - (r.bottom - edge)) / 8);
      if (dx || dy) { sc.scrollBy(dx, dy); findTarget(); }
    }
    s.raf = requestAnimationFrame(tick);
  }

  async function onUp(e) {
    if (!s || e.pointerId !== s.pointerId) return;
    if (!s.active) { cleanup(); return; }
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    const { target, id, fromStage } = s;
    const ghostRect = s.ghost.getBoundingClientRect();
    const ghost = s.ghost;
    s.ghost = null;
    cleanup();
    let moved = false;
    if (target) {
      try { moved = await onDrop(id, target.stageId, target.index, fromStage); } catch { moved = false; }
    }
    land(ghost, ghostRect, id);
  }

  function onCancel() { if (s?.ghost) s.ghost.remove(); cleanup(); }

  // Fly the ghost into the card's (new or old) position, then reveal the card.
  function land(ghost, from, id) {
    const card = root.querySelector(`.card[data-card="${CSS.escape(id)}"]`);
    if (!card) { ghost.remove(); return; }
    const to = card.getBoundingClientRect();
    card.style.visibility = 'hidden';
    ghost.style.transition = 'transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 200ms';
    ghost.style.transform = `translate(${from.left}px, ${from.top}px) scale(1.02)`;
    requestAnimationFrame(() => {
      ghost.style.transform = `translate(${to.left}px, ${to.top}px)`;
      ghost.style.boxShadow = 'var(--shadow-1)';
    });
    const done = () => {
      ghost.remove();
      card.style.visibility = '';
      if (!card.classList.contains('celebrate')) {
        card.classList.remove('settle'); void card.offsetWidth; card.classList.add('settle');
      }
    };
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) done(); else setTimeout(done, 210);
  }

  function cleanup() {
    if (!s) return;
    clearTimeout(s.holdTimer);
    cancelAnimationFrame(s.raf);
    s.line?.remove();
    s.card.classList.remove('is-placeholder');
    s.ghost?.remove();
    document.body.classList.remove('dragging');
    for (const c of root.querySelectorAll('.column.drop-target, .column.blocked')) c.classList.remove('drop-target', 'blocked');
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    s = null;
  }
}
