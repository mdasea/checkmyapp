#!/usr/bin/env node

// checkmyapp — CLI entry point
import process from 'node:process';
import { readFileSync, realpathSync } from 'node:fs';
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

┌─────────────────────────────────────────────┐
│          🚀  checkmyapp v${PACKAGE_VERSION.padEnd(17)}│
│          Zero-config tunnel for dev servers  │
└─────────────────────────────────────────────┘

USAGE
  $ checkmyapp [options] [-- <command>]

MODES
  Auto                  Just run checkmyapp to auto-detect and tunnel
                        your npm run dev server.

  Dev (wrap command)    checkmyapp [options] [--] <command>
                        Wrap any command to auto-detect its port and
                        create a tunnel. The -- separator is optional
                        when there are no checkmyapp flags.
                        Example: checkmyapp vite
                                 checkmyapp mvn spring-boot:run
                                 checkmyapp --subdomain mysite -- vite

  Port (existing)       checkmyapp <port> [options]
                        Tunnel an already-running server on a port.
                        Example: checkmyapp 8080
                                 checkmyapp 8080 --subdomain mysite

OPTIONS
  --port <port>         Explicitly specify port (same as positional)
  --subdomain <name>    Custom subdomain (Pro feature)

COMMANDS
  auth [provider]       Authenticate (github, google)
                        Optional — needed for custom subdomains

  status                Show session, config, and bandwidth info

  logout                Clear stored credentials

  --help, -h            Show this help
  --version, -v         Show version

EXAMPLES
  # Auto-detect npm run dev
  $ checkmyapp

  # Tunnel a Vite project (auto-detect port)
  $ checkmyapp vite

  # Tunnel a Spring Boot app (auto-detect port)
  $ checkmyapp mvn spring-boot:run

  # Tunnel an already-running server on port 8080
  $ checkmyapp 8080

  # Same, with custom subdomain (Pro)
  $ checkmyapp 8080 --subdomain mysite

  # Explicit port flag
  $ checkmyapp --port 8080 --subdomain mysite

  # Authenticate for Pro features
  $ checkmyapp auth github

  # Check your status
  $ checkmyapp status

FREE TIER
  • 1 concurrent tunnel session
  • 500 MB/day bandwidth
  • Random subdomain
  • 60 min session expiry

PRO ($5 / month — 15-day grace for late payment)
  • Unlimited concurrent tunnels
  • 10 GB/month bandwidth
  • Custom subdomains
  • 24 hour sessions

