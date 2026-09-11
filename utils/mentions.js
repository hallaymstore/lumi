const User = require('../models/User');

function extractMentionNames(text = '') {
  const found = String(text).match(/(^|\s)@([a-z0-9._]{3,24})/gi) || [];
  return [...new Set(found.map(x => x.trim().slice(1).toLowerCase()))].slice(0, 12);
}

async function resolveMentions(text = '') {
  const usernames = extractMentionNames(text);
  if (!usernames.length) return [];
  return User.find({ username: { $in: usernames }, isSuspended: false }).select('_id username name avatarUrl').lean();
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function linkifyMentions(text = '') {
  const safe = escapeHtml(text);
  return safe.replace(/(^|\s)@([a-z0-9._]{3,24})/gi, (all, lead, username) => `${lead}<a class="mention-link" href="/u/${encodeURIComponent(username.toLowerCase())}">@${username}</a>`);
}

module.exports = { extractMentionNames, resolveMentions, linkifyMentions, escapeHtml };
