const mongoose=require('mongoose');
const schema=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:'User',unique:true,required:true},status:{type:String,enum:['pending','approved','rejected'],default:'pending',index:true},note:{type:String,trim:true,maxlength:600,default:''},rulesAcceptedAt:{type:Date,required:true},snapshot:{type:mongoose.Schema.Types.Mixed,default:{}},reviewedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null},reviewedAt:{type:Date,default:null}},{timestamps:true});
schema.index({status:1,updatedAt:-1});
module.exports=mongoose.model('MonetizationApplication',schema);
