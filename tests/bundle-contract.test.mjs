import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('PDF layer retains required rotation and CSS rounding contract',async()=>{
 const css=await readFile(new URL('../src/style.css',import.meta.url),'utf8');
 for(const rotation of [90,180,270])assert.ok(css.includes(`[data-main-rotation="${rotation}"]`));
 assert.ok(css.includes('--scale-round-x:1px'));assert.ok(css.includes('--scale-round-y:1px'));
 const client=await readFile(new URL('../src/client.cjs',import.meta.url),'utf8');
 assert.ok(client.includes('scale*(viewport.userUnit||page.userUnit||1)'));
});
test('local fonts and Chinese CMaps are bundled, not fetched remotely',async()=>{
 const assets=JSON.parse(await readFile(new URL('../src/pdf-assets.json',import.meta.url),'utf8'));
 assert.ok(assets['cmaps/Adobe-GB1-UCS2.bcmap']);
 assert.ok(assets['standard_fonts/LiberationSans-Regular.ttf']);
});
