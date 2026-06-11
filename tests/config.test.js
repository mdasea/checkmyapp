// tests/config.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// We test the config module by injecting a custom config path via environment.
// The 'conf' package uses the XDG config directory which we can't easily override,
// so we test the core get/set/clear/delete operations.

describe('config module', () => {
  // Store the original environment
  const origEnv = { ...process.env };

  before(() => {
    // We'll just import and test the module functions directly
  });

  after(() => {
    // Restore environment
    process.env = origEnv;
  });

  it('exports expected functions', async () => {
    const config = await import('../src/config.js');
    assert.equal(typeof config.getConfig, 'function');
    assert.equal(typeof config.get, 'function');
    assert.equal(typeof config.set, 'function');
    assert.equal(typeof config.deleteKey, 'function');
    assert.equal(typeof config.clear, 'function');
    assert.equal(typeof config.getConfigPath, 'function');
  });

  it('get/set/delete values correctly', async () => {
    const config = await import('../src/config.js');

    // Set a value
    config.set('authToken', 'test-token-123');
    assert.equal(config.get('authToken'), 'test-token-123');

    // Set another value
    config.set('serverUrl', 'https://example.com');
    assert.equal(config.get('serverUrl'), 'https://example.com');

    // Delete a value
    config.deleteKey('authToken');
    assert.equal(config.get('authToken'), ''); // default is empty string

    // Clean up
    config.deleteKey('serverUrl');
  });

  it('clear resets all values to defaults', async () => {
    const config = await import('../src/config.js');

    config.set('authToken', 'something');
    config.set('lastSubdomain', 'my-app');

    assert.equal(config.get('authToken'), 'something');
    assert.equal(config.get('lastSubdomain'), 'my-app');

    config.clear();

    // After clear, values should return defaults
    assert.equal(config.get('authToken'), '');
    assert.equal(config.get('serverUrl'), 'https://api.checkmyapp.online');
    assert.equal(config.get('lastSubdomain'), '');
  });

  it('default serverUrl is https://api.checkmyapp.online', async () => {
    const config = await import('../src/config.js');
    assert.equal(config.get('serverUrl'), 'https://api.checkmyapp.online');
  });

  it('default authToken is empty string', async () => {
    const config = await import('../src/config.js');
    assert.equal(config.get('authToken'), '');
  });

  it('default lastSubdomain is empty string', async () => {
    const config = await import('../src/config.js');
    assert.equal(config.get('lastSubdomain'), '');
  });

  it('getConfig returns a Conf instance', async () => {
    const config = await import('../src/config.js');
    const conf = config.getConfig();
    assert.ok(conf);
    assert.equal(typeof conf.get, 'function');
    assert.equal(typeof conf.set, 'function');
    assert.equal(typeof conf.delete, 'function');
    assert.equal(typeof conf.clear, 'function');
    assert.equal(typeof conf.path, 'string');
  });

  it('getConfig is singleton (same instance)', async () => {
    const config = await import('../src/config.js');
    const a = config.getConfig();
    const b = config.getConfig();
    assert.equal(a, b);
  });

  it('getConfigPath returns a non-empty string', async () => {
    const config = await import('../src/config.js');
    const path = config.getConfigPath();
    assert.ok(typeof path === 'string');
    assert.ok(path.length > 0);
    assert.ok(path.includes('checkmyapp'));
  });
});
