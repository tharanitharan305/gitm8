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
exports.publishBranch = publishBranch;
const vscode = __importStar(require("vscode"));
const terminal_1 = require("../terminal");
const git_1 = require("../git");
/**
 * Publish the current branch:
 * - If no upstream: `git push -u origin <branch>`
 * - If upstream exists: `git push`
 * - Offer to create a PR via `gh` CLI
 */
async function publishBranch() {
    try {
        const currentBranch = await (0, git_1.execGit)(['rev-parse', '--abbrev-ref', 'HEAD']);
        const branch = currentBranch.trim();
        if (!branch || branch === 'HEAD') {
            vscode.window.showErrorMessage('gitm8: Not on any branch.');
            return;
        }
        // Check if upstream exists
        let hasUpstream = false;
        try {
            await (0, git_1.execGit)(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
            hasUpstream = true;
        }
        catch {
            hasUpstream = false;
        }
        // Push
        if (hasUpstream) {
            terminal_1.gitm8Terminal.sendCommand('git push');
        }
        else {
            terminal_1.gitm8Terminal.sendCommand(`git push -u origin "${branch}"`);
        }
        vscode.window.setStatusBarMessage('$(cloud-upload) gitm8: Publishing...', 3000);
        // ── Offer PR creation ──
        // Check if gh CLI is available
        const ghAvailable = await isGhAvailable();
        if (ghAvailable) {
            const prAction = '$(git-pull-request) Create PR';
            const result = await vscode.window.showInformationMessage(`Branch "${branch}" publishing. Create a pull request?`, prAction);
            if (result === prAction) {
                terminal_1.gitm8Terminal.sendCommand(`gh pr create --fill --assignee @me`);
            }
        }
    }
    catch (err) {
        vscode.window.showErrorMessage(`gitm8: Publish failed — ${err instanceof Error ? err.message : String(err)}`);
    }
}
/**
 * Check if the GitHub CLI (`gh`) is installed.
 */
async function isGhAvailable() {
    try {
        const cp = require('child_process');
        const result = cp.spawnSync(process.platform === 'win32' ? 'where' : 'which', ['gh'], { stdio: 'pipe' });
        return result.status === 0;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=publish.js.map