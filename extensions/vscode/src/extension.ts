import * as vscode from 'vscode';
import { StatusBarManager } from './statusBar';
import { ensureGitm8, isGitm8Available, refreshCache } from './gitm8';
import { initSecrets } from './secrets';
import { isInRepo } from './git';
import { runPipeline } from './commands/go';
import { pullCurrentBranch } from './commands/pull';
import { createBranch } from './commands/branch';
import { publishBranch } from './commands/publish';
import { openConfig } from './commands/config';

let statusBar: StatusBarManager | undefined;
let repoWatcher: vscode.Disposable | undefined;
let debounceTimer: NodeJS.Timeout | undefined;

/**
 * Activate the gitm8 extension.
 * Registers status bar buttons, commands, and detects gitm8 availability.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('[gitm8] Activating extension...');
    console.log("🚀 GitM8 Extension Activated");
    vscode.window.showInformationMessage("GitM8 Extension Activated");
  // ── Initialize secrets storage ──
  initSecrets(context);

  // ── Create status bar ──
  statusBar = new StatusBarManager();

  // ── Register commands ──
  const goCmd = vscode.commands.registerCommand('gitm8.go', async () => {
    statusBar?.setGoRunning(true);
    try {
      await runPipeline();
    } finally {
      setTimeout(() => statusBar?.setGoRunning(false), 2000);
    }
  });

  const pullCmd = vscode.commands.registerCommand('gitm8.pull', () => {
    pullCurrentBranch();
  });

  const branchCmd = vscode.commands.registerCommand('gitm8.createBranch', () => {
    createBranch();
  });

  const publishCmd = vscode.commands.registerCommand('gitm8.publish', () => {
    publishBranch();
  });

  const configCmd = vscode.commands.registerCommand('gitm8.openConfig', () => {
    openConfig();
  });

  const refreshCmd = vscode.commands.registerCommand('gitm8.refreshStatus', () => {
    refreshCache();
    updateUI();
  });

  context.subscriptions.push(goCmd, pullCmd, branchCmd, publishCmd, configCmd, refreshCmd);

  // ── Watch for workspace folder changes ──
  repoWatcher = vscode.workspace.onDidChangeWorkspaceFolders(() => {
    debounceUpdate();
  });

  // ── Watch for file system changes that affect repo state ──
  const fileWatcher = vscode.workspace.createFileSystemWatcher('**/.git/HEAD');
  fileWatcher.onDidChange(() => debounceUpdate());
  fileWatcher.onDidCreate(() => debounceUpdate());
  context.subscriptions.push(fileWatcher);

  // ── Also watch for git ref changes ──
  const refWatcher = vscode.workspace.createFileSystemWatcher('**/.git/refs/**');
  refWatcher.onDidChange(() => debounceUpdate());
  context.subscriptions.push(refWatcher);

  // ── Initial UI update ──
  await updateUI();

  // ── Register disposal ──
  context.subscriptions.push({
    dispose: () => {
      statusBar?.dispose();
      repoWatcher?.dispose();
      if (debounceTimer) clearTimeout(debounceTimer);
    },
  });

  console.log('[gitm8] Extension activated.');
}

/**
 * Deactivate the extension.
 */
export function deactivate(): void {
  statusBar?.dispose();
  repoWatcher?.dispose();
  if (debounceTimer) clearTimeout(debounceTimer);
}

// ── UI update logic ──

async function updateUI(): Promise<void> {
  if (!statusBar) return;

  // Check if we're in a git repo
  const inRepo = vscode.workspace.workspaceFolders && (await isInRepo());

  if (!inRepo) {
    statusBar.hide();
    return;
  }

  // Check if gitm8 is available
  const gitm8Available = await isGitm8Available();

  // If gitm8 is not available, show buttons but disabled
  // Still show git operations (pull, branch, publish) even without gitm8
  statusBar.show();

  if (!gitm8Available) {
    statusBar.setEnabled(false);
    // Show install notification once per session
    ensureGitm8();
  } else {
    statusBar.setEnabled(true);
  }
}

function debounceUpdate(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => updateUI(), 500);
}
