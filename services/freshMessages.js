const LIFETIME_MS=48*60*60*1000;
function enabled(){return process.env.FRESH_MESSAGES_ENABLED==='true'}
function activeMessageQuery(filter={},now=new Date()){
  return {...filter,$and:[...(filter.$and||[]),{$or:[{expiresAt:null},{expiresAt:{$gt:now}}]}]};
}
function isActiveMessage(message,now=new Date()){
  return !!message&&(!message.expiresAt||new Date(message.expiresAt)>now);
}
module.exports={LIFETIME_MS,enabled,activeMessageQuery,isActiveMessage};
