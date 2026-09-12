(() => {
  const KEY = 'lumi_ad_frequency_v1';
  const now = () => Date.now();

  function loadStore() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || '{}');
      return data && typeof data === 'object' ? data : {};
    } catch (_) { return {}; }
  }

  function saveStore(store) {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (_) {}
  }

  function cleanup(store) {
    const cutoff = now() - 14 * 864e5;
    for (const [key, value] of Object.entries(store)) {
      if (!value || typeof value !== 'object') { delete store[key]; continue; }
      value.impressions = (value.impressions || []).filter(ts => Number(ts) >= cutoff);
      if (Number(value.dismissUntil || 0) < now() && !value.impressions.length) delete store[key];
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const store = loadStore();
    cleanup(store);
    saveStore(store);

    const markImpression = id => {
      const row = store[id] || { impressions: [], dismissUntil: 0 };
      row.impressions = (row.impressions || []).filter(ts => Number(ts) >= now() - 14 * 864e5);
      row.impressions.push(now());
      store[id] = row;
      saveStore(store);
    };

    const cards = [...document.querySelectorAll('[data-ad-card]')];
    const allowed = [];

    for (const card of cards) {
      const id = String(card.dataset.adId || '');
      if (!id) continue;
      const row = store[id] || { impressions: [], dismissUntil: 0 };
      const dailyCap = Math.max(1, Number(card.dataset.adDailyCap) || 3);
      const cooldownMs = Math.max(0, Number(card.dataset.adCooldownHours) || 0) * 36e5;
      const dayCount = (row.impressions || []).filter(ts => Number(ts) >= now() - 864e5).length;
      const last = Math.max(0, ...(row.impressions || []).map(Number));

      if (Number(row.dismissUntil || 0) > now() || dayCount >= dailyCap || (cooldownMs && last && now() - last < cooldownMs)) {
        card.remove();
        continue;
      }

      card.querySelector('[data-ad-dismiss]')?.addEventListener('click', () => {
        const current = store[id] || { impressions: [], dismissUntil: 0 };
        const hours = Math.max(1, Number(card.dataset.adDismissHours) || 72);
        current.dismissUntil = now() + hours * 36e5;
        store[id] = current;
        saveStore(store);
      }, { capture: true });

      allowed.push(card);
    }

    const seen = new WeakSet();
    const timers = new WeakMap();
    const visible = card => {
      if (seen.has(card) || timers.has(card)) return;
      const timer = setTimeout(() => {
        timers.delete(card);
        if (!card.isConnected || seen.has(card)) return;
        seen.add(card);
        markImpression(String(card.dataset.adId || ''));
      }, 900);
      timers.set(card, timer);
    };
    const hidden = card => {
      const timer = timers.get(card);
      if (timer) clearTimeout(timer);
      timers.delete(card);
    };

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= .55) visible(entry.target);
        else hidden(entry.target);
      }), { threshold: [0, .55, 1] });
      allowed.forEach(card => io.observe(card));
    } else allowed.forEach(visible);

    // Network ads have no stable campaign id. Apply a gentle global fatigue cap:
    // no more than 4 network placements in a rolling 30-minute browser window.
    const networkKey = '__network__';
    const network = store[networkKey] || { impressions: [] };
    network.impressions = (network.impressions || []).filter(ts => Number(ts) >= now() - 30 * 60 * 1000);
    store[networkKey] = network;

    const networkSlots = [...document.querySelectorAll('[data-network-ad]')];
    if (network.impressions.length >= 4) {
      networkSlots.forEach(slot => slot.remove());
      saveStore(store);
      return;
    }

    let networkRecorded = 0;
    const networkSeen = new WeakSet();
    if ('IntersectionObserver' in window && networkSlots.length) {
      const nio = new IntersectionObserver(entries => entries.forEach(entry => {
        if (!entry.isIntersecting || entry.intersectionRatio < .35 || networkSeen.has(entry.target)) return;
        if (network.impressions.length + networkRecorded >= 4) {
          entry.target.remove();
          return;
        }
        networkSeen.add(entry.target);
        networkRecorded += 1;
        network.impressions.push(now());
        store[networkKey] = network;
        saveStore(store);
      }), { threshold: [0, .35, .7] });
      networkSlots.forEach(slot => nio.observe(slot));
    }
  });
})();
