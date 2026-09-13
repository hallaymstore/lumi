const User=require('../models/User');
const Post=require('../models/Post');
const PostLike=require('../models/PostLike');
const PostView=require('../models/PostView');
const Comment=require('../models/Comment');
const CommentLike=require('../models/CommentLike');
const SavedPost=require('../models/SavedPost');
const Story=require('../models/Story');
const StoryLike=require('../models/StoryLike');
const StoryView=require('../models/StoryView');
const Follow=require('../models/Follow');
const UserRelation=require('../models/UserRelation');
const Conversation=require('../models/Conversation');
const Message=require('../models/Message');
const Notification=require('../models/Notification');
const FeedEvent=require('../models/FeedEvent');
const LoginSession=require('../models/LoginSession');
const PushSubscription=require('../models/PushSubscription');
const Report=require('../models/Report');
const OtpCode=require('../models/OtpCode');
const AdEvent=require('../models/AdEvent');
const NetworkAdEvent=require('../models/NetworkAdEvent');
const AdCampaign=require('../models/AdCampaign');
const AdConfig=require('../models/AdConfig');
const AdminLog=require('../models/AdminLog');
const {deleteMany}=require('./r2');

const ids=rows=>(rows||[]).map(x=>x._id).filter(Boolean);
const unique=rows=>[...new Set((rows||[]).map(x=>String(x)).filter(Boolean))];
function keyFromPublicUrl(url){
  const base=String(process.env.R2_PUBLIC_URL||'').replace(/\/$/,'');
  const value=String(url||'');
  if(!base||!value.startsWith(base+'/'))return '';
  try{return decodeURIComponent(value.slice(base.length+1).split('?')[0])}catch{return value.slice(base.length+1).split('?')[0]}
}

