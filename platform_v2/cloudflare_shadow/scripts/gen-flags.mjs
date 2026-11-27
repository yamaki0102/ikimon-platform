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
          const object = property.initializer;
          if (!ts.isObjectLiteralExpression(object)) throw new Error(`${path}:${keys.join('.')}: vars must be an object`);
          const newline = source.includes('\r\n') ? '\r\n' : '\n';
          const scope = `${file}:${keys.join('.')}`;
          const environment = keys[1] === 'production' ? 'production' : 'staging';
          const wanted = definitions.filter(entry => entry.scopes.includes(scope) && entry[environment]);
          const kept = object.properties.filter(item => !(item.name && (ts.isStringLiteral(item.name) || ts.isIdentifier(item.name)) && names.has(item.name.text)));
          if (!wanted.length && kept.length === object.properties.length) continue;
          const first = object.properties[0];
          const indent = first ? source.slice(source.lastIndexOf('\n', first.getStart(ast)) + 1, first.getStart(ast)).match(/^[ \t]*/u)[0] : '';
          const closeIndent = source.slice(source.lastIndexOf('\n', object.end - 1) + 1, object.end - 1).match(/^[ \t]*/u)[0];
          const rows = [...wanted.map(entry => `${indent}${JSON.stringify(entry.flag)}: "true"`), ...kept.map(item => `${indent}${source.slice(item.getStart(ast), item.end)}`)];
          const replacement = rows.length ? `{${newline}${rows.join(`,${newline}`)}${newline}${closeIndent}}` : '{}';
          changes.push({ start: object.getStart(ast), end: object.end, replacement });
        } else visit(property.initializer, keys);
      }
    };
    visit(ast.statements[0].expression);
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
