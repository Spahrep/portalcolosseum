#!/usr/bin/env node
/**
 * stamp-build.mjs — inject the current commit short-SHA into the build marker
 * on run.html and run-equip.html at build time.
 *
 * Runs as the Vercel buildCommand on every deploy, so the "BUILD:" banner
 * always reflects the artifact that was actually shipped. This is build-time
 * injection (metadata about the artifact), the standard way to version a ship.
 *
 * SHA source: VERCEL_GIT_COMMIT_SHA (full hash, provided at build time) falls
 * back to `git rev-parse --short HEAD` for local runs.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const TARGETS = ['run.html', 'run-equip.html'];
const RE_BUILD = /(BUILD:)[a-fA-F0-9]{5,40}/g;

function currentShortSha() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  }
  return execSync('git rev-parse --short HEAD').toString().trim();
}

let ok = 0;
for (const file of TARGETS) {
  let src;
  try {
    src = readFileSync(file, 'utf8');
  } catch {
    console.error(`[stamp-build] skip (missing): ${file}`);
    continue;
  }
  const before = src;
  const stamped = src.replace(RE_BUILD, `$1${currentShortSha()}`);
  if (stamped === before) {
    console.error(`[stamp-build] ERROR: no build marker found in ${file}`);
    process.exitCode = 1;
    continue;
  }
  writeFileSync(file, stamped);
  console.log(`[stamp-build] ${file} -> stamped`);
  ok++;
}

if (process.env.VERCEL_GIT_COMMIT_SHA) {
  console.log(`[stamp-build] source VERCEL_GIT_COMMIT_SHA=${process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)}`);
} else {
  console.log(`[stamp-build] source git short SHA`);
}

console.log(`[stamp-build] ${ok}/${TARGETS.length} files stamped`);
if (ok === 0) process.exitCode = 1;
