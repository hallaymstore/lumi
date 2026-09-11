const Story=require('../models/Story');
const Message=require('../models/Message');
const Post=require('../models/Post');
const User=require('../models/User');
const {deleteMany,listPrefix,configured}=require('./r2');
let lastOrphanScan=0;
async function markArchivedStories(){await Story.updateMany({expiresAt:{$lt:new Date()},archivedAt:null},{$set:{archivedAt:new Date()}}).catch(()=>{})}
async function cleanupConsumed(){const consumed=await Message.find({ephemeral:true,ephemeralConsumedAt:{$ne:null},mediaKey:{$ne:''}}).limit(200);for(const m of consumed){await deleteMany([m.mediaKey]);m.mediaKey='';m.mediaUrl='';await m.save()}}
async function referencedKeys(){const [posts,stories,users,messages]=await Promise.all([Post.find({}).select('imageKey media.key media.thumbKey').lean(),Story.find({}).select('mediaKey thumbKey musicKey').lean(),User.find({}).select('avatarKey').lean(),Message.find({mediaKey:{$ne:''}}).select('mediaKey').lean()]);const set=new Set();for(const p of posts){if(p.imageKey)set.add(p.imageKey);for(const m of p.media||[]){if(m.key)set.add(m.key);if(m.thumbKey)set.add(m.thumbKey)}}for(const s of stories){if(s.mediaKey)set.add(s.mediaKey);if(s.thumbKey)set.add(s.thumbKey);if(s.musicKey)set.add(s.musicKey)}for(const u of users)if(u.avatarKey)set.add(u.avatarKey);for(const m of messages)if(m.mediaKey)set.add(m.mediaKey);return set}
async function cleanupOrphans(){if(!configured()||process.env.R2_ORPHAN_SCAN==='false')return;const now=Date.now();if(now-lastOrphanScan<6*60*60*1000)return;lastOrphanScan=now;const refs=await referencedKeys(),cut=now-24*60*60*1000;for(const prefix of ['posts/','stories/','story-music/','avatars/','chat/','chat-once/']){const objects=await listPrefix(prefix,2500).catch(()=>[]);const oldOrphans=objects.filter(o=>o.Key&&!refs.has(o.Key)&&new Date(o.LastModified||0).getTime()<cut).map(o=>o.Key);for(let i=0;i<oldOrphans.length;i+=100)await deleteMany(oldOrphans.slice(i,i+100))}}
async function cleanupMedia(){await markArchivedStories();await cleanupConsumed();await cleanupOrphans()}
function startMediaLifecycle(){cleanupMedia().catch(e=>console.error('media cleanup:',e.message));const mins=Math.max(5,Number(process.env.MEDIA_CLEANUP_MINUTES||30));const t=setInterval(()=>cleanupMedia().catch(e=>console.error('media cleanup:',e.message)),mins*60*1000);t.unref?.()}
module.exports={cleanupMedia,cleanupOrphans,startMediaLifecycle};
