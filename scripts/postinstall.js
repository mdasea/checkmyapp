#!/usr/bin/env node

/**
 * checkmyapp postinstall — shows a hint about checkmyapp init.
 * No longer auto-wraps the dev script. Run `npx checkmyapp init`
 * to opt in to dev script wrapping.
 *
 * Environment variables:
 *   CHECKMYAPP_SKIP_INIT=1 — skip the hint entirely
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

const PREFIX = '[checkmyapp]';

function getProjectRoot() {
  if (process.env.INIT_CWD) {
    return process.env.INIT_CWD;
  }
  const nmDir = resolve(__dirname, '..');
  if (nmDir.endsWith('/node_modules/checkmyapp')) {
    return resolve(nmDir, '..', '..');
  }
  return process.cwd();
}

function main() {
  if (process.env.CHECKMYAPP_SKIP_INIT === '1' || process.env.CHECKMYAPP_SKIP_INIT === 'true') {
    return;
  }

  const projectRoot = getProjectRoot();

  console.log(`${PREFIX} ✅  checkmyapp installed.`);
  console.log(`${PREFIX}`);
  console.log(`${PREFIX}    Run this once to auto-wrap your dev script:`);
  console.log(`${PREFIX}`);
  console.log(`${PREFIX}      npx checkmyapp init`);
  console.log(`${PREFIX}`);
  console.log(`${PREFIX}    Or use it directly without setup:`);
  console.log(`${PREFIX}`);
  console.log(`${PREFIX}      npx checkmyapp vite           # tunnel any command`);
  console.log(`${PREFIX}      npx checkmyapp 8080           # tunnel existing server`);
  console.log(`${PREFIX}`);
  console.log(`${PREFIX}    Project: ${projectRoot}`);
}

main();
