const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireWorkspaceMember, requireChannelManager, requireAdmin } = require('../middleware/role.middleware');
const ctrl = require('../controllers/channel.controller');

const router = express.Router();
router.use(requireAuth, requireWorkspaceMember);

// Collection routes are workspace-scoped (param present -> membership resolved).
router.post('/workspaces/:workspaceId/channels', ctrl.create);
router.get('/workspaces/:workspaceId/channels', ctrl.listMine);
router.post('/workspaces/:workspaceId/channels/sections', requireAdmin, ctrl.createSection);

// Individual channel routes: the client sends x-workspace-id so membership +
// role middleware resolve from the header.
router.get('/channels/:channelId', ctrl.getOne);
router.patch('/channels/:channelId', requireChannelManager, ctrl.update);
router.delete('/channels/:channelId', requireAdmin, ctrl.remove);
router.post('/channels/:channelId/archive', requireChannelManager, ctrl.archive);

router.post('/channels/:channelId/members', requireChannelManager, ctrl.addMembers);
router.delete('/channels/:channelId/members/:userId', requireChannelManager, ctrl.removeMember);
router.patch('/channels/:channelId/managers/:userId', requireAdmin, ctrl.setManager);

router.post('/channels/:channelId/mute', ctrl.mute);
router.patch('/channels/:channelId/mute', ctrl.mute);
router.post('/channels/:channelId/read', ctrl.markRead);
router.patch('/channels/:channelId/read', ctrl.markRead);
router.post('/channels/:channelId/section', requireChannelManager, ctrl.moveChannelToSection);

router.get('/channels/:channelId/pins', ctrl.getOne); // pins surface via channel detail
router.post('/channels/:channelId/pins/:messageId', ctrl.pin);
router.delete('/channels/:channelId/pins/:messageId', ctrl.unpin);

module.exports = router;
