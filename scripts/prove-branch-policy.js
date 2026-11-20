'use strict';

// Temporarily remove branch isolation, prove that the automated tests fail,
// restore the original policy even on error, and prove that the tests pass.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const policyPath = path.resolve(__dirname, '../src/authorization.js');
const originalSource = fs.readFileSync(policyPath, 'utf8');
const secureLine = 'return Boolean(user.branchId && user.branchId === order.branchId);';
const insecureLine = 'return true; // intentional temporary policy failure for the negative test';

if (!originalSource.includes(secureLine)) {
  process.stderr.write('Could not find the expected branch policy line. No file was changed.\n');
  process.exit(1);
}

function runTests() {
  const isWindows = process.platform === 'win32';
  const command = isWindows ? 'npm.cmd' : 'npm';
  const result = spawnSync(command, ['test'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    shell: isWindows
  });
  if (result.error) throw result.error;
  return result.status === null ? 1 : result.status;
}

let originalRestored = false;
try {
  fs.writeFileSync(policyPath, originalSource.replace(secureLine, insecureLine));
  process.stdout.write('=== Expected failing tests while canAccessOrder allows everyone ===\n');
  const brokenStatus = runTests();

  if (brokenStatus === 0) {
    throw new Error('The tests unexpectedly passed with the branch policy removed.');
  }

  process.stdout.write('\nThe tests failed as expected while the branch policy was disabled.\n');
  fs.writeFileSync(policyPath, originalSource);
  originalRestored = true;

  process.stdout.write('\n=== Re-running tests after restoring the branch policy ===\n');
  const restoredStatus = runTests();
  if (restoredStatus !== 0) process.exitCode = restoredStatus;
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
} finally {
  if (!originalRestored) {
    fs.writeFileSync(policyPath, originalSource);
    process.stdout.write('\nOriginal branch policy restored.\n');
  }
}
