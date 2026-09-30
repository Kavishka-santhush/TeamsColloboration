const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireWorkspaceMember, requireAdmin, requireSuperAdmin } = require('../middleware/role.middleware');
const ctrl = require('../controllers/admin.controller');

const router = express.Router();
router.use(requireAuth);

// --- Workspace admin --------------------------------------------------------
router.get('/admin/audit-logs', requireWorkspaceMember, requireAdmin, ctrl.auditLogs);
router.get('/admin/legal-holds', requireWorkspaceMember, requireAdmin, ctrl.listLegalHolds);
router.post('/admin/legal-holds', requireWorkspaceMember, requireAdmin, ctrl.createLegalHold);
router.delete('/admin/legal-holds/:holdId', requireWorkspaceMember, requireAdmin, ctrl.releaseLegalHold);
router.post('/admin/retention/run', requireWorkspaceMember, requireAdmin, ctrl.enforceRetention);
router.get('/admin/export/workspace', requireWorkspaceMember, requireAdmin, ctrl.exportWorkspace);
router.get('/admin/export/me', ctrl.exportUserData);
router.get('/admin/subscription', requireWorkspaceMember, ctrl.getSubscription);
router.post('/admin/subscription/plan', requireWorkspaceMember, requireAdmin, ctrl.changePlan);

// --- Platform super admin ---------------------------------------------------
router.get('/super/stats', requireSuperAdmin, ctrl.platformStats);
router.get('/super/workspaces', requireSuperAdmin, ctrl.listWorkspaces);
router.post('/super/workspaces/:workspaceId/suspend', requireSuperAdmin, ctrl.suspendWorkspace);
router.post('/super/workspaces/:workspaceId/reinstate', requireSuperAdmin, ctrl.reinstateWorkspace);
router.get('/super/users', requireSuperAdmin, ctrl.listUsers);
router.patch('/super/users/:userId/super-admin', requireSuperAdmin, ctrl.setSuperAdmin);
router.patch('/super/users/:userId/deactivate', requireSuperAdmin, ctrl.deactivateUser);

module.exports = router;
