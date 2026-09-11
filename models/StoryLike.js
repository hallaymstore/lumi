const mongoose = require('mongoose');
const schema = new mongoose.Schema({story:{type:mongoose.Schema.Types.ObjectId,ref:'Story',required:true,index:true},user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true}},{timestamps:true});
schema.index({story:1,user:1},{unique:true});
module.exports = mongoose.model('StoryLike',schema);
