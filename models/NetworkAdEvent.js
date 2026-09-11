const mongoose = require('mongoose');

const networkAdEventSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  viewerKey: { type: String, required: true, maxlength: 70 },
  type: { type: String, enum: ['impression', 'click'], required: true, index: true },
  placement: { type: String, enum: ['feed', 'explore', 'profile', 'post_detail', 'chat_list', 'chat_thread'], required: true, index: true },
  format: { type: String, enum: ['native', 'mobile', 'rectangle', 'desktop', 'leaderboard', 'direct'], required: true, index: true },
  providerState: { type: String, enum: ['provider', 'fallback', 'direct'], default: 'provider', index: true },
  bucket: { type: String, required: true, maxlength: 30 },
  revenue: { type: Number, min: 0, default: 0 }
}, { timestamps: true });

networkAdEventSchema.index({ viewerKey: 1, type: 1, placement: 1, format: 1, bucket: 1 }, { unique: true });
networkAdEventSchema.index({ createdAt: -1, type: 1 });

module.exports = mongoose.model('NetworkAdEvent', networkAdEventSchema);
