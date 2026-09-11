const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  phone:{ type:String, required:true, index:true },
  purpose:{ type:String, enum:['register','reset','change_phone'], required:true },
  codeHash:{ type:String, required:true },
  attempts:{ type:Number, default:0 },
  verifiedAt:{ type:Date, default:null },
  expiresAt:{ type:Date, required:true, index:true }
},{timestamps:true});
schema.index({phone:1,purpose:1,createdAt:-1});
schema.index({expiresAt:1},{expireAfterSeconds:0});
module.exports = mongoose.model('OtpCode', schema);
