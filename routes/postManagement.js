const router=require('express').Router();
const multer=require('multer');
const Post=require('../models/Post');
const User=require('../models/User');
const PostLike=require('../models/PostLike');
const SavedPost=require('../models/SavedPost');
const Comment=require('../models/Comment');
const PostView=require('../models/PostView');
const {requireAuth}=require('../middleware/auth');
const {uploadFile,deleteMany}=require('../services/r2');
const {resolveMentions}=require('../utils/mentions');

const upload=multer({
  storage:multer.memoryStorage(),
  limits:{fileSize:20*1024*1024,files:10},
  fileFilter:(_,f,cb)=>cb(null,/^(image\/(jpeg|png|webp|avif)|video\/(mp4|webm))$/i.test(f.mimetype))
});

function cleanTags(raw){return String(raw||'').split(/[ ,#]+/).map(x=>x.trim().toLowerCase()).filter(Boolean).slice(0,20)}
function mediaKeys(post){return [post.imageKey,...(post.media||[]).flatMap(m=>[m.key,m.thumbKey])].filter(Boolean)}
async function ownPost(req){return Post.findOne({_id:req.params.id,author:req.currentUser._id})}
async function uploadMedia(files){const out=[];for(const f of files||[])out.push(await uploadFile(f,'posts',{maxEdge:1800,quality:84}));return out.map(x=>({url:x.url,key:x.key,type:x.type==='video'?'video':'image',width:x.width||0,height:x.height||0,thumbUrl:x.thumbUrl||'',thumbKey:x.thumbKey||''}))}
async function adjustPublishedCount(userId,delta){if(delta<0)return User.updateOne({_id:userId,postCount:{$gt:0}},{$inc:{postCount:-1}}).catch(()=>{});return User.updateOne({_id:userId},{$inc:{postCount:1}}).catch(()=>{})}

router.post('/create-draft',requireAuth,upload.array('images',10),async(req,res)=>{try{
  const caption=String(req.body.caption||'').trim().slice(0,2200);const files=req.files||[];
  if(!caption&&!files.length)throw new Error('Qoralama uchun caption yoki media kiriting.');
  const media=await uploadMedia(files);const mentionedUsers=await resolveMentions(caption);
  const post=await Post.create({author:req.currentUser._id,caption,imageUrl:media[0]?.url||'',imageKey:media[0]?.key||'',media,tags:cleanTags(req.body.tags),mentions:mentionedUsers.map(u=>u._id),status:'draft',isHidden:true,draftSavedAt:new Date()});
  res.redirect('/posts/drafts');
}catch(e){res.status(400).render('posts/create',{title:'Yangi post',error:e.message||'Qoralama saqlanmadi.'})}});

router.get('/drafts',requireAuth,async(req,res)=>{const posts=await Post.find({author:req.currentUser._id,status:'draft'}).sort({updatedAt:-1}).lean();res.render('profile/collection',{title:'Qoralamalar',heading:'Qoralamalar',empty:'Hozircha qoralama yo‘q.',posts,mode:'draft'})});
router.get('/archived',requireAuth,async(req,res)=>{const posts=await Post.find({author:req.currentUser._id,status:'archived'}).sort({archivedAt:-1,updatedAt:-1}).lean();res.render('profile/collection',{title:'Arxiv',heading:'Arxivlangan postlar',empty:'Hozircha arxivlangan post yo‘q.',posts,mode:'archived'})});

router.get('/:id/edit',requireAuth,async(req,res)=>{const post=await ownPost(req);if(!post)return res.sendStatus(404);res.render('posts/edit',{title:'Postni tahrirlash',post,error:null})});
router.post('/:id/edit',requireAuth,upload.array('images',10),async(req,res)=>{const post=await ownPost(req);if(!post)return res.sendStatus(404);try{
  const oldStatus=post.status||'published';const caption=String(req.body.caption||'').trim().slice(0,2200);const mentionedUsers=await resolveMentions(caption);
  post.caption=caption;post.tags=cleanTags(req.body.tags);post.mentions=mentionedUsers.map(u=>u._id);post.editedAt=new Date();
  if((req.files||[]).length){const oldKeys=mediaKeys(post);const media=await uploadMedia(req.files);post.media=media;post.imageUrl=media[0]?.url||'';post.imageKey=media[0]?.key||'';await deleteMany(oldKeys).catch(()=>{})}
  const intent=String(req.body.intent||'save');
  if(intent==='draft'&&oldStatus==='published'){post.status='draft';post.isHidden=true;post.isPinned=false;post.draftSavedAt=new Date();await adjustPublishedCount(post.author,-1)}
  else if(intent==='publish'&&oldStatus!=='published'){post.status='published';post.isHidden=false;post.archivedAt=null;post.draftSavedAt=null;await adjustPublishedCount(post.author,1)}
  await post.save();
  res.redirect(post.status==='draft'?'/posts/drafts':post.status==='archived'?'/posts/archived':'/p/'+post._id);
}catch(e){res.status(400).render('posts/edit',{title:'Postni tahrirlash',post,error:e.message||'Saqlanmadi.'})}});

router.post('/:id/archive',requireAuth,async(req,res)=>{const post=await ownPost(req);if(!post)return res.sendStatus(404);if((post.status||'published')==='published')await adjustPublishedCount(post.author,-1);post.status='archived';post.isHidden=true;post.isPinned=false;post.archivedAt=new Date();await post.save();res.redirect('/posts/archived')});
router.post('/:id/unarchive',requireAuth,async(req,res)=>{const post=await ownPost(req);if(!post||post.status!=='archived')return res.sendStatus(404);post.status='published';post.isHidden=false;post.archivedAt=null;await post.save();await adjustPublishedCount(post.author,1);res.redirect('/u/'+req.currentUser.username)});
router.post('/:id/publish',requireAuth,async(req,res)=>{const post=await ownPost(req);if(!post||post.status!=='draft')return res.sendStatus(404);if(!(post.media||[]).length&&!post.imageUrl)return res.status(400).render('posts/edit',{title:'Postni tahrirlash',post,error:'Postni chiqarish uchun kamida bitta media qo‘shing.'});post.status='published';post.isHidden=false;post.draftSavedAt=null;await post.save();await adjustPublishedCount(post.author,1);res.redirect('/p/'+post._id)});

router.post('/:id/delete',requireAuth,async(req,res)=>{const post=await ownPost(req);if(!post)return res.sendStatus(404);const wasPublished=(post.status||'published')==='published';await deleteMany(mediaKeys(post)).catch(()=>{});await Promise.all([PostLike.deleteMany({post:post._id}),SavedPost.deleteMany({post:post._id}),Comment.deleteMany({post:post._id}),PostView.deleteMany({post:post._id}),Post.findByIdAndDelete(post._id)]);if(wasPublished)await adjustPublishedCount(post.author,-1);res.redirect('/u/'+req.currentUser.username)});

module.exports=router;
