const mongoose = require('mongoose');

const placements = ['feed', 'explore', 'profile', 'post_detail', 'chat_list', 'chat_thread'];

const adCampaignSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  advertiserName: { type: String, required: true, trim: true, maxlength: 80 },
  title: { type: String, required: true, trim: true, maxlength: 100 },
  body: { type: String, trim: true, maxlength: 260, default: '' },
  imageUrl: { type: String, required: true, trim: true },
  imageKey: { type: String, default: '' },
  thumbUrl: { type: String, default: '' },
  thumbKey: { type: String, default: '' },
  clickUrl: { type: String, required: true, trim: true },
  ctaText: { type: String, trim: true, maxlength: 32, default: "Saytga o'tish" },
  placements: [{ type: String, enum: placements }],
  audience: { type: String, enum: ['all', 'guests', 'members'], default: 'all' },
  status: { type: String, enum: ['draft', 'active', 'paused', 'ended'], default: 'draft', index: true },
  startsAt: { type: Date, default: Date.now },
  endsAt: { type: Date, default: null },
  priority: { type: Number, min: 1, max: 10, default: 5 },
  priceModel: { type: String, enum: ['cpm', 'cpc', 'flat'], default: 'cpm' },
  unitPrice: { type: Number, min: 0, default: 0 },
  budget: { type: Number, min: 0, default: 0 },
  spent: { type: Number, min: 0, default: 0 },
  revenue: { type: Number, min: 0, default: 0 },
  impressions: { type: Number, min: 0, default: 0 },
  clicks: { type: Number, min: 0, default: 0 },
  dismissals: { type: Number, min: 0, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

adCampaignSchema.index({ status: 1, placements: 1, startsAt: 1, endsAt: 1, priority: -1 });
module.exports = mongoose.model('AdCampaign', adCampaignSchema);
module.exports.PLACEMENTS = placements;
