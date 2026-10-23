/* Lumi video controller: visible-only muted playback, controls, data-saver safety. */
document.addEventListener('DOMContentLoaded',function(){
  const players=Array.from(document.querySelectorAll('[data-lumi-video]'));
  if(!players.length)return;
  const reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saver=document.body.classList.contains('data-saver')||(navigator.connection&&navigator.connection.saveData);
  let active=null;
  function time(n){if(!Number.isFinite(n))return '0:00';n=Math.max(0,Math.floor(n));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');}
  function sync(shell){
    const video=shell.querySelector('video'),seek=shell.querySelector('[data-video-seek]'),out=shell.querySelector('[data-video-time]');
    shell.classList.toggle('is-playing',!video.paused&&!video.ended);
    shell.classList.toggle('is-unmuted',!video.muted);
    if(out)out.textContent=time(video.currentTime)+' / '+time(video.duration);
    if(seek)seek.value=Number.isFinite(video.duration)&&video.duration>0?Math.round(video.currentTime/video.duration*1000):0;
  }
  function pauseOther(current){players.forEach(p=>{if(p!==current){const v=p.querySelector('video');if(v&&!v.paused)v.pause();}});}
  players.forEach(shell=>{
    const v=shell.querySelector('video');
    if(!v)return;
    v.muted=true;v.playsInline=true;
    v.addEventListener('play',()=>{active=shell;pauseOther(shell);sync(shell)});
    v.addEventListener('pause',()=>sync(shell));
    v.addEventListener('timeupdate',()=>sync(shell));
    v.addEventListener('loadedmetadata',()=>sync(shell));
    v.addEventListener('volumechange',()=>sync(shell));
    v.addEventListener('error',()=>{const b=shell.querySelector('.lumi-video-bigplay');if(b)b.setAttribute('aria-label','Video ochilmadi')});
    shell.querySelectorAll('[data-video-toggle]').forEach(btn=>btn.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();if(v.paused)v.play().catch(()=>{});else v.pause()}));
    v.addEventListener('click',()=>{if(v.paused)v.play().catch(()=>{});else v.pause()});
    const seek=shell.querySelector('[data-video-seek]');
    if(seek)seek.addEventListener('input',()=>{if(Number.isFinite(v.duration)&&v.duration>0)v.currentTime=v.duration*Number(seek.value)/1000});
    shell.querySelector('[data-video-mute]')?.addEventListener('click',()=>{v.muted=!v.muted;sync(shell)});
    shell.querySelector('[data-video-fullscreen]')?.addEventListener('click',async()=>{
      if(document.fullscreenElement){await document.exitFullscreen?.().catch(()=>{})}
      else if(shell.requestFullscreen){await shell.requestFullscreen().catch(()=>{})}
      else if(v.webkitEnterFullscreen){v.webkitEnterFullscreen()}
    });
    sync(shell);
  });
  if('IntersectionObserver' in window){
    const obs=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        const shell=entry.target,v=shell.querySelector('video');
        if(!entry.isIntersecting||entry.intersectionRatio<.65){v.pause();return}
        if(!saver&&!reduced&&!document.hidden&&shell.closest('.post-carousel-track')?.firstElementChild===shell)v.play().catch(()=>{});
        else if(!saver&&!reduced&&!document.hidden&&!shell.closest('.post-carousel-track'))v.play().catch(()=>{});
      });
    },{threshold:[0,.3,.65,.9]});
    players.forEach(p=>obs.observe(p));
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)players.forEach(p=>p.querySelector('video')?.pause())});
  document.querySelectorAll('[data-carousel-prev],[data-carousel-next]').forEach(b=>b.addEventListener('click',()=>{b.closest('[data-carousel]')?.querySelectorAll('video').forEach(v=>v.pause())}));
});
