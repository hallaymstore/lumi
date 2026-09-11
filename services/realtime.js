const clients=new Map();
let publisher=null,subscriber=null,redisReady=false;
const channel=process.env.REDIS_CHANNEL||'lumi:realtime';
function deliver(userId,event,payload={}){const set=clients.get(String(userId));if(!set)return;const chunk=`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;for(const res of set){try{res.write(chunk)}catch(_){}}}
async function initRealtime(){if(!process.env.REDIS_URL)return false;try{const {createClient}=require('redis');publisher=createClient({url:process.env.REDIS_URL});subscriber=publisher.duplicate();publisher.on('error',e=>console.error('Redis publisher:',e.message));subscriber.on('error',e=>console.error('Redis subscriber:',e.message));await Promise.all([publisher.connect(),subscriber.connect()]);await subscriber.subscribe(channel,raw=>{try{const m=JSON.parse(raw);deliver(m.userId,m.event,m.payload)}catch(_){}});redisReady=true;console.log('Lumi realtime: Redis Pub/Sub connected');return true}catch(e){console.warn('Redis realtime fallback to local SSE:',e.message);return false}}
function addClient(userId,res){const key=String(userId);if(!clients.has(key))clients.set(key,new Set());clients.get(key).add(res);return()=>{const set=clients.get(key);if(!set)return;set.delete(res);if(!set.size)clients.delete(key)}}
function emitToUser(userId,event,payload={}){deliver(userId,event,payload);if(redisReady&&publisher)publisher.publish(channel,JSON.stringify({userId:String(userId),event,payload})).catch(()=>{})}
function emitToUsers(ids,event,payload={}){[...new Set((ids||[]).map(String))].forEach(id=>emitToUser(id,event,payload))}
function onlineUserIds(){return new Set(clients.keys())} function isOnline(id){return clients.has(String(id))}
module.exports={addClient,emitToUser,emitToUsers,onlineUserIds,isOnline,initRealtime};
