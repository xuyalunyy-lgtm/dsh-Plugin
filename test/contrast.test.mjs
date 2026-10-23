import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

// Test the literal palette data, not a simulated browser or React renderer.
const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
const palettes = runInNewContext('(' + source.match(/const palettes = (\{[\s\S]*?\n    \});/)[1] + ')');
function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255)
    .map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
function contrast(a, b) {
  const aa = luminance(a), bb = luminance(b);
  return (Math.max(aa, bb) + .05) / (Math.min(aa, bb) + .05);
}
for (const [name, colors] of Object.entries(palettes)) {
  test(name + ': primary text on normal, selected, hover and menu surfaces meets 4.5:1', () => {
    for (const i of [0, 1, 2, 3, 9]) {
      const ratio = contrast(colors[7], colors[i]);
      assert.ok(ratio >= 4.5, `${name} surface ${i}: ${ratio.toFixed(2)}:1`);
    }
  });
}
const groups = runInNewContext('(' + source.match(/const paletteGroups = (\{[\s\S]*?\n    \});/)[1] + ')');
const dictionaries = runInNewContext('(' + source.match(/const dictionaries = (\{[\s\S]*?\n    \});/)[1] + ')');
const sanitize = runInNewContext('(' + source.match(/function sanitize\(value\) \{[\s\S]*?\n    \}/)[0] + ')', { palettes });
test('12 valid palettes appear exactly once across light and dark groups', () => {
  assert.equal(Object.keys(palettes).length, 12);
  const ids = Object.values(groups).flat();
  assert.equal(ids.length, 12);
  assert.equal(new Set(ids).size, 12);
  assert.deepEqual([...ids].sort(), Object.keys(palettes).sort());
  for (const colors of Object.values(palettes)) {
    assert.equal(colors.length, 10);
    colors.forEach(color => assert.match(color, /^#[0-9a-f]{6}$/i));
  }
});
test('every palette and group has Chinese and English names', () => {
  for (const locale of ['zh', 'en']) {
    for (const key of [...Object.keys(palettes), ...Object.keys(groups), 'selected']) {
      assert.ok(dictionaries[locale][key]?.length, `${locale}: ${key}`);
    }
  }
});
test('old and new preferences retain theme and uploaded background', () => {
  const image = 'data:image/png;base64,AAAA';
  for (const palette of Object.keys(palettes)) {
    const saved = sanitize({ palette, image, name: 'wallpaper.png', opacity: 9, blur: 3, fit: 'contain', enabled: false, pattern: false });
    assert.equal(saved.palette, palette);
    assert.equal(saved.image, image);
    assert.equal(saved.name, 'wallpaper.png');
    assert.equal(saved.opacity, 9);
    assert.equal(saved.blur, 3);
    assert.equal(saved.fit, 'contain');
    assert.equal(saved.enabled, false);
    assert.equal(saved.pattern, false);
  }
  assert.equal(sanitize({ palette: 'missing' }).palette, 'green');
  assert.equal(sanitize({ palette: '__proto__' }).palette, 'green');
});
for (const [name, colors] of Object.entries(palettes)) {
  test(name + ': secondary text meets 4.5:1 on themed surfaces', () => {
    for (const i of [0, 1, 2, 3, 9]) {
      const ratio = contrast(colors[8], colors[i]);
      assert.ok(ratio >= 4.5, `${name} secondary on ${i}: ${ratio.toFixed(2)}:1`);
    }
  });
}
test('native selected surfaces and navigation are paired with theme text', () => {
  assert.match(source, /'--dsw-alias-bg-module-platform': colors\[2\]/);
  assert.match(source, /'--dsw-alias-interactive-bg-hover': colors\[2\]/);
  assert.match(source, /\[data-shortcut-modal="settings"\] nav button\[aria-current="true"\]/);
  assert.match(source, /if \(!s.enabled\) return null;/);
});
