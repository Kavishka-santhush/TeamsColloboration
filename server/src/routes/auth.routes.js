const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const authController = require('../controllers/auth.controller');

const router = express.Router();

// /api/auth
router.post('/sync', authController.sync); // verifies token itself; no requireAuth
router.get('/me', requireAuth, authController.getProfile);
router.patch('/me', requireAuth, authController.updateProfile);
router.patch('/profile', requireAuth, authController.updateProfile); // client alias
router.post('/presence', requireAuth, authController.setPresence);
router.patch('/me/status', requireAuth, authController.setStatus);
router.get('/lookup-users', requireAuth, authController.findByUsername);

module.exports = router;
