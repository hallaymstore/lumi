/* LumiCoin: non-transferable, non-cash cosmetic credits.
 * ALL earnings are granted by verified server-side events, never a client coin amount.
 * Atomic MongoDB transactions keep the ledger, wallet and inventory synchronized.
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const CoinTransaction = require('../models/CoinTransaction');

const catalog = Object.freeze([
  {id:'frame-aurora',group:'frame',title:'Aurora',description:'Yumshoq pushti va binafsha nurli avatar ramkasi',price:90,icon:'🌸'},
  {id:'frame-royal',group:'frame',title:'Royal Gold',description:'Oltin toj ohangidagi hashamatli ramka',price:180,icon:'👑'},
  {id:'frame-flame',group:'frame',title:'Fire Pulse',description:'Yorqin olov rangli jonli ramka',price:150,icon:'🔥'},
  {id:'frame-frost',group:'frame',title:'Ice Crystal',description:'Moviy kristall ramka',price:120,icon:'❄️'},
  {id:'frame-galaxy',group:'frame',title:'Galaxy',description:'Kosmik ranglarda animatsiyali ramka',price:240,icon:'🌌'},
  {id:'badge-star',group:'badge',title:'Star',description:'Ism yonida dekorativ yulduz',price:55,icon:'⭐'},
  {id:'badge-crown',group:'badge',title:'Crown',description:'Ism yonida dekorativ toj',price:160,icon:'👑'},
  {id:'badge-butterfly',group:'badge',title:'Butterfly',description:'Ism yonida kapalak',price:75,icon:'🦋'},
  {id:'badge-diamond',group:'badge',title:'Diamond',description:'Ism yonida olmos',price:145,icon:'💎'},
  {id:'name-glow',group:'nameplate',title:'Neon Name',description:'Feed va chatdagi yorqin nickname',price:110,icon:'✨'},
  {id:'name-gold',group:'nameplate',title:'Golden Name',description:'Oltin rangdagi nickname',price:175,icon:'🌟'},
  {id:'name-rose',group:'nameplate',title:'Rose Name',description:'Pushti gradient ism',price:95,icon:'🌷'},
  {id:'bubble-lavender',group:'bubble',title:'Lavender Chat',description:'Lavanda rangli chat pufakchalari',price:90,icon:'💜'},
  {id:'bubble-mint',group:'bubble',title:'Mint Chat',description:'Yalpiz rangli chat pufakchalari',price:90,icon:'🍃'},
  {id:'bubble-onyx',group:'bubble',title:'Onyx Chat',description:'Qora-shisha chat uslubi',price:120,icon:'🖤'},
  {id:'theme-dusk',group:'theme',title:'Dusk Profile',description:'Profil uchun shom gradienti',price:150,icon:'🌆'},
  {id:'theme-cosmos',group:'theme',title:'Cosmos Profile',description:'Profil uchun kosmik fon',price:230,icon:'🌠'},
  {id:'theme-pearl',group:'theme',title:'Pearl Profile',description:'Profil uchun sokin oq-marvarid fon',price:140,icon:'🫧'},
  {id:'effect-spark',group:'effect',title:'Sparkle',description:'Profil avatarida mayin yaltirash',price:125,icon:'✨'},
  {id:'effect-halo',group:'effect',title:'Halo',description:'Avatar atrofiga nur halqasi',price:170,icon:'☀️'}
]);
const byId = new Map(catalog.map(x=>[x.id,x]));
const groups = new Set(['frame','badge','nameplate','bubble','theme','effect']);
const rules = Object.freeze({
  welcome:          {coins:25,maxDaily:1},
  upload:           {coins:20,maxDaily:3},
  like:             {coins:1,maxDaily:10},
  comment:          {coins:3,maxDaily:8},
  follow:           {coins:3,maxDaily:5},
  received_like:    {coins:2,maxDaily:30},
  received_comment: {coins:4,maxDaily:20},
  received_follow:  {coins:5,maxDaily:20},
  views_10:         {coins:5,maxDaily:60}
});
const dayStart=()=>{const d=new Date();d.setUTCHours(0,0,0,0);return d;};
// Never call with user-submitted action or key: only trusted route handlers.
async function award(userId, action, subject) {
  const rule = rules[action]; if (!rule || !mongoose.isValidObjectId(userId)) return false;
  const key = 'earn:' + action + ':' + String(userId) + ':' + String(subject||'').slice(0,65);
  const session = await mongoose.startSession(); let granted=false;
  try {
    await session.withTransaction(async()=>{
      const u=await User.findOne({_id:userId,accountOrigin:'organic',managedByPlatform:false,isSuspended:false,phoneVerifiedAt:{$ne:null}}).session(session).select('_id');
      if(!u)return;
      const today=await CoinTransaction.countDocuments({user:userId,action,delta:{$gt:0},createdAt:{$gte:dayStart()}}).session(session);
      if(today>=rule.maxDaily)return;
      await CoinTransaction.create([{user:userId,eventKey:key,action,delta:rule.coins,subject:String(subject||'').slice(0,90)}],{session});
      await User.updateOne({_id:userId},{$inc:{lumiCoins:rule.coins}},{session});
      granted=true;
    },{readConcern:{level:'snapshot'},writeConcern:{w:'majority'}});
  } catch(e) {
    if(e.code!==11000) console.warn('LumiCoin reward:',e.message);
    granted=false;
  } finally {await session.endSession();}
  return granted;
}
async function buy(userId,productId) {
  const product=byId.get(productId);
  if(!product)return {ok:false,error:'Mahsulot mavjud emas.'};
  const session=await mongoose.startSession();
  let result={ok:false,error:'Xarid bajarilmadi.'};
  try{
    await session.withTransaction(async()=>{
      const u=await User.findOne({_id:userId,accountOrigin:'organic',managedByPlatform:false,isSuspended:false}).session(session).select('lumiCoins lumiInventory');
      if(!u){result={ok:false,error:'Akkaunt mavjud emas.'};return;}
      if((u.lumiInventory||[]).includes(productId)){result={ok:false,error:'Bu bezak allaqachon sizniki.'};return;}
      if(Number(u.lumiCoins||0)<product.price){result={ok:false,error:'LumiCoin yetarli emas.'};return;}
      const updated=await User.updateOne({_id:userId,lumiCoins:{$gte:product.price},lumiInventory:{$ne:productId}},{$inc:{lumiCoins:-product.price},$addToSet:{lumiInventory:productId}},{session});
      if(!updated.modifiedCount){throw new Error('Balans o‘zgardi, qayta urinib ko‘ring.');}
      await CoinTransaction.create([{user:userId,eventKey:'buy:'+String(userId)+':'+productId,action:'purchase',delta:-product.price,productId}],{session});
      result={ok:true,item:product};
    },{readConcern:{level:'snapshot'},writeConcern:{w:'majority'}});
  }catch(e){if(e.code!==11000)console.warn('LumiCoin purchase:',e.message);result={ok:false,error:e.code===11000?'Oldin xarid qilingan.':'Xarid bajarilmadi, qayta urinib ko‘ring.'};}
  finally{await session.endSession();}
  return result;
}
async function equip(userId,productId,group) {
  if(!groups.has(group))return {ok:false,error:'Kategoriya xato.'};
  const product=byId.get(productId);
  if(productId!=='none'&&(!product||product.group!==group))return {ok:false,error:'Bezak topilmadi.'};
  const query={_id:userId,accountOrigin:'organic',managedByPlatform:false,isSuspended:false};
  if(productId!=='none')query.lumiInventory=productId;
  const result=await User.updateOne(query,{$set:{['lumiEquipped.'+group]:productId==='none'?'':productId}});
  return result.matchedCount?{ok:true}:{ok:false,error:'Avval marketdan xarid qiling.'};
}
module.exports={catalog,byId,rules,award,buy,equip};
