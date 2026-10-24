const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  eventKey: { type: String, required: true, unique: true, maxlength: 150 },
  action: { type: String, required: true, maxlength: 32, index: true },
  delta: { type: Number, required: true },
  productId: { type: String, default: '' },
  subject: { type: String, default: '' }
}, { timestamps: true });
schema.index({ user: 1, action: 1, createdAt: -1 });
module.exports = mongoose.model('CoinTransaction', schema);
