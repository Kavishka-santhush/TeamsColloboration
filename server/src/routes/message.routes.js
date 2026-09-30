const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireWorkspaceMember } = require('../middleware/role.middleware');
const { messageLimiter } = require('../middleware/rateLimit.middleware');
const ctrl = require('../controllers/message.controller');

const router = express.Router();
router.use(requireAuth, requireWorkspaceMember);

// Send (channel / dm / thread reply) — rate limited.
router.post('/messages', messageLimiter, ctrl.send);

// History for a channel.
router.get('/channels/:channelId/messages', ctrl.list);

// Unified history for any conversation id (channel OR dm) — what the client uses.
router.get('/conversations/:conversationId/messages', ctrl.listByConversation);

// Single message + mutations.
router.get('/messages/:messageId', ctrl.getOne);
router.patch('/messages/:messageId', ctrl.edit);
router.delete('/messages/:messageId', ctrl.remove);
router.post('/messages/:messageId/reactions', ctrl.react);
router.post('/messages/:messageId/forward', ctrl.forward);
router.post('/messages/:messageId/star', ctrl.star);
router.post('/messages/:messageId/bookmark', ctrl.bookmark);
router.post('/messages/:messageId/reminder', ctrl.reminder);
router.post('/messages/:messageId/read', ctrl.read);

module.exports = router;
