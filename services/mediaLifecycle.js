const Story=require('../models/Story');
const Message=require('../models/Message');
const Post=require('../models/Post');
const User=require('../models/User');
const {deleteMany,listPrefixPage,configured}=require('./r2');
let lastOrphanScan=0;
const cursors=new Map();
const DAY=864e5;
async function markArchivedStories(){
  await Story.updateMany({expiresAt:{$lt:new Date()},archivedAt:null},{$set:{archivedAt:new Date()}});
}
async function cleanupConsumed(){
  const consumed=await Message.find({ephemeral:true,ephemeralConsumedAt:{$ne:null},mediaKey:{$ne:''}}).limit(50);
  for(const m of consumed){
    await deleteMany([m.mediaKey]);
    m.mediaKey='';m.mediaUrl='';
    await m.save();
  }
}
async function referencedKeys(keys){
  if(!keys.length)return new Set();
  // Only fetch references matching the current small R2 page, never all DB records.
  const [posts,stories,users,messages]=await Promise.all([
    Post.find({$or:[{imageKey:{$in:keys}},{'media.key':{$in:keys}},{'media.thumbKey':{$in:keys}},{'media.posterKey':{$in:keys}},{'media.captionsKey':{$in:keys}},{'media.playbackKey':{$in:keys}}]}).select('imageKey media.key media.thumbKey media.posterKey media.captionsKey media.playbackKey').lean(),
    Story.find({$or:[{mediaKey:{$in:keys}},{thumbKey:{$in:keys}},{musicKey:{$in:keys}}]}).select('mediaKey thumbKey musicKey').lean(),
    User.find({avatarKey:{$in:keys}}).select('avatarKey').lean(),
    Message.find({mediaKey:{$in:keys}}).select('mediaKey').lean()
  ]);
  const set=new Set();
  for(const p of posts){
    if(p.imageKey)set.add(p.imageKey);
    for(const m of p.media||[]){if(m.key)set.add(m.key);if(m.thumbKey)set.add(m.thumbKey);if(m.posterKey)set.add(m.posterKey);if(m.captionsKey)set.add(m.captionsKey);if(m.playbackKey)set.add(m.playbackKey)}
  }
  for(const s of stories){for(const k of [s.mediaKey,s.thumbKey,s.musicKey])if(k)set.add(k)}
  for(const u of users)if(u.avatarKey)set.add(u.avatarKey);
  for(const m of messages)if(m.mediaKey)set.add(m.mediaKey);
  return set;
}
async function cleanupOrphans(){
  if(!configured()||process.env.R2_ORPHAN_SCAN==='false')return;
  const now=Date.now();
  if(now-lastOrphanScan<6*60*60*1000)return;
  lastOrphanScan=now;
  const threshold=now-2*DAY; // orphan grace after interrupted uploads
  for(const prefix of ['posts/','stories/','story-music/','avatars/','chat/','chat-once/']){
    try{
      const startAfter=cursors.get(prefix)||'';
      const {objects,nextStartAfter}=await listPrefixPage(prefix,250,startAfter);
      const candidates=objects.filter(o=>o.Key&&new Date(o.LastModified||0).getTime()<threshold);
      const refs=await referencedKeys(candidates.map(o=>o.Key));
      const orphans=candidates.filter(o=>!refs.has(o.Key)).map(o=>o.Key);
      for(let i=0;i<orphans.length;i+=50)await deleteMany(orphans.slice(i,i+50));
      cursors.set(prefix,nextStartAfter||'');
    }catch(e){console.error('R2 orphan scan',prefix,e.message)}
  }
}
async function cleanupMedia(){await markArchivedStories();await cleanupConsumed();await cleanupOrphans()}
function startMediaLifecycle(){
  cleanupMedia().catch(e=>console.error('media cleanup:',e.message));
  const mins=Math.max(5,Number(process.env.MEDIA_CLEANUP_MINUTES||30));
  const t=setInterval(()=>cleanupMedia().catch(e=>console.error('media cleanup:',e.message)),mins*60*1000);
  t.unref?.();
}
module.exports={cleanupMedia,cleanupOrphans,startMediaLifecycle};
