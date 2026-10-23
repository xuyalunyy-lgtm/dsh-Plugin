import { createHash, randomUUID } from 'node:crypto';

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_BASE64 = 4 * Math.ceil(MAX_BYTES / 3);
const PALETTES = new Set(['green', 'apricot', 'forest', 'sky', 'lavender', 'rose', 'mint', 'silver', 'midnight', 'plum', 'coffee', 'graphite']);
const FIELDS = ['enabled', 'palette', 'opacity', 'blur', 'fit', 'name', 'pattern'];
const ID = /^[a-f0-9]{64}$/;
const PRESET_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const MAX_PRESETS = 20;
export const DEFAULT_STATE = Object.freeze({ enabled: true, palette: 'green', opacity: 12, blur: 0, fit: 'cover', name: '', pattern: true, imageId: null });
export const INITIAL_DOCUMENT = Object.freeze({ revision: 0, initialized: false, current: DEFAULT_STATE, presets: Object.freeze([]) });

function invalid(message = 'Invalid theme input') {
  return Object.assign(new Error(message), { code: 'INVALID_INPUT' });
}
function plain(value, allowed, required = []) {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.length > allowed.length || keys.some(key => typeof key !== 'string' || !allowed.includes(key))) return false;
  if (required.some(key => !Object.hasOwn(value, key))) return false;
  return keys.every(key => {
    const d = Object.getOwnPropertyDescriptor(value, key);
    return d.enumerable && Object.hasOwn(d, 'value');
  });
}
function validField(key, value) {
  switch (key) {
    case 'enabled': case 'pattern': return typeof value === 'boolean';
    case 'palette': return PALETTES.has(value);
    case 'opacity': return Number.isInteger(value) && value >= 0 && value <= 25;
    case 'blur': return Number.isInteger(value) && value >= 0 && value <= 16;
    case 'fit': return ['cover', 'contain', 'repeat'].includes(value);
    case 'name': return typeof value === 'string' && value.length <= 200;
    case 'imageId': return value === null || (typeof value === 'string' && ID.test(value));
    default: return false;
  }
}
function revision(value) { return Number.isSafeInteger(value) && value >= 0; }

function validState(value) {
  return plain(value, [...FIELDS, 'imageId'], [...FIELDS, 'imageId']) &&
    Object.entries(value).every(([k, v]) => validField(k, v));
}
function validPresetName(value) {
  return typeof value === 'string' && value.length >= 1 && value.length <= 40 && value === value.trim();
}
function validPresetId(value) { return typeof value === 'string' && PRESET_ID.test(value); }
function validPresets(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > MAX_PRESETS) return false;
  // Reject sparse arrays, extra/symbol keys, and getters before inspecting elements.
  if (Reflect.ownKeys(value).length !== value.length + 1) return false;
  const ids = new Set(), names = new Set();
  for (let i = 0; i < value.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) return false;
    const preset = descriptor.value;
    if (!plain(preset, ['id', 'name', 'state'], ['id', 'name', 'state']) ||
        !validPresetId(preset.id) || !validPresetName(preset.name) || !validState(preset.state) ||
        ids.has(preset.id) || names.has(preset.name.toLowerCase())) return false;
    ids.add(preset.id); names.add(preset.name.toLowerCase());
  }
  return true;
}
function clonePresets(presets) { return presets.map(preset => ({ ...preset, state: { ...preset.state } })); }
function imageReferences(document) {
  return new Set([document.current.imageId, ...document.presets.map(preset => preset.state.imageId)]);
}

