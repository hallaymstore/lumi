const router = require('express').Router();
const User = require('../models/User');
const Notification = require('../models/Notification');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { requireAuth } = require('../middleware/auth');
const { addClient } = require('../services/realtime');

router.get('/api/events', requireAuth, async (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders?.();
  res.write(`event: ready\ndata: ${JSON.stringify({ ok: true, userId: req.currentUser._id.toString() })}\n\n`);

  await User.findByIdAndUpdate(req.currentUser._id, { lastSeenAt: new Date() }).catch(() => {});
  const remove = addClient(req.currentUser._id, res);
  const keepalive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (_) {}
  }, 20000);

  req.on('close', async () => {
    clearInterval(keepalive);
    remove();
    await User.findByIdAndUpdate(req.currentUser._id, { lastSeenAt: new Date() }).catch(() => {});
  });
});

router.get('/api/badges', requireAuth, async (req, res) => {
  const conversationIds = await Conversation.find({ participants: req.currentUser._id }).distinct('_id');
  const [notifications, messages] = await Promise.all([
    Notification.countDocuments({ user: req.currentUser._id, read: false }),
    Message.countDocuments({ conversation: { $in: conversationIds }, sender: { $ne: req.currentUser._id }, readBy: { $ne: req.currentUser._id } })
  ]);
  res.json({ ok: true, notifications, messages });
});

router.get('/api/users/search', requireAuth, async (req, res) => {
  const q = String(req.query.q || '').replace(/^@/, '').trim().toLowerCase().slice(0, 24);
  if (q.length < 1) return res.json({ ok: true, users: [] });
  const users = await User.find({
    _id: { $ne: req.currentUser._id },
    isSuspended: false,
    $or: [{ username: { $regex: '^' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }, { name: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }]
  }).select('name username avatarUrl isVerified').limit(8).lean();
  res.json({ ok: true, users });
});

module.exports = router;
