const mongoose=require('mongoose');
const Post=require('../models/Post');
const Follow=require('../models/Follow');
const FeedEvent=require('../models/FeedEvent');
const UserRelation=require('../models/UserRelation');
const PostLike=require('../models/PostLike');
const SavedPost=require('../models/SavedPost');
const {linkifyMentions}=require('../utils/mentions');

// Explicit actions are intentionally much stronger than passive impressions.
const W={impression:-0.08,view:0.35,dwell:0.018,like:4.5,unlike:-3.5,comment:6.5,save:8,unsave:-5,share:9,open_comments:2.4,profile_visit:3.2,not_interested:-30,hide_author:-60};
function uniqById(rows){const m=new Map();for(const p of rows||[]){if(p?._id)m.set(String(p._id),p)}return [...m.values()]}
function ageHours(d){return Math.max(0,(Date.now()-new Date(d).getTime())/36e5)}
function engagementQuality(p){
  const l=Math.max(Number(p.likeCount||0),p.likes?.length||0),c=Math.max(Number(p.commentCount||0),p.comments?.length||0),s=Number(p.saveCount||0),sh=Number(p.shareCount||0),v=Math.max(1,Number(p.viewCount||0));
  const weighted=l*3+c*5+s*7+sh*9;
  const rate=Math.min(4,weighted/Math.max(25,v));
  return Math.log1p(weighted+Math.sqrt(v))*1.15+rate*1.8;
}
function freshness(hours){return 8*Math.exp(-hours/48)+2.5*Math.exp(-hours/(24*21))+0.8*Math.exp(-hours/(24*120))}
function seededNoise(id,nonce){let h=2166136261;for(const ch of String(id)+String(nonce)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return ((h>>>0)%10000)/10000}

async function userSignals(userId){
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
    const dwellMultiplier=e.type==='dwell'?Math.min(90,Math.max(0,Number(e.value)||0)):1;
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

async function hydrateAuthors(mixed){
  const missing=mixed.filter(p=>!p.author||typeof p.author==='string'||p.author instanceof mongoose.Types.ObjectId).map(p=>p._id);
  if(!missing.length)return mixed;
  const filled=await Post.find({_id:{$in:missing}}).populate('author','name username avatarUrl isVerified followerCount isPrivate').lean();
  const fm=new Map(filled.map(x=>[String(x._id),x]));
  return mixed.map(x=>fm.get(String(x._id))||x);
}

async function candidatePools(me,mode='foryou',sig=null){
  const base={isHidden:false},now=Date.now();sig=sig||await userSignals(me?._id);
  if(mode==='new')return Post.find(base).sort({createdAt:-1}).limit(220).populate('author','name username avatarUrl isVerified followerCount isPrivate').lean();
  if(mode==='following'&&me){if(!sig.following.size)return [];return Post.find({...base,author:{$in:[...sig.following]}}).sort({createdAt:-1}).limit(260).populate('author','name username avatarUrl isVerified followerCount isPrivate').lean()}

  const recentCut=new Date(now-14*864e5),trendCut=new Date(now-90*864e5),followingIds=me?[...sig.following]:[];
  const jobs=[
    // Fresh pool: gives new creators a chance.
    Post.find({...base,createdAt:{$gte:recentCut}}).sort({createdAt:-1}).limit(130).populate('author','name username avatarUrl isVerified followerCount isPrivate').lean(),
    // Trending pool: engagement quality from the last ~3 months.
    Post.find({...base,createdAt:{$gte:trendCut}}).sort({qualityScore:-1,saveCount:-1,shareCount:-1,viewCount:-1}).limit(150).populate('author','name username avatarUrl isVerified followerCount isPrivate').lean(),
    // Evergreen pool: intentionally all-time so Feed is not just “last posts”.
    Post.find(base).sort({qualityScore:-1,saveCount:-1,shareCount:-1,viewCount:-1}).limit(130).populate('author','name username avatarUrl isVerified followerCount isPrivate').lean(),
    // Discovery pool: random all-time sample lets older/low-exposure content resurface.
    Post.aggregate([{$match:base},{$sample:{size:130}}])
  ];
  if(followingIds.length)jobs.push(Post.find({...base,author:{$in:followingIds}}).sort({createdAt:-1}).limit(120).populate('author','name username avatarUrl isVerified followerCount isPrivate').lean());
  const rows=await Promise.all(jobs);return hydrateAuthors(uniqById(rows.flat()));
}

async function buildFeed(me,{mode='foryou',limit=50,nonce=Date.now()}={}){
  const sig=await userSignals(me?._id),candidates=await candidatePools(me,mode,sig),uid=me?._id?String(me._id):'';
  const scored=[];
  for(const p of candidates){
    if(!p.author)continue;const aid=String(p.author._id||p.author),pid=String(p._id);
    if(sig.blocked.has(aid)||sig.muted.has(aid)||sig.hiddenAuthors.has(aid)||sig.hiddenPosts.has(pid))continue;
    if(p.author.isPrivate&&aid!==uid&&!sig.following.has(aid))continue;
    const h=ageHours(p.createdAt);let score=engagementQuality(p)+freshness(h)+seededNoise(p._id,nonce)*3.6;
    // Evergreen quality bonus: old high-value posts can still rank, but not dominate.
    if(h>24*30)score+=Math.min(5,Math.max(0,Number(p.qualityScore||0))/15);
    if(mode==='foryou'&&me){
      if(sig.following.has(aid))score+=8.5;if(aid===uid)score-=3;
      score+=Math.max(-14,Math.min(20,(sig.authorAffinity.get(aid)||0)*.45));
      let tag=0;for(const raw of p.tags||[]){const t=String(raw||'').toLowerCase();tag+=sig.tagAffinity.get(t)||0}score+=Math.max(-9,Math.min(14,tag*.27));
      const seen=sig.seen.get(pid);if(seen){const days=(Date.now()-new Date(seen.at).getTime())/864e5;if(days<.15)score-=18;else if(days<1)score-=12;else if(days<3)score-=7;else if(days<7)score-=3}
      if(sig.liked.has(pid))score-=2.5;if(sig.saved.has(pid))score-=1;
    }
    scored.push({...p,_feedScore:score,captionHtml:linkifyMentions(p.caption||''),likeCount:Math.max(Number(p.likeCount||0),p.likes?.length||0),commentCount:Math.max(Number(p.commentCount||0),p.comments?.length||0)});
  }
  if(mode==='new')scored.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));else scored.sort((a,b)=>b._feedScore-a._feedScore);
  // Creator diversity: no same author twice inside a rolling four-post window at the top.
  const out=[],authorWindow=[],deferred=[];
  for(const p of scored){const aid=String(p.author._id||p.author),recentSame=authorWindow.slice(-4).filter(x=>x===aid).length;if(recentSame>=1&&out.length<Math.min(30,limit)){deferred.push(p);continue}out.push(p);authorWindow.push(aid);if(out.length>=limit)break}
  if(out.length<limit){for(const p of [...deferred,...scored]){if(!out.some(x=>String(x._id)===String(p._id))){out.push(p);if(out.length>=limit)break}}}
  return out;
}
async function recordEvent({user=null,guestKey='',post,type,value=1}){if(!post||!type)return;const p=await Post.findById(post).select('author tags').lean().catch(()=>null);if(!p)return;return FeedEvent.create({user:user||null,guestKey:guestKey||'',post:p._id,author:p.author,type,value:Number(value)||1,tags:p.tags||[]}).catch(()=>null)}
async function recalcQuality(postId){const p=await Post.findById(postId).select('likeCount commentCount saveCount shareCount viewCount createdAt');if(!p)return;const h=ageHours(p.createdAt);p.qualityScore=engagementQuality(p)*4+Math.log1p(p.viewCount||0)-Math.log1p(h/24+1);await p.save()}
module.exports={buildFeed,recordEvent,recalcQuality,userSignals};
