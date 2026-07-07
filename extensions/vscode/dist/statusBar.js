"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusBarManager = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Creates and manages the gitm8 status bar button group.
 * All buttons sit in the bottom-right of the status bar.
 */
class StatusBarManager {
    goItem;
    pullItem;
    branchItem;
    publishItem;
    disposable = [];
    constructor() {
        // ── Go button ──
        this.goItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.goItem.text = '$(debug-start) Go';
        this.goItem.tooltip = 'gitm8: Run pipeline (add → commit → push)';
        this.goItem.command = 'gitm8.go';
        this.goItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
        // ── Pull button ──
        this.pullItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
        this.pullItem.text = '$(arrow-down) Pull';
        this.pullItem.tooltip = 'git pull current branch';
        this.pullItem.command = 'gitm8.pull';
        // ── Branch button ──
        this.branchItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 98);
        this.branchItem.text = '$(git-branch) Branch';
        this.branchItem.tooltip = 'gitm8: Create a new branch from a base';
        this.branchItem.command = 'gitm8.createBranch';
        // ── Publish button ──
        this.publishItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 97);
        this.publishItem.text = '$(cloud-upload) Publish';
        this.publishItem.tooltip = 'gitm8: Push branch + create PR';
        this.publishItem.command = 'gitm8.publish';
        // Track disposables
        this.disposable.push(this.goItem, this.pullItem, this.branchItem, this.publishItem);
    }
    /**
     * Show all status bar items.
     */
    show() {
        this.goItem.show();
        this.pullItem.show();
        this.branchItem.show();
        this.publishItem.show();
    }
    /**
     * Hide all status bar items.
     */
    hide() {
        this.goItem.hide();
        this.pullItem.hide();
        this.branchItem.hide();
        this.publishItem.hide();
    }
    /**
     * Enable/disable all buttons (e.g. when not in a git repo).
     */
    setEnabled(enabled) {
        const color = enabled ? undefined : new vscode.ThemeColor('statusBarItem.disabledForeground');
        this.goItem.color = color;
        this.pullItem.color = color;
        this.branchItem.color = color;
        this.publishItem.color = color;
    }
    /**
     * Show a spinning indicator on the Go button during pipeline run.
     */
    setGoRunning(running) {
        this.goItem.text = running
            ? '$(sync~spin) Go'
            : '$(debug-start) Go';
    }
    /**
     * Dispose all status bar items.
     */
    dispose() {
        for (const item of this.disposable) {
            item.dispose();
        }
    }
}
exports.StatusBarManager = StatusBarManager;
//# sourceMappingURL=statusBar.js.map