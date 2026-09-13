(()=>{
  if(!window.LumiAndroid)return;
  document.documentElement.classList.add('lumi-native-android');
  let sharePost='';
  document.addEventListener('click',e=>{
    const open=e.target.closest?.('[data-share-open]');
    if(open?.dataset?.shareOpen)sharePost=open.dataset.shareOpen;
    const native=e.target.closest?.('[data-native-share]');
    if(!native)return;
    e.preventDefault();e.stopImmediatePropagation();
    const url=sharePost?`${location.origin}/p/${encodeURIComponent(sharePost)}`:location.href;
    try{
      window.LumiAndroid.share('Lumi post','Lumi’da ushbu postni ko‘ring ✨',url);
      if(sharePost)fetch(`/posts/${encodeURIComponent(sharePost)}/share-event`,{method:'POST',headers:{Accept:'application/json'},keepalive:true}).catch(()=>{});
    }catch(_){location.href=url}
  },true);
})();
