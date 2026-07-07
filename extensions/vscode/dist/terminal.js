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
exports.gitm8Terminal = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Manager for the dedicated "gitm8" terminal instance.
 * Creates one terminal and reuses it across commands to
 * preserve output history and avoid tab explosion.
 */
class Gitm8TerminalManager {
    terminal;
    name = 'gitm8';
    /**
     * Send a command to the gitm8 terminal.
     * Shows the terminal so the user sees what's happening.
     */
    sendCommand(cmd) {
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
    getTerminal() {
        return this.terminal;
    }
    /**
     * Dispose of the terminal.
     */
    dispose() {
        if (this.terminal && this.terminal.exitStatus === undefined) {
            this.terminal.dispose();
        }
        this.terminal = undefined;
    }
}
exports.gitm8Terminal = new Gitm8TerminalManager();
//# sourceMappingURL=terminal.js.map