const router=require('express').Router();
const mongoose=require('mongoose');
const {getCaptionText}=require('../services/r2');

const Post=require('../models/Post');
const Follow=require('../models/Follow');
const UserRelation=require('../models/UserRelation');
const {publishedQuery}=require('../services/freshPosts');
const {decoratePosts}=require('../utils/socialState');
const {linkifyMentions}=require('../utils/mentions');
const {getShareTargets}=require('../utils/socialUi');
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
const FeedEvent=require('../models/FeedEvent');
const {requireAuth}=require('../middleware/auth');
const {userSignals}=require('../services/feed');
const {rankClips}=require('../services/clipRank');
const {clipStats}=require('../services/clipStats');

const AUTHOR_FIELDS='name username avatarUrl isVerified isPrivate isSuspended accountOrigin proExpiresAt';
const MAX_SEEN=90;
function excluded(raw){
 return [...new Set(String(raw||'').split(',').filter(x=>/^[a-f0-9]{24}$/i.test(x)))].slice(-MAX_SEEN);
}
let candidateCache={at:0,rows:null};
async function loadCandidates(){
 const base=publishedQuery({'media.type':'video'});
 const [fresh,quality,discovery]=await Promise.all([
  Post.find(base).sort({createdAt:-1}).limit(110).populate('author',AUTHOR_FIELDS).lean(),
  Post.find(base).sort({qualityScore:-1,createdAt:-1}).limit(95).populate('author',AUTHOR_FIELDS).lean(),
  Post.aggregate([{$match:base},{$sample:{size:45}}]).then(rows=>Post.populate(rows,{path:'author',select:AUTHOR_FIELDS}))
 ]);
 const posts=new Map();
 for(const p of [...fresh,...quality,...discovery])if(p?._id)posts.set(String(p._id),p);
 return [...posts.values()];
}
// Candidate pool is shared by all viewers and refreshed every 30 s; personal filtering happens in rankClips().
async function candidatesForClips(){
 if(candidateCache.rows&&Date.now()-candidateCache.at<30_000)return candidateCache.rows;
 const rows=await loadCandidates();candidateCache={at:Date.now(),rows};return rows;
}
async function recommend(req,limit=8){
 const [rows,signals]=await Promise.all([candidatesForClips(),userSignals(req.currentUser?._id)]);
 const stats=await clipStats(rows.map(p=>p._id)).catch(()=>new Map());
 const chosen=rankClips(rows,signals,{userId:req.currentUser?._id,limit,exclude:excluded(req.query.seen),nonce:Math.floor(Date.now()/3600000),stats});
 const posts=await decoratePosts(chosen,req.currentUser?._id);
 return posts.map(p=>({...p,video:(p.media||[]).find(m=>m.type==='video'),captionHtml:linkifyMentions(p.caption||'')})).filter(p=>p.video);
}
router.get('/api/clips/next',async(req,res,next)=>{
 try{
  const clips=await recommend(req,8);
  res.set('Cache-Control','no-store');
  return res.render('clips/cards',{clips},(err,html)=>err?next(err):res.json({ok:true,html,hasMore:clips.length===8}));
 }catch(err){next(err)}
});
router.post('/api/clips/watch',requireAuth,async(req,res)=>{
 try{
  const uid=req.currentUser._id;
  if(req.currentUser.accountOrigin==='synthetic'||req.currentUser.managedByPlatform)return res.json({ok:true,recorded:false});
  const pid=String(req.body.postId||'');
  if(!mongoose.isValidObjectId(pid))return res.sendStatus(400);
  const seconds=Number(req.body.seconds),ratio=Number(req.body.ratio);
  if(!Number.isFinite(seconds)||seconds<0||seconds>31||!Number.isFinite(ratio)||ratio<0||ratio>1)return res.sendStatus(400);
  const post=await Post.findOne(publishedQuery({_id:pid,'media.type':'video'})).select('_id author tags').populate('author','_id isPrivate isSuspended').lean();
  if(!post?.author||post.author.isSuspended)return res.sendStatus(404);
  const aid=String(post.author._id);
  if(post.author.isPrivate&&aid!==String(uid)&&!await Follow.exists({follower:uid,following:post.author._id,status:'accepted'}))return res.sendStatus(404);
  if(await UserRelation.exists({type:'block',$or:[{owner:uid,target:post.author._id},{target:uid,owner:post.author._id}]}))return res.sendStatus(404);
  const since=new Date(Date.now()-90000);
  const exists=await FeedEvent.exists({user:uid,post:post._id,type:{$in:['clip_skip','clip_watch','clip_complete']},createdAt:{$gte:since}});
  if(exists)return res.json({ok:true,recorded:false});
  const type=(ratio>=.9&&seconds>=2)?'clip_complete':(seconds<2||ratio<.16)?'clip_skip':'clip_watch';
  await FeedEvent.create({user:uid,post:post._id,author:post.author._id,tags:post.tags||[],type,value:Math.min(30,seconds)});
  return res.json({ok:true,recorded:true});
 }catch(e){console.error('Clip watch:',e.message);res.sendStatus(500)}
});
router.get('/clips',async(req,res,next)=>{
 try{
  const clips=await recommend(req,8);
  const shareTargets=req.currentUser?await getShareTargets(req.currentUser._id,30):[];
  res.set('Cache-Control','no-store');
  res.render('clips/index',{title:'Lumi Clips',clips,shareTargets,metaDescription:'Lumi Clips — videolarni qiziqishlaringizga mos tomosha qiling.'});
 }catch(err){next(err)}
});
module.exports=router;
