import yaml from 'js-yaml';

export type YamlResult =
  | { valid: true; data: any }
  | { valid: false; error: string; line?: number; column?: number };

export function parseYaml(content: string): YamlResult {
  try {
    const data = yaml.load(content);
    return { valid: true, data };
  } catch (err: any) {
    return {
      valid: false,
      error: cleanYamlError(err.message),
      line: err.mark?.line,
      column: err.mark?.column,
    };
  }
}

function cleanYamlError(message: string) {
  return message
    .replace(/\n/g, ' ')
    .replace(/at line.*$/i, '')
    .trim();
}