import picocolors from 'picocolors';
import * as clack from '@clack/prompts';
import { execa } from 'execa';
import { getStagedDiff, commit as gitCommit, push, getCurrentBranch, hasUpstream } from '../core/git.js';
import { generateCommitMessage, TONE_MAP } from '../core/ai.js';
import { get, set } from '../core/config-store.js';
import { scanStagedSecrets } from '../core/secrets.js';
import { detectFramework } from '../core/scanner.js';

/**
 * `gitm8 commit`
 * Flow: [secrets scan] → [AI message + commit] → [precheck] → [auto push]
 * Each stage is gated by pipeline config toggles.
 *
 * @param {object} opts
 * @param {boolean} opts.dryRun
 * @param {boolean} opts.yes
 */
export default async function commitCommand(opts) {
  const { dryRun = false, yes = false } = opts;

  // ── Stage 1: Check for staged changes ─────────────────────
  let diff = await getStagedDiff();
  if (!diff || diff.trim().length === 0) {
    console.error(picocolors.red('✖ No staged changes found.'));
    console.error(picocolors.yellow('  Stage your changes first:'));
    console.error(picocolors.yellow('    gitm8 add'));
    console.error(picocolors.yellow('    gitm8 add <file1> <file2> ...'));
    process.exit(1);
  }

  // ── Stage 2: Secrets scan (pipeline toggle) ───────────────
  if (get('pipelineSecretsScan') !== false) {
    const scanAborted = await runSecretsScan();
    if (scanAborted) return;

    // Re-check diff in case files were unstaged
    diff = await getStagedDiff();
    if (!diff || diff.trim().length === 0) {
      console.log(picocolors.yellow('\nNothing left staged after unstage. Commit cancelled.'));
      return;
    }
  }

  // ── Stage 3: AI commit message + interactive review ────────
  let currentTone = get('tone') || 'concise';
  let message = '';

  while (true) {
    try {
      console.log(picocolors.dim(`\nGenerating commit message (tone: ${currentTone})...`));
      message = await generateCommitMessage(diff);
    } catch (err) {
      console.error(picocolors.red(`✖ ${err.message}`));
      process.exit(1);
    }

    console.log('\n' + picocolors.cyan('─'.repeat(60)));
    console.log(picocolors.bold('Proposed commit message:'));
    console.log(picocolors.cyan('─'.repeat(60)));
    console.log(picocolors.white(message));
    console.log(picocolors.cyan('─'.repeat(60)));

    if (dryRun) {
      console.log(picocolors.dim('\nℹ Dry run — not committing.'));
      return;
    }

    if (yes) {
      break;
    }

    const action = await clack.select({
      message: 'How would you like to proceed?',
      options: [
        { value: 'accept', label: 'Accept and commit', hint: 'enter' },
        { value: 'edit', label: 'Edit message before committing' },
        { value: 'regenerate', label: 'Regenerate message' },
        { value: 'tone', label: 'Change tone and regenerate' },
        { value: 'quit', label: 'Quit without committing' },
      ],
    });

    if (clack.isCancel(action)) {
      console.log(picocolors.yellow('\nCommit cancelled.'));
      return;
    }

    switch (action) {
      case 'accept':
        break;
      case 'edit': {
        const edited = await clack.text({
          message: 'Edit the commit message:',
          initialValue: message,
          multiline: true,
        });
        if (clack.isCancel(edited)) continue;
        message = edited.trim();
        break;
      }
      case 'regenerate':
        continue;
      case 'tone': {
        const toneResult = await changeTone();
        if (toneResult !== null) currentTone = toneResult;
        continue;
      }
      case 'quit':
        console.log(picocolors.yellow('Commit cancelled.'));
        return;
    }
    break;
  }

  // ── Stage 4: Do the commit ─────────────────────────────────
  try {
    const { stdout } = await gitCommit(message);
    console.log(picocolors.green(`\n✔ Commit successful:`));
    console.log(picocolors.dim(stdout));
  } catch (err) {
    console.error(picocolors.red(`✖ Commit failed: ${err.stderr || err.message}`));
    process.exit(1);
  }

  // ── Stage 5: Precheck (build) — pipeline toggle ────────────
  // Runs automatically when enabled — no prompt
  let precheckPassed = true;
  if (get('pipelinePrecheck') === true) {
    precheckPassed = await runPrecheck();
  }

  // ── Stage 6: Auto push — pipeline toggle ───────────────────
  // Only pushes if precheck passed (or was skipped)
  if (get('pipelineAutoPush') === true && precheckPassed) {
    await runAutoPush();
  } else if (get('pipelineAutoPush') === true && !precheckPassed) {
    console.log(picocolors.yellow('\n⚠ Auto-push skipped because the build failed.'));
    console.log(picocolors.dim('  Fix the issues and push manually:'));
    console.log(picocolors.dim('    gitm8 push'));
  }

  console.log('');
}

// ── Pipeline helpers ──────────────────────────────────────────

/**
 * Run secrets scan on staged files.
 * Interactive if findings found — asks user what to do.
 * @returns {Promise<boolean>} true if the commit should be aborted
 */
