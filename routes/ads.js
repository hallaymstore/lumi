const router = require('express').Router();
const mongoose = require('mongoose');
const AdCampaign = require('../models/AdCampaign');
const { recordAdEvent } = require('../services/ads');

const placements = new Set(['feed', 'explore', 'profile', 'post_detail', 'chat_list', 'chat_thread']);
function cleanPlacement(value) { return placements.has(String(value)) ? String(value) : 'feed'; }

const networkFormats = {
  mobile: { key: process.env.AD_NETWORK_320X50 || '6b925f0b8d93621304372c56656c6803', width: 320, height: 50 },
  rectangle: { key: process.env.AD_NETWORK_300X250 || 'c520d7891b76bd627446d465f30a3bf3', width: 300, height: 250 },
  desktop: { key: process.env.AD_NETWORK_468X60 || '8655fc4caef0474209b493a96e6268db', width: 468, height: 60 },
  leaderboard: { key: process.env.AD_NETWORK_728X90 || '3aec706d29577502f77586082a27f7a3', width: 728, height: 90 }
};

router.get('/ads/network/:format', (req, res) => {
  const format = networkFormats[req.params.format];
  if (!format) return res.sendStatus(404);
  res.set({
    'Cache-Control': 'public, max-age=300',
    'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline' https://www.highperformanceformat.com; frame-src https:; connect-src https:; img-src https: data:; style-src 'unsafe-inline'",
    'Referrer-Policy': 'no-referrer-when-downgrade'
  });
  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}body{display:grid;place-items:center}</style></head><body><script>atOptions={key:${JSON.stringify(format.key)},format:'iframe',height:${format.height},width:${format.width},params:{}};<\/script><script src="https://www.highperformanceformat.com/${format.key}/invoke.js"><\/script></body></html>`);
});

router.post('/api/ads/:id/:type', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id) || !['impression', 'dismiss'].includes(req.params.type)) return res.status(400).json({ ok: false });
  const campaign = await AdCampaign.findOne({ _id: req.params.id, status: 'active' });
  if (!campaign) return res.status(404).json({ ok: false });
  const result = await recordAdEvent(req, res, campaign, req.params.type, cleanPlacement(req.body.placement));
  res.json({ ok: true, counted: result.counted });
});

router.get('/ads/:id/go', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.redirect('/feed');
  const campaign = await AdCampaign.findById(req.params.id);
  if (!campaign) return res.redirect('/feed');
  if (campaign.status === 'active') await recordAdEvent(req, res, campaign, 'click', cleanPlacement(req.query.placement)).catch(() => {});
  res.set('Cache-Control', 'no-store');
  res.redirect(302, campaign.clickUrl);
});

module.exports = router;
