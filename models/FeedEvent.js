const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  user:{ type:mongoose.Schema.Types.ObjectId, ref:'User', default:null, index:true },
  guestKey:{ type:String, default:'', index:true },
  post:{ type:mongoose.Schema.Types.ObjectId, ref:'Post', default:null, index:true },
  author:{ type:mongoose.Schema.Types.ObjectId, ref:'User', default:null, index:true },
  type:{ type:String, enum:['impression','view','dwell','like','unlike','comment','save','unsave','share','open_comments','profile_visit','not_interested','hide_author'], required:true, index:true },
  value:{ type:Number, default:1 },
  tags:[{type:String,lowercase:true,trim:true}]
},{timestamps:true});
schema.index({user:1,createdAt:-1});
schema.index({user:1,author:1,createdAt:-1});
schema.index({post:1,type:1,createdAt:-1});
schema.index({createdAt:1},{expireAfterSeconds:60*60*24*180});
module.exports = mongoose.model('FeedEvent', schema);
