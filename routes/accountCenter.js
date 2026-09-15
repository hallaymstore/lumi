const router=require('express').Router();
const User=require('../models/User');
const {requireAuth}=require('../middleware/auth');
const options=[['lifestyle','Lifestyle'],['beauty','Beauty'],['fashion','Moda'],['gaming','Gaming'],['tech','Texnologiya'],['education','Ta’lim'],['art','San’at'],['music','Musiqa'],['food','Taom'],['travel','Sayohat'],['fitness','Fitness'],['cars','Avto'],['humor','Humor']].map(([key,label])=>({key,label}));
const optionKeys=new Set(options.map(x=>x.key));
const categories=[...options,{key:'other',label:'Boshqa'}];const categoryKeys=new Set(categories.map(x=>x.key));
function vals(v){return (Array.isArray(v)?v:[v]).map(x=>String(x||'').trim().toLowerCase()).filter(Boolean)}
router.get('/account',requireAuth,async(req,res)=>{const me=await User.findById(req.currentUser._id).lean();res.set('Cache-Control','no-store');res.render('account',{title:'Akkaunt markazi',me,options,categories,saved:req.query.saved==='1'})});
router.post('/account/preferences',requireAuth,async(req,res)=>{const interests=vals(req.body.interests).filter(x=>optionKeys.has(x)).slice(0,8),creatorMode=req.body.creatorMode==='on',creatorCategory=categoryKeys.has(String(req.body.creatorCategory||''))?String(req.body.creatorCategory):'';const update={interests,creatorMode,creatorCategory:creatorMode?(creatorCategory||'other'):''};if(creatorMode&&!req.currentUser.creatorMode)update.creatorSince=new Date();if(!creatorMode)update.creatorSince=null;await User.findByIdAndUpdate(req.currentUser._id,update);res.redirect('/account?saved=1')});
module.exports=router;
