const router=require('express').Router();
const bcrypt=require('bcryptjs');
const rateLimit=require('express-rate-limit');
const User=require('../models/User');
const {requireAuth}=require('../middleware/auth');
const {TERMS_VERSION}=require('../middleware/terms');
const {deleteUserAccount}=require('../services/accountDeletion');

const deleteLimiter=rateLimit({windowMs:15*60*1000,max:8,standardHeaders:'draft-8',legacyHeaders:false});
function nextSafe(v){return v&&String(v).startsWith('/')?String(v):'/feed'}

router.get('/privacy',(req,res)=>res.render('legal/privacy',{title:'Privacy Policy',metaTitle:'Lumi Privacy Policy',metaDescription:'Lumi maxfiylik siyosati va foydalanuvchi ma’lumotlarini boshqarish qoidalari.'}));
router.get('/terms',(req,res)=>res.render('legal/terms',{title:'Foydalanish shartlari',termsVersion:TERMS_VERSION,metaTitle:'Lumi Terms of Use',metaDescription:'Lumi foydalanish shartlari va hamjamiyat qoidalari.'}));
router.get('/terms/accept',requireAuth,(req,res)=>res.render('legal/terms-accept',{title:'Shartlarni qabul qilish',termsVersion:TERMS_VERSION,next:nextSafe(req.query.next),error:null}));
router.post('/terms/accept',requireAuth,async(req,res)=>{
  const next=nextSafe(req.body.next);
  if(req.body.accept!=='1')return res.status(400).render('legal/terms-accept',{title:'Shartlarni qabul qilish',termsVersion:TERMS_VERSION,next,error:'Davom etish uchun shartlarni qabul qiling.'});
  await User.findByIdAndUpdate(req.currentUser._id,{termsAcceptedAt:new Date(),termsVersion:TERMS_VERSION});
  return res.redirect(next);
});

router.get('/account-deletion',(req,res)=>res.render('legal/account-deletion',{title:'Akkauntni o‘chirish',error:null,deleted:false,metaTitle:'Lumi account deletion',metaDescription:'Lumi akkaunti va unga bog‘liq ma’lumotlarni o‘chirish.'}));
router.post('/account-deletion',deleteLimiter,requireAuth,async(req,res)=>{
  try{
    if(req.body.confirm!=='1')throw new Error('Akkaunt o‘chirilishini tasdiqlang.');
    const user=await User.findById(req.currentUser._id).select('passwordHash').lean();
    if(!user||!(await bcrypt.compare(String(req.body.password||''),user.passwordHash)))throw new Error('Parol noto‘g‘ri.');
    await deleteUserAccount(req.currentUser._id);
    req.session.destroy(()=>res.redirect('/account-deleted'));
  }catch(e){
    return res.status(400).render('legal/account-deletion',{title:'Akkauntni o‘chirish',error:e.message||'Akkaunt o‘chirilmadi.',deleted:false,metaTitle:'Lumi account deletion',metaDescription:'Lumi akkaunti va unga bog‘liq ma’lumotlarni o‘chirish.'});
  }
});
router.get('/account-deleted',(req,res)=>res.render('legal/account-deleted',{title:'Akkaunt o‘chirildi',metaTitle:'Lumi account deleted',metaDescription:'Lumi akkaunti o‘chirildi.'}));
module.exports=router;
