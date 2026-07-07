import * as vscode from 'vscode';
import * as path from 'path';

let _isAvailable: boolean | undefined = undefined;
let _gitm8Path: string | undefined = undefined;

/**
 * Check if gitm8 CLI is installed and available in PATH.
 * Caches the result for the session.
 */
export async function isGitm8Available(): Promise<boolean> {
  if (_isAvailable !== undefined) return _isAvailable;

  try {
    const result = await findGitm8();
    _isAvailable = result.found;
    _gitm8Path = result.path;
    return _isAvailable;
  } catch {
    _isAvailable = false;
    _gitm8Path = undefined;
    return false;
  }
}

/**
 * Get the path to the gitm8 binary (if found).
 */
export function getGitm8Path(): string | undefined {
  return _gitm8Path;
}

/**
 * Prompt the user to install gitm8 if it's not found.
 * Returns true if the user chose to install (or already has it).
 */
export async function ensureGitm8(): Promise<boolean> {
  const available = await isGitm8Available();
  if (available) return true;

  const action = await vscode.window.showErrorMessage(
    'gitm8 CLI is not installed. Install it to use the gitm8 extension.',
    'Install gitm8',
    'Learn More'
  );

  if (action === 'Install gitm8') {
    const terminal = vscode.window.createTerminal('gitm8-install');
    terminal.show();
    terminal.sendText('npm install -g gitm8');
    vscode.window.showInformationMessage(
      'Installing gitm8 globally... Close this terminal and reload VS Code when done.'
    );
    return false; // They chose to install, but it's not ready yet
  }

  if (action === 'Learn More') {
    vscode.env.openExternal(
      vscode.Uri.parse('https://www.npmjs.com/package/gitm8')
    );
  }

  return false;
}

/**
 * Refresh the cached availability (e.g. after installation).
 */
export function refreshCache(): void {
  _isAvailable = undefined;
  _gitm8Path = undefined;
}

// ── Helpers ──

interface FindResult {
  found: boolean;
  path?: string;
}

async function findGitm8(): Promise<FindResult> {
  // On Windows, check common locations + PATH
  // On macOS/Linux, check PATH
  const isWin = process.platform === 'win32';
  const cmd = isWin ? 'where' : 'which';

  try {
    const execResult = await execCommand(cmd, ['gitm8']);
    if (execResult.code === 0 && execResult.stdout.trim()) {
      const gitm8Path = execResult.stdout.trim().split('\n')[0].trim();
      return { found: true, path: gitm8Path };
    }
  } catch {
    // Not found via 'which'/'where'
  }

  // Fallback: check common npm global installation paths
  const commonPaths = isWin
    ? [
        path.join(process.env.APPDATA || '', 'npm', 'gitm8.cmd'),
        path.join(process.env.LOCALAPPDATA || '', 'npm', 'gitm8.cmd'),
      ]
    : [
        '/usr/local/bin/gitm8',
        '/usr/bin/gitm8',
        path.join(process.env.HOME || '', '.npm-global/bin/gitm8'),
        path.join(process.env.HOME || '', '.nvm/versions/node/*/bin/gitm8'),
      ];

  for (const p of commonPaths) {
    try {
      const stat = await vscode.workspace.fs.stat(vscode.Uri.file(p));
      if (stat) {
        return { found: true, path: p };
      }
    } catch {
      // File doesn't exist at this path — try next
    }
  }

  return { found: false };
}

/**
 * Simple exec helper using VS Code's child_process. We avoid importing execa
 * to keep the extension dependency-free.
 */
function execCommand(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const cp = require('child_process') as typeof import('child_process');
    const child = cp.spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    child.on('close', (code: number) => {
      resolve({ stdout, stderr, code });
    });

    child.on('error', () => {
      resolve({ stdout: '', stderr: 'spawn failed', code: -1 });
    });
  });
}
