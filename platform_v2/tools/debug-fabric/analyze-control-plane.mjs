#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { analyzeControlPlaneRun } from './lib/control-plane.mjs';

const EXIT = Object.freeze({ PASS: 0, FAIL: 10, BLOCKED: 20, UNSAFE: 30 });

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.input) {
  console.log('Usage: node analyze-control-plane.mjs --input <trace.json> [--out <result.json>]');
  process.exitCode = args.help ? 0 : 2;
} else {
  try {
    const raw = JSON.parse(await readFile(path.resolve(args.input), 'utf8'));
    const result = analyzeControlPlaneRun(raw);
    if (args.out) await atomic(path.resolve(args.out), `${JSON.stringify(result, null, 2)}\n`);
    console.log(`status=${result.status}`);
    console.log(`classification=${result.classification}`);
    console.log(`responsible_layer=${result.responsible_layer ?? 'none'}`);
    process.exitCode = EXIT[result.status] ?? 2;
  } catch {
    console.error('ERROR: invalid control-plane trace invocation');
    process.exitCode = 2;
  }
}

function parseArgs(argv) {
  const out = { input: null, out: null, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--input') out.input = argv[++index] ?? null;
    else if (argv[index] === '--out') out.out = argv[++index] ?? null;
    else if (argv[index] === '--help' || argv[index] === '-h') out.help = true;
    else throw new Error('unsupported CLI argument');
  }
  return out;
}

async function atomic(file, content) {
  const temp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  await writeFile(temp, content, { mode: 0o600, flag: 'wx' });
  await rename(temp, file);
}
