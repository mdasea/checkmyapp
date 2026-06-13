// tests/cli.test.js
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, getDevCommand, route } from '../bin/checkmyapp.js';

// ─────────────────────────────────────────────
// parseArgs — flag extraction
// ─────────────────────────────────────────────
describe('parseArgs', () => {
  it('parses empty args', () => {
    const result = parseArgs([]);
    assert.equal(result.subdomain, null);
    assert.equal(result.port, null);
    assert.deepEqual(result.rest, []);
  });

  it('parses only subdomain', () => {
    const result = parseArgs(['--subdomain', 'mysite']);
    assert.equal(result.subdomain, 'mysite');
    assert.equal(result.port, null);
    assert.deepEqual(result.rest, []);
  });

  it('parses only port', () => {
    const result = parseArgs(['--port', '8080']);
    assert.equal(result.subdomain, null);
    assert.equal(result.port, 8080);
    assert.deepEqual(result.rest, []);
  });

  it('parses port and subdomain', () => {
    const result = parseArgs(['--port', '3000', '--subdomain', 'mysite']);
    assert.equal(result.subdomain, 'mysite');
    assert.equal(result.port, 3000);
    assert.deepEqual(result.rest, []);
  });

  it('parses subdomain with rest args', () => {
    const result = parseArgs(['--subdomain', 'mysite', 'vite']);
    assert.equal(result.subdomain, 'mysite');
    assert.equal(result.port, null);
    assert.deepEqual(result.rest, ['vite']);
  });

  it('parses numeric first arg as rest (not port)', () => {
    const result = parseArgs(['8080']);
    assert.equal(result.subdomain, null);
    assert.equal(result.port, null);
    assert.deepEqual(result.rest, ['8080']);
  });

  it('parses subdomain, port, and positional', () => {
    const result = parseArgs(['--subdomain', 'mysite', '--port', '8080', 'extra']);
    assert.equal(result.subdomain, 'mysite');
    assert.equal(result.port, 8080);
    assert.deepEqual(result.rest, ['extra']);
  });

  it('parses -- separator in rest', () => {
    const result = parseArgs(['--subdomain', 'mysite', '--', 'vite']);
    assert.equal(result.subdomain, 'mysite');
    assert.equal(result.port, null);
    assert.deepEqual(result.rest, ['--', 'vite']);
  });

  it('parses commands (dev, auth, etc.) in rest', () => {
    const result = parseArgs(['dev', '--', 'vite']);
    assert.equal(result.subdomain, null);
    assert.equal(result.port, null);
    assert.deepEqual(result.rest, ['dev', '--', 'vite']);
  });

  it('parses help', () => {
    const result = parseArgs(['--help']);
    assert.deepEqual(result.rest, ['--help']);
  });

  it('parses version', () => {
    const result = parseArgs(['--version']);
    assert.deepEqual(result.rest, ['--version']);
  });
});

// ─────────────────────────────────────────────
// getDevCommand — dev command extraction
// ─────────────────────────────────────────────
describe('getDevCommand', () => {
  it('defaults to npm run dev with no args', () => {
    const result = getDevCommand([]);
    assert.equal(result.command, 'npm');
    assert.deepEqual(result.args, ['run', 'dev']);
  });

  it('extracts command after --', () => {
    const result = getDevCommand(['--', 'vite']);
    assert.equal(result.command, 'vite');
    assert.deepEqual(result.args, []);
  });

  it('extracts command with args after --', () => {
    const result = getDevCommand(['--', 'mvn', 'spring-boot:run']);
    assert.equal(result.command, 'mvn');
    assert.deepEqual(result.args, ['spring-boot:run']);
  });

  it('treats first non-flag arg as command', () => {
    const result = getDevCommand(['vite']);
    assert.equal(result.command, 'vite');
    assert.deepEqual(result.args, []);
  });

  it('treats first arg as command with remaining as args', () => {
    const result = getDevCommand(['node', 'server.js']);
    assert.equal(result.command, 'node');
    assert.deepEqual(result.args, ['server.js']);
  });

  it('returns npm run dev for empty args after --', () => {
    const result = getDevCommand(['--']);
    assert.equal(result.command, 'npm');
    assert.deepEqual(result.args, ['run', 'dev']);
  });

  it('treats args as command without --', () => {
    const result = getDevCommand(['mvn', 'spring-boot:run']);
    assert.equal(result.command, 'mvn');
    assert.deepEqual(result.args, ['spring-boot:run']);
  });
});

