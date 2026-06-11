#!/usr/bin/env node

/**
 * checkmyapp postinstall — auto-patches the host project's package.json
 * to wrap the `dev` script with checkmyapp for zero-config tunneling.
 *
 * Environment variables:
 *   CHECKMYAPP_SKIP_INIT=1 — skip auto-init (e.g., in CI)
 *
 * This script runs from within node_modules/checkmyapp/ after `npm install`.
 * We use process.env.INIT_CWD to find the consumer's project root.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getProjectRoot() {
  // INIT_CWD is set by npm to the directory where the install command was run
  if (process.env.INIT_CWD) {
    return process.env.INIT_CWD;
  }

  // Fallback: walk up from our own node_modules path
  const nmDir = resolve(__dirname, '..');
  // We should be at <project>/node_modules/checkmyapp/scripts/
  // So project root is <project>
  if (nmDir.endsWith('/node_modules/checkmyapp')) {
    return resolve(nmDir, '..', '..');
  }

  // Last resort: cwd
  return process.cwd();
}

const PREFIX = '[checkmyapp:init]';

function log(...args) {
  console.log(PREFIX, ...args);
}

function warn(...args) {
  console.warn(PREFIX, ...args);
}

/**
 * Check if a dev command already contains checkmyapp wrapping.
 */
function isAlreadyWrapped(devScript) {
  if (!devScript || typeof devScript !== 'string') return false;
  const trimmed = devScript.trim();
  return trimmed.startsWith('checkmyapp') || trimmed.startsWith('npx checkmyapp');
}

/**
 * Store original dev script in a special field in package.json so
 * preuninstall can restore it cleanly.
 */
function setBackup(pkg, originalDev) {
  // Use _checkmyapp field (underscore prefix signals private/internal)
  if (!pkg._checkmyapp) {
    pkg._checkmyapp = {};
  }
  pkg._checkmyapp.originalDev = originalDev;
}

/**
 * Get the original dev script from backup.
 */
function getBackup(pkg) {
  return pkg._checkmyapp?.originalDev;
}

/**
 * Remove the backup field.
 */
function clearBackup(pkg) {
  if (pkg._checkmyapp) {
    delete pkg._checkmyapp.originalDev;
    if (Object.keys(pkg._checkmyapp).length === 0) {
      delete pkg._checkmyapp;
    }
  }
}

function main() {
  // Respect skip flag
  if (process.env.CHECKMYAPP_SKIP_INIT === '1' || process.env.CHECKMYAPP_SKIP_INIT === 'true') {
    log('CHECKMYAPP_SKIP_INIT is set — skipping auto-init.');
    process.exit(0);
  }

  const projectRoot = getProjectRoot();
  const pkgPath = resolve(projectRoot, 'package.json');

  if (!existsSync(pkgPath)) {
    warn('No package.json found at', projectRoot, '— skipping auto-init.');
    process.exit(0);
  }

  // Read the host project's package.json
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  } catch (err) {
    warn('Failed to parse package.json:', err.message);
    process.exit(0);
  }

  const currentDev = pkg.scripts?.dev;

  // If the project doesn't have a dev script, nothing to wrap
  if (!currentDev) {
    log('No "dev" script found in package.json — nothing to wrap.');
    log('Run "checkmyapp init" later if you want to set it up manually.');
    process.exit(0);
  }

  // If already wrapped, skip
  if (isAlreadyWrapped(currentDev)) {
    log('"dev" script is already wrapped with checkmyapp — skipping.');
    process.exit(0);
  }

  // Back up the original
  setBackup(pkg, currentDev);

  // Wrap it
  const newDev = `checkmyapp dev -- ${currentDev}`;
  pkg.scripts.dev = newDev;

  // Write the modified package.json
  try {
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
    log();
    log('✅  Auto-configured! Your "dev" script is now tunneled via checkmyapp.');
    log();
    log(`   Original:  npm run dev  →  ${currentDev}`);
    log(`   New:       npm run dev  →  ${newDev}`);
    log();
    log('   Continue using "npm run dev" as always — the tunnel URL');
    log('   will appear in your terminal output.');
    log();
    log('   To remove: npm uninstall checkmyapp (restores original script)');
    log('   To skip auto-init: CHECKMYAPP_SKIP_INIT=1 npm install');
    log();
  } catch (err) {
    warn('Failed to write package.json:', err.message);
    process.exit(1);
  }
}

main();
