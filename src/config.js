'use strict';

const fs = require('node:fs');
const path = require('node:path');

function loadLocalEnvFile(env) {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const contents = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!Object.hasOwn(env, key)) env[key] = value;
  }
}

function loadConfig(env = process.env) {
  if (env === process.env) loadLocalEnvFile(env);

  const secret = env.JWT_SECRET;
  if (!secret) {
    throw new Error('Configuration error: Missing required setting JWT_SECRET.');
  }
  if (String(secret).length < 32) {
    throw new Error('Configuration error: JWT_SECRET must be at least 32 characters.');
  }

  return Object.freeze({
    port: Number(env.PORT || 3000),
    jwtSecret: String(secret),
    jwtIssuer: String(env.JWT_ISSUER || 'dinedesk-api'),
    jwtAudience: String(env.JWT_AUDIENCE || 'dinedesk-staff'),
    jwtExpiresIn: '15m'
  });
}

module.exports = { loadConfig };
