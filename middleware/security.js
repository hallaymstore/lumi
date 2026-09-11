const crypto=require('crypto');

function normalizeOrigin(value){
  if(!value)return null;
  try{
    const url=new URL(String(value).trim());
    if(!['http:','https:'].includes(url.protocol))return null;
    return url.origin;
  }catch{return null}
}

function requestOrigin(req){
  const forwardedProto=String(req.get('x-forwarded-proto')||'').split(',')[0].trim();
  const forwardedHost=String(req.get('x-forwarded-host')||'').split(',')[0].trim();
  const proto=forwardedProto||req.protocol||'https';
  const host=forwardedHost||req.get('host');
  return host?normalizeOrigin(`${proto}://${host}`):null;
}

function allowedOrigins(req){
  const extra=String(process.env.ALLOWED_ORIGINS||'').split(',').map(v=>v.trim()).filter(Boolean);
  return new Set([
    process.env.SITE_URL,
    process.env.RENDER_EXTERNAL_URL,
    requestOrigin(req),
    ...extra
  ].map(normalizeOrigin).filter(Boolean));
}

function sameOriginGuard(req,res,next){
  if(!['POST','PUT','PATCH','DELETE'].includes(req.method))return next();

  const origin=normalizeOrigin(req.get('origin'));
  const referer=normalizeOrigin(req.get('referer'));
  if(process.env.NODE_ENV!=='production'||(!origin&&!referer))return next();

  const source=origin||referer;
  if(!allowedOrigins(req).has(source)){
    return res.status(403).send('Xavfsizlik tekshiruvi muvaffaqiyatsiz.');
  }
  next();
}

function sessionHash(req){
  return crypto.createHash('sha256').update(String(req.sessionID||'')).digest('hex');
}

module.exports={sameOriginGuard,sessionHash,normalizeOrigin,requestOrigin};
