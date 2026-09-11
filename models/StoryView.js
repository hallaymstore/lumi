const mongoose=require('mongoose');
const schema=new mongoose.Schema({
  story:{type:mongoose.Schema.Types.ObjectId,ref:'Story',required:true,index:true},
  user:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null,index:true},
  guestKey:{type:String,default:'',index:true}
},{timestamps:true});
schema.index({story:1,user:1},{unique:true,partialFilterExpression:{user:{$type:'objectId'}}});
schema.index({story:1,guestKey:1},{unique:true,partialFilterExpression:{guestKey:{$type:'string',$gt:''}}});
module.exports=mongoose.model('StoryView',schema);
