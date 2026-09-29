const crypto=require('crypto');
const bcrypt=require('bcryptjs');
const User=require('../models/User');
const Post=require('../models/Post');
const Follow=require('../models/Follow');
const PostLike=require('../models/PostLike');
const Comment=require('../models/Comment');

const firstNames=['Aziza','Madina','Mohira','Nilufar','Shahnoza','Sevara','Dilnoza','Malika','Rayona','Zarina','Jasur','Bekzod','Sardor','Asilbek','Shahzod','Diyor','Kamron','Temur','Akmal','Sanjar','Anastasia','Sofia','Alina','Daria','Elena','Mila','Polina','Viktoria','Arina','Ksenia','Alexander','Maksim','Nikita','Roman','Daniil','Kirill','Artem','Ilya','Mikhail','Denis','Amelia','Emma','Olivia','Mia','Ava','Luna','Chloe','Nora','Maya','Layla','Noah','Liam','Ethan','Leo','Lucas','Adam','Owen','Ryan','Mason','Aiden'];
const lastNames=['Karimova','Rahimova','Ismoilova','Yusupova','Saidova','Nazarova','Tursunova','Abdullaeva','Rasulova','Qodirova','Karimov','Rahimov','Ismoilov','Yusupov','Saidov','Nazarov','Tursunov','Abdullaev','Rasulov','Qodirov','Petrova','Ivanova','Smirnova','Volkova','Sokolova','Kuznetsova','Morozova','Popova','Orlova','Lebedeva','Petrov','Ivanov','Smirnov','Volkov','Sokolov','Kuznetsov','Morozov','Popov','Orlov','Lebedev','Anderson','Miller','Taylor','Wilson','Moore','Martin','Clark','Lewis','Walker','Hall','Young','King','Wright','Scott','Green','Baker','Adams','Nelson','Carter','Mitchell'];
const bios=['Yangi g\'oyalar va chiroyli lahzalar ✦','Kundalik hayot, ijod va foydali topilmalar.','Tech, music va creative life.','Coffee, books, travel va kichik quvonchlar.','Photography, design va yangi joylar.','Music lover · visual stories · good vibes.','Learning, creating, sharing.','Food, travel va samimiy postlar.','Gaming, gadgets va internet madaniyati.','Moda, beauty va lifestyle.','Art, cinema va ilhom.','Fitness, routine va motivatsiya.'];
const interests=['lifestyle','music','tech','gaming','travel','food','fashion','beauty','education','art','fitness','cars','humor'];
const comments=['Zo‘r chiqibdi ✦','Yaxshi post ekan.','Chiroyli kadr.','Qiziqarli 👏','Yoqdi.','Kayfiyat berdi ✨','Ajoyib!','Yaxshi fikr.'];

function slug(v){return String(v).toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,7)||'user'}
function pad(n){return String(n).padStart(5,'0')}
function profileFor(i,passwordHash){
  const combo=firstNames.length*lastNames.length;
  const group=Math.floor(i/combo);
  const first=firstNames[i%firstNames.length];
  const last=lastNames[Math.floor(i/firstNames.length)%lastNames.length];
  const second=group>0?firstNames[(i+group*19)%firstNames.length]:'';
  const creator=i%7===0;
  const createdAt=new Date(Date.now()-180*864e5+(180*864e5*((i+1)/10001)));
  return {
    name:second&&second!==first?first+' '+second+' '+last:first+' '+last,
    username:('lumi'+pad(i+1)+'.'+slug(first)).slice(0,24),
    passwordHash,bio:bios[i%bios.length],role:creator?'creator':'user',creatorMode:creator,
    creatorCategory:creator?['lifestyle','tech','gaming','music','travel','art'][i%6]:'',
    creatorSince:creator?createdAt:null,
    interests:[interests[i%interests.length],interests[(i+5)%interests.length]],
    accountOrigin:'synthetic',managedByPlatform:true,isVerified:false,isSuspended:false,isPrivate:false,
    discoverableByPhone:false,showActivityStatus:false,notifyPush:false,ageConfirmed18:false,
    postCount:0,followerCount:0,followingCount:0,createdAt,updatedAt:createdAt
  };
}

