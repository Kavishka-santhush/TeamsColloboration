const { startNotificationJobs } = require('./notification.job');
const { startCleanupJobs } = require('./cleanup.job');
const { startAnalyticsJobs } = require('./analytics.job');

/** Register all recurring background jobs. Called once from index.js. */
function startJobs() {
  startNotificationJobs();
  startCleanupJobs();
  startAnalyticsJobs();
}

module.exports = { startJobs };
