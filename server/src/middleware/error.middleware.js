const { ApiError } = require('../utils/response.util');
const logger = require('../utils/logger.util');
const env = require('../config/env');

/**
 * Central error handler. Converts thrown ApiError into a clean JSON envelope,
 * Prisma errors into 4xx, and everything else into a 500 (with logging).
 */
// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details || null;

  // Prisma known errors (validation / not found / unique constraint)
  if (err.code === 'P2002') {
    statusCode = 409;
    message = `A record with this ${err.meta?.target || 'value'} already exists`;
  } else if (err.code === 'P2025') {
    statusCode = 404;
    message = 'Requested record was not found';
  } else if (err.code === 'P2003') {
    statusCode = 400;
    message = 'Invalid reference (foreign key constraint failed)';
  }

  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${statusCode}: ${err.stack || err.message}`);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} -> ${statusCode}: ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    message,
    details,
    // Only expose stack traces during local development.
    ...(env.nodeEnv === 'development' && statusCode >= 500 ? { stack: err.stack } : {}),
    timestamp: new Date().toISOString(),
  });
}

/** 404 handler for unmatched routes. */
function notFound(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

module.exports = { errorMiddleware, notFound };
