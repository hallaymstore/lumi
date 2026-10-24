const router=require('express').Router();
const User=require('../models/User');
const CoinTransaction=require('../models/CoinTransaction');
const {requireAuth}=require('../middleware/auth');
const {catalog,rules,award,buy,equip}=require('../services/lumicoin');

router.get('/market',requireAuth,async(req,res)=>{
  await award(req.currentUser._id,'welcome','v1');
  const [user,history]=await Promise.all([
    User.findById(req.currentUser._id).select('name username lumiCoins lumiInventory lumiEquipped phoneVerifiedAt').lean(),
    CoinTransaction.find({user:req.currentUser._id}).sort({createdAt:-1}).limit(25).lean()
  ]);
  res.locals.currentUser.lumiCoins=user?.lumiCoins||0;
  res.set('Cache-Control','private, no-store');
  res.render('market/index',{title:'Lumi Market',wallet:user,catalog,rules,history,error:req.query.error||'',success:req.query.success||''});
});
router.get('/api/lumicoin',requireAuth,async(req,res)=>{
  const u=await User.findById(req.currentUser._id).select('lumiCoins lumiInventory lumiEquipped phoneVerifiedAt').lean();
  res.set('Cache-Control','private, no-store');
  res.json({ok:true,balance:u?.lumiCoins||0,inventory:u?.lumiInventory||[],equipped:u?.lumiEquipped||{},eligible:!!u?.phoneVerifiedAt});
});
router.post('/market/buy/:id',requireAuth,async(req,res)=>{
  const result=await buy(req.currentUser._id,String(req.params.id));
  if((req.get('accept')||'').includes('application/json'))return res.status(result.ok?200:409).json(result);
  res.redirect('/market?'+(result.ok?'success='+encodeURIComponent('Xarid qilindi!'):'error='+encodeURIComponent(result.error)));
});
router.post('/market/equip/:group/:id',requireAuth,async(req,res)=>{
  const result=await equip(req.currentUser._id,String(req.params.id),String(req.params.group));
  if((req.get('accept')||'').includes('application/json'))return res.status(result.ok?200:400).json(result);
  res.redirect('/market?'+(result.ok?'success='+encodeURIComponent('Bezak faol qilindi!'):'error='+encodeURIComponent(result.error)));
});
module.exports=router;
