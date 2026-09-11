const User = require('../models/User');
const Notification = require('../models/Notification');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

module.exports = async function currentUser(req, res, next) {
  res.locals.currentUser = null;
  res.locals.path = req.path;
  res.locals.unreadNotifications = 0;
  res.locals.unreadMessages = 0;
  if (!req.session.userId) return next();
  try {
    const user = await User.findById(req.session.userId).lean();
    if (!user) { req.session.destroy(() => {}); return next(); }
    if (user.isSuspended) {
      if (user.suspendedUntil && new Date(user.suspendedUntil) <= new Date()) {
        await User.findByIdAndUpdate(user._id, { $set:{isSuspended:false,suspendedUntil:null} });
        user.isSuspended = false; user.suspendedUntil = null;
      } else { req.session.destroy(() => {}); return next(); }
    }
    const serverVersion = Number(user.sessionVersion || 0);
    if (req.session.sessionVersion == null) {
      // Seamless upgrade path from v1.5 sessions.
      req.session.sessionVersion = serverVersion;
    } else if (Number(req.session.sessionVersion) !== serverVersion) {
      req.session.destroy(() => {});
      return next();
    }
    req.currentUser = user;
    res.locals.currentUser = user;
    const conversationIds = await Conversation.find({ participants: user._id }).distinct('_id');
    const [unreadNotifications, unreadMessages] = await Promise.all([
      Notification.countDocuments({ user: user._id, read: false }),
      Message.countDocuments({ conversation: { $in: conversationIds }, sender: { $ne: user._id }, readBy: { $ne: user._id } })
    ]);
    res.locals.unreadNotifications = unreadNotifications;
    res.locals.unreadMessages = unreadMessages;
  } catch (_) {}
  next();
};
