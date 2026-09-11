const mongoose=require('mongoose');
const reactionSchema=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},emoji:{type:String,enum:['❤️','😂','🔥','😮','👍'],required:true}},{_id:false});
const schema=new mongoose.Schema({
  conversation:{type:mongoose.Schema.Types.ObjectId,ref:'Conversation',required:true,index:true}, sender:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
  text:{type:String,trim:true,maxlength:2400,default:''}, post:{type:mongoose.Schema.Types.ObjectId,ref:'Post',default:null}, story:{type:mongoose.Schema.Types.ObjectId,ref:'Story',default:null},
  replyTo:{type:mongoose.Schema.Types.ObjectId,ref:'Message',default:null}, editedAt:{type:Date,default:null}, deletedForEveryoneAt:{type:Date,default:null},
  storyPreviewUrl:{type:String,default:''},storyPreviewCaption:{type:String,maxlength:120,default:''},storyAuthorUsername:{type:String,maxlength:24,default:''},
  mediaUrl:{type:String,default:''},mediaKey:{type:String,default:''},mediaType:{type:String,enum:['image','video','audio','file'],default:null},mediaName:{type:String,maxlength:180,default:''},
  ephemeral:{type:Boolean,default:false,index:true},ephemeralOpenedAt:{type:Date,default:null},ephemeralExpiresAt:{type:Date,default:null,index:true},ephemeralOpenedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null},ephemeralConsumedAt:{type:Date,default:null},
  reactions:[reactionSchema],readBy:[{type:mongoose.Schema.Types.ObjectId,ref:'User'}]
},{timestamps:true});
schema.index({conversation:1,createdAt:-1}); schema.index({ephemeral:1,ephemeralExpiresAt:1});
module.exports=mongoose.model('Message',schema);
