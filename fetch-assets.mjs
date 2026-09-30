#!/usr/bin/env node
/**
 * Copy the MediaPipe WebAssembly runtime out of the installed npm package and
 * download the face landmark model, so that the camera path only ever talks to
 * the app's own origin.
 *
 * Runs on `postinstall` and via `npm run assets`.
 *
 * Flags:
 *   --offline        do not download anything, fail if the model is missing
 *   --update-lock    accept new hashes and rewrite assets.lock.json, after a
 *                    human has checked that upstream did not change the model
 *
 * Nothing here needs a key or a token.
 */

import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, 'public/mediapipe');
const wasmOutDir = join(outDir, 'wasm');
const lockPath = resolve(here, 'assets.lock.json');

const PACKAGE = '@mediapipe/tasks-vision';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const MODEL_NAME = 'face_landmarker.task';

const flags = new Set(process.argv.slice(2));
const offline = flags.has('--offline');
const updateLock = flags.has('--update-lock');

function fail(message) {
  console.error(`\nfetch-assets: ${message}\n`);
  process.exit(1);
}

async function sha256(path) {
  const bytes = await readFile(path);
  return createHash('sha256').update(bytes).digest('hex');
}

async function copyWasm() {
  const packageJson = join(here, 'node_modules', PACKAGE, 'package.json');
  if (!existsSync(packageJson)) {
    fail(
      `${PACKAGE} is not installed. Run "npm install" first, or run this with a populated node_modules.`,
    );
  }

  const version = JSON.parse(await readFile(packageJson, 'utf8')).version;
  const srcDir = join(here, 'node_modules', PACKAGE, 'wasm');
  const files = (await readdir(srcDir)).filter((name) => name.endsWith('.js') || name.endsWith('.wasm'));

  if (files.length === 0) fail(`no WebAssembly files found in ${srcDir}`);

  await mkdir(wasmOutDir, { recursive: true });
  const filesOut = {};
  for (const name of files.sort()) {
    const from = join(srcDir, name);
    const to = join(wasmOutDir, name);
    await copyFile(from, to);
    filesOut[name] = await sha256(to);
  }
  console.log(`assets: copied ${files.length} WebAssembly files from ${PACKAGE}@${version}`);
  return { version, files: filesOut };
}

async function downloadModel() {
  const target = join(outDir, MODEL_NAME);

  if (existsSync(target)) {
    console.log(`assets: ${MODEL_NAME} is already present`);
    return target;
  }
  if (offline) {
    fail(`--offline was given but ${target} does not exist.`);
  }

  console.log(`assets: downloading ${MODEL_NAME} from storage.googleapis.com`);
  const response = await fetch(MODEL_URL);
  if (!response.ok) {
    fail(`downloading the model failed: HTTP ${response.status} ${response.statusText}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(target, bytes);
  console.log(`assets: wrote ${MODEL_NAME} (${(bytes.length / 1024 / 1024).toFixed(1)} MiB)`);
  return target;
}

function compareWithLock(lock, next) {
  const problems = [];

  const lockedModel = lock.model?.sha256;
  if (lockedModel && lockedModel !== next.model.sha256) {
    problems.push(
      `the model hash changed.\n    recorded ${lockedModel}\n    on disk   ${next.model.sha256}`,
    );
  }

  const lockedWasm = lock.wasm?.files ?? {};
  for (const [name, hash] of Object.entries(next.wasm.files)) {
    if (lockedWasm[name] && lockedWasm[name] !== hash) {
      problems.push(
        `the WebAssembly file ${name} changed.\n    recorded ${lockedWasm[name]}\n    on disk   ${hash}`,
      );
    }
  }

  if (problems.length === 0) return;

  if (!updateLock) {
    fail(
      `assets.lock.json does not match what is on disk. ${problems.join('\n  ')}\n` +
        '    If that is expected, check the upstream model card and licence first, then run:\n' +
        '        npm run assets -- --update-lock',
    );
  }
  console.log('assets: --update-lock given, recording the new hashes');
}

const lockExists = existsSync(lockPath);
const lock = lockExists ? JSON.parse(await readFile(lockPath, 'utf8')) : {};

// Record the URLs a future reader needs to audit the bytes.
lock.model = { ...lock.model, name: MODEL_NAME, url: MODEL_URL, license: 'not stated upstream' };

const wasm = await copyWasm();
const modelPath = await downloadModel();

const next = {
  model: { ...lock.model, sha256: await sha256(modelPath) },
  wasm: { package: PACKAGE, version: wasm.version, files: wasm.files },
};

compareWithLock(lock, next);

await mkdir(resolve(here, 'public'), { recursive: true });
await writeFile(lockPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
console.log(`assets: wrote ${lockPath.replace(`${here}/`, '')}`);