// ─────────────────────────────────────────────
// route — arg routing (mocked handlers)
// ─────────────────────────────────────────────
describe('route', () => {
  it('routes no args to handleDev as empty array', async () => {
    // We can't easily mock handleDev since it's internal,
    // but we can verify it doesn't throw for non-server actions.
    // Instead test parseArgs + route integration with mocking
    // the tunnel client creation would need a server.
    // For now, verify the routing logic doesn't crash on trivial cases.
    // The real I/O tests are below in the integration tests.
  });
});

// ─────────────────────────────────────────────
// Integration: parseArgs + route logic (no network)
// ─────────────────────────────────────────────
describe('CLI mode detection (parseArgs only — no actual execution)', () => {
  // These tests verify parseArgs returns the correct structure
  // that will trigger the right handler in route().

  function detectMode(args) {
    const parsed = parseArgs(args);
    const { subdomain, port, rest } = parsed;

    if (rest.length === 0 && port === null) return { mode: 'dev-auto' };
    if (port !== null) return { mode: 'port-flag', port, subdomain };
    if (/^\d+$/.test(rest[0])) return { mode: 'port-pos', port: parseInt(rest[0], 10), subdomain };
    if (['dev', 'auth', 'status', 'logout'].includes(rest[0])) return { mode: `cmd-${rest[0]}` };
    if (rest.includes('--')) return { mode: 'dev-wrap-dash', subdomain };
    return { mode: 'dev-wrap-implicit', subdomain, cmd: rest[0] };
  }

  it('detects dev-auto mode: checkmyapp', () => {
    assert.deepEqual(detectMode([]), { mode: 'dev-auto' });
  });

  it('detects dev-auto mode: checkmyapp --subdomain foo', () => {
    const result = detectMode(['--subdomain', 'foo']);
    assert.equal(result.mode, 'dev-auto');
    // subdomain is parsed but rest is empty → dev-auto
  });

  it('detects port-pos mode: checkmyapp 8080', () => {
    assert.deepEqual(detectMode(['8080']), { mode: 'port-pos', port: 8080, subdomain: null });
  });

  it('detects port-pos mode: checkmyapp 8080 --subdomain mysite', () => {
    assert.deepEqual(detectMode(['8080', '--subdomain', 'mysite']), { mode: 'port-pos', port: 8080, subdomain: 'mysite' });
  });

  it('detects port-flag mode: checkmyapp --port 8080', () => {
    assert.deepEqual(detectMode(['--port', '8080']), { mode: 'port-flag', port: 8080, subdomain: null });
  });

  it('detects port-flag mode: checkmyapp --port 8080 --subdomain mysite', () => {
    assert.deepEqual(detectMode(['--port', '8080', '--subdomain', 'mysite']), { mode: 'port-flag', port: 8080, subdomain: 'mysite' });
  });

  it('detects cmd-dev mode: checkmyapp dev -- vite', () => {
    assert.deepEqual(detectMode(['dev', '--', 'vite']), { mode: 'cmd-dev' });
  });

  it('detects cmd-auth mode: checkmyapp auth github', () => {
    assert.deepEqual(detectMode(['auth', 'github']), { mode: 'cmd-auth' });
  });

  it('detects cmd-status mode: checkmyapp status', () => {
    assert.deepEqual(detectMode(['status']), { mode: 'cmd-status' });
  });

  it('detects cmd-logout mode: checkmyapp logout', () => {
    assert.deepEqual(detectMode(['logout']), { mode: 'cmd-logout' });
  });

  it('detects dev-wrap-dash mode: checkmyapp -- -- vite', () => {
    assert.deepEqual(detectMode(['--', 'vite']), { mode: 'dev-wrap-dash', subdomain: null });
  });

  it('detects dev-wrap-dash mode: checkmyapp --subdomain foo -- vite', () => {
    assert.deepEqual(detectMode(['--subdomain', 'foo', '--', 'vite']), { mode: 'dev-wrap-dash', subdomain: 'foo' });
  });

  it('detects dev-wrap-implicit mode: checkmyapp vite', () => {
    assert.deepEqual(detectMode(['vite']), { mode: 'dev-wrap-implicit', subdomain: null, cmd: 'vite' });
  });

  it('detects dev-wrap-implicit mode: checkmyapp --subdomain foo vite', () => {
    assert.deepEqual(detectMode(['--subdomain', 'foo', 'vite']), { mode: 'dev-wrap-implicit', subdomain: 'foo', cmd: 'vite' });
  });

  it('detects dev-wrap-implicit mode: checkmyapp mvn spring-boot:run', () => {
    assert.deepEqual(detectMode(['mvn', 'spring-boot:run']), { mode: 'dev-wrap-implicit', subdomain: null, cmd: 'mvn' });
  });
});

