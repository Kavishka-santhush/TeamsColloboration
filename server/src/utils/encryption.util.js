const crypto = require('crypto');
const env = require('../config/env');

/**
 * AES-256-GCM helpers used to encrypt sensitive integration tokens / webhook
 * secrets at rest. The key comes from ENCRYPTION_KEY (32 chars -> 32 bytes).
 */
const ALGO = 'aes-256-gcm';

function getKey() {
  // Normalize the configured key to exactly 32 bytes.
  return crypto.createHash('sha256').update(env.security.encryptionKey).digest();
}

function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // format: iv:authTag:ciphertext (all hex)
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

function decrypt(payload) {
  if (!payload) return null;
  const [ivHex, tagHex, dataHex] = String(payload).split(':');
  if (!ivHex || !tagHex || !dataHex) throw new Error('Invalid encrypted payload format');
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}

/** Generate a URL-safe API key for bots / integrations. */
function generateApiKey(prefix = 'tc') {
  const random = crypto.randomBytes(24).toString('hex');
  return `${prefix}_${random}`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

module.exports = { encrypt, decrypt, generateApiKey, sha256 };
