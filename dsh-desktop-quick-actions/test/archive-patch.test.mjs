import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, lstat, readdir, link } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { buildPatchedArchive, verifyArchivePair } from '../archive-patch.mjs';

const require = createRequire(import.meta.url);
const asar = require('@electron/asar');
const { Pickle } = require('@electron/asar/lib/pickle.js');
const { getFileIntegrity } = require('@electron/asar/lib/integrity.js');
const digest = buffer => createHash('sha256').update(buffer).digest('hex');
function unpack(bytes) {
  const headerSize = bytes.readUInt32LE(4);
  return { header: JSON.parse(Pickle.createFromBuffer(bytes.subarray(8, 8 + headerSize)).createIterator().readString()), payload: bytes.subarray(8 + headerSize), headerSize };
}
function headerPrefix(header) {
  const h = Pickle.createEmpty(); h.writeString(JSON.stringify(header));
  const p = Pickle.createEmpty(); p.writeUInt32(h.toBuffer().length);
  return Buffer.concat([p.toBuffer(), h.toBuffer()]);
}
function repack(header, payload) { return Buffer.concat([headerPrefix(header), payload]); }
async function owned(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dsh-archive-patch-'));
  const absolute = path.resolve(directory);
  assert.equal(path.dirname(absolute), path.resolve(os.tmpdir()));
  assert.ok(path.basename(absolute).startsWith('dsh-archive-patch-'));
  t.after(async () => { asar.uncacheAll(); await rm(absolute, { recursive: true, force: true }); });
  return absolute;
}
async function fixture(t, options = {}) {
  const root = await owned(t), input = path.join(root, 'input');
  await mkdir(path.join(input, 'lib'), { recursive: true });
  await mkdir(path.join(input, 'native'));
  await writeFile(path.join(input, 'lib', 'main.js'), 'export const original = true;\n');
  await writeFile(path.join(input, 'package.json'), '{"name":"tiny-real-asar"}\n');
  await writeFile(path.join(input, 'native', 'addon.node'), Buffer.from([0, 255, 3, 7]));
  const source = path.join(root, 'source.asar');
  await asar.createPackageWithOptions(input, source, options);
  return { root, input, source, dest: path.join(root, 'staged.asar') };
}
async function modifiedSource(t, change) {
  const x = await fixture(t); const bytes = await readFile(x.source); const parsed = unpack(bytes);
  await change(parsed.header, parsed);
  const source = path.join(x.root, 'modified-source.asar');
  await writeFile(source, repack(parsed.header, parsed.payload), { flag: 'wx' });
  return { ...x, source };
}
const replace = Buffer.from('export const restart = "staged only";\n');

test('stages a real ASAR by appending only main; source is byte-identical', async t => {
  const x = await fixture(t), before = await readFile(x.source);
  const report = await buildPatchedArchive(x.source, x.dest, replace);
  assert.deepEqual(await readFile(x.source), before);
  assert.equal(report.replacementSHA256, digest(replace));
  assert.equal(report.replacementBytes, replace.length);
  assert.equal(report.sourcePath, x.source); assert.equal(report.destPath, x.dest);
  assert.deepEqual(asar.extractFile(x.dest, 'lib/main.js'), replace);
  assert.deepEqual(asar.extractFile(x.dest, 'package.json'), asar.extractFile(x.source, 'package.json'));
  const a = unpack(before), b = unpack(await readFile(x.dest));
  assert.equal(b.header.files.lib.files['main.js'].offset, String(a.payload.length));
  assert.deepEqual(b.payload.subarray(0, a.payload.length), a.payload);
  assert.deepEqual(b.payload.subarray(a.payload.length), replace);
  assert.equal((await verifyArchivePair(x.source, x.dest)).preservedPayloadBytes, a.payload.length);
});

test('preserves every other metadata field including links, unpacked, executable and unknown fields', async t => {
  const x = await fixture(t, { unpackDir: 'native' });
  const a = unpack(await readFile(x.source));
  a.header.custom = { flags: ['one', 2], empty: null };
  a.header.files.shortcut = { link: 'lib/main.js', unpacked: true, custom: 'keep-link' };
  a.header.files.lib.custom = ['directory-metadata'];
  a.header.files.lib.files['main.js'].executable = true;
  a.header.files.lib.files['main.js'].custom = { keep: 'main unrelated metadata' };
  a.header.files['package.json'].extra = { value: true };
  const source = path.join(x.root, 'metadata.asar'); await writeFile(source, repack(a.header, a.payload));
  const unpackedBefore = await readFile(path.join(x.source + '.unpacked', 'native', 'addon.node'));
  await buildPatchedArchive(source, x.dest, replace);
  const b = unpack(await readFile(x.dest));
  const expected = structuredClone(a.header);
  Object.assign(expected.files.lib.files['main.js'], {
    offset: b.header.files.lib.files['main.js'].offset,
    size: replace.length, integrity: b.header.files.lib.files['main.js'].integrity,
  });
  assert.deepEqual(b.header, expected);
  assert.deepEqual(await readFile(path.join(x.source + '.unpacked', 'native', 'addon.node')), unpackedBefore);
  await assert.rejects(lstat(x.dest + '.unpacked'), { code: 'ENOENT' });
  assert.equal((await verifyArchivePair(source, x.dest)).replacementSHA256, digest(replace));
});

