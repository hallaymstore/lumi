const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  user:{ type:mongoose.Schema.Types.ObjectId, ref:'User', required:true, index:true },
  sessionIdHash:{ type:String, required:true, index:true },
  ipHash:{ type:String, default:'' },
  userAgent:{ type:String, default:'' },
  lastSeenAt:{ type:Date, default:Date.now },
  revokedAt:{ type:Date, default:null }
},{timestamps:true});
schema.index({user:1,lastSeenAt:-1});
module.exports = mongoose.model('LoginSession', schema);
