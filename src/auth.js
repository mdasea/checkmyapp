// checkmyapp — client-side OAuth flow
import http from 'node:http';
import { get, set as configSet } from './config.js';

const CALLBACK_PORT = 9876;
const AUTH_TIMEOUT_MS = 120_000;

/**
 * @param {string} provider - e.g. 'github', 'google'
 * @returns {string}
 */
function buildAuthorizeUrl(provider) {
  const serverUrl = get('serverUrl') || 'https://checkmyapp.online';
  const redirectUri = `http://localhost:${CALLBACK_PORT}/callback`;
  return `${serverUrl}/auth/${provider}?redirect_uri=${encodeURIComponent(redirectUri)}`;
}

/**
 * Start a temporary HTTP server to receive the OAuth callback token,
 * then resolve with the extracted token.
 * @returns {Promise<string>}
 */
function startCallbackServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${CALLBACK_PORT}`);

      // OAuth callback — token in query or fragment
      if (url.pathname === '/callback' || url.pathname === '/callback/') {
        const token = url.searchParams.get('token') || url.searchParams.get('code') || '';
        if (token) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Authenticated ✓</title>
<style>
body{font-family:-apple-system,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f5f7fa;color:#333}
.card{text-align:center;background:#fff;padding:3rem 4rem;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.1)}
h1{font-size:2rem;margin:0 0 0.5rem}.check{color:#22c55e;font-size:3rem}
p{color:#666}.sub{font-size:0.85rem;color:#999;margin-top:1.5rem}
</style></head>
<body>
<div class="card">
<div class="check">✓</div>
<h1>Authenticated!</h1>
<p>You can close this tab and return to the terminal.</p>
<p class="sub">checkmyapp</p>
</div>
</body>
</html>`);
          server.close(() => resolve(token));
        } else {
          // Token missing in callback
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h1>Authentication failed</h1><p>No token received. Please try again.</p>');
          server.close(() => reject(new Error('No token received in callback')));
        }
        return;
      }

      // Health / fallback
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('checkmyapp auth callback server running');
    });

    server.listen(CALLBACK_PORT, '127.0.0.1', () => {
      // Ready
    });

    server.on('error', (err) => {
      reject(err);
    });

    // Timeout
    setTimeout(() => {
      server.close(() => {
        reject(new Error('Authentication timed out after 120 seconds'));
      });
    }, AUTH_TIMEOUT_MS);
  });
}

/**
 * Authenticate with the given OAuth provider.
 * Opens the browser to the server's OAuth URL, starts a local callback server,
 * and stores the received token.
 *
 * @param {string} provider - OAuth provider name (e.g. 'github')
 * @returns {Promise<string>} the auth token
 */
export async function authenticate(provider = 'github') {
  const authorizeUrl = buildAuthorizeUrl(provider);
  console.log(`🔐 Opening browser to authenticate via ${provider}...`);
  console.log(`   ${authorizeUrl}`);

  // Open browser — fail gracefully on headless servers
  try {
    const { default: open } = await import('open');
    await open(authorizeUrl);
  } catch (openErr) {
    console.log(`   ⚠️  Could not open browser automatically: ${openErr.message}`);
    console.log(`   Please visit this URL in your browser:\n   ${authorizeUrl}`);
  }

  console.log(`   Waiting for callback on http://localhost:${CALLBACK_PORT}/callback ...`);

  const token = await startCallbackServer();

  // Persist the token
  configSet('authToken', token);
  console.log('✅ Authentication successful! Token saved.');

  return token;
}

/**
 * Retrieve the stored auth token.
 * @returns {string} the token or empty string
 */
export function getToken() {
  return get('authToken') || '';
}

/**
 * Validate the stored token by making a lightweight request to the server.
 * @returns {Promise<boolean>} true if the token is valid
 */
export async function validateToken() {
  const token = getToken();
  if (!token) {
    return false;
  }

  const serverUrl = get('serverUrl') || 'https://checkmyapp.online';
  const validateUrl = `${serverUrl}/auth/validate`;

  try {
    const res = await fetch(validateUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default {
  authenticate,
  getToken,
  validateToken,
};
