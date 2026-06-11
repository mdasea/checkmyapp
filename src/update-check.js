/**
 * Check for newer versions of checkmyapp on the npm registry.
 * Non-blocking — fire-and-forget with local cache.
 */
import https from 'node:https';
import { get, set } from './config.js';

const CACHE_KEY = 'lastVersionCheck';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const NPM_REGISTRY = 'https://registry.npmjs.org/checkmyapp/latest';

/**
 * Fetch the latest version from npm registry.
 * @returns {Promise<string|null>}
 */
function fetchLatestVersion() {
  return new Promise((resolve) => {
    const req = https.get(NPM_REGISTRY, { timeout: 5000 }, (res) => {
      if (res.statusCode !== 200) {
        resolve(null);
        return;
      }
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve(data.version || null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

/**
 * Compare two semver strings. Returns 1 if a > b, -1 if a < b, 0 if equal.
 */
function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

/**
 * Check if a newer version exists. Uses cached result for up to 24h.
 * Prints a warning to stderr if outdated.
 * @param {string} currentVersion - The installed package version
 */
export async function checkForUpdate(currentVersion) {
  // Check cache first
  const cached = get(CACHE_KEY);
  if (cached) {
    const { latest, checkedAt } = cached;
    if (Date.now() - checkedAt < CACHE_TTL_MS) {
      if (latest && compareVersions(latest, currentVersion) > 0) {
        console.warn(`\n⚠️  Update available: ${latest} (you have ${currentVersion})`);
        console.warn(`   Run: npm update checkmyapp\n`);
      }
      return;
    }
  }

  // Fetch from registry
  try {
    const latest = await fetchLatestVersion();
    if (latest) {
      // Cache the result
      set(CACHE_KEY, { latest, checkedAt: Date.now() });
      if (compareVersions(latest, currentVersion) > 0) {
        console.warn(`\n⚠️  Update available: ${latest} (you have ${currentVersion})`);
        console.warn(`   Run: npm update checkmyapp\n`);
      }
    }
  } catch {
    // Silently fail — don't block the CLI
  }
}
