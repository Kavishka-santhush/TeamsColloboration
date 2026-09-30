const express = require('express');

const authRoutes = require('./auth.routes');
const workspaceRoutes = require('./workspace.routes');
const channelRoutes = require('./channel.routes');
const messageRoutes = require('./message.routes');
const threadRoutes = require('./thread.routes');
const dmRoutes = require('./dm.routes');
const notificationRoutes = require('./notification.routes');
const searchRoutes = require('./search.routes');
const fileRoutes = require('./file.routes');
const emojiRoutes = require('./emoji.routes');
const callRoutes = require('./call.routes');
const workflowRoutes = require('./workflow.routes');
const integrationRoutes = require('./integration.routes');
const analyticsRoutes = require('./analytics.routes');
const adminRoutes = require('./admin.routes');
const aiRoutes = require('./ai.routes');

/**
 * API router. Each domain owns its own file; this just composes them under a
 * single /api mount point (see app.js). A health check is included for probes.
 */
const router = express.Router();

router.get('/health', (req, res) => res.json({ success: true, data: { status: 'ok', uptime: process.uptime() }, timestamp: new Date().toISOString() }));

router.use('/', authRoutes);
router.use('/', workspaceRoutes);
router.use('/', channelRoutes);
router.use('/', messageRoutes);
router.use('/', threadRoutes);
router.use('/', dmRoutes);
router.use('/', notificationRoutes);
router.use('/', searchRoutes);
router.use('/', fileRoutes);
router.use('/', emojiRoutes);
router.use('/', callRoutes);
router.use('/', workflowRoutes);
router.use('/', integrationRoutes);
router.use('/', analyticsRoutes);
router.use('/', adminRoutes);
router.use('/', aiRoutes);

module.exports = router;
