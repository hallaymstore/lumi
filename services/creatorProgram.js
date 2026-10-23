const Follow=require('../models/Follow');
const Report=require('../models/Report');
const CreatorMetricDaily=require('../models/CreatorMetricDaily');
const THRESHOLDS=Object.freeze({accountDays:30,realFollowers:500,qualifiedViews30:10000,originalPosts30:5});
function hasPro(u){return !!u?.proExpiresAt&&new Date(u.proExpiresAt).getTime()>Date.now()&&u.accountOrigin!=='synthetic'&&!u.managedByPlatform&&!u.isSuspended}
async function recordCreatorMetric(id,type){
 if(!id||!['originalPosts','qualifiedViews'].includes(type))return;
 const query={creator:id,day:new Date().toISOString().slice(0,10)},inc={$inc:{[type]:1}};
 try{await CreatorMetricDaily.updateOne(query,inc,{upsert:true})}catch(e){if(e.code===11000)await CreatorMetricDaily.updateOne(query,inc);else throw e}
}
async function getEligibility(u){
 if(!u?._id)throw Error('Akkaunt topilmadi');
 const since=new Date(Date.now()-30*864e5).toISOString().slice(0,10);
 const [metrics,followers,violations]=await Promise.all([
  CreatorMetricDaily.find({creator:u._id,day:{$gte:since}}).select('originalPosts qualifiedViews').lean(),
  Follow.aggregate([
   {$match:{following:u._id,status:'accepted',interactionOrigin:{$ne:'synthetic'}}},
   {$lookup:{from:'users',localField:'follower',foreignField:'_id',as:'real'}},
   {$unwind:'$real'},
   {$match:{'real.accountOrigin':{$ne:'synthetic'},'real.managedByPlatform':{$ne:true},'real.isSuspended':{$ne:true}}},
   {$limit:THRESHOLDS.realFollowers},
   {$count:'n'}
  ]),
  Report.countDocuments({reportedUser:u._id,status:'actioned',reviewedAt:{$gte:new Date(Date.now()-90*864e5)}})
 ]);
 const totals=metrics.reduce((a,m)=>({originalPosts:a.originalPosts+(m.originalPosts||0),qualifiedViews:a.qualifiedViews+(m.qualifiedViews||0)}),{originalPosts:0,qualifiedViews:0});
 const accountDays=Math.max(0,Math.floor((Date.now()-new Date(u.createdAt||Date.now()).getTime())/864e5)),realFollowers=followers[0]?.n||0;
 const org=u.accountOrigin!=='synthetic'&&!u.managedByPlatform;
 const rules=[
  {title:'Haqiqiy hisob',value:org?'Tasdiqlandi':'Virtual/test hisob',passed:org},
  {title:'18 yoshdan katta',value:u.ageConfirmed18?'Tasdiqlandi':'Tasdiqlanmagan',passed:!!u.ageConfirmed18},
  {title:'Telefon OTP tasdiqlangan',value:u.phoneVerifiedAt?'Tasdiqlandi':'Tasdiqlanmagan',passed:!!u.phoneVerifiedAt},
  {title:'Hisob yoshi',value:accountDays+' / 30 kun',passed:accountDays>=30},
  {title:'Ochiq va faol profil',value:u.isPrivate?'Yopiq':u.isSuspended?'Bloklangan':'Ochiq',passed:!u.isPrivate&&!u.isSuspended},
  {title:'Haqiqiy obunachilar',value:realFollowers+' / 500',passed:realFollowers>=500},
  {title:'30 kunlik tasdiqlangan ko‘rishlar',value:totals.qualifiedViews+' / 10 000',passed:totals.qualifiedViews>=10000},
  {title:'30 kunlik original postlar',value:totals.originalPosts+' / 5',passed:totals.originalPosts>=5},
  {title:'Qoidabuzarlik yo‘q (90 kun)',value:violations?'Cheklov bor':'Bajarilgan',passed:!violations}
 ];
 return {rules,eligible:rules.every(r=>r.passed),totals,realFollowers,accountDays};
}
module.exports={THRESHOLDS,hasPro,recordCreatorMetric,getEligibility};
