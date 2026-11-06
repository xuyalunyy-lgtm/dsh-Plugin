#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { isUtf8 } from 'node:buffer';

const root = path.dirname(fileURLToPath(import.meta.url));
const expectedOrigin = 'git@github.com:xuyalunyy-lgtm/dsh-Plugin.git';
const gitBin = process.env.GIT || (process.platform === 'win32' ? 'C:\\Program Files\\Git\\cmd\\git.exe' : 'git');
const git = (cwd, ...args) => execFileSync(gitBin, ['-C', cwd, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, windowsHide: true });
const fail = message => { throw new Error(message); };
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const safeFile = value => typeof value === 'string' && value.length > 0 && !value.includes('\\') && !/[\x00-\x1f:]/.test(value) && value.split('/').every(part => part && part !== '.' && part !== '..');
const omittedDirs = new Set(['.git', 'node_modules', '.pnpm-store', 'staging', 'baseline', '.cache', 'cache', '__pycache__', 'coverage', 'screenshots', 'artifacts', 'releases', 'release', 'logs', 'backup', 'backups', 'migration-backups', '.publish-audit', '.vscode', '.idea']);
function sensitive(file) {
  return file.split('/').some(part => /^(?:private|auth|credentials|\.dsh|\.codex|\.ssh|\.env(?:\..*)?|settings\.local\..*|config\.local\..*|id_rsa[^/]*|id_ed25519[^/]*)$/i.test(part)) || /\.(?:pem|key|pfx|p12)$/i.test(file) || /(?:^|\/)(?:auth|credentials)\.json$/i.test(file);
}
const archive = file => /\.(?:asar|zip|tgz|tar|gz|7z|bak|log|db|sqlite|sqlite3|tmp|temp)$/i.test(file) || /(?:^|\/)(?:\.DS_Store|Thumbs\.db|desktop\.ini)$/i.test(file);
function validate(spec) {
  if (spec.version !== 1 || spec.origin !== expectedOrigin || !Array.isArray(spec.plugins)) fail('Invalid manifest version, origin or plugin list');
  const ids = new Set();
  for (const item of spec.plugins) {
    if (!/^dsh-[a-z0-9-]+$/.test(item.id) || ids.has(item.id)) fail('Invalid or duplicate plugin id');
    ids.add(item.id);
    if (!['git', 'files', 'in-place'].includes(item.sourceType)) fail(`${item.id}: invalid sourceType`);
    if (item.source !== (item.sourceType === 'in-place' ? item.id : `../${item.id}`)) fail(`${item.id}: source must identify its exact maintenance directory`);
    for (const key of ['exclude', 'files']) {
      if (!Array.isArray(item[key]) || item[key].some(file => !safeFile(file)) || new Set(item[key]).size !== item[key].length) fail(`${item.id}: invalid ${key}`);
    }
    if ((item.sourceType === 'files') !== (item.files.length > 0)) fail(`${item.id}: files are required only in files mode`);
    for (const file of [...item.files, ...item.exclude]) if (sensitive(file)) fail(`${item.id}: sensitive manifest path refused`);
  }
}
async function noLinks(target) {
  const parsed = path.parse(target); let current = parsed.root;
  for (const part of target.slice(parsed.root.length).split(path.sep)) {
    if (!part) continue;
    current = path.join(current, part);
    let stat;
    try { stat = await fs.lstat(current); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
    if (stat.isSymbolicLink()) fail(`Symbolic link/junction refused: ${current}`);
  }
}
async function directory(target) {
  await noLinks(target);
  if (!(await fs.stat(target)).isDirectory()) fail(`Not a directory: ${target}`);
}
async function repo(target) {
  await directory(target);
  if (!samePath(path.resolve(git(target, 'rev-parse', '--show-toplevel').trim()), target)) fail(`Repository root mismatch: ${target}`);
}
async function readAt(base, file, optional = false) {
  const target = path.join(base, ...file.split('/'));
  await noLinks(target);
  let stat;
  try { stat = await fs.lstat(target); } catch (error) { if (optional && error.code === 'ENOENT') return null; throw error; }
  if (!stat.isFile()) fail(`Not a regular file: ${target}`);
  return fs.readFile(target);
}
function equal(a, b) {
  if (a === null || b === null) return a === b;
  if (a.equals(b)) return true;
  return isUtf8(a) && isUtf8(b) && a.toString('utf8').replaceAll('\r\n', '\n') === b.toString('utf8').replaceAll('\r\n', '\n');
}
async function version(base) {
  const data = await readAt(base, 'package.json', true);
  return data === null ? 'n/a' : JSON.parse(data.toString('utf8')).version ?? 'n/a';
}
const dirty = (base, id) => git(base, 'status', '--porcelain=v1', '-z', '--untracked-files=all', ...(id ? ['--', id] : []));
async function inspect(item) {
  const source = path.resolve(root, item.source), destination = path.join(root, item.id);
  await directory(source); await directory(destination);
  const result = { item, source, destination, additions: [], changes: [], extra: [], excluded: [], content: new Map(), head: 'n/a', sourceDirty: null, destinationDirty: dirty(root, item.id) };
  const indexed = new Set(git(root, 'ls-files', '-z', '--cached', '--', item.id).split('\0').filter(Boolean));
  let files;
  if (item.sourceType === 'git') {
    await repo(source);
    result.head = git(source, 'rev-parse', 'HEAD').trim();
    result.sourceDirty = dirty(source);
    files = git(source, 'ls-files', '-z', '--cached').split('\0').filter(Boolean);
  } else files = item.sourceType === 'files' ? item.files : git(root, 'ls-files', '-z', '--cached', '--', item.id).split('\0').filter(Boolean).map(file => file.slice(item.id.length + 1));
  for (const file of files) {
    if (!safeFile(file)) fail(`${item.id}: unsafe tracked path`);
    if (sensitive(file)) fail(`${item.id}: sensitive tracked path refused: ${file}`);
    if (item.exclude.some(excluded => file === excluded || file.startsWith(`${excluded}/`)) || file.split('/').some(part => omittedDirs.has(part.toLowerCase())) || archive(file)) {
      result.excluded.push(file); continue;
    }
    const bytes = await readAt(source, file);
    result.content.set(file, bytes);
    if (item.sourceType === 'in-place') continue;
    const existing = await readAt(destination, file, true);
    if (existing !== null && !indexed.has(`${item.id}/${file}`)) fail(`${item.id}: existing destination is not a tracked publication file: ${file}`);
    if (existing === null) result.additions.push(file);
    else if (!equal(bytes, existing)) result.changes.push(file);
  }
  if (item.sourceType !== 'in-place') result.extra = git(root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', item.id).split('\0').filter(Boolean).map(file => file.slice(item.id.length + 1)).filter(file => !result.content.has(file));
  result.version = await version(source);
  return result;
}
function show(result) {
  const { item } = result;
  console.log(`\n[${item.id}] ${item.sourceType} version=${result.version} HEAD=${result.head}`);
  console.log(`  source dirty=${result.sourceDirty === null ? 'n/a' : !!result.sourceDirty}; destination dirty=${!!result.destinationDirty}`);
  if (item.sourceType === 'in-place') console.log('  maintenance source is the collection directory; no sync');
  for (const [label, files] of [['add', result.additions], ['changed', result.changes], ['destination-extra (report only)', result.extra], ['excluded', result.excluded]]) {
    console.log(`  ${label}: ${files.length}`);
    for (const file of files) console.log(`    ${file}`);
  }
}
async function main() {
  const args = process.argv.slice(2); let action = 'check'; const selected = [];
  if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: node manage.mjs [check|sync] [--plugin id[,id]]...\nDefault: read-only check of all plugins. sync requires explicit plugins; it never deletes, installs, commits or pushes.');
    return;
  }
  if (args[0] && !args[0].startsWith('--')) action = args.shift();
  if (!['check', 'sync'].includes(action)) fail('Usage: node manage.mjs [check|sync] [--plugin id[,id]]...');
  while (args.length) {
    if (args.shift() !== '--plugin' || !args[0] || args[0].startsWith('--')) fail('Expected --plugin id[,id]');
    selected.push(...args.shift().split(','));
  }
  if (action === 'sync' && selected.length === 0) fail('sync requires an explicit --plugin selection');
  const spec = JSON.parse(await fs.readFile(path.join(root, 'plugins.json'), 'utf8')); validate(spec);
  for (const id of selected) if (!spec.plugins.some(item => item.id === id)) fail(`Unknown plugin: ${id}`);
  await repo(root);
  const origin = git(root, 'remote', 'get-url', 'origin').trim();
  if (origin !== expectedOrigin) fail('Collection origin must be the manifest SSH destination');
  console.log(`Collection origin: ${origin}\nBranch: ${git(root, 'branch', '--show-current').trim() || '(detached)'}`);
  console.log(`Pending collection files:\n${git(root, 'status', '--short', '--untracked-files=all').trim() || '(clean)'}`);
  const results = [], errors = [];
  for (const item of spec.plugins.filter(item => selected.length === 0 || selected.includes(item.id))) {
    try { const result = await inspect(item); results.push(result); show(result); }
    catch (error) { errors.push(`${item.id}: ${error.message}`); }
  }
  if (errors.length) fail(errors.join('\n'));
  if (action === 'check') return;
  for (const result of results) {
    if (result.item.sourceType === 'in-place') fail(`${result.item.id}: in-place sources cannot be synced`);
    if (result.sourceDirty) fail(`${result.item.id}: source is dirty; commit source changes before sync`);
    if (result.destinationDirty) fail(`${result.item.id}: destination has local changes; sync refused`);
  }
  // Finish every path/content/dirty preflight before the first copy, including all selected plugins.
  for (const result of results) {
    if (result.item.sourceType === 'git' && (dirty(result.source) || git(result.source, 'rev-parse', 'HEAD').trim() !== result.head)) fail(`${result.item.id}: source changed during check`);
    if (dirty(root, result.item.id)) fail(`${result.item.id}: destination changed during check`);
    for (const file of [...result.additions, ...result.changes]) {
      if (!(await readAt(result.source, file)).equals(result.content.get(file))) fail(`${result.item.id}: source changed: ${file}`);
      await noLinks(path.join(result.destination, file));
    }
  }
  for (const result of results) for (const file of [...result.additions, ...result.changes]) {
    const target = path.join(result.destination, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, result.content.get(file));
    console.log(`copied ${result.item.id}/${file}`);
  }
  console.log('Sync complete; no deletion, install, commit or push was performed.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
