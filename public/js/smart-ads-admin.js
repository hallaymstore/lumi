(() => {
  document.addEventListener('DOMContentLoaded', async () => {
    if (location.pathname !== '/admin/ads') return;
    const form = document.querySelector('.ad-settings-form');
    if (!form || form.querySelector('[data-smart-delivery-fields]')) return;

    let cfg = {};
    try {
      const r = await fetch('/admin/api/ad-smart-config', { headers: { Accept: 'application/json' } });
      if (r.ok) cfg = await r.json();
    } catch (_) {}

    const block = document.createElement('div');
    block.dataset.smartDeliveryFields = '1';
    block.style.display = 'grid';
    block.style.gap = '8px';
    block.innerHTML = `
      <label class="check-row">
        <input type="checkbox" name="smartDelivery" ${cfg.smartDelivery !== false ? 'checked' : ''}>
        <span><b>Smart Ad Delivery</b><small>Reklamalar qat’iy har 3 postda emas, tabiiy oralig‘da chiqadi</small></span>
      </label>
      <label>Birinchi reklama: eng erta post
        <input type="number" name="firstAdMin" min="3" max="12" value="${Number(cfg.firstAdMin || 5)}">
      </label>
      <label>Birinchi reklama: eng kech post
        <input type="number" name="firstAdMax" min="3" max="14" value="${Number(cfg.firstAdMax || 6)}">
      </label>
      <label>Keyingi reklamalar oralig‘i — minimum post
        <input type="number" name="gapMin" min="3" max="15" value="${Number(cfg.gapMin || 4)}">
      </label>
      <label>Keyingi reklamalar oralig‘i — maksimum post
        <input type="number" name="gapMax" min="3" max="20" value="${Number(cfg.gapMax || 7)}">
      </label>
      <small style="display:block;padding:7px 2px;color:var(--muted);font-size:7px;line-height:1.5">
        Tavsiya: birinchi reklama 5–6-postdan keyin, keyingilari 4–7 post oralig‘ida. Qiziqish matching va frequency-cap kampaniya darajasida avtomatik ishlaydi.
      </small>
    `;

    block.querySelectorAll('label:not(.check-row)').forEach(label => {
      label.style.display = 'grid';
      label.style.gap = '5px';
      label.style.fontSize = '7px';
      label.style.fontWeight = '850';
      label.style.color = 'var(--muted)';
    });

    const firstLegacy = [...form.querySelectorAll('label')].find(x => x.textContent.includes('Har nechta postdan'));
    if (firstLegacy) firstLegacy.before(block);
    else form.prepend(block);
  });
})();
