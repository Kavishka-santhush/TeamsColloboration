const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireWorkspaceMember } = require('../middleware/role.middleware');
const { aiLimiter } = require('../middleware/rateLimit.middleware');
const ctrl = require('../controllers/ai.controller');

const router = express.Router();
router.use(requireAuth, requireWorkspaceMember, aiLimiter);

router.post('/ai/summarize/channel', ctrl.summarizeChannel);
router.post('/ai/summarize/thread', ctrl.summarizeThread);
router.post('/ai/smart-replies', ctrl.smartReplies);
router.post('/ai/translate', ctrl.translate);
router.post('/ai/sentiment', ctrl.sentiment);
router.post('/ai/meeting-notes', ctrl.meetingNotes);
router.post('/ai/action-items', ctrl.actionItems);
router.post('/ai/writing-assistant', ctrl.writingAssistant);
router.post('/ai/chat', ctrl.chatbot);
router.post('/ai/suggest-topic', ctrl.suggestTopic);
router.post('/ai/toxicity', ctrl.detectToxicity);
router.get('/ai/icebreaker', ctrl.icebreaker);

module.exports = router;
