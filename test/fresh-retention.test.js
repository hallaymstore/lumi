const test=require('node:test');
const assert=require('node:assert/strict');
const {expirationForPublish,activeQuery,publishedQuery,isActive,POST_LIFETIME_MS}=require('../services/freshPosts');
const {activeMessageQuery,isActiveMessage,LIFETIME_MS}=require('../services/freshMessages');
test('Fresh post expires precisely 24h after publish, opt-in only',()=>{
  const now=new Date('2026-11-01T10:00:00Z');
  const old=process.env.FRESH_POSTS_ENABLED;
  process.env.FRESH_POSTS_ENABLED='false';
  assert.equal(expirationForPublish(now),null);
  process.env.FRESH_POSTS_ENABLED='true';
  assert.equal(+expirationForPublish(now),+now+POST_LIFETIME_MS);
  if(old===undefined)delete process.env.FRESH_POSTS_ENABLED;
  else process.env.FRESH_POSTS_ENABLED=old;
});
test('Expired posts not visible even before physical deletion',()=>{
  const now=new Date('2026-11-01T10:00:00Z');
  assert.equal(isActive({expiresAt:new Date(+now-1)},now),false);
  assert.equal(isActive({expiresAt:new Date(+now+1)},now),true);
  assert.equal(isActive({expiresAt:null},now),true);
  const q=publishedQuery({author:'test'},now);
  assert.equal(q.author,'test');assert.deepEqual(q.status,{$in:['published',null]});assert.equal(q.isHidden,false);
  assert.ok(Array.isArray(q.$and));
  assert.ok(Array.isArray(activeQuery({},now).$and));
});
test('Expired chat messages are hidden from reads',()=>{
  const now=new Date('2026-11-01T10:00:00Z');
  assert.equal(LIFETIME_MS,48*60*60*1000);
  assert.equal(isActiveMessage({expiresAt:new Date(+now-1)},now),false);
  assert.equal(isActiveMessage({expiresAt:new Date(+now+1)},now),true);
  const query=activeMessageQuery({conversation:'id'},now);
  assert.equal(query.conversation,'id');assert.ok(Array.isArray(query.$and));
});
