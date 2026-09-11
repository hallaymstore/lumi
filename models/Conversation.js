const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  participants:[{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true}], participantKey:{type:String,required:true,unique:true,index:true},
  lastMessageText:{type:String,maxlength:180,default:''}, lastMessageAt:{type:Date,default:Date.now}, lastSender:{type:mongoose.Schema.Types.ObjectId,ref:'User'},
  pinnedMessage:{type:mongoose.Schema.Types.ObjectId,ref:'Message',default:null}
},{timestamps:true});
schema.index({participants:1,lastMessageAt:-1});
module.exports=mongoose.model('Conversation',schema);
