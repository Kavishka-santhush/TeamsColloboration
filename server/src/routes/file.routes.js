const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireWorkspaceMember } = require('../middleware/role.middleware');
const { uploadLimiter } = require('../middleware/rateLimit.middleware');
const { upload } = require('../config/upload');
const ctrl = require('../controllers/file.controller');

const router = express.Router();
router.use(requireAuth, requireWorkspaceMember);

// multipart/form-data uploads
router.post('/files', uploadLimiter, upload.array('files', 10), ctrl.upload);
router.post('/files/:fileId/versions', uploadLimiter, upload.single('file'), ctrl.uploadNewVersion);

router.get('/files', ctrl.list);
router.get('/files/storage', ctrl.storage);
router.get('/files/:fileId', ctrl.getOne);
router.get('/files/:fileId/download', ctrl.download);
router.get('/files/:fileId/versions', ctrl.versions);
router.patch('/files/:fileId', ctrl.rename);
router.delete('/files/:fileId', ctrl.remove);
router.post('/files/:fileId/comments', ctrl.comment);

router.post('/snippets', ctrl.createSnippet);

module.exports = router;
