/* Lumi Neo v2 — small interaction polish layered on the existing app.
   (1) heart burst + touch double-tap like on feed media,
   (2) mobile top bar that tucks away while scrolling down and returns on scroll up. */
(() => {
  /* ---- (1) double-tap like ---- */
  window.addEventListener('lumi:heart-burst', e => {
    const { el, x, y } = e.detail || {};
    const host = el?.closest('.post-image-wrap'); if (!host) return;
    const r = host.getBoundingClientRect();
    const heart = document.createElement('span');
    heart.className = 'neo-heart'; heart.setAttribute('aria-hidden', 'true');
    heart.style.left = (Number.isFinite(x) && x ? x - r.left : r.width / 2) + 'px';
    heart.style.top = (Number.isFinite(y) && y ? y - r.top : r.height / 2) + 'px';
    heart.innerHTML = '<svg viewBox="0 0 24 24" width="84" height="84"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.3 2.7 4.5 6.4 4.5c2.1 0 3.8 1.1 5.6 3.3 1.8-2.2 3.5-3.3 5.6-3.3 3.7 0 5.5 3.8 4 7.3C19.5 16.4 12 21 12 21z"/></svg>';
    host.appendChild(heart);
    try { navigator.vibrate?.(10); } catch (_) {}
    heart.addEventListener('animationend', () => heart.remove(), { once: true });
    setTimeout(() => heart.remove(), 1200);
  });
  let lastTap = null;
  document.addEventListener('pointerup', e => {
    if (e.pointerType !== 'touch') return;
    const img = e.target.closest?.('[data-double-like]'); if (!img) { lastTap = null; return; }
    const now = performance.now();
    if (lastTap && lastTap.img === img && now - lastTap.t < 300 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 48) {
      lastTap = null;
      img.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY }));
    } else lastTap = { img, t: now, x: e.clientX, y: e.clientY };
  }, { passive: true });

  /* ---- (2) auto-hiding top bar (phones only, never on Clips/Chat) ---- */
  document.addEventListener('DOMContentLoaded', () => {
    const bar = document.querySelector('.topbar');
    if (!bar || document.body.classList.contains('clips-view') || document.body.classList.contains('chat-detail-body')) return;
    const mq = window.matchMedia('(max-width: 860px)');
    let lastY = window.scrollY, ticking = false, hidden = false;
    const set = h => { if (h === hidden) return; hidden = h; bar.classList.toggle('is-tucked', h); document.body.classList.toggle('topbar-tucked', h); };
    window.addEventListener('scroll', () => {
      if (ticking || !mq.matches) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY, dy = y - lastY;
        if (y < 90) set(false);
        else if (dy > 8) set(true);
        else if (dy < -8) set(false);
        if (Math.abs(dy) > 8) lastY = y;
        ticking = false;
      });
    }, { passive: true });
    document.addEventListener('lumi:sheet-open', () => set(false));
  });

  /* ---- (3) mobile "more" menu in the top bar ---- */
  window.Lumi?.onMount?.(root => {
    root.querySelectorAll?.('[data-top-more]').forEach(box => {
      if (!window.Lumi.once(box, 'More')) return;
      const btn = box.querySelector('[data-top-more-toggle]'), panel = box.querySelector('.top-more-panel');
      const close = () => { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
      btn.addEventListener('click', e => { e.stopPropagation(); const open = panel.hidden; panel.hidden = !open; btn.setAttribute('aria-expanded', String(open)); });
      document.addEventListener('click', e => { if (!box.contains(e.target)) close(); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
      panel.addEventListener('click', close);
    });
  });

  /* ---- (4) composer: mic <-> send swap, hide-until-needed reply bar ---- */
  window.Lumi?.onMount?.(root => {
    root.querySelectorAll?.('[data-chat-composer]').forEach(f => {
      if (!window.Lumi.once(f, 'Neo')) return;
      const input = f.querySelector('[data-chat-input]'); if (!input) return;
      const sync = () => f.classList.toggle('has-text', input.value.trim().length > 0);
      input.addEventListener('input', sync); f.addEventListener('submit', () => setTimeout(sync, 0)); sync();
    });
  });

  /* ---- (5) desktop: tiles preview their video on hover (never on touch / reduced motion) ---- */
  if (matchMedia('(hover:hover) and (pointer:fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const stop = v => { try { v.pause(); v.currentTime = 0; } catch (_) {} v.classList.remove('is-on'); };
    document.addEventListener('pointerover', e => {
      const tile = e.target.closest?.('.tile.is-video'); if (!tile || tile._neoHover) return; tile._neoHover = true;
      const v = tile.querySelector('.tile-preview'); if (!v) return;
      if (!v.src && v.dataset.src) v.src = v.dataset.src;
      v.play().then(() => v.classList.add('is-on')).catch(() => {});
    });
    document.addEventListener('pointerout', e => {
      const tile = e.target.closest?.('.tile.is-video'); if (!tile || tile.contains(e.relatedTarget)) return; tile._neoHover = false;
      const v = tile.querySelector('.tile-preview'); if (v) stop(v);
    });
  }
})();
