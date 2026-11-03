import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Test the exact palette generator used by applyPalette, without mocking a DOM.
const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
const palettes = runInNewContext('(' + source.match(/const palettes = (\{[\s\S]*?\n    \});/)[1] + ')');
const paletteGroups = runInNewContext('(' + source.match(/const paletteGroups = (\{[\s\S]*?\n    \});/)[1] + ')');
const markdownTokens = runInNewContext('(' + source.match(/    function markdownTokens\([^]*?\n    \}/)[0] + ')', { palettes, paletteGroups });
function luminance(hex) {
  const [r,g,b] = hex.slice(1).match(/../g).map(x => parseInt(x,16)/255).map(x => x <= .04045 ? x/12.92 : ((x+.055)/1.055)**2.4);
  return .2126*r+.7152*g+.0722*b;
}
function contrast(a,b) { const x=luminance(a),y=luminance(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); }
const bgNames = ['inline-code','code-block','code-block-banner','code-segment-selected','code-segment-unselected','citation','tag'];
for (const [name,colors] of Object.entries(palettes)) {
  for (const mode of ['light','dark']) {
    test(`${name} on Host ${mode}: inline/code/banner/segments retain readable body and link text`,()=>{
      const tokens=markdownTokens(name);
      for (const bgName of bgNames) {
        const bg=tokens['--dsw-alias-markdown-'+bgName][mode];
        for (const fg of [colors[7],tokens['--dsw-alias-link'][mode]]) {
          assert.ok(contrast(fg,bg)>=4.5,`${name} ${bgName} ${fg} on ${bg}: ${contrast(fg,bg)}`);
        }
      }
      for(const bg of [colors[0],colors[1],colors[2],colors[3],colors[9]]) {
        assert.ok(contrast(tokens['--dsw-alias-link'][mode],bg)>=4.5,`${name} link on surface ${bg}`);
      }
    });
    test(`${name} on Host ${mode}: every syntax token and line number meets 4.5:1`,()=>{
      const tokens=markdownTokens(name), bg=tokens['--dsw-alias-markdown-code-block'][mode];
      for(const [key,value] of Object.entries(tokens)) {
        if(key.startsWith('--shiki-token-') || key==='--shiki-foreground' || key==='--dsw-alias-label-tertiary') {
          assert.ok(contrast(value[mode],bg)>=4.5,`${name} ${key}: ${contrast(value[mode],bg)}`);
        }
      }
    });
  }
  test(`${name}: palette controls both Host modes and all override pairs are complete`,()=>{
    const tokens=markdownTokens(name);
    for(const value of Object.values(tokens)) {
      assert.match(value.light,/^#[a-f0-9]{6}$/i);
      assert.equal(value.light,value.dark);
    }
    assert.equal(tokens['--dsw-alias-markdown-inline-code'].light,colors[2]);
    assert.equal(tokens['--dsw-alias-markdown-code-block'].light,colors[1]);
  });
}
test('Markdown pairs are composed in the existing disposable layer, not forced global code styles',()=>{
  assert.match(source,/Object.assign\(tokens, markdownTokens\(state.palette\)\)/);
  assert.match(source,/disposeTokens = ctx.theme.overrideTokens\(NS, tokens\)/);
  assert.match(source,/if \(!state.enabled\) \{\s*disposeTokens\(\)/);
  assert.doesNotMatch(source,/code\s*\{[^}]*color:[^}]*!important/);
});
