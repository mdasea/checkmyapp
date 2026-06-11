#!/usr/bin/env node

/**
 * checkmyapp preuninstall — restores the original `dev` script
 * that was backed up during postinstall.
 *
 * We only restore if:
 * 1. The current dev script still starts with checkmyapp (user hasn't manually changed it)
 * 2. A backup exists
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PREFIX = '[checkmyapp:uninstall]';

function log(...args) {
  console.log(PREFIX, ...args);
}

function warn(...args) {
  console.warn(PREFIX, ...args);
}

function getProjectRoot() {
  if (process.env.INIT_CWD) {
    return process.env.INIT_CWD;
  }
  return process.cwd();
}

function main() {
  const projectRoot = getProjectRoot();
  const pkgPath = resolve(projectRoot, 'package.json');

  if (!existsSync(pkgPath)) {
    log('No package.json found — skipping restore.');
    process.exit(0);
  }

  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  } catch (err) {
    warn('Failed to parse package.json:', err.message);
    process.exit(0);
  }

  const originalDev = pkg._checkmyapp?.originalDev;
  if (!originalDev) {
    log('No backup found — keeping current "dev" script as-is.');
    log('If needed, restore it manually.');
    process.exit(0);
  }

  const currentDev = pkg.scripts?.dev || '';

  // Only restore if the user hasn't manually modified the script after our wrapping
  if (currentDev.startsWith('checkmyapp') || currentDev.startsWith('npx checkmyapp')) {
    pkg.scripts.dev = originalDev;
    log(`✅ Restored original "dev" script: ${originalDev}`);
  } else {
    log('Current "dev" script differs from checkmyapp-wrapped version — keeping it.');
    log(`Backed-up original was: ${originalDev}`);
    log('If you want to restore it, set it manually in package.json.');
  }

  // Clean up backup field
  delete pkg._checkmyapp;

  try {
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  } catch (err) {
    warn('Failed to write package.json:', err.message);
    process.exit(1);
  }
}

main();
