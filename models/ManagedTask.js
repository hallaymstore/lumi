const mongoose=require('mongoose');

const managedTaskSchema=new mongoose.Schema({
  type:{type:String,enum:['like','comment','follow','view'],required:true,index:true},
  amount:{type:Number,default:100,min:1,max:5000},
  targetUsername:{type:String,default:''},
  targetPost:{type:mongoose.Schema.Types.ObjectId,ref:'Post',default:null},
  status:{type:String,enum:['queued','running','done','failed'],default:'queued',index:true},
  requestedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null},
  result:{
    attempted:{type:Number,default:0},
    completed:{type:Number,default:0},
    skipped:{type:Number,default:0},
    note:{type:String,default:''}
  },
  error:{type:String,default:''},
  startedAt:{type:Date,default:null},
  finishedAt:{type:Date,default:null}
},{timestamps:true});

managedTaskSchema.index({createdAt:-1});
module.exports=mongoose.model('ManagedTask',managedTaskSchema);
