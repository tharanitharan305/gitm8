import { resolve, dirname, join } from 'path';
import { existsSync, statSync } from 'fs';

/**
 * Resolve imports from a source file to absolute paths.
 * Follows Node.js module resolution (without node_modules lookup).
 *
 * @param {string} raw - Raw import string (e.g. '../services/auth')
 * @param {string} sourceFile - Absolute path of source file
 * @returns {string|null} - Resolved absolute path or null
 */
export function resolveImport(raw, sourceFile) {
  // Only resolve relative imports
  if (!raw.startsWith('.') && !raw.startsWith('/')) return null;

  const sourceDir = dirname(sourceFile);
  const extensions = [
    '', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '/index.ts', '/index.tsx', '/index.js', '/index.jsx',
    '/index.mjs', '/index.cjs',
    '.dart', '/index.dart',
    '.py', '/__init__.py',
    '.java',
  ];

  // Strip file extension from raw if it has one
  const basePath = raw.replace(/\.[a-z0-9]+$/i, '');

  for (const ext of extensions) {
    const candidate = resolve(sourceDir, basePath + ext);
    try {
      if (statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // Not found, try next extension
    }
  }

  return null;
}

/**
 * Resolve an import to a known relative path from repo root.
 *
 * @param {string} raw - Raw import string
 * @param {string} sourceFilePath - Absolute path of source file
 * @param {string} rootDir - Repository root
 * @returns {string|null}
 */
export function resolveImportRelative(raw, sourceFilePath, rootDir) {
  const resolved = resolveImport(raw, sourceFilePath);
  if (!resolved) return null;

  return resolved.replace(rootDir.replace(/\\/g, '/'), '').replace(/^[/\\]/, '').replace(/\\/g, '/');
}
