const router=require('express').Router();
const mongoose=require('mongoose');
const User=require('../models/User');
const App=require('../models/MonetizationApplication');
const Metric=require('../models/CreatorMetricDaily');
const AdminLog=require('../models/AdminLog');
const {requireAuth,requireAdmin}=require('../middleware/auth');
const {hasPro,getEligibility}=require('../services/creatorProgram');
router.use((req,res,next)=>{res.set('Cache-Control','no-store');next()});
router.get('/creator/program',requireAuth,async(req,res)=>{
 const [eligibility,application]=await Promise.all([getEligibility(req.currentUser),App.findOne({user:req.currentUser._id}).lean()]);
 const since=new Date(Date.now()-90*864e5).toISOString().slice(0,10);
 const daily=hasPro(req.currentUser)?await Metric.find({creator:req.currentUser._id,day:{$gte:since}}).sort({day:1}).lean():[];
 res.render('creator/program',{title:'Lumi Pro va monetizatsiya',eligibility,application,daily,proActive:hasPro(req.currentUser),ok:String(req.query.ok||''),error:String(req.query.error||'')});
});
router.post('/creator/program/apply',requireAuth,async(req,res)=>{
 const target='/creator/program';
 const state=await getEligibility(req.currentUser);
 if(!state.eligible)return res.redirect(target+'?error='+encodeURIComponent('Hali barcha talablar bajarilmagan.'));
 if(req.body.originalContent!=='on'||req.body.acceptPolicy!=='on')return res.redirect(target+'?error='+encodeURIComponent('Dastur shartlarini va original kontentni tasdiqlang.'));
 const old=await App.findOne({user:req.currentUser._id});
 if(old&&['pending','approved'].includes(old.status))return res.redirect(target+'?error='+encodeURIComponent('Ariza allaqachon mavjud.'));
 if(old&&Date.now()-new Date(old.updatedAt).getTime()<30*864e5)return res.redirect(target+'?error='+encodeURIComponent('Rad javobidan 30 kun keyin qayta murojaat qiling.'));
 try{await App.findOneAndUpdate({user:req.currentUser._id},{$set:{status:'pending',reviewedAt:null,reviewedBy:null,note:'',rulesAcceptedAt:new Date(),snapshot:{realFollowers:state.realFollowers,qualifiedViews30:state.totals.qualifiedViews,posts30:state.totals.originalPosts}}},{upsert:true,new:true,runValidators:true})}
 catch(e){if(e.code===11000)return res.redirect(target+'?error='+encodeURIComponent('Ariza oldin yuborilgan.'));throw e}
 return res.redirect(target+'?ok='+encodeURIComponent('Ariza qabul qilindi va ko‘rib chiqiladi.'));
});
router.get('/admin/creator-program',requireAuth,requireAdmin,async(req,res)=>{
 const q=String(req.query.q||'').toLowerCase().replace(/[^a-z0-9._]/g,'').slice(0,24);
 const [applications,users]=await Promise.all([App.find().sort({status:1,updatedAt:-1}).limit(75).populate('user','name username').lean(),User.find(q?{username:{$regex:q}}:{}).sort({createdAt:-1}).select('name username accountOrigin managedByPlatform proExpiresAt').limit(35).lean()]);
 res.render('admin/creator-program',{title:'Lumi Creator · admin',applications,users,q,ok:String(req.query.ok||'')});
});
router.post('/admin/creator-program/application/:id',requireAuth,requireAdmin,async(req,res)=>{
 if(!mongoose.isValidObjectId(req.params.id))return res.sendStatus(400);
 const status=String(req.body.status||'');
 if(!['approved','rejected'].includes(status))return res.sendStatus(400);
 const item=await App.findOneAndUpdate({_id:req.params.id,status:'pending'},{$set:{status,reviewedAt:new Date(),reviewedBy:req.currentUser._id,note:String(req.body.note||'').trim().slice(0,600)}},{new:true});
 if(!item)return res.sendStatus(409);
 await AdminLog.create({admin:req.currentUser._id,action:'creator.application.'+status,targetType:'user',targetId:String(item.user)}).catch(()=>{});
 res.redirect('/admin/creator-program?ok='+encodeURIComponent('Ariza holati yangilandi.'));
});
router.post('/admin/creator-program/pro/:id',requireAuth,requireAdmin,async(req,res)=>{
 if(!mongoose.isValidObjectId(req.params.id))return res.sendStatus(400);
 const days=Number(req.body.days);
 if(![0,30,90].includes(days))return res.sendStatus(400);
 const u=await User.findById(req.params.id);
 if(!u||u.accountOrigin==='synthetic'||u.managedByPlatform)return res.sendStatus(400);
 u.proExpiresAt=days?new Date(Date.now()+days*864e5):null;
 u.proGrantedAt=days?new Date():null;
 if(!days){u.proTheme='default';u.creatorLink=''}
 await u.save();
 await AdminLog.create({admin:req.currentUser._id,action:days?'creator.pro.grant':'creator.pro.revoke',targetType:'user',targetId:String(u._id),details:days+' days'}).catch(()=>{});
 res.redirect('/admin/creator-program?ok='+encodeURIComponent('Pro holati yangilandi.'));
});
module.exports=router;
