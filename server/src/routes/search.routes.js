const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireWorkspaceMember } = require('../middleware/role.middleware');
const ctrl = require('../controllers/search.controller');

const router = express.Router();
router.use(requireAuth, requireWorkspaceMember);

router.get('/search', ctrl.search);
router.get('/search/history', ctrl.history);
router.post('/search/saved', ctrl.save);
router.get('/search/saved', ctrl.listSaved);

module.exports = router;
