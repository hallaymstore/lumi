const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  owner:{ type:mongoose.Schema.Types.ObjectId, ref:'User', required:true, index:true },
  target:{ type:mongoose.Schema.Types.ObjectId, ref:'User', required:true, index:true },
  type:{ type:String, enum:['block','mute','restrict'], required:true, index:true }
},{timestamps:true});
schema.index({owner:1,target:1,type:1},{unique:true});
module.exports = mongoose.model('UserRelation', schema);
