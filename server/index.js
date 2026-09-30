/**
 * Root entrypoint. package.json's start script (`node index.js`) resolves here;
 * the real bootstrapping lives in src/index.js. This thin shim keeps the npm
 * script simple while the code stays organized under src/.
 */
require('./src/index');
