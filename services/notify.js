const Notification=require('../models/Notification');
const User=require('../models/User');
const {emitToUser}=require('./realtime');
const {sendPush}=require('./push');
function prefAllows(user,type){if(!user)return true;if(['like','story_like'].includes(type))return user.notifyLikes!==false;if(['comment','mention','story_reply'].includes(type))return user.notifyComments!==false;if(['follow','follow_request'].includes(type))return user.notifyFollows!==false;if(type==='message')return user.notifyMessages!==false;return true}
async function createNotification(data){
  const target=await User.findById(data.user).select('notifyLikes notifyComments notifyFollows notifyMessages notifyPush').lean().catch(()=>null);if(!prefAllows(target,data.type))return null;
  const groupable=['like','follow','story_like'].includes(data.type)&&data.actor;
  let item;
  if(groupable){const suffix=data.post?`p:${data.post}`:data.story?`s:${data.story}`:'self';const groupKey=`${data.type}:${suffix}`;const since=new Date(Date.now()-6*60*60*1000);item=await Notification.findOne({user:data.user,groupKey,$or:[{lastActivityAt:{$gte:since}},{createdAt:{$gte:since}}]}).sort({lastActivityAt:-1,updatedAt:-1});if(item){const aid=String(data.actor);if(!item.actors.some(x=>String(x)===aid)){item.actors.push(data.actor);item.actorCount=Math.min(9999,(item.actorCount||1)+1)}item.actor=data.actor;item.text=data.text||item.text;item.read=false;item.lastActivityAt=new Date();await item.save()}else item=await Notification.create({...data,groupKey,actors:[data.actor],actorCount:1,lastActivityAt:new Date()})}else item=await Notification.create({...data,lastActivityAt:new Date()});
  emitToUser(data.user,'notification',{id:item._id.toString(),type:item.type,text:item.text,actorCount:item.actorCount||1});
  if(target?.notifyPush!==false)sendPush(data.user,{title:'Lumi',body:item.actorCount>1?`${item.actorCount} ta yangi faollik · ${item.text}`:item.text,url:data.conversation?`/chats/${data.conversation}`:data.post?`/p/${data.post}`:'/notifications'}).catch(()=>{});
  return item;
}
module.exports={createNotification};
