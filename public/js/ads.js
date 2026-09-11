document.addEventListener('DOMContentLoaded', () => {
  const cards = [...document.querySelectorAll('[data-ad-card]')];

  const send = (card, type) => fetch(`/api/ads/${card.dataset.adId}/${type}`, {
    method: 'POST', keepalive: true,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ placement: card.dataset.adPlacement })
  }).catch(() => {});

  const reveal = card => {
    const wait = card.querySelector('[data-ad-wait]');
    const cta = card.querySelector('[data-ad-cta]');
    if (wait) wait.hidden = true;
    if (cta) cta.hidden = false;
    card.classList.add('ad-ready');
    window.lucide?.createIcons();
  };

  const states = new Map(cards.map(card => [card, {
    remaining: Math.max(1, Number(card.dataset.adDelay) || 3) * 1000,
    visibleSince: 0, tick: null, impressionTimer: null, impressed: false, ready: false
  }]));

  const updateCountdown = (card, state) => {
    const count = card.querySelector('[data-ad-countdown]');
    if (count) count.textContent = Math.max(1, Math.ceil(state.remaining / 1000));
  };

  const start = card => {
    const state = states.get(card);
    if (!state || state.visibleSince || state.ready) return;
    state.visibleSince = performance.now();
    if (!state.impressed) state.impressionTimer = setTimeout(() => {
      if (!state.visibleSince) return;
      state.impressed = true;
      send(card, 'impression');
    }, 800);
    state.tick = setInterval(() => {
      const elapsed = performance.now() - state.visibleSince;
      const left = state.remaining - elapsed;
      if (left <= 0) {
        state.remaining = 0; state.ready = true;
        clearInterval(state.tick); state.tick = null;
        reveal(card);
      } else {
        const count = card.querySelector('[data-ad-countdown]');
        if (count) count.textContent = Math.ceil(left / 1000);
      }
    }, 150);
  };

  const pause = card => {
    const state = states.get(card);
    if (!state || !state.visibleSince || state.ready) return;
    state.remaining = Math.max(0, state.remaining - (performance.now() - state.visibleSince));
    state.visibleSince = 0;
    clearInterval(state.tick); state.tick = null;
    clearTimeout(state.impressionTimer); state.impressionTimer = null;
    updateCountdown(card, state);
  };

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio >= .55) start(entry.target);
      else pause(entry.target);
    }), { threshold: [0, .55, 1] });
    cards.forEach(card => observer.observe(card));
  } else cards.forEach(start);

  cards.forEach(card => card.querySelector('[data-ad-dismiss]')?.addEventListener('click', () => {
    send(card, 'dismiss');
    card.classList.add('ad-dismissed');
    setTimeout(() => card.remove(), 180);
  }));

  // Existing Adsterra banner zones are isolated in sandboxed same-origin iframes.
  // The lock pauses whenever the slot leaves the viewport, matching the native CTA rule.
  const networkSlots = [...document.querySelectorAll('[data-network-ad]')];
  const networkState = new Map(networkSlots.map(slot => [slot, {
    remaining: Math.max(1, Number(slot.dataset.networkDelay) || 3) * 1000,
    visibleSince: 0, timer: null, ready: false, loaded: false
  }]));
  const startNetwork = slot => {
    const state = networkState.get(slot);
    if (!state || state.visibleSince || state.ready) return;
    const frame = slot.querySelector('[data-network-frame]');
    if (frame && !state.loaded) {
      slot.classList.add('network-loading');
      frame.addEventListener('load', () => {
        slot.classList.remove('network-loading');
        slot.classList.add('network-loaded');
      }, { once: true });
      frame.src = innerWidth <= 640 ? frame.dataset.mobile : frame.dataset.desktop;
      state.loaded = true;
    }
    state.visibleSince = performance.now();
    state.timer = setInterval(() => {
      const left = state.remaining - (performance.now() - state.visibleSince);
      const count = slot.querySelector('[data-network-countdown]');
      if (count) count.textContent = Math.max(0, Math.ceil(left / 1000));
      if (left <= 0) {
        state.remaining = 0; state.ready = true;
        clearInterval(state.timer); state.timer = null;
        slot.querySelector('[data-network-lock]')?.setAttribute('hidden', '');
        slot.classList.add('network-ready');
        window.lucide?.createIcons();
      }
    }, 150);
  };
  const pauseNetwork = slot => {
    const state = networkState.get(slot);
    if (!state || !state.visibleSince || state.ready) return;
    state.remaining = Math.max(0, state.remaining - (performance.now() - state.visibleSince));
    state.visibleSince = 0;
    clearInterval(state.timer); state.timer = null;
  };
  if ('IntersectionObserver' in window && networkSlots.length) {
    const networkObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio >= .55) startNetwork(entry.target);
      else pauseNetwork(entry.target);
    }), { threshold: [0, .55, 1] });
    networkSlots.forEach(slot => networkObserver.observe(slot));
  } else networkSlots.forEach(startNetwork);
});
