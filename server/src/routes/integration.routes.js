const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireWorkspaceMember, requireAdmin } = require('../middleware/role.middleware');
const { webhookLimiter } = require('../middleware/rateLimit.middleware');
const ctrl = require('../controllers/integration.controller');

const router = express.Router();

// --- Public webhook receivers (no session auth; validated by token) ---------
router.post('/webhooks/incoming/:integrationId', webhookLimiter, ctrl.incoming);
router.post('/webhooks/provider/:integrationId/:provider', webhookLimiter, ctrl.providerEvent);

// --- Authenticated management -----------------------------------------------
router.use(requireAuth, requireWorkspaceMember);
router.get('/integrations', ctrl.list);
router.post('/integrations', requireAdmin, ctrl.create);
router.patch('/integrations/:integrationId/toggle', requireAdmin, ctrl.toggle);
router.delete('/integrations/:integrationId', requireAdmin, ctrl.remove);
router.get('/integrations/:integrationId/logs', requireAdmin, ctrl.logs);

module.exports = router;
