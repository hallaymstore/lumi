/* Lumi uploader: bounded stream, automatic WebP cover, VTT/SRT captions. */
(()=>{
 const add=(f,n,v)=>{const i=document.createElement('input');i.type='hidden';i.name=n;i.value=v;f.appendChild(i)};
 const upload=async(file,purpose='media')=>{
  const r=await fetch('/api/uploads/stream',{method:'POST',headers:{'Content-Type':file.type||'application/octet-stream','X-Lumi-Purpose':purpose},body:file,credentials:'same-origin'});
  const data=await r.json().catch(()=>({}));
  if(!r.ok||!data.ok)throw Error(data.error||'Media yuklanmadi');
  return data.token;
 };
 const meta=async file=>{
  const url=URL.createObjectURL(file);
  const v=document.createElement('video');v.muted=true;v.preload='metadata';v.playsInline=true;
  try{
   v.src=url;
   await new Promise((resolve,reject)=>{
    const t=setTimeout(()=>reject(Error('Video o‘qilmadi')),14000);
    v.onloadedmetadata=()=>{clearTimeout(t);resolve()};
    v.onerror=()=>{clearTimeout(t);reject(Error('Video formati qo‘llanmaydi'))};
   });
   const result={width:v.videoWidth||0,height:v.videoHeight||0,duration:Number.isFinite(v.duration)?v.duration:0};
   try{
    const at=Math.min(.75,Math.max(0,v.duration/4||0));
    v.currentTime=at;
    await new Promise((resolve,reject)=>{
     const t=setTimeout(()=>reject(Error('Muqova olinmadi')),4000);
     v.onseeked=()=>{clearTimeout(t);resolve()};
     v.onerror=()=>{clearTimeout(t);reject(Error('Muqova olinmadi'))};
    });
    const w=360,h=640,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas ochilmadi');
    ctx.fillStyle='#141118';ctx.fillRect(0,0,w,h);
    const f=Math.min(w/result.width,h/result.height),dw=result.width*f,dh=result.height*f;
    ctx.drawImage(v,(w-dw)/2,(h-dh)/2,dw,dh);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.78));
    if(blob&&blob.size<2*1024*1024)result.poster=blob;
   }catch(err){console.warn('Lumi poster fallback:',err.message)}
   return result;
  }finally{v.pause();v.removeAttribute('src');v.load();URL.revokeObjectURL(url)}
 };
 document.addEventListener('change',e=>{
  if(!e.target.matches?.('[data-multi-image-input]'))return;
  const videos=[...(e.target.files||[])].filter(f=>f.type.startsWith('video/'));
  const hint=document.querySelector('[data-clip-video-hint]');
  if(hint)hint.textContent=videos.length?'Muqova avtomatik olinadi. SRT/VTT birinchi videoga biriktiriladi.':'Video qo‘shsangiz Clips bo‘limida ham ko‘rinadi.';
 });
 document.addEventListener('submit',async e=>{
  const form=e.target.closest?.('[data-stream-upload-form]');if(!form)return;
  const input=form.querySelector('input[name="images"][type="file"]');
  const files=[...(input?.files||[])];if(!files.length)return;
  e.preventDefault();
  const mode=form.dataset.clipMode==='1';
  if(files.length>10||(mode&&(files.length!==1||!files[0].type.startsWith('video/')))){alert(mode?'Clip uchun bitta video tanlang.':'Maksimum 10 ta media.');return}
  const action=e.submitter?.getAttribute('formaction')||form.getAttribute('action')||'/posts/create',intent=action.includes('create-draft')?'draft':'publish';
  const buttons=[...form.querySelectorAll('button[type=submit]')];buttons.forEach(b=>b.disabled=true);
  const box=form.querySelector('[data-stream-progress]'),bar=form.querySelector('[data-stream-progress-bar]'),value=form.querySelector('[data-stream-progress-value]'),label=form.querySelector('[data-stream-progress-label]');
  if(box)box.hidden=false;
  const progress=(pct,msg)=>{if(bar)bar.value=pct;if(value)value.textContent=pct+'%';if(label)label.textContent=msg};
  try{
   const tokens=[],mediaExtras=[];
   for(let i=0;i<files.length;i++){
    const f=files[i],video=f.type.startsWith('video/');
    if(!video&&!/^image\/(jpeg|png|webp|avif)$/.test(f.type))throw Error('Fayl turi qo‘llanmaydi');
    let extra=null;
    if(video){
     progress(Math.round(i/files.length*90),'Video tekshirilmoqda…');
     try{extra=await meta(f)}catch(err){console.warn('Video metadata fallback:',err.message);extra={width:0,height:0,duration:0}}
     if(mode&&extra.duration>180)throw Error('Lumi Clip maksimum 3 daqiqa davom etishi mumkin.');
     if(extra.width>1920||extra.height>1920)console.warn('1080p dan katta video sekinroq yuklanishi mumkin.');
    }
    progress(Math.round(i/files.length*90),String(i+1)+'/'+files.length+': '+f.name);
    tokens.push(await upload(f));
    if(extra){
     const data={index:i,width:extra.width,height:extra.height,duration:extra.duration};
     if(extra.poster){progress(Math.round((i+.7)/files.length*90),'Muqova saqlanmoqda…');try{data.posterToken=await upload(extra.poster,'poster')}catch(err){console.warn('Muqova yuklanmadi:',err.message)}}
     mediaExtras.push(data);
    }
    progress(Math.round((i+1)/files.length*90),String(i+1)+'/'+files.length+' yuklandi');
   }
   const sub=form.querySelector('[data-captions-file]')?.files?.[0];
   if(sub&&mediaExtras.length){
    if(sub.size>32768)throw Error('Subtitr maksimum 32 KB.');
    progress(92,'Subtitr tekshirilmoqda…');
    const r=await fetch('/api/clips/captions',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:await sub.text()})});
    const j=await r.json().catch(()=>({}));if(!r.ok||!j.ok)throw Error(j.error||'Subtitr saqlanmadi.');
    mediaExtras[0].captionsToken=j.token;
    mediaExtras[0].captionsLang=form.querySelector('[data-captions-lang]')?.value||'uz';
   }
   progress(100,'Post saqlanmoqda…');
   const out=document.createElement('form');out.method='post';out.action='/posts/create-streamed';out.hidden=true;
   add(out,'uploadTokens',JSON.stringify(tokens));add(out,'mediaExtras',JSON.stringify(mediaExtras));
   add(out,'caption',form.querySelector('[name=caption]')?.value||'');
   add(out,'tags',form.querySelector('[name=tags]')?.value||'');
   add(out,'intent',intent);add(out,'clipMode',mode?'1':'0');
   document.body.appendChild(out);out.submit();
  }catch(err){buttons.forEach(b=>b.disabled=false);progress(0,'Yuklash to‘xtadi');alert(err?.message||'Yuklashda xatolik.')}
 });
})();
