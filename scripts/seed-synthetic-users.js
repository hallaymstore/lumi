require('dotenv').config();
const crypto=require('crypto');
const bcrypt=require('bcryptjs');
const mongoose=require('mongoose');
const connectDB=require('../config/db');
const User=require('../models/User');

const firstNames=[
'Aziza','Madina','Mohira','Nilufar','Shahnoza','Sevara','Dilnoza','Malika','Rayona','Zarina',
'Jasur','Bekzod','Sardor','Asilbek','Shahzod','Diyor','Kamron','Temur','Akmal','Sanjar',
'Anastasia','Sofia','Alina','Daria','Elena','Mila','Polina','Viktoria','Arina','Ksenia',
'Alexander','Maksim','Nikita','Roman','Daniil','Kirill','Artem','Ilya','Mikhail','Denis',
'Amelia','Emma','Olivia','Mia','Ava','Luna','Chloe','Nora','Maya','Layla',
'Noah','Liam','Ethan','Leo','Lucas','Adam','Owen','Ryan','Mason','Aiden'
];
const lastNames=[
'Karimova','Rahimova','Ismoilova','Yusupova','Saidova','Nazarova','Tursunova','Abdullaeva','Rasulova','Qodirova',
'Karimov','Rahimov','Ismoilov','Yusupov','Saidov','Nazarov','Tursunov','Abdullaev','Rasulov','Qodirov',
'Petrova','Ivanova','Smirnova','Volkova','Sokolova','Kuznetsova','Morozova','Popova','Orlova','Lebedeva',
'Petrov','Ivanov','Smirnov','Volkov','Sokolov','Kuznetsov','Morozov','Popov','Orlov','Lebedev',
'Anderson','Miller','Taylor','Wilson','Moore','Martin','Clark','Lewis','Walker','Hall',
'Young','King','Wright','Scott','Green','Baker','Adams','Nelson','Carter','Mitchell'
];
const bios=[
'Yangi g\'oyalar, chiroyli lahzalar va yaxshi kayfiyat ✦',
'Kundalik hayot, ijod va foydali topilmalar.',
'Tech, music va creative life.',
'Coffee, books, travel va kichik quvonchlar.',
'Photography, design va yangi joylar.',
'Har kuni ozgina yaxshiroq bo\'lish uchun.',
'Music lover · visual stories · good vibes.',
'Learning, creating, sharing.',
'Life in frames ✦',
'Food, travel va samimiy postlar.',
'Gaming, gadgets va internet madaniyati.',
'Moda, beauty va lifestyle.',
'Art, cinema va ilhom.',
'Fitness, routine va motivatsiya.',
'Simple moments, real stories.'
];
const interests=['lifestyle','music','tech','gaming','travel','food','fashion','beauty','education','art','fitness','cars','humor'];

function slug(v){return String(v).toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,7)||'user'}
function pad(n){return String(n).padStart(5,'0')}
function createdAtFor(i,count){
  const days=180;
  const span=days*864e5;
  const ratio=(i+1)/(count+1);
  return new Date(Date.now()-span+(span*ratio));
}
function profileFor(i,count,passwordHash){
  const combo=firstNames.length*lastNames.length;
  const group=Math.floor(i/combo);
  const first=firstNames[i%firstNames.length];
  const last=lastNames[Math.floor(i/firstNames.length)%lastNames.length];
  const second=group>0?firstNames[(i+group*19)%firstNames.length]:'';
  const name=second&&second!==first?first+' '+second+' '+last:first+' '+last;
  const username=('lumi'+pad(i+1)+'.'+slug(first)).slice(0,24);
  const createdAt=createdAtFor(i,count);
  const creator=i%7===0;
  return {
    name,username,passwordHash,
    bio:bios[i%bios.length],
    role:creator?'creator':'user',
    creatorMode:creator,
    creatorCategory:creator?['lifestyle','tech','gaming','music','travel','art'][i%6]:'',
    creatorSince:creator?createdAt:null,
    interests:[interests[i%interests.length],interests[(i+5)%interests.length]],
    accountOrigin:'synthetic',
    managedByPlatform:true,
    isVerified:false,
    isSuspended:false,
    isPrivate:false,
    discoverableByPhone:false,
    showActivityStatus:false,
    notifyPush:false,
    allowMessages:'following',
    ageConfirmed18:false,
    postCount:0,followerCount:0,followingCount:0,
    createdAt,updatedAt:createdAt
  };
}

(async()=>{
  const requested=Number(process.argv[2]||process.env.SYNTHETIC_USER_COUNT||10000);
  const count=Math.max(1,Math.min(10000,Number.isFinite(requested)?Math.floor(requested):10000));
  const batchSize=500;
  let created=0,existing=0;
  try{
    await connectDB();
    const seedSecret=process.env.SYNTHETIC_USER_PASSWORD||crypto.randomBytes(32).toString('hex');
    const passwordHash=await bcrypt.hash(seedSecret,12);
    for(let start=0;start<count;start+=batchSize){
      const end=Math.min(count,start+batchSize);
      const ops=[];
      for(let i=start;i<end;i++){
        const p=profileFor(i,count,passwordHash);
        ops.push({updateOne:{filter:{username:p.username},update:{$setOnInsert:p},upsert:true}});
      }
      const r=await User.bulkWrite(ops,{ordered:false});
      created+=Number(r.upsertedCount||0);
      existing+=(end-start)-Number(r.upsertedCount||0);
      console.log(`Synthetic profiles: ${end}/${count} processed · ${created} new · ${existing} existing`);
    }
    const total=await User.countDocuments({accountOrigin:'synthetic'});
    console.log(`Done. Synthetic profiles in database: ${total}`);
  }catch(e){
    console.error('Synthetic seed failed:',e);
    process.exitCode=1;
  }finally{
    await mongoose.disconnect().catch(()=>{});
  }
})();