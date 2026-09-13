document.addEventListener('DOMContentLoaded',()=>{
  const lower=document.querySelector('.settings-grid.lower-settings');
  if(!lower||document.querySelector('[data-account-control-card]'))return;
  const card=document.createElement('section');
  card.className='card settings-card';
  card.dataset.accountControlCard='1';
  card.innerHTML='<div class="settings-card-title"><span><i data-lucide="shield-check"></i></span><div><h2>Ma’lumot va akkaunt</h2><p>Privacy, qoidalar va akkaunt boshqaruvi</p></div></div><a class="btn ghost full" href="/privacy"><i data-lucide="lock-keyhole"></i> Privacy Policy</a><a class="btn ghost full" href="/terms"><i data-lucide="file-check-2"></i> Foydalanish shartlari</a><a class="btn danger full" href="/account-deletion"><i data-lucide="user-round-x"></i> Akkaunt va ma’lumotlarni o‘chirish</a>';
  lower.prepend(card);
  if(window.lucide)window.lucide.createIcons();
});
