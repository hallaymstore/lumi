const Conversation = require('../models/Conversation');

function pairKey(a, b) {
  return [a.toString(), b.toString()].sort().join(':');
}

async function getOrCreateConversation(a, b) {
  const key = pairKey(a, b);
  return Conversation.findOneAndUpdate(
    { participantKey: key },
    { $setOnInsert: { participantKey: key, participants: [a, b], lastMessageAt: new Date() } },
    { new: true, upsert: true }
  );
}

module.exports = { pairKey, getOrCreateConversation };
