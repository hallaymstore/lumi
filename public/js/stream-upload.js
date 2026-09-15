(()=>{
  const add=(form,name,value)=>{const i=document.createElement('input');i.type='hidden';i.name=name;i.value=value;form.appendChild(i)};
  document.addEventListener('submit',async e=>{
    const form=e.target.closest?.('[data-stream-upload-form]');if(!form)return;
    const input=form.querySelector('input[type="file"][name="images"]');const files=[...(input?.files||[])];if(!files.length)return;
    if(files.length>10){e.preventDefault();alert('Maksimum 10 ta media tanlang.');return}
    const submitter=e.submitter;const action=submitter?.getAttribute('formaction')||form.getAttribute('action')||'/posts/create';const intent=action.includes('create-draft')?'draft':'publish';
    e.preventDefault();const buttons=[...form.querySelectorAll('button[type="submit"]')];buttons.forEach(b=>b.disabled=true);
    const box=form.querySelector('[data-stream-progress]'),bar=form.querySelector('[data-stream-progress-bar]'),value=form.querySelector('[data-stream-progress-value]'),label=form.querySelector('[data-stream-progress-label]');if(box)box.hidden=false;
    try{
      const tokens=[];
      for(let index=0;index<files.length;index++){
        const file=files[index];if(label)label.textContent=`${index+1}/${files.length}: ${file.name}`;
        const before=Math.round(index/files.length*100);if(bar)bar.value=before;if(value)value.textContent=before+'%';
        const r=await fetch('/api/uploads/stream',{method:'POST',headers:{'Content-Type':file.type||'application/octet-stream','X-File-Name':encodeURIComponent(file.name||'media')},body:file,credentials:'same-origin'});
        const data=await r.json().catch(()=>({ok:false,error:'Server javobi olinmadi.'}));if(!r.ok||!data.ok)throw new Error(data.error||'Media yuklanmadi.');tokens.push(data.token);
        const pct=Math.round((index+1)/files.length*100);if(bar)bar.value=pct;if(value)value.textContent=pct+'%';
      }
      if(label)label.textContent='Post saqlanmoqda…';
      const out=document.createElement('form');out.method='post';out.action='/posts/create-streamed';out.hidden=true;add(out,'uploadTokens',JSON.stringify(tokens));add(out,'caption',form.querySelector('[name="caption"]')?.value||'');add(out,'tags',form.querySelector('[name="tags"]')?.value||'');add(out,'intent',intent);document.body.appendChild(out);out.submit();
    }catch(err){buttons.forEach(b=>b.disabled=false);if(label)label.textContent='Yuklash to‘xtadi';alert(err?.message||'Media yuklashda xatolik. Qayta urinib ko‘ring.')}
  });
})();