test('retains all original payload bytes including old main and unreferenced trailer bytes', async t => {
  const x = await modifiedSource(t, (_header, parsed) => { parsed.payload = Buffer.concat([parsed.payload, Buffer.from('UNREFERENCED-TRAILER\0\xff')]); });
  const before = unpack(await readFile(x.source));
  await buildPatchedArchive(x.source, x.dest, Buffer.alloc(0));
  const after = unpack(await readFile(x.dest));
  assert.deepEqual(after.payload, before.payload);
  assert.deepEqual(after.header.files.lib.files['main.js'].integrity.blocks, [digest(Buffer.alloc(0))]);
});

test('allows safe large unpacked sizes without reading or rewriting sidecars', async t => {
  const x = await modifiedSource(t, h => { h.files.large = { size: 0x1_0000_0001, unpacked: true, custom: 'not-packed' }; });
  await buildPatchedArchive(x.source, x.dest, replace);
  assert.equal(unpack(await readFile(x.dest)).header.files.large.size, 0x1_0000_0001);
});

test('replacement SHA256 blocks exactly match pinned 3.4.1 including exact block boundary', async t => {
  const x = await fixture(t);
  for (const size of [0, 17, 4 * 1024 * 1024, 4 * 1024 * 1024 + 13]) {
    const replacement = Buffer.alloc(size, 0x5a), dest = path.join(x.root, `size-${size}.asar`);
    await buildPatchedArchive(x.source, dest, replacement);
    const actual = unpack(await readFile(dest)).header.files.lib.files['main.js'].integrity;
    assert.deepEqual(actual, await getFileIntegrity(Readable.from([replacement])));
    assert.equal((await verifyArchivePair(x.source, dest)).replacementBytes, size);
  }
});

test('refuses same paths and existing destination without touching either file', async t => {
  const x = await fixture(t), before = await readFile(x.source);
  await assert.rejects(buildPatchedArchive(x.source, x.source, replace), { code: 'UNSAFE_PATH' });
  await writeFile(x.dest, 'existing file');
  await assert.rejects(buildPatchedArchive(x.source, x.dest, replace), { code: 'DEST_EXISTS' });
  assert.equal(await readFile(x.dest, 'utf8'), 'existing file');
  assert.deepEqual(await readFile(x.source), before);
  await assert.rejects(verifyArchivePair(x.source, x.source), { code: 'UNSAFE_PATH' });
});

test('refuses hard-link destination aliases without touching source', async t => {
  const x = await fixture(t), before = await readFile(x.source);
  await link(x.source, x.dest);
  await assert.rejects(buildPatchedArchive(x.source, x.dest, replace), { code: 'DEST_EXISTS' });
  await assert.rejects(verifyArchivePair(x.source, x.dest), { code: 'UNSAFE_PATH' });
  assert.deepEqual(await readFile(x.source), before);
});

test('refuses filesystem source and destination symlinks', async t => {
  const x = await fixture(t), link = path.join(x.root, 'source-link.asar');
  try { await symlink(x.source, link, 'file'); }
  catch (error) { if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return t.skip('OS does not permit file symlinks'); throw error; }
  await assert.rejects(buildPatchedArchive(link, x.dest, replace), { code: 'UNSAFE_PATH' });
  const destinationLink = path.join(x.root, 'dest-link.asar'); await symlink(x.source, destinationLink, 'file');
  await assert.rejects(buildPatchedArchive(x.source, destinationLink, replace), { code: 'UNSAFE_PATH' });
  await assert.rejects(verifyArchivePair(x.source, destinationLink), { code: 'UNSAFE_PATH' });
});

