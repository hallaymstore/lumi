/* Lumi native feed inline autoplay (v2.1): never route to Clips on play.
   Single active video, muted in-view playback, tap to pause, explicit fullscreen only.
   Android WebView has mediaPlaybackRequiresUserGesture=false in MainActivity.
*/
(() => {
  const state = window.__lumiInlineVideo = { mute: true, shells: new Set(), visible: new Map(), active: null };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saver = !!(navigator.connection && navigator.connection.saveData) || document.body.classList.contains('data-saver');
  const time = value => { const n=Math.max(0,Math.floor(Number.isFinite(value)?value:0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0'); };
  function attach(shell) {
    const v=shell.querySelector('video');if(!v)return null;
    v.muted = state.mute;v.defaultMuted=true;v.setAttribute('muted','');v.playsInline=true;v.setAttribute('playsinline','');v.setAttribute('webkit-playsinline','');
    if(v.dataset.videoSrc&&!v.src){v.preload='metadata';v.src=v.dataset.videoSrc;v.load();}
    return v;
  }
  function sync(s){
    const v=s.querySelector('video');if(!v)return;
    s.classList.toggle('is-playing',!v.paused&&!v.ended);
    s.classList.toggle('is-unmuted',!v.muted);
    const seek=s.querySelector('[data-video-seek]');if(seek)seek.value=v.duration>0?Math.round(v.currentTime/v.duration*1000):0;
    const stamp=s.querySelector('[data-video-time]');if(stamp)stamp.textContent=time(v.currentTime)+' / '+time(v.duration);
    s.style.setProperty('--video-progress',v.duration>0?String(v.currentTime/v.duration):'0');
  }
  function pauseOthers(target){
    state.shells.forEach(s=>{if(s!==target)s.querySelector('video')?.pause();});
  }
  function play(shell,manual=false){
    const v=attach(shell);if(!v)return;
    if(document.hidden)return;
    if(!manual&&(saver||reduced))return;
    pauseOthers(shell);
    state.active=shell;
    if(!manual)v.muted=true;
    const attempt=v.play();
    if(attempt?.catch)attempt.catch(()=>{sync(shell);});
  }
  function toggle(shell) {
    const v=attach(shell);if(!v)return;
    if(v.paused)play(shell,true);else v.pause();
  }
  function eligible(shell){
    const track=shell.closest('[data-carousel-track]');if(!track)return true;
    const children=[...track.children],index=children.indexOf(shell);
    const carousel=shell.closest('[data-carousel]');
    const current=carousel?.querySelector('.carousel-dots .active');
    const dots=[...(carousel?.querySelectorAll('.carousel-dots i')||[])];
    return index===0&&!dots.length || (current&&dots.indexOf(current)===index);
  }
  function pick(){
    if(document.hidden){pauseOthers(null);return;}
    let best=null,ratio=.55;
    for(const [s,r] of state.visible){
      if(!s.isConnected){state.visible.delete(s);state.shells.delete(s);continue;}
      if(r>ratio && eligible(s)){best=s;ratio=r;}
    }
    if(!best){state.active?.querySelector('video')?.pause();state.active=null;return;}
    if(state.active!==best||best.querySelector('video')?.paused)play(best);
  }
  const observer='IntersectionObserver' in window?new IntersectionObserver(entries=>{
    for(const e of entries){
      if(e.isIntersecting) {state.visible.set(e.target,e.intersectionRatio);if(e.intersectionRatio>.12)attach(e.target);}
      else{state.visible.delete(e.target);e.target.querySelector('video')?.pause();}
    }
    pick();
  },{threshold:[0,.12,.3,.55,.7,.9]}):null;
  const warm='IntersectionObserver' in window?new IntersectionObserver(entries=>{
    for(const e of entries)if(e.isIntersecting){attach(e.target);warm.unobserve(e.target);}
  },{rootMargin:'70% 0px',threshold:0}):null;
  window.Lumi.onMount(root=>{
    root.querySelectorAll('[data-lumi-video]').forEach(s=>{
      if(!window.Lumi.once(s,'Video'))return;
      const v=s.querySelector('video');if(!v)return;
      v.muted=true;v.playsInline=true;
      state.shells.add(s);
      s.querySelectorAll('[data-video-toggle]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();toggle(s);}));
      v.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();toggle(s);});
      v.addEventListener('play',()=>{pauseOthers(s);state.active=s;sync(s);});
      v.addEventListener('pause',()=>sync(s));
      v.addEventListener('waiting',()=>s.classList.add('is-buffering'));
      v.addEventListener('playing',()=>{s.classList.remove('is-buffering');sync(s);});
      v.addEventListener('error',()=>s.classList.remove('is-buffering'));
      ['timeupdate','durationchange','loadedmetadata','volumechange'].forEach(ev=>v.addEventListener(ev,()=>sync(s)));
      s.querySelector('[data-video-seek]')?.addEventListener('input',e=>{const video=attach(s);if(video&&video.duration>0)video.currentTime=video.duration*Number(e.target.value)/1000;});
      s.querySelector('[data-video-mute]')?.addEventListener('click',e=>{e.stopPropagation();v.muted=!v.muted;state.mute=v.muted;sync(s);});
      s.querySelector('[data-video-speed]')?.addEventListener('click',()=>{v.playbackRate=v.playbackRate===1?1.5:v.playbackRate===1.5?2:1;const b=s.querySelector('[data-video-speed]');if(b)b.textContent=v.playbackRate+'×';});
      s.querySelector('[data-video-captions]')?.addEventListener('click',()=>{if(!v.textTracks?.length)return;const on=v.textTracks[0].mode!=='showing';for(const t of v.textTracks)t.mode=on?'showing':'disabled';s.classList.toggle('captions-on',on);});
      s.querySelector('[data-video-pip]')?.addEventListener('click',async()=>{try{if(document.pictureInPictureElement)await document.exitPictureInPicture();else if(v.requestPictureInPicture)await v.requestPictureInPicture();}catch(_){}});
      s.querySelector('[data-video-fullscreen]')?.addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(s.requestFullscreen)await s.requestFullscreen();else v.webkitEnterFullscreen?.();}catch(_){}});
      sync(s);
      if(observer){observer.observe(s);warm.observe(s);}
      else{attach(s);if(!state.active)play(s);}
    });
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseOthers(null);else pick();});
  document.addEventListener('click',e=>{if(e.target.closest('[data-carousel-prev],[data-carousel-next]')){e.target.closest('[data-carousel]')?.querySelectorAll('video').forEach(v=>v.pause());requestAnimationFrame(pick);}});
  window.addEventListener('scroll',()=>requestAnimationFrame(pick),{passive:true});
  window.addEventListener('resize',()=>requestAnimationFrame(pick),{passive:true});
})();
