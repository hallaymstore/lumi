const router = require('express').Router();
const mongoose = require('mongoose');
const AdCampaign = require('../models/AdCampaign');
const { recordAdEvent } = require('../services/ads');

const placements = new Set(['feed', 'explore', 'profile', 'post_detail', 'chat_list', 'chat_thread']);
function cleanPlacement(value) { return placements.has(String(value)) ? String(value) : 'feed'; }

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
