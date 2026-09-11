require('dotenv').config();
const mongoose=require('mongoose');
const connectDB=require('../config/db');
const User=require('../models/User');
const Post=require('../models/Post');
const Story=require('../models/Story');
const PostLike=require('../models/PostLike');
const SavedPost=require('../models/SavedPost');
const Follow=require('../models/Follow');
const Comment=require('../models/Comment');
const CommentLike=require('../models/CommentLike');
const StoryLike=require('../models/StoryLike');
const StoryView=require('../models/StoryView');
const {recalcQuality}=require('../services/feed');

async function bulkSafe(Model,docs){if(!docs.length)return;try{await Model.insertMany(docs,{ordered:false})}catch(e){if(!e?.writeErrors&&!String(e?.message||'').includes('duplicate'))throw e}}
async function dropLegacyStoryTtl(){const indexes=await Story.collection.indexes().catch(()=>[]);for(const i of indexes){if(i.expireAfterSeconds!=null){console.log('Dropping legacy Story TTL index:',i.name);await Story.collection.dropIndex(i.name).catch(()=>{})}}}
(async()=>{try{
  await connectDB();await dropLegacyStoryTtl();
  console.log('Migrating legacy follows/saves...');
  const users=await User.find({}).select('_id following followers savedPosts followerCount followingCount postCount').lean();
  for(const u of users){
    await bulkSafe(Follow,(u.following||[]).map(id=>({follower:u._id,following:id,status:'accepted'})));
    await bulkSafe(SavedPost,(u.savedPosts||[]).map(id=>({user:u._id,post:id})));
  }
  console.log('Migrating posts, likes and comments...');
  const posts=await Post.find({}).lean();
  for(const p of posts){
    if((!p.media||!p.media.length)&&p.imageUrl)await Post.updateOne({_id:p._id},{$set:{media:[{url:p.imageUrl,key:p.imageKey||'',type:'image'}]}});
    await bulkSafe(PostLike,(p.likes||[]).map(uid=>({post:p._id,user:uid})));
    const commentDocs=[],commentLikeDocs=[];
    for(const c of p.comments||[]){
      commentDocs.push({_id:c._id,post:p._id,user:c.user,text:c.text,parent:c.replyToComment||null,replyToUser:c.replyToUser||null,likeCount:(c.likes||[]).length,isPinned:false,isHidden:false,createdAt:c.createdAt||p.createdAt,updatedAt:c.updatedAt||c.createdAt||p.createdAt});
      for(const uid of c.likes||[])commentLikeDocs.push({comment:c._id,user:uid,createdAt:c.updatedAt||c.createdAt||p.createdAt,updatedAt:c.updatedAt||c.createdAt||p.createdAt});
    }
    await bulkSafe(Comment,commentDocs);await bulkSafe(CommentLike,commentLikeDocs);
    await Post.updateOne({_id:p._id},{$set:{likeCount:Math.max(Number(p.likeCount||0),(p.likes||[]).length),commentCount:Math.max(Number(p.commentCount||0),(p.comments||[]).length)}});
    await recalcQuality(p._id).catch(()=>{});
  }
  console.log('Migrating story views/likes...');
  const stories=await Story.find({}).lean();
  for(const s of stories){
    await bulkSafe(StoryLike,(s.likes||[]).map(uid=>({story:s._id,user:uid})));
    await bulkSafe(StoryView,(s.viewers||[]).filter(v=>v.user).map(v=>({story:s._id,user:v.user,createdAt:v.viewedAt||s.createdAt,updatedAt:v.viewedAt||s.createdAt})));
    await Story.updateOne({_id:s._id},{$set:{likeCount:Math.max(Number(s.likeCount||0),(s.likes||[]).length),viewCount:Math.max(Number(s.viewCount||0),(s.viewers||[]).length),archivedAt:s.archivedAt||(new Date(s.expiresAt)<=new Date()?s.expiresAt:null)}});
  }
  console.log('Recounting user counters...');
  for(const u of users){const [followers,following,postCount]=await Promise.all([Follow.countDocuments({following:u._id,status:'accepted'}),Follow.countDocuments({follower:u._id,status:'accepted'}),Post.countDocuments({author:u._id})]);await User.updateOne({_id:u._id},{$set:{followerCount:followers,followingCount:following,postCount}})}
  console.log('v1.6 migration completed.');
}catch(e){console.error('Migration failed:',e);process.exitCode=1}finally{await mongoose.disconnect().catch(()=>{})}})();
