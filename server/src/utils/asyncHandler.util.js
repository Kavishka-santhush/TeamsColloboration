/**
 * Wrap an async route handler so rejected promises reach the error middleware
 * (Express 4 does not catch async throws automatically).
 */
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
