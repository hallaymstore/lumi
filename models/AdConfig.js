const mongoose = require('mongoose');

const adConfigSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'global' },
  enabled: { type: Boolean, default: true },

  // Legacy fixed interval remains as a safe fallback when Smart Delivery is off.
  feedInterval: { type: Number, min: 3, max: 20, default: 5 },

  // Smart Ad Delivery: vary ad spacing so the feed never feels like "every N posts = ad".
  smartDelivery: { type: Boolean, default: true },
  firstAdMin: { type: Number, min: 3, max: 12, default: 5 },
  firstAdMax: { type: Number, min: 3, max: 14, default: 6 },
  gapMin: { type: Number, min: 3, max: 15, default: 4 },
  gapMax: { type: Number, min: 3, max: 20, default: 7 },

  ctaDelaySeconds: { type: Number, min: 1, max: 10, default: 3 },
  maxAdsPerPage: { type: Number, min: 1, max: 20, default: 6 },
  profileEnabled: { type: Boolean, default: true },
  chatsEnabled: { type: Boolean, default: true },
  networkEnabled: { type: Boolean, default: true },
  networkEcpm: { type: Number, min: 0, max: 100, default: 0.5 },
  label: { type: String, maxlength: 24, default: 'Reklama' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('AdConfig', adConfigSchema);
