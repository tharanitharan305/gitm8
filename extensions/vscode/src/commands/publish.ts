import * as vscode from 'vscode';
import { gitm8Terminal } from '../terminal';
import { execGit } from '../git';

/**
 * Publish the current branch:
 * - If no upstream: `git push -u origin <branch>`
 * - If upstream exists: `git push`
 * - Offer to create a PR via `gh` CLI
 */
export async function publishBranch(): Promise<void> {
  try {
    const currentBranch = await execGit(['rev-parse', '--abbrev-ref', 'HEAD']);
    const branch = currentBranch.trim();
    if (!branch || branch === 'HEAD') {
      vscode.window.showErrorMessage('gitm8: Not on any branch.');
      return;
    }

    // Check if upstream exists
    let hasUpstream = false;
    try {
      await execGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
      hasUpstream = true;
    } catch {
      hasUpstream = false;
    }

    // Push
    if (hasUpstream) {
      gitm8Terminal.sendCommand('git push');
    } else {
      gitm8Terminal.sendCommand(`git push -u origin "${branch}"`);
    }

    vscode.window.setStatusBarMessage('$(cloud-upload) gitm8: Publishing...', 3000);

    // ── Offer PR creation ──
    // Check if gh CLI is available
    const ghAvailable = await isGhAvailable();
    if (ghAvailable) {
      const prAction = '$(git-pull-request) Create PR';
      const result = await vscode.window.showInformationMessage(
        `Branch "${branch}" publishing. Create a pull request?`,
        prAction
      );

      if (result === prAction) {
        gitm8Terminal.sendCommand(
          `gh pr create --fill --assignee @me`
        );
      }
    }
  } catch (err) {
    vscode.window.showErrorMessage(
      `gitm8: Publish failed — ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Check if the GitHub CLI (`gh`) is installed.
 */
async function isGhAvailable(): Promise<boolean> {
  try {
    const cp = require('child_process') as typeof import('child_process');
    const result = cp.spawnSync(
      process.platform === 'win32' ? 'where' : 'which',
      ['gh'],
      { stdio: 'pipe' }
    );
    return result.status === 0;
  } catch {
    return false;
  }
}
