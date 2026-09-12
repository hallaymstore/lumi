const router = require('express').Router();
const mongoose = require('mongoose');
const AdCampaign = require('../models/AdCampaign');
const { recordAdEvent, recordNetworkAdEvent } = require('../services/ads');

const placements = new Set(['feed', 'explore', 'profile', 'post_detail', 'chat_list', 'chat_thread']);
function cleanPlacement(value) { return placements.has(String(value)) ? String(value) : 'feed'; }

const networkFormats = {
  native: {
    type: 'native',
    src: process.env.AD_NETWORK_NATIVE || 'https://pl29295128.profitablecpmratenetwork.com/e884bc1779f790089be3868bcb7ae57b/invoke.js',
    container: 'container-e884bc1779f790089be3868bcb7ae57b',
    width: 300, height: 250
  },
  mobile: { type: 'banner', key: process.env.AD_NETWORK_320X50 || '6b925f0b8d93621304372c56656c6803', width: 320, height: 50 },
  rectangle: { type: 'banner', key: process.env.AD_NETWORK_300X250 || 'c520d7891b76bd627446d465f30a3bf3', width: 300, height: 250 },
  desktop: { type: 'banner', key: process.env.AD_NETWORK_468X60 || '8655fc4caef0474209b493a96e6268db', width: 468, height: 60 },
  leaderboard: { type: 'banner', key: process.env.AD_NETWORK_728X90 || '3aec706d29577502f77586082a27f7a3', width: 728, height: 90 }
};

const defaultDirectNetworkUrl = 'https://www.profitablecpmratenetwork.com/q7hhu8g35?key=51a08a3230830f281dc529266b20a71e';

router.get('/ads/network/direct', (req, res) => {
  let target = defaultDirectNetworkUrl;
  try {
    const candidate = new URL(process.env.AD_NETWORK_DIRECT_URL || target);
    if (candidate.protocol === 'https:') target = candidate.href;
  } catch {}
  const placement = cleanPlacement(req.query.placement);
  const format = ['native', 'mobile', 'rectangle', 'desktop', 'leaderboard', 'direct'].includes(String(req.query.format))
    ? String(req.query.format) : 'direct';
  recordNetworkAdEvent(req, res, { type: 'click', placement, format, providerState: 'direct' })
    .catch(() => {})
    .finally(() => res.set('Cache-Control', 'no-store').redirect(302, target));
});

router.get('/ads/network/:format', (req, res) => {
  const formatName = String(req.params.format || '');
  const format = networkFormats[formatName];
  if (!format) return res.sendStatus(404);

  const providerUrl = format.type === 'native'
    ? format.src
    : `https://www.highperformanceformat.com/${format.key}/invoke.js`;
  const container = format.type === 'native'
    ? `<div id="${format.container}" class="native-slot" aria-label="Sponsored content"></div>`
    : '';
  const setup = format.type === 'native'
    ? ''
    : `window.atOptions={key:${JSON.stringify(format.key)},format:'iframe',height:${format.height},width:${format.width},params:{}};`;

  // This document contains only a third-party ad unit. Keep it isolated from the
  // application and permissive enough for provider subresources to load.
  res.set({
    'Cache-Control': 'no-store, max-age=0',
    'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline' https:; frame-src https:; child-src https:; connect-src https:; img-src https: data: blob:; media-src https: data: blob:; style-src 'unsafe-inline'; font-src https: data:; base-uri 'none'; form-action https:",
    'Referrer-Policy': 'no-referrer-when-downgrade',
    'X-Robots-Tag': 'noindex, nofollow, noarchive'
  });

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}body{display:grid;place-items:center}.native-slot{width:100%;height:100%;overflow:hidden;display:grid;place-items:center}iframe,img{max-width:100%}
</style></head><body>${container}<script>(()=>{
let settled=false;
const notify=(state,detail='')=>{if(settled)return;if(state==='ready'||state==='empty'||state==='error')settled=true;try{parent.postMessage({type:'lumi-adsterra',state,format:${JSON.stringify(formatName)},detail},'*')}catch(_){}};
${setup}
const creativePresent=()=>{
  if(${JSON.stringify(format.type)}==='native'){
    const box=document.getElementById(${JSON.stringify(format.container)});
    return !!box && (box.childElementCount>0 || !!box.querySelector('iframe,a[href],img[src]'));
  }
  return !!document.querySelector('iframe,a[href],img[src]');
};
const watch=()=>{if(creativePresent()){notify('ready','creative-detected');return true}return false};
const observer=new MutationObserver(()=>watch());observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src','href']});
const script=document.createElement('script');script.async=true;script.src=${JSON.stringify(providerUrl)};script.onload=()=>setTimeout(watch,60);script.onerror=()=>notify('error','provider-script');document.body.appendChild(script);
const poll=setInterval(()=>{if(settled){clearInterval(poll);observer.disconnect();return}watch()},220);
setTimeout(()=>{clearInterval(poll);observer.disconnect();if(!settled)notify('empty','timeout')},6800);
})();<\/script></body></html>`;

  res.type('html').send(html);
});

router.post('/api/ads/network/:type', async (req, res) => {
  if (req.params.type !== 'impression') return res.status(400).json({ ok: false });
  const format = ['native', 'mobile', 'rectangle', 'desktop', 'leaderboard'].includes(String(req.body.format))
    ? String(req.body.format) : 'native';
  const providerState = req.body.providerState === 'provider' ? 'provider' : 'fallback';
  const result = await recordNetworkAdEvent(req, res, {
    type: 'impression',
    placement: cleanPlacement(req.body.placement),
    format,
    providerState
  });
  res.json({ ok: true, counted: result.counted });
});

router.post('/api/ads/:id/:type', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id) || !['impression', 'dismiss'].includes(req.params.type)) {
    return res.status(400).json({ ok: false });
  }
  const campaign = await AdCampaign.findOne({ _id: req.params.id, status: 'active' });
  if (!campaign) return res.status(404).json({ ok: false });
  const result = await recordAdEvent(req, res, campaign, req.params.type, cleanPlacement(req.body.placement));
  res.json({ ok: true, counted: result.counted });
});

router.get('/ads/:id/go', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.redirect('/feed');
  const campaign = await AdCampaign.findById(req.params.id);
  if (!campaign) return res.redirect('/feed');
  if (campaign.status === 'active') {
    await recordAdEvent(req, res, campaign, 'click', cleanPlacement(req.query.placement)).catch(() => {});
  }
  res.set('Cache-Control', 'no-store');
  res.redirect(302, campaign.clickUrl);
});

module.exports = router;
