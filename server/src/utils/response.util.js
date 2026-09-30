/**
 * Consistent API response envelope + a throwable ApiError used by services and
 * translated into a JSON error by the error middleware.
 */
class ApiError extends Error {
  constructor(statusCode, message, details = null, code = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg, details) {
    return new ApiError(400, msg, details, 'BAD_REQUEST');
  }
  static unauthorized(msg = 'Authentication required') {
    return new ApiError(401, msg, null, 'UNAUTHORIZED');
  }
  static forbidden(msg = 'You do not have permission to perform this action') {
    return new ApiError(403, msg, null, 'FORBIDDEN');
  }
  static notFound(msg = 'Resource not found') {
    return new ApiError(404, msg, null, 'NOT_FOUND');
  }
  static conflict(msg) {
    return new ApiError(409, msg, null, 'CONFLICT');
  }
  static tooMany(msg = 'Too many requests') {
    return new ApiError(429, msg, null, 'RATE_LIMITED');
  }
  static internal(msg = 'Internal server error') {
    return new ApiError(500, msg, null, 'INTERNAL_ERROR');
  }
}

/** Standard success response. */
function success(res, data = null, message = 'OK', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
}

/** Standard paginated success response. */
function paginated(res, items, meta = {}, message = 'OK') {
  return res.status(200).json({
    success: true,
    message,
    data: items,
    meta: {
      page: meta.page || 1,
      limit: meta.limit || items.length,
      total: meta.total || items.length,
      totalPages: meta.totalPages || 1,
      hasMore: meta.hasMore || false,
      nextCursor: meta.nextCursor || null,
    },
    timestamp: new Date().toISOString(),
  });
}

/** Standard error response (also usable directly, but usually via middleware). */
function error(res, statusCode = 500, message = 'Server error', details = null) {
  return res.status(statusCode).json({
    success: false,
    message,
    details,
    timestamp: new Date().toISOString(),
  });
}

module.exports = { ApiError, success, paginated, error };
