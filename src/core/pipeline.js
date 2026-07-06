import picocolors from 'picocolors';
import * as clack from '@clack/prompts';
import { get } from './config-store.js';
import addCommand from '../commands/add.js';
import secretsScanCommand from '../commands/secrets-scan.js';
import commitCommand from '../commands/commit.js';
import precheckCommand from '../commands/precheck.js';
import pushCommand from '../commands/push.js';

/**
 * Registry of all available pipeline steps.
 * Each entry maps a step ID to its module, label, and display icon.
 */
const STEP_REGISTRY = {
  add:           { cmd: addCommand,         needsRepo: true, label: 'Add',        icon: '📂' },
  'secrets-scan': { cmd: secretsScanCommand, needsRepo: true, label: 'Secrets Scan', icon: '🔐' },
  commit:        { cmd: commitCommand,       needsRepo: true, label: 'Commit',     icon: '📝' },
  precheck:      { cmd: precheckCommand,     needsRepo: true, label: 'Precheck',   icon: '🏗️'  },
  push:          { cmd: pushCommand,         needsRepo: true, label: 'Push',       icon: '🚀' },
};

/**
 * Custom error thrown when a pipeline step calls process.exit.
 * The pipeline engine catches this instead of letting it kill the process.
 */
class StepExitError extends Error {
  constructor(code, step) {
    super(`Step "${step}" exited with code ${code}`);
    this.code = code;
    this.step = step;
  }
}

/**
 * Run the configured pipeline from the saved config.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.yes]  Override every step to auto mode
 * @returns {Promise<boolean>}  true if the pipeline completed successfully
 */
export async function runPipeline(opts = {}) {
  const steps = get('pipelineSteps');

  if (!steps || steps.length === 0) {
    console.log(picocolors.yellow('\n⚠  No pipeline configured.'));
    console.log(picocolors.dim('  Build one in the config UI:'));
    console.log(picocolors.dim('    gitm8 config --ui'));
    return false;
  }

  // Show the pipeline overview
  printPipelineSummary(steps, opts.yes);
  console.log('');

  const total = steps.length;

  for (let i = 0; i < total; i++) {
    const step = steps[i];
    const entry = STEP_REGISTRY[step.step];

    if (!entry) {
      console.log(picocolors.red(`✖ Unknown step "${step.step}" — skipping`));
      continue;
    }

    const mode = opts.yes ? 'auto' : (step.mode || 'auto');
    const heading = `${i + 1}/${total}  ${entry.icon}  ${picocolors.bold(entry.label)}`;

    // ── Manual mode: ask permission before this step ──
    if (mode === 'manual') {
      console.log(picocolors.dim(`Step ${heading}`));
      const proceed = await clack.confirm({
        message: `Run "${entry.label}" now?`,
        initialValue: true,
      });

      if (clack.isCancel(proceed)) {
        console.log(picocolors.yellow('\nPipeline cancelled.'));
        return false;
      }

      if (!proceed) {
        console.log(picocolors.dim(`  ⊘ Skipped`));
        continue;
      }
    }

    // ── Execute the step ──
    // Override process.exit so command modules can't kill the pipeline
    const realExit = process.exit;
    process.exit = (code) => { throw new StepExitError(code ?? 1, step.step); };

    try {
      console.log(picocolors.dim(`\n── ${heading} ──`));

      if (step.step === 'commit') {
        // Commit: auto mode skips review (--yes), pipeline mode skips internal toggles
        await commitCommand({ yes: mode === 'auto', pipeline: true });
      } else if (step.step === 'precheck') {
        // Precheck: don't offer push when in pipeline (push is a separate step)
        await precheckCommand({ pipeline: true });
      } else if (step.step === 'secrets-scan') {
        // Secrets scan: auto mode = non-interactive report, fail on critical
        await secretsScanCommand({ ci: mode === 'auto' });
      } else {
        await entry.cmd();
      }

      console.log(picocolors.green(`✔ ${entry.icon} ${entry.label} — passed`));
    } catch (err) {
      if (err instanceof StepExitError) {
        console.error(picocolors.red(`\n✖ Pipeline stopped at "${entry.label}" (exit ${err.code})`));
      } else {
        console.error(picocolors.red(`\n✖ Pipeline failed at "${entry.label}": ${err.message}`));
      }
      return false;
    } finally {
      process.exit = realExit;
    }
  }

  console.log(picocolors.green('\n✔ Pipeline complete!\n'));
  return true;
}

/**
 * Print a summary of the pipeline that will run.
 */
function printPipelineSummary(steps, forceAuto) {
  console.log(picocolors.cyan('⚡ Pipeline'));
  console.log(picocolors.dim('  ' + '─'.repeat(40)));
  for (const s of steps) {
    const entry = STEP_REGISTRY[s.step];
    if (!entry) {
      console.log(picocolors.dim(`  ?  ???  (unknown step "${s.step}")`));
      continue;
    }
    const mode = forceAuto ? 'auto' : (s.mode || 'auto');
    const modeLabel = mode === 'auto'
      ? picocolors.dim('auto')
      : picocolors.yellow('manual');
    console.log(`  ${entry.icon}  ${entry.label.padEnd(14)} ${modeLabel}`);
  }
  if (forceAuto) {
    console.log(picocolors.dim('  (--yes: all steps auto)'));
  }
  console.log(picocolors.dim('  ' + '─'.repeat(40)));
}
