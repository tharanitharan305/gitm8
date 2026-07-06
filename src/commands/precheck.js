import picocolors from 'picocolors';
import * as clack from '@clack/prompts';
import { execa } from 'execa';
import { detectFramework } from '../core/scanner.js';
import { getCurrentBranch, push, hasUpstream } from '../core/git.js';

/**
 * `gitm8 precheck`
 * Detect framework → run build → on success, offer quick push.
 */
export default async function precheckCommand(opts = {}) {
  const { pipeline = false } = opts;
  // ── 1. Branch info ──────────────────────────────────────────
  const branch = await getCurrentBranch();
  console.log('');
  console.log(picocolors.bold(picocolors.cyan(`📦 Precheck — Branch: ${picocolors.white(branch)}`)));
  console.log(picocolors.dim('─'.repeat(50)));

  // ── 2. Detect framework ─────────────────────────────────────
  const framework = detectFramework();
  console.log(`  ${picocolors.yellow('Framework:')}  ${framework.label}`);

  if (!framework.buildCmd) {
    // No build step — offer push directly if there's a build-less framework
    console.log(`  ${picocolors.dim('Build:')}     ${picocolors.yellow('skipped (no standard build step)')}`);
    console.log(picocolors.dim('─'.repeat(50)) + '\n');
    if (!pipeline) await offerPush(branch);
    return;
  }

  // ── 3. Run build ────────────────────────────────────────────
  console.log(`  ${picocolors.yellow('Build:')}     ${picocolors.dim(`running \`${framework.buildCmd}\`...`)}`);
  console.log('');

  const buildOk = await runBuild(framework.buildCmd);

  if (!buildOk) {
    console.log('');
    console.log(picocolors.red('✖ Build failed. Push blocked.'));
    console.log(picocolors.yellow('  Fix the errors above, then run:'));
    console.log(picocolors.yellow(`    gitm8 precheck`));
    process.exit(1);
  }

  // ── 4. Build passed — offer push ────────────────────────────
  console.log('');
  console.log(picocolors.green('✔ Build passed!'));
  console.log(picocolors.dim('─'.repeat(50)) + '\n');

  if (!pipeline) await offerPush(branch);
}

/**
 * Run the build command, streaming output in real-time.
 * @param {string} cmd - The command string to run (e.g. "npm run build")
 * @returns {Promise<boolean>} true if build exited 0
 */
async function runBuild(cmd) {
  const [bin, ...args] = cmd.split(/\s+/);

  try {
    const subprocess = execa(bin, args, {
      cwd: process.cwd(),
      stdio: ['inherit', 'pipe', 'pipe'],
      reject: false,
    });

    // Stream stdout in real-time
    subprocess.stdout.pipe(process.stdout);
    subprocess.stderr.pipe(process.stderr);

    const { exitCode } = await subprocess;
    return exitCode === 0;
  } catch (err) {
    return false;
  }
}

/**
 * Offer to push to the current branch.
 * @param {string} branch
 */
async function offerPush(branch) {
  const upstream = await hasUpstream();
  const pushTarget = upstream ? `origin/${branch}` : `origin/${branch} (set upstream)`;

  const shouldPush = await clack.confirm({
    message: `Push to ${picocolors.cyan(branch)}?`,
    initialValue: true,
  });

  if (clack.isCancel(shouldPush)) {
    console.log(picocolors.yellow('\nCancelled.'));
    return;
  }

  if (!shouldPush) {
    console.log(picocolors.dim('\nSkip push. You can push later with:'));
    console.log(picocolors.dim(`  gitm8 push`));
    return;
  }

  // Do the push
  console.log(picocolors.cyan(`\nPushing to ${picocolors.bold(branch)}...`));

  try {
    const { stdout, stderr } = await push();
    if (stdout) console.log(picocolors.green(stdout));
    if (stderr) console.error(picocolors.dim(stderr));
    console.log(picocolors.green(`\n✔ Pushed to origin/${branch}`));
  } catch (err) {
    console.error(picocolors.red(`\n✖ Push failed:`));
    console.error(picocolors.red(err.stderr || err.message));
    process.exit(1);
  }
}
