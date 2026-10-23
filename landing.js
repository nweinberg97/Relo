// Relo landing page: the "put them in order" demo, the Claude demo, and the nav.
(() => {
  const nav = document.getElementById('nav');
  const onScroll = () => nav.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- hero demo ----------
  const demo = document.getElementById('demo');
  const btn = document.getElementById('demo-btn');
  const stateText = document.getElementById('demo-state');
  const cards = [...demo.querySelectorAll('.dcard')];
  const cols = [...demo.querySelectorAll('.demo-col')];

  // Scattered layout: fractions of the free area, plus a slight tilt.
  const SCATTER = {
    maya: [0.04, 0.12, -3],
    north: [0.55, 0.04, 2.5],
    alex: [0.2, 0.62, 2],
    studio: [0.78, 0.58, -2.5],
  };
  const custom = new Map(); // positions the visitor dragged to while scattered

  function layout() {
    const ordered = demo.dataset.state === 'ordered';
    const D = demo.getBoundingClientRect();
    const footH = 72;
    if (ordered) {
      cols.forEach((col, ci) => {
        const r = col.getBoundingClientRect();
        const inCol = cards.filter((c) => +c.dataset.col === ci).sort((a, b) => +a.dataset.row - +b.dataset.row);
        let y = r.top - D.top + 40;
        inCol.forEach((c) => {
          c.style.width = (r.width - 20) + 'px';
          c.style.transform = `translate(${r.left - D.left + 10}px, ${y}px) rotate(0deg)`;
          y += c.offsetHeight + 10;
        });
      });
    } else {
      cards.forEach((c) => {
        c.style.width = Math.min(250, D.width - 64) + 'px';
        const [fx, fy, rot] = SCATTER[c.dataset.k];
        const pos = custom.get(c.dataset.k);
        const x = pos ? pos.x : 16 + fx * Math.max(0, D.width - 32 - c.offsetWidth);
        const y = pos ? pos.y : 16 + fy * Math.max(0, D.height - footH - 24 - c.offsetHeight);
        c.style.transform = `translate(${x}px, ${y}px) rotate(${pos ? 0 : rot}deg)`;
      });
    }
  }

  function setState(ordered) {
    // Brief lift before the cards travel, then settle.
    cards.forEach((c) => c.classList.add('lift'));
    setTimeout(() => cards.forEach((c) => c.classList.remove('lift')), 650);
    demo.dataset.state = ordered ? 'ordered' : 'scattered';
    if (!ordered) custom.clear();
    btn.textContent = ordered ? 'Scatter them again' : 'Put them in order';
    btn.setAttribute('aria-pressed', ordered);
    stateText.textContent = ordered ? 'Nothing important left floating around.' : 'Four good intentions, scattered across four apps.';
    requestAnimationFrame(layout);
  }

  btn.addEventListener('click', () => setState(demo.dataset.state !== 'ordered'));
  addEventListener('resize', layout);
  if (document.fonts?.ready) document.fonts.ready.then(layout);
  layout();

  // Cards can be dragged in either state. In order, they snap to a column.
  let drag = null;
  demo.addEventListener('pointerdown', (e) => {
    const c = e.target.closest('.dcard');
    if (!c || e.button !== 0) return;
    const D = demo.getBoundingClientRect();
    const r = c.getBoundingClientRect();
    drag = { c, dx: e.clientX - r.left, dy: e.clientY - r.top, D };
    c.classList.add('dragging');
    c.setPointerCapture(e.pointerId);
  });
  demo.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const x = e.clientX - drag.D.left - drag.dx;
    const y = e.clientY - drag.D.top - drag.dy;
    drag.x = x; drag.y = y;
    drag.c.style.transform = `translate(${x}px, ${y}px) rotate(1deg) scale(1.02)`;
  });
  const end = (e) => {
    if (!drag) return;
    const { c } = drag;
    c.classList.remove('dragging');
    if (demo.dataset.state === 'ordered') {
      const ci = cols.findIndex((col) => { const r = col.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; });
      if (ci !== -1) {
        // Insert by vertical position among that column's cards.
        const others = cards.filter((x) => x !== c && +x.dataset.col === ci).sort((a, b) => +a.dataset.row - +b.dataset.row);
        let idx = others.findIndex((o) => e.clientY < o.getBoundingClientRect().top + o.offsetHeight / 2);
        if (idx === -1) idx = others.length;
        others.splice(idx, 0, c);
        c.dataset.col = ci;
        others.forEach((o, i) => { o.dataset.row = i; });
        renumber();
      }
    } else if (drag.x != null) {
      custom.set(c.dataset.k, { x: drag.x, y: drag.y });
    }
    drag = null;
    layout();
  };
  function renumber() {
    cols.forEach((_, ci) => cards.filter((x) => +x.dataset.col === ci).sort((a, b) => +a.dataset.row - +b.dataset.row).forEach((x, i) => { x.dataset.row = i; }));
  }
  demo.addEventListener('pointerup', end);
  demo.addEventListener('pointercancel', end);

  // ---------- Claude demo ----------
  const claude = document.getElementById('claude-demo');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries, obs) => {
      for (const en of entries) if (en.isIntersecting) { claude.classList.add('play'); obs.disconnect(); }
    }, { threshold: 0.45 }).observe(claude);
  } else claude.classList.add('play');
})();
