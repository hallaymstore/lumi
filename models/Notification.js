const mongoose=require('mongoose');
const schema=new mongoose.Schema({
  user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true}, actor:{type:mongoose.Schema.Types.ObjectId,ref:'User'},
  type:{type:String,enum:['like','comment','follow','follow_request','mention','story_like','story_reply','message','system','moderation'],required:true,index:true},
  post:{type:mongoose.Schema.Types.ObjectId,ref:'Post'},story:{type:mongoose.Schema.Types.ObjectId,ref:'Story'},conversation:{type:mongoose.Schema.Types.ObjectId,ref:'Conversation'},
  groupKey:{type:String,default:'',index:true}, actorCount:{type:Number,default:1}, actors:[{type:mongoose.Schema.Types.ObjectId,ref:'User'}],
  text:{type:String,maxlength:180,default:''},read:{type:Boolean,default:false,index:true},lastActivityAt:{type:Date,default:Date.now,index:true}
},{timestamps:true});
schema.index({user:1,lastActivityAt:-1,createdAt:-1}); schema.index({user:1,groupKey:1,lastActivityAt:-1});
module.exports=mongoose.model('Notification',schema);
