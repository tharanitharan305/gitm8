import * as vscode from 'vscode';
import { gitm8Terminal } from '../terminal';

/**
 * Git pull the current branch from origin.
 * Runs `git pull` (which pulls the current branch from its upstream).
 */
export async function pullCurrentBranch(): Promise<void> {
  gitm8Terminal.sendCommand('git pull');
  vscode.window.setStatusBarMessage('$(sync~spin) gitm8: Pulling...', 3000);
}