async function seedManagedProfiles(requested=10000){
  const count=Math.max(1,Math.min(10000,Number(requested)||10000));
  const passwordHash=await bcrypt.hash(crypto.randomBytes(32).toString('hex'),10);
  let created=0;
  for(let start=0;start<count;start+=500){
    const end=Math.min(count,start+500),ops=[];
    for(let i=start;i<end;i++){
      const p=profileFor(i,passwordHash);
      ops.push({updateOne:{filter:{username:p.username},update:{$setOnInsert:p},upsert:true}});
    }
    const r=await User.bulkWrite(ops,{ordered:false});
    created+=Number(r.upsertedCount||0);
  }
  const total=await User.countDocuments({accountOrigin:'synthetic',managedByPlatform:true});
  return {requested:count,created,total};
}

function pick(rows,i,offset=0){return rows.length?rows[(i*17+offset)%rows.length]:null}

async function runManagedPulse(requested=150){
  const actors=Math.max(1,Math.min(500,Number(requested)||150));
  const [managed,targets,posts]=await Promise.all([
    User.aggregate([{$match:{accountOrigin:'synthetic',managedByPlatform:true,isSuspended:false}},{$sample:{size:actors}}]),
    User.aggregate([{$match:{isSuspended:false,isPrivate:false}},{$sample:{size:Math.min(1000,actors*3)}}]),
    Post.aggregate([{$match:{isHidden:false,status:'published'}},{$sample:{size:Math.min(1000,actors*4)}}])
  ]);
  const authorIds=[...new Set(posts.map(p=>String(p.author)).filter(Boolean))];
  const authors=await User.find({_id:{$in:authorIds}}).select('_id accountOrigin isPrivate').lean();
  const authorMap=new Map(authors.map(a=>[String(a._id),{origin:a.accountOrigin,isPrivate:!!a.isPrivate}]));
  let follows=0,likes=0,commentsMade=0;
  for(let i=0;i<managed.length;i++){
    const actor=managed[i],mode=i%10;
    if(mode<4&&targets.length){
      let target=pick(targets,i,3);
      if(target&&String(target._id)===String(actor._id))target=pick(targets,i,9);
      if(target&&String(target._id)!==String(actor._id)){
        const r=await Follow.updateOne({follower:actor._id,following:target._id},{$setOnInsert:{follower:actor._id,following:target._id,status:'accepted',interactionOrigin:'synthetic'}},{upsert:true});
        if(r.upsertedCount)follows++;
      }
    }else if(mode<9&&posts.length){
      const post=pick(posts,i,5);if(!post||String(post.author)===String(actor._id)||authorMap.get(String(post.author))?.isPrivate)continue;
      const r=await PostLike.updateOne({post:post._id,user:actor._id},{$setOnInsert:{post:post._id,user:actor._id,interactionOrigin:'synthetic'}},{upsert:true});
      if(r.upsertedCount){likes++;if(authorMap.get(String(post.author))?.origin==='synthetic')await Post.updateOne({_id:post._id},{$inc:{syntheticLikeCount:1}})}
    }else{
      const syntheticPosts=posts.filter(p=>authorMap.get(String(p.author))?.origin==='synthetic'&&!authorMap.get(String(p.author))?.isPrivate);
      const post=pick(syntheticPosts,i,11);if(!post||String(post.author)===String(actor._id))continue;
      await Comment.create({post:post._id,user:actor._id,text:comments[i%comments.length],interactionOrigin:'synthetic'});
      await Post.updateOne({_id:post._id},{$inc:{syntheticCommentCount:1}});
      commentsMade++;
    }
  }
  return {actors:managed.length,follows,likes,comments:commentsMade};
}

async function createManagedPost({username,caption,imageUrl}){
  const author=await User.findOne({username:String(username||'').toLowerCase(),accountOrigin:'synthetic',managedByPlatform:true});
  if(!author)throw new Error('Managed virtual profil topilmadi.');
  const url=String(imageUrl||'/icons/icon-192.png').trim();
  if(url&&!/^https:\/\//i.test(url)&&!/^\//.test(url))throw new Error('Rasm URL https:// yoki / bilan boshlansin.');
  const media=url?[{url,type:'image',width:0,height:0,thumbUrl:url,thumbKey:'',key:''}]:[];
  const post=await Post.create({author:author._id,caption:String(caption||'').trim().slice(0,2200),imageUrl:url,media,tags:[],likeCount:0,syntheticLikeCount:0,commentCount:0,syntheticCommentCount:0});
  await User.updateOne({_id:author._id},{$inc:{postCount:1}});
  return post;
}

module.exports={seedManagedProfiles,runManagedPulse,createManagedPost};
