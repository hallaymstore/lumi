document.addEventListener('DOMContentLoaded',()=>{
  const auth=document.body.dataset.authenticated==='1';
  const sendEvent=(post,type,value=1)=>fetch('/api/feed/event',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({post,type,value}),keepalive:true}).catch(()=>{});
  // Multi media preview.
  const multi=document.querySelector('[data-multi-image-input]'),preview=document.querySelector('[data-preview].multi-preview');
  multi?.addEventListener('change',()=>{if(!preview)return;preview.innerHTML='';[...(multi.files||[])].slice(0,10).forEach((f,i)=>{const u=URL.createObjectURL(f),el=document.createElement(f.type.startsWith('video/')?'video':'img');el.src=u;el.className='multi-preview-item';if(el.tagName==='VIDEO'){el.muted=true;el.playsInline=true;el.controls=true}preview.appendChild(el)});const badge=document.createElement('b');badge.className='multi-preview-count';badge.textContent=`${Math.min(10,multi.files?.length||0)}/10`;preview.appendChild(badge)});
  // Carousel (re-bound for lazily loaded feed pages).
  const bindCarousel=root=>root.querySelectorAll('[data-carousel]').forEach(c=>{if(!window.Lumi.once(c,'Carousel'))return;const track=c.querySelector('[data-carousel-track]'),items=[...track?.children||[]],dots=[...c.querySelectorAll('.carousel-dots i')],count=c.querySelector('.carousel-count');let idx=0;if(items.length<2)return;const go=n=>{idx=(n+items.length)%items.length;track.style.transform=`translateX(-${idx*100}%)`;dots.forEach((d,i)=>d.classList.toggle('active',i===idx));if(count)count.textContent=`${idx+1}/${items.length}`};c.querySelector('[data-carousel-prev]')?.addEventListener('click',e=>{e.preventDefault();go(idx-1)});c.querySelector('[data-carousel-next]')?.addEventListener('click',e=>{e.preventDefault();go(idx+1)});let sx=0;c.addEventListener('touchstart',e=>sx=e.touches[0].clientX,{passive:true});c.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-sx;if(Math.abs(dx)>45)go(idx+(dx<0?1:-1))},{passive:true})});
  window.Lumi.onMount(bindCarousel);
  // Dwell time + impressions. This is the main personalized feed signal.
  const active=new Map();
  const flushDwell=id=>{if(!active.has(id))return;const sec=Math.round((performance.now()-active.get(id))/1000);active.delete(id);if(sec>=2)sendEvent(id,'dwell',Math.min(sec,120))};
  const dwellObs='IntersectionObserver'in window?new IntersectionObserver(entries=>entries.forEach(e=>{const id=e.target.dataset.postId;if(!id)return;if(e.isIntersecting&&e.intersectionRatio>=.55){if(!active.has(id)){active.set(id,performance.now());sendEvent(id,'impression')}}else flushDwell(id)}),{threshold:[0,.55]}):null;
  if(dwellObs){
    window.Lumi.onMount(root=>root.querySelectorAll('[data-view-track][data-post-id]').forEach(el=>{if(window.Lumi.once(el,'Dwell'))dwellObs.observe(el)}));
    const flushAll=()=>{for(const id of [...active.keys()])flushDwell(id)};
    window.addEventListener('pagehide',flushAll);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)flushAll()});
  }
  document.addEventListener('click',e=>{const c=e.target.closest('[data-comments-open]');if(c)sendEvent(c.dataset.commentsOpen,'open_comments')});
  // "Qiziq emas" / "creatorni kamaytirish": delegated, because the post menu is portaled to <body>
  // (card lookup by post id, never by DOM ancestry).
  const dropCard=id=>{document.querySelectorAll(`[data-post-id="${CSS.escape(String(id))}"]`).forEach(c=>{c.classList.add('is-leaving');setTimeout(()=>c.remove(),220)})};
  document.addEventListener('click',async e=>{
    const ni=e.target.closest('[data-not-interested]');
    if(ni){const id=ni.dataset.notInterested;dropCard(id);fetch(`/posts/${id}/not-interested`,{method:'POST',headers:{Accept:'application/json'}}).catch(()=>{});return}
    const ha=e.target.closest('[data-hide-author]');
    if(ha){
      if(!confirm('Bu creatordan postlarni tavsiyalarda ancha kamaytiraymi?'))return;
      const id=ha.dataset.hideAuthor,card=document.querySelector(`[data-post-id="${CSS.escape(String(id))}"]`),authorId=card?.dataset.postAuthor;
      const r=await fetch(`/posts/${id}/hide-author`,{method:'POST',headers:{Accept:'application/json'}}).catch(()=>null);
      if(r?.ok){if(authorId)document.querySelectorAll(`[data-post-author="${CSS.escape(String(authorId))}"]`).forEach(c=>{c.classList.add('is-leaving');setTimeout(()=>c.remove(),220)});else dropCard(id)}
    }
  });
  document.querySelectorAll('[data-user-relation]').forEach(b=>b.addEventListener('click',async()=>{const type=b.dataset.userRelation,user=b.dataset.username;if(!confirm(`${type} amalini @${user} ga qo‘llaysizmi?`))return;const d=await fetch(`/u/${encodeURIComponent(user)}/relation`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:new URLSearchParams({type})}).then(r=>r.json());if(d.ok&&type==='block'&&d.enabled)location.href='/feed';else if(d.ok&&!d.enabled&&location.pathname==='/settings')location.reload()}));
  document.querySelectorAll('[data-user-report]').forEach(b=>b.addEventListener('click',async()=>{const reason=prompt('Report sababi: spam, harassment, scam, impersonation, hate yoki other','other')||'other';const d=await fetch(`/u/${encodeURIComponent(b.dataset.userReport)}/report`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:new URLSearchParams({reason})}).then(r=>r.json()).catch(()=>null);if(d?.ok){b.textContent='Reported ✓';b.disabled=true}}));
  document.querySelectorAll('[data-highlight-story]').forEach(b=>b.addEventListener('click',async()=>{const d=await fetch(`/stories/${b.dataset.highlightStory}/highlight`,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({title:'Highlight'})}).then(r=>r.json());if(d.ok){b.classList.toggle('primary',d.isHighlight);b.classList.toggle('ghost',!d.isHighlight);b.innerHTML=`<i data-lucide="star"></i> ${d.isHighlight?'Highlightda':'Highlightga qo‘shish'}`;window.lucide?.createIcons()}}));
  // Creator analytics/profile visits are tracked server-side when possible.
});
