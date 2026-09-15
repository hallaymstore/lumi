const router=require('express').Router();
const crypto=require('crypto');
const User=require('../models/User');
const Post=require('../models/Post');
const Comment=require('../models/Comment');
const PostLike=require('../models/PostLike');
const SavedPost=require('../models/SavedPost');
const Follow=require('../models/Follow');
const UserRelation=require('../models/UserRelation');
const Message=require('../models/Message');
const Story=require('../models/Story');
const Notification=require('../models/Notification');
const FeedEvent=require('../models/FeedEvent');
const {requireAuth}=require('../middleware/auth');
const {uploadStream,deleteMany}=require('../services/r2');
const {resolveMentions}=require('../utils/mentions');
const {createNotification}=require('../services/notify');

const INTERESTS=[
  ['lifestyle','Lifestyle'],['beauty','Beauty'],['fashion','Moda'],['gaming','Gaming'],['tech','Texnologiya'],['education','Ta’lim'],['art','San’at'],['music','Musiqa'],['food','Taom'],['travel','Sayohat'],['fitness','Fitness'],['cars','Avto'],['humor','Humor']
].map(([key,label])=>({key,label}));
const INTEREST_KEYS=new Set(INTERESTS.map(x=>x.key));
const CREATOR_CATEGORIES=new Set(['','lifestyle','beauty','fashion','gaming','tech','education','art','music','food','travel','fitness','cars','humor','other']);
function nextSafe(v){const s=String(v||'/feed');return s.startsWith('/')&&!s.startsWith('//')?s:'/feed'}
function cleanTags(raw){return String(raw||'').split(/[ ,#]+/).map(x=>x.trim().toLowerCase()).filter(Boolean).slice(0,20)}
function selectedValues(v){return (Array.isArray(v)?v:[v]).map(x=>String(x||'').trim().toLowerCase()).filter(Boolean)}
function secret(){return process.env.SESSION_SECRET||'lumi-upload-token-secret-change-me'}
function signPayload(payload){const body=Buffer.from(JSON.stringify(payload)).toString('base64url');const sig=crypto.createHmac('sha256',secret()).update(body).digest('base64url');return `${body}.${sig}`}
function verifyPayload(token,userId){
  const [body,sig]=String(token||'').split('.');if(!body||!sig)throw new Error('Upload token noto‘g‘ri.');
  const expected=crypto.createHmac('sha256',secret()).update(body).digest();let got;try{got=Buffer.from(sig,'base64url')}catch{throw new Error('Upload token noto‘g‘ri.')}
  if(got.length!==expected.length||!crypto.timingSafeEqual(got,expected))throw new Error('Upload token tasdiqlanmadi.');
  let data;try{data=JSON.parse(Buffer.from(body,'base64url').toString('utf8'))}catch{throw new Error('Upload token buzilgan.')}
  if(String(data.uid)!==String(userId)||Number(data.exp||0)<Date.now())throw new Error('Upload token muddati tugagan.');
  if(!String(data.key||'').startsWith(`posts/${userId}/`))throw new Error('Upload token xavfsizlik tekshiruvidan o‘tmadi.');
  return data;
}

router.get('/onboarding/interests',requireAuth,async(req,res)=>{
  const me=await User.findById(req.currentUser._id).lean();
  res.render('onboarding/interests',{title:'Qiziqishlarni tanlang',options:INTERESTS,selected:me?.interests||[],next:nextSafe(req.query.next),error:null});
});
router.post('/onboarding/interests',requireAuth,async(req,res)=>{
  const interests=selectedValues(req.body.interests).filter(x=>INTEREST_KEYS.has(x)).slice(0,8);
  await User.findByIdAndUpdate(req.currentUser._id,{interests});
  res.redirect(nextSafe(req.body.next));
});

router.get('/trending',async(req,res)=>{
  const since=new Date(Date.now()-30*864e5);
  const [tags,posts,creators]=await Promise.all([
    Post.aggregate([{$match:{isHidden:false,createdAt:{$gte:since},tags:{$exists:true,$ne:[]}}},{$unwind:'$tags'},{$group:{_id:'$tags',posts:{$sum:1},score:{$sum:{$add:[1,{$multiply:[{$ifNull:['$likeCount',0]},3]},{$multiply:[{$ifNull:['$commentCount',0]},5]},{$multiply:[{$ifNull:['$saveCount',0]},7]},{$multiply:[{$ifNull:['$shareCount',0]},9]}]}}}},{$sort:{score:-1,posts:-1}},{$limit:30}]),
    Post.find({isHidden:false}).sort({qualityScore:-1,saveCount:-1,shareCount:-1,viewCount:-1,createdAt:-1}).limit(30).populate('author','name username avatarUrl isVerified creatorMode creatorCategory').lean(),
    User.find({isSuspended:false,$or:[{creatorMode:true},{role:'creator'}]}).sort({followerCount:-1,postCount:-1,createdAt:-1}).limit(18).lean()
  ]);
  res.set('Cache-Control','public, max-age=120, stale-while-revalidate=300');
  res.render('trending',{title:'Trendlar',tags,posts,creators,metaTitle:'Lumi trendlar',metaDescription:'Lumi’dagi trend hashtaglar, postlar va creatorlar.'});
});
router.get('/tags/:tag',async(req,res)=>{
  const tag=String(req.params.tag||'').replace(/^#/,'').toLowerCase().replace(/[^a-z0-9._-]/g,'').slice(0,40);if(!tag)return res.redirect('/trending');
  const posts=await Post.find({isHidden:false,tags:tag}).sort({qualityScore:-1,createdAt:-1}).limit(80).populate('author','name username avatarUrl isVerified creatorMode').lean();
  res.render('trending',{title:'#'+tag,tags:[{_id:tag,posts:posts.length,score:0}],posts,creators:[],activeTag:tag,metaTitle:`#${tag} · Lumi`,metaDescription:`Lumi’da #${tag} bo‘yicha postlar.`});
});

router.get('/settings/export',requireAuth,async(req,res)=>{
  const uid=req.currentUser._id;
  const [profile,posts,comments,likes,saves,follows,relations,messages,stories,notifications,activity,activityCount]=await Promise.all([
    User.findById(uid).select('-passwordHash').lean(),
    Post.find({author:uid}).sort({createdAt:1}).lean(),
    Comment.find({user:uid}).sort({createdAt:1}).lean(),
    PostLike.find({user:uid}).sort({createdAt:1}).lean(),
    SavedPost.find({user:uid}).sort({createdAt:1}).lean(),
    Follow.find({$or:[{follower:uid},{following:uid}]}).sort({createdAt:1}).lean(),
    UserRelation.find({owner:uid}).sort({createdAt:1}).lean(),
    Message.find({sender:uid}).sort({createdAt:1}).limit(20000).lean(),
    Story.find({author:uid}).sort({createdAt:1}).lean(),
    Notification.find({user:uid}).sort({createdAt:1}).limit(20000).lean(),
    FeedEvent.find({user:uid}).sort({createdAt:1}).limit(20000).lean(),
    FeedEvent.countDocuments({user:uid})
  ]);
  if(profile){delete profile.sessionVersion;delete profile.__v}
  const payload={service:'Lumi',generatedAt:new Date().toISOString(),profile,posts,comments,likes,saves,follows,relations,messages,stories,notifications,activity,activityMayBeTruncated:activityCount>activity.length};
  const name=`lumi-${String(req.currentUser.username||'user').replace(/[^a-z0-9._-]/gi,'_')}-export-${new Date().toISOString().slice(0,10)}.json`;
  res.set('Cache-Control','no-store');res.set('Content-Type','application/json; charset=utf-8');res.set('Content-Disposition',`attachment; filename="${name}"`);res.send(JSON.stringify(payload,null,2));
});

router.post('/api/uploads/stream',requireAuth,async(req,res)=>{
  let uploaded=null;
  try{
    const mime=String(req.get('content-type')||'').split(';')[0].toLowerCase();
    const allowed=/^(image\/(jpeg|png|webp|avif)|video\/(mp4|webm))$/.test(mime);if(!allowed)return res.status(415).json({ok:false,error:'Faqat JPG, PNG, WebP, AVIF, MP4 yoki WebM media qabul qilinadi.'});
    const size=Number(req.get('content-length')||0);const max=mime.startsWith('video/')?80*1024*1024:20*1024*1024;
    if(!size)return res.status(411).json({ok:false,error:'Fayl hajmi aniqlanmadi.'});if(size>max)return res.status(413).json({ok:false,error:`Fayl juda katta. Maksimum ${Math.round(max/1024/1024)} MB.`});
    uploaded=await uploadStream(req,`posts/${req.currentUser._id}`,mime,size);
    const payload={uid:String(req.currentUser._id),key:uploaded.key,url:uploaded.url,type:uploaded.type,size,exp:Date.now()+60*60*1000};
    res.json({ok:true,token:signPayload(payload),media:{url:uploaded.url,type:uploaded.type,size}});
  }catch(e){if(uploaded?.key)deleteMany([uploaded.key]).catch(()=>{});res.status(400).json({ok:false,error:e.message||'Media yuklanmadi.'})}
});

router.post('/posts/create-streamed',requireAuth,async(req,res)=>{
  let media=[];
  try{
    let tokens=[];try{tokens=JSON.parse(String(req.body.uploadTokens||'[]'))}catch{throw new Error('Upload ma’lumoti noto‘g‘ri.')}
    if(!Array.isArray(tokens)||tokens.length>10)throw new Error('Maksimum 10 ta media.');
    const verified=tokens.map(t=>verifyPayload(t,req.currentUser._id));
    media=verified.map(x=>({url:x.url,key:x.key,type:x.type,width:0,height:0,thumbUrl:'',thumbKey:''}));
    const intent=req.body.intent==='draft'?'draft':'publish';const caption=String(req.body.caption||'').trim().slice(0,2200);if(intent==='publish'&&!media.length)throw new Error('Post uchun kamida bitta media kerak.');if(intent==='draft'&&!caption&&!media.length)throw new Error('Qoralama uchun caption yoki media kiriting.');
    const tags=cleanTags(req.body.tags),mentionedUsers=await resolveMentions(caption);const isDraft=intent==='draft';
    const post=await Post.create({author:req.currentUser._id,caption,imageUrl:media[0]?.url||'',imageKey:media[0]?.key||'',media,tags,mentions:mentionedUsers.map(u=>u._id),status:isDraft?'draft':'published',isHidden:isDraft,draftSavedAt:isDraft?new Date():null,likeCount:0,commentCount:0});
    if(!isDraft){await User.findByIdAndUpdate(req.currentUser._id,{$inc:{postCount:1}}).catch(()=>{});await Promise.all(mentionedUsers.filter(u=>String(u._id)!==String(req.currentUser._id)).map(u=>createNotification({user:u._id,actor:req.currentUser._id,type:'mention',post:post._id,text:`@${req.currentUser.username} sizni postda belgiladi.`}).catch(()=>{})))}
    res.redirect(isDraft?'/posts/drafts':'/p/'+post._id);
  }catch(e){res.status(400).render('posts/create',{title:'Yangi post',error:e.message||'Post saqlanmadi.'})}
});

module.exports=router;
module.exports.INTERESTS=INTERESTS;
module.exports.CREATOR_CATEGORIES=[...CREATOR_CATEGORIES].filter(Boolean);
