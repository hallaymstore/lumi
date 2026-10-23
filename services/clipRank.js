'use strict';
const {engagementQuality,freshness}=require('./clipScoreBasics');
function id(v){return String(v?._id||v||'')}
function clipScore(post,signals={},now=Date.now(),nonce=0){
 const aid=id(post.author),pid=id(post._id);
 const hours=Math.max(0,(now-new Date(post.createdAt||now).getTime())/36e5);
 const quality=engagementQuality(post);
 const young=freshness(hours);
 const following=signals.following?.has(aid)?9:0;
 const author=Math.max(-22,Math.min(32,(signals.authorAffinity?.get(aid)||0)*.7));
 let tags=0;
 for(const t of post.tags||[])tags+=(signals.tagAffinity?.get(String(t).toLowerCase())||0);
 tags=Math.max(-12,Math.min(19,tags*.48));
 const seen=signals.seen?.get(pid);
 const since=seen?(now-new Date(seen.at).getTime())/36e5:Infinity;
 const repeatPenalty=since<1?32:since<24?20:since<72?12:since<168?5:0;
 const likedPenalty=signals.liked?.has(pid)?7:0;
 const organic=post.author?.accountOrigin==='synthetic'?-8:0;
 const hash=Number.parseInt(pid.slice(-5),16)||0;
 const variety=((hash+(Number(nonce)||0))%29)/29*3;
 return quality+young+following+author+tags-repeatPenalty-likedPenalty+organic+variety;
}
function rankClips(rows,signals={},opts={}){
 const now=opts.now||Date.now(),exclude=new Set((opts.exclude||[]).map(id)),uid=id(opts.userId),lim=Math.min(24,Math.max(1,opts.limit||8));
 const candidates=[];
 for(const p of rows){
  const pid=id(p._id),aid=id(p.author);
  if(!pid||!p.author||exclude.has(pid)||p.author.isSuspended||signals.blocked?.has(aid)||signals.muted?.has(aid)||signals.hiddenAuthors?.has(aid)||signals.hiddenPosts?.has(pid))continue;
  if(p.author.isPrivate&&aid!==uid&&!signals.following?.has(aid))continue;
  candidates.push({post:p,score:clipScore(p,signals,now,opts.nonce||0)});
 }
 candidates.sort((a,b)=>b.score-a.score||new Date(b.post.createdAt)-new Date(a.post.createdAt));
 const out=[],deferred=[];
 for(const x of candidates){
  const aid=id(x.post.author),recent=out.slice(-3).some(p=>id(p.author)===aid);
  if(recent){deferred.push(x.post);continue}
  out.push(x.post);if(out.length===lim)break;
 }
 for(const p of deferred)if(out.length<lim)out.push(p);
 return out;
}
module.exports={clipScore,rankClips};
