import picocolors from 'picocolors';
import { runPipeline } from '../core/pipeline.js';

/**
 * `gitm8 go`
 * Run the configured pipeline from start to finish.
 *
 * @param {object} opts
 * @param {boolean} opts.yes  Skip all manual prompts
 */
export default async function pipelineCommand(opts) {
  const { yes = false } = opts;

  const ok = await runPipeline({ yes });

  if (!ok) {
    process.exit(1);
  }
}
