const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const env = require('./env');

/**
 * Multer local-storage configuration. Files land in <UPLOAD_DIR>/ organized by
 * date, with a random, collision-proof filename. No cloud storage.
 */
const uploadRoot = path.resolve(process.cwd(), env.upload.dir);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const now = new Date();
    const sub = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dir = path.join(uploadRoot, sub);
    ensureDir(dir);
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9-_]/gi, '').slice(0, 40) || 'file';
    cb(null, `${base}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  // Block obviously dangerous extensions; everything else is allowed.
  const blocked = ['.exe', '.bat', '.cmd', '.sh', '.msi', '.js', '.scr'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (blocked.includes(ext)) return cb(new Error(`File type ${ext} is not allowed`));
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.upload.maxFileSizeMb * 1024 * 1024, files: 10 },
});

module.exports = { upload, uploadRoot, ensureDir };
