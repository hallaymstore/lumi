/* Shared feed player v2: lazy media with look-ahead warming, one-at-a-time autoplay,
   speed, captions, PiP. Works for lazily loaded feed pages through Lumi.onMount. */
window.Lumi.onMount(root => {
  const saver = window.Lumi.saveData();
  const reduced = window.Lumi.reducedMotion();
  const tm = x => { const n = Math.max(0, Math.floor(Number.isFinite(x) ? x : 0)); return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0'); };
  const state = (window.__lumiFeedVideo = window.__lumiFeedVideo || { muted: true, play: null, warm: null });

  function attach(s, preload) {
    const v = s.querySelector('video');
    if (!v) return;
    if (v.dataset.videoSrc && !v.getAttribute('src')) { v.preload = preload; v.src = v.dataset.videoSrc; v.load(); }
    else if (preload === 'auto' && v.preload !== 'auto') v.preload = 'auto';
  }
  function sync(s) {
    const v = s.querySelector('video'); if (!v) return;
    s.classList.toggle('is-playing', !v.paused && !v.ended);
    s.classList.toggle('is-unmuted', !v.muted);
    const seek = s.querySelector('[data-video-seek]');
    if (seek) seek.value = Number.isFinite(v.duration) && v.duration > 0 ? Math.round(1000 * v.currentTime / v.duration) : 0;
    const time = s.querySelector('[data-video-time]');
    if (time) time.textContent = tm(v.currentTime) + ' / ' + tm(v.duration);
    s.style.setProperty('--video-progress', Number.isFinite(v.duration) && v.duration > 0 ? (v.currentTime / v.duration).toFixed(4) : '0');
  }
  function stopOthers(s) { document.querySelectorAll('[data-lumi-video]').forEach(x => { if (x !== s) x.querySelector('video')?.pause(); }); }
  const safePlay = v => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };

  const shells = [...root.querySelectorAll('[data-lumi-video]')].filter(s => window.Lumi.once(s, 'Video'));
  shells.forEach(s => {
    const v = s.querySelector('video'); if (!v) return;
    v.muted = state.muted; v.playsInline = true;
    s.querySelectorAll('[data-video-toggle]').forEach(b => b.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation(); attach(s, 'auto'); v.paused ? safePlay(v) : v.pause();
    }));
    v.addEventListener('click', () => { attach(s, 'auto'); v.paused ? safePlay(v) : v.pause(); });
    v.addEventListener('play', () => { stopOthers(s); sync(s); });
    v.addEventListener('waiting', () => s.classList.add('is-buffering'));
    v.addEventListener('playing', () => s.classList.remove('is-buffering'));
    v.addEventListener('error', () => s.classList.remove('is-buffering'));
    ['pause', 'loadedmetadata', 'timeupdate', 'volumechange', 'ratechange'].forEach(ev => v.addEventListener(ev, () => sync(s)));
    s.querySelector('[data-video-seek]')?.addEventListener('input', e => { attach(s, 'auto'); if (Number.isFinite(v.duration) && v.duration > 0) v.currentTime = v.duration * Number(e.target.value) / 1000; });
    s.querySelector('[data-video-mute]')?.addEventListener('click', () => { v.muted = !v.muted; state.muted = v.muted; sync(s); });
    s.querySelector('[data-video-speed]')?.addEventListener('click', () => { v.playbackRate = v.playbackRate === 1 ? 1.5 : v.playbackRate === 1.5 ? 2 : 1; const el = s.querySelector('[data-video-speed]'); if (el) el.textContent = v.playbackRate + '×'; });
    s.querySelector('[data-video-captions]')?.addEventListener('click', () => {
      const tracks = v.textTracks; if (!tracks?.length) return;
      const enable = tracks[0].mode !== 'showing'; for (let i = 0; i < tracks.length; i++) tracks[i].mode = enable ? 'showing' : 'disabled';
      s.classList.toggle('captions-on', enable);
    });
    s.querySelector('[data-video-pip]')?.addEventListener('click', async () => { try { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else if (v.requestPictureInPicture) await v.requestPictureInPicture(); } catch (_) {} });
    s.querySelector('[data-video-fullscreen]')?.addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else if (s.requestFullscreen) await s.requestFullscreen(); else v.webkitEnterFullscreen?.(); } catch (_) {} });
    sync(s);
  });
  if (!shells.length) return;

  if (!('IntersectionObserver' in window)) return;
  // Autoplay observer: only the video that is really on screen plays.
  if (!state.play) {
    state.play = new IntersectionObserver(entries => {
      for (const e of entries) {
        const s = e.target, v = s.querySelector('video'); if (!v) continue;
        const front = s.closest('[data-carousel-track]')?.firstElementChild === s;
        if (!e.isIntersecting || e.intersectionRatio < .62) { v.pause(); continue; }
        if (saver) continue;
        attach(s, 'auto');
        if (!reduced && (front || !s.closest('[data-carousel-track]')) && !document.hidden) { v.muted = state.muted; safePlay(v); }
      }
    }, { threshold: [0, .62, .9] });
    // Look-ahead observer: begin fetching the next videos before they scroll into view.
    state.warm = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting || saver) continue;
        attach(e.target, 'metadata');
        state.warm.unobserve(e.target);
      }
    }, { rootMargin: '160% 0px 160% 0px', threshold: 0 });
    document.addEventListener('visibilitychange', () => { if (document.hidden) document.querySelectorAll('[data-lumi-video] video').forEach(v => v.pause()); });
    document.addEventListener('click', e => {
      if (e.target.closest('[data-carousel-prev],[data-carousel-next]')) e.target.closest('[data-carousel]')?.querySelectorAll('video').forEach(v => v.pause());
    });
  }
  shells.forEach(s => { state.play.observe(s); state.warm.observe(s); });
});
