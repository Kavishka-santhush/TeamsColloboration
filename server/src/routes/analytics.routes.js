const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireWorkspaceMember } = require('../middleware/role.middleware');
const ctrl = require('../controllers/analytics.controller');

const router = express.Router();
router.use(requireAuth, requireWorkspaceMember);

router.get('/analytics/overview', ctrl.overview);
router.get('/analytics/messages/volume', ctrl.messageVolume);
router.get('/analytics/messages/peak-hours', ctrl.peakHours);
router.get('/analytics/top-contributors', ctrl.topContributors);
router.get('/analytics/channels/:channelId', ctrl.channel);
router.get('/analytics/members/engagement', ctrl.memberEngagement);
router.get('/analytics/search', ctrl.searchAnalytics);
router.get('/analytics/files/by-type', ctrl.fileStorageByType);
router.get('/analytics/ai-insights', ctrl.aiInsights);

module.exports = router;
