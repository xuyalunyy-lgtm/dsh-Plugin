import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const manifest = JSON.parse(await read('./package.json'));
assert.equal(manifest.name, 'dsh-session-manager');
assert.equal(manifest.type, 'module');
assert.equal(manifest.dsh.client.platform, 'web');
assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml');
for (const value of Object.values(manifest.exports).filter(x => !x.includes('*'))) {
  assert(value.startsWith('./') && !value.includes('..'));
  assert((await stat(new URL(value, import.meta.url))).isFile());
}
for (const name of ['zh', 'en']) {
  const { meta } = JSON.parse(await read(`./locale/${name}.json`));
  assert(meta.title?.length && meta.description?.length, 'Localized display metadata');
}
const icon = await read('./icon.svg');
assert(icon.startsWith('<svg') && icon.includes('viewBox="0 0 64 64"'));
assert(!/<script|<foreignObject|(?:href|src)=/i.test(icon), 'Self-contained original SVG');
assert(Buffer.byteLength(icon) < 256 * 1024);
const client = await read('./client.js');
assert(client.includes("id: 'dsh-session-manager'"));
assert(client.includes("id:'session-manager'"));
assert(client.includes("key:'session-manager'"));
assert(!/require\(['"]@deepseek-ai\//.test(client), 'No private client package imports');
assert(!/document\.body|innerHTML|dangerouslySetInnerHTML/.test(client), 'No external DOM manipulation');
for (const match of client.matchAll(/var\((--[^),]+)/g)) {
  assert(match[1].startsWith('--dsw-alias-'), `Non-host theme token: ${match[1]}`);
}
assert(!/#[0-9a-f]{3,8}\b/i.test(client), 'UI uses theme tokens, not literal colors');
assert(client.includes("credentials:'same-origin'"));
assert(client.includes("role:'dialog'") && client.includes("'aria-modal':true"));
assert(client.includes("event.key==='Escape'") && client.includes("event.key==='Tab'"));
assert(client.includes('request.expectedToken=dialog.item.token'));
assert(client.includes('sessionStorage.setItem(journalKey,JSON.stringify(value))'));
assert(client.includes('function EyeIcon('), 'Original eye artwork');
assert(client.includes("'aria-pressed':!w.hidden") && client.includes("'aria-label':t(w.hidden?'showWorkspace':'hideWorkspace')"), 'Accessible workspace eye action');
assert(client.includes('expectedVisibilityRevision:data.visibilityRevision'), 'Visibility uses the read revision');
assert(client.includes("action:'setWorkspaceVisibility'"), 'UI shares the Host visibility operation');
assert(client.includes('includeHidden,offset,limit:30'), 'Hidden workspace filtering is Host-backed');
assert(client.includes('workspaces.map(w=>h(\'div\''), 'Hidden workspaces retain an accessible recovery entry');
assert(client.includes("request.items=dialog.items.map(item=>({sessionId:item.sessionId,expectedToken:item.token}))"), 'Batch freezes per-item versions');
assert(client.includes('eligibleRows.filter(item=>!onlyEmpty||item.empty===true)'), 'Empty selection is content-backed and page-bounded');
assert(client.includes("setReadError('');setSelected({});"), 'List refresh clears old page selection');
assert(client.includes("model.action==='batchDelete'&&h('div'"), 'Bulk delete has an explicit confirmation');
assert(client.includes("t(result.ok?'batchSucceeded':'batchFailed')"), 'Bulk results remain individually visible');
console.log('Manifest, resources, bulk selection, eye actions, accessible dialog, versioned requests and theme invariants OK');
console.log(`Validated ${resolve('.')}`);
