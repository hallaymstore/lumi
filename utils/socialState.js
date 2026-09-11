const PostLike=require('../models/PostLike');
const SavedPost=require('../models/SavedPost');
const Follow=require('../models/Follow');

async function decoratePosts(posts,userId){
  const rows=posts||[];if(!rows.length)return rows;
  const ids=rows.map(p=>p._id);
  let liked=new Set(),saved=new Set();
  if(userId){const [l,s]=await Promise.all([PostLike.find({user:userId,post:{$in:ids}}).select('post').lean(),SavedPost.find({user:userId,post:{$in:ids}}).select('post').lean()]);liked=new Set(l.map(x=>String(x.post)));saved=new Set(s.map(x=>String(x.post)))}
  const uid=userId?String(userId):'';
  return rows.map(p=>{const legacyLiked=uid&&(p.likes||[]).some(x=>String(x._id||x)===uid);return {...p,likeCount:Math.max(Number(p.likeCount||0),p.likes?.length||0),commentCount:Math.max(Number(p.commentCount||0),p.comments?.length||0),likedByMe:liked.has(String(p._id))||legacyLiked,savedByMe:saved.has(String(p._id)),primaryMedia:(p.media&&p.media[0])||{url:p.imageUrl,type:'image'}}});
}
async function filterVisiblePosts(posts,userId){
  const rows=(posts||[]).filter(p=>p&&p.author);if(!rows.length)return rows;
  const uid=userId?String(userId):'';
  const privateAuthors=[...new Set(rows.filter(p=>p.author?.isPrivate&&String(p.author._id||p.author)!==uid).map(p=>String(p.author._id||p.author)))];
  let allowed=new Set();
  if(userId&&privateAuthors.length){const follows=await Follow.find({follower:userId,following:{$in:privateAuthors},status:'accepted'}).select('following').lean();allowed=new Set(follows.map(x=>String(x.following)))}
  return rows.filter(p=>{const a=p.author;if(!a?.isPrivate)return true;const aid=String(a._id||a);return aid===uid||allowed.has(aid)});
}
async function isFollowing(follower,following){if(!follower||!following)return false;const row=await Follow.findOne({follower,following,status:'accepted'}).select('_id').lean();return !!row}
async function followCounts(userId,legacy={}){const [followers,following]=await Promise.all([Follow.countDocuments({following:userId,status:'accepted'}),Follow.countDocuments({follower:userId,status:'accepted'})]);return {followers:Math.max(followers,Number(legacy.followerCount||legacy.followers?.length||0)),following:Math.max(following,Number(legacy.followingCount||legacy.following?.length||0))}}
module.exports={decoratePosts,filterVisiblePosts,isFollowing,followCounts};
