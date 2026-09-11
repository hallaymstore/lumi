const mongoose = require('mongoose');

const postViewSchema = new mongoose.Schema({
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
  viewerKey: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  viewedAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

postViewSchema.index({ post: 1, viewerKey: 1 }, { unique: true });
module.exports = mongoose.model('PostView', postViewSchema);
