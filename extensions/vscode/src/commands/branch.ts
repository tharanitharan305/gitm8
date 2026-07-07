import * as vscode from 'vscode';
import { gitm8Terminal } from '../terminal';
import { execGit } from '../git';

interface BranchItem {
  label: string;
  description: string;
  ref: string;
  isRemote: boolean;
}

/**
 * Interactive branch creation:
 * 1. Pick the base branch (from)
 * 2. Enter the new branch name
 * 3. Checkout the new branch
 * 4. Optionally publish immediately
 */
export async function createBranch(): Promise<void> {
  try {
    // ── Step 1: Get branches ──
    const currentBranch = await getCurrentBranch();

    const [localBranches, remoteBranches] = await Promise.all([
      getLocalBranches(),
      getRemoteBranches(),
    ]);

    // Build QuickPick items
    const baseItems: BranchItem[] = [
      // Current branch first
      {
        label: `$(git-branch) ${currentBranch}`,
        description: 'current branch',
        ref: currentBranch,
        isRemote: false,
      },
      // Main/master as top suggestions
      ...['main', 'master']
        .filter((b) => b !== currentBranch && localBranches.includes(b))
        .map((b) => ({
          label: `$(git-branch) ${b}`,
          description: '',
          ref: b,
          isRemote: false,
        })),
      // Separator
    ];

    // Other local branches
    for (const b of localBranches) {
      if (b === currentBranch || b === 'main' || b === 'master') continue;
      baseItems.push({
        label: `$(git-branch) ${b}`,
        description: 'local',
        ref: b,
        isRemote: false,
      });
    }

    // Remote branches
    for (const b of remoteBranches) {
      // Don't add duplicates of local branches
      if (localBranches.includes(b.replace(/^origin\//, ''))) continue;
      baseItems.push({
        label: `$(remote) ${b}`,
        description: 'remote',
        ref: b,
        isRemote: true,
      });
    }

    // ── Step 2: Pick base branch ──
    const picked = await vscode.window.showQuickPick(baseItems, {
      title: 'Create Branch — pick the base branch',
      placeHolder: `Current: ${currentBranch}`,
      matchOnDescription: true,
    });

    if (!picked) return; // User cancelled

    const baseRef = picked.ref;

    // ── Step 3: Enter new branch name ──
    const newName = await vscode.window.showInputBox({
      title: `Create Branch from "${baseRef}"`,
      prompt: 'Enter the new branch name (lowercase, hyphens allowed)',
      placeHolder: 'e.g. feat/add-login',
      validateInput: (value) => {
        if (!value.trim()) return 'Branch name cannot be empty';
        if (/[~^:?*[\\\s]/.test(value)) return 'Branch name contains invalid characters';
        if (value.length > 255) return 'Branch name is too long (max 255 chars)';
        return null;
      },
    });

    if (!newName || !newName.trim()) return; // User cancelled

    // ── Step 4: Create and checkout ──
    const branchCmd = `git checkout -b "${newName.trim()}" "${baseRef}"`;
    gitm8Terminal.sendCommand(branchCmd);

    // ── Step 5: Offer to publish ──
    const publishAction = '$(cloud-upload) Push branch';
    const result = await vscode.window.showInformationMessage(
      `Branch "${newName.trim()}" created from "${baseRef}". Push it now?`,
      publishAction
    );

    if (result === publishAction) {
      // Small delay to let the checkout finish
      setTimeout(() => {
        gitm8Terminal.sendCommand(`git push -u origin "${newName.trim()}"`);
      }, 500);
    }
  } catch (err) {
    vscode.window.showErrorMessage(
      `gitm8: Branch creation failed — ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

// ── Git helpers ──

async function getCurrentBranch(): Promise<string> {
  const result = await execGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  return result.trim() || 'main';
}

async function getLocalBranches(): Promise<string[]> {
  const result = await execGit(['branch', '--format=%(refname:short)']);
  return result
    .split('\n')
    .map((b) => b.trim())
    .filter((b) => b.length > 0 && !b.startsWith('*'));
}

async function getRemoteBranches(): Promise<string[]> {
  try {
    const result = await execGit(['branch', '-r', '--format=%(refname:short)']);
    return result
      .split('\n')
      .map((b) => b.trim())
      .filter((b) => b.length > 0 && !b.includes('->'));
  } catch {
    return [];
  }
}
