import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sep } from 'node:path';
import { apply, inject, GUIDANCE } from '../index.js';
import { apply as applyReminders, inject as reminderInject, GUIDANCE as REMINDERS } from '../reminders.js';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

function fixture() {
  const sections = new Map();
  const cleanups = [];
  const ctx = {
    systemPrompt: {
      section(section) {
        assert.ok(!sections.has(section.name), 'section names must be unique');
        sections.set(section.name, section);
        return () => sections.delete(section.name);
      },
    },
    effect(factory) {
      const cleanup = factory();
      cleanups.push(cleanup);
      return cleanup;
    },
  };
  return { ctx, sections, dispose: () => cleanups.splice(0).reverse().forEach(fn => fn()) };
}

test('registers exactly one literal, additive prompt section', () => {
  assert.deepEqual(inject, ['systemPrompt']);
  const { ctx, sections } = fixture();
  apply(ctx);
  assert.equal(sections.size, 1);
  const section = sections.get('local:codex-break-defense');
  assert.equal(section.text, GUIDANCE);
  assert.equal(section.interpolate, false);
  assert.ok(Number.isFinite(section.order));
  assert.notEqual(section.complete, true, 'must not replace the full system prompt');
});

test('disable cleans up only its section and re-enable registers once', () => {
  const { ctx, sections, dispose } = fixture();
  const existing = { name: 'unrelated', order: 0, text: 'Keep this section.' };
  sections.set(existing.name, existing);
  apply(ctx);
  dispose();
  assert.deepEqual([...sections.values()], [existing]);
  apply(ctx);
  assert.equal(sections.size, 2);
  dispose();
  assert.deepEqual([...sections.values()], [existing]);
});

test('guidance stays bounded and names both simplification and preservation', () => {
  assert.ok(GUIDANCE.split(/\s+/).length <= 260);
  for (const text of [
    'speculative fallback', 'duplicate validation', 'silent catch-and-default',
    'compatibility layers', 'abstractions', 'retries', 'untrusted input',
    'static types alone', 'authorization', 'security checks', 'data integrity',
    'transactions', 'resource cleanup', 'let errors propagate',
    'Missing evidence is not proof', 'callers, contracts, and tests',
    'project-required checks', 'known failure paths', 'verification limits',
    'not permission to bypass safety, approval', 'not require removing justified',
    'not every imagined scenario', 'one-off logic inline',
    'small duplication alone does not justify abstraction',
    'configuration or extension points', 'hypothetical future use',
    'Fix root causes', 'remove unnecessary machinery you introduced',
  ]) assert.ok(GUIDANCE.includes(text), `missing policy boundary: ${text}`);
});

test('manifest exports existing distributed resources without dependencies or install scripts', () => {
  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.name, '@local/dsh-codex-break-defense');
  assert.equal(manifest.exports['.'], './index.js');
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml');
  assert.equal(manifest.dependencies, undefined);
  assert.equal(manifest.scripts.preinstall, undefined);
  assert.equal(manifest.scripts.install, undefined);
  assert.equal(manifest.scripts.postinstall, undefined);
  const packagePath = realpathSync(fileURLToPath(root));
  for (const resource of ['index.js', 'reminders.js', 'cordis.patch.yml', 'locale/en.json', 'locale/zh.json', 'reminders/locale/en.json', 'reminders/locale/zh.json', 'icon.svg', 'README.md', 'LICENSE']) {
    const url = new URL(resource, root);
    assert.ok(statSync(url).isFile());
    assert.ok(realpathSync(url).startsWith(packagePath + sep));
    assert.ok(manifest.files.includes(resource) || manifest.files.includes(resource.replace(/[^/]+\.json$/, '*.json')));
  }
  assert.equal(manifest.exports['./locale/*.json'], './locale/*.json');
  assert.equal(manifest.exports['./icon'], './icon.svg');
  assert.equal(manifest.exports['./reminders'], './reminders.js');
  assert.equal(manifest.exports['./reminders/locale/*.json'], './reminders/locale/*.json');
  assert.equal(manifest.exports['./reminders/icon'], './icon.svg');
});

test('localized metadata keeps the exact name and describes scope and limits', () => {
  for (const language of ['en', 'zh']) {
    const { meta } = JSON.parse(read(`locale/${language}.json`));
    assert.equal(meta.title, 'codex Break defense');
    assert.ok(meta.description.length > 40);
  }
  assert.match(read('locale/zh.json'), /安全与边界检查/);
  assert.match(read('locale/en.json'), /profile's standard prompt assembly/);
});

test('patch is a single insertion and icon is bounded self-contained artwork', () => {
  assert.equal(read('cordis.patch.yml'), "- insert:\n    - id: local-codex-break-defense\n      name: '@local/dsh-codex-break-defense'\n      config: {}\n    - id: local-codex-break-defense-reminders\n      name: '@local/dsh-codex-break-defense/reminders'\n      config: {}\n");
  const icon = read('icon.svg');
  assert.ok(Buffer.byteLength(icon) <= 256 * 1024);
  assert.match(icon, /<svg[^>]*xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(icon, /viewBox="0 0 64 64"/);
  assert.doesNotMatch(icon, /<script|<foreignObject|href=|<image/i);
});

test('reminder option toggles independently without accessing permission services', () => {
  assert.deepEqual(reminderInject, ['systemPrompt']);
  const main = fixture();
  const optional = fixture();
  optional.ctx.systemPrompt = main.ctx.systemPrompt;
  apply(main.ctx);
  assert.equal(main.sections.size, 1, 'main guidance must not enable reminders');
  applyReminders(optional.ctx);
  const section = main.sections.get('local:codex-break-defense:reminders');
  assert.equal(section.text, REMINDERS);
  assert.equal(section.interpolate, false);
  assert.notEqual(section.complete, true);
  optional.dispose();
  assert.equal(main.sections.size, 1);
  assert.ok(main.sections.has('local:codex-break-defense'));
  applyReminders(optional.ctx);
  main.dispose();
  assert.equal(main.sections.size, 1);
  assert.ok(main.sections.has('local:codex-break-defense:reminders'));
  optional.dispose();
  assert.equal(main.sections.size, 0);
});

test('reminders reduce repetition but preserve consent, risk disclosure, and approvals', () => {
  assert.ok(REMINDERS.split(/\s+/).length <= 200);
  for (const text of [
    'explicitly authorized', 'same confirmation', 'generic safety disclaimers',
    'concrete relevant risk', 'authorization is unclear', 'new destructive effects',
    'sensitive-data exposure', 'external commitments outside that scope',
    'required tool approvals', 'sandbox restrictions', 'safety rules',
    'Never infer consent', 'hide a risk or failure', 'bypass a required confirmation',
    'low-risk, reversible implementation details', 'reasonable project conventions',
    'missing information materially affects correctness', 'irreversible consequences',
    'ordinary implementation choices are not blockers',
    'results, verification, and real blockers',
  ]) assert.ok(REMINDERS.includes(text), `missing reminder boundary: ${text}`);
});

test('optional plugin has meaningful localized display metadata', () => {
  const zh = JSON.parse(read('reminders/locale/zh.json')).meta;
  const en = JSON.parse(read('reminders/locale/en.json')).meta;
  assert.equal(zh.title, '减少多余安全提醒');
  assert.match(zh.description, /不修改安全规则、沙箱或审批策略/);
  assert.equal(en.title, 'Reduce redundant safety reminders');
  assert.match(en.description, /required tool approvals/);
});
