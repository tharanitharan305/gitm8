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
exports.isGitm8Available = isGitm8Available;
exports.getGitm8Path = getGitm8Path;
exports.ensureGitm8 = ensureGitm8;
exports.refreshCache = refreshCache;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
let _isAvailable = undefined;
let _gitm8Path = undefined;
/**
 * Check if gitm8 CLI is installed and available in PATH.
 * Caches the result for the session.
 */
async function isGitm8Available() {
    if (_isAvailable !== undefined)
        return _isAvailable;
    try {
        const result = await findGitm8();
        _isAvailable = result.found;
        _gitm8Path = result.path;
        return _isAvailable;
    }
    catch {
        _isAvailable = false;
        _gitm8Path = undefined;
        return false;
    }
}
/**
 * Get the path to the gitm8 binary (if found).
 */
function getGitm8Path() {
    return _gitm8Path;
}
/**
 * Prompt the user to install gitm8 if it's not found.
 * Returns true if the user chose to install (or already has it).
 */
async function ensureGitm8() {
    const available = await isGitm8Available();
    if (available)
        return true;
    const action = await vscode.window.showErrorMessage('gitm8 CLI is not installed. Install it to use the gitm8 extension.', 'Install gitm8', 'Learn More');
    if (action === 'Install gitm8') {
        const terminal = vscode.window.createTerminal('gitm8-install');
        terminal.show();
        terminal.sendText('npm install -g gitm8');
        vscode.window.showInformationMessage('Installing gitm8 globally... Close this terminal and reload VS Code when done.');
        return false; // They chose to install, but it's not ready yet
    }
    if (action === 'Learn More') {
        vscode.env.openExternal(vscode.Uri.parse('https://www.npmjs.com/package/gitm8'));
    }
    return false;
}
/**
 * Refresh the cached availability (e.g. after installation).
 */
function refreshCache() {
    _isAvailable = undefined;
    _gitm8Path = undefined;
}
async function findGitm8() {
    // On Windows, check common locations + PATH
    // On macOS/Linux, check PATH
    const isWin = process.platform === 'win32';
    const cmd = isWin ? 'where' : 'which';
    try {
        const execResult = await execCommand(cmd, ['gitm8']);
        if (execResult.code === 0 && execResult.stdout.trim()) {
            const gitm8Path = execResult.stdout.trim().split('\n')[0].trim();
            return { found: true, path: gitm8Path };
        }
    }
    catch {
        // Not found via 'which'/'where'
    }
    // Fallback: check common npm global installation paths
    const commonPaths = isWin
        ? [
            path.join(process.env.APPDATA || '', 'npm', 'gitm8.cmd'),
            path.join(process.env.LOCALAPPDATA || '', 'npm', 'gitm8.cmd'),
        ]
        : [
            '/usr/local/bin/gitm8',
            '/usr/bin/gitm8',
            path.join(process.env.HOME || '', '.npm-global/bin/gitm8'),
            path.join(process.env.HOME || '', '.nvm/versions/node/*/bin/gitm8'),
        ];
    for (const p of commonPaths) {
        try {
            const stat = await vscode.workspace.fs.stat(vscode.Uri.file(p));
            if (stat) {
                return { found: true, path: p };
            }
        }
        catch {
            // File doesn't exist at this path — try next
        }
    }
    return { found: false };
}
/**
 * Simple exec helper using VS Code's child_process. We avoid importing execa
 * to keep the extension dependency-free.
 */
function execCommand(cmd, args) {
    return new Promise((resolve) => {
        const cp = require('child_process');
        const child = cp.spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (data) => { stdout += data.toString(); });
        child.stderr.on('data', (data) => { stderr += data.toString(); });
        child.on('close', (code) => {
            resolve({ stdout, stderr, code });
        });
        child.on('error', () => {
            resolve({ stdout: '', stderr: 'spawn failed', code: -1 });
        });
    });
}
//# sourceMappingURL=gitm8.js.map