"""Validate a release tarball and smoke-test its bundled runtime without installation.
Usage: python verify-package.py artifacts/release/dsh-focus-calendar-1.2.0.tgz --node <node.exe>
No private planner data is read or written.
"""
import argparse
import json
import pathlib
import subprocess
import tarfile
import tempfile
import xml.etree.ElementTree as ET

parser = argparse.ArgumentParser()
parser.add_argument('archive', type=pathlib.Path)
parser.add_argument('--node', required=True)
args = parser.parse_args()
archive = args.archive.resolve(strict=True)
artifact_root = archive.parent.resolve(strict=True)
required = {
    'package/package.json', 'package/index.js', 'package/state.js', 'package/client.js',
    'package/cordis.patch.yml', 'package/icon.svg', 'package/locale/en.json',
    'package/locale/zh.json', 'package/README.md', 'package/RESTORE.md',
    'package/node_modules/zod/package.json', 'package/node_modules/zod/index.js',
    'package/node_modules/zod/LICENSE',
}
with tarfile.open(archive, 'r:gz') as tar:
    members = tar.getmembers()
    names = {m.name for m in members}
    assert required <= names, f'Missing runtime resources: {sorted(required - names)}'
    for member in members:
        path = pathlib.PurePosixPath(member.name)
        assert path.parts and path.parts[0] == 'package', f'Unexpected archive root: {member.name}'
        assert not path.is_absolute() and '..' not in path.parts, 'Unsafe archive path'
        assert not member.issym() and not member.islnk(), 'Release must not depend on external symlinks'
        assert '.git' not in path.parts and 'artifacts' not in path.parts, 'Private/development data in release'
        assert not any(part.startswith('.env') or part.startswith('pre-upgrade-backup') for part in path.parts)
    manifest = json.load(tar.extractfile('package/package.json'))
    assert manifest['name'] == 'dsh-focus-calendar'
    assert manifest['version'] == '1.2.0'
    assert 'zod' in manifest.get('bundledDependencies', [])
    for lang in ('zh', 'en'):
        metadata = json.load(tar.extractfile(f'package/locale/{lang}.json'))['meta']
        assert metadata['title'] and metadata['description']
    svg = tar.extractfile('package/icon.svg').read()
    assert len(svg) <= 256 * 1024
    assert ET.fromstring(svg).tag == '{http://www.w3.org/2000/svg}svg'
    # The owned temporary directory is verified before extraction and automatic cleanup.
    with tempfile.TemporaryDirectory(prefix='pack-verify-', dir=artifact_root) as temporary:
        root = pathlib.Path(temporary).resolve(strict=True)
        assert root.parent == artifact_root and root.name.startswith('pack-verify-')
        for member in members:
            assert (root / member.name).resolve().is_relative_to(root)
        tar.extractall(root, filter='data')
        package = root / 'package'
        smoke = r"""
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const root = process.argv[1];
const load = relative => import(pathToFileURL(path.join(root, relative)).href);
const entry = await load('index.js');
const state = await load('state.js');
const { z } = await load('node_modules/zod/index.js');
assert.equal(typeof entry.apply, 'function');
const schema = state.stateSchema(z);
let stored = schema.parse(state.initialState());
const controller = state.createController({load:()=>stored,save:async next=>{stored=schema.parse(next);}});
try {
  const added = await controller.dispatch({action:'add',date:'2026-10-23',title:'Isolated package smoke test'});
  assert.equal(added.ok,true);
  const exported = await controller.dispatch({action:'export'});
  assert.equal(exported.ok,true);
  assert.equal(exported.backup.format,'dsh-focus-calendar');
  assert.equal(exported.backup.tasks.length,1);
  const preview = await controller.dispatch({action:'importPreview',backup:exported.backup});
  assert.equal(preview.ok,true);
  assert.equal(typeof preview.preview.token,'string');
} finally { await controller.close(); }
console.log('Bundled runtime smoke test: OK');
"""
        subprocess.run([args.node, '--input-type=module', '-e', smoke, str(package)], check=True)
print(f'Release validated: {archive.name}; {len(names)} entries; runtime, metadata, icon, bundled dependency and privacy checks passed.')
