import * as vscode from 'vscode';

/**
 * Creates and manages the gitm8 status bar button group.
 * All buttons sit in the bottom-right of the status bar.
 */
export class StatusBarManager {
  private goItem: vscode.StatusBarItem;
  private pullItem: vscode.StatusBarItem;
  private branchItem: vscode.StatusBarItem;
  private publishItem: vscode.StatusBarItem;
  private disposable: vscode.Disposable[] = [];

  constructor() {
    // ── Go button ──
    this.goItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.goItem.text = '$(debug-start) Go';
    this.goItem.tooltip = 'gitm8: Run pipeline (add → commit → push)';
    this.goItem.command = 'gitm8.go';
    this.goItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');

    // ── Pull button ──
    this.pullItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      99
    );
    this.pullItem.text = '$(arrow-down) Pull';
    this.pullItem.tooltip = 'git pull current branch';
    this.pullItem.command = 'gitm8.pull';

    // ── Branch button ──
    this.branchItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      98
    );
    this.branchItem.text = '$(git-branch) Branch';
    this.branchItem.tooltip = 'gitm8: Create a new branch from a base';
    this.branchItem.command = 'gitm8.createBranch';

    // ── Publish button ──
    this.publishItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      97
    );
    this.publishItem.text = '$(cloud-upload) Publish';
    this.publishItem.tooltip = 'gitm8: Push branch + create PR';
    this.publishItem.command = 'gitm8.publish';

    // Track disposables
    this.disposable.push(this.goItem, this.pullItem, this.branchItem, this.publishItem);
  }

  /**
   * Show all status bar items.
   */
  show(): void {
    this.goItem.show();
    this.pullItem.show();
    this.branchItem.show();
    this.publishItem.show();
  }

  /**
   * Hide all status bar items.
   */
  hide(): void {
    this.goItem.hide();
    this.pullItem.hide();
    this.branchItem.hide();
    this.publishItem.hide();
  }

  /**
   * Enable/disable all buttons (e.g. when not in a git repo).
   */
  setEnabled(enabled: boolean): void {
    const color = enabled ? undefined : new vscode.ThemeColor('statusBarItem.disabledForeground');
    this.goItem.color = color;
    this.pullItem.color = color;
    this.branchItem.color = color;
    this.publishItem.color = color;
  }

  /**
   * Show a spinning indicator on the Go button during pipeline run.
   */
  setGoRunning(running: boolean): void {
    this.goItem.text = running
      ? '$(sync~spin) Go'
      : '$(debug-start) Go';
  }

  /**
   * Dispose all status bar items.
   */
  dispose(): void {
    for (const item of this.disposable) {
      item.dispose();
    }
  }
}
