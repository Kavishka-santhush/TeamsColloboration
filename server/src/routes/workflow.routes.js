const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireWorkspaceMember, requireChannelManager } = require('../middleware/role.middleware');
const ctrl = require('../controllers/workflow.controller');

const router = express.Router();
router.use(requireAuth, requireWorkspaceMember);

router.get('/workflows', ctrl.list);
router.post('/workflows', requireChannelManager, ctrl.create);
router.get('/workflows/:workflowId', ctrl.getOne);
router.patch('/workflows/:workflowId', requireChannelManager, ctrl.update);
router.post('/workflows/:workflowId/toggle', requireChannelManager, ctrl.toggle);
router.delete('/workflows/:workflowId', requireChannelManager, ctrl.remove);
router.post('/workflows/:workflowId/run', requireChannelManager, ctrl.run);

module.exports = router;
