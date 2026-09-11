const mongoose = require('mongoose');
const pollSchema = new mongoose.Schema({
  question:{type:String,maxlength:100,default:''},
  options:[{label:{type:String,maxlength:40},voters:[{type:mongoose.Schema.Types.ObjectId,ref:'User'}]}]
},{_id:false});
const storySchema = new mongoose.Schema({
  author:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
  mediaUrl:{type:String,required:true}, mediaKey:{type:String,default:''},
  mediaType:{type:String,enum:['image','video'],default:'image'}, thumbUrl:{type:String,default:''}, thumbKey:{type:String,default:''},
  musicUrl:{type:String,default:''}, musicKey:{type:String,default:''},
  caption:{type:String,trim:true,maxlength:240,default:''},
  mentions:[{type:mongoose.Schema.Types.ObjectId,ref:'User'}], linkUrl:{type:String,maxlength:500,default:''},
  stickers:[{type:String,maxlength:20}], poll:{type:pollSchema,default:null},
  audience:{type:String,enum:['everyone','followers','close_friends'],default:'everyone'},
  likes:[{type:mongoose.Schema.Types.ObjectId,ref:'User'}], viewers:[{user:{type:mongoose.Schema.Types.ObjectId,ref:'User'},viewedAt:{type:Date,default:Date.now},_id:false}], // legacy
  likeCount:{type:Number,default:0,min:0}, viewCount:{type:Number,default:0,min:0},
  isHighlight:{type:Boolean,default:false,index:true}, highlightTitle:{type:String,maxlength:40,default:''},
  archivedAt:{type:Date,default:null}, isHidden:{type:Boolean,default:false,index:true}, expiresAt:{type:Date,required:true,index:true}
},{timestamps:true});
storySchema.index({author:1,createdAt:-1});
storySchema.index({author:1,isHighlight:1,createdAt:-1});
module.exports = mongoose.model('Story',storySchema);
