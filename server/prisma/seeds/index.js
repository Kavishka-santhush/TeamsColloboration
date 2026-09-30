/* eslint-disable no-console */
// ==================================================================
// Prisma seed orchestrator. Creates a realistic demo dataset:
//   - subscription plans (Free/Pro/Business/Enterprise)
//   - super admin + sample members with different workspace roles
//   - one sample workspace with channels (general, random, announcements)
//   - messages with a thread, reactions, pins
//   - a DM conversation, custom emoji, workflow templates, integrations
//   - default notification settings per user
//
// Run with: npm run prisma:seed   (we do NOT run it here — files only)
// ==================================================================
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Deterministic ids so seeded records can reference each other.
const ids = {
  superAdmin: '11111111-1111-1111-1111-111111111111',
  owner: '22222222-2222-2222-2222-222222222222',
  admin: '33333333-3333-3333-3333-333333333333',
  member: '44444444-4444-4444-4444-444444444444',
  guest: '55555555-5555-5555-5555-555555555555',
  bot: '66666666-6666-6666-6666-666666666666',
  workspace: 'aaaaaaaa-0000-0000-0000-000000000001',
  general: 'bbbbbbbb-0000-0000-0000-000000000001',
  random: 'bbbbbbbb-0000-0000-0000-000000000002',
  announcements: 'bbbbbbbb-0000-0000-0000-000000000003',
  helloMsg: 'cccccccc-0000-0000-0000-000000000001',
  threadReply: 'cccccccc-0000-0000-0000-000000000002',
  dm: 'dddddddd-0000-0000-0000-000000000001',
};

async function seedPlans() {
  const plans = [
    { tier: 'FREE', name: 'Free', priceMonthlyUsd: 0, maxWorkspaces: 1, historyRetentionDays: 90, storagePerMemberMb: 5120, maxGroupCallSize: 0, features: { ai: false, sso: false, compliance: false, workflows: false } },
    { tier: 'PRO', name: 'Pro', priceMonthlyUsd: 8, historyRetentionDays: null, storagePerMemberMb: 10240, maxGroupCallSize: 15, features: { ai: false, sso: false, compliance: false, workflows: true } },
    { tier: 'BUSINESS', name: 'Business', priceMonthlyUsd: 15, storagePerMemberMb: 51200, maxGroupCallSize: 50, features: { ai: true, sso: true, compliance: true, workflows: true } },
    { tier: 'ENTERPRISE', name: 'Enterprise', priceMonthlyUsd: 25, storagePerMemberMb: null, maxGroupCallSize: 200, features: { ai: true, sso: true, compliance: true, workflows: true, legalHold: true, ipAllowlist: true } },
  ];
  for (const p of plans) {
    await prisma.subscriptionPlan.upsert({ where: { tier: p.tier }, update: p, create: p });
  }
}

async function seedUsers() {
  const users = [
    { id: ids.superAdmin, clerkUserId: 'user_superadmin', email: 'owner@teamcomm.local', username: 'superadmin', displayName: 'Platform Owner', isSuperAdmin: true, platformRole: 'SUPER_ADMIN', presence: 'ACTIVE' },
    { id: ids.owner, clerkUserId: 'user_owner', email: 'ada@acme.test', username: 'ada', displayName: 'Ada Owner', title: 'CEO' },
    { id: ids.admin, clerkUserId: 'user_admin', email: 'ben@acme.test', username: 'ben', displayName: 'Ben Admin', title: 'Engineering Manager' },
    { id: ids.member, clerkUserId: 'user_member', email: 'cara@acme.test', username: 'cara', displayName: 'Cara Member', title: 'Engineer' },
    { id: ids.guest, clerkUserId: 'user_guest', email: 'sam@client.test', username: 'sam', displayName: 'Sam Guest', isGuest: true, platformRole: 'GUEST' },
    { id: ids.bot, clerkUserId: 'user_bot', email: 'bot@acme.test', username: 'acmebot', displayName: 'Acme Bot', platformRole: 'BOT' },
  ];
  for (const u of users) {
    await prisma.user.upsert({ where: { id: u.id }, update: u, create: u });
  }
}

