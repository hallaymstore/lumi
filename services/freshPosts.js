// Lumi Fresh: new published posts disappear after 24 hours.
// Legacy posts without expiresAt remain untouched until an explicit migration.
const POST_LIFETIME_MS=24*60*60*1000;
function enabled(){return process.env.FRESH_POSTS_ENABLED==='true'}
function expirationForPublish(now=new Date()){return enabled()?new Date(now.getTime()+POST_LIFETIME_MS):null}
function activeQuery(query={},now=new Date()){
  return {...query,$and:[...(query.$and||[]),{$or:[{expiresAt:null},{expiresAt:{$gt:now}}]}]};
}
function publishedQuery(query={},now=new Date()){
  // Legacy posts written before status was added may not have a stored status.
  return activeQuery({...query,status:{$in:['published',null]},isHidden:false},now);
}
function isActive(post,now=new Date()){
  return !!post&&(!post.expiresAt||new Date(post.expiresAt)>now);
}
module.exports={POST_LIFETIME_MS,enabled,expirationForPublish,activeQuery,publishedQuery,isActive};
