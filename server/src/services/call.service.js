const prisma = require('../config/prisma');
const env = require('../config/env');
const { ApiError } = require('../utils/response.util');
const { toChannel, toUser } = require('../socket/registry');
const aiService = require('./ai.service');

/**
 * call.service — call lifecycle for 1:1, group and huddle voice/video calls.
 * WebRTC media is peer-to-peer; the server only manages room state + signalling
 * (handled in the socket layer) and post-call AI artifacts.
 */

/** ICE servers advertised to clients (STUN default + optional TURN). */
function iceServers() {
  const servers = [{ urls: ['stun:stun.l.google.com:19302'] }];
  if (env.turn.url) {
    servers.push({ urls: env.turn.url, username: env.turn.username, credential: env.turn.password });
  }
  return servers;
}

async function startCall({ workspaceId, channelId, hostId, type, scheduledAt, maxParticipants }) {
  const call = await prisma.call.create({
    data: {
      workspaceId,
      channelId: channelId || null,
      type,
      hostId,
      status: scheduledAt ? 'SCHEDULED' : 'RUNNING',
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      startedAt: scheduledAt ? null : new Date(),
      maxParticipants: maxParticipants || 50,
      participants: { create: [{ userId: hostId, isHost: true }] },
    },
    include: { participants: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } } },
  });
  if (channelId) toChannel(channelId, 'call:started', { id: call.id, type, hostId });
  return call;
}

async function joinCall(callId, userId) {
  const call = await prisma.call.findUnique({ where: { id: callId }, include: { _count: { select: { participants: true } } } });
  if (!call) throw ApiError.notFound('Call not found');
  if (call.status !== 'RUNNING') throw ApiError.badRequest('Call is not active');
  if (call._count.participants >= call.maxParticipants) throw ApiError.badRequest('Call is full');

  const cp = await prisma.callParticipant.upsert({
    where: { callId_userId: { callId, userId } },
    update: { leftAt: null },
    create: { callId, userId },
    include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
  });
  toChannel(call.channelId, 'call:join', { callId, userId, user: cp.user });
  void toUser;
  return call;
}

async function leaveCall(callId, userId) {
  await prisma.callParticipant.updateMany({ where: { callId, userId }, data: { leftAt: new Date() } });
  const call = await prisma.call.findUnique({ where: { id: callId } });
  toChannel(call.channelId, 'call:leave', { callId, userId });
  return { ok: true };
}

async function setMuted(callId, userId, muted) {
  return prisma.callParticipant.update({ where: { callId_userId: { callId, userId } }, data: { isMuted: muted } });
}

async function raiseHand(callId, userId, raised) {
  return prisma.callParticipant.update({ where: { callId_userId: { callId, userId } }, data: { handRaised: raised } });
}

async function hostMuteParticipant(callId, hostId, targetUserId) {
  const call = await prisma.call.findUnique({ where: { id: callId } });
  if (call.hostId !== hostId) throw ApiError.forbidden('Only the host can mute participants');
  return setMuted(callId, targetUserId, true);
}

async function kickParticipant(callId, hostId, targetUserId) {
  const call = await prisma.call.findUnique({ where: { id: callId } });
  if (call.hostId !== hostId) throw ApiError.forbidden('Only the host can remove participants');
  await prisma.callParticipant.updateMany({ where: { callId, userId: targetUserId }, data: { leftAt: new Date() } });
  toChannel(call.channelId, 'call:kicked', { callId, userId: targetUserId });
  return { ok: true };
}

/** End a call, compute duration, and (optionally) generate AI meeting notes. */
async function endCall(callId, { transcript } = {}) {
  const call = await prisma.call.findUnique({ where: { id: callId } });
  if (!call) throw ApiError.notFound('Call not found');
  const endedAt = new Date();
  const durationSec = call.startedAt ? Math.round((endedAt - call.startedAt) / 1000) : 0;

  const data = { status: 'ENDED', endedAt, durationSec };
  if (transcript) {
    data.transcript = transcript;
    try {
      const notes = await aiService.meetingNotes(transcript, { workspaceId: call.workspaceId });
      const actions = await aiService.extractActionItems(transcript, { workspaceId: call.workspaceId });
      data.summary = notes.notes;
      data.actionItems = actions.items;
    } catch (e) {
      // AI failure must not block ending the call.
    }
  }
  const updated = await prisma.call.update({ where: { id: callId }, data });
  toChannel(call.channelId, 'call:ended', { callId, durationSec, summary: data.summary });
  return updated;
}

async function attachRecording(callId, { fileId, durationSec }) {
  return prisma.callRecording.create({ data: { callId, fileId, durationSec } });
}

async function getActiveHuddle(channelId) {
  return prisma.call.findFirst({
    where: { channelId, type: 'HUDDLE', status: 'RUNNING' },
    include: { participants: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } } },
  });
}

async function history(workspaceId, limit = 50) {
  return prisma.call.findMany({
    where: { workspaceId, status: 'ENDED' },
    orderBy: { endedAt: 'desc' },
    take: limit,
    include: { participants: { include: { user: { select: { id: true, displayName: true } } } } },
  });
}

module.exports = {
  iceServers,
  startCall,
  joinCall,
  leaveCall,
  setMuted,
  raiseHand,
  hostMuteParticipant,
  kickParticipant,
  endCall,
  attachRecording,
  getActiveHuddle,
  history,
};
