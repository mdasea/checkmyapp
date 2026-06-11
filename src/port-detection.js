// checkmyapp — port detection module
import { spawn } from 'node:child_process';

/**
 * Port patterns to detect dev server port from stdout lines.
 * Ordered by specificity (most specific first).
 */
const PORT_PATTERNS = [
  /https?:\/\/localhost:(\d+)/i,
  /https?:\/\/127\.0\.0\.1:(\d+)/i,
  /port\s*:?\s*(\d+)/i,
  /listening on\s+(\d+)/i,
  /started on\s+(\d+)/i,
  /server running at.*:(\d+)/i,
];

/**
 * Try to detect a dev server port from a single line of stdout/stderr output.
 *
 * @param {string} line - A single line of output from the dev server
 * @returns {number|null} The detected port number, or null if no pattern matched
 *
 * @example
 * detectPortFromOutput('Local: http://localhost:5173/') // => 5173
 * detectPortFromOutput('> Ready on http://localhost:3000') // => 3000
 * detectPortFromOutput('Server listening on port 8080') // => 8080
 */
export function detectPortFromOutput(line) {
  if (!line || typeof line !== 'string') {
    return null;
  }

  for (const pattern of PORT_PATTERNS) {
    const match = line.match(pattern);
    if (match && match[1]) {
      const port = parseInt(match[1], 10);
      if (Number.isFinite(port) && port > 0 && port <= 65535) {
        return port;
      }
    }
  }

  return null;
}

/**
 * Spawn a dev server process and return it along with an async iterator
 * that yields detected ports from output lines.
 *
 * @param {string} command - The command to run (e.g. 'npm', 'node')
 * @param {string[]} [args=[]] - Arguments for the command
 * @returns {{ child: import('node:child_process').ChildProcess, portPromise: Promise<number>, kill: () => void }}
 *
 * The returned object contains:
 *   - child: the spawned ChildProcess
 *   - portPromise: a Promise that resolves with the first detected port number
 *   - kill: a function that kills the child process
 */
export function spawnDevServer(command, args = []) {
  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  let resolved = false;
  let resolvePort;
  let rejectPort;

  const portPromise = new Promise((resolve, reject) => {
    resolvePort = (port) => {
      resolved = true;
      resolve(port);
    };
    rejectPort = (err) => {
      resolved = true;
      reject(err);
    };
  });

  /**
   * Process a single line of output for port detection.
   * @param {string} chunk
   */
  function processOutput(chunk) {
    if (resolved) return;

    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        const port = detectPortFromOutput(trimmed);
        if (port !== null) {
          resolvePort(port);
          return;
        }
      }
    }
  }

  child.stdout.on('data', processOutput);
  child.stderr.on('data', processOutput);

  child.on('error', (err) => {
    if (!resolved) {
      rejectPort(err);
    }
  });

  child.on('exit', (code) => {
    if (!resolved) {
      rejectPort(new Error(`Dev server exited with code ${code} before port was detected`));
    }
  });

  return {
    child,
    portPromise,
    kill: () => {
      try {
        child.kill();
      } catch {
        // ignore if already dead
      }
    },
  };
}

export default {
  detectPortFromOutput,
  spawnDevServer,
};
