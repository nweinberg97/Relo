// Small UI helpers: escaping, toasts, modals, menus, dates.
import { icon } from './icons.js';
import { CARD_TYPES } from './templates.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function initials(title) {
  const words = title.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '·';
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase();
}

export const typeColor = (type) => CARD_TYPES[type]?.color || 'neutral';

export function announce(msg) {
  const a = $('#announcer');
  a.textContent = '';
  requestAnimationFrame(() => { a.textContent = msg; });
}

// ---------- toasts ----------
export function toast(message, { action, onAction, duration = 4000 } = {}) {
  const host = $('#toasts');
  // Only one toast at a time keeps things calm.
  for (const t of host.children) dismiss(t);
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button type="button">${esc(action)}</button>` : ''}`;
  host.append(el);
  requestAnimationFrame(() => el.classList.add('open'));
  let timer = setTimeout(() => dismiss(el), duration);
  el.addEventListener('mouseenter', () => clearTimeout(timer));
  el.addEventListener('mouseleave', () => { timer = setTimeout(() => dismiss(el), 1800); });
  if (action) el.querySelector('button').addEventListener('click', () => { dismiss(el); onAction?.(); });
  return el;
}
function dismiss(el) {
  el.classList.remove('open');
  setTimeout(() => el.remove(), 200);
}

// ---------- modal ----------
let openModals = [];
export function modal({ html, wide = false, label = 'Dialog', onClose, onMount, className = '' }) {
  const prevFocus = document.activeElement;
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="scrim"></div><div class="modal ${wide ? 'wide' : ''} ${className}" role="dialog" aria-modal="true" aria-label="${esc(label)}">${html}</div>`;
  $('#overlays').append(wrap);
  const box = wrap.querySelector('.modal');
  const scrim = wrap.querySelector('.scrim');
  requestAnimationFrame(() => { box.classList.add('open'); scrim.classList.add('open'); });
  const api = {
    el: box,
    close(result) {
      if (api.closed) return;
      api.closed = true;
      openModals = openModals.filter((m) => m !== api);
      box.classList.remove('open'); scrim.classList.remove('open');
      setTimeout(() => wrap.remove(), 220);
      onClose?.(result);
      if (prevFocus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
    },
  };
  scrim.addEventListener('click', () => api.close());
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); api.close(); }
    if (e.key === 'Tab') trapFocus(e, box);
  });
  openModals.push(api);
  onMount?.(box, api);
  setTimeout(() => {
    const f = box.querySelector('[autofocus]') || box.querySelector('input, textarea, select, button');
    f?.focus();
  }, 30);
  return api;
}
export const anyModalOpen = () => openModals.length > 0;

export function trapFocus(e, root) {
  const f = $$('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])', root).filter((x) => x.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f.at(-1);
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

export function confirmDialog({ title, body, confirm = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    const m = modal({
      label: title,
      html: `<div class="modal-head"><h2>${esc(title)}</h2>${body ? `<p>${esc(body)}</p>` : ''}</div>
        <div class="modal-foot" style="margin-top:20px"><button class="btn btn-ghost" data-x>Cancel</button><button class="btn ${danger ? 'btn-secondary btn-danger' : 'btn-primary'}" data-ok autofocus>${esc(confirm)}</button></div>`,
      onClose: () => resolve(result),
      onMount: (box, api) => {
        box.querySelector('[data-x]').onclick = () => api.close();
        box.querySelector('[data-ok]').onclick = () => { result = true; api.close(); };
      },
    });
    return m;
  });
}

export function promptDialog({ title, value = '', label = '', confirm = 'Save', type = 'text' }) {
  return new Promise((resolve) => {
    let result = null;
    modal({
      label: title,
      html: `<form><div class="modal-head"><h2>${esc(title)}</h2></div>
        <div class="modal-body"><label class="sr-only" for="pd">${esc(label || title)}</label><input id="pd" class="field" type="${type}" value="${esc(value)}" autofocus></div>
        <div class="modal-foot"><button type="button" class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary">${esc(confirm)}</button></div></form>`,
      onClose: () => resolve(result),
      onMount: (box, api) => {
        const input = box.querySelector('input');
        setTimeout(() => input.select(), 40);
        box.querySelector('[data-x]').onclick = () => api.close();
        box.querySelector('form').onsubmit = (e) => { e.preventDefault(); result = input.value; api.close(); };
      },
    });
  });
}

