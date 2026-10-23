const mongoose=require('mongoose');
const schema=new mongoose.Schema({creator:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},day:{type:String,required:true},originalPosts:{type:Number,default:0,min:0},qualifiedViews:{type:Number,default:0,min:0}},{timestamps:true});
schema.index({creator:1,day:1},{unique:true});
module.exports=mongoose.model('CreatorMetricDaily',schema);