async function seedWorkspace() {
  const ws = await prisma.workspace.upsert({
    where: { id: ids.workspace },
    update: {},
    create: {
      id: ids.workspace,
      name: 'Acme Inc.',
      slug: 'acme',
      description: 'Product & engineering team workspace',
      industry: 'Technology',
      ownerId: ids.owner,
      discoverable: true,
      defaultChannelIds: [ids.general],
    },
  });

  const memberships = [
    { userId: ids.owner, role: 'OWNER' },
    { userId: ids.admin, role: 'ADMIN' },
    { userId: ids.member, role: 'MEMBER' },
    { userId: ids.guest, role: 'GUEST' },
    { userId: ids.bot, role: 'BOT' },
  ];
  for (const m of memberships) {
    await prisma.workspaceMember.upsert({
      where: { userId_workspaceId: { userId: m.userId, workspaceId: ws.id } },
      update: { role: m.role },
      create: { userId: m.userId, workspaceId: ws.id, role: m.role },
    });
  }

  // Free subscription for the demo workspace
  const freePlan = await prisma.subscriptionPlan.findUnique({ where: { tier: 'FREE' } });
  if (freePlan) {
    await prisma.workspaceSubscription.upsert({
      where: { workspaceId: ws.id },
      update: {},
      create: { workspaceId: ws.id, planId: freePlan.id, status: 'ACTIVE', seats: 4 },
    });
  }
  return ws;
}

async function seedChannels() {
  const defs = [
    { id: ids.general, name: 'general', type: 'PUBLIC', topic: 'Team-wide discussion', isDefault: true },
    { id: ids.random, name: 'random', type: 'PUBLIC', topic: 'Water cooler chat' },
    { id: ids.announcements, name: 'announcements', type: 'ANNOUNCEMENT', topic: 'Important updates', postingAllowedRoles: ['OWNER', 'ADMIN'] },
  ];
  for (const c of defs) {
    await prisma.channel.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        workspaceId: ids.workspace,
        name: c.name,
        normalizedSlug: c.name,
        type: c.type,
        topic: c.topic,
        isDefault: !!c.isDefault,
        postingAllowedRoles: c.postingAllowedRoles || ['OWNER', 'ADMIN', 'CHANNEL_MANAGER', 'MEMBER'],
      },
    });
  }

  // Add all human members to general + random
  const humanIds = [ids.owner, ids.admin, ids.member];
  for (const chId of [ids.general, ids.random]) {
    const membership = await prisma.workspaceMember.findFirst({ where: { workspaceId: ids.workspace } });
    for (const userId of humanIds) {
      const wm = await prisma.workspaceMember.findUnique({ where: { userId_workspaceId: { userId, workspaceId: ids.workspace } } });
      await prisma.channelMember.upsert({
        where: { userId_channelId: { userId, channelId: chId } },
        update: {},
        create: { userId, channelId: chId, workspaceMembershipId: wm ? wm.id : membership.id },
      });
    }
  }
}

async function seedMessages() {
  // A root message in #general
  await prisma.message.upsert({
    where: { id: ids.helloMsg },
    update: {},
    create: {
      id: ids.helloMsg,
      workspaceId: ids.workspace,
      channelId: ids.general,
      authorId: ids.owner,
      type: 'TEXT',
      status: 'READ',
      body: 'Welcome to Acme! 👋 Say hi in #general and share updates in #announcements.',
      mentions: { users: [], channels: [ids.general], broadcast: [], urls: [] },
    },
  });

  // A thread reply to that message
  await prisma.message.upsert({
    where: { id: ids.threadReply },
    update: {},
    create: {
      id: ids.threadReply,
      workspaceId: ids.workspace,
      channelId: ids.general,
      authorId: ids.member,
      type: 'TEXT',
      threadRootId: ids.helloMsg,
      body: 'Thanks Ada! Excited to be here 🎉',
    },
  });

  // Thread record + participants
  await prisma.thread.upsert({
    where: { rootMessageId: ids.helloMsg },
    update: { replyCount: 1 },
    create: { workspaceId: ids.workspace, rootMessageId: ids.helloMsg, channelId: ids.general, replyCount: 1 },
  });

  // Reactions + a pin
  await prisma.reaction.upsert({
    where: { messageId_userId_emoji: { messageId: ids.helloMsg, userId: ids.member, emoji: '🎉' } },
    update: {},
    create: { messageId: ids.helloMsg, userId: ids.member, emoji: '🎉' },
  });
  await prisma.pinnedMessage.upsert({
    where: { channelId_messageId: { channelId: ids.general, messageId: ids.helloMsg } },
    update: {},
    create: { channelId: ids.general, messageId: ids.helloMsg, pinnedBy: ids.owner },
  });
}

