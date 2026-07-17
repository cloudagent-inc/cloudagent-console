#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const args = new Set(process.argv.slice(2));

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const minNode = [20, 19, 0];

function printHelp() {
  console.log(`
CloudAgent local setup

Usage:
  npm run setup:local
  npm run setup:local -- --no-launch
  npm run setup:local -- --skip-install

Options:
  --no-launch     Install dependencies but do not start Electron.
  --skip-install  Start Electron without running npm install first.
  --help          Show this help text.
`);
}

function parseNodeVersion(version) {
  return version
    .replace(/^v/, '')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
}

function isNodeSupported(version) {
  const parsed = parseNodeVersion(version);
  for (let index = 0; index < minNode.length; index += 1) {
    if (parsed[index] > minNode[index]) return true;
    if (parsed[index] < minNode[index]) return false;
  }
  return true;
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    console.error(`\nFailed to run ${command}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

if (args.has('--help') || args.has('-h')) {
  printHelp();
  process.exit(0);
}

if (!existsSync(path.join(repoRoot, 'package.json'))) {
  console.error('CloudAgent setup must be run from a checked-out repository.');
  process.exit(1);
}

if (!isNodeSupported(process.version)) {
  console.error(
    `CloudAgent requires Node.js >= ${minNode.join('.')}. Current version: ${process.version}`
  );
  process.exit(1);
}

console.log('CloudAgent local setup');
console.log(`Repository: ${repoRoot}`);

if (!args.has('--skip-install')) {
  console.log('\nInstalling npm dependencies...');
  run(npmCommand, ['install']);
}

if (args.has('--no-launch')) {
  console.log('\nSetup complete. Start CloudAgent with: npm run electron:local:build');
  process.exit(0);
}

console.log('\nBuilding the desktop UI and starting CloudAgent...');
run(npmCommand, ['run', 'electron:local:build']);
