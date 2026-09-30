const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireWorkspaceMember } = require('../middleware/role.middleware');
const ctrl = require('../controllers/thread.controller');

const router = express.Router();
router.use(requireAuth, requireWorkspaceMember);

router.get('/threads', ctrl.listMine);
router.get('/threads/:rootMessageId', ctrl.getThread);
router.post('/threads/:rootMessageId/replies', ctrl.reply);
router.post('/threads/:threadId/follow', ctrl.follow);
router.delete('/threads/:threadId/follow', ctrl.unfollow);

module.exports = router;
