const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const crypto = require('crypto');
const sharp = require('sharp');
const {enforceVideoDuration}=require('./videoDuration');

function configured(){return !!(process.env.R2_ACCOUNT_ID&&process.env.R2_ACCESS_KEY_ID&&process.env.R2_SECRET_ACCESS_KEY&&process.env.R2_BUCKET&&process.env.R2_PUBLIC_URL)}
let _client;
function client(){if(_client)return _client;_client=new S3Client({region:'auto',endpoint:`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY}});return _client}
function publicUrl(key){return `${String(process.env.R2_PUBLIC_URL||'').replace(/\/$/,'')}/${key}`}

let _fileType;
async function sniff(buffer){
  try{if(!_fileType)_fileType=import('file-type');const mod=await _fileType;return await mod.fileTypeFromBuffer(buffer)}catch{return null}
}
function compatible(claimed,detected){
  if(!detected)return /^(text\/plain|application\/zip)$/i.test(claimed||'');
  const c=String(claimed||'').toLowerCase(),d=String(detected.mime||'').toLowerCase();
  if(c===d)return true;
  if(c.startsWith('image/')&&d.startsWith('image/'))return true;
  if((c.startsWith('video/')||c.startsWith('audio/'))&&(d.includes('webm')||d.includes('mp4')||d.startsWith('audio/')))return true;
  return c==='application/zip'&&d==='application/zip';
}
async function put(buffer,key,contentType,cacheControl='public, max-age=31536000, immutable'){if(!configured())throw new Error('R2 sozlanmagan. R2_* .env qiymatlarini kiriting.');await client().send(new PutObjectCommand({Bucket:process.env.R2_BUCKET,Key:key,Body:buffer,ContentType:contentType,CacheControl:cacheControl}));return {key,url:publicUrl(key)}}

async function uploadStream(stream,prefix='media',contentType='application/octet-stream',contentLength=0){
  if(!configured())throw new Error('R2 sozlanmagan.');
  const allowed={
    'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif',
    'video/mp4':'mp4','video/webm':'webm'
  };
  const mime=String(contentType||'').toLowerCase();const ext=allowed[mime];
  if(!ext)throw new Error('Bu media turi qo‘llanmaydi.');
  const size=Number(contentLength||0);if(!Number.isFinite(size)||size<=0)throw new Error('Fayl hajmi aniqlanmadi.');
  const key=`${String(prefix||'media').replace(/[^a-z0-9_\-/]/gi,'').replace(/^\/+|\/+$/g,'')}/${Date.now()}-${crypto.randomBytes(10).toString('hex')}.${ext}`;
  await client().send(new PutObjectCommand({Bucket:process.env.R2_BUCKET,Key:key,Body:stream,ContentLength:size,ContentType:mime,CacheControl:'public, max-age=3600',ContentDisposition:'inline'}));
  return {key,url:publicUrl(key),thumbKey:'',thumbUrl:'',width:0,height:0,type:mime.startsWith('video/')?'video':'image'};
}

async function verifyUploadedVideo(key,size,mime){
  const length=Math.max(0,Number(size)||0);
  const headN=Math.min(length,524288),tailN=Math.min(length,2097152);
  async function range(start,end){const r=await client().send(new GetObjectCommand({Bucket:process.env.R2_BUCKET,Key:key,Range:`bytes=${start}-${end}`}));return Buffer.from(await r.Body.transformToByteArray())}
  const head=await range(0,headN-1);
  const tail=length<=headN?head:await range(length-tailN,length-1);
  return enforceVideoDuration(head,tail,mime);
}

async function uploadFile(file,prefix='media',options={}){
  if(!file?.buffer)throw new Error('Fayl topilmadi.');
  const detected=await sniff(file.buffer);if(!compatible(file.mimetype,detected))throw new Error('Fayl turi xavfsizlik tekshiruvidan o‘tmadi.');
  const duration=String(file.mimetype||'').startsWith('video/')&&String(prefix).startsWith('posts')?enforceVideoDuration(file.buffer,file.buffer,file.mimetype):0;
  const isImage=/^image\/(jpeg|png|webp|avif)$/i.test(file.mimetype||'');
  if(isImage && options.optimize!==false){
    const img=sharp(file.buffer,{failOn:'warning'}).rotate();
    const meta=await img.metadata();
    const max=Number(options.maxEdge||1600);
    const mainBuf=await img.clone().resize({width:max,height:max,fit:'inside',withoutEnlargement:true}).webp({quality:Number(options.quality||84),effort:4}).toBuffer();
    const thumbBuf=await img.clone().resize({width:360,height:360,fit:'cover',withoutEnlargement:true}).webp({quality:74,effort:3}).toBuffer();
    const base=`${prefix}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const main=await put(mainBuf,`${base}.webp`,'image/webp',options.cacheControl||'public, max-age=3600');
    const thumb=await put(thumbBuf,`${base}-thumb.webp`,'image/webp',options.cacheControl||'public, max-age=3600');
    return {...main,thumbKey:thumb.key,thumbUrl:thumb.url,width:meta.width||0,height:meta.height||0,type:'image'};
  }
  const ext=(String(file.originalname||'file').split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,8)||'bin';
  const key=`${prefix}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  const out=await put(file.buffer,key,file.mimetype||'application/octet-stream',options.cacheControl||'public, max-age=3600');
  return {...out,thumbKey:'',thumbUrl:'',width:0,height:0,type:(file.mimetype||'').startsWith('video/')?'video':(file.mimetype||'').startsWith('audio/')?'audio':'file',duration};
}
async function uploadImage(file,prefix='posts',options={}){return uploadFile(file,prefix,options)}
async function uploadCaption(vtt,prefix='posts/captions'){
 const key=String(prefix).replace(/[^a-z0-9_\/-]/gi,'').replace(/^\/+|\/+$/g,'')+'/'+Date.now()+'-'+crypto.randomBytes(9).toString('hex')+'.vtt';
 return put(Buffer.from(vtt,'utf8'),key,'text/vtt; charset=utf-8','public, max-age=3600');
}
async function deleteImage(key){if(!key)return;if(!configured())throw new Error('R2 sozlanmagan: media o‘chirilmaydi.');await client().send(new DeleteObjectCommand({Bucket:process.env.R2_BUCKET,Key:key}));}
async function deleteMany(keys=[]){await Promise.all([...new Set(keys.filter(Boolean))].map(deleteImage))}
async function listPrefix(prefix,maxKeys=1000){if(!configured())return [];const out=[];let token;do{const r=await client().send(new ListObjectsV2Command({Bucket:process.env.R2_BUCKET,Prefix:prefix,MaxKeys:Math.min(1000,maxKeys-out.length),ContinuationToken:token}));out.push(...(r.Contents||[]));token=r.IsTruncated?r.NextContinuationToken:null}while(token&&out.length<maxKeys);return out}
async function listPrefixPage(prefix,maxKeys=250,startAfter=''){
  if(!configured())return {objects:[],nextStartAfter:''};
  const page=await client().send(new ListObjectsV2Command({
    Bucket:process.env.R2_BUCKET,Prefix:prefix,
    MaxKeys:Math.max(1,Math.min(1000,maxKeys)),...(startAfter?{StartAfter:startAfter}:{})
  }));
  const objects=page.Contents||[];
  return {objects,nextStartAfter:page.IsTruncated&&objects.length?objects[objects.length-1].Key:''};
}
async function getCaptionText(key){
 if(!configured()||!/^(posts\/)[A-Za-z0-9/_-]+\.vtt$/.test(key))throw new Error('Subtitr kaliti noto‘g‘ri.');
 const result=await client().send(new GetObjectCommand({Bucket:process.env.R2_BUCKET,Key:key}));
 if(!result.Body)throw new Error('Subtitr mavjud emas.');
 const text=await result.Body.transformToString('utf-8');
 if(Buffer.byteLength(text,'utf8')>32*1024)throw new Error('Subtitr juda katta.');
 return text;
}
module.exports={uploadImage,uploadFile,uploadStream,verifyUploadedVideo,uploadCaption,getCaptionText,deleteImage,deleteMany,listPrefix,listPrefixPage,configured,publicUrl};
