'use strict';
const MAX_VIDEO_SECONDS=30;
function readMp4(buffers){
 const candidates=[];
 for(const buffer of buffers){
  if(!Buffer.isBuffer(buffer)||buffer.length<40)continue;
  let offset=0;
  while((offset=buffer.indexOf('mvhd',offset,'ascii'))>=0){
   // An mvhd full-box contains the actual movie duration in timescale units.
   if(offset<4||offset+5>buffer.length){offset+=4;continue}
   const boxSize=buffer.readUInt32BE(offset-4),version=buffer[offset+4];
   if(boxSize<24||boxSize>256||![0,1].includes(version)||offset+(version===1?36:24)>buffer.length){offset+=4;continue}
   try{
    const scale=buffer.readUInt32BE(offset+(version===1?24:16));
    const units=version===1?Number(buffer.readBigUInt64BE(offset+28)):buffer.readUInt32BE(offset+20);
    const seconds=units/scale;
    if(scale>0&&Number.isFinite(seconds)&&seconds>0&&seconds<43200)candidates.push(seconds);
   }catch{}
   offset+=4;
  }
 }
 if(candidates.length){
  // Reject inconsistent box durations rather than trusting the shortest spoofed one.
  if(candidates.some(n=>Math.abs(n-candidates[0])>0.25))throw Error('Video metama’lumoti bir-biriga mos emas.');
  return candidates[0];
 }
 return null;
}
function readVint(buf,pos){if(pos>=buf.length)return null;const x=buf[pos];let mask=0x80,n=1;while(n<=8&&!(x&mask)){mask>>=1;n++}if(n>8||pos+n>buf.length)return null;let v=x&(mask-1);for(let j=1;j<n;j++)v=v*256+buf[pos+j];return {value:v,length:n}}
function webmDuration(buffers){
 const buf=buffers[0];
 if(!Buffer.isBuffer(buf)||buf.length<50)return null;
 let info=buf.indexOf(Buffer.from([0x15,0x49,0xa9,0x66]));
 if(info<0)return null;
 const infoLen=readVint(buf,info+4);if(!infoLen)return null;
 let off=info+4+infoLen.length,limit=Math.min(buf.length,off+Math.min(4096,infoLen.value)),scale=1000000,duration=0;
 while(off<limit){
  const idLen=(()=>{let n=1,m=0x80;while(n<=4&&!(buf[off]&m)){n++;m>>=1}return n<=4?n:0})();
  if(!idLen||off+idLen>=limit)break;
  const id=buf.subarray(off,off+idLen).toString('hex');off+=idLen;
  const v=readVint(buf,off);if(!v||!Number.isFinite(v.value))break;off+=v.length;
  if(v.value>limit-off)break;
  if(id==='2ad7b1'&&v.value>=1&&v.value<=6)scale=buf.readUIntBE(off,v.value);
  if(id==='4489'&&[4,8].includes(v.value))duration=v.value===4?buf.readFloatBE(off):buf.readDoubleBE(off);
  off+=v.value;
 }
 const seconds=duration*scale/1e9;
 return Number.isFinite(seconds)&&seconds>0&&seconds<43200?seconds:null;
}
function detectDuration(head,tail,mime){
 if(!Buffer.isBuffer(head))throw Error('Video faylini tekshirib bo‘lmadi.');
 if(mime==='video/mp4'){
  if(head.toString('ascii',4,8)!=='ftyp')throw Error('MP4 fayl sarlavhasi noto‘g‘ri.');
  return readMp4([head,tail]);
 }
 if(mime==='video/webm'){
  if(head.subarray(0,4).toString('hex')!=='1a45dfa3')throw Error('WebM fayl sarlavhasi noto‘g‘ri.');
  return webmDuration([head,tail]);
 }
 throw Error('Bu video formati qo‘llanmaydi.');
}
function enforceVideoDuration(head,tail,mime){
 const seconds=detectDuration(head,tail,mime);
 if(!Number.isFinite(seconds)||seconds<=0)throw Error('Video davomiyligini tasdiqlab bo‘lmadi. 30 soniyagacha MP4/WebM fayl yuklang.');
 if(seconds>MAX_VIDEO_SECONDS)throw Error('Maksimum 30 soniyalik video joylash mumkin.');
 return Number(seconds.toFixed(3));
}
module.exports={MAX_VIDEO_SECONDS,detectDuration,enforceVideoDuration,readVint};
