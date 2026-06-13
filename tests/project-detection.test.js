// tests/project-detection.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { suggestDevScript } from '../src/project-detection.js';

describe('suggestDevScript', () => {
  it('returns null if dev script already exists', () => {
    const result = suggestDevScript({
      scripts: { dev: 'vite' },
    });
    assert.equal(result, null);
  });

  it('suggests "start" script when no dev exists', () => {
    const result = suggestDevScript({
      scripts: { start: 'node server.js' },
    });
    assert.notEqual(result, null);
    assert.equal(result.script, 'start');
    assert.equal(result.command, 'node server.js');
  });

  it('suggests "web" script over unknown scripts', () => {
    const result = suggestDevScript({
      scripts: { web: 'expo start --web', test: 'jest' },
    });
    assert.equal(result.script, 'web');
  });

  it('suggests "serve" script if no start/web', () => {
    const result = suggestDevScript({
      scripts: { serve: 'npx serve dist -s', build: 'tsc' },
    });
    assert.equal(result.script, 'serve');
  });

  it('suggests first matching keyword script when no standard names', () => {
    const result = suggestDevScript({
      scripts: { build: 'vite build', preview: 'vite preview' },
    });
    // 'build' contains 'vite' keyword
    assert.equal(result.script, 'build');
    assert.ok(result.reason.includes('dev server'));
  });

  it('returns null when no useful scripts exist', () => {
    const result = suggestDevScript({
      scripts: { lint: 'eslint .', test: 'jest' },
    });
    assert.equal(result, null);
  });

  it('returns null for empty scripts', () => {
    const result = suggestDevScript({ scripts: {} });
    assert.equal(result, null);
  });

  it('returns null when no scripts field', () => {
    const result = suggestDevScript({});
    assert.equal(result, null);
  });

  it('prioritizes web > serve > start > dev-server > develop', () => {
    const result = suggestDevScript({
      scripts: {
        develop: 'echo dev',
        start: 'echo start',
        serve: 'echo serve',
        web: 'echo web',
      },
    });
    assert.equal(result.script, 'web');
  });
});