/** Boolean predicates for z.custom; old version-1 documents may omit presets. */
export function validDocument(value) {
  try {
    return plain(value, ['revision', 'initialized', 'current', 'presets'], ['revision', 'initialized', 'current']) &&
      revision(value.revision) && typeof value.initialized === 'boolean' && validState(value.current) &&
      (!Object.hasOwn(value, 'presets') || validPresets(value.presets));
  } catch { return false; }
}
function imageBytes(record) {
  if (!plain(record, ['mime', 'data'], ['mime', 'data']) ||
      !['image/png', 'image/jpeg', 'image/webp'].includes(record.mime) ||
      typeof record.data !== 'string' || !record.data.length || record.data.length > MAX_BASE64 ||
      record.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(record.data)) throw invalid('Invalid image encoding or size');
  const bytes = Buffer.from(record.data, 'base64');
  if (bytes.length > MAX_BYTES || bytes.toString('base64') !== record.data) throw invalid('Invalid image encoding or size');
  const png = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.length >= 12 && bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP';
  if (!(record.mime === 'image/png' ? png : record.mime === 'image/jpeg' ? jpeg : webp)) throw invalid('Image signature does not match MIME type');
  return bytes;
}
export function validImageRecord(value) {
  try { imageBytes(value); return true; } catch { return false; }
}
function parseImage(value) {
  if (value === '') return null;
  if (typeof value !== 'string' || value.length > MAX_BASE64 + 32) throw invalid('Invalid image data URL');
  const match = /^data:(image\/(?:png|jpeg|webp));base64,/.exec(value);
  if (!match) throw invalid('Only inline PNG, JPEG, or WebP images are accepted');
  const record = { mime: match[1], data: value.slice(match[0].length) };
  const bytes = imageBytes(record);
  return { id: createHash('sha256').update(bytes).digest('hex'), record };
}
function parseRequest(request) {
  try {
    if (!plain(request, ['action', 'expectedRevision', 'patch', 'id', 'name'], ['action'])) throw invalid();
    const { action } = request;
    const fields = {
      read: ['action'], update: ['action', 'expectedRevision', 'patch'],
      importLegacy: ['action', 'expectedRevision', 'patch'], reset: ['action', 'expectedRevision'],
      savePreset: ['action', 'expectedRevision', 'name'], applyPreset: ['action', 'expectedRevision', 'id'],
      renamePreset: ['action', 'expectedRevision', 'id', 'name'], deletePreset: ['action', 'expectedRevision', 'id'],
    };
    if (typeof action !== 'string' || !Object.hasOwn(fields, action) || !plain(request, fields[action], fields[action])) throw invalid('Invalid action fields');
    if (action === 'read') return { action };
    if (!revision(request.expectedRevision)) throw invalid('Mutation requires expectedRevision');
    if (action === 'reset') return { action, expectedRevision: request.expectedRevision };
    if (action.endsWith('Preset')) {
      const result = { action, expectedRevision: request.expectedRevision };
      if (Object.hasOwn(request, 'id')) {
        if (!validPresetId(request.id)) throw invalid('Invalid preset ID');
        result.id = request.id;
      }
      if (Object.hasOwn(request, 'name')) {
        // Bound raw input as well as the trimmed display name.
        if (typeof request.name !== 'string' || request.name.length > 200 || !validPresetName(request.name.trim())) throw invalid('Preset name must contain 1 to 40 characters');
        result.name = request.name.trim();
      }
      return result;
    }
    if (!Object.hasOwn(request, 'patch') || !plain(request.patch, [...FIELDS, 'image'])) throw invalid('Invalid patch fields');
    const patch = {};
    let image;
    for (const [key, value] of Object.entries(request.patch)) {
      if (key === 'image') image = parseImage(value);
      else {
        if (!validField(key, value)) throw invalid(`Invalid ${key}`);
        patch[key] = value;
      }
    }
    return { action, expectedRevision: request.expectedRevision, patch, image };
  } catch (error) {
    if (error?.code === 'INVALID_INPUT') throw error;
    throw invalid();
  }
}

