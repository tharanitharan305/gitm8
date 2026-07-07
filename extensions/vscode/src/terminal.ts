import * as vscode from 'vscode';

/**
 * Manager for the dedicated "gitm8" terminal instance.
 * Creates one terminal and reuses it across commands to
 * preserve output history and avoid tab explosion.
 */
class Gitm8TerminalManager {
  private terminal: vscode.Terminal | undefined;
  private readonly name = 'gitm8';

  /**
   * Send a command to the gitm8 terminal.
   * Shows the terminal so the user sees what's happening.
   */
  sendCommand(cmd: string): void {
    // Create terminal if it doesn't exist or was closed
    if (!this.terminal || this.terminal.exitStatus !== undefined) {
      this.terminal = vscode.window.createTerminal(this.name);
    }

    this.terminal.show();
    this.terminal.sendText(cmd);
  }

  /**
   * Get the terminal instance (for advanced use).
   */
  getTerminal(): vscode.Terminal | undefined {
    return this.terminal;
  }

  /**
   * Dispose of the terminal.
   */
  dispose(): void {
    if (this.terminal && this.terminal.exitStatus === undefined) {
      this.terminal.dispose();
    }
    this.terminal = undefined;
  }
}

export const gitm8Terminal = new Gitm8TerminalManager();
