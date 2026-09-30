const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireWorkspaceMember, requireAdmin } = require('../middleware/role.middleware');
const { upload } = require('../config/upload');
const ctrl = require('../controllers/emoji.controller');

const router = express.Router();
router.use(requireAuth, requireWorkspaceMember);

router.get('/emoji', ctrl.list);
router.get('/emoji/pending', requireAdmin, ctrl.listPending);
router.get('/emoji/recents', ctrl.recents);
router.post('/emoji/recents', ctrl.recordRecent);
router.post('/emoji', requireAdmin, upload.single('image'), ctrl.create);
router.post('/emoji/:emojiId/approve', requireAdmin, ctrl.approve);
router.delete('/emoji/:emojiId', requireAdmin, ctrl.remove);
router.post('/emoji/aliases', requireAdmin, ctrl.addAlias);

module.exports = router;
