// tests/port-detection.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectPortFromOutput } from '../src/port-detection.js';

describe('detectPortFromOutput', () => {
  // --- Vite patterns ---
  it('detects Vite localhost port', () => {
    const result = detectPortFromOutput('Local: http://localhost:5173/');
    assert.equal(result, 5173);
  });

  it('detects Vite network URL with 127.0.0.1', () => {
    const result = detectPortFromOutput('Network: http://127.0.0.1:5173/');
    assert.equal(result, 5173);
  });

  it('detects Vite port with https', () => {
    const result = detectPortFromOutput('Local: https://localhost:5174/');
    assert.equal(result, 5174);
  });

  it('detects Vite dev server startup line', () => {
    const result = detectPortFromOutput('VITE v6.0.0  ready in 350ms');
    assert.equal(result, null); // no port in this line
  });

  it('detects Vite on port 3001', () => {
    const result = detectPortFromOutput('➜  Local:   http://localhost:3001/');
    assert.equal(result, 3001);
  });

  it('detects Vite port from network line', () => {
    const result = detectPortFromOutput('➜  Network: http://192.168.1.5:5173/');
    assert.equal(result, null); // not localhost/127.0.0.1 — but let's check: pattern /https?:\/\/localhost:(\d+)/i won't match
    // Actually this should match the "port" pattern... let me check.
    // "http://192.168.1.5:5173/" — does not match localhost, does not match 127.0.0.1
    // "port\s+(\d+)" — no "port" word
    // "listening on\s+(\d+)" — no
    // "started on\s+(\d+)" — no
    // "server running at.*:(\d+)" — no
    // So null is correct
  });

  // --- Next.js patterns ---
  it('detects Next.js startup port', () => {
    const result = detectPortFromOutput('▲ Next.js 14.0.0');
    assert.equal(result, null);
  });

  it('detects Next.js ready on localhost', () => {
    const result = detectPortFromOutput('- Local:        http://localhost:3000');
    assert.equal(result, 3000);
  });

  it('detects Next.js port via port pattern', () => {
    const result = detectPortFromOutput('> port 4000');
    assert.equal(result, 4000);
  });

  // --- Express patterns ---
  it('detects Express listening on port', () => {
    const result = detectPortFromOutput('Server listening on port 8080');
    assert.equal(result, 8080);
  });

  it('detects Express started on port', () => {
    const result = detectPortFromOutput('Server started on port 3001');
    assert.equal(result, 3001);
  });

  it('detects Express running at URL', () => {
    const result = detectPortFromOutput('Server running at http://localhost:9000');
    assert.equal(result, 9000);
  });

  it('detects Express on custom URL', () => {
    const result = detectPortFromOutput('app listening at http://127.0.0.1:4000');
    assert.equal(result, 4000);
  });

  // --- Generic / Other patterns ---
  it('detects generic port via "port N" pattern', () => {
    const result = detectPortFromOutput('port 4321');
    assert.equal(result, 4321);
  });

  it('detects generic port via "listening on N" pattern', () => {
    const result = detectPortFromOutput('listening on 9999');
    assert.equal(result, 9999);
  });

  it('detects generic port via "started on N" pattern', () => {
    const result = detectPortFromOutput('started on 5432');
    assert.equal(result, 5432);
  });

  it('detects "server running at" with full URL', () => {
    const result = detectPortFromOutput('server running at http://0.0.0.0:1234');
    assert.equal(result, 1234);
  });

  // --- Edge cases ---
  it('returns null for empty string', () => {
    assert.equal(detectPortFromOutput(''), null);
  });

  it('returns null for null/undefined input', () => {
    assert.equal(detectPortFromOutput(null), null);
    assert.equal(detectPortFromOutput(undefined), null);
  });

  it('returns null when no port pattern matches', () => {
    const result = detectPortFromOutput('Building... (compiled successfully)');
    assert.equal(result, null);
  });

  it('returns null for lines with invalid ports (zero)', () => {
    const result = detectPortFromOutput('http://localhost:0/');
    assert.equal(result, null);
  });

  it('returns null for lines with invalid ports (out of range)', () => {
    const result = detectPortFromOutput('http://localhost:70000/');
    assert.equal(result, null);
  });

  it('handles multiple candidate ports — picks first pattern match', () => {
    // Line contains both a localhost URL and another number
    const result = detectPortFromOutput('Local: http://localhost:5173/ Network: http://127.0.0.1:5174/');
    assert.equal(result, 5173);
  });

  it('detects port from Vite output with arrows', () => {
    const result = detectPortFromOutput('  ➜  Local:   http://localhost:5173/');
    assert.equal(result, 5173);
  });

  it('detects port from CRA (Create React App)', () => {
    const result = detectPortFromOutput('You can now view your app in the browser.');
    assert.equal(result, null); // no port info
  });

  it('detects port from webpack dev server', () => {
    const result = detectPortFromOutput('｢wds｣: Project is running at http://localhost:8080/');
    assert.equal(result, 8080);
  });

  it('detects port from Astro', () => {
    const result = detectPortFromOutput('  Server ready in 123ms');
    assert.equal(result, null); // no port
  });

  it('detects port from Astro with URL', () => {
    const result = detectPortFromOutput('  http://localhost:4321/');
    assert.equal(result, 4321);
  });

  it('detects port from SvelteKit', () => {
    const result = detectPortFromOutput('  Local: http://localhost:5173');
    assert.equal(result, 5173);
  });

  it('handles multiple lines (simulated single call)', () => {
    // This simulates a chunk containing multiple lines
    const result = detectPortFromOutput('Something before\nLocal: http://localhost:3000\nSomething after');
    // The regex still finds the URL even with newlines in the chunk
    assert.equal(result, 3000);
  });
});