async function deleteUserAccount(userId){
  const user=await User.findById(userId).lean();
  if(!user)throw new Error('Akkaunt topilmadi.');

  const [posts,stories,conversations,followRows,ownPostLikes,ownSaves,ownComments]=await Promise.all([
    Post.find({author:userId}).select('_id imageKey media').lean(),
    Story.find({author:userId}).select('_id mediaKey thumbKey musicKey').lean(),
    Conversation.find({participants:userId}).select('_id').lean(),
    Follow.find({$or:[{follower:userId},{following:userId}],status:'accepted'}).select('follower following').lean(),
    PostLike.find({user:userId}).select('post').lean(),
    SavedPost.find({user:userId}).select('post').lean(),
    Comment.find({user:userId}).select('_id post').lean()
  ]);

  const postIds=ids(posts),storyIds=ids(stories),conversationIds=ids(conversations);
  const commentConditions=[{user:userId}];if(postIds.length)commentConditions.push({post:{$in:postIds}});
  const comments=await Comment.find({$or:commentConditions}).select('_id post').lean();
  const commentIds=ids(comments);
  const messages=conversationIds.length?await Message.find({conversation:{$in:conversationIds}}).select('_id mediaKey').lean():[];

  const mediaKeys=[user.avatarKey,keyFromPublicUrl(user.coverUrl)];
  for(const p of posts){mediaKeys.push(p.imageKey);for(const m of p.media||[])mediaKeys.push(m.key,m.thumbKey)}
  for(const s of stories)mediaKeys.push(s.mediaKey,s.thumbKey,s.musicKey);
  for(const m of messages)mediaKeys.push(m.mediaKey);

  const affectedUsers=unique(followRows.flatMap(r=>[r.follower,r.following]).filter(x=>String(x)!==String(userId)));
  const affectedPosts=unique([...ownPostLikes.map(x=>x.post),...ownSaves.map(x=>x.post),...ownComments.map(x=>x.post)].filter(x=>!postIds.some(id=>String(id)===String(x))));

  await Promise.all([
    PostLike.deleteMany({$or:[{user:userId},...(postIds.length?[{post:{$in:postIds}}]:[])]}),
    PostView.deleteMany({$or:[{user:userId},...(postIds.length?[{post:{$in:postIds}}]:[])]}),
    SavedPost.deleteMany({$or:[{user:userId},...(postIds.length?[{post:{$in:postIds}}]:[])]}),
    CommentLike.deleteMany({$or:[{user:userId},...(commentIds.length?[{comment:{$in:commentIds}}]:[])]}),
    Comment.deleteMany({_id:{$in:commentIds}}),
    StoryLike.deleteMany({$or:[{user:userId},...(storyIds.length?[{story:{$in:storyIds}}]:[])]}),
    StoryView.deleteMany({$or:[{user:userId},...(storyIds.length?[{story:{$in:storyIds}}]:[])]}),
    FeedEvent.deleteMany({$or:[{user:userId},{author:userId},...(postIds.length?[{post:{$in:postIds}}]:[])]}),
    LoginSession.deleteMany({user:userId}),
    PushSubscription.deleteMany({user:userId}),
    AdEvent.deleteMany({user:userId}),
    NetworkAdEvent.deleteMany({user:userId}),
    UserRelation.deleteMany({$or:[{owner:userId},{target:userId}]}),
    Follow.deleteMany({$or:[{follower:userId},{following:userId}]}),
    Notification.deleteMany({$or:[{user:userId},{actor:userId},{actors:userId},...(postIds.length?[{post:{$in:postIds}}]:[]),...(storyIds.length?[{story:{$in:storyIds}}]:[])]}),
    Report.deleteMany({$or:[{reporter:userId},{reportedUser:userId},{reviewedBy:userId},{targetId:userId},...(postIds.length?[{targetId:{$in:postIds}}]:[]),...(storyIds.length?[{targetId:{$in:storyIds}}]:[]),...(commentIds.length?[{targetId:{$in:commentIds}}]:[])]}),
    OtpCode.deleteMany({phone:user.phone}),
    AdminLog.deleteMany({admin:userId}),
    AdCampaign.updateMany({$or:[{createdBy:userId},{updatedBy:userId}]},{$set:{createdBy:null,updatedBy:null}}),
    AdConfig.updateMany({updatedBy:userId},{$set:{updatedBy:null}})
  ]);

  if(conversationIds.length){await Message.deleteMany({conversation:{$in:conversationIds}});await Conversation.deleteMany({_id:{$in:conversationIds}})}
  if(postIds.length)await Post.deleteMany({_id:{$in:postIds}});
  if(storyIds.length)await Story.deleteMany({_id:{$in:storyIds}});

  const scrubConditions=[];
  if(postIds.length)scrubConditions.push({post:{$in:postIds}});
  if(storyIds.length)scrubConditions.push({story:{$in:storyIds}});
  if(scrubConditions.length)await Message.updateMany({$or:scrubConditions},{$set:{post:null,story:null,storyPreviewUrl:'',storyPreviewCaption:'',storyAuthorUsername:''}});

  await Promise.all([
    Post.updateMany({author:{$ne:userId}},{$pull:{likes:userId,mentions:userId,comments:{user:userId}}}),
    Story.updateMany({author:{$ne:userId}},{$pull:{likes:userId,viewers:{user:userId},mentions:userId}}),
    User.updateMany({_id:{$ne:userId}},{$pull:{followers:userId,following:userId,closeFriends:userId,savedPosts:{$in:postIds}}})
  ]);
  await Story.updateMany({'poll.options.voters':userId},{$pull:{'poll.options.$[].voters':userId}}).catch(()=>{});

  await User.deleteOne({_id:userId});
  await deleteMany(mediaKeys);

  await Promise.all(affectedUsers.map(async id=>{
    const [followerCount,followingCount]=await Promise.all([Follow.countDocuments({following:id,status:'accepted'}),Follow.countDocuments({follower:id,status:'accepted'})]);
    await User.updateOne({_id:id},{$set:{followerCount,followingCount}});
  }));
  await Promise.all(affectedPosts.map(async id=>{
    const [likeCount,commentCount,saveCount]=await Promise.all([PostLike.countDocuments({post:id}),Comment.countDocuments({post:id}),SavedPost.countDocuments({post:id})]);
    await Post.updateOne({_id:id},{$set:{likeCount,commentCount,saveCount}});
  }));
  return {deleted:true};
}
module.exports={deleteUserAccount};
