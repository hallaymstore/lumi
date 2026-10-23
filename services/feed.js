const mongoose=require('mongoose');
const Post=require('../models/Post');const {publishedQuery}=require('./freshPosts');
const Follow=require('../models/Follow');
const FeedEvent=require('../models/FeedEvent');
const UserRelation=require('../models/UserRelation');
const PostLike=require('../models/PostLike');
const SavedPost=require('../models/SavedPost');
const {linkifyMentions}=require('../utils/mentions');

const {W,scorePost,arrange,engagementQuality,ageHours}=require('./feedRank');
const AUTHOR_FIELDS='name username avatarUrl isVerified followerCount isPrivate isSuspended accountOrigin proExpiresAt';
function uniqById(rows){const m=new Map();for(const p of rows||[]){if(p?._id)m.set(String(p._id),p)}return [...m.values()]}

// Per-user signal cache (45 s). Feed pages and /api/clips/next call userSignals() repeatedly; without a cache every
// swipe would re-read thousands of events. Explicit "not interested"/"hide" actions invalidate immediately.
const SIGNAL_TTL=45_000,SIGNAL_MAX=800,signalCache=new Map();
function invalidateSignals(userId){if(userId)signalCache.delete(String(userId))}

async function loadSignals(userId){
  if(!userId)return {following:new Set(),authorAffinity:new Map(),tagAffinity:new Map(),seen:new Map(),blocked:new Set(),muted:new Set(),liked:new Set(),saved:new Set(),hiddenPosts:new Set(),hiddenAuthors:new Set()};
  const uid=String(userId),since=new Date(Date.now()-90*24*36e5);
  const [follows,events,rels,likes,saves]=await Promise.all([
    Follow.find({follower:userId,status:'accepted'}).select('following').lean(),
    FeedEvent.find({user:userId,createdAt:{$gte:since}}).sort({createdAt:-1}).limit(3500).lean(),
    UserRelation.find({$or:[{owner:userId},{target:userId}],type:{$in:['block','mute']}}).lean(),
    PostLike.find({user:userId}).sort({createdAt:-1}).limit(3500).select('post').lean(),
    SavedPost.find({user:userId}).sort({createdAt:-1}).limit(3500).select('post').lean()
  ]);
  const following=new Set(follows.map(x=>String(x.following))),authorAffinity=new Map(),tagAffinity=new Map(),seen=new Map(),hiddenPosts=new Set(),hiddenAuthors=new Set();
  for(const e of events){
    const days=(Date.now()-new Date(e.createdAt).getTime())/864e5,decay=Math.exp(-days/45);
    const dwellMultiplier=['dwell','clip_watch'].includes(e.type)?Math.min(90,Math.max(0,Number(e.value)||0)):1;
    const score=(W[e.type]||0)*dwellMultiplier*decay;
    if(e.author)authorAffinity.set(String(e.author),(authorAffinity.get(String(e.author))||0)+score);
    for(const raw of e.tags||[]){const t=String(raw||'').toLowerCase();if(t)tagAffinity.set(t,(tagAffinity.get(t)||0)+score*.4)}
    if(e.post&&!seen.has(String(e.post)))seen.set(String(e.post),{type:e.type,at:e.createdAt,score});
    if(e.type==='not_interested'&&e.post)hiddenPosts.add(String(e.post));
    if(e.type==='hide_author'&&e.author)hiddenAuthors.add(String(e.author));
  }
  const blocked=new Set(),muted=new Set();
  for(const r of rels){
    if(r.type==='block')blocked.add(String(String(r.owner)===uid?r.target:r.owner));
    else if(r.type==='mute'&&String(r.owner)===uid)muted.add(String(r.target));
  }
  return {following,authorAffinity,tagAffinity,seen,blocked,muted,liked:new Set(likes.map(x=>String(x.post))),saved:new Set(saves.map(x=>String(x.post))),hiddenPosts,hiddenAuthors};
}

async function userSignals(userId){
  if(!userId)return loadSignals(userId);
  const key=String(userId),hit=signalCache.get(key);
  if(hit&&Date.now()-hit.at<SIGNAL_TTL)return hit.value;
  const value=await loadSignals(userId);
  signalCache.set(key,{at:Date.now(),value});
  if(signalCache.size>SIGNAL_MAX){const oldest=signalCache.keys().next().value;signalCache.delete(oldest)}
  return value;
}

async function hydrateAuthors(mixed){
  const missing=mixed.filter(p=>!p.author||typeof p.author==='string'||p.author instanceof mongoose.Types.ObjectId).map(p=>p._id);
  if(!missing.length)return mixed;
  const filled=await Post.find({_id:{$in:missing}}).populate('author',AUTHOR_FIELDS).lean();
  const fm=new Map(filled.map(x=>[String(x._id),x]));
  return mixed.map(x=>fm.get(String(x._id))||x);
}

