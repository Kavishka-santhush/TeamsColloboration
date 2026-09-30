const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireWorkspaceMember, requireAdmin } = require('../middleware/role.middleware');
const ctrl = require('../controllers/workspace.controller');

const router = express.Router();

// /api/workspaces  (all require auth)
router.use(requireAuth);

router.post('/', ctrl.create);
router.get('/', ctrl.listMine);
router.post('/join-by-code', ctrl.joinByCode);

// workspace-scoped
router.get('/:workspaceId', ctrl.getOne);
router.patch('/:workspaceId', requireAdmin, ctrl.update);
router.delete('/:workspaceId', requireAdmin, ctrl.remove);

router.get('/:workspaceId/members', ctrl.listMembers);
router.post('/:workspaceId/members', requireAdmin, ctrl.addMember);
router.patch('/:workspaceId/members/:userId/role', requireAdmin, ctrl.changeRole);
router.patch('/:workspaceId/members/:userId/deactivate', requireAdmin, ctrl.deactivateMember);
router.delete('/:workspaceId/members/:userId', requireAdmin, ctrl.removeMember);

router.post('/:workspaceId/invites', requireAdmin, ctrl.createInvite);
router.get('/:workspaceId/join-requests', requireAdmin, ctrl.listJoinRequests);
router.post('/:workspaceId/join-requests', ctrl.requestJoin);
router.patch('/:workspaceId/join-requests/:requestId', requireAdmin, ctrl.reviewJoinRequest);

module.exports = router;
