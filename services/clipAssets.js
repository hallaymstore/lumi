'use strict';
const MAX_CAPTIONS_BYTES=32*1024;
function toVtt(input){
 const raw=String(input||'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();
 if(!raw)throw new Error('Subtitr matni bo‘sh.');
 if(Buffer.byteLength(raw,'utf8')>MAX_CAPTIONS_BYTES)throw new Error('Subtitr maksimum 32 KB bo‘lishi mumkin.');
 const isVtt=/^WEBVTT(?:[ \t].*)?(?:\n|$)/.test(raw);
 const data=isVtt?raw:'WEBVTT\n\n'+raw;
 // Strip HTML-like tags and block WebVTT directives that could load external regions/styles.
 const body=data.replace(/^WEBVTT[^\n]*\n/, '').trim();
 if(/(?:^|\n)\s*(?:STYLE|REGION)\s*(?:\n|$)/i.test(body))throw new Error('STYLE va REGION qo‘llanmaydi.');
 const cues=body.replace(/^\d+\s*\n(?=[0-9:.]+\s*-->)/gm,'').split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);
 if(!cues.length||cues.length>150)throw new Error('Subtitrda 1–150 ta vaqtli satr bo‘lishi kerak.');
 const time=/^(?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3}$/;
 const clean=[];
 function seconds(s){const p=s.replace(',','.').split(':');let n=0;for(const a of p)n=n*60+Number(a);return n}
 for(const c of cues){
  const lines=c.split('\n');let idx=lines.findIndex(x=>x.includes('-->'));
  if(idx<0||idx>1)throw new Error('Vaqt belgilari noto‘g‘ri.');
  const match=lines[idx].trim().match(/^(\S+)\s+-->\s+(\S+)$/);
  if(!match||!time.test(match[1])||!time.test(match[2])||seconds(match[2])<=seconds(match[1]))throw new Error('Subtitr vaqt oralig‘i noto‘g‘ri.');
  const text=lines.slice(idx+1).join('\n').replace(/<[^>]*>/g,'').trim().slice(0,280);
  if(!text)continue;
  clean.push(match[1].replace(',','.')+' --> '+match[2].replace(',','.')+'\n'+text);
 }
 if(!clean.length)throw new Error('Subtitr matni topilmadi.');
 const output='WEBVTT\n\n'+clean.join('\n\n')+'\n';
 if(Buffer.byteLength(output,'utf8')>MAX_CAPTIONS_BYTES)throw new Error('Subtitr juda katta.');
 return output;
}
function clampVideoMeta(meta={}){
 const width=Math.max(0,Math.min(7680,Math.floor(Number(meta.width)||0)));
 const height=Math.max(0,Math.min(7680,Math.floor(Number(meta.height)||0)));
 const duration=Math.max(0,Math.min(10800,Number(meta.duration)||0));
 return {width,height,duration:Number(duration.toFixed(2))};
}
module.exports={toVtt,clampVideoMeta,MAX_CAPTIONS_BYTES};