// ---------- menu ----------
let openMenu = null;
export function menu(anchor, items) {
  closeMenu();
  const el = document.createElement('div');
  el.className = 'menu';
  el.setAttribute('role', 'menu');
  el.innerHTML = items.map((it, i) => it === '-' ? '<hr>' : `<button role="menuitem" data-i="${i}" class="${it.danger ? 'danger' : ''}">${it.icon ? icon(it.icon, 15) : ''}${esc(it.label)}</button>`).join('');
  document.body.append(el);
  const r = anchor.getBoundingClientRect();
  const w = el.offsetWidth, h = el.offsetHeight;
  let left = Math.min(r.left, window.innerWidth - w - 8);
  let top = r.bottom + 6;
  if (top + h > window.innerHeight - 8) top = r.top - h - 6;
  el.style.left = Math.max(8, left) + 'px';
  el.style.top = Math.max(8, top) + 'px';
  requestAnimationFrame(() => el.classList.add('open'));
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    const it = items[+b.dataset.i];
    closeMenu();
    it.run?.();
  });
  el.addEventListener('keydown', (e) => {
    const btns = $$('button', el);
    const i = btns.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); }
    if (e.key === 'Escape') { closeMenu(); anchor.focus(); }
  });
  openMenu = { el, anchor };
  setTimeout(() => el.querySelector('button')?.focus(), 0);
  setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
}
function outside(e) { if (openMenu && !openMenu.el.contains(e.target)) closeMenu(); }
export function closeMenu() {
  if (!openMenu) return;
  const { el } = openMenu;
  openMenu = null;
  document.removeEventListener('pointerdown', outside, true);
  el.classList.remove('open');
  setTimeout(() => el.remove(), 150);
}

// ---------- dates ----------
const DAY = 86400000;
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

export function dueLabel(iso) {
  const d = new Date(iso);
  const diff = Math.round((startOfDay(d) - startOfDay(new Date())) / DAY);
  const time = d.getHours() || d.getMinutes() ? d.toLocaleTimeString([], { hour: 'numeric', minute: d.getMinutes() ? '2-digit' : undefined }) : '';
  let day;
  if (diff === 0) day = 'Today';
  else if (diff === 1) day = 'Tomorrow';
  else if (diff === -1) day = 'Yesterday';
  else if (diff > 1 && diff < 7) day = d.toLocaleDateString([], { weekday: 'short' });
  else day = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return { text: time ? `${day} · ${time}` : day, short: day, state: diff < 0 ? 'overdue' : diff === 0 ? 'today' : 'later', diff };
}

export function relTime(iso) {
  const ms = Date.now() - Date.parse(iso);
  const m = Math.round(ms / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 7) return d === 1 ? 'Yesterday' : `${d} days ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: new Date(iso).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
}

// Local date+time input values <-> ISO
export function toLocalInput(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return { date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, time: `${p(d.getHours())}:${p(d.getMinutes())}` };
}
export function fromLocalInput(date, time) {
  if (!date) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '09:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm).toISOString();
}
export function quickDate(kind) {
  const d = new Date();
  d.setSeconds(0, 0);
  if (kind === 'today') d.setHours(Math.min(23, Math.max(d.getHours() + 1, 17)), 0);
  if (kind === 'tomorrow') { d.setDate(d.getDate() + 1); d.setHours(9, 0); }
  if (kind === 'friday') { const add = ((5 - d.getDay()) + 7) % 7 || 7; d.setDate(d.getDate() + add); d.setHours(10, 0); }
  if (kind === 'week') { d.setDate(d.getDate() + 7); d.setHours(9, 0); }
  return d.toISOString();
}

export function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
