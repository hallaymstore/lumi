const mongoose = require('mongoose');

// Legacy embedded comments/likes stay readable so an existing v1.x database upgrades safely.
// New v1.6 writes go to scalable PostLike/Comment collections.
const legacyCommentSchema = new mongoose.Schema({
  user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
  text:{type:String,required:true,trim:true,maxlength:400},
  likes:[{type:mongoose.Schema.Types.ObjectId,ref:'User'}],
  replyToComment:{type:mongoose.Schema.Types.ObjectId,default:null},
  replyToUser:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null}
},{timestamps:true});

const mediaSchema = new mongoose.Schema({
  url:{type:String,required:true}, key:{type:String,default:''},
  type:{type:String,enum:['image','video'],default:'image'},
  width:{type:Number,default:0}, height:{type:Number,default:0},
  thumbUrl:{type:String,default:''}, thumbKey:{type:String,default:''}
},{_id:false});

const postSchema = new mongoose.Schema({
  author:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
  caption:{type:String,trim:true,maxlength:2200,default:''},
  imageUrl:{type:String,default:''}, imageKey:{type:String,default:''},
  media:{type:[mediaSchema],default:[]},
  tags:[{type:String,lowercase:true,trim:true}],
  mentions:[{type:mongoose.Schema.Types.ObjectId,ref:'User'}],
  likes:[{type:mongoose.Schema.Types.ObjectId,ref:'User'}], // legacy
  comments:[legacyCommentSchema], // legacy
  likeCount:{type:Number,default:0,min:0,index:true},
  commentCount:{type:Number,default:0,min:0},
  saveCount:{type:Number,default:0,min:0},
  shareCount:{type:Number,default:0,min:0},
  viewCount:{type:Number,default:0,min:0,index:true},
  qualityScore:{type:Number,default:0,index:true},
  isPinned:{type:Boolean,default:false},
  isHidden:{type:Boolean,default:false,index:true},
  reports:{type:Number,default:0}
},{timestamps:true});

postSchema.index({createdAt:-1});
postSchema.index({author:1,createdAt:-1});
postSchema.index({isHidden:1,qualityScore:-1,createdAt:-1});
postSchema.index({caption:'text',tags:'text'},{weights:{caption:5,tags:8},name:'post_search_text'});
module.exports = mongoose.model('Post',postSchema);
