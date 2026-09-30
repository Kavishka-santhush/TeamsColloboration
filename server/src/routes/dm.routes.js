const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireWorkspaceMember } = require('../middleware/role.middleware');
const { messageLimiter } = require('../middleware/rateLimit.middleware');
const ctrl = require('../controllers/dm.controller');

const router = express.Router();
router.use(requireAuth, requireWorkspaceMember);

router.get('/dms', ctrl.listMine);
router.get('/workspaces/:workspaceId/dms', ctrl.listMine);
router.post('/dms', ctrl.start);
router.get('/dms/:dmId', ctrl.getOne);
router.post('/dms/:dmId/read', ctrl.markRead);
router.post('/dms/:dmId/mute', ctrl.mute);
router.post('/dms/:dmId/convert', requireWorkspaceMember, ctrl.convertToChannel);

router.post('/dms/block/:userId', ctrl.block);
router.delete('/dms/block/:userId', ctrl.unblock);

router.get('/dms/:dmId/messages', messageLimiter, async (req, res, next) => {
  // reuse the message list controller with dmConversationId scoping
  req.query.dmConversationId = req.params.dmId;
  return next();
}, require('../controllers/message.controller').list);

router.post('/message-requests', ctrl.createRequest);
router.patch('/message-requests/:requestId', ctrl.respondToRequest);

module.exports = router;
