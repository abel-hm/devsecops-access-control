'use strict';

const { loadConfig } = require('./config');
try {
  const config = loadConfig();
  const { createApp } = require('./app');
  const app = createApp({ config });
  app.listen(config.port, () => {
    process.stdout.write(`DineDesk API listening on port ${config.port}\n`);
  });
} catch (error) {
  // Startup errors name the setting but never display its value.
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
