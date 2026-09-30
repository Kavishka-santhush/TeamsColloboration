const nodemailer = require('nodemailer');
const React = require('react');
const env = require('../config/env');
const logger = require('../utils/logger.util');

/**
 * email.util — a Nodemailer SMTP transport plus a handful of React Email
 * templates rendered to HTML. React components are built with createElement
 * (no JSX) so the CommonJS server can render them without a transform step.
 * `render` is imported lazily because @react-email/render is ESM-only in some
 * versions; if it fails we fall back to a plain-HTML template.
 */

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!env.smtp.host) {
    logger.warn('SMTP not configured; emails will be logged instead of sent.');
    return null;
  }
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });
  return transporter;
}

// --- React Email templates (createElement, no JSX) --------------------------
const base = { fontFamily: 'Helvetica, Arial, sans-serif', color: '#1a1a1a' };

function Layout({ children }) {
  return React.createElement('html', null,
    React.createElement('body', { style: { ...base, margin: 0, padding: 24, background: '#f6f7f9' } },
      React.createElement('div', { style: { maxWidth: 560, margin: '0 auto', background: '#fff', borderRadius: 12, padding: 28 } }, children)));
}

function InviteEmail({ inviterName, workspaceName, inviteUrl }) {
  return React.createElement(Layout, null,
    React.createElement('h2', null, `Join ${workspaceName}`),
    React.createElement('p', null, `${inviterName} invited you to join ${workspaceName} on TeamComm.`),
    React.createElement('a', { href: inviteUrl, style: { display: 'inline-block', background: '#4a154b', color: '#fff', padding: '12px 20px', borderRadius: 8, textDecoration: 'none' } }, 'Accept invite'),
    React.createElement('p', { style: { color: '#777', fontSize: 12 } }, 'This invitation link expires in 30 days.'));
}

function VerifyEmail({ code }) {
  return React.createElement(Layout, null,
    React.createElement('h2', null, 'Verify your email'),
    React.createElement('p', null, 'Your verification code is:'),
    React.createElement('p', { style: { fontSize: 28, letterSpacing: 4, fontWeight: 'bold' } }, code));
}

function ResetPasswordEmail({ resetUrl }) {
  return React.createElement(Layout, null,
    React.createElement('h2', null, 'Reset your password'),
    React.createElement('a', { href: resetUrl, style: { color: '#4a154b' } }, 'Click here to reset your password'),
    React.createElement('p', { style: { color: '#777', fontSize: 12 } }, 'If you did not request this, you can ignore this email.'));
}

// --- Render + send ----------------------------------------------------------
/**
 * Minimal HTML sanitizer for AI-generated summary markup: strips script/style/
 * iframe/object/embed tags, event-handler attributes and javascript: URLs.
 * This is defense-in-depth for the dangerouslySetInnerHTML usage below; the
 * content is internal (produced by our own AI pipeline), but we never trust it
 * blindly. For untrusted user HTML, swap this for a maintained sanitizer.
 */
function sanitizeHtml(input = '') {
  return String(input)
    .replace(/<\s*(script|style|iframe|object|embed|form|link|meta|base)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|form|link|meta|base)[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src|action|xlink:href)\s*=\s*("|')?\s*javascript:[^"'\s>]+("|')?/gi, '');
}

function SummaryEmail({ subject, bodyHtml }) {
  return React.createElement(Layout, null,
    React.createElement('h2', null, subject),
    React.createElement('div', { dangerouslySetInnerHTML: { __html: sanitizeHtml(bodyHtml) } }));
}

// --- Render + send ----------------------------------------------------------
async function renderTemplate(component) {
  try {
    const { render } = await import('@react-email/render');
    return render(component);
  } catch (err) {
    // Fallback: if the renderer is unavailable, produce a minimal HTML shell.
    logger.warn(`@react-email/render unavailable (${err.message}); using fallback HTML`);
    return '<html><body>' + (component?.props?.children ? '[message content]' : 'You have a new notification.') + '</body></html>';
  }
}

async function sendEmail({ to, subject, component, text, html }) {
  const transport = getTransporter();
  const finalHtml = html || (component ? await renderTemplate(component) : undefined);
  const payload = { from: env.smtp.from, to, subject, text: text || subject, html: finalHtml };

  if (!transport) {
    logger.info(`[email:skipped] to=${to} subject="${subject}"`);
    return { skipped: true };
  }
  try {
    const info = await transport.sendMail(payload);
    return { messageId: info.messageId };
  } catch (err) {
    logger.error(`sendEmail failed to=${to}: ${err.message}`);
    throw err;
  }
}

// --- Named senders ----------------------------------------------------------
const sendInvite = (to, { inviterName, workspaceName, inviteUrl }) =>
  sendEmail({ to, subject: `You're invited to ${workspaceName}`, component: React.createElement(InviteEmail, { inviterName, workspaceName, inviteUrl }) });

const sendVerificationCode = (to, { code }) =>
  sendEmail({ to, subject: 'Your verification code', component: React.createElement(VerifyEmail, { code }) });

const sendPasswordReset = (to, { resetUrl }) =>
  sendEmail({ to, subject: 'Reset your password', component: React.createElement(ResetPasswordEmail, { resetUrl }) });

const sendSummary = (to, { subject, bodyHtml, text }) =>
  sendEmail({ to, subject, component: React.createElement(SummaryEmail, { subject, bodyHtml }), text });

module.exports = { sendEmail, sendInvite, sendVerificationCode, sendPasswordReset, sendSummary, getTransporter };
