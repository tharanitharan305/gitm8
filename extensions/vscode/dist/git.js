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
exports.execGit = execGit;
exports.execGitSync = execGitSync;
exports.isInRepo = isInRepo;
const vscode = __importStar(require("vscode"));
/**
 * Execute a git command and return stdout.
 * Uses the git path from VS Code settings.
 */
async function execGit(args) {
    const gitPath = vscode.workspace.getConfiguration('gitm8').get('gitPath', 'git');
    return new Promise((resolve, reject) => {
        const cp = require('child_process');
        const child = cp.spawn(gitPath, args, {
            cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (data) => { stdout += data.toString(); });
        child.stderr.on('data', (data) => { stderr += data.toString(); });
        child.on('close', (code) => {
            if (code === 0) {
                resolve(stdout.trim());
            }
            else {
                reject(new Error(stderr.trim() || `git exited with code ${code}`));
            }
        });
        child.on('error', (err) => {
            reject(new Error(`Failed to spawn git: ${err.message}`));
        });
    });
}
/**
 * Execute a git command synchronously (for simple checks).
 */
function execGitSync(args) {
    const gitPath = vscode.workspace.getConfiguration('gitm8').get('gitPath', 'git');
    const cp = require('child_process');
    const result = cp.spawnSync(gitPath, args, {
        cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.status === 0) {
        return result.stdout.toString().trim();
    }
    throw new Error(result.stderr.toString().trim() || `git exited with code ${result.status}`);
}
/**
 * Check if we're inside a git repository.
 */
async function isInRepo() {
    try {
        await execGit(['rev-parse', '--git-dir']);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=git.js.map