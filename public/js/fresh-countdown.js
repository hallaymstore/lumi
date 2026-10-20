// Fresh post remaining-time indicator, synced with the server's absolute expiry.
(function(){
  function update(){
    document.querySelectorAll('[data-post-expires]').forEach(function(el){
      const when=el.getAttribute('data-post-expires');if(when&&Date.parse(when)<=Date.now())el.remove();
    });
    document.querySelectorAll('[data-message-wrap][data-expires-at]').forEach(function(el){
      const value=el.getAttribute('data-expires-at');if(value&&Date.parse(value)<=Date.now())el.remove();
    });
    document.querySelectorAll('[data-fresh-until]').forEach(function(el){
      const deadline=Date.parse(el.getAttribute('data-fresh-until')||'');
      if(!Number.isFinite(deadline))return;
      const ms=deadline-Date.now();
      if(ms<=0){
        const card=el.closest('[data-post-id]');
        if(card){card.remove();return}
        const next=el.nextElementSibling;
        if(next&&next.matches('.post-card'))next.remove();
        el.remove();return
        el.textContent='Muddati tugadi';return;
      }
      const mins=Math.ceil(ms/60000);
      const h=Math.floor(mins/60),m=mins%60;
      el.textContent=h>0?'⏳ '+h+' soat '+m+' daqiqa qoldi':'⏳ '+m+' daqiqa qoldi';
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',update,{once:true});
  else update();
  setInterval(update,15000);
})();
