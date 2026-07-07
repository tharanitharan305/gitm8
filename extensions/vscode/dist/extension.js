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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const statusBar_1 = require("./statusBar");
const gitm8_1 = require("./gitm8");
const secrets_1 = require("./secrets");
const git_1 = require("./git");
const go_1 = require("./commands/go");
const pull_1 = require("./commands/pull");
const branch_1 = require("./commands/branch");
const publish_1 = require("./commands/publish");
const config_1 = require("./commands/config");
let statusBar;
let repoWatcher;
let debounceTimer;
/**
 * Activate the gitm8 extension.
 * Registers status bar buttons, commands, and detects gitm8 availability.
 */
async function activate(context) {
    console.log('[gitm8] Activating extension...');
    console.log("🚀 GitM8 Extension Activated");
    vscode.window.showInformationMessage("GitM8 Extension Activated");
    // ── Initialize secrets storage ──
    (0, secrets_1.initSecrets)(context);
    // ── Create status bar ──
    statusBar = new statusBar_1.StatusBarManager();
    // ── Register commands ──
    const goCmd = vscode.commands.registerCommand('gitm8.go', async () => {
        statusBar?.setGoRunning(true);
        try {
            await (0, go_1.runPipeline)();
        }
        finally {
            setTimeout(() => statusBar?.setGoRunning(false), 2000);
        }
    });
    const pullCmd = vscode.commands.registerCommand('gitm8.pull', () => {
        (0, pull_1.pullCurrentBranch)();
    });
    const branchCmd = vscode.commands.registerCommand('gitm8.createBranch', () => {
        (0, branch_1.createBranch)();
    });
    const publishCmd = vscode.commands.registerCommand('gitm8.publish', () => {
        (0, publish_1.publishBranch)();
    });
    const configCmd = vscode.commands.registerCommand('gitm8.openConfig', () => {
        (0, config_1.openConfig)();
    });
    const refreshCmd = vscode.commands.registerCommand('gitm8.refreshStatus', () => {
        (0, gitm8_1.refreshCache)();
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
            if (debounceTimer)
                clearTimeout(debounceTimer);
        },
    });
    console.log('[gitm8] Extension activated.');
}
/**
 * Deactivate the extension.
 */
function deactivate() {
    statusBar?.dispose();
    repoWatcher?.dispose();
    if (debounceTimer)
        clearTimeout(debounceTimer);
}
// ── UI update logic ──
async function updateUI() {
    if (!statusBar)
        return;
    // Check if we're in a git repo
    const inRepo = vscode.workspace.workspaceFolders && (await (0, git_1.isInRepo)());
    if (!inRepo) {
        statusBar.hide();
        return;
    }
    // Check if gitm8 is available
    const gitm8Available = await (0, gitm8_1.isGitm8Available)();
    // If gitm8 is not available, show buttons but disabled
    // Still show git operations (pull, branch, publish) even without gitm8
    statusBar.show();
    if (!gitm8Available) {
        statusBar.setEnabled(false);
        // Show install notification once per session
        (0, gitm8_1.ensureGitm8)();
    }
    else {
        statusBar.setEnabled(true);
    }
}
function debounceUpdate() {
    if (debounceTimer)
        clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => updateUI(), 500);
}
//# sourceMappingURL=extension.js.map