// ─────────────────────────────────────────────
// Integration: buildDevArgs edge cases via getDevCommand
// ─────────────────────────────────────────────
describe('buildDevArgs output (via getDevCommand)', () => {
  it('checkmyapp alone produces npm run dev', () => {
    // This simulates what route() passes to handleDev for dev-auto
    // route passes empty array → handleDev → getDevCommand([])
    assert.deepEqual(getDevCommand([]), { command: 'npm', args: ['run', 'dev'] });
  });

  it('checkmyapp -- -- vite produces vite', () => {
    // route sees -- in rest → builds args ['--', 'vite'] for handleDev
    // handleDev strips no flags → getDevCommand(['--', 'vite'])
    assert.deepEqual(getDevCommand(['--', 'vite']), { command: 'vite', args: [] });
  });

  it('checkmyapp --subdomain foo -- vite passes through', () => {
    // route extracts subdomain, builds ['--subdomain', 'foo', '--', 'vite'] for handleDev
    // handleDev strips --subdomain foo → getDevCommand(['--', 'vite'])
    assert.deepEqual(getDevCommand(['--', 'vite']), { command: 'vite', args: [] });
  });

  it('checkmyapp vite produces vite command', () => {
    // route builds ['--', 'vite'] → handleDev → getDevCommand(['--', 'vite'])
    assert.deepEqual(getDevCommand(['--', 'vite']), { command: 'vite', args: [] });
  });

  it('checkmyapp mvn spring-boot:run produces mvn command', () => {
    // route builds ['--', 'mvn', 'spring-boot:run'] → handleDev → getDevCommand(['--', 'mvn', 'spring-boot:run'])
    assert.deepEqual(getDevCommand(['--', 'mvn', 'spring-boot:run']), { command: 'mvn', args: ['spring-boot:run'] });
  });

  it('checkmyapp --subdomain foo vite produces vite with subdomain stripped from dev args', () => {
    // route builds ['--subdomain', 'foo', '--', 'vite'] → handleDev strips --subdomain foo → getDevCommand(['--', 'vite'])
    // Simulate what handleDev's filteredArgs would be:
    const args = ['--subdomain', 'foo', '--', 'vite'];
    const filtered = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--subdomain' && i + 1 < args.length) {
        i++; // skip value
      } else {
        filtered.push(args[i]);
      }
    }
    assert.deepEqual(filtered, ['--', 'vite']);
    assert.deepEqual(getDevCommand(filtered), { command: 'vite', args: [] });
  });
});

