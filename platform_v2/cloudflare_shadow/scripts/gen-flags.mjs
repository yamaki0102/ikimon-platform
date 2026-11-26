import { readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { parseJsonc } from './read-jsonc.mjs';

const configs = ['wrangler.jsonc'];
const allScopes = ['wrangler.jsonc:vars', 'wrangler.jsonc:env.shadow.vars', 'wrangler.jsonc:env.staging.vars', 'wrangler.jsonc:env.production.vars'];
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

export async function generateFlags({ root = process.cwd(), check = false } = {}) {
  const directory = join(root, 'src/flags');
  const files = (await readdir(directory)).filter(file => file.endsWith('.ts') && file !== 'index.generated.ts').sort(compare);
  const definitions = [];
  for (const file of files) {
    const entry = await import(pathToFileURL(join(directory, file)).href);
    for (const key of ['flag', 'feature', 'lane', 'path']) {
      if (typeof entry[key] !== 'string' || !entry[key] || /[|\r\n]/u.test(entry[key])) throw new Error(`${file}: invalid ${key}`);
    }
    if (entry.flag !== basename(file, '.ts') || !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(entry.flag)) throw new Error(`${file}: flag must match filename`);
    for (const key of ['staging', 'production']) if (typeof entry[key] !== 'boolean') throw new Error(`${file}: invalid ${key}`);
    const scopes = entry.scopes ?? allScopes;
    if (!Array.isArray(scopes) || !scopes.length || new Set(scopes).size !== scopes.length || scopes.some(scope => !allScopes.includes(scope))) throw new Error(`${file}: invalid scopes`);
    definitions.push({ ...entry, scopes });
  }
  definitions.sort((a, b) => compare(a.flag, b.flag));
  if (new Set(definitions.map(entry => entry.flag)).size !== definitions.length) throw new Error('Flag definitions must be unique');
  const names = new Set(definitions.map(entry => entry.flag));
  const generated = new Map();
  const imports = definitions.map((entry, index) => `import * as flag${index} from "./${entry.flag}";\n`).join('');
  generated.set('src/flags/index.generated.ts', `${imports}${imports ? '\n' : ''}export const FLAG_DEFINITIONS = [\n${definitions.map((entry, index) => `  { ...flag${index}, scopes: ${JSON.stringify(entry.scopes)} },\n`).join('')}] as const;\n\nexport const PROTOTYPE_FLAGS = [\n${definitions.map((entry, index) => `  { flag: flag${index}.flag, feature: flag${index}.feature, lane: flag${index}.lane, path: flag${index}.path${entry.staging ? "" : `, stagingEnabled: flag${index}.staging`} },\n`).join('')}] as const;\n`);
  for (const file of configs) {
    const path = file;
    const source = await readFile(join(root, path), 'utf8');
    parseJsonc(source);
    const ast = ts.parseJsonText(file, source);
    const changes = [];
    const visit = (node, parents = []) => {
      if (!ts.isObjectLiteralExpression(node)) return;
      for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property) || !ts.isStringLiteral(property.name)) continue;
        const keys = [...parents, property.name.text];
        if (property.name.text === 'vars' && (keys.length === 1 || (keys.length === 3 && keys[0] === 'env'))) {
          const start = property.initializer.getStart(ast), end = property.initializer.end;
          const body = source.slice(start, end);
          const matches = [...body.matchAll(/^([ \t]*)\/\/ BEGIN GENERATED FLAGS\r?\n[\s\S]*?^\1\/\/ END GENERATED FLAGS/gmu)];
          if (matches.length !== 1) throw new Error(`${path}:${keys.join('.')}: expected one generated block`);
          const match = matches[0], indent = match[1], newline = source.includes('\r\n') ? '\r\n' : '\n';
          const outside = body.slice(0, match.index) + body.slice(match.index + match[0].length);
          const outsideVars = parseJsonc(outside);
          for (const flag of names) if (Object.hasOwn(outsideVars, flag)) throw new Error(`${path}:${keys.join('.')}: ${flag} outside generated block`);
          const scope = `${file}:${keys.join('.')}`;
          const environment = keys[1] === 'production' ? 'production' : 'staging';
          const rows = definitions.filter(entry => entry.scopes.includes(scope) && entry[environment]).map(entry => `${indent}${JSON.stringify(entry.flag)}: "true",`);
          if (!Object.keys(outsideVars).length && rows.length) rows[rows.length - 1] = rows.at(-1).slice(0, -1);
          const replacement = [`${indent}// BEGIN GENERATED FLAGS`, ...rows, `${indent}// END GENERATED FLAGS`].join(newline);
          changes.push({ start: start + match.index, end: start + match.index + match[0].length, replacement });
        } else visit(property.initializer, keys);
      }
    };
    visit(ast.statements[0].expression);
    if (!changes.length) throw new Error(`${path}: missing vars`);
    let result = source;
    for (const change of changes.sort((a, b) => b.start - a.start)) result = result.slice(0, change.start) + change.replacement + result.slice(change.end);
    parseJsonc(result);
    generated.set(path, result);
  }
  const docPath = 'docs/PROTOTYPE_FLAGS.md';
  const doc = await readFile(join(root, docPath), 'utf8');
  const marker = /(?<=<!-- BEGIN GENERATED FLAGS -->\r?\n)[\s\S]*?(?=<!-- END GENERATED FLAGS -->)/gu;
  if ([...doc.matchAll(marker)].length !== 1) throw new Error(`${docPath}: expected one generated block`);
  const table = '| flag | feature | owner lane | staging URL path |\n|---|---|---|---|\n' + definitions.map(({ flag, feature, lane, path }) => `| ${flag} | ${feature} | ${lane} | ${path} |\n`).join('');
  generated.set(docPath, doc.replace(marker, () => table));
  const stale = [];
  for (const [path, content] of generated) {
    const existing = await readFile(join(root, path), 'utf8').catch(error => { if (error.code !== 'ENOENT') throw error; return null; });
    if (content !== existing) stale.push(path);
  }
  if (check && stale.length) throw new Error(`Stale generated flags:\n${stale.join('\n')}`);
  if (!check) for (const path of stale) await writeFile(join(root, path), generated.get(path));
  return stale;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.slice(2).some(arg => arg !== '--check')) throw new Error('Unsupported argument');
    await generateFlags({ check: process.argv.includes('--check') });
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
