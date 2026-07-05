import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, unlinkSync, rmdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

// ── Unit tests for parser ─────────────────────────────────────
import { parseFileLine, isBinaryFile } from '../src/utils/parser.js';

describe('parseFileLine', () => {
  it('parses file path without line', () => {
    const result = parseFileLine('src/index.js');
    assert.equal(result.relativePath, 'src/index.js');
    assert.equal(result.line, null);
    assert.equal(result.isRepoRoot, false);
  });

  it('parses file:line syntax', () => {
    const result = parseFileLine('src/index.js:42');
    assert.equal(result.relativePath, 'src/index.js');
    assert.equal(result.line, 42);
    assert.equal(result.isRepoRoot, false);
  });

  it('parses dot as repo root', () => {
    const result = parseFileLine('.');
    assert.equal(result.isRepoRoot, true);
    assert.equal(result.line, null);
    assert.equal(result.relativePath, '.');
  });

  it('handles colon in path with no trailing number', () => {
    const result = parseFileLine('some:path/file.js');
    assert.equal(result.line, null);
  });

  it('handles empty input', () => {
    const result = parseFileLine('');
    assert.equal(result.line, null);
  });

  it('handles absolute Windows paths with colon', () => {
    const result = parseFileLine('C:/src/index.js');
    assert.equal(result.line, null);
  });
});

describe('isBinaryFile', () => {
  it('detects binary by extension', () => {
    assert.equal(isBinaryFile('image.png'), true);
    assert.equal(isBinaryFile('doc.pdf'), true);
    assert.equal(isBinaryFile('archive.zip'), true);
  });

  it('detects non-binary by extension', () => {
    assert.equal(isBinaryFile('file.js'), false);
    assert.equal(isBinaryFile('file.ts'), false);
    assert.equal(isBinaryFile('file.py'), false);
    assert.equal(isBinaryFile('file.md'), false);
  });

  it('handles uppercase extensions', () => {
    assert.equal(isBinaryFile('image.PNG'), true);
    assert.equal(isBinaryFile('image.JPG'), true);
  });
});

// ── Unit tests for formatter ──────────────────────────────────
import { formatRelativeDate, formatTimestamp } from '../src/utils/formatter.js';

describe('formatRelativeDate', () => {
  it('returns "N/A" for null/empty', () => {
    assert.equal(formatRelativeDate(null), 'N/A');
    assert.equal(formatRelativeDate(''), 'N/A');
  });

  it('formats "moments ago" for current timestamp', () => {
    const now = Math.floor(Date.now() / 1000);
    assert.equal(formatRelativeDate(String(now)), 'moments ago');
  });
});

describe('formatTimestamp', () => {
  it('returns "N/A" for null/empty', () => {
    assert.equal(formatTimestamp(null), 'N/A');
    assert.equal(formatTimestamp(''), 'N/A');
  });

  it('formats a known timestamp', () => {
    const result = formatTimestamp('1783123200'); // ~July 4, 2026
    assert.ok(result.includes('Jul') || result.includes('2026'));
  });
});

// ── Integration tests (within this repo) ──────────────────────
// Note: execSync returns a Buffer (stdout) directly.
// On error it throws with .stderr and .stdout properties.

describe('who command integration', () => {
  const cliPath = resolve('src/cli.js');
  const repoRoot = process.cwd();

  /** Helper: run a command and return stdout string */
  function run(args) {
    return execSync(`node "${cliPath}" ${args}`, {
      cwd: repoRoot,
      timeout: 30000,
      encoding: 'utf8',
    });
  }

  /** Helper: run a command expecting an error, return combined text */
  function runFail(args) {
    try {
      execSync(`node "${cliPath}" ${args}`, {
        cwd: repoRoot,
        timeout: 15000,
        encoding: 'utf8',
      });
      return null; // no error — unexpected
    } catch (e) {
      const out = typeof e.stdout === 'string' ? e.stdout : '';
      const err = typeof e.stderr === 'string' ? e.stderr : '';
      return out + err;
    }
  }

  // Verify this is a git repo
  before(() => {
    execSync('git rev-parse --git-dir', { cwd: repoRoot });
  });

  it('repo mode shows contributors', () => {
    const stdout = run('who .');
    assert.ok(stdout.includes('Contributors') || stdout.includes('Repository'));
    assert.ok(stdout.includes('commits'));
  });

  it('repo mode --json produces valid JSON', () => {
    const stdout = run('who . --json');
    const data = JSON.parse(stdout);
    assert.ok(Array.isArray(data.contributors));
    assert.ok(Array.isArray(data.topFiles));
    assert.ok(Array.isArray(data.recentActivity));
  });

  it('file mode shows file ownership', () => {
    const stdout = run('who src/cli.js');
    assert.ok(stdout.includes('Contributors'));
    assert.ok(stdout.includes('%'));
  });

  it('file mode --json produces valid JSON', () => {
    const stdout = run('who src/cli.js --json');
    const data = JSON.parse(stdout);
    assert.ok(data.file);
    assert.ok(Array.isArray(data.contributors));
    assert.ok(typeof data.totalCommits === 'number');
  });

  it('line mode shows blame info', () => {
    const stdout = run('who src/cli.js:1');
    assert.ok(stdout.includes('Author'));
    assert.ok(stdout.includes('Message'));
  });

  it('line mode --json produces valid JSON', () => {
    const stdout = run('who src/cli.js:1 --json');
    const data = JSON.parse(stdout);
    assert.equal(data.line, 1);
    assert.ok(data.blame);
    assert.ok(data.blame.author);
    assert.ok(data.blame.commit);
  });

  it('line mode --json --verbose includes raw metadata', () => {
    const stdout = run('who src/cli.js:1 --json --verbose');
    const data = JSON.parse(stdout);
    assert.ok(data.blame.raw);
    assert.ok(data.blame.raw.authorTz);
  });

  it('rejects nonexistent file', () => {
    const output = runFail('who nonexistent.ts');
    assert.ok(output.includes('not found') || output.includes('File not found'));
  });

  it('rejects invalid line number', () => {
    const output = runFail('who src/cli.js:999999');
    assert.ok(output.includes('exceeds') || output.includes('exceeds file length'));
  });

  it('file mode --stats shows ownership statistics', () => {
    const stdout = run('who src/cli.js --stats');
    assert.ok(stdout.includes('Statistics') || stdout.includes('authors'));
  });

  it('line mode --history shows history section', () => {
    const stdout = run('who src/cli.js:1 --history');
    assert.ok(stdout.includes('History') || stdout.includes('Created'));
  });

  it('error outside git repo', () => {
    const tmpDir = join(tmpdir(), 'gitm8-test-nonrepo-' + Date.now());
    try {
      mkdirSync(tmpDir, { recursive: true });
      const output = runFailFromDir(tmpDir, 'who .');
      assert.ok(output.includes('Not a Git') || output.includes('not inside'));
    } finally {
      try { rmdirSync(tmpDir); } catch (e) { /* ignore */ }
    }
  });
});

/**
 * Run command from a specific directory, expecting failure.
 */
function runFailFromDir(dir, args) {
  const cliPath = resolve('src/cli.js');
  try {
    execSync(`node "${cliPath}" ${args}`, {
      cwd: dir,
      timeout: 15000,
      encoding: 'utf8',
    });
    return null;
  } catch (e) {
    const out = typeof e.stdout === 'string' ? e.stdout : '';
    const err = typeof e.stderr === 'string' ? e.stderr : '';
    return out + err;
  }
}
