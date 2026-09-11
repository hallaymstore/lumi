const crypto=require('crypto');
function sameOriginGuard(req,res,next){if(!['POST','PUT','PATCH','DELETE'].includes(req.method))return next();const origin=req.get('origin');const referer=req.get('referer');if(process.env.NODE_ENV!=='production'||!origin&&!referer)return next();const expected=String(process.env.SITE_URL||`${req.protocol}://${req.get('host')}`).replace(/\/$/,'');const source=origin||referer||'';if(!source.startsWith(expected))return res.status(403).send('Xavfsizlik tekshiruvi muvaffaqiyatsiz.');next()}
function sessionHash(req){return crypto.createHash('sha256').update(String(req.sessionID||'')).digest('hex')}
module.exports={sameOriginGuard,sessionHash};
