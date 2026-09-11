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

  // Adsterra units stay isolated in their own frames. The countdown begins only
  // after the provider reports a creative (or the monetized direct-link fallback).
  const networkSlots = [...document.querySelectorAll('[data-network-ad]')];
  const networkState = new Map(networkSlots.map(slot => [slot, {
    remaining: Math.max(1, Number(slot.dataset.networkDelay) || 3) * 1000,
    startedAt: 0, timer: null, loadTimer: null, ready: false, loaded: false, started: false, providerReady: false, impressionSent: false
  }]));

  const revealNetwork = (slot, state) => {
    if (state.ready) return;
    state.ready = true;
    clearInterval(state.timer); state.timer = null;
    clearTimeout(state.loadTimer); state.loadTimer = null;
    slot.querySelector('[data-network-lock]')?.setAttribute('hidden', '');
    slot.querySelectorAll('[data-network-cta]').forEach(link => { link.hidden = false; });
    slot.classList.add('network-ready');
    if (!state.impressionSent) {
      state.impressionSent = true;
      fetch('/api/ads/network/impression', {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          placement: slot.dataset.networkPlacement,
          format: slot.dataset.networkFormat,
          providerState: state.providerReady ? 'provider' : 'fallback'
        })
      }).catch(() => {});
    }
    window.lucide?.createIcons();
  };

  const beginNetworkCountdown = (slot, providerReady = false) => {
    const state = networkState.get(slot);
    if (!state || state.started || state.ready) return;
    state.started = true;
    state.providerReady = providerReady;
    clearTimeout(state.loadTimer); state.loadTimer = null;
    slot.classList.remove('network-loading');
    slot.classList.add(providerReady ? 'network-provider-ready' : 'network-provider-fallback');
    const label = slot.querySelector('[data-network-lock-label]');
    if (label) label.textContent = providerReady ? 'Reklamani ko‘ring' : 'Hamkor taklifi tayyor';
    const timerRow = slot.querySelector('[data-network-timer]');
    if (timerRow) timerRow.hidden = false;
    state.startedAt = performance.now();
    state.timer = setInterval(() => {
      const left = state.remaining - (performance.now() - state.startedAt);
      const count = slot.querySelector('[data-network-countdown]');
      if (count) count.textContent = Math.max(0, Math.ceil(left / 1000));
      if (left <= 0) revealNetwork(slot, state);
    }, 150);
  };

  const loadNetwork = slot => {
    const state = networkState.get(slot);
    if (!state || state.loaded) return;
    const frame = slot.querySelector('[data-network-frame]');
    if (frame) {
      slot.classList.add('network-loading');
      frame.addEventListener('load', () => {
        slot.classList.add('network-frame-loaded');
      }, { once: true });
      frame.src = innerWidth <= 640 ? frame.dataset.mobile : frame.dataset.desktop;
      state.loaded = true;
      state.loadTimer = setTimeout(() => beginNetworkCountdown(slot, false), 8000);
    }
  };

  addEventListener('message', event => {
    if (event.data?.type !== 'lumi-adsterra') return;
    const slot = networkSlots.find(item => item.querySelector('[data-network-frame]')?.contentWindow === event.source);
    if (!slot) return;
    beginNetworkCountdown(slot, event.data.state === 'ready');
  });

  if ('IntersectionObserver' in window && networkSlots.length) {
    const networkObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio >= .35) loadNetwork(entry.target);
    }), { threshold: [0, .35, 1] });
    networkSlots.forEach(slot => networkObserver.observe(slot));
  } else networkSlots.forEach(loadNetwork);
});
