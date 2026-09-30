/**
 * Mentions & links parser for message bodies.
 *
 * Given the raw composer text, extract:
 *  - user mentions (@username)
 *  - broadcast mentions (@channel, @here, @everyone)
 *  - channel links (#channel-name)
 *  - URLs (for unfurling)
 *
 * Resolution of usernames/channel-ids to database ids is done in the service
 * layer (which has Prisma access); this util only tokenises the text.
 */
const SPECIAL_MENTIONS = ['channel', 'here', 'everyone'];

function parseMentions(text = '') {
  const userMentions = new Set();
  const broadcastMentions = new Set();
  const channelRefs = new Set();
  const urls = new Set();

  const mentionRegex = /@([a-zA-Z0-9._-]+)/g;
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    const token = match[1].toLowerCase();
    if (SPECIAL_MENTIONS.includes(token)) broadcastMentions.add(token);
    else userMentions.add(match[1]);
  }

  const channelRegex = /#([a-z0-9][a-z0-9-]{1,79})/g;
  while ((match = channelRegex.exec(text)) !== null) {
    channelRefs.add(match[1].toLowerCase());
  }

  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  while ((match = urlRegex.exec(text)) !== null) {
    urls.add(match[1]);
  }

  return {
    userMentions: [...userMentions],
    broadcastMentions: [...broadcastMentions],
    channelRefs: [...channelRefs],
    urls: [...urls],
  };
}

/**
 * Build the compact metadata object stored on Message.mentions (JSONB).
 */
function buildMentionMetadata(parsed, resolvedUserIds = [], resolvedChannelIds = []) {
  return {
    users: resolvedUserIds,
    channels: resolvedChannelIds,
    broadcast: parsed.broadcastMentions,
    raw: {
      userMentions: parsed.userMentions,
      channelRefs: parsed.channelRefs,
    },
    urls: parsed.urls,
  };
}

/** True if the message pings the given user (direct, @channel, @here, @everyone). */
function notifiesUser(metadata, { userId, isOnline = false }) {
  if (!metadata) return false;
  if ((metadata.users || []).includes(userId)) return true;
  const broadcast = metadata.broadcast || [];
  if (broadcast.includes('everyone') || broadcast.includes('channel')) return true;
  if (broadcast.includes('here') && isOnline) return true;
  return false;
}

module.exports = { parseMentions, buildMentionMetadata, notifiesUser, SPECIAL_MENTIONS };
