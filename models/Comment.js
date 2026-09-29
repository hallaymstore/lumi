const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  post:{ type:mongoose.Schema.Types.ObjectId, ref:'Post', required:true, index:true },
  user:{ type:mongoose.Schema.Types.ObjectId, ref:'User', required:true, index:true },
  text:{ type:String, required:true, trim:true, maxlength:400 },
  parent:{ type:mongoose.Schema.Types.ObjectId, ref:'Comment', default:null, index:true },
  replyToUser:{ type:mongoose.Schema.Types.ObjectId, ref:'User', default:null },
  likeCount:{ type:Number, default:0, min:0 },
  isPinned:{ type:Boolean, default:false },
  isHidden:{ type:Boolean, default:false },
  interactionOrigin:{type:String,enum:['organic','synthetic'],default:'organic',index:true}
},{timestamps:true});
schema.index({post:1,isPinned:-1,createdAt:1});
module.exports = mongoose.model('Comment', schema);
