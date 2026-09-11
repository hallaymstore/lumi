const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  follower:{ type:mongoose.Schema.Types.ObjectId, ref:'User', required:true, index:true },
  following:{ type:mongoose.Schema.Types.ObjectId, ref:'User', required:true, index:true },
  status:{ type:String, enum:['pending','accepted'], default:'accepted', index:true }
},{timestamps:true});
schema.index({follower:1,following:1},{unique:true});
schema.index({following:1,status:1,createdAt:-1});
module.exports = mongoose.model('Follow', schema);
