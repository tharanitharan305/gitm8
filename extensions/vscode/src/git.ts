import * as vscode from 'vscode';

/**
 * Execute a git command and return stdout.
 * Uses the git path from VS Code settings.
 */
export async function execGit(args: string[]): Promise<string> {
  const gitPath = vscode.workspace.getConfiguration('gitm8').get<string>('gitPath', 'git');
  return new Promise<string>((resolve, reject) => {
    const cp = require('child_process') as typeof import('child_process');
    const child = cp.spawn(gitPath, args, {
      cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    child.on('close', (code: number) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `git exited with code ${code}`));
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn git: ${err.message}`));
    });
  });
}

/**
 * Execute a git command synchronously (for simple checks).
 */
export function execGitSync(args: string[]): string {
  const gitPath = vscode.workspace.getConfiguration('gitm8').get<string>('gitPath', 'git');
  const cp = require('child_process') as typeof import('child_process');
  const result = cp.spawnSync(gitPath, args, {
    cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status === 0) {
    return result.stdout.toString().trim();
  }
  throw new Error(result.stderr.toString().trim() || `git exited with code ${result.status}`);
}

/**
 * Check if we're inside a git repository.
 */
export async function isInRepo(): Promise<boolean> {
  try {
    await execGit(['rev-parse', '--git-dir']);
    return true;
  } catch {
    return false;
  }
}
