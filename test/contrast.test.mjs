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
test('native selected surfaces and navigation are paired with theme text', () => {
  assert.match(source, /'--dsw-alias-bg-module-platform': colors\[2\]/);
  assert.match(source, /'--dsw-alias-interactive-bg-hover': colors\[2\]/);
  assert.match(source, /\[data-shortcut-modal="settings"\] nav button\[aria-current="true"\]/);
  assert.match(source, /if \(!s.enabled\) return null;/);
});
