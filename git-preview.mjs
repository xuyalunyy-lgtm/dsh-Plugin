import path from 'node:path';
import { constants } from 'node:fs';
import fs from 'node:fs/promises';

const MAX_BYTES = 256 * 1024;
const MAX_LINES = 2000;
// Up to one whole UTF-8 code point beyond the display boundary, never readFile().
const DETECTION_BYTES = 4;
const within = (root, target) => {
  const relative = path.relative(root, target);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
};
const samePath = (left, right) => process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
const sameIdentity = (left, right) => left.dev === right.dev && left.ino === right.ino && left.mode === right.mode;
const sameFile = (left, right) => sameIdentity(left, right) && left.size === right.size && left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs;
const changed = () => new Error('文件或路径在预览过程中发生变化，请刷新后重试');

function literalPath(value) {
  if (typeof value !== 'string' || !value || value.length > 4096 || /[\x00-\x1f\x7f]/.test(value) ||
      path.posix.isAbsolute(value) || path.win32.isAbsolute(value) || /^[a-z]:/i.test(value)) {
    throw new TypeError('path must be a non-empty repository-relative file path');
  }
  const normalized = value.replaceAll('\\', '/');
  const parts = normalized.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || /[:<>"|?*]/.test(part) || /[. ]$/.test(part) ||
      part.toLowerCase() === '.git' || /^\.?git~\d/i.test(part) ||
      /^(?:con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³]|conin\$|conout\$|clock\$)$/i.test(part.split('.')[0].replace(/[ .]+$/, '')))) {
    throw new TypeError('path must not escape the repository or address Git metadata / Windows special paths');
  }
  return { normalized, parts };
}

/** Check every component, including the root and leaf, without following links.
 * realpath equality also rejects redirects/aliases not exposed as symlinks by lstat.
 */
async function inspect(root, parts, metadata) {
  const chain = [];
  let current = root;
  for (let i = 0; i <= parts.length; i++) {
    if (i) current = path.join(current, parts[i - 1]);
    const info = await fs.lstat(current, { bigint: true });
    if (info.isSymbolicLink()) throw new Error('path must not contain any symlink or junction, including the file itself');
    if (i < parts.length ? !info.isDirectory() : !info.isFile()) throw new Error('preview requires a regular file and real directory ancestors');
    const resolved = await fs.realpath(current);
    if (!samePath(current, resolved) || !within(root, resolved)) throw new Error('path must not traverse a symlink or escape the repository');
    if (metadata.some(directory => within(directory, resolved))) throw new Error('path must not address Git metadata');
    chain.push(info);
  }
  return chain;
}

function checkChain(before, after) {
  if (before.length !== after.length || before.some((info, index) => !sameIdentity(info, after[index])) || !sameFile(before.at(-1), after.at(-1))) throw changed();
}

function textPreview(buffer, bytes) {
  const truncated = bytes > MAX_BYTES;
  // A binary/invalid UTF-8 result is a message, never lossy decoded file content.
  if (buffer.some(byte => byte < 32 && byte !== 9 && byte !== 10 && byte !== 13 || byte === 127)) {
    return { text: '二进制文件，无法进行文本预览。', binary: true, truncated, bytes, lines: 0 };
  }
  let text;
  try {
    // Only a truly truncated sample may leave an incomplete final code point.
    new TextDecoder('utf-8', { fatal: true }).decode(buffer, { stream: bytes > buffer.length });
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, MAX_BYTES), { stream: truncated });
  } catch {
    return { text: '文件不是有效的 UTF-8 文本，无法进行预览。', binary: true, truncated, bytes, lines: 0 };
  }
  let lines = 0, end = 0;
  for (const match of text.matchAll(/\r\n|\r|\n/g)) {
    lines++;
    end = match.index + match[0].length;
    if (lines === MAX_LINES && end < text.length) {
      return { text: text.slice(0, end), binary: false, truncated: true, bytes, lines };
    }
  }
  if (end < text.length) lines++;
  return { text, binary: false, truncated, bytes, lines };
}

/** Only called on a discovery-validated repository by the API. Re-normalize the
 * worktree root for direct readers opened in a repository subdirectory as well.
 * bytes is the stable file size; lines counts displayed content lines (empty = 0).
 */
export async function previewUntracked(reader, input) {
  if (!await reader._isRepository()) throw Object.assign(new Error('Not a Git repository'), { code: 'NOT_GIT_REPOSITORY' });
  const { normalized, parts } = literalPath(input);
  const root = reader.root;
  const target = path.resolve(root, ...parts);
  if (!within(root, target)) throw new Error('path must not escape the repository');
  const marker = await fs.lstat(path.join(root, '.git'));
  if (marker.isSymbolicLink() || !marker.isFile() && !marker.isDirectory()) throw new Error('Git metadata must not be a symlink');
  // A separate gitdir may live inside the worktree under a name other than .git.
  const directories = (await reader._git(['rev-parse', '--absolute-git-dir', '--git-common-dir'])).stdout.replace(/\r?\n$/, '').split(/\r?\n/);
  if (directories.length !== 2 || directories.some(directory => !directory)) throw new Error('Cannot safely resolve Git metadata directories');
  const metadata = await Promise.all(directories.map(directory => fs.realpath(path.resolve(root, directory))));
  const before = await inspect(root, parts, metadata);
  const verifyUntracked = async () => {
    const result = await reader._git(['ls-files', '--others', '--exclude-standard', '-z', '--', normalized]);
    if (result.stdout !== `${normalized}\0`) throw new Error('只能预览未跟踪且未被忽略的文件 (untracked, non-ignored files only)');
  };
  await verifyUntracked();
  // O_NONBLOCK avoids blocking on a FIFO swapped in between lstat and open.
  // O_NOFOLLOW is enforced by the OS for the leaf on POSIX; Windows additionally
  // relies on identity, component and realpath checks immediately around the read.
  const flags = constants.O_RDONLY | (process.platform === 'win32' ? 0 : constants.O_NOFOLLOW | constants.O_NONBLOCK);
  const handle = await fs.open(target, flags);
  try {
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || !sameFile(before.at(-1), opened)) throw changed();
    checkChain(before, await inspect(root, parts, metadata));
    const bytes = Number(opened.size);
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('File size cannot be safely represented');
    const buffer = Buffer.alloc(Math.min(bytes, MAX_BYTES + DETECTION_BYTES));
    let read = 0;
    while (read < buffer.length) {
      const result = await handle.read(buffer, read, buffer.length - read, read);
      if (!result.bytesRead) break;
      read += result.bytesRead;
    }
    if (read !== buffer.length || !sameFile(opened, await handle.stat({ bigint: true }))) throw changed();
    checkChain(before, await inspect(root, parts, metadata));
    // Reject stage/ignore changes that happened while the bounded sample was read.
    await verifyUntracked();
    if (!sameFile(opened, await handle.stat({ bigint: true }))) throw changed();
    return textPreview(buffer, bytes);
  } finally {
    await handle.close();
  }
}
