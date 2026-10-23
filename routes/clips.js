const router=require('express').Router();
const mongoose=require('mongoose');
const {getCaptionText}=require('../services/r2');

const Post=require('../models/Post');
const Follow=require('../models/Follow');
const UserRelation=require('../models/UserRelation');
const {publishedQuery}=require('../services/freshPosts');
const {decoratePosts}=require('../utils/socialState');
const {linkifyMentions}=require('../utils/mentions');
router.get('/api/clips/caption/:postId',async(req,res)=>{
 if(!mongoose.isValidObjectId(req.params.postId))return res.sendStatus(404);
 const i=Number(req.query.i||0);if(!Number.isInteger(i)||i<0||i>9)return res.sendStatus(404);
 try{
  const post=await Post.findOne(publishedQuery({_id:req.params.postId})).populate('author','isPrivate isSuspended').lean();
  if(!post?.author||post.author.isSuspended||!post.media?.[i]?.captionsKey)return res.sendStatus(404);
  const uid=req.currentUser?String(req.currentUser._id):'';
  const authorId=String(post.author._id);
  if(post.author.isPrivate&&uid!==authorId&&!await Follow.exists({follower:req.currentUser?._id||null,following:post.author._id,status:'accepted'}))return res.sendStatus(404);
  if(uid&&await UserRelation.exists({type:'block',$or:[{owner:req.currentUser._id,target:post.author._id},{owner:post.author._id,target:req.currentUser._id}]}))return res.sendStatus(404);
  const text=await getCaptionText(post.media[i].captionsKey);
  res.set('Cache-Control','private, max-age=120');res.type('text/vtt').send(text);
 }catch(e){console.error('Clip caption:',e.message);res.sendStatus(404)}
});
router.get('/clips',async(req,res,next)=>{
 try{
  const before=typeof req.query.before==='string'&&/^\d{4}-\d\d-\d\dT/.test(req.query.before)?new Date(req.query.before):null;
  if(before&&!Number.isFinite(+before))return res.status(400).render('error',{title:'Xato',message:'Noto‘g‘ri sana.'});
  const base={'media.type':'video'};
  if(before)base.createdAt={$lt:before};
  const rows=await Post.find(publishedQuery(base)).sort({createdAt:-1,_id:-1}).limit(45)
    .populate('author','name username avatarUrl isVerified isPrivate isSuspended accountOrigin proExpiresAt').lean();
  const uid=req.currentUser?String(req.currentUser._id):'';
  let following=new Set(),blocked=new Set();
  if(uid){
   const ids=rows.filter(p=>p.author).map(p=>p.author._id);
   const [follows,relations]=await Promise.all([
    Follow.find({follower:req.currentUser._id,following:{$in:ids},status:'accepted'}).select('following').lean(),
    UserRelation.find({type:'block',$or:[{owner:req.currentUser._id,target:{$in:ids}},{target:req.currentUser._id,owner:{$in:ids}}]}).select('owner target').lean()
   ]);
   following=new Set(follows.map(f=>String(f.following)));
   blocked=new Set(relations.map(r=>String(r.owner)===uid?String(r.target):String(r.owner)));
  }
  const permitted=rows.filter(p=>p.author&&!p.author.isSuspended&&!blocked.has(String(p.author._id))&&(!p.author.isPrivate||String(p.author._id)===uid||following.has(String(p.author._id))));
  const chosen=permitted.slice(0,18);
  const posts=await decoratePosts(chosen,req.currentUser?._id);
  const clips=posts.map(p=>({...p,video:(p.media||[]).find(m=>m.type==='video'),captionHtml:linkifyMentions(p.caption||'')})).filter(p=>p.video);
  const last=rows[rows.length-1];
  const nextUrl=rows.length===45&&last?'/clips?before='+encodeURIComponent(new Date(last.createdAt).toISOString()):'';
  res.set('Cache-Control','no-store');
  res.render('clips/index',{title:'Lumi Clips',clips,nextUrl,metaDescription:'Lumi Clips — tezkor vertikal videolar va ijodkorlar.'});
 }catch(err){next(err)}
});
module.exports=router;