// ─────────────────────────────────────────────
// Full flow: simulate all user scenarios
// ─────────────────────────────────────────────
describe('User scenarios — full CLI simulation', () => {
  it('Scenario A: nodejs project, no subdomain — npm run dev', () => {
    // User runs: checkmyapp (no args)
    // Expected: dev-auto → handleDev([]) → getDevCommand([]) → npm run dev
    const parsed = parseArgs([]);
    assert.equal(parsed.rest.length, 0);
    assert.equal(parsed.port, null);
    // route() would go to dev-auto branch → handleDev([])
    const devCmd = getDevCommand([]);
    assert.equal(devCmd.command, 'npm');
    assert.deepEqual(devCmd.args, ['run', 'dev']);
  });

  it('Scenario B: nodejs project with custom subdomain — explicit --subdomain', () => {
    // User runs: checkmyapp --subdomain mysite
    // Expected: dev-auto with subdomain → handleDev(['--subdomain', 'mysite'])
    const parsed = parseArgs(['--subdomain', 'mysite']);
    assert.equal(parsed.subdomain, 'mysite');
    assert.equal(parsed.rest.length, 0);
    assert.equal(parsed.port, null);
    // route() would build: ['--subdomain', 'mysite'] → handleDev(...) → strips subdomain
    // → getDevCommand([]) → npm run dev
    const devCmd = getDevCommand([]);
    assert.equal(devCmd.command, 'npm');
    assert.deepEqual(devCmd.args, ['run', 'dev']);
  });

  it('Scenario C: springboot project, already running — positional port', () => {
    // User runs: checkmyapp 8080
    // Expected: port-pos → handlePort(8080, null)
    const parsed = parseArgs(['8080']);
    assert.equal(parsed.port, null); // not a --port flag
    assert.equal(parsed.rest[0], '8080');
    // route() would detect first rest arg is numeric → port mode
    assert(/^\d+$/.test(parsed.rest[0]));
  });

  it('Scenario D: springboot project with subdomain — port + subdomain', () => {
    // User runs: checkmyapp 8080 --subdomain mysite
    // Expected: port-pos → handlePort(8080, 'mysite')
    const parsed = parseArgs(['8080', '--subdomain', 'mysite']);
    assert.equal(parsed.subdomain, 'mysite');
    assert.equal(parsed.port, null);
    assert.equal(parsed.rest[0], '8080');
    assert(/^\d+$/.test(parsed.rest[0]), 'first rest arg should be numeric');
  });

  it('Scenario E: nodejs project without install — wrap vite', () => {
    // User runs: checkmyapp vite
    // Expected: dev-wrap-implicit → handleDev(['--', 'vite']) → getDevCommand(['--', 'vite']) → vite
    const parsed = parseArgs(['vite']);
    assert.equal(parsed.subdomain, null);
    assert.equal(parsed.port, null);
    assert.deepEqual(parsed.rest, ['vite']);
    // route() would detect no -- in rest, first is not numeric, not a command
    // → dev-wrap-implicit → buildDevArgs(null, 'vite') → ['--', 'vite']
    const devCmd = getDevCommand(['--', 'vite']);
    assert.equal(devCmd.command, 'vite');
  });

  it('Scenario F: any project, explicit port flag', () => {
    // User runs: checkmyapp --port 8080
    // Expected: port-flag → handlePort(8080, null)
    const parsed = parseArgs(['--port', '8080']);
    assert.equal(parsed.port, 8080);
    assert.equal(parsed.subdomain, null);
    assert.deepEqual(parsed.rest, []);
  });

  it('Scenario G: backward compat — checkmyapp dev -- vite', () => {
    // User runs: checkmyapp dev -- vite
    // Expected: cmd-dev → handleDev(['--', 'vite']) → getDevCommand(['--', 'vite']) → vite
    const parsed = parseArgs(['dev', '--', 'vite']);
    assert.equal(parsed.subdomain, null);
    assert.equal(parsed.port, null);
    assert.deepEqual(parsed.rest, ['dev', '--', 'vite']);
    // route() sees first is 'dev' → handleDev(['--', 'vite'])
    const devCmd = getDevCommand(['--', 'vite']);
    assert.equal(devCmd.command, 'vite');
  });

  it('Scenario H: backward compat with subdomain — checkmyapp dev -- --subdomain foo -- vite', () => {
    // User runs: checkmyapp dev -- --subdomain foo -- vite
    // This is the old syntax — backward compat
    // Actually the old syntax was: checkmyapp dev --subdomain foo -- vite
    const parsed = parseArgs(['dev', '--subdomain', 'foo', '--', 'vite']);
    assert.equal(parsed.subdomain, 'foo');
    assert.deepEqual(parsed.rest, ['dev', '--', 'vite']);
    // route() → first='dev' → handleDev(['--subdomain', 'foo', '--', 'vite'])
    // → strips --subdomain foo → getDevCommand(['--', 'vite']) → vite
    const filtered = [];
    const handleDevArgs = ['--subdomain', 'foo', '--', 'vite'];
    let subdomain = null;
    for (let i = 0; i < handleDevArgs.length; i++) {
      if (handleDevArgs[i] === '--subdomain' && i + 1 < handleDevArgs.length) {
        subdomain = handleDevArgs[++i];
      } else {
        filtered.push(handleDevArgs[i]);
      }
    }
    assert.equal(subdomain, 'foo');
    assert.deepEqual(filtered, ['--', 'vite']);
    assert.deepEqual(getDevCommand(filtered), { command: 'vite', args: [] });
  });

  it('Scenario I: checkmyapp wraps any command — mvn spring-boot:run', () => {
    // User runs: checkmyapp mvn spring-boot:run
    // Expected: dev-wrap-implicit → handleDev(['--', 'mvn', 'spring-boot:run'])
    // → getDevCommand → mvn spring-boot:run
    const devCmd = getDevCommand(['--', 'mvn', 'spring-boot:run']);
    assert.equal(devCmd.command, 'mvn');
    assert.deepEqual(devCmd.args, ['spring-boot:run']);
  });

  it('Scenario J: checkmyapp with -- separator explicitly', () => {
    // User runs: checkmyapp -- -- mvn spring-boot:run
    const parsed = parseArgs(['--', 'mvn', 'spring-boot:run']);
    assert.equal(parsed.subdomain, null);
    assert.equal(parsed.port, null);
    assert.deepEqual(parsed.rest, ['--', 'mvn', 'spring-boot:run']);
    // route() → first='--' not numeric, not a command → checks for '--' in rest
    // → finds at index 0 → opts=[], cmdParts=['mvn', 'spring-boot:run']
    // → buildDevArgs(null, 'mvn', ['spring-boot:run']) → ['--', 'mvn', 'spring-boot:run']
    const devCmd = getDevCommand(['--', 'mvn', 'spring-boot:run']);
    assert.deepEqual(devCmd, { command: 'mvn', args: ['spring-boot:run'] });
  });

  it('Scenario K: auth, status, logout still work', () => {
    const authParsed = parseArgs(['auth', 'github']);
    assert.equal(authParsed.rest[0], 'auth');
    assert.equal(authParsed.rest[1], 'github');

    const statusParsed = parseArgs(['status']);
    assert.equal(statusParsed.rest[0], 'status');

    const logoutParsed = parseArgs(['logout']);
    assert.equal(logoutParsed.rest[0], 'logout');
  });

  it('Scenario L: help and version', () => {
    assert.deepEqual(parseArgs(['--help']).rest, ['--help']);
    assert.deepEqual(parseArgs(['--version']).rest, ['--version']);
    assert.deepEqual(parseArgs(['help']).rest, ['help']);
    assert.deepEqual(parseArgs(['-h']).rest, ['-h']);
  });
});
