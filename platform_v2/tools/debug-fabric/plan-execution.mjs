#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { planExecution } from './lib/execution-policy.mjs';

const args = parse(process.argv.slice(2));
if (args.help || !args.input) {
  console.log('Usage: node plan-execution.mjs --input <request.json> [--out <plan.json>]');
  process.exitCode = args.help ? 0 : 2;
} else {
  try {
    const request = JSON.parse(await readFile(path.resolve(args.input), 'utf8'));
    const plan = planExecution(request);
    const body = `${JSON.stringify(plan, null, 2)}\n`;
    if (args.out) await writeFile(path.resolve(args.out), body, { mode: 0o600, flag: 'wx' });
    process.stdout.write(body);
    process.exitCode = plan.status === 'READY' ? 0 : 20;
  } catch {
    console.error('ERROR: invalid debug execution request');
    process.exitCode = 2;
  }
}

function parse(argv) {
  const out = { input: null, out: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--input') out.input = argv[++i] ?? null;
    else if (argv[i] === '--out') out.out = argv[++i] ?? null;
    else if (argv[i] === '--help' || argv[i] === '-h') out.help = true;
    else throw new Error('unsupported argument');
  }
  return out;
}
