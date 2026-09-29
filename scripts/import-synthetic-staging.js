require('dotenv').config();
const fs=require('fs');
const path=require('path');
const readline=require('readline');
const bcrypt=require('bcryptjs');
const mongoose=require('mongoose');
const connectDB=require('../config/db');
const User=require('../models/User');
const Follow=require('../models/Follow');

if(process.env.NODE_ENV==='production'||process.env.ALLOW_SYNTHETIC_IMPORT!=='true'){
  console.error('Blocked: synthetic import is staging/test only. Set ALLOW_SYNTHETIC_IMPORT=true outside production.');
  process.exit(2);
}

const file=path.resolve(process.argv[2]||path.join('tmp','synthetic-users-10000.ndjson'));
const batchSize=500;

(async()=>{
  try{
    if(!fs.existsSync(file))throw new Error('Fixture file topilmadi: '+file);
    await connectDB();
    const admin=await User.findOne({username:'hallaym'}).select('_id username').lean();
    if(!admin)throw new Error('@hallaym akkaunti topilmadi.');
    const passwordHash=await bcrypt.hash(process.env.SYNTHETIC_USER_PASSWORD||'SyntheticOnly_NotForLogin_2026!',12);
    const input=readline.createInterface({input:fs.createReadStream(file),crlfDelay:Infinity});
    let batch=[],processed=0;
    async function flush(){
      if(!batch.length)return;
      const docs=batch.splice(0,batch.length);
      await User.bulkWrite(docs.map(p=>({updateOne:{
        filter:{username:p.username},
        update:{$setOnInsert:{
          name:p.name,username:p.username,passwordHash,bio:p.bio||'',role:p.role||'user',
          creatorMode:!!p.creatorMode,creatorCategory:p.creatorCategory||'',
          interests:Array.isArray(p.interests)?p.interests:[],
          accountOrigin:'synthetic',managedByPlatform:true,isPrivate:false,isSuspended:false,
          discoverableByPhone:false,showActivityStatus:false,notifyPush:false,ageConfirmed18:false,
          createdAt:p.createdAt?new Date(p.createdAt):new Date(),updatedAt:p.createdAt?new Date(p.createdAt):new Date()
        }},upsert:true
      }})),{ordered:false});
      const users=await User.find({username:{$in:docs.map(x=>x.username)},accountOrigin:'synthetic'}).select('_id').lean();
      await Follow.bulkWrite(users.map(u=>({updateOne:{
        filter:{follower:u._id,following:admin._id},
        update:{$setOnInsert:{follower:u._id,following:admin._id,status:'accepted'}},
        upsert:true
      }})),{ordered:false});
      await User.updateMany({_id:{$in:users.map(u=>u._id)}},{$set:{followingCount:1}});
      processed+=docs.length;
      console.log('Imported '+processed+' synthetic profiles; @hallaym test-follow relation attached.');
    }
    for await(const line of input){
      if(!line.trim())continue;
      batch.push(JSON.parse(line));
      if(batch.length>=batchSize)await flush();
    }
    await flush();
    console.log('Staging import complete. Public organic follower counts remain separate.');
  }catch(e){
    console.error(e);
    process.exitCode=1;
  }finally{
    await mongoose.disconnect().catch(()=>{});
  }
})();