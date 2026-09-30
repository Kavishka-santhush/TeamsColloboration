const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireWorkspaceMember } = require('../middleware/role.middleware');
const ctrl = require('../controllers/call.controller');

const router = express.Router();
router.use(requireAuth, requireWorkspaceMember);

router.get('/calls/ice-servers', ctrl.getIceServers);
router.get('/calls/history', ctrl.history);
router.get('/channels/:channelId/huddle', ctrl.activeHuddle);

router.post('/calls', ctrl.start);
router.post('/calls/:callId/join', ctrl.join);
router.post('/calls/:callId/leave', ctrl.leave);
router.post('/calls/:callId/mute', ctrl.mute);
router.post('/calls/:callId/hand', ctrl.raiseHand);
router.post('/calls/:callId/mute-participant', ctrl.hostMute);
router.post('/calls/:callId/kick', ctrl.kick);
router.post('/calls/:callId/end', ctrl.end);
router.post('/calls/:callId/recordings', ctrl.attachRecording);

module.exports = router;
