const asyncHandler = require('../utils/asyncHandler.util');
const { success } = require('../utils/response.util');
const callService = require('../services/call.service');

const getIceServers = asyncHandler(async (req, res) => {
  return success(res, callService.iceServers());
});

const start = asyncHandler(async (req, res) => {
  const call = await callService.startCall({
    workspaceId: req.workspaceId,
    channelId: req.body.channelId,
    hostId: req.user.id,
    type: req.body.type || 'CHANNEL',
    scheduledAt: req.body.scheduledAt,
    maxParticipants: req.body.maxParticipants,
  });
  return success(res, call, 'Call started', 201);
});

const join = asyncHandler(async (req, res) => {
  const call = await callService.joinCall(req.params.callId, req.user.id);
  return success(res, call, 'Joined call');
});

const leave = asyncHandler(async (req, res) => {
  const result = await callService.leaveCall(req.params.callId, req.user.id);
  return success(res, result, 'Left call');
});

const mute = asyncHandler(async (req, res) => {
  const result = await callService.setMuted(req.params.callId, req.user.id, req.body.muted !== false);
  return success(res, result, 'Mute updated');
});

const raiseHand = asyncHandler(async (req, res) => {
  const result = await callService.raiseHand(req.params.callId, req.user.id, req.body.raised !== false);
  return success(res, result, 'Hand state updated');
});

const hostMute = asyncHandler(async (req, res) => {
  const result = await callService.hostMuteParticipant(req.params.callId, req.user.id, req.body.userId);
  return success(res, result, 'Participant muted');
});

const kick = asyncHandler(async (req, res) => {
  const result = await callService.kickParticipant(req.params.callId, req.user.id, req.body.userId);
  return success(res, result, 'Participant removed');
});

const end = asyncHandler(async (req, res) => {
  const call = await callService.endCall(req.params.callId, { transcript: req.body.transcript });
  return success(res, call, 'Call ended');
});

const attachRecording = asyncHandler(async (req, res) => {
  const result = await callService.attachRecording(req.params.callId, { fileId: req.body.fileId, durationSec: req.body.durationSec });
  return success(res, result, 'Recording attached', 201);
});

const activeHuddle = asyncHandler(async (req, res) => {
  const call = await callService.getActiveHuddle(req.params.channelId);
  return success(res, call);
});

const history = asyncHandler(async (req, res) => {
  const items = await callService.history(req.workspaceId, Number(req.query.limit) || 50);
  return success(res, items);
});

module.exports = { getIceServers, start, join, leave, mute, raiseHand, hostMute, kick, end, attachRecording, activeHuddle, history };
