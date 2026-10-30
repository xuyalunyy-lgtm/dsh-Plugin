// Local, reversible workaround for reviewed DSH Desktop 0.2.1-rc.3 and rc.5 on Windows.
// Reuses the official host's routes and security checks. Does not mutate process.env.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isAbsolute, join, win32 } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const runtimeDir = process.argv[2];
if (typeof runtimeDir !== 'string' || !isAbsolute(runtimeDir)) {
  throw new Error('open-in-app fix: expected Desktop runtime directory in argv[2]');
}
const root = join(runtimeDir, 'node_modules', '@deepseek-ai', 'dsh-host-open-in-app');
const moduleAt = (...parts) => import(pathToFileURL(join(root, ...parts)).href);
const official = await moduleAt('lib', 'index.js');
export const name = 'open-in-app-local-fix';
export const inject = official.inject;
export const Config = official.Config;

// rc.5 changes the package version/dependency metadata only; all five pinned
// implementation files below are byte-identical to the reviewed rc.3 baseline.
// Keep exact known manifests instead of trusting arbitrary future versions.
const reviewedManifests = new Set([
  '426bee22ffbc9bc51cafd55559c6bbeffbc017a4dbf5ec4722308bd3de549d14', // rc.3
  '845638ea1f8ad83346303afd2c36de97ea313929d68beb7d4720ca0edb553cbb', // rc.5
]);
const reviewed = {
  'lib/index.js': 'b1d17a0c2646389b27eefab2e1e22576a693b11c61c76884fc049aff54e00d96',
  'lib/types/index.js': '6238c1ff448b4501448fd53358cd20d4bc245546a7627295050013bb4c1ebee2',
  'lib/types/internals.js': '03d5399df04a29c888bfdc03286203625a8fd97d1736284fe59eff178d10d0cd',
  'lib/types/resolver.js': '3d6c5a87d3d14d604cedda05779b5d920aaf53f191bf7654c35884c05719ac5e',
  'lib/types/catalog.js': '332436eda2b51a4dfd7553d71331624e2387136b4b510f9670ca0e622b4c62b6',
};
function reviewedFilesMatch(readFile = readFileSync) {
  try {
    const digest = relative => createHash('sha256').update(readFile(join(root, relative))).digest('hex');
    return reviewedManifests.has(digest('package.json')) &&
      Object.entries(reviewed).every(([relative, expected]) => digest(relative) === expected);
  } catch {
    return false;
  }
}

let patched;
if (process.platform === 'win32' && reviewedFilesMatch()) {
  try {
    const [routes, seams, resolver, subprocess] = await Promise.all([
      moduleAt('lib', 'types', 'index.js'),
      moduleAt('lib', 'types', 'internals.js'),
      moduleAt('lib', 'types', 'resolver.js'),
      import(pathToFileURL(join(runtimeDir, 'node_modules', '@deepseek-ai', 'dsh-subprocess', 'lib', 'index.js')).href),
    ]);
    if (typeof routes.apply === 'function' && typeof resolver.launchDetachedApp === 'function' &&
        typeof subprocess.scrubbedParentEnv === 'function' && seams.internals &&
        typeof seams.internals.catalog === 'object' && seams.internals.catalog !== null) {
      patched = { routes, seams, resolver, subprocess };
    }
  } catch {
    // After an update, return to the installed official implementation instead of
    // using an unreviewed private interface. The original defect may then return.
  }
}

function childEnvironment(scrubbed, explicit = {}) {
  const result = {};
  for (const [key, value] of Object.entries(scrubbed)) {
    if (key.toUpperCase() !== 'ELECTRON_RUN_AS_NODE') result[key] = value;
  }
  // Explicit adapter environment wins, matching the official launch contract.
  for (const [key, value] of Object.entries(explicit)) result[key] = value;
  return result;
}

function makeLauncher({ originalLaunch, scrubbedParentEnv, spawnProcess = spawn, platform = process.platform }) {
  return (command, args, options) => {
    const exe = win32.basename(command).toLowerCase();
    if (platform !== 'win32' || (exe !== 'code.exe' && exe !== 'code - insiders.exe')) {
      return originalLaunch(command, args, options);
    }
    return new Promise((resolve, reject) => {
      const child = spawnProcess(command, [...args], {
        detached: true,
        stdio: 'ignore',
        windowsHide: options.windowsHide,
        env: childEnvironment(scrubbedParentEnv(), options.env),
      });
      let settled = false;
      const settle = outcome => {
        if (settled) return;
        settled = true;
        clearTimeout(watch);
        child.unref();
        outcome();
      };
      const watch = setTimeout(() => settle(resolve), options.watchMs);
      child.on('error', error => settle(() => reject(error)));
      child.on('exit', (code, signal) => settle(() => {
        if (code === 0) resolve();
        else reject(new Error(`launcher exited with code ${String(code)}, signal ${String(signal)}`));
      }));
    });
  };
}

export function apply(ctx, config) {
  if (!patched || patched.seams.internals.catalog.launch !== undefined) {
    console.warn('open-in-app local fix: reviewed private adapter unavailable; using the installed official implementation');
    return official.apply(ctx, config);
  }
  ctx.effect(() => {
    const previous = patched.seams.internals.catalog;
    const installed = {
      ...previous,
      launch: makeLauncher({
        originalLaunch: patched.resolver.launchDetachedApp,
        scrubbedParentEnv: patched.subprocess.scrubbedParentEnv,
      }),
    };
    patched.seams.internals.catalog = installed;
    return () => {
      if (patched.seams.internals.catalog === installed) patched.seams.internals.catalog = previous;
    };
  }, 'open-in-app local fix: scoped launcher');
  return patched.routes.apply(ctx, config);
}

export const testOnly = { childEnvironment, makeLauncher, reviewedFilesMatch, patchedAvailable: () => Boolean(patched) };
