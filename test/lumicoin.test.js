const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {catalog,rules}=require('../services/lumicoin');
const read=x=>fs.readFileSync(path.join(__dirname,'..',x),'utf8');

test('Marketplace products are unique, cosmetic-only and priced in non-cash coins',()=>{
  assert.equal(catalog.length,20);
  assert.equal(new Set(catalog.map(i=>i.id)).size,catalog.length);
  assert.equal(catalog.filter(i=>i.group==='frame').length,5);
  for(const p of catalog){
    assert.match(p.id,/^(frame|badge|name|bubble|theme|effect)-[a-z]+$/);
    assert.ok(['frame','badge','nameplate','bubble','theme','effect'].includes(p.group));
    assert.ok(Number.isSafeInteger(p.price)&&p.price>0);
    assert.ok(p.title&&p.description);
  }
});
test('Earnings have daily caps and only trusted server actions have coin values',()=>{
  for(const r of Object.values(rules)){
    assert.ok(Number.isSafeInteger(r.coins)&&r.coins>0&&r.coins<=25);
    assert.ok(Number.isSafeInteger(r.maxDaily)&&r.maxDaily<=60);
  }
  const service=read('services/lumicoin.js');
  assert.match(service,/phoneVerifiedAt:.*ne:null/);
  assert.match(service,/accountOrigin:'organic'/);
  assert.match(service,/managedByPlatform:false/);
  assert.match(service,/CoinTransaction.create/);
  assert.match(service,/withTransaction/);
  assert.match(service,/lumiCoins:\{\$gte:product.price\}/);
  assert.match(service,/lumiInventory:\{\$ne:productId\}/);
});
test('Cosmetic frame propagates to feed, profile, chat, and comments',()=>{
  for(const f of ['views/partials/postcard.ejs','views/profile/show.ejs','views/chats/show.ejs','views/chats/index.ejs','public/js/app.js'])assert.match(read(f),/lumi-frame-/);
  assert.match(read('views/chats/show.ejs'),/data-peer-bubble/);
  assert.match(read('routes/posts.js'),/lumiEquipped/);
});
test('Inline feed video plays in its card; fullscreen requires explicit control',()=>{
  const player=read('public/js/lumi-video-v13.js');
  assert.match(player,/onMount/);assert.match(player,/requestFullscreen/);
  assert.match(player,/playsinline/);assert.match(player,/IntersectionObserver/);
  assert.doesNotMatch(player,/location\.href|window\.location/);
  assert.match(read('views/partials/postcard.ejs'),/data-video-toggle/);
});
