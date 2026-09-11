const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  comment:{ type:mongoose.Schema.Types.ObjectId, ref:'Comment', required:true, index:true },
  user:{ type:mongoose.Schema.Types.ObjectId, ref:'User', required:true, index:true }
},{timestamps:true});
schema.index({comment:1,user:1},{unique:true});
module.exports = mongoose.model('CommentLike', schema);
