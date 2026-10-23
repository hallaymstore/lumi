/* Shared premium player with lazy media, speed, captions and PiP. */
document.addEventListener('DOMContentLoaded',()=>{
 const shells=[...document.querySelectorAll('[data-lumi-video]')];
 if(!shells.length)return;
 const saver=document.body.classList.contains('data-saver')||!!navigator.connection?.saveData;
 const reduced=!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const tm=x=>{const n=Math.max(0,Math.floor(Number.isFinite(x)?x:0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')};
 function load(s){const v=s.querySelector('video');if(v&&v.dataset.videoSrc&&!v.src){v.src=v.dataset.videoSrc;v.load()}}
 function sync(s){
  const v=s.querySelector('video');if(!v)return;
  s.classList.toggle('is-playing',!v.paused&&!v.ended);s.classList.toggle('is-unmuted',!v.muted);
  const seek=s.querySelector('[data-video-seek]');if(seek)seek.value=Number.isFinite(v.duration)&&v.duration>0?Math.round(1000*v.currentTime/v.duration):0;
  const time=s.querySelector('[data-video-time]');if(time)time.textContent=tm(v.currentTime)+' / '+tm(v.duration);
 }
 function stopOther(s){for(const x of shells){if(x!==s)x.querySelector('video')?.pause()}}
 shells.forEach(s=>{
  const v=s.querySelector('video');if(!v)return;
  v.muted=true;v.playsInline=true;
  s.querySelectorAll('[data-video-toggle]').forEach(b=>b.addEventListener('click',e=>{
   e.preventDefault();e.stopPropagation();load(s);v.paused?v.play().catch(()=>{}):v.pause();
  }));
  v.addEventListener('click',()=>{load(s);v.paused?v.play().catch(()=>{}):v.pause()});
  v.addEventListener('play',()=>{stopOther(s);sync(s)});
  ['pause','loadedmetadata','timeupdate','volumechange','ratechange'].forEach(ev=>v.addEventListener(ev,()=>sync(s)));
  s.querySelector('[data-video-seek]')?.addEventListener('input',e=>{if(Number.isFinite(v.duration)&&v.duration>0)v.currentTime=v.duration*Number(e.target.value)/1000});
  s.querySelector('[data-video-mute]')?.addEventListener('click',()=>{v.muted=!v.muted;sync(s)});
  s.querySelector('[data-video-speed]')?.addEventListener('click',()=>{v.playbackRate=v.playbackRate===1?1.5:v.playbackRate===1.5?2:1;const el=s.querySelector('[data-video-speed]');if(el)el.textContent=v.playbackRate+'×'});
  s.querySelector('[data-video-captions]')?.addEventListener('click',()=>{
   const tracks=v.textTracks;if(!tracks?.length)return;
   const enable=tracks[0].mode!=='showing';for(let i=0;i<tracks.length;i++)tracks[i].mode=enable?'showing':'disabled';
   s.classList.toggle('captions-on',enable);
  });
  s.querySelector('[data-video-pip]')?.addEventListener('click',async()=>{try{if(document.pictureInPictureElement)await document.exitPictureInPicture();else if(v.requestPictureInPicture)await v.requestPictureInPicture()}catch{}});
  s.querySelector('[data-video-fullscreen]')?.addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(s.requestFullscreen)await s.requestFullscreen();else v.webkitEnterFullscreen?.()}catch{}});
  sync(s);
 });
 if('IntersectionObserver'in window){
  const obs=new IntersectionObserver(entries=>{
   for(const e of entries){
    const s=e.target,v=s.querySelector('video'),front=s.closest('[data-carousel-track]')?.firstElementChild===s;
    if(!e.isIntersecting||e.intersectionRatio<.62){v.pause();continue}
    if(!saver){load(s);if(!reduced&&(front||!s.closest('[data-carousel-track]'))&&!document.hidden)v.play().catch(()=>{})}
   }
  },{threshold:[0,.62,.9]});shells.forEach(s=>obs.observe(s));
 }
 document.querySelectorAll('[data-carousel-prev],[data-carousel-next]').forEach(b=>b.addEventListener('click',()=>{b.closest('[data-carousel]')?.querySelectorAll('video').forEach(v=>v.pause())}));
 document.addEventListener('visibilitychange',()=>{if(document.hidden)shells.forEach(s=>s.querySelector('video')?.pause())});
});
