const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  post:{ type:mongoose.Schema.Types.ObjectId, ref:'Post', required:true, index:true },
  user:{ type:mongoose.Schema.Types.ObjectId, ref:'User', required:true, index:true }
},{timestamps:true});
schema.index({post:1,user:1},{unique:true});
schema.index({user:1,createdAt:-1});
module.exports = mongoose.model('PostLike', schema);
