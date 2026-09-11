const router=require('express').Router();const PushSubscription=require('../models/PushSubscription');const {requireAuth}=require('../middleware/auth');
router.get('/api/push/public-key',(req,res)=>res.json({ok:true,key:process.env.VAPID_PUBLIC_KEY||''}));
router.post('/api/push/subscribe',requireAuth,async(req,res)=>{const s=req.body;if(!s?.endpoint||!s.keys?.p256dh||!s.keys?.auth)return res.status(400).json({ok:false});await PushSubscription.findOneAndUpdate({endpoint:s.endpoint},{$set:{user:req.currentUser._id,keys:s.keys,userAgent:String(req.get('user-agent')||'').slice(0,300)}},{upsert:true,new:true});res.json({ok:true})});
router.post('/api/push/unsubscribe',requireAuth,async(req,res)=>{await PushSubscription.deleteMany({user:req.currentUser._id,endpoint:req.body.endpoint});res.json({ok:true})});
module.exports=router;
