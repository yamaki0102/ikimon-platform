import ts from 'typescript';

export function parseJsonc(text) {
  const result = ts.parseConfigFileTextToJson('config.jsonc', String(text));
  if (result.error) throw new SyntaxError(ts.flattenDiagnosticMessageText(result.error.messageText, '\n'));
  return result.config;
}
