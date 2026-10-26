import { constants } from 'node:fs';
import { lstat, open, realpath, unlink } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { isDeepStrictEqual } from 'node:util';

const require = createRequire(import.meta.url);
const asarPackage = require('@electron/asar/package.json');
if (asarPackage.version !== '3.4.1') throw new Error('archive-patch requires exactly @electron/asar 3.4.1');
const { Pickle } = require('@electron/asar/lib/pickle.js');
const HEADER_LIMIT = 64 * 1024 * 1024;
const BLOCK_SIZE = 4 * 1024 * 1024;
const CHUNK = 1024 * 1024;
const MAX_FILE = 0xffff_ffff;
const own = (value, key) => Object.hasOwn(value, key);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
function fail(message, code = 'INVALID_ARCHIVE') { throw Object.assign(new Error(message), { code }); }
function check(condition, message, code) { if (!condition) fail(message, code); }
function integer(value) { return Number.isSafeInteger(value) && value >= 0; }
function align4(value) { return value + (4 - value % 4) % 4; }
function sameFile(a, b) { return a.dev === b.dev && a.ino === b.ino; }
function unchanged(a, b) { return sameFile(a, b) && a.size === b.size && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs; }

// Refuse symlinks/junctions in every existing filesystem path component. Archive
// header links are NOT filesystem links and remain unchanged in the staged ASAR.
async function checkedPath(input, missingLeaf = false) {
  check(typeof input === 'string' && input.length > 0 && !input.includes('\0'), 'Expected a nonempty filesystem path', 'UNSAFE_PATH');
  const absolute = path.resolve(input);
  const root = path.parse(absolute).root;
  let current = root;
  const parts = absolute.slice(root.length).split(path.sep).filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    let info;
    try { info = await lstat(current, { bigint: true }); }
    catch (error) {
      if (error.code === 'ENOENT' && missingLeaf && i === parts.length - 1) return absolute;
      throw error;
    }
    check(!info.isSymbolicLink(), `Symlink/reparse path refused: ${current}`, 'UNSAFE_PATH');
    if (i < parts.length - 1) check(info.isDirectory(), `Parent is not a directory: ${current}`, 'UNSAFE_PATH');
    else if (missingLeaf) fail(`Destination already exists: ${absolute}`, 'DEST_EXISTS');
    else check(info.isFile(), `Archive is not a regular file: ${absolute}`, 'UNSAFE_PATH');
  }
  check(parts.length > 0, 'Archive cannot be a filesystem root', 'UNSAFE_PATH');
  return absolute;
}
async function readExact(handle, position, size) {
  check(integer(position) && integer(size) && Number.isSafeInteger(position + size), 'Unsafe read bounds');
  const result = Buffer.alloc(size);
  let done = 0;
  while (done < size) {
    const { bytesRead } = await handle.read(result, done, size - done, position + done);
    check(bytesRead > 0, 'Truncated archive');
    done += bytesRead;
  }
  return result;
}
async function writeExact(handle, bytes, position) {
  let done = 0;
  while (done < bytes.length) {
    const { bytesWritten } = await handle.write(bytes, done, bytes.length - done, position + done);
    check(bytesWritten > 0, 'Unable to write staged archive', 'WRITE_FAILED');
    done += bytesWritten;
  }
}
function serializeHeader(header) {
  const json = JSON.stringify(header);
  const headerPickle = Pickle.createEmpty();
  headerPickle.writeString(json);
  const bytes = headerPickle.toBuffer();
  check(bytes.length <= HEADER_LIMIT, 'ASAR header exceeds 64 MiB safety limit');
  const sizePickle = Pickle.createEmpty();
  sizePickle.writeUInt32(bytes.length);
  const prefix = sizePickle.toBuffer();
  check(prefix.length === 8, 'Unexpected pinned Pickle prefix format');
  return Buffer.concat([prefix, bytes]);
}
function validateHeader(header, payloadLength) {
  check(object(header) && object(header.files), 'ASAR root must contain a files object');
  const ranges = [];
  let entries = 0, main;
  function visit(node, parts, inheritedUnpacked, depth) {
    check(depth <= 256 && ++entries <= 1_000_000, 'ASAR tree exceeds safety limits');
    check(object(node), `Invalid entry ${parts.join('/')}`);
    if (own(node, 'unpacked')) check(typeof node.unpacked === 'boolean', 'Invalid unpacked flag');
    const unpacked = inheritedUnpacked || node.unpacked === true;
    if (own(node, 'files')) {
      check(object(node.files) && !own(node, 'link') && !own(node, 'size') && !own(node, 'offset'), 'Ambiguous directory metadata');
      for (const [name, child] of Object.entries(node.files)) {
        check(name.length > 0 && !['.', '..'].includes(name) && !/[\\/\0:]/.test(name), 'Unsafe ASAR entry name');
        visit(child, [...parts, name], unpacked, depth + 1);
      }
      return;
    }
    if (own(node, 'link')) {
      check(typeof node.link === 'string' && node.link.length > 0 && !own(node, 'size') && !own(node, 'offset'), 'Invalid link metadata');
      const link = node.link.replaceAll('\\', '/');
      check(!/^(?:\/|[a-zA-Z]:)/.test(link) && !link.includes('\0'), 'Unsafe ASAR link target');
      const normalized = path.posix.normalize(link);
      check(normalized !== '..' && !normalized.startsWith('../'), 'ASAR link escapes archive');
    } else {
      check(integer(node.size), 'Invalid ASAR file size');
      if (unpacked) check(!own(node, 'offset'), 'Unpacked entry must not contain a packed offset');
      else {
        check(node.size <= MAX_FILE, 'Packed file exceeds pinned ASAR size limit');
        check(typeof node.offset === 'string' && /^(?:0|[1-9][0-9]*)$/.test(node.offset), 'Invalid packed offset');
        const offset = Number(node.offset);
        check(integer(offset) && Number.isSafeInteger(offset + node.size) && offset + node.size <= payloadLength, 'Packed entry is out of bounds');
        if (node.size > 0) ranges.push([offset, offset + node.size]);
      }
    }
    if (parts.length === 2 && parts[0] === 'lib' && parts[1] === 'main.js') {
      check(!own(node, 'link') && !unpacked && typeof node.offset === 'string', 'lib/main.js must be a packed regular entry');
      main = node;
    }
  }
  visit(header, [], false, 0);
  check(main, 'Missing packed lib/main.js');
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (let i = 1; i < ranges.length; i++) check(ranges[i][0] >= ranges[i - 1][1], 'Overlapping packed entries');
  return { main, entries };
}
async function inspect(handle) {
  const stats = await handle.stat({ bigint: true });
  check(stats.isFile() && stats.size <= BigInt(Number.MAX_SAFE_INTEGER), 'Unsafe archive size');
  const size = Number(stats.size);
  check(size >= 16, 'ASAR prefix/header is truncated');
  const prefix = await readExact(handle, 0, 8);
  check(prefix.readUInt32LE(0) === 4, 'Invalid ASAR size Pickle payload');
  const headerSize = prefix.readUInt32LE(4);
  check(headerSize >= 8 && headerSize <= HEADER_LIMIT && headerSize % 4 === 0 && headerSize <= size - 8, 'Invalid ASAR header bounds');
  const bytes = await readExact(handle, 8, headerSize);
  check(bytes.readUInt32LE(0) === headerSize - 4, 'Invalid header Pickle payload size');
  const jsonLength = bytes.readInt32LE(4);
  check(jsonLength >= 2 && 8 + align4(jsonLength) === headerSize, 'Invalid ASAR JSON string bounds');
  check(bytes.subarray(8 + jsonLength).every(byte => byte === 0), 'Nonzero Pickle padding');
  const raw = bytes.subarray(8, 8 + jsonLength);
  const json = new TextDecoder('utf-8', { fatal: true }).decode(raw);
  let header;
  try { header = JSON.parse(json); } catch { fail('Invalid ASAR header JSON'); }
  // Pinned ASAR writes exactly JSON.stringify. Requiring a byte-exact roundtrip
  // also rejects duplicate keys that JSON.parse would otherwise silently drop.
  check(Buffer.from(JSON.stringify(header)).equals(raw), 'Noncanonical or duplicate-key ASAR header JSON');
  const dataOffset = 8 + headerSize;
  const payloadLength = size - dataOffset;
  const validated = validateHeader(header, payloadLength);
  return { header, ...validated, headerSize, dataOffset, payloadLength, size, stats };
}
async function assertPathStillNames(absolute, stats) {
  await checkedPath(absolute);
  const current = await lstat(absolute, { bigint: true });
  check(sameFile(stats, current), 'Archive pathname changed while operating', 'SOURCE_CHANGED');
}
async function openChecked(input) {
  const absolute = await checkedPath(input);
  const before = await lstat(absolute, { bigint: true });
  const handle = await open(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const actual = await handle.stat({ bigint: true });
    check(sameFile(before, actual), 'Archive path changed while opening', 'SOURCE_CHANGED');
    return { absolute, handle, info: await inspect(handle) };
  } catch (error) { await handle.close(); throw error; }
}
function hash(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function integrity(bytes) {
  const blocks = [];
  // Match pinned 3.4.1 integrity semantics: final block exists even when empty.
  for (let offset = 0; offset <= bytes.length; offset += BLOCK_SIZE) blocks.push(hash(bytes.subarray(offset, offset + BLOCK_SIZE)));
  return { algorithm: 'SHA256', hash: hash(bytes), blockSize: BLOCK_SIZE, blocks };
}
async function copyRegion(source, sourceOffset, dest, destOffset, length) {
  for (let done = 0; done < length; done += CHUNK) {
    const bytes = await readExact(source, sourceOffset + done, Math.min(CHUNK, length - done));
    await writeExact(dest, bytes, destOffset + done);
  }
}
async function verifyHandles(source, dest) {
  const a = await inspect(source), b = await inspect(dest);
  check(b.main.offset === String(a.payloadLength), 'Replacement was not appended at the original packed-data end', 'PAIR_MISMATCH');
  check(b.payloadLength === a.payloadLength + b.main.size, 'Destination has missing or unexpected appended bytes', 'PAIR_MISMATCH');
  const expected = structuredClone(a.header);
  Object.assign(expected.files.lib.files['main.js'], { offset: b.main.offset, size: b.main.size, integrity: b.main.integrity });
  check(isDeepStrictEqual(expected, b.header) && JSON.stringify(expected) === JSON.stringify(b.header), 'Header changed beyond lib/main.js offset/size/integrity', 'PAIR_MISMATCH');
  const prefixHash = createHash('sha256');
  for (let done = 0; done < a.payloadLength; done += CHUNK) {
    const count = Math.min(CHUNK, a.payloadLength - done);
    const original = await readExact(source, a.dataOffset + done, count);
    const staged = await readExact(dest, b.dataOffset + done, count);
    check(original.equals(staged), 'Original packed payload bytes changed', 'PAIR_MISMATCH');
    prefixHash.update(original);
  }
  const replacementHash = createHash('sha256'), blocks = [];
  for (let offset = 0; offset <= b.main.size; offset += BLOCK_SIZE) {
    const bytes = await readExact(dest, b.dataOffset + a.payloadLength + offset, Math.min(BLOCK_SIZE, b.main.size - offset));
    replacementHash.update(bytes); blocks.push(hash(bytes));
  }
  const calculated = { algorithm: 'SHA256', hash: replacementHash.digest('hex'), blockSize: BLOCK_SIZE, blocks };
  check(isDeepStrictEqual(calculated, b.main.integrity), 'Replacement SHA256 integrity does not match appended bytes', 'PAIR_MISMATCH');
  check(unchanged(a.stats, await source.stat({ bigint: true })) && unchanged(b.stats, await dest.stat({ bigint: true })), 'Archive changed during verification', 'SOURCE_CHANGED');
  return { sourceBytes: a.size, destBytes: b.size, sourceHeaderBytes: a.headerSize, destHeaderBytes: b.headerSize,
    preservedPayloadBytes: a.payloadLength, preservedPayloadSHA256: prefixHash.digest('hex'), replacementBytes: b.main.size,
    replacementSHA256: calculated.hash, entries: a.entries };
}

/** Stage a new ASAR; never rewrites, renames or deploys the source installation. */
export async function buildPatchedArchive(sourcePath, destPath, replacementBuffer) {
  check(Buffer.isBuffer(replacementBuffer) && replacementBuffer.length <= MAX_FILE, 'Replacement must be a Buffer at most 4 GiB minus one byte', 'INVALID_REPLACEMENT');
  const replacement = Buffer.from(replacementBuffer);
  const sourceAbsolute = path.resolve(sourcePath), destAbsolute = path.resolve(destPath);
  check(!samePath(sourceAbsolute, destAbsolute), 'Source and destination must differ', 'UNSAFE_PATH');
  const source = await openChecked(sourcePath);
  let dest, createdStats;
  try {
    const destination = await checkedPath(destPath, true);
    const canonicalParent = await realpath(path.dirname(destination));
    check(!samePath(source.absolute, path.join(canonicalParent, path.basename(destination))), 'Destination aliases source', 'UNSAFE_PATH');
    const header = structuredClone(source.info.header);
    Object.assign(header.files.lib.files['main.js'], { offset: String(source.info.payloadLength), size: replacement.length, integrity: integrity(replacement) });
    const serialized = serializeHeader(header);
    check(Number.isSafeInteger(serialized.length + source.info.payloadLength + replacement.length), 'Unsafe staged archive size');
    dest = await open(destination, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | (constants.O_NOFOLLOW || 0), 0o600);
    createdStats = await dest.stat({ bigint: true });
    await assertPathStillNames(destination, createdStats);
    await writeExact(dest, serialized, 0);
    await copyRegion(source.handle, source.info.dataOffset, dest, serialized.length, source.info.payloadLength);
    await writeExact(dest, replacement, serialized.length + source.info.payloadLength);
    await dest.sync();
    check(unchanged(source.info.stats, await source.handle.stat({ bigint: true })), 'Source changed while staging', 'SOURCE_CHANGED');
    const report = await verifyHandles(source.handle, dest);
    await assertPathStillNames(source.absolute, source.info.stats);
    await assertPathStillNames(destination, createdStats);
    return { sourcePath: source.absolute, destPath: destination, ...report };
  } catch (error) {
    if (dest) {
      await dest.close().catch(() => {}); dest = undefined;
      // Delete only the exact new file owned by this call, never an existing or
      // substituted path. Both absolute destination and inode are checked first.
      const now = await lstat(destAbsolute, { bigint: true }).catch(() => null);
      if (now && createdStats && !now.isSymbolicLink() && sameFile(now, createdStats) && samePath(path.resolve(destAbsolute), destAbsolute)) await unlink(destAbsolute).catch(() => {});
    }
    throw error;
  } finally { if (dest) await dest.close(); await source.handle.close(); }
}

/** Validate complete header equivalence, original payload prefix, append bounds and integrity. */
export async function verifyArchivePair(sourcePath, destPath) {
  check(!samePath(path.resolve(sourcePath), path.resolve(destPath)), 'Source and destination must differ', 'UNSAFE_PATH');
  const source = await openChecked(sourcePath);
  let dest;
  try {
    dest = await openChecked(destPath);
    check(!sameFile(source.info.stats, dest.info.stats), 'Archives must not alias the same file', 'UNSAFE_PATH');
    const report = await verifyHandles(source.handle, dest.handle);
    await assertPathStillNames(source.absolute, source.info.stats);
    await assertPathStillNames(dest.absolute, dest.info.stats);
    return { sourcePath: source.absolute, destPath: dest.absolute, ...report };
  } finally { if (dest) await dest.handle.close(); await source.handle.close(); }
}