test('refuses symlink/junction parent directories', async t => {
  const x = await fixture(t), actual = path.join(x.root, 'actual'), alias = path.join(x.root, 'alias');
  await mkdir(actual);
  try { await symlink(actual, alias, process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return t.skip('OS does not permit directory links'); throw error; }
  await assert.rejects(buildPatchedArchive(x.source, path.join(alias, 'result.asar'), replace), { code: 'UNSAFE_PATH' });
  assert.deepEqual(await readdir(actual), []);
});

for (const [name, mutate] of [
  ['missing main', h => { delete h.files.lib.files['main.js']; }],
  ['unpacked main', h => { h.files.lib.files['main.js'].unpacked = true; delete h.files.lib.files['main.js'].offset; }],
  ['linked main', h => { h.files.lib.files['main.js'] = { link: 'package.json' }; }],
  ['directory main', h => { h.files.lib.files['main.js'] = { files: {} }; }],
  ['unpacked lib parent', h => { h.files.lib.unpacked = true; }],
  ['negative offset', h => { h.files.lib.files['main.js'].offset = '-1'; }],
  ['unsafe integer offset', h => { h.files.lib.files['main.js'].offset = '9007199254740992'; }],
  ['out of bounds entry', h => { h.files['package.json'].size = 1000000; }],
  ['overlapping packed entries', h => { h.files['package.json'].offset = h.files.lib.files['main.js'].offset; }],
  ['unsafe archive name', h => { h.files['../outside'] = { link: 'package.json' }; }],
  ['escaping link', h => { h.files.link = { link: '../outside' }; }],
]) {
  test(`rejects malformed/unsafe header: ${name}`, async t => {
    const x = await modifiedSource(t, mutate);
    await assert.rejects(buildPatchedArchive(x.source, x.dest, replace));
    await assert.rejects(lstat(x.dest), { code: 'ENOENT' });
  });
}

for (const [name, mutate] of [
  ['wrong size Pickle marker', b => b.writeUInt32LE(8, 0)],
  ['oversized header', b => b.writeUInt32LE(0xffff_fffc, 4)],
  ['misaligned header', b => b.writeUInt32LE(9, 4)],
  ['wrong header payload size', b => b.writeUInt32LE(0, 8)],
  ['negative JSON length', b => b.writeInt32LE(-1, 12)],
  ['excessive JSON length', b => b.writeInt32LE(0x7fff_ffff, 12)],
]) {
  test(`rejects malformed prefix/header: ${name}`, async t => {
    const x = await fixture(t), bytes = await readFile(x.source); mutate(bytes);
    const malformed = path.join(x.root, 'bad.asar'); await writeFile(malformed, bytes);
    await assert.rejects(buildPatchedArchive(malformed, x.dest, replace));
    await assert.rejects(lstat(x.dest), { code: 'ENOENT' });
  });
}

test('rejects truncated archives, noncanonical duplicate keys, invalid UTF8 and Pickle padding', async t => {
  const x = await fixture(t), original = await readFile(x.source);
  for (const [i, bytes] of [original.subarray(0, 3), original.subarray(0, 12), original.subarray(0, original.length - 1)].entries()) {
    const name = path.join(x.root, `truncated-${i}.asar`); await writeFile(name, bytes);
    await assert.rejects(buildPatchedArchive(name, x.dest, replace));
  }
  for (const [i, json] of ['{"files":{},"files":{}}', '{"files": {},"x":1}'].entries()) {
    const h = Pickle.createEmpty(); h.writeString(json); const p = Pickle.createEmpty(); p.writeUInt32(h.toBuffer().length);
    const name = path.join(x.root, `bad-json-${i}.asar`); await writeFile(name, Buffer.concat([p.toBuffer(), h.toBuffer()]));
    await assert.rejects(buildPatchedArchive(name, x.dest, replace));
  }
  const utf8 = Buffer.from(original); utf8[16] = 255;
  const badUtf8 = path.join(x.root, 'bad-utf8.asar'); await writeFile(badUtf8, utf8);
  await assert.rejects(buildPatchedArchive(badUtf8, x.dest, replace));
  const padded = Pickle.createEmpty(); padded.writeString('0');
  const paddingBytes = padded.toBuffer(); paddingBytes[paddingBytes.length - 1] = 7;
  const p = Pickle.createEmpty(); p.writeUInt32(paddingBytes.length);
  const badPadding = path.join(x.root, 'bad-padding.asar'); await writeFile(badPadding, Buffer.concat([p.toBuffer(), paddingBytes]));
  await assert.rejects(buildPatchedArchive(badPadding, x.dest, replace));
});

test('verifier rejects changed unrelated header metadata, payload prefix, integrity and trailing bytes', async t => {
  const x = await fixture(t); await buildPatchedArchive(x.source, x.dest, replace);
  const good = await readFile(x.dest);
  const cases = [
    parsed => { parsed.header.files['package.json'].custom = 'tampered'; },
    parsed => { parsed.header.files = Object.fromEntries(Object.entries(parsed.header.files).reverse()); },
    parsed => { parsed.payload[0] ^= 1; },
    parsed => { parsed.payload[parsed.payload.length - 1] ^= 1; },
    parsed => { parsed.header.files.lib.files['main.js'].integrity.hash = '0'.repeat(64); },
    parsed => { parsed.payload = Buffer.concat([parsed.payload, Buffer.from('extra')]); },
    parsed => { parsed.header.files.lib.files['main.js'].offset = '0'; },
  ];
  for (const [i, mutate] of cases.entries()) {
    const parsed = unpack(Buffer.from(good)); mutate(parsed);
    const bad = path.join(x.root, `tampered-${i}.asar`); await writeFile(bad, repack(parsed.header, parsed.payload));
    await assert.rejects(verifyArchivePair(x.source, bad));
  }
});

test('rejects non-Buffer replacement and never creates a destination', async t => {
  const x = await fixture(t);
  await assert.rejects(buildPatchedArchive(x.source, x.dest, 'text'), { code: 'INVALID_REPLACEMENT' });
  await assert.rejects(lstat(x.dest), { code: 'ENOENT' });
});

test('concurrent staging to one destination has exactly one winner', async t => {
  const x = await fixture(t);
  const results = await Promise.allSettled([buildPatchedArchive(x.source, x.dest, replace), buildPatchedArchive(x.source, x.dest, replace)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected').length, 1);
  await verifyArchivePair(x.source, x.dest);
});
