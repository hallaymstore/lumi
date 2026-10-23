/* Lumi Clips v2.0 — full-screen vertical video feed.
 *  - exactly one clip plays: the one that is on screen (muted autoplay, sound after the first unmute);
 *  - the NEXT two clips are preloaded while you watch, far-away ones are released to save memory;
 *  - tap = pause/play, double-tap = like with heart burst, drag the bottom bar to seek;
 *  - endless, interest-aware recommendations through /api/clips/next.
 *  Overlay handling: pauses on sheets (comments/share), tab switches and while a dialog is open. */
(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const list = document.querySelector('[data-clip-scroll]');
    if (!list) return;
    const end = list.querySelector('[data-clips-end]');
    const L = window.Lumi;
    const saver = L.saveData();
    const reduced = L.reducedMotion();
    const loggedIn = document.body.dataset.authenticated === '1';
    const MUTE_KEY = 'lumi-clips-muted';

    let cards = [...list.querySelectorAll('[data-clip]')];
    let active = null, overlay = 0, resume = false, loading = false, hasMore = true, loadFailures = 0;
    let muted = L.store.get(MUTE_KEY, '1') !== '0';

    const vid = c => c.querySelector('video');
    const fmt = x => { const n = Math.max(0, Math.floor(Number.isFinite(x) ? x : 0)); return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0'); };

    /* ---------- loading / memory management ---------- */
    function load(c, preload = 'auto') {
      const v = vid(c); if (!v) return;
      if (!v.getAttribute('src') && v.dataset.source) { v.preload = preload; v.src = v.dataset.source; v.load(); }
      else if (preload === 'auto' && v.preload !== 'auto') v.preload = 'auto';
    }
    function release(c) {
      const v = vid(c); if (!v || !v.getAttribute('src')) return;
      v.pause(); v.removeAttribute('src'); v.load();
      c.classList.remove('is-ready', 'is-playing', 'is-buffering');
    }
    /** Keep: current + 1 back (instant back-swipe), next two preloaded; free everything further than 3 away. */
    function warmAround(idx) {
      cards.forEach((c, i) => {
        const d = i - idx;
        if (d === 0) load(c, 'auto');
        else if (d === 1) load(c, saver ? 'metadata' : 'auto');
        else if (d === 2 && !saver) load(c, 'metadata');
        else if (Math.abs(d) > 3) release(c);
      });
    }

    /* ---------- UI state ---------- */
    function update(c) {
      const v = vid(c), seek = c.querySelector('[data-clip-seek]'), label = c.querySelector('[data-clip-time]');
      const ratio = Number.isFinite(v.duration) && v.duration > 0 ? v.currentTime / v.duration : 0;
      c.classList.toggle('is-playing', !v.paused && !v.ended);
      c.classList.toggle('is-muted', v.muted);
      c.style.setProperty('--clip-progress', ratio.toFixed(4));
      if (label) label.textContent = fmt(v.currentTime) + ' / ' + fmt(v.duration);
      if (seek && !c._scrubbing) seek.value = Math.round(ratio * 1000);
    }
    function applyMute() { cards.forEach(c => { const v = vid(c); v.muted = muted; update(c); }); }
    function flash(c, state) {
      c.dataset.flash = state; c.classList.remove('flashing'); void c.offsetWidth; c.classList.add('flashing');
    }
    function burst(c, x, y) {
      const heart = c.querySelector('[data-clip-heart]'); if (!heart) return;
      const r = c.querySelector('[data-clip-stage]').getBoundingClientRect();
      heart.style.left = (Number.isFinite(x) ? x - r.left : r.width / 2) + 'px';
      heart.style.top = (Number.isFinite(y) ? y - r.top : r.height / 2) + 'px';
      heart.classList.remove('burst'); void heart.offsetWidth; heart.classList.add('burst');
    }
    function likeClip(c, x, y) {
      burst(c, x, y);
      try { navigator.vibrate?.(10); } catch (_) {}
      const form = c.querySelector('.ajax-like-form');
      if (form) { const b = form.querySelector('button'); if (b && !b.classList.contains('liked') && !b.disabled) form.requestSubmit(); }
      else c.querySelector('[data-auth-required]')?.click();
    }
    function closeMenus(except) {
      list.querySelectorAll('[data-clip-menu]:not([hidden])').forEach(m => {
        if (m === except) return;
        m.hidden = true;
        m.closest('[data-clip]')?.querySelector('[data-clip-settings]')?.setAttribute('aria-expanded', 'false');
      });
    }

    /* ---------- statistics (feeds the recommendation algorithm) ---------- */
    function trackView(c) {
      if (c._viewRecorded) return; c._viewRecorded = true;
      fetch('/api/posts/' + encodeURIComponent(c.dataset.postId) + '/view', { method: 'POST', headers: { Accept: 'application/json' }, credentials: 'same-origin', keepalive: true }).catch(() => {});
    }
    function markPlay(c) { if (!vid(c).paused && !c._playSince) c._playSince = performance.now(); c._played = true; }
    function markPause(c) {
      if (c?._playSince) { c._watchSeconds = (c._watchSeconds || 0) + Math.max(0, (performance.now() - c._playSince) / 1000); c._playSince = 0; }
    }
    function flush(c) {
      if (!c || c._sent || !loggedIn || !c._played) return;
      markPause(c);
      const v = vid(c), seconds = Math.min(30, c._watchSeconds || 0);
      const ratio = Number.isFinite(v.duration) && v.duration > 0 ? Math.min(1, Math.max(0, c._furthest || 0)) : 0;
      const data = new URLSearchParams({ postId: c.dataset.postId, seconds: seconds.toFixed(2), ratio: ratio.toFixed(3) });
      c._sent = true;
      if (navigator.sendBeacon && navigator.sendBeacon('/api/clips/watch', data)) return;
      fetch('/api/clips/watch', { method: 'POST', body: data, credentials: 'same-origin', keepalive: true }).catch(() => {});
    }

    /* ---------- playback ---------- */
    async function play(c, manual = false) {
      if (!c || document.hidden || overlay) return;
      if ((saver || reduced) && !manual) { c.classList.add('needs-tap'); return; }
      if (c._manualPause && !manual) return;
      load(c, 'auto');
      const v = vid(c); v.muted = muted; if (c._rate) v.playbackRate = c._rate;
      c.classList.add('is-loading'); c.classList.remove('has-error');
      try { await v.play(); c._manualPause = false; c.classList.remove('needs-tap'); trackView(c); }
      catch (e) {
        if (e && e.name === 'AbortError') { /* swiped away mid-load: not an error */ }
        else if (e && e.name === 'NotAllowedError' && !v.muted) {
          // Browser refuses sound without a gesture: fall back to muted playback and show the "unmute" pill.
          muted = true; applyMute();
          try { await v.play(); c._manualPause = false; trackView(c); } catch (_) { if (active === c) c.classList.add('needs-tap'); }
        } else if (active === c && !document.hidden) c.classList.add('needs-tap');
      } finally { c.classList.remove('is-loading'); update(c); }
    }
    async function toggle(c) {
      if (active !== c) activate(c);
      const v = vid(c);
      if (c.classList.contains('has-error')) { release(c); load(c, 'auto'); c._manualPause = false; await play(c, true); return; }
      if (v.paused) { c._manualPause = false; flash(c, 'play'); await play(c, true); }
      else { c._manualPause = true; v.pause(); flash(c, 'pause'); }
    }
    function deactivate(c) {
      flush(c);
      const v = vid(c); v.pause();
      c.classList.remove('is-current', 'needs-tap', 'show-menu');
      c._watchSeconds = 0; c._furthest = 0; c._sent = false; c._playSince = 0; c._played = false;
      try { if (v.currentTime > .3) v.currentTime = 0; } catch (_) {}   // a clip you come back to starts over
    }
    function activate(c) {
      if (!c || active === c) return;
      if (active) deactivate(active);
      active = c; c.classList.add('is-current'); c._manualPause = false;
      closeMenus();
      const idx = cards.indexOf(c);
      warmAround(idx);
      play(c);
      if (idx >= cards.length - 3) loadMore();
    }
    function captions(c, on) {
      const tracks = vid(c).textTracks; if (!tracks?.length) return;
      for (let i = 0; i < tracks.length; i++) tracks[i].mode = on ? 'showing' : 'disabled';
      c.classList.toggle('captions-on', on);
    }

    /* ---------- per-card wiring ---------- */
    function mount(c) {
      if (c.dataset.ready === '1') return; c.dataset.ready = '1';
      const v = vid(c); if (!v) return;
      v.defaultMuted = true; v.muted = muted; v.playsInline = true; v.loop = true;
      for (const ev of ['timeupdate', 'loadedmetadata', 'play', 'pause', 'ratechange', 'volumechange']) v.addEventListener(ev, () => {
        if (ev === 'play') markPlay(c);
        if (ev === 'pause') markPause(c);
        if (ev === 'timeupdate' && Number.isFinite(v.duration) && v.duration > 0) c._furthest = Math.max(c._furthest || 0, v.currentTime / v.duration);
        if (ev === 'loadedmetadata') c.classList.toggle('is-landscape', v.videoWidth && v.videoHeight && v.videoWidth / v.videoHeight > .8);
        update(c);
      });
      v.addEventListener('loadeddata', () => { c.classList.add('is-ready'); if (active === c && v.paused && !c._manualPause && !overlay) play(c); });
      v.addEventListener('canplay', () => { if (active === c && v.paused && !c._manualPause && !overlay) play(c); });
      v.addEventListener('waiting', () => c.classList.add('is-buffering'));
      v.addEventListener('playing', () => c.classList.remove('is-buffering', 'needs-tap', 'has-error'));
      v.addEventListener('error', () => { if (!v.getAttribute('src')) return; c.classList.remove('is-loading', 'is-buffering'); c.classList.add('has-error', 'needs-tap'); });

      // Tap / double-tap on the whole stage.
      const hit = c.querySelector('.lumi-clip-hit');
      let lastTap = 0, lastX = 0, lastY = 0, tapTimer = 0;
      hit?.addEventListener('pointerup', e => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const now = performance.now(), near = Math.hypot(e.clientX - lastX, e.clientY - lastY) < 70;
        if (now - lastTap < 300 && near) { clearTimeout(tapTimer); lastTap = 0; if (active !== c) activate(c); likeClip(c, e.clientX, e.clientY); }
        else { lastTap = now; lastX = e.clientX; lastY = e.clientY; tapTimer = setTimeout(() => toggle(c), 230); }
      });
      hit?.addEventListener('click', e => { if (e.detail === 0) toggle(c); });     // keyboard activation

      // Seek bar.
      const seek = c.querySelector('[data-clip-seek]');
      seek?.addEventListener('pointerdown', () => { c._scrubbing = true; c.classList.add('is-scrubbing'); load(c, 'auto'); });
      const endScrub = () => { c._scrubbing = false; c.classList.remove('is-scrubbing'); };
      seek?.addEventListener('pointerup', endScrub); seek?.addEventListener('pointercancel', endScrub); seek?.addEventListener('blur', endScrub);
      seek?.addEventListener('input', e => { load(c, 'auto'); if (Number.isFinite(v.duration) && v.duration > 0) v.currentTime = v.duration * Number(e.target.value) / 1000; update(c); });

      // Sound (applies to every clip, remembered for the next visit).
      c.querySelector('[data-clip-mute]')?.addEventListener('click', e => {
        e.stopPropagation();
        muted = !vid(active || c).muted; L.store.set(MUTE_KEY, muted ? '1' : '0');
        applyMute(); if (!muted && active) play(active, true);
      });

      // Menu: speed, captions, PiP, fullscreen.
      const menu = c.querySelector('[data-clip-menu]'), settings = c.querySelector('[data-clip-settings]');
      settings?.addEventListener('click', e => {
        e.stopPropagation();
        const open = menu.hidden; closeMenus(open ? menu : null);
        menu.hidden = !open; settings.setAttribute('aria-expanded', String(open));
      });
      c.querySelector('[data-clip-speed]')?.addEventListener('click', () => {
        c._rate = v.playbackRate === 1 ? 1.5 : v.playbackRate === 1.5 ? 2 : 1; v.playbackRate = c._rate;
        c.querySelector('[data-speed-value]').textContent = c._rate + '×';
      });
      c.querySelector('[data-clip-cc]')?.addEventListener('click', () => captions(c, !c.classList.contains('captions-on')));
      c.querySelector('[data-clip-fullscreen]')?.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); else c.querySelector('[data-clip-stage]').requestFullscreen?.().catch(() => {}); });
      c.querySelector('[data-clip-pip]')?.addEventListener('click', async () => { try { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else if (document.pictureInPictureEnabled && v.requestPictureInPicture) await v.requestPictureInPicture(); } catch (_) {} });
      update(c);
    }
    document.addEventListener('pointerdown', e => { if (!e.target.closest('[data-clip-menu],[data-clip-settings]')) closeMenus(); }, true);

    /* ---------- endless recommendations ---------- */
    async function loadMore() {
      if (loading || !hasMore) return;
      loading = true; list.classList.add('is-loading-more');
      try {
        const ids = cards.slice(-90).map(c => c.dataset.postId).join(',');
        const res = await fetch('/api/clips/next?seen=' + encodeURIComponent(ids), { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json(); if (!data.ok) throw new Error('payload');
        const tpl = document.createElement('template'); tpl.innerHTML = data.html || '';
        const fresh = [...tpl.content.querySelectorAll('[data-clip]')].filter(c => !cards.some(x => x.dataset.postId === c.dataset.postId));
        if (fresh.length) {
          list.insertBefore(tpl.content, end || null);
          cards = [...list.querySelectorAll('[data-clip]')];
          fresh.forEach(c => { mount(c); io?.observe(c); });
          window.lucide?.createIcons();
          if (active) warmAround(cards.indexOf(active));
        }
        hasMore = !!data.hasMore && fresh.length > 0; loadFailures = 0;
      } catch (e) {
        loadFailures++; if (loadFailures >= 2) hasMore = false;
      } finally {
        loading = false; list.classList.remove('is-loading-more');
        if (!hasMore && end) end.hidden = false;
      }
    }

    /* ---------- observers / events ---------- */
    let io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(entries => {
        const shown = entries.filter(e => e.isIntersecting && e.intersectionRatio >= .6).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (shown) activate(shown.target);
        for (const e of entries) { if (!e.isIntersecting && e.target !== active) vid(e.target).pause(); }
      }, { root: list, threshold: [0, .6, .9] });
    }
    cards.forEach(c => { mount(c); io?.observe(c); });
    if (cards.length) activate(cards[0]);

    document.addEventListener('lumi:sheet-open', () => { if (overlay === 0) { resume = !!active && !vid(active).paused; active && vid(active).pause(); } overlay++; });
    document.addEventListener('lumi:sheet-close', () => {
      overlay = Math.max(0, overlay - 1);
      if (!overlay && resume && active && !document.hidden) play(active);
      if (!overlay) resume = false;
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { active && vid(active).pause(); flush(active); }
      else if (active && !overlay && !active._manualPause) play(active);
    });
    window.addEventListener('pagehide', () => flush(active));
    // A swipe/touch can unlock playback in Android WebViews that delay muted autoplay.
    let swipeOrigin = null;
    list.addEventListener('touchstart', e => { swipeOrigin = e.touches?.[0]?.clientY ?? null; }, { passive: true });
    list.addEventListener('touchmove', e => {
      const y = e.touches?.[0]?.clientY;
      if (swipeOrigin !== null && Number.isFinite(y) && Math.abs(y - swipeOrigin) > 16) {
        swipeOrigin = null;
        if (active && !saver && !reduced && !overlay && !active._manualPause && vid(active).paused) play(active, true);
      }
    }, { passive: true });
    end?.querySelector('[data-clips-refresh]')?.addEventListener('click', () => location.reload());

    function shift(delta) {
      const idx = Math.max(0, cards.indexOf(active)), next = cards[Math.min(cards.length - 1, Math.max(0, idx + delta))];
      next?.scrollIntoView({ block: 'start', behavior: reduced ? 'instant' : 'smooth' });
    }
    document.addEventListener('keydown', e => {
      if (!active || overlay || document.querySelector('.sheet-backdrop.open') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || e.ctrlKey || e.metaKey) return;
      const k = e.key.toLowerCase();
      if (['arrowdown', 'arrowup', ' ', 'm', 'c', 'l', 'f'].includes(k)) e.preventDefault();
      if (k === 'arrowdown') shift(1); else if (k === 'arrowup') shift(-1);
      else if (k === ' ') toggle(active);
      else if (k === 'm') active.querySelector('[data-clip-mute]')?.click();
      else if (k === 'c') active.querySelector('[data-clip-cc]')?.click();
      else if (k === 'l') likeClip(active);
      else if (k === 'f') active.querySelector('[data-clip-fullscreen]')?.click();
    });
    // Keep the current clip aligned when the viewport changes (address bar, rotation).
    let rz = 0;
    window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => active?.scrollIntoView({ block: 'start', behavior: 'instant' }), 140); });
    // On browsers without IntersectionObserver, scroll snap still works.
    if (!io) list.addEventListener('scroll', () => {
      const idx = Math.max(0, Math.min(cards.length - 1, Math.round(list.scrollTop / Math.max(1, list.clientHeight))));
      activate(cards[idx]);
    }, { passive: true });
  });
})();
