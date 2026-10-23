/* Lumi core v2: tiny mount registry so lazily-loaded feed pages get the same behaviour
   (carousel, video, like, save, tracking, ads) as the server-rendered first page.
   Load this file BEFORE every other Lumi script. */
(() => {
  if (window.Lumi) return;
  const mounts = [];
  const Lumi = {
    version: '2.0.0',
    /** Register a binder. It runs now for the whole document and later for every mounted fragment. */
    onMount(fn) {
      mounts.push(fn);
      const run = () => { try { fn(document); } catch (e) { console.error('Lumi mount:', e); } };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
      else run();
    },
    /** Run every registered binder against freshly inserted DOM. */
    mount(root) {
      if (!root) return;
      for (const fn of mounts) { try { fn(root); } catch (e) { console.error('Lumi mount:', e); } }
      window.lucide?.createIcons();
    },
    /** True for elements that were already wired by a binder. */
    once(el, key) {
      const k = 'lumiBound' + key;
      if (!el || el.dataset[k]) return false;
      el.dataset[k] = '1';
      return true;
    },
    saveData() {
      return document.body?.classList.contains('data-saver') || !!navigator.connection?.saveData;
    },
    reducedMotion() {
      return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    },
    store: {
      get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (_) { return d; } },
      set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
    },
    event(post, type, value = 1) {
      return fetch('/api/feed/event', {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ post, type, value })
      }).catch(() => {});
    }
  };
  window.Lumi = Lumi;

  /* Broken-image safety net. Error events don't bubble, so listen in the capture phase.
     Avatars fall back to the app icon once; media thumbnails get an `is-broken` hook (styled placeholder). */
  const FALLBACK = '/icons/icon-192.png';
  const broken = img => {
    if (!(img instanceof HTMLImageElement) || img.dataset.lumiBroken) return;
    img.dataset.lumiBroken = '1';
    if (img.closest('.avatar,.avatar-mini,.profile-avatar,.creator-pill,.story,.chat-avatar,.note-avatar,.user-line,.detail-author')) {
      if (!img.src.endsWith(FALLBACK)) { img.src = FALLBACK; img.classList.add('avatar-fallback'); }
      return;
    }
    const host = img.closest('.tile,.shared-post,.shared-story,.post-image-wrap,.chat-media');
    img.classList.add('is-broken'); img.removeAttribute('srcset');
    (host || img.parentElement)?.classList.add('has-broken-media');
  };
  document.addEventListener('error', e => broken(e.target), true);
  Lumi.onMount(root => root.querySelectorAll?.('img').forEach(img => { if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) broken(img); }));
})();
