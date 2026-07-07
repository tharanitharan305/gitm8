"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPipeline = runPipeline;
exports.runPipelineAuto = runPipelineAuto;
const terminal_1 = require("../terminal");
/**
 * Run the gitm8 pipeline: `gitm8 go`.
 * Shows output in the dedicated gitm8 terminal.
 */
async function runPipeline() {
    terminal_1.gitm8Terminal.sendCommand('gitm8 go');
}
/**
 * Run the pipeline with auto-approve (skips manual prompts): `gitm8 go -y`.
 */
async function runPipelineAuto() {
    terminal_1.gitm8Terminal.sendCommand('gitm8 go -y');
}
//# sourceMappingURL=go.js.map