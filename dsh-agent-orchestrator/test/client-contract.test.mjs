import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

// Registration-only VM contract. It never renders React, reads a DOM, performs
// fetch, or proves that a real browser displayed the settings entry.
const source = await readFile(new URL('../client.js', import.meta.url), 'utf8');
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('client manifest publishes the settings module without coupling visibility to policy enabled', () => {
  assert.equal(manifest.exports['./client'], './client.js');
  assert.ok(manifest.files.includes('client.js'));
  assert.equal(manifest.dsh.client.platform, 'web');
  assert.equal(manifest.dsh.client.immediately, true);
  assert.ok(manifest.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-settings'));
});

test('client registration contract: disabled scheduler still registers settings and board without rendering or networking', () => {
  let loaded;
  const accesses = [];
  runInNewContext(source, {
    window: { __ModuleLoader__: { load(value) { loaded = value; } } },
    fetch() { throw new Error('registration must not fetch settings or plans'); },
    setTimeout() { throw new Error('registration must not start board polling'); },
    get document() { throw new Error('registration must not inspect the DOM'); },
  });
  assert.equal(loaded.id, '@local/dsh-agent-orchestrator');
  const descriptor = loaded.factory(name => {
    assert.equal(name, 'react');
    return { createElement() { throw new Error('registration must not render components'); } };
  });
  assert.ok(descriptor.inject.includes('slots'));
  const registrations = [];
  descriptor.apply({
    get config() { accesses.push('config'); return { enabled: false }; },
    slots: {
      inject(name, callback) { assert.equal(name, 'settings.section'); callback(); },
      register(metadata, Panel) { registrations.push({ metadata, Panel }); return () => {}; },
    },
  });
  assert.equal(accesses.length, 0, 'visibility does not read policy enabled');
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].metadata.name, 'settings.section');
  assert.equal(registrations[0].metadata.id, 'agent-orchestrator');
  assert.equal(registrations[0].metadata.label(), '主控调度');
  assert.equal(typeof registrations[0].Panel, 'function');
});