async function runSecretsScan() {
  console.log(picocolors.dim('\n🔐 Scanning for secrets...'));

  const findings = await scanStagedSecrets();

  if (findings.length === 0) {
    console.log(picocolors.green('✔ No secrets detected.'));
    return false;
  }

  // Group by severity
  const bySeverity = { critical: [], high: [], medium: [], low: [] };
  for (const f of findings) {
    bySeverity[f.severity]?.push(f);
  }

  const criticalCount = bySeverity.critical.length;
  const highCount = bySeverity.high.length;
  const total = findings.length;

  console.log(picocolors.yellow(`\n⚠  ${total} potential secret${total > 1 ? 's' : ''} found`));

  // Show summary listing
  for (const severity of ['critical', 'high', 'medium', 'low']) {
    const group = bySeverity[severity];
    if (group.length === 0) continue;

    const color = severity === 'critical' ? picocolors.red
      : severity === 'high' ? picocolors.yellow
      : severity === 'medium' ? picocolors.cyan
      : picocolors.dim;

    console.log(color(`  ${severity.toUpperCase()}:`));
    const byFile = {};
    for (const f of group) {
      if (!byFile[f.file]) byFile[f.file] = [];
      byFile[f.file].push(f);
    }
    for (const [filePath, fileFindings] of Object.entries(byFile)) {
      for (const f of fileFindings) {
        console.log(color(`    ${filePath}:L${f.line} — ${f.name} (${f.match})`));
      }
    }
  }

  if (criticalCount === 0 && highCount === 0) {
    // Low/medium only — just warn, don't block
    console.log(picocolors.dim('  (low-severity — continuing)'));
    return false;
  }

  // Prompt for action on critical/high findings
  const action = await clack.select({
    message: criticalCount > 0
      ? picocolors.red('🔴 Critical secrets detected! What to do?')
      : picocolors.yellow('🟡 Secrets detected. What to do?'),
    options: [
      { value: 'unstage', label: 'Unstage files with secrets', hint: 'recommended' },
      { value: 'continue', label: 'Commit anyway', hint: 'not recommended' },
      { value: 'cancel', label: 'Cancel commit', hint: 'fix first' },
    ],
  });

  if (clack.isCancel(action) || action === 'cancel') {
    console.log(picocolors.yellow('\nCommit cancelled.'));
    return true;
  }

  if (action === 'continue') {
    console.log(picocolors.yellow('\n⚠  Committing with secrets detected — proceed with caution.'));
    return false;
  }

  // Unstage files with critical/high findings
  const filesToUnstage = [
    ...new Set([
      ...bySeverity.critical.map((f) => f.file),
      ...bySeverity.high.map((f) => f.file),
    ]),
  ];

  console.log(picocolors.cyan(`Unstaging ${filesToUnstage.length} file${filesToUnstage.length > 1 ? 's' : ''}...`));
  for (const file of filesToUnstage) {
    try {
      await execa('git', ['reset', file]);
      console.log(picocolors.dim(`  ⊘ ${picocolors.yellow(file)}`));
    } catch (err) {
      console.error(picocolors.red(`  ✖ Failed to unstage ${file}: ${err.message}`));
    }
  }
  console.log(picocolors.green('✔ Secrets removed from staging.'));

  // Return false to continue commit with remaining staged files
  return false;
}

/**
 * Run precheck (framework detection + build).
 * Non-interactive — runs automatically based on config.
 * @returns {Promise<boolean>} true if build passed or was skipped
 */
async function runPrecheck() {
  const branch = await getCurrentBranch();
  const framework = detectFramework();

  console.log(picocolors.dim(`\n🏗️  Precheck — ${framework.label} (${picocolors.white(branch)})`));

  if (!framework.buildCmd) {
    console.log(picocolors.dim('  No build step to run.'));
    return true;
  }

  console.log(picocolors.dim(`  Running \`${framework.buildCmd}\`...`));

  const [bin, ...args] = framework.buildCmd.split(/\s+/);
  try {
    const subprocess = execa(bin, args, {
      cwd: process.cwd(),
      stdio: ['inherit', 'pipe', 'pipe'],
      reject: false,
    });
    subprocess.stdout.pipe(process.stdout);
    subprocess.stderr.pipe(process.stderr);

    const { exitCode } = await subprocess;
    if (exitCode !== 0) {
      console.log('');
      console.log(picocolors.red('✖ Build failed. Commit was made, but push was blocked.'));
      console.log(picocolors.yellow('  Fix the issues, then push manually:'));
      console.log(picocolors.yellow('    gitm8 push'));
      return false;
    }

    console.log(picocolors.green('✔ Build passed.'));
    return true;
  } catch {
    console.log(picocolors.red('✖ Build failed to start.'));
    return false;
  }
}

/**
 * Auto-push after successful commit + precheck.
 * Non-interactive — runs automatically based on config.
 */
async function runAutoPush() {
  const branch = await getCurrentBranch();
  console.log(picocolors.dim(`\n🚀 Auto-pushing to ${picocolors.white(branch)}...`));
  try {
    const { stdout, stderr } = await push();
    if (stdout) console.log(picocolors.green(stdout));
    if (stderr) console.error(picocolors.dim(stderr));
    console.log(picocolors.green(`✔ Pushed to origin/${branch}`));
  } catch (err) {
    console.error(picocolors.red(`✖ Push failed: ${err.stderr || err.message}`));
    console.error(picocolors.dim('  Push manually with: gitm8 push'));
  }
}

/**
 * Interactive tone changer shown during commit preview.
 * @returns {Promise<string|null>}
 */
async function changeTone() {
  const presets = Object.keys(TONE_MAP);
  const options = presets.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }));
  options.push({ value: 'custom', label: 'Custom tone' });

  const toneChoice = await clack.select({
    message: 'Select a tone:',
    options,
  });

  if (clack.isCancel(toneChoice)) return null;

  if (toneChoice === 'custom') {
    const custom = await clack.text({
      message: 'Describe the tone you want:',
      placeholder: 'e.g. "like a pirate" or "very technical and precise"',
    });
    if (clack.isCancel(custom)) return null;
    if (custom.trim()) {
      set('customTone', custom.trim());
    }
    return 'custom';
  }

  set('tone', toneChoice);
  set('customTone', '');
  return toneChoice;
}
