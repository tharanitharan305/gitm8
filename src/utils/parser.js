import { execa } from 'execa';
import { existsSync, statSync, readFileSync } from 'fs';
import { resolve, extname } from 'path';

/**
 * Parsed result of a `<file[:line]>` argument.
 *
 * @typedef {Object} ParsedFileLine
 * @property {string} raw - Original input string
 * @property {string} filePath - Resolved absolute file path
 * @property {string} relativePath - Path relative to repo root
 * @property {number|null} line - Line number, or null
 * @property {boolean} isRepoRoot - True if input was '.'
 */

/**
 * Parse a `file[:line]` input string.
 *
 * @param {string} input - e.g. "src/auth.ts:128" or "src/auth.ts" or "."
 * @returns {ParsedFileLine}
 */
export function parseFileLine(input) {
  const raw = input.trim();

  // Repo root case
  if (raw === '.') {
    return {
      raw,
      filePath: process.cwd(),
      relativePath: '.',
      line: null,
      isRepoRoot: true,
    };
  }

  // Check for file:line pattern
  const colonIndex = raw.lastIndexOf(':');
  let filePart = raw;
  let linePart = null;

  if (colonIndex >= 0) {
    const possibleLine = raw.slice(colonIndex + 1);
    const possibleFile = raw.slice(0, colonIndex);

    // Only treat as line number if the part after colon is a number
    // and the part before colon looks like a file path
    if (/^\d+$/.test(possibleLine) && possibleFile.length > 0) {
      filePart = possibleFile;
      linePart = parseInt(possibleLine, 10);
    }
  }

  return {
    raw,
    filePath: resolve(process.cwd(), filePart),
    relativePath: filePart,
    line: linePart,
    isRepoRoot: false,
  };
}

/**
 * Validate that a file exists and is tracked by git.
 * Returns an array of error messages (empty if valid).
 *
 * @param {ParsedFileLine} parsed
 * @returns {Promise<string[]>}
 */
export async function validateFile(parsed) {
  const errors = [];

  // Check if git exists
  try {
    await execa('git', ['--version'], { timeout: 5000 });
  } catch {
    errors.push('Git is not installed or not in PATH.');
    return errors;
  }

  // Check if in a git repo
  try {
    await execa('git', ['rev-parse', '--git-dir'], { timeout: 5000 });
  } catch {
    errors.push('Not a Git repository.');
    return errors;
  }

  if (parsed.isRepoRoot) {
    return errors; // '.' is always valid
  }

  // Check file exists
  if (!existsSync(parsed.filePath)) {
    errors.push(`File not found: ${parsed.relativePath}`);
    return errors; // Early return — no point checking further
  }

  // Check it's a file (not a directory)
  try {
    const stats = statSync(parsed.filePath);
    if (!stats.isFile()) {
      errors.push(`Not a file: ${parsed.relativePath}`);
      return errors;
    }
  } catch {
    errors.push(`Cannot access: ${parsed.relativePath}`);
    return errors;
  }

  // Check it's not a binary file
  if (isBinaryFile(parsed.filePath)) {
    errors.push(`Cannot analyze binary file: ${parsed.relativePath}`);
    return errors;
  }

  // Check it's tracked by git
  try {
    const { stdout } = await execa('git', [
      'ls-files', '--error-unmatch', parsed.filePath,
    ], { timeout: 5000 });
    if (!stdout.trim()) {
      errors.push(`File is not tracked by Git: ${parsed.relativePath}`);
    }
  } catch {
    errors.push(`File is not tracked by Git: ${parsed.relativePath}`);
  }

  // Validate line number if specified
  if (parsed.line !== null) {
    if (parsed.line < 1) {
      errors.push(`Invalid line number: ${parsed.line}. Line numbers start at 1.`);
    } else {
      try {
        const content = readFileSync(parsed.filePath, 'utf-8');
        const lineCount = content.split('\n').length;
        if (parsed.line > lineCount) {
          errors.push(`Line ${parsed.line} exceeds file length (${lineCount} lines).`);
        }
      } catch {
        errors.push(`Cannot validate line number for: ${parsed.relativePath}`);
      }
    }
  }

  return errors;
}

/**
 * Detect if a file is likely binary.
 *
 * @param {string} filePath
 * @returns {boolean}
 */
export function isBinaryFile(filePath) {
  const ext = extname(filePath).toLowerCase();

  // Known binary extensions
  const binaryExts = [
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.zip', '.tar', '.gz', '.rar', '.7z',
    '.exe', '.dll', '.so', '.dylib', '.bin',
    '.mp3', '.mp4', '.avi', '.mov', '.wav', '.flac',
    '.ttf', '.otf', '.woff', '.woff2', '.eot',
    '.o', '.a', '.lib', '.obj',
    '.pyc', '.pyo',
    '.class', '.jar',
    '.keystore', '.jks',
    '.pem', '.key', '.pub',
  ];

  if (binaryExts.includes(ext)) return true;

  // Check for null bytes (binary content heuristic)
  try {
    const buffer = readFileSync(filePath);
    const nullByte = buffer.indexOf(0);
    return nullByte >= 0 && nullByte < 1024; // null byte in first 1KB
  } catch {
    return false;
  }
}

/**
 * Get the repo root directory as a string.
 *
 * @returns {Promise<string>}
 */
export async function getRepoRoot() {
  const { stdout } = await execa('git', ['rev-parse', '--show-toplevel'], { timeout: 5000 });
  return stdout.trim();
}

/**
 * Check if the git repo is empty (no commits).
 *
 * @returns {Promise<boolean>}
 */
export async function isRepoEmpty() {
  try {
    const { stdout } = await execa('git', ['rev-list', '--count', 'HEAD'], { timeout: 5000 });
    return parseInt(stdout.trim(), 10) === 0;
  } catch {
    return true;
  }
}

/**
 * Check if HEAD is detached.
 *
 * @returns {Promise<boolean>}
 */
export async function isDetachedHead() {
  try {
    const { stdout } = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { timeout: 5000 });
    return stdout.trim() === 'HEAD';
  } catch {
    return true;
  }
}

/**
 * Check if this is a shallow clone.
 *
 * @returns {Promise<boolean>}
 */
export async function isShallowClone() {
  try {
    const { stdout } = await execa('git', ['rev-parse', '--is-shallow-repository'], { timeout: 5000 });
    return stdout.trim() === 'true';
  } catch {
    return false;
  }
}
