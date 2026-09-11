const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  reporter:{ type:mongoose.Schema.Types.ObjectId, ref:'User', required:true, index:true },
  targetType:{ type:String, enum:['post','story','comment','message','user'], required:true, index:true },
  targetId:{ type:mongoose.Schema.Types.ObjectId, required:true, index:true },
  reportedUser:{ type:mongoose.Schema.Types.ObjectId, ref:'User', default:null, index:true },
  reason:{ type:String, enum:['spam','harassment','nudity','scam','impersonation','hate','other'], default:'other' },
  details:{ type:String, maxlength:500, default:'' },
  status:{ type:String, enum:['open','reviewing','dismissed','actioned'], default:'open', index:true },
  action:{ type:String, default:'', maxlength:120 },
  reviewedBy:{ type:mongoose.Schema.Types.ObjectId, ref:'User', default:null },
  reviewedAt:{ type:Date, default:null }
},{timestamps:true});
schema.index({reporter:1,targetType:1,targetId:1},{unique:true});
module.exports = mongoose.model('Report', schema);
