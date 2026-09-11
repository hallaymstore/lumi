const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  name:{type:String,required:true,trim:true,maxlength:60},
  username:{type:String,required:true,unique:true,lowercase:true,trim:true,match:/^[a-z0-9._]{3,24}$/},
  phone:{type:String,unique:true,sparse:true,trim:true,index:true},
  phoneVerifiedAt:{type:Date,default:null},
  email:{type:String,unique:true,sparse:true,lowercase:true,trim:true},
  passwordHash:{type:String,required:true},
  bio:{type:String,maxlength:220,default:''}, avatarUrl:{type:String,default:''}, avatarKey:{type:String,default:''}, coverUrl:{type:String,default:''},
  role:{type:String,enum:['user','creator','moderator','admin'],default:'user'},
  isVerified:{type:Boolean,default:false}, isSuspended:{type:Boolean,default:false}, suspendedUntil:{type:Date,default:null}, ageConfirmed18:{type:Boolean,required:true,default:false},
  isPrivate:{type:Boolean,default:false},
  followers:[{type:mongoose.Schema.Types.ObjectId,ref:'User'}], // legacy
  following:[{type:mongoose.Schema.Types.ObjectId,ref:'User'}], // legacy
  savedPosts:[{type:mongoose.Schema.Types.ObjectId,ref:'Post'}], // legacy
  followerCount:{type:Number,default:0,min:0,index:true}, followingCount:{type:Number,default:0,min:0}, postCount:{type:Number,default:0,min:0},
  noteText:{type:String,trim:true,maxlength:60,default:''}, noteExpiresAt:{type:Date,default:null},
  allowMessages:{type:String,enum:['everyone','following','nobody'],default:'following'},
  allowStoryReplies:{type:Boolean,default:true}, allowMentions:{type:String,enum:['everyone','following','nobody'],default:'everyone'},
  showActivityStatus:{type:Boolean,default:true}, discoverableByPhone:{type:Boolean,default:true},
  notifyLikes:{type:Boolean,default:true}, notifyComments:{type:Boolean,default:true}, notifyFollows:{type:Boolean,default:true}, notifyMessages:{type:Boolean,default:true}, notifyPush:{type:Boolean,default:true},
  dataSaver:{type:Boolean,default:false}, hiddenWords:[{type:String,trim:true,lowercase:true,maxlength:40}],
  closeFriends:[{type:mongoose.Schema.Types.ObjectId,ref:'User'}],
  lastSeenAt:{type:Date,default:null},
  sessionVersion:{type:Number,default:0,min:0}
},{timestamps:true});
userSchema.index({name:'text',username:'text'},{weights:{username:10,name:5},name:'user_search_text'});
module.exports = mongoose.model('User',userSchema);