/** Single writer per Domain. The lifecycle owner stops ingress, drains, then closes. */
export class ThemeRepository {
  #domain;
  #images;
  #queue = Promise.resolve();
  constructor(domain) {
    this.#domain = domain;
    this.#images = domain.table('images');
  }
  #enqueue(operation) {
    const result = this.#queue.then(operation);
    this.#queue = result.then(() => undefined, () => undefined);
    return result;
  }
  #document() {
    const document = this.#domain.global.get();
    if (!validDocument(document)) throw invalid('Invalid persisted theme document');
    return { ...document, current: { ...document.current }, presets: clonePresets(Object.hasOwn(document, 'presets') ? document.presets : []) };
  }
  #snapshot(document) {
    return { revision: document.revision, initialized: document.initialized, state: { ...document.current }, presets: clonePresets(document.presets) };
  }
  async execute(request) {
    // Capture caller-owned inputs before queueing; later caller mutation cannot change a write.
    const input = parseRequest(request);
    return this.#enqueue(async () => {
      const previous = this.#document();
      if (input.action === 'read') return this.#snapshot(previous);
      if (input.expectedRevision !== previous.revision) throw Object.assign(new Error('Theme revision conflict'), { code: 'CONFLICT' });
      if (input.action === 'importLegacy' && previous.initialized) return this.#snapshot(previous);
      if (previous.revision === Number.MAX_SAFE_INTEGER) throw invalid('Theme revision exhausted');
      let current = input.action === 'reset' ? { ...DEFAULT_STATE } : { ...previous.current, ...input.patch };
      let presets = previous.presets;
      if (input.action === 'savePreset' || input.action === 'renamePreset') {
        if (presets.some(preset => preset.id !== input.id && preset.name.toLowerCase() === input.name.toLowerCase())) throw invalid('Preset name already exists');
      }
      if (input.action === 'savePreset') {
        if (presets.length >= MAX_PRESETS) throw invalid('At most 20 presets may be saved');
        presets.push({ id: randomUUID(), name: input.name, state: { ...current } });
      } else if (['applyPreset', 'renamePreset', 'deletePreset'].includes(input.action)) {
        const preset = presets.find(item => item.id === input.id);
        if (!preset) throw invalid('Preset not found');
        if (input.action === 'applyPreset') current = { ...preset.state };
        else if (input.action === 'renamePreset') preset.name = input.name;
        else presets = presets.filter(item => item.id !== input.id);
      }
      if (input.image !== undefined) current.imageId = input.image?.id ?? null;
      if (input.image) {
        const existing = this.#images.get(input.image.id);
        if (existing === undefined) await this.#images.put(input.image.id, { ...input.image.record });
        else if (!validImageRecord(existing) || existing.mime !== input.image.record.mime || existing.data !== input.image.record.data) throw invalid('Stored image does not match its content address');
      }
      const next = { revision: previous.revision + 1, initialized: true, current, presets };
      // Domain promises durable-before-memory: failure here leaves previous preferences intact.
      // A newly inserted orphan is harmless and collected after a later successful commit.
      await this.#domain.global.set(next);
      await this.#cleanup(imageReferences(next));
      return this.#snapshot(next);
    });
  }
  async readImage(id) {
    if (typeof id !== 'string' || !ID.test(id)) throw invalid('Invalid image ID');
    return this.#enqueue(() => {
      if (!imageReferences(this.#document()).has(id)) return undefined;
      const record = this.#images.get(id);
      if (record === undefined) return undefined;
      if (!validImageRecord(record) || createHash('sha256').update(Buffer.from(record.data, 'base64')).digest('hex') !== id) throw invalid('Invalid persisted image');
      return { mime: record.mime, data: record.data };
    });
  }
  async #cleanup(referencedIds) {
    try {
      for (const [id] of this.#images.entries()) {
        if (!referencedIds.has(id)) {
          try { await this.#images.delete(id); } catch { /* Committed preferences must still succeed. */ }
        }
      }
    } catch { /* Asset enumeration is best-effort as well. */ }
  }
  async drain() { await this.#queue; }
}
