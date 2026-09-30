const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/notification.controller');

const router = express.Router();
router.use(requireAuth);

router.get('/notifications', ctrl.list);
router.post('/notifications/read-all', ctrl.markAllRead);
router.post('/notifications/:notificationId/read', ctrl.markRead);
router.get('/notification-preferences', ctrl.getPreferences);
router.patch('/notification-preferences', ctrl.setPreferences);

module.exports = router;
