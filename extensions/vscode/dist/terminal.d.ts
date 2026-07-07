import * as vscode from 'vscode';
/**
 * Manager for the dedicated "gitm8" terminal instance.
 * Creates one terminal and reuses it across commands to
 * preserve output history and avoid tab explosion.
 */
declare class Gitm8TerminalManager {
    private terminal;
    private readonly name;
    /**
     * Send a command to the gitm8 terminal.
     * Shows the terminal so the user sees what's happening.
     */
    sendCommand(cmd: string): void;
    /**
     * Get the terminal instance (for advanced use).
     */
    getTerminal(): vscode.Terminal | undefined;
    /**
     * Dispose of the terminal.
     */
    dispose(): void;
}
export declare const gitm8Terminal: Gitm8TerminalManager;
export {};
//# sourceMappingURL=terminal.d.ts.map