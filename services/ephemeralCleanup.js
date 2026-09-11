const Message = require('../models/Message');
const { deleteImage } = require('./r2');

async function consumeEphemeralMessage(messageOrId) {
  const message = typeof messageOrId === 'object' && messageOrId?._id
    ? messageOrId
    : await Message.findById(messageOrId);
  if (!message || !message.ephemeral) return false;

  const key = message.mediaKey;
  // Mark consumed first so the API can never reopen it after the 10-second window.
  await Message.findByIdAndUpdate(message._id, { $set: { ephemeralConsumedAt: new Date() } });
  if (!key) return true;

  try {
    await deleteImage(key);
    await Message.findByIdAndUpdate(message._id, {
      $set: { mediaUrl: '', mediaKey: '' }
    });
    return true;
  } catch (err) {
    // Keep mediaKey so the periodic cleanup can retry deletion; the message stays consumed.
    console.error('Ephemeral R2 cleanup failed:', err.message);
    return false;
  }
}

async function cleanupExpiredEphemeral() {
  const now = new Date();
  const expired = await Message.find({
    ephemeral: true,
    mediaKey: { $ne: '' },
    ephemeralExpiresAt: { $ne: null, $lte: now }
  }).select('_id mediaKey ephemeral').limit(100);
  for (const message of expired) await consumeEphemeralMessage(message);
}

function startEphemeralCleanup() {
  cleanupExpiredEphemeral().catch(err => console.error('Initial ephemeral cleanup failed:', err.message));
  const timer = setInterval(() => {
    cleanupExpiredEphemeral().catch(err => console.error('Ephemeral cleanup failed:', err.message));
  }, 60_000);
  timer.unref?.();
}

module.exports = { consumeEphemeralMessage, cleanupExpiredEphemeral, startEphemeralCleanup };
