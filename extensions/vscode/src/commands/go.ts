import { gitm8Terminal } from '../terminal';

/**
 * Run the gitm8 pipeline: `gitm8 go`.
 * Shows output in the dedicated gitm8 terminal.
 */
export async function runPipeline(): Promise<void> {
  gitm8Terminal.sendCommand('gitm8 go');
}

/**
 * Run the pipeline with auto-approve (skips manual prompts): `gitm8 go -y`.
 */
export async function runPipelineAuto(): Promise<void> {
  gitm8Terminal.sendCommand('gitm8 go -y');
}
