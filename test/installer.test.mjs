import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
test('PowerShell performs real apply/rollback and all no-op/error guards on isolated files',()=>{
  const root=mkdtempSync(join(tmpdir(),'dsh-patch-files-'));
  try {
    const file=fileURLToPath(new URL('./patch-files.test.ps1',import.meta.url));
    const result=spawnSync('pwsh',['-NoProfile','-File',file,'-TestRoot',root],{stdio:'inherit'});
    if(result.error)throw result.error;
    assert.equal(result.status,0);
  } finally {
    // mkdtemp returned this invocation's owned absolute directory, never the install tree.
    assert.ok(root.startsWith(join(tmpdir(),'dsh-patch-files-')));
    rmSync(root,{recursive:true,force:true});
  }
});
test('public installer retains its fixed-path gate and shared tested implementation',()=>{
  const source=readFileSync(new URL('../Apply-Patch.ps1',import.meta.url),'utf8');
  assert.match(source,/if \(\$target -ne \$expectedTarget/);
  assert.match(source,/Invoke-DesktopArchivePatch -Action \$Action/);
  assert.match(source,/-CheckStopped \{ Assert-Stopped \}/);
  assert.doesNotMatch(source,/File\]::Replace/);
});
