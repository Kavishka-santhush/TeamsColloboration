const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const env = require('./config/env');
const { uploadRoot } = require('./config/upload');
const { globalLimiter } = require('./middleware/rateLimit.middleware');
const { errorMiddleware, notFound } = require('./middleware/error.middleware');
const routes = require('./routes');

/**
 * app.js builds the Express application: security + parsing middleware, static
 * serving of uploaded files, the mounted /api router, then 404 + error handlers.
 * Kept separate from index.js so it can be imported in tests without binding a
 * port or starting sockets/cron.
 */
const app = express();

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (local /uploads) with long-lived cache headers.
app.use('/uploads', express.static(path.resolve(uploadRoot), { maxAge: '7d', fallthrough: true }));

// Health probe at the root (useful for load balancers).
app.get('/', (req, res) => res.json({ success: true, data: { name: 'TeamComm API', status: 'ok' }, timestamp: new Date().toISOString() }));

// Global rate limit applies to the whole API surface.
app.use('/api', globalLimiter, routes);

// 404 + centralized error handling must come last.
app.use(notFound);
app.use(errorMiddleware);

module.exports = app;
