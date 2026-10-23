(() => {
 document.addEventListener('DOMContentLoaded',()=>{
  const list=document.querySelector('[data-clip-scroll]');
  if(!list)return;
  const cards=[...list.querySelectorAll('[data-clip]')];
  if(!cards.length)return;
  const saver=document.body.classList.contains('data-saver')||!!navigator.connection?.saveData;
  const reduced=!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let current=null,muted=true;
  let sheetDepth=0,resumeAfterSheet=false;
  const displayTime=t=>{const v=Math.max(0,Math.floor(Number.isFinite(t)?t:0));return Math.floor(v/60)+':'+String(v%60).padStart(2,'0')};
  function load(c){const v=c.querySelector('video');if(!v.src&&v.dataset.source){v.src=v.dataset.source;v.load()}}
  function captions(c,on){const v=c.querySelector('video');const tracks=v.textTracks;if(!tracks?.length)return;for(let i=0;i<tracks.length;i++)tracks[i].mode=on?'showing':'disabled';c.classList.toggle('captions-on',on)}
  function update(c){
   const v=c.querySelector('video'),seek=c.querySelector('[data-clip-seek]'),label=c.querySelector('[data-clip-time]');
   c.classList.toggle('is-playing',!v.paused&&!v.ended);
   if(label)label.textContent=displayTime(v.currentTime)+' / '+displayTime(v.duration);
   if(seek)seek.value=Number.isFinite(v.duration)&&v.duration>0?Math.round(v.currentTime/v.duration*1000):0;
   const mute=c.querySelector('[data-clip-mute]');if(mute){mute.title=v.muted?'Ovozni yoqish':'Ovozni o‘chirish';const key=v.muted?'volume-x':'volume-2';if(mute.dataset.lumiIcon!==key){mute.dataset.lumiIcon=key;mute.innerHTML='<i data-lucide="'+key+'"></i>';window.lucide?.createIcons()}}
  }
  async function activate(c,force=false){
   if(current&&current!==c)current.querySelector('video').pause();
   current=c;cards.forEach(x=>x.classList.toggle('is-current',x===c));
   const idx=cards.indexOf(c);[cards[idx-1],cards[idx+1]].filter(Boolean).forEach(n=>{if(!saver)load(n)});
   if(!saver||force)load(c);
   const v=c.querySelector('video');v.muted=muted;
   if(sheetDepth===0&&(!saver&&!reduced||force))await v.play().catch(()=>{});
   update(c);
  }
  cards.forEach(c=>{
   const video=c.querySelector('video'),seek=c.querySelector('[data-clip-seek]');
   c.querySelectorAll('[data-clip-toggle]').forEach(btn=>btn.addEventListener('click',async e=>{e.stopPropagation();load(c);if(current!==c)await activate(c,true);else if(video.paused)await video.play().catch(()=>{});else video.pause();update(c)}));
   video.addEventListener('click',()=>{if(sheetDepth)return;load(c);if(video.paused)video.play().catch(()=>{});else video.pause();});
   for(const event of ['timeupdate','loadedmetadata','play','pause','ratechange'])video.addEventListener(event,()=>update(c));
   video.addEventListener('waiting',()=>{c.querySelector('[data-clip-buffer]').hidden=false});
   video.addEventListener('playing',()=>{c.querySelector('[data-clip-buffer]').hidden=true});
   video.addEventListener('error',()=>{c.querySelector('[data-clip-buffer]').hidden=true});
   seek?.addEventListener('input',()=>{if(Number.isFinite(video.duration)&&video.duration>0)video.currentTime=video.duration*Number(seek.value)/1000});
   c.querySelector('[data-clip-mute]')?.addEventListener('click',()=>{
     muted=!muted;cards.forEach(x=>{x.querySelector('video').muted=muted;update(x)});
   });
   c.querySelector('[data-clip-cc]')?.addEventListener('click',()=>captions(c,!c.classList.contains('captions-on')));
   c.querySelector('[data-clip-speed]')?.addEventListener('click',()=>{video.playbackRate=video.playbackRate===1?1.5:video.playbackRate===1.5?2:1;c.querySelector('[data-speed-value]').textContent=video.playbackRate+'×'});
   c.querySelector('[data-clip-fullscreen]')?.addEventListener('click',()=>{if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});else c.querySelector('[data-clip-stage]').requestFullscreen?.().catch(()=>{})});
   c.querySelector('[data-clip-pip]')?.addEventListener('click',async()=>{try{if(document.pictureInPictureElement)await document.exitPictureInPicture();else if(document.pictureInPictureEnabled&&video.requestPictureInPicture)await video.requestPictureInPicture()}catch{}});
   c.querySelector('[data-clip-share]')?.addEventListener('click',async()=>{
    const url=location.origin+'/p/'+c.dataset.postId;
    if(navigator.share)try{await navigator.share({url,title:'Lumi Clips'});return}catch{}
    if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(url).then(()=>alert('Clip havolasi nusxalandi.')).catch(()=>{location.href=url});else location.href=url;
   });
  });
  const observer=new IntersectionObserver(entries=>{
   const visible=entries.filter(e=>e.isIntersecting&&e.intersectionRatio>=.58).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
   if(visible&&current!==visible.target)activate(visible.target);
   for(const e of entries){if(!e.isIntersecting&&e.target!==current)e.target.querySelector('video').pause()}
  },{root:list,threshold:[0,.58,.85]});
  cards.forEach(c=>observer.observe(c));
  document.addEventListener('lumi:sheet-open',()=>{
    if(sheetDepth===0){resumeAfterSheet=!!current&&!current.querySelector('video').paused;current?.querySelector('video')?.pause()}
    sheetDepth++;
  });
  document.addEventListener('lumi:sheet-close',()=>{
    sheetDepth=Math.max(0,sheetDepth-1);
    if(sheetDepth===0&&resumeAfterSheet&&current&&!document.hidden){current.querySelector('video').play().catch(()=>{})}
    if(sheetDepth===0)resumeAfterSheet=false;
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cards.forEach(c=>c.querySelector('video').pause());else if(current&&!saver&&!reduced&&!sheetDepth)current.querySelector('video').play().catch(()=>{})});
  function change(delta){const i=Math.max(0,cards.indexOf(current));cards[Math.max(0,Math.min(cards.length-1,i+delta))]?.scrollIntoView({block:'start',behavior:reduced?'instant':'smooth'})}
  document.addEventListener('keydown',e=>{
   if(!document.querySelector('[data-clips-feed]')||sheetDepth||document.querySelector('.sheet-backdrop.open')||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||e.metaKey||e.ctrlKey)return;
   const v=current?.querySelector('video');if(!v)return;
   if(['ArrowDown','ArrowUp',' ','m','M','c','C','f','F'].includes(e.key))e.preventDefault();
   if(e.key==='ArrowDown')change(1);else if(e.key==='ArrowUp')change(-1);
   else if(e.key===' '){load(current);v.paused?v.play().catch(()=>{}):v.pause()}
   else if(e.key.toLowerCase()==='m')current.querySelector('[data-clip-mute]')?.click();
   else if(e.key.toLowerCase()==='c')current.querySelector('[data-clip-cc]')?.click();
   else if(e.key.toLowerCase()==='f')current.querySelector('[data-clip-fullscreen]')?.click();
  });
  activate(cards[0]);
 });
})();
