/* Lumi feed v2: endless scroll with look-ahead, media warming and exact "Back" restoration.
   - The next page is requested while the viewer is still ~2 screens away from the end, so posts are
     already in the DOM (and their media warming) before they are reached.
   - Images/videos of upcoming cards are decoded / preloaded ahead of time.
   - Opening a post and pressing Back returns to the same posts at the same scroll position. */
window.Lumi.onMount(function initFeed(root) {
  if (root !== document) return;                       // pager boots once, for the real document
  const more = document.querySelector('[data-feed-more]');
  const list = document.querySelector('[data-feed-posts]');
  if (!more || !list) return;

  const tab = more.dataset.feedTab || 'foryou';
  const nonce = more.dataset.feedNonce || '';
  const skeleton = more.querySelector('[data-feed-skeleton]');
  const end = more.querySelector('[data-feed-end]');
  const errBox = more.querySelector('[data-feed-error]');
  const KEY = 'lumi-feed-state';
  let hasMore = more.dataset.feedHasMore === '1';
  let page = 1, loading = false, failures = 0, restoring = false;

  try { history.scrollRestoration = 'manual'; } catch (_) {}

  /* ---------- look-ahead media warming ---------- */
  const warm = card => {
    card.querySelectorAll('img[loading="lazy"]').forEach(img => { img.loading = 'eager'; img.decoding = 'async'; });
  };
  const warmObserver = 'IntersectionObserver' in window && !window.Lumi.saveData()
    ? new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { warm(e.target); warmObserver.unobserve(e.target); } }), { rootMargin: '220% 0px 220% 0px' })
    : null;
  const watchCards = scope => scope.querySelectorAll('.post-card').forEach(c => {
    if (window.Lumi.once(c, 'Warm') && warmObserver) warmObserver.observe(c);
  });
  watchCards(list);

  /* ---------- paging ---------- */
  async function loadPage() {
    if (loading || !hasMore) return false;
    loading = true;
    if (skeleton) skeleton.hidden = false;
    try {
      const ads = document.querySelectorAll('[data-ad-card],[data-network-ad]').length;
      const url = `/api/feed/page?tab=${encodeURIComponent(tab)}&nonce=${encodeURIComponent(nonce)}&page=${page + 1}&ads=${ads}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!data.ok) throw new Error('bad payload');
      const tpl = document.createElement('template');
      tpl.innerHTML = data.html || '';
      // Never show the same post twice (e.g. after a restored session was re-ranked).
      tpl.content.querySelectorAll('[data-post-id]').forEach(card => {
        const id = card.dataset.postId;
        if (id && list.querySelector(`[data-post-id="${CSS.escape(id)}"]`)) card.remove();
      });
      list.appendChild(tpl.content);
      page = data.page || page + 1;
      hasMore = !!data.hasMore && (data.count || 0) > 0;
      failures = 0;
      window.Lumi.mount(list);
      watchCards(list);
    } catch (err) {
      failures++;
      if (failures >= 3) { hasMore = false; if (errBox) errBox.hidden = false; }
    } finally {
      loading = false;
      if (skeleton) skeleton.hidden = true;
      if (!hasMore && failures < 3 && end) end.hidden = false;
    }
    return true;
  }

  const nearEnd = () => more.getBoundingClientRect().top < window.innerHeight * 2.2;
  async function pump() {
    // Keep loading while the end marker is still close to the viewport (fast scrolling, tall screens).
    let guard = 0;
    while (hasMore && !loading && !restoring && nearEnd() && guard++ < 4) { if (!(await loadPage())) break; }
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) pump(); }, { rootMargin: '0px 0px 220% 0px' }).observe(more);
  } else {
    window.addEventListener('scroll', () => pump(), { passive: true });
  }
  window.addEventListener('scroll', (() => { let t = 0; return () => { if (t) return; t = requestAnimationFrame(() => { t = 0; pump(); }); }; })(), { passive: true });
  errBox?.querySelector('[data-feed-retry]')?.addEventListener('click', () => { failures = 0; hasMore = true; errBox.hidden = true; pump(); });

  /* ---------- back/forward restoration ---------- */
  const save = () => {
    try { sessionStorage.setItem(KEY, JSON.stringify({ tab, nonce, page, y: Math.round(window.scrollY), t: Date.now() })); } catch (_) {}
  };
  window.addEventListener('pagehide', save);
  document.addEventListener('click', e => { if (e.target.closest('a[href]')) save(); }, true);

  (async function restore() {
    let nav = '';
    try { nav = performance.getEntriesByType('navigation')[0]?.type || ''; } catch (_) {}
    if (nav !== 'back_forward') return;
    let state = null;
    try { state = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (_) {}
    if (!state || state.tab !== tab || Date.now() - state.t > 30 * 60_000) return;
    if (state.nonce !== nonce) {                      // same ranked session => same posts in the same order
      location.replace(`/feed?tab=${encodeURIComponent(tab)}&refresh=${encodeURIComponent(state.nonce)}`);
      return;
    }
    restoring = true;
    try { while (hasMore && page < state.page) { if (!(await loadPage())) break; } } finally { restoring = false; }
    window.scrollTo({ top: state.y, behavior: 'instant' });
    pump();
  })();

  pump();
});
