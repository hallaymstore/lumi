const webpush=require('web-push');
const PushSubscription=require('../models/PushSubscription');
let configured=false;
function initPush(){const pub=process.env.VAPID_PUBLIC_KEY,priv=process.env.VAPID_PRIVATE_KEY,email=process.env.VAPID_SUBJECT||'mailto:admin@example.com';if(pub&&priv){webpush.setVapidDetails(email,pub,priv);configured=true}return configured}
async function sendPush(userId,payload){if(!configured)return;const subs=await PushSubscription.find({user:userId}).lean();await Promise.all(subs.map(async s=>{try{await webpush.sendNotification({endpoint:s.endpoint,keys:s.keys},JSON.stringify(payload),{TTL:60})}catch(e){if(e.statusCode===404||e.statusCode===410)await PushSubscription.deleteOne({_id:s._id}).catch(()=>{})}}))}
module.exports={initPush,sendPush,isPushConfigured:()=>configured};
