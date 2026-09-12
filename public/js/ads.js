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

  /*
   * Network advertisements are isolated in sandboxed same-site frames. We keep
   * the provider creative hidden until the frame explicitly reports that a
   * real creative exists; this prevents the white/empty square that was visible
   * while ad blockers, DNS filters, or low fill-rate were resolving the unit.
   *
   * The card may visually disappear/reappear after a watched interval, but the
   * provider frame is NOT reloaded and the impression is NOT counted again.
   * This gives the requested compact rotating feel without artificial refreshes.
   */
  const networkSlots = [...document.querySelectorAll('[data-network-ad]')];
  const networkState = new Map(networkSlots.map(slot => [slot, {
    unlockRemaining: Math.max(1, Number(slot.dataset.networkDelay) || 3) * 1000,
    displayRemaining: Math.max(8, Number(slot.dataset.networkVisible) || 12) * 1000,
    cooldownMs: Math.max(15, Number(slot.dataset.networkCooldown) || 28) * 1000,
    unlockStartedAt: 0,
    displayStartedAt: 0,
    unlockTimer: null,
    displayTimer: null,
    loadTimer: null,
    cooldownTimer: null,
    loaded: false,
    providerResolved: false,
    providerReady: false,
    unlocked: false,
    inView: false,
    impressionSent: false,
    sleeping: false
  }]));

  const actualFormat = slot => innerWidth <= 640
    ? (slot.dataset.networkMobileFormat || slot.dataset.networkFormat || 'mobile')
    : (slot.dataset.networkDesktopFormat || slot.dataset.networkFormat || 'desktop');

  const status = (slot, text, mode = 'loading') => {
    const label = slot.querySelector('[data-network-status]');
    if (label) label.textContent = text;
    slot.dataset.networkStatus = mode;
    const chip = slot.querySelector('[data-network-live-chip]');
    if (chip) chip.dataset.state = mode;
  };

  const updateUnlockCount = (slot, state) => {
    const node = slot.querySelector('[data-network-countdown]');
    if (node) node.textContent = Math.max(0, Math.ceil(state.unlockRemaining / 1000));
  };

  const updateDisplayCount = (slot, state) => {
    const node = slot.querySelector('[data-network-visible-countdown]');
    if (node) node.textContent = Math.max(0, Math.ceil(state.displayRemaining / 1000));
  };

  const sendNetworkImpression = (slot, state) => {
    if (state.impressionSent) return;
    state.impressionSent = true;
    fetch('/api/ads/network/impression', {
      method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        placement: slot.dataset.networkPlacement,
        format: actualFormat(slot),
        providerState: state.providerReady ? 'provider' : 'fallback'
      })
    }).catch(() => {});
  };

  const pauseUnlock = (slot, state) => {
    if (!state.unlockStartedAt || state.unlocked) return;
    state.unlockRemaining = Math.max(0, state.unlockRemaining - (performance.now() - state.unlockStartedAt));
    state.unlockStartedAt = 0;
    clearInterval(state.unlockTimer); state.unlockTimer = null;
    updateUnlockCount(slot, state);
  };

  const pauseDisplay = (slot, state) => {
    if (!state.displayStartedAt || state.sleeping) return;
    state.displayRemaining = Math.max(0, state.displayRemaining - (performance.now() - state.displayStartedAt));
    state.displayStartedAt = 0;
    clearInterval(state.displayTimer); state.displayTimer = null;
    updateDisplayCount(slot, state);
  };

  const wakeNetwork = (slot, state) => {
    state.sleeping = false;
    state.displayRemaining = Math.max(8, Number(slot.dataset.networkVisible) || 12) * 1000;
    slot.classList.remove('network-sleeping');
    slot.classList.add('network-reappearing');
    setTimeout(() => slot.classList.remove('network-reappearing'), 420);
    const watch = slot.querySelector('[data-network-watch]');
    if (watch) watch.hidden = false;
    updateDisplayCount(slot, state);
    status(slot, state.providerReady ? 'Adsterra live' : 'Zaxira taklif', state.providerReady ? 'live' : 'fallback');
    if (state.inView) startDisplay(slot, state);
  };

  const sleepNetwork = (slot, state) => {
    if (state.sleeping) return;
    state.sleeping = true;
    state.displayStartedAt = 0;
    clearInterval(state.displayTimer); state.displayTimer = null;
    const watch = slot.querySelector('[data-network-watch]');
    if (watch) watch.hidden = true;
    slot.classList.add('network-sleeping');
    status(slot, `Yana ${Math.ceil(state.cooldownMs / 1000)}s dan keyin`, 'sleeping');
    clearTimeout(state.cooldownTimer);
    state.cooldownTimer = setTimeout(() => wakeNetwork(slot, state), state.cooldownMs);
  };

  function startDisplay(slot, state) {
    if (!state.unlocked || state.sleeping || !state.inView || state.displayStartedAt) return;
    state.displayStartedAt = performance.now();
    state.displayTimer = setInterval(() => {
      const left = state.displayRemaining - (performance.now() - state.displayStartedAt);
      const node = slot.querySelector('[data-network-visible-countdown]');
      if (node) node.textContent = Math.max(0, Math.ceil(left / 1000));
      if (left <= 0) {
        state.displayRemaining = 0;
        sleepNetwork(slot, state);
      }
    }, 200);
  }

  const unlockNetwork = (slot, state) => {
    if (state.unlocked) return;
    state.unlocked = true;
    state.unlockRemaining = 0;
    state.unlockStartedAt = 0;
    clearInterval(state.unlockTimer); state.unlockTimer = null;
    const lock = slot.querySelector('[data-network-lock]');
    if (lock) lock.hidden = true;
    slot.querySelectorAll('[data-network-cta]').forEach(link => { link.hidden = false; });
    const watch = slot.querySelector('[data-network-watch]');
    if (watch) watch.hidden = false;
    slot.classList.add('network-ready');
    sendNetworkImpression(slot, state);
    updateDisplayCount(slot, state);
    if (state.inView) startDisplay(slot, state);
    window.lucide?.createIcons();
  };

  const startUnlock = (slot, state) => {
    if (!state.providerResolved || state.unlocked || !state.inView || state.unlockStartedAt) return;
    const label = slot.querySelector('[data-network-lock-label]');
    if (label) label.textContent = state.providerReady ? 'Reklamani ko‘ring' : 'Zaxira taklif tayyor';
    const timerRow = slot.querySelector('[data-network-timer]');
    if (timerRow) timerRow.hidden = false;
    state.unlockStartedAt = performance.now();
    state.unlockTimer = setInterval(() => {
      const left = state.unlockRemaining - (performance.now() - state.unlockStartedAt);
      const count = slot.querySelector('[data-network-countdown]');
      if (count) count.textContent = Math.max(0, Math.ceil(left / 1000));
      if (left <= 0) unlockNetwork(slot, state);
    }, 150);
  };

  const resolveProvider = (slot, providerReady) => {
    const state = networkState.get(slot);
    if (!state || state.providerResolved) return;
    state.providerResolved = true;
    state.providerReady = !!providerReady;
    clearTimeout(state.loadTimer); state.loadTimer = null;
    slot.classList.remove('network-loading');
    slot.classList.add(providerReady ? 'network-provider-ready' : 'network-provider-fallback');
    status(slot, providerReady ? 'Adsterra live' : 'Zaxira taklif', providerReady ? 'live' : 'fallback');
    const footnote = slot.querySelector('[data-network-footnote]');
    if (footnote) footnote.textContent = providerReady
      ? 'Haqiqiy creative hamkor tarmoqdan yuklandi'
      : 'Provider bloklangan yoki creative topilmadi — bo‘sh joy o‘rniga zaxira CTA';
    if (state.inView) startUnlock(slot, state);
  };

  const loadNetwork = slot => {
    const state = networkState.get(slot);
    if (!state || state.loaded) return;
    const frame = slot.querySelector('[data-network-frame]');
    if (!frame) return;
    state.loaded = true;
    slot.classList.add('network-loading');
    status(slot, 'Yuklanmoqda', 'loading');
    const base = innerWidth <= 640 ? frame.dataset.mobile : frame.dataset.desktop;
    const joiner = base.includes('?') ? '&' : '?';
    frame.src = `${base}${joiner}slot=${encodeURIComponent(slot.dataset.networkPlacement || 'feed')}&ts=${Date.now()}`;
    state.loadTimer = setTimeout(() => resolveProvider(slot, false), 7200);
  };

  addEventListener('message', event => {
    if (event.data?.type !== 'lumi-adsterra') return;
    const slot = networkSlots.find(item => item.querySelector('[data-network-frame]')?.contentWindow === event.source);
    if (!slot) return;
    if (event.data.state === 'ready') resolveProvider(slot, true);
    else if (event.data.state === 'empty' || event.data.state === 'error') resolveProvider(slot, false);
  });

  const setInView = (slot, inView) => {
    const state = networkState.get(slot);
    if (!state) return;
    state.inView = inView;
    if (inView) {
      loadNetwork(slot);
      if (state.providerResolved && !state.unlocked) startUnlock(slot, state);
      if (state.unlocked && !state.sleeping) startDisplay(slot, state);
    } else {
      pauseUnlock(slot, state);
      pauseDisplay(slot, state);
    }
  };

  if ('IntersectionObserver' in window && networkSlots.length) {
    const networkObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      setInView(entry.target, entry.isIntersecting && entry.intersectionRatio >= .35);
    }), { threshold: [0, .35, .6, 1] });
    networkSlots.forEach(slot => networkObserver.observe(slot));
  } else networkSlots.forEach(slot => setInView(slot, true));
});
