const test=require('node:test');
const assert=require('node:assert/strict');
const {hasPro,THRESHOLDS}=require('../services/creatorProgram');
test('Pro only for current, non-suspended organic accounts',()=>{
 const active={proExpiresAt:new Date(Date.now()+864e5),accountOrigin:'organic',managedByPlatform:false,isSuspended:false};
 assert.equal(hasPro(active),true);
 assert.equal(hasPro({...active,proExpiresAt:new Date(Date.now()-1000)}),false);
 assert.equal(hasPro({...active,accountOrigin:'synthetic'}),false);
 assert.equal(hasPro({...active,managedByPlatform:true}),false);
 assert.equal(hasPro({...active,isSuspended:true}),false);
 assert.equal(hasPro({...active,proExpiresAt:null}),false);
});
test('Monetization thresholds are explicit and nonzero',()=>{
 assert.deepEqual(THRESHOLDS,{accountDays:30,realFollowers:500,qualifiedViews30:10000,originalPosts30:5});
});
