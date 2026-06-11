#!/usr/bin/env node

// checkmyapp — CLI entry point
import process from 'node:process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { get, set, clear as configClear, getConfigPath } from '../src/config.js';
import { authenticate, getToken, validateToken } from '../src/auth.js';
import { spawnDevServer } from '../src/port-detection.js';
import TunnelClient from '../src/tunnel.js';
import { checkForUpdate } from '../src/update-check.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package version
let PACKAGE_VERSION = '1.0.0';
try {
  const pkgPath = resolve(__dirname, '..', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  PACKAGE_VERSION = pkg.version || PACKAGE_VERSION;
} catch { /* ignore */ }

/**
 * Print usage information.
 */
function printHelp() {
  console.log(`

🚀 checkmyapp v${PACKAGE_VERSION} — Tunnel your dev server to the world

USAGE
  checkmyapp [command]

ZERO-CONFIG SETUP
  npm install --save-dev checkmyapp
  npm run dev                  # tunneled automatically via postinstall

COMMANDS
  dev [command] [args...]   Start dev server and tunnel it (default)
    If a command is provided, it is run instead of 'npm run dev'.
    Example: checkmyapp dev -- npx vite

  auth [provider]           Authenticate with OAuth provider (default: github)
                            Optional — only needed for Pro features

  status                    Show current session and config info

  logout                    Clear stored credentials

  --help, -h                Show this help

  --version, -v             Show version

EXAMPLES
  checkmyapp dev            Spawn 'npm run dev', detect port, start tunnel
  checkmyapp dev -- npx vite  Run a specific dev command
  checkmyapp auth google    Authenticate with Google
`.trim());
}

/**
 * Print version.
 */
function printVersion() {
  console.log(`checkmyapp v${PACKAGE_VERSION}`);
}

/**
 * Get the command and args for the dev server.
 * Supports: checkmyapp dev [-- <command> <args...>]
 * If no command is given, default to ['npm', 'run', 'dev'].
 *
 * @param {string[]} args - The remaining CLI args after 'dev'
 * @returns {{ command: string, args: string[] }}
 */
function getDevCommand(args) {
  // If the first arg after 'dev' is '--', consume it and take the rest as command + args
  if (args.length > 0 && args[0] === '--') {
    const cmdArgs = args.slice(1);
    if (cmdArgs.length === 0) {
      return { command: 'npm', args: ['run', 'dev'] };
    }
    return { command: cmdArgs[0], args: cmdArgs.slice(1) };
  }

  // If there are remaining args, treat first as command, rest as args
  if (args.length > 0) {
    return { command: args[0], args: args.slice(1) };
  }

  return { command: 'npm', args: ['run', 'dev'] };
}

/**
 * Handle the 'dev' command — the core workflow.
 * No auth required — anonymous tunnels are free tier.
 * Optionally provide --subdomain <name> for Pro users.
 *
 * @param {string[]} args - Remaining CLI args
 */
async function handleDev(args) {
  // --- Check for --subdomain flag ---
  let customSubdomain = null;
  const filteredArgs = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--subdomain' && i + 1 < args.length) {
      customSubdomain = args[++i];
    } else {
      filteredArgs.push(args[i]);
    }
  }

  // --- Optional token (no auth required to run) ---
  const token = getToken() || '';
  if (token) {
    const valid = await validateToken();
    if (valid) {
      console.log(`🔑 Authenticated — Pro features enabled`);
    }
  } else {
    console.log(`🔑 Running anonymously — login at https://checkmyapp.online/dashboard to track usage`);
  }

  // --- Get dev server command ---
  const devCmd = getDevCommand(filteredArgs);
  console.log(`⚙️  Starting dev server: ${devCmd.command} ${devCmd.args.join(' ')}`);

  // --- Spawn dev server ---
  const { child, portPromise, kill: killChild } = spawnDevServer(devCmd.command, devCmd.args);

  // Forward output to console
  const prefix = devCmd.command === 'npm' ? '' : `[${devCmd.command}] `;
  child.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
  });
  child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  // --- Wait for port detection ---
  let localPort;
  try {
    localPort = await portPromise;
    console.log(`🔍 Detected dev server on port ${localPort}`);
  } catch (err) {
    console.error(`❌ Failed to detect dev server port: ${err.message}`);
    killChild();
    process.exit(1);
  }

  // --- Start tunnel ---
  const serverUrl = get('serverUrl') || 'https://api.checkmyapp.online';
  const tunnel = new TunnelClient({
    localPort,
    token,
    serverUrl,
    subdomain: customSubdomain,
  });

  try {
    await tunnel.connect();
  } catch (err) {
    console.error(`❌ Failed to establish tunnel: ${err.message}`);
    killChild();
    process.exit(1);
  }

  // --- Graceful shutdown ---
  function shutdown(signal) {
    console.log(`\n🛑 Received ${signal}. Shutting down...`);
    tunnel.disconnect();
    killChild();
    process.exit(0);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Keep alive — wait for child exit
  child.on('exit', (code) => {
    console.log(`🏁 Dev server exited (code: ${code}).`);
    tunnel.disconnect();
    process.exit(code || 0);
  });
}

/**
 * Handle the 'auth' command.
 * @param {string[]} args
 */
async function handleAuth(args) {
  const provider = args[0] || 'github';
  try {
    await authenticate(provider);
  } catch (err) {
    console.error(`❌ Authentication failed: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Handle the 'status' command.
 */
function handleStatus() {
  const token = getToken();
  const serverUrl = get('serverUrl') || 'http://localhost:3000';
  const lastSubdomain = get('lastSubdomain') || 'none';
  const configPath = getConfigPath();

  console.log(`
📋 checkmyapp Status
====================
  Server URL:      ${serverUrl}
  Authenticated:   ${token ? '✅ Yes' : '❌ No (not required)'}
  Last subdomain:  ${lastSubdomain}
  Config file:     ${configPath}
  Node.js:         ${process.version}
  Platform:        ${process.platform}
`.trim());
}

/**
 * Handle the 'logout' command.
 */
function handleLogout() {
  configClear();
  console.log('🧹 Credentials cleared.');
}

// --- Main ---
async function main() {
  // Fire-and-forget version check
  checkForUpdate(PACKAGE_VERSION);

  const cmd = process.argv[2] || 'dev';
  const rest = process.argv.slice(3);

  switch (cmd) {
    case '--help':
    case '-h':
    case 'help':
      printHelp();
      break;

    case '--version':
    case '-v':
    case 'version':
      printVersion();
      break;

    case 'dev':
      await handleDev(rest);
      break;

    case 'auth':
      await handleAuth(rest);
      break;

    case 'status':
      handleStatus();
      break;

    case 'logout':
      handleLogout();
      break;

    default:
      console.error(`Unknown command: ${cmd}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err.message);
  process.exit(1);
});
