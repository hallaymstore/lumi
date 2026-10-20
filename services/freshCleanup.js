// Reliable bounded cleanup, without Mongo TTL on media-bearing records.
// Records stay in MongoDB until their Cloudflare R2 assets have been deleted.
const Post=require('../models/Post');
const PostLike=require('../models/PostLike');
const SavedPost=require('../models/SavedPost');
const Comment=require('../models/Comment');
const CommentLike=require('../models/CommentLike');
const PostView=require('../models/PostView');
const FeedEvent=require('../models/FeedEvent');
const Message=require('../models/Message');
const Conversation=require('../models/Conversation');
const Notification=require('../models/Notification');
const User=require('../models/User');
const Story=require('../models/Story');
const StoryLike=require('../models/StoryLike');
const StoryView=require('../models/StoryView');
const {deleteMany}=require('./r2');

const BATCH=Math.max(1,Math.min(1000,Number(process.env.FRESH_CLEANUP_BATCH||120)));
const CONCURRENCY=Math.max(1,Math.min(12,Number(process.env.FRESH_CLEANUP_CONCURRENCY||6)));
const LEASE_MS=10*60*1000;
let running=false;

function claimFilter(now){return {$or:[{cleanupLeaseUntil:null},{cleanupLeaseUntil:{$lte:now}}]}}
async function claim(Model,now){
  return Model.findOneAndUpdate(
    {expiresAt:{$ne:null,$lte:now},...claimFilter(now)},
    {$set:{cleanupLeaseUntil:new Date(now.getTime()+LEASE_MS)}},
    {sort:{expiresAt:1},new:true}
  );
}
function keysOfPost(p){return [...new Set([p.imageKey,...(p.media||[]).flatMap(m=>[m.key,m.thumbKey])].filter(Boolean))]}
async function deleteComments(postId){
  // Iterate to avoid loading thousands of comment IDs into the Node heap.
  while(true){
    const comments=await Comment.find({post:postId}).select('_id').limit(250).lean();
    if(!comments.length)break;
    const ids=comments.map(c=>c._id);
    await CommentLike.deleteMany({comment:{$in:ids}});
    await Comment.deleteMany({_id:{$in:ids}});
  }
}
async function removePost(p){
  await deleteMany(keysOfPost(p)); // Failure throws. Mongo record is retained and retried.
  await deleteComments(p._id);
  await Promise.all([
    PostLike.deleteMany({post:p._id}),
    SavedPost.deleteMany({post:p._id}),
    PostView.deleteMany({post:p._id}),
    FeedEvent.deleteMany({post:p._id}),
    Notification.deleteMany({post:p._id}),
    Message.updateMany({post:p._id},{$set:{post:null}}),
    User.updateMany({savedPosts:p._id},{$pull:{savedPosts:p._id}})
  ]);
  const removed=await Post.deleteOne({_id:p._id,expiresAt:{$lte:new Date()}});
  if(removed.deletedCount&&p.status==='published'){
    await User.updateOne({_id:p.author,postCount:{$gt:0}},{$inc:{postCount:-1}});
  }
}
async function drain(Model,handle,label){
  let claims=0,removed=0;
  await Promise.all(Array.from({length:Math.min(CONCURRENCY,BATCH)},async()=>{
    while(claims<BATCH){
      claims++;
      let item;
      try{item=await claim(Model,new Date())}catch(e){console.error(label+' claim:',e.message);break}
      if(!item)break;
      try{await handle(item);removed++}
      catch(e){
        console.error(label+':',String(item._id),e.message);
        // Avoid one failing object starving all others; retry later.
        await Model.updateOne({_id:item._id},{$set:{cleanupLeaseUntil:new Date(Date.now()+LEASE_MS)}}).catch(()=>{});
      }
    }
  }));
  return removed;
}
async function cleanupExpiredPosts(){return drain(Post,removePost,'Fresh post cleanup')}
async function removeMessage(m){
  await deleteMany([m.mediaKey]); // No message deletion if R2 fails
  await Conversation.updateMany({pinnedMessage:m._id},{$set:{pinnedMessage:null}});
  await Message.deleteOne({_id:m._id,expiresAt:{$lte:new Date()}});
  // Prevent an old message preview from living longer than the message itself.
  const c=await Conversation.findOne({_id:m.conversation,lastMessageAt:{$lte:m.createdAt}});
  if(c){
    const latest=await Message.findOne({conversation:m.conversation}).sort({createdAt:-1}).select('text mediaType sender createdAt deletedForEveryoneAt');
    await Conversation.updateOne({_id:m.conversation,lastMessageAt:{$lte:m.createdAt}},{$set:{
      lastMessageText:latest?(latest.deletedForEveryoneAt?'':latest.mediaType?'📎 Media':String(latest.text||'').slice(0,180)):'',
      lastMessageAt:latest?.createdAt||c.createdAt,
      lastSender:latest?.sender||null
    }});
  }
}
async function cleanupExpiredMessages(){
  const removed=await drain(Message,removeMessage,'Fresh message cleanup');
  // Chat notifications must not preserve the deleted message preview indefinitely.
  await Notification.deleteMany({type:'message',createdAt:{$lt:new Date(Date.now()-48*60*60*1000)}});
  return removed;
}
async function cleanupExpiredStories(){
  if(process.env.FRESH_STORY_PURGE_ENABLED!=='true')return 0;
  const days=Math.max(1,Number(process.env.FRESH_STORY_PURGE_DAYS||7));
  const cutoff=new Date(Date.now()-days*864e5);
  const stories=await Story.find({expiresAt:{$lte:cutoff},isHighlight:false}).limit(Math.min(40,BATCH));
  let removed=0;
  for(const s of stories){
    try{
      await deleteMany([s.mediaKey,s.thumbKey,s.musicKey]);
      await Promise.all([StoryLike.deleteMany({story:s._id}),StoryView.deleteMany({story:s._id}),Notification.deleteMany({story:s._id}),Message.updateMany({story:s._id},{$set:{story:null,storyPreviewUrl:'',storyPreviewCaption:''}})]);
      await Story.deleteOne({_id:s._id});removed++;
    }catch(e){console.error('Fresh story cleanup:',String(s._id),e.message);break}
  }
  return removed;
}
async function cleanupFresh(){
  if(running)return null;
  running=true;
  try{
    const posts=await cleanupExpiredPosts();
    const messages=await cleanupExpiredMessages();
    const stories=await cleanupExpiredStories();
    if(posts||messages||stories)console.log('Lumi Fresh cleanup:',{posts,messages,stories});
    return {posts,messages,stories};
  }finally{running=false}
}
function startFreshCleanup(){
  // Keep running even if the feature flag is later disabled: already stamped
  // expirations still require R2 + Mongo cleanup.
  // An expired record is hidden from reads immediately; worker removes R2 + DB in batches.
  cleanupFresh().catch(e=>console.error('Lumi Fresh cleanup:',e.message));
  const mins=Math.max(1,Number(process.env.FRESH_CLEANUP_MINUTES||1));
  const timer=setInterval(()=>cleanupFresh().catch(e=>console.error('Lumi Fresh cleanup:',e.message)),mins*60*1000);
  timer.unref?.();
}
module.exports={cleanupFresh,startFreshCleanup,cleanupExpiredPosts,cleanupExpiredMessages,cleanupExpiredStories};