📊 Dashboard: https://checkmyapp.online/dashboard
📖 Docs:      https://checkmyapp.online/pro
🐙 GitHub:    https://github.com/mdasea/checkmyapp
`.trim());
}

/**
 * Print version.
 */
function printVersion() {
  console.log(`checkmyapp v${PACKAGE_VERSION}`);
}

/**
 * Parse raw CLI args into structured options.
 * Extracts --subdomain and --port flags; returns rest (non-flag args).
 *
 * @param {string[]} args - Raw CLI args (process.argv.slice(2))
 * @returns {{ subdomain: string|null, port: number|null, rest: string[] }}
 */
export function parseArgs(args) {
  let subdomain = null;
  let port = null;
  const rest = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--subdomain' && i + 1 < args.length) {
      subdomain = args[++i];
    } else if (args[i] === '--port' && i + 1 < args.length) {
      const parsed = parseInt(args[++i], 10);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
        console.error(`❌ Invalid port: ${args[i]}`);
        process.exit(1);
      }
      port = parsed;
    } else {
      rest.push(args[i]);
    }
  }

  return { subdomain, port, rest };
}

/**
 * Build handleDev-compatible args from a subdomain and command parts.
 * Returns args like ['--subdomain', <s>, '--', <cmd>, ...<cmdArgs>]
 * If subdomain is null, returns ['--', <cmd>, ...<cmdArgs>]
 */
function buildDevArgs(subdomain, cmd, cmdArgs = []) {
  const args = [];
  if (subdomain) args.push('--subdomain', subdomain);
  args.push('--', cmd, ...cmdArgs);
  return args;
}

/**
 * Get the command and args for the dev server.
 * Supports: checkmyapp dev [-- <command> <args...>]
 * If no command is given, default to ['npm', 'run', 'dev'].
 *
 * @param {string[]} args - The remaining CLI args after 'dev'
 * @returns {{ command: string, args: string[] }}
 */
export function getDevCommand(args) {
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

// The known subcommand names — anything else is treated as a dev command to wrap
const KNOWN_COMMANDS = ['dev', 'auth', 'status', 'logout'];

/**
 * Route parsed args to the correct handler.
 * Exported for testing.
 *
 * @param {{ subdomain: string|null, port: number|null, rest: string[] }} parsed
 */
export async function route(parsed) {
  const { subdomain, port, rest } = parsed;

  // --- No positional args → dev mode (npm run dev) ---
  if (rest.length === 0 && port === null) {
    const devArgs = subdomain ? ['--subdomain', subdomain] : [];
    await handleDev(devArgs);
    return;
  }

  const first = rest[0];

  // --- Help / version ---
  if (['--help', '-h', 'help'].includes(first)) { printHelp(); return; }
  if (['--version', '-v', 'version'].includes(first)) { printVersion(); return; }

  // --- Port explicitly set via --port flag ---
  if (port !== null) {
    await handlePort(port, subdomain);
    return;
  }

  // --- First rest arg is numeric → port mode ---
  if (/^\d+$/.test(first)) {
    const p = parseInt(first, 10);
    if (!Number.isFinite(p) || p < 1 || p > 65535) {
      console.error(`❌ Invalid port: ${first}`);
      process.exit(1);
    }
    await handlePort(p, subdomain);
    return;
  }

  // --- Known subcommands (backward compat) ---
  if (KNOWN_COMMANDS.includes(first)) {
    switch (first) {
      case 'dev':
        await handleDev(rest.slice(1));
        break;
      case 'auth':
        await handleAuth(rest.slice(1));
        break;
      case 'status':
        await handleStatus();
        break;
      case 'logout':
        handleLogout();
        break;
    }
    return;
  }

  // --- -- separator present → dev mode with custom command ---
  const dashIdx = rest.indexOf('--');
  if (dashIdx !== -1) {
    // Check for checkmyapp flags before the --
    const opts = rest.slice(0, dashIdx);
    const cmdParts = rest.slice(dashIdx + 1);
    let cmdSubdomain = subdomain;
    for (let i = 0; i < opts.length; i++) {
      if (opts[i] === '--subdomain' && i + 1 < opts.length) {
        cmdSubdomain = opts[++i];
      }
    }
    const devArgs = buildDevArgs(cmdSubdomain, ...(cmdParts.length > 0 ? [cmdParts[0], cmdParts.slice(1)] : [null]));
    await handleDev(devArgs);
    return;
  }

  // --- Anything else → dev mode: wrap as command (no -- needed) ---
  // e.g. checkmyapp vite → handleDev(['--', 'vite'])
  //      checkmyapp mvn spring-boot:run → handleDev(['--', 'mvn', 'spring-boot:run'])
  //      checkmyapp --subdomain foo vite → handleDev(['--subdomain', 'foo', '--', 'vite'])
  const devArgs = buildDevArgs(subdomain, first, rest.slice(1));
  await handleDev(devArgs);
}

/**
 * Handle port mode — tunnel to an already-running server.
 *
 * @param {number} localPort
 * @param {string|null} customSubdomain
 */
async function handlePort(localPort, customSubdomain) {
  const token = getToken() || '';
  if (token) {
    const valid = await validateToken();
    if (valid) {
      console.log('🔑 Authenticated — Pro features enabled');
    }
  } else {
    console.log('🔑 Running anonymously — login at https://checkmyapp.online/dashboard to track usage');
  }

  console.log(`🔌 Connecting tunnel to localhost:${localPort}...`);

  const serverUrl = get('serverUrl') || 'https://api.checkmyapp.online';
  const tunnel = new TunnelClient({
    localPort,
    token,
    serverUrl,
    subdomain: customSubdomain || null,
  });

  try {
    await tunnel.connect();
    // Track tunnel usage
    const count = (get('tunnelCount') || 0) + 1;
    set('tunnelCount', count);
  } catch (err) {
    console.error(`❌ Failed to establish tunnel: ${err.message}`);
    process.exit(1);
  }

  // --- Graceful shutdown ---
  function shutdown(signal) {
    console.log(`\n🛑 Received ${signal}. Shutting down...`);
    tunnel.disconnect();
    process.exit(0);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Keep alive
  await new Promise(() => {});
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
      console.log('🔑 Authenticated — Pro features enabled');
    }
  } else {
    console.log('🔑 Running anonymously — login at https://checkmyapp.online/dashboard to track usage');
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
    // Track tunnel usage
    const count = (get('tunnelCount') || 0) + 1;
    set('tunnelCount', count);
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
async function handleStatus() {
  const token = getToken();
  const serverUrl = get('serverUrl') || 'http://localhost:3000';
  const lastSubdomain = get('lastSubdomain') || 'none';
  const configPath = getConfigPath();
  const tunnelCount = get('tunnelCount') || 0;

  let bandwidthInfo = '';
  let tierInfo = '';

  if (token) {
    try {
      const res = await fetch(`${serverUrl}/api/tunnel/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.bandwidth) {
          const usedMB = (data.bandwidth.bytesUsed / 1024 / 1024).toFixed(1);
          const limitMB = (data.bandwidth.bytesLimit / 1024 / 1024).toFixed(0);
          bandwidthInfo = `  Bandwidth:       ${usedMB} MB / ${limitMB} MB (${data.bandwidth.period})`;
          tierInfo = `  Plan:            ${data.bandwidth.tier === 'paid' ? 'Pro ✅' : 'Free'}`;
        }
      }
    } catch {}
  }

  console.log(`
┌──────────────────────────────────────┐
│ 📋  checkmyapp Status                │
├──────────────────────────────────────┤
  Version:         v${PACKAGE_VERSION}
  Node.js:         ${process.version}
  Platform:        ${process.platform}
  Config file:     ${configPath}
  Server URL:      ${serverUrl}
  Authenticated:   ${token ? '✅ Yes' : '❌ No (not required)'}
${tierInfo ? tierInfo + '\n' : ''}${bandwidthInfo ? bandwidthInfo + '\n' : ''}  Last subdomain:  ${lastSubdomain}
  Tunnels created: ${tunnelCount}
│
├──────────────────────────────────────│
│ 📊  https://checkmyapp.online/dashboard   │
└──────────────────────────────────────┘`.trim());
}

/**
 * Handle the 'logout' command.
 */
function handleLogout() {
  configClear();
  console.log('🧹 Credentials cleared.');
}

// --- Main handler ---
async function main() {
  // Fire-and-forget version check
  checkForUpdate(PACKAGE_VERSION);

  const parsed = parseArgs(process.argv.slice(2));
  await route(parsed);
}

// Only run when executed directly, not when imported as a module (e.g., tests)
const isMainModule = (() => {
  try {
    if (!process.argv[1]) return false;
    const argvPath = realpathSync(process.argv[1]);
    const thisPath = realpathSync(__filename);
    return argvPath === thisPath;
  } catch {
    return false;
  }
})();

if (isMainModule) {
  main().catch((err) => {
    console.error('❌ Unexpected error:', err.message);
    process.exit(1);
  });
}
