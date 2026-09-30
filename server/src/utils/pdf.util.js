const path = require('path');
const fs = require('fs');
const env = require('../config/env');
const logger = require('../utils/logger.util');
const { uploadRoot } = require('../config/upload');

/**
 * pdf.util — renders an HTML document to PDF with Puppeteer (headless Chrome).
 * Used for exporting channels/threads/summaries and printable invoices.
 * The browser instance is reused across calls for speed; a fresh page is opened
 * per render and always closed.
 */

let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    // Required lazily so the app still boots if Puppeteer isn't installed yet.
    const puppeteer = require('puppeteer');
    browserPromise = puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    }).catch((err) => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

/** Wrap plain text/markdown-ish content in a styled HTML document. */
function buildDocument(title, bodyHtml) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 48px; line-height: 1.5; }
    h1 { font-size: 22px; border-bottom: 2px solid #4a154b; padding-bottom: 8px; }
    .meta { color: #777; font-size: 12px; margin-bottom: 24px; }
    .msg { padding: 12px 0; border-bottom: 1px solid #eee; }
    .msg .author { font-weight: 600; }
    .msg .time { color: #999; font-size: 11px; margin-left: 8px; }
    footer { margin-top: 32px; font-size: 11px; color: #aaa; }
  </style></head><body>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">Generated ${new Date().toISOString()} — TeamComm</div>
    ${bodyHtml}
    <footer>Team Communication Platform &middot; ${escapeHtml(env.clientUrl)}</footer>
  </body></html>`;
}

function escapeHtml(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Render arbitrary HTML to a PDF buffer. */
async function htmlToPdf(html, options = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.goto('data:text/html;charset=utf-8,' + encodeURIComponent(html), { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: options.format || 'A4', printBackground: true, margin: options.margin || { top: '24px', bottom: '24px', left: '24px', right: '24px' } });
    return pdf;
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Export a conversation to a saved PDF file under /uploads and return its URL.
 * `messages` are [{ author: {displayName}, body, sentAt }].
 */
async function exportConversationPdf(title, messages) {
  const bodyHtml = (messages || [])
    .map((m) => `<div class="msg"><span class="author">${escapeHtml(m.author?.displayName || 'Unknown')}</span>`
      + `<span class="time">${escapeHtml(new Date(m.sentAt || Date.now()).toLocaleString())}</span>`
      + `<div>${escapeHtml(m.body || '')}</div></div>`)
    .join('');
  const pdf = await htmlToPdf(buildDocument(title, bodyHtml));
  const sub = 'pdfs';
  const dir = path.join(uploadRoot, sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename = `${title.replace(/[^a-z0-9-_]/gi, '').slice(0, 40) || 'export'}-${Date.now()}.pdf`;
  fs.writeFileSync(path.join(dir, filename), pdf);
  return { url: `/uploads/${sub}/${filename}`, filename, bytes: pdf.length };
}

async function shutdown() {
  if (browserPromise) {
    const b = await browserPromise;
    await b.close().catch(() => {});
    browserPromise = null;
  }
}

module.exports = { htmlToPdf, exportConversationPdf, buildDocument, shutdown, escapeHtml };
