/* Lumi Clips v1.15: visible-only muted autoplay + interest-aware endless feed. */
(() => {
 document.addEventListener('DOMContentLoaded',()=>{
  const list=document.querySelector('[data-clip-scroll]');
  if(!list)return;
  const end=document.querySelector('[data-clips-end]');
  const saver=document.body.classList.contains('data-saver')||!!navigator.connection?.saveData;
  const reduced=!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const loggedIn=document.body.dataset.authenticated==='1';
  let cards=[...list.querySelectorAll('[data-clip]')],active=null,muted=true,overlay=0,resume=false,loading=false,hasMore=true;
  const fmt=x=>{const n=Math.max(0,Math.floor(Number.isFinite(x)?x:0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')};
  const vid=c=>c.querySelector('video');
  function load(c){
   if(!c)return;
   const v=vid(c);
   if(!v.src&&v.dataset.source){v.src=v.dataset.source;v.load()}
  }
  function update(c){
   const v=vid(c),seek=c.querySelector('[data-clip-seek]'),label=c.querySelector('[data-clip-time]');
   c.classList.toggle('is-playing',!v.paused&&!v.ended);
   c.classList.toggle('is-muted',v.muted);
   if(label)label.textContent=fmt(v.currentTime)+' / '+fmt(v.duration);
   if(seek)seek.value=Number.isFinite(v.duration)&&v.duration>0?Math.round(v.currentTime/v.duration*1000):0;
   const m=c.querySelector('[data-clip-mute]');if(m){const key=v.muted?'volume-x':'volume-2';m.title=v.muted?'Ovozni yoqish':'Ovozni o‘chirish';if(m.dataset.icon!==key){m.dataset.icon=key;m.innerHTML='<i data-lucide="'+key+'"></i>';window.lucide?.createIcons()}}
  }
  function trackView(c){
   if(c._viewRecorded)return;c._viewRecorded=true;
   fetch('/api/posts/'+encodeURIComponent(c.dataset.postId)+'/view',{method:'POST',headers:{Accept:'application/json'},credentials:'same-origin',keepalive:true}).catch(()=>{});
  }
  function markPlay(c){
   const v=vid(c);
   if(!v.paused&&!c._playSince)c._playSince=performance.now();
   c._played=true;
  }
  function markPause(c){
   if(c?._playSince){c._watchSeconds=(c._watchSeconds||0)+Math.max(0,(performance.now()-c._playSince)/1000);c._playSince=0}
  }
  function flush(c){
   if(!c||c._sent||!loggedIn||!c._played)return;
   markPause(c);
   const v=vid(c),seconds=Math.min(30,c._watchSeconds||0);
   const ratio=Number.isFinite(v.duration)&&v.duration>0?Math.min(1,Math.max(0,c._furthest||0)):0;
   const data=new URLSearchParams({postId:c.dataset.postId,seconds:seconds.toFixed(2),ratio:ratio.toFixed(3)});
   c._sent=true;
   if(navigator.sendBeacon){if(navigator.sendBeacon('/api/clips/watch',data))return}
   fetch('/api/clips/watch',{method:'POST',body:data,credentials:'same-origin',keepalive:true}).catch(()=>{});
  }
  async function play(c,manual=false){
   if(!c||document.hidden||overlay)return;
   if((saver||reduced)&&!manual)return;
   if(c._manualPause&&!manual)return;
   load(c);const v=vid(c);v.muted=muted;
   c.classList.add('is-loading');
   try{await v.play();c._manualPause=false;c.classList.remove('needs-tap');trackView(c)}
   catch(e){if(active===c&&!document.hidden)c.classList.add('needs-tap')}
   finally{c.classList.remove('is-loading');update(c)}
  }
  function activate(c){
   if(!c||active===c)return;
   if(active){flush(active);const previous=vid(active);previous.pause();active.classList.remove('is-current')}
   active=c;c.classList.add('is-current');c._manualPause=false;
   play(c);
   const idx=cards.indexOf(c);
   if(!saver&&idx>=0&&cards[idx+1])load(cards[idx+1]);
   if(idx>=cards.length-3&&hasMore)loadMore();
  }
  function captions(c,on){
   const v=vid(c),tracks=v.textTracks;if(!tracks?.length)return;
   for(let i=0;i<tracks.length;i++)tracks[i].mode=on?'showing':'disabled';
   c.classList.toggle('captions-on',on);
  }
  function mount(c){
   if(c.dataset.ready==='1')return;c.dataset.ready='1';
   const v=vid(c);if(!v)return;
   v.autoplay=true;v.defaultMuted=true;v.muted=muted;v.playsInline=true;
   for(const ev of ['timeupdate','loadedmetadata','play','pause','ratechange'])v.addEventListener(ev,()=>{
    if(ev==='play')markPlay(c);
    if(ev==='pause')markPause(c);
    if(ev==='timeupdate'&&Number.isFinite(v.duration)&&v.duration>0)c._furthest=Math.max(c._furthest||0,v.currentTime/v.duration);
    update(c);
   });
   v.addEventListener('canplay',()=>{if(active===c&&v.paused&&!c._manualPause)play(c)});
   v.addEventListener('loadeddata',()=>{if(active===c&&v.paused&&!c._manualPause&&!overlay)play(c)});
   v.addEventListener('waiting',()=>c.classList.add('is-buffering'));
   v.addEventListener('playing',()=>c.classList.remove('is-buffering','needs-tap'));
   v.addEventListener('error',()=>{c.classList.remove('is-loading','is-buffering');c.classList.add('needs-tap')});
   const toggle=async e=>{e.preventDefault();e.stopPropagation();if(active!==c)activate(c);if(v.paused){c._manualPause=false;await play(c,true)}else{c._manualPause=true;v.pause()}};
   c.querySelectorAll('[data-clip-toggle]').forEach(b=>b.addEventListener('click',toggle));
   v.addEventListener('click',toggle);
   c.querySelector('[data-clip-seek]')?.addEventListener('input',e=>{load(c);if(Number.isFinite(v.duration)&&v.duration>0)v.currentTime=v.duration*Number(e.target.value)/1000});
   c.querySelector('[data-clip-mute]')?.addEventListener('click',()=>{muted=!muted;cards.forEach(x=>{vid(x).muted=muted;update(x)})});
   c.querySelector('[data-clip-cc]')?.addEventListener('click',()=>captions(c,!c.classList.contains('captions-on')));
   c.querySelector('[data-clip-settings]')?.addEventListener('click',e=>{const open=!c.classList.contains('show-advanced');c.classList.toggle('show-advanced',open);e.currentTarget.setAttribute('aria-expanded',String(open))});
   c.querySelector('[data-clip-speed]')?.addEventListener('click',()=>{v.playbackRate=v.playbackRate===1?1.5:v.playbackRate===1.5?2:1;c.querySelector('[data-speed-value]').textContent=v.playbackRate+'×'});
   c.querySelector('[data-clip-fullscreen]')?.addEventListener('click',()=>{if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});else c.querySelector('[data-clip-stage]').requestFullscreen?.().catch(()=>{})});
   c.querySelector('[data-clip-pip]')?.addEventListener('click',async()=>{try{if(document.pictureInPictureElement)await document.exitPictureInPicture();else if(document.pictureInPictureEnabled&&v.requestPictureInPicture)await v.requestPictureInPicture()}catch{}});
   update(c);
  }
  async function loadMore(){
   if(loading||!hasMore)return;
   loading=true;
   try{
    const ids=cards.slice(-90).map(c=>c.dataset.postId).join(',');
    const res=await fetch('/api/clips/next?seen='+encodeURIComponent(ids),{headers:{Accept:'application/json'},credentials:'same-origin'});
    if(!res.ok)throw Error('Videolarni olishda xatolik');
    const data=await res.json();if(!data.ok)throw Error('Videolar yuklanmadi');
    const template=document.createElement('template');template.innerHTML=data.html||'';
    const fresh=[...template.content.querySelectorAll('[data-clip]')].filter(c=>!cards.some(x=>x.dataset.postId===c.dataset.postId));
    if(fresh.length){
     list.appendChild(template.content);cards=[...list.querySelectorAll('[data-clip]')];
     fresh.forEach(c=>{mount(c);io?.observe(c)});
     window.lucide?.createIcons();
    }
    hasMore=!!data.hasMore&&fresh.length>0;
    if(!hasMore&&end)end.hidden=false;
   }catch(e){console.warn('Clips recommendation:',e.message)}
   finally{loading=false}
  }
  let io=null;
  if('IntersectionObserver' in window){
   io=new IntersectionObserver(entries=>{
    const shown=entries.filter(e=>e.isIntersecting&&e.intersectionRatio>=.58).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
    if(shown)activate(shown.target);
    for(const e of entries){if(!e.isIntersecting&&e.target!==active)vid(e.target).pause()}
   },{root:list,threshold:[0,.58,.85]});
  }
  cards.forEach(c=>{mount(c);io?.observe(c)});
  if(cards.length)activate(cards[0]);
  document.addEventListener('lumi:sheet-open',()=>{
   if(overlay===0){resume=!!active&&!vid(active).paused;active&&vid(active).pause()}overlay++;
  });
  document.addEventListener('lumi:sheet-close',()=>{
   overlay=Math.max(0,overlay-1);if(!overlay&&resume&&active&&!document.hidden)play(active);if(!overlay)resume=false;
  });
  document.addEventListener('visibilitychange',()=>{
   if(document.hidden){active&&vid(active).pause()}else if(active&&!overlay&&!active._manualPause)play(active)
  });
  // A swipe/touch can unlock playback in Android WebViews that delay muted autoplay.
  let swipeOrigin=null;
  list.addEventListener('touchstart',e=>{swipeOrigin=e.touches?.[0]?.clientY??null},{passive:true});
  list.addEventListener('touchmove',e=>{const y=e.touches?.[0]?.clientY;if(swipeOrigin!==null&&Number.isFinite(y)&&Math.abs(y-swipeOrigin)>16){swipeOrigin=null;if(active&&!saver&&!reduced&&!overlay&&!active._manualPause&&vid(active).paused)play(active,true)}},{passive:true});
  list.addEventListener('pointerdown',e=>{if(e.target.closest('button,input,a,video'))return;if(active&&!saver&&!reduced&&!overlay&&!active._manualPause&&vid(active).paused)play(active,true)},{passive:true});
  window.addEventListener('pagehide',()=>flush(active));
  end?.querySelector('[data-clips-refresh]')?.addEventListener('click',()=>location.reload());
  function shift(delta){
   const idx=Math.max(0,cards.indexOf(active)),next=cards[Math.min(cards.length-1,Math.max(0,idx+delta))];
   next?.scrollIntoView({block:'start',behavior:reduced?'instant':'smooth'});
  }
  document.addEventListener('keydown',e=>{
   if(!active||overlay||document.querySelector('.sheet-backdrop.open')||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||e.ctrlKey||e.metaKey)return;
   if(['ArrowDown','ArrowUp',' ','m','M','c','C'].includes(e.key))e.preventDefault();
   if(e.key==='ArrowDown')shift(1);else if(e.key==='ArrowUp')shift(-1);
   else if(e.key===' ')active.querySelector('[data-clip-toggle]')?.click();
   else if(e.key.toLowerCase()==='m')active.querySelector('[data-clip-mute]')?.click();
   else if(e.key.toLowerCase()==='c')active.querySelector('[data-clip-cc]')?.click();
  });
  // On browsers without IntersectionObserver, scroll snap still works.
  if(!io)list.addEventListener('scroll',()=>{
   const idx=Math.max(0,Math.min(cards.length-1,Math.round(list.scrollTop/Math.max(1,list.clientHeight))));
   activate(cards[idx]);
  },{passive:true});
 });
})();
