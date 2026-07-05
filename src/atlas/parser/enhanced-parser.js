import { readFileSync } from 'fs';
import { extname } from 'path';
import { parseFile, discoverFiles } from '../../core/viz-parser.js';
import { detectRoutes } from './routes.js';

/**
 * @typedef {Object} EnhancedParseResult
 * @property {string} path - Relative file path
 * @property {string} language - Language identifier
 * @property {number} lines - Total line count
 * @property {number} size - File size in bytes
 * @property {Array} classes - Classes from viz-parser
 * @property {Array} functions - Functions from viz-parser
 * @property {Array} calls - Calls from viz-parser
 * @property {Array} routes - Detected API routes
 * @property {Array} imports - Extracted import statements
 */

/**
 * Parse a file using viz-parser, then add enhanced detections.
 *
 * @param {string} filePath - Absolute file path
 * @param {string} rootDir - Repository root
 * @returns {EnhancedParseResult|null}
 */
export function parseFileEnhanced(filePath, rootDir) {
  // Check extension first — fast reject
  const ext = extname(filePath).toLowerCase();
  const supported = ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts', '.py', '.java', '.dart'];
  if (!supported.includes(ext)) return null;

  let content;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }

  // Use viz-parser for class/method/function/call extraction
  const baseResult = parseFile(filePath, rootDir);

  const lines = content.split('\n').length;
  const size = Buffer.byteLength(content, 'utf-8');

  // Extract imports (all languages)
  const imports = extractImports(content, ext);

  // Extract routes
  const relPath = baseResult ? baseResult.path : getRelativePath(filePath, rootDir);
  const routes = detectRoutes(content, relPath);

  // If viz-parser returned nothing useful, still return file metadata + imports
  if (!baseResult) {
    if (imports.length === 0 && routes.length === 0) return null;

    return {
      path: relPath,
      language: getLanguage(ext),
      lines,
      size,
      classes: [],
      functions: [],
      calls: [],
      routes,
      imports,
    };
  }

  return {
    ...baseResult,
    lines,
    size,
    routes,
    imports,
  };
}

/**
 * Extract import/require statements from file content.
 *
 * @param {string} content
 * @param {string} ext - File extension (lowercase)
 * @returns {Array<{raw: string, line: number}>}
 */
function extractImports(content, ext) {
  const imports = [];
  const lines = content.split('\n');
  const lang = getLanguage(ext);

  let pattern;
  if (['js', 'jsx', 'ts', 'tsx'].includes(lang)) {
    pattern = /(?:import\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g;
  } else if (lang === 'dart') {
    pattern = /import\s+(?:\w+\s+)?['"]([^'"]+)['"]/g;
  } else if (lang === 'py') {
    pattern = /(?:import\s+(\w+)|from\s+(\w+(?:\.\w+)*)\s+import)/g;
  } else if (lang === 'java') {
    pattern = /import\s+([\w.*]+);/g;
  } else {
    return imports;
  }

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    let match;
    pattern.lastIndex = 0;

    while ((match = pattern.exec(trimmed)) !== null) {
      const raw = match[1] || match[2] || match[3] || '';
      if (raw && !raw.startsWith('node:') && !raw.startsWith('dart:')) {
        imports.push({ raw, line: i + 1 });
      }
    }
  }

  return imports;
}

/**
 * Get language identifier from file extension.
 *
 * @param {string} ext
 * @returns {string}
 */
function getLanguage(ext) {
  const map = {
    '.js': 'js', '.jsx': 'jsx', '.mjs': 'js', '.cjs': 'js',
    '.ts': 'ts', '.tsx': 'tsx', '.mts': 'ts', '.cts': 'ts',
    '.py': 'py',
    '.java': 'java',
    '.dart': 'dart',
  };
  return map[ext] || 'unknown';
}

/**
 * Get relative path from absolute path.
 *
 * @param {string} filePath
 * @param {string} rootDir
 * @returns {string}
 */
function getRelativePath(filePath, rootDir) {
  const rel = filePath.replace(rootDir, '').replace(/^[/\\]/, '');
  return rel.replace(/\\/g, '/');
}

export { discoverFiles };
