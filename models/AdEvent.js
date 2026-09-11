const mongoose = require('mongoose');

const adEventSchema = new mongoose.Schema({
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'AdCampaign', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  viewerKey: { type: String, required: true, maxlength: 70 },
  type: { type: String, enum: ['impression', 'click', 'dismiss'], required: true, index: true },
  placement: { type: String, enum: ['feed', 'explore', 'profile', 'post_detail', 'chat_list', 'chat_thread'], required: true, index: true },
  bucket: { type: String, required: true, maxlength: 30 },
  revenue: { type: Number, min: 0, default: 0 }
}, { timestamps: true });

// A refresh or a noisy IntersectionObserver must not bill the same person repeatedly.
adEventSchema.index({ campaign: 1, viewerKey: 1, type: 1, placement: 1, bucket: 1 }, { unique: true });
adEventSchema.index({ createdAt: -1, campaign: 1 });
module.exports = mongoose.model('AdEvent', adEventSchema);
