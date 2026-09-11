const mongoose = require('mongoose');
const adminLogSchema = new mongoose.Schema({
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true, maxlength: 80 },
  targetType: { type: String, maxlength: 40, default: '' },
  targetId: { type: String, maxlength: 80, default: '' },
  details: { type: String, maxlength: 240, default: '' }
}, { timestamps: true });
adminLogSchema.index({ createdAt: -1 });
module.exports = mongoose.model('AdminLog', adminLogSchema);