async function candidatePools(me,mode='foryou',sig=null){
  const base=publishedQuery(),now=Date.now();sig=sig||await userSignals(me?._id);
  if(mode==='new')return Post.find(base).sort({createdAt:-1}).limit(220).populate('author',AUTHOR_FIELDS).lean();
  if(mode==='following'&&me){if(!sig.following.size)return [];return Post.find({...base,author:{$in:[...sig.following]}}).sort({createdAt:-1}).limit(260).populate('author',AUTHOR_FIELDS).lean()}

  const recentCut=new Date(now-14*864e5),trendCut=new Date(now-90*864e5),followingIds=me?[...sig.following]:[];
  const jobs=[
    // Fresh pool: gives new creators a chance.
    Post.find({...base,createdAt:{$gte:recentCut}}).sort({createdAt:-1}).limit(130).populate('author',AUTHOR_FIELDS).lean(),
    // Trending pool: engagement quality from the last ~3 months.
    Post.find({...base,createdAt:{$gte:trendCut}}).sort({qualityScore:-1,saveCount:-1,shareCount:-1,viewCount:-1}).limit(150).populate('author',AUTHOR_FIELDS).lean(),
    // Evergreen pool: intentionally all-time so Feed is not just “last posts”.
    Post.find(base).sort({qualityScore:-1,saveCount:-1,shareCount:-1,viewCount:-1}).limit(130).populate('author',AUTHOR_FIELDS).lean(),
    // Discovery pool: random all-time sample lets older/low-exposure content resurface.
    Post.aggregate([{$match:base},{$sample:{size:130}}])
  ];
  if(followingIds.length)jobs.push(Post.find({...base,author:{$in:followingIds}}).sort({createdAt:-1}).limit(120).populate('author',AUTHOR_FIELDS).lean());
  const rows=await Promise.all(jobs);return hydrateAuthors(uniqById(rows.flat()));
}

function shapePost(p){return {...p,captionHtml:linkifyMentions(p.caption||''),likeCount:Math.max(Number(p.likeCount||0),p.likes?.length||0),commentCount:Math.max(Number(p.commentCount||0),p.comments?.length||0)}}
function visibleTo(p,sig,uid){
  if(!p?.author)return false;
  const aid=String(p.author._id||p.author),pid=String(p._id);
  if(p.author.isSuspended)return false;
  if(sig.blocked.has(aid)||sig.muted.has(aid)||sig.hiddenAuthors.has(aid)||sig.hiddenPosts.has(pid))return false;
  if(p.author.isPrivate&&aid!==uid&&!sig.following.has(aid))return false;
  return true;
}
async function buildFeed(me,{mode='foryou',limit=50,nonce=Date.now(),interests=[]}={}){
  const interestSet=new Set((interests||[]).map(x=>String(x).toLowerCase()).filter(Boolean));
  const sig=await userSignals(me?._id),candidates=await candidatePools(me,mode,sig),uid=me?._id?String(me._id):'',now=Date.now();
  const scored=[];
  for(const p of candidates){
    if(!visibleTo(p,sig,uid))continue;
    let score=scorePost(p,sig,{mode,uid,nonce,now,personalised:!!me});
    // Explicit onboarding interests give the cold-start feed a useful signal before behavioural events exist.
    if(mode==='foryou'&&interestSet.size){const m=(p.tags||[]).filter(t=>interestSet.has(String(t).toLowerCase())).length;score+=Math.min(14,m*7)}
    scored.push({...shapePost(p),_feedScore:score});
  }
  if(mode==='new')scored.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));else scored.sort((a,b)=>b._feedScore-a._feedScore);
  if(mode==='new')return scored.slice(0,limit);
  return arrange(scored,{limit,sig,mode,now});
}
/** Re-load ranked ids for a later feed page. Order of `ids` is preserved; anything that became invisible is dropped. */
async function hydrateFeedPosts(me,ids){
  const clean=[...new Set((ids||[]).map(String).filter(x=>/^[a-f0-9]{24}$/i.test(x)))];
  if(!clean.length)return [];
  const [rows,sig]=await Promise.all([Post.find(publishedQuery({_id:{$in:clean}})).populate('author',AUTHOR_FIELDS).lean(),userSignals(me?._id)]);
  const byId=new Map(rows.map(p=>[String(p._id),p])),uid=me?._id?String(me._id):'';
  return clean.map(x=>byId.get(x)).filter(p=>visibleTo(p,sig,uid)).map(shapePost);
}
async function recordEvent({user=null,guestKey='',post,type,value=1}){if(!post||!type)return;if(user&&(type==='not_interested'||type==='hide_author'))invalidateSignals(user);const p=await Post.findById(post).select('author tags').lean().catch(()=>null);if(!p)return;return FeedEvent.create({user:user||null,guestKey:guestKey||'',post:p._id,author:p.author,type,value:Number(value)||1,tags:p.tags||[]}).catch(()=>null)}
async function recalcQuality(postId){const p=await Post.findById(postId).select('likeCount commentCount saveCount shareCount viewCount createdAt');if(!p)return;const h=ageHours(p.createdAt);p.qualityScore=engagementQuality(p)*4+Math.log1p(p.viewCount||0)-Math.log1p(h/24+1);await p.save()}
module.exports={buildFeed,hydrateFeedPosts,recordEvent,recalcQuality,userSignals,invalidateSignals,visibleTo};
