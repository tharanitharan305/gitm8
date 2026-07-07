/**
 * Creates and manages the gitm8 status bar button group.
 * All buttons sit in the bottom-right of the status bar.
 */
export declare class StatusBarManager {
    private goItem;
    private pullItem;
    private branchItem;
    private publishItem;
    private disposable;
    constructor();
    /**
     * Show all status bar items.
     */
    show(): void;
    /**
     * Hide all status bar items.
     */
    hide(): void;
    /**
     * Enable/disable all buttons (e.g. when not in a git repo).
     */
    setEnabled(enabled: boolean): void;
    /**
     * Show a spinning indicator on the Go button during pipeline run.
     */
    setGoRunning(running: boolean): void;
    /**
     * Dispose all status bar items.
     */
    dispose(): void;
}
//# sourceMappingURL=statusBar.d.ts.map