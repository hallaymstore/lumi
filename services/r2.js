const { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const crypto = require('crypto');
const sharp = require('sharp');

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

async function uploadFile(file,prefix='media',options={}){
  if(!file?.buffer)throw new Error('Fayl topilmadi.');
  const detected=await sniff(file.buffer);if(!compatible(file.mimetype,detected))throw new Error('Fayl turi xavfsizlik tekshiruvidan o‘tmadi.');
  const isImage=/^image\/(jpeg|png|webp|avif)$/i.test(file.mimetype||'');
  if(isImage && options.optimize!==false){
    const img=sharp(file.buffer,{failOn:'warning'}).rotate();
    const meta=await img.metadata();
    const max=Number(options.maxEdge||1600);
    const mainBuf=await img.clone().resize({width:max,height:max,fit:'inside',withoutEnlargement:true}).webp({quality:Number(options.quality||84),effort:4}).toBuffer();
    const thumbBuf=await img.clone().resize({width:360,height:360,fit:'cover',withoutEnlargement:true}).webp({quality:74,effort:3}).toBuffer();
    const base=`${prefix}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const main=await put(mainBuf,`${base}.webp`,'image/webp',options.cacheControl||'public, max-age=31536000, immutable');
    const thumb=await put(thumbBuf,`${base}-thumb.webp`,'image/webp',options.cacheControl||'public, max-age=31536000, immutable');
    return {...main,thumbKey:thumb.key,thumbUrl:thumb.url,width:meta.width||0,height:meta.height||0,type:'image'};
  }
  const ext=(String(file.originalname||'file').split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,8)||'bin';
  const key=`${prefix}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  const out=await put(file.buffer,key,file.mimetype||'application/octet-stream',options.cacheControl||'public, max-age=31536000, immutable');
  return {...out,thumbKey:'',thumbUrl:'',width:0,height:0,type:(file.mimetype||'').startsWith('video/')?'video':(file.mimetype||'').startsWith('audio/')?'audio':'file'};
}
async function uploadImage(file,prefix='posts',options={}){return uploadFile(file,prefix,options)}
async function deleteImage(key){if(!key||!configured())return;await client().send(new DeleteObjectCommand({Bucket:process.env.R2_BUCKET,Key:key})).catch(()=>{})}
async function deleteMany(keys=[]){await Promise.all([...new Set(keys.filter(Boolean))].map(deleteImage))}
async function listPrefix(prefix,maxKeys=1000){if(!configured())return [];const out=[];let token;do{const r=await client().send(new ListObjectsV2Command({Bucket:process.env.R2_BUCKET,Prefix:prefix,MaxKeys:Math.min(1000,maxKeys-out.length),ContinuationToken:token}));out.push(...(r.Contents||[]));token=r.IsTruncated?r.NextContinuationToken:null}while(token&&out.length<maxKeys);return out}
module.exports={uploadImage,uploadFile,deleteImage,deleteMany,listPrefix,configured};