async function seedDms() {
  await prisma.dmConversation.upsert({
    where: { id: ids.dm },
    update: {},
    create: {
      id: ids.dm,
      workspaceId: ids.workspace,
      isGroup: false,
      participants: { create: [{ userId: ids.owner }, { userId: ids.member }] },
    },
  });
  const existing = await prisma.message.findFirst({ where: { dmConversationId: ids.dm } });
  if (!existing) {
    await prisma.message.create({
      data: { workspaceId: ids.workspace, dmConversationId: ids.dm, authorId: ids.member, type: 'TEXT', body: 'Hey Ada, do you have a minute?' },
    });
  }
}

async function seedEmoji() {
  await prisma.customEmoji.upsert({
    where: { workspaceId_name: { workspaceId: ids.workspace, name: 'acme-parrot' } },
    update: {},
    create: { workspaceId: ids.workspace, name: 'acme-parrot', imageUrl: '/uploads/emoji/acme-parrot.gif', isAnimated: true, createdBy: ids.admin },
  });
  await prisma.emojiAlias.upsert({
    where: { workspaceId_alias: { workspaceId: ids.workspace, alias: 'party' } },
    update: {},
    create: { workspaceId: ids.workspace, alias: 'party', targetEmoji: '🎉' },
  });
}

async function seedWorkflows() {
  const templates = [
    { name: 'Daily Standup', triggerType: 'SCHEDULED_TIME', triggerConfig: { cron: '0 9 * * 1-5' }, actions: [{ type: 'SEND_CHANNEL_MESSAGE', config: { channelId: ids.general, text: '🌅 Daily standup: what are you working on today?' } }] },
    { name: 'Leave Request Form', triggerType: 'FORM_SUBMITTED', triggerConfig: {}, formFields: [{ type: 'text', label: 'Dates' }, { type: 'dropdown', label: 'Type', options: ['Annual', 'Sick', 'Unpaid'] }], actions: [{ type: 'POST_WEBHOOK', config: { url: 'https://example.com/hook' } }] },
    { name: 'Incident Report', triggerType: 'SLASH_COMMAND', triggerConfig: { command: 'incident' }, actions: [{ type: 'SEND_CHANNEL_MESSAGE', config: { channelId: ids.announcements, text: '🚨 Incident reported — please respond in thread.' } }] },
  ];
  for (const w of templates) {
    await prisma.workflow.create({ data: { ...w, workspaceId: ids.workspace, isTemplate: true, enabled: false, createdBy: ids.admin } });
  }
}

async function seedIntegrations() {
  await prisma.integration.upsert({
    where: { id: 'eeeeeeee-0000-0000-0000-000000000001' },
    update: {},
    create: { id: 'eeeeeeee-0000-0000-0000-000000000001', workspaceId: ids.workspace, channelId: ids.general, type: 'GITHUB', name: 'GitHub — acme/webapp', enabled: true, createdBy: ids.admin, config: { repo: 'acme/webapp', events: ['push', 'pull_request'] } },
  });
  await prisma.slashCommand.create({ data: { workspaceId: ids.workspace, name: 'shrug', description: 'Prefix message with ¯\\_(ツ)_/¯', isBuiltin: true, createdBy: ids.admin } });
}

async function seedNotificationSettings() {
  const userIds = [ids.owner, ids.admin, ids.member, ids.guest];
  for (const userId of userIds) {
    await prisma.notificationPreference.create({
      data: { userId, workspaceId: ids.workspace, scope: 'mentions_only', emailDigest: 'daily', desktopPush: true },
    });
  }
}

async function main() {
  console.log('🌱 Seeding Team Communication Platform...');
  await seedPlans();
  await seedUsers();
  await seedWorkspace();
  await seedChannels();
  await seedMessages();
  await seedDms();
  await seedEmoji();
  await seedWorkflows();
  await seedIntegrations();
  await seedNotificationSettings();
  console.log('✅ Seed complete');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
