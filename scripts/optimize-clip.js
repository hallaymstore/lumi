#!/usr/bin/env node
/* Optional FFmpeg R2 optimization. Requires dedicated worker: node scripts/optimize-clip.js POST_ID. */
require('dotenv').config();
const fs=require('node:fs'),fsp=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{pipeline}=require('node:stream/promises');
const mongoose=require('mongoose');
const {S3Client,GetObjectCommand,PutObjectCommand,DeleteObjectCommand}=require('@aws-sdk/client-s3');
const Post=require('../models/Post'),connectDB=require('../config/db');
function check(){for(const k of ['MONGODB_URI','R2_ACCOUNT_ID','R2_BUCKET','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_PUBLIC_URL'])if(!process.env[k])throw Error('Missing '+k)}
function client(){return new S3Client({region:'auto',endpoint:'https://'+process.env.R2_ACCOUNT_ID+'.r2.cloudflarestorage.com',credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY}})}
async function ffmpeg(args){await new Promise((resolve,reject)=>{
 const child=spawn(process.env.FFMPEG_BIN||'ffmpeg',['-hide_banner','-nostdin','-loglevel','error','-y',...args],{stdio:['ignore','ignore','pipe'],shell:false});
 let tail='';const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('FFmpeg timeout'))},15*60*1000);
 child.stderr.on('data',x=>{tail=(tail+x.toString()).slice(-4500)});
 child.on('error',e=>{clearTimeout(timer);reject(e)});
 child.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(Error('ffmpeg exit '+code+': '+tail))});
})}
async function run(id){
 if(!mongoose.isValidObjectId(id))throw Error('Valid Post ObjectId required');
 check();await connectDB();
 const post=await Post.findById(id);
 if(!post||post.isHidden||post.status!=='published'||post.expiresAt&&new Date(post.expiresAt)<=new Date())throw Error('Active published post not found');
 const index=(post.media||[]).findIndex(x=>x.type==='video'&&x.key);
 if(index<0)throw Error('No R2 video on post');
 const m=post.media[index];if(m.playbackKey){console.log('Already optimized:',m.playbackKey);return}
 const key=m.key,dir=await fsp.mkdtemp(path.join(os.tmpdir(),'lumi-video-'));
 const original=path.join(dir,'source'),output=path.join(dir,'output.mp4'),cover=path.join(dir,'poster.jpg');
 const s3=client(),uploaded=[];
 try{
  const result=await s3.send(new GetObjectCommand({Bucket:process.env.R2_BUCKET,Key:key}));
  if(!result.Body)throw Error('Source missing');
  await pipeline(result.Body,fs.createWriteStream(original));
  await ffmpeg(['-threads','2','-i',original,'-map','0:v:0','-map','0:a:0?','-vf',"scale=w='min(720,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",'-r','30','-c:v','libx264','-preset','veryfast','-crf','27','-maxrate','1200k','-bufsize','2400k','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-movflags','+faststart',output]);
  const [inputStat,outStat]=await Promise.all([fsp.stat(original),fsp.stat(output)]);
  if(!outStat.size)throw Error('Empty transcoding result');
  const use=outStat.size<inputStat.size*.95;
  let outKey='',posterKey='',posterUrl='';
  if(use){
   outKey='posts/optimized/'+id+'/'+crypto.randomUUID()+'.mp4';
   await s3.send(new PutObjectCommand({Bucket:process.env.R2_BUCKET,Key:outKey,Body:fs.createReadStream(output),ContentLength:outStat.size,ContentType:'video/mp4',CacheControl:'public, max-age=3600'}));
   uploaded.push(outKey);
  }
  if(!m.posterKey){
   await ffmpeg(['-ss','1','-i',original,'-frames:v','1','-vf','scale=360:640:force_original_aspect_ratio=decrease,pad=360:640:(ow-iw)/2:(oh-ih)/2','-q:v','5',cover]);
   const stat=await fsp.stat(cover);
   posterKey='posts/optimized/'+id+'/'+crypto.randomUUID()+'.jpg';
   await s3.send(new PutObjectCommand({Bucket:process.env.R2_BUCKET,Key:posterKey,Body:fs.createReadStream(cover),ContentLength:stat.size,ContentType:'image/jpeg',CacheControl:'public, max-age=3600'}));
   uploaded.push(posterKey);posterUrl=process.env.R2_PUBLIC_URL.replace(/\/$/,'')+'/'+posterKey;
  }
  const fresh=await Post.findById(id);
  if(!fresh||fresh.expiresAt&&new Date(fresh.expiresAt)<=new Date()||fresh.media[index]?.key!==key)throw Error('Post changed during processing');
  if(use){fresh.media[index].playbackKey=outKey;fresh.media[index].playbackUrl=process.env.R2_PUBLIC_URL.replace(/\/$/,'')+'/'+outKey}
  if(posterKey){fresh.media[index].posterKey=posterKey;fresh.media[index].posterUrl=posterUrl;fresh.media[index].thumbKey=posterKey;fresh.media[index].thumbUrl=posterUrl}
  await fresh.save();
  console.log(JSON.stringify({ok:true,id,originalBytes:inputStat.size,outputBytes:outStat.size,selected:use,posterAdded:!!posterKey}));
 }catch(e){
  for(const k of uploaded)await s3.send(new DeleteObjectCommand({Bucket:process.env.R2_BUCKET,Key:k})).catch(()=>{});
  throw e;
 }finally{await fsp.rm(dir,{recursive:true,force:true}).catch(()=>{})}
}
(async()=>{try{await run(process.argv[2])}catch(e){console.error(e.message);process.exitCode=1}finally{await mongoose.disconnect().catch(()=>{})}})();
