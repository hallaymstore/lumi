const mongoose = require('mongoose');

const adConfigSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'global' },
  enabled: { type: Boolean, default: true },
  feedInterval: { type: Number, min: 3, max: 20, default: 5 },
  ctaDelaySeconds: { type: Number, min: 1, max: 10, default: 3 },
  maxAdsPerPage: { type: Number, min: 1, max: 20, default: 8 },
  profileEnabled: { type: Boolean, default: true },
  chatsEnabled: { type: Boolean, default: true },
  networkEnabled: { type: Boolean, default: true },
  networkEcpm: { type: Number, min: 0, max: 100, default: 0.5 },
  label: { type: String, maxlength: 24, default: 'Reklama' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('AdConfig', adConfigSchema);
