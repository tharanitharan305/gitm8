import picocolors from 'picocolors';
import * as clack from '@clack/prompts';
import { resolve } from 'path';
import { parseFileLine, validateFile, getRepoRoot, isRepoEmpty, isDetachedHead, isShallowClone } from '../utils/parser.js';
import { formatLineBlame, formatFileOwnership, formatRepoContributors } from '../utils/formatter.js';
import { getFileOwnership, getLineBlame, getRepoOwnership } from '../services/ownership.js';
import { getCommitDetails, getCommitUrl } from '../git/show.js';
import { getContributors, getMostModifiedFiles, getMostActiveDirectories } from '../git/contributors.js';
import { getLog } from '../git/log.js';
import { execa } from 'execa';
import open from 'open';

/**
 * `gitm8 who <file[:line]>`
 *
 * Shows who owns a file, line, or the whole repo.
 * Works 100% offline using local Git metadata.
 *
 * @param {string} input - File path, file:line, or '.'
 * @param {object} [opts]
 * @param {boolean} [opts.json] - JSON output
 * @param {boolean} [opts.open] - Open commit in browser
 * @param {boolean} [opts.history] - Show full modification history
 * @param {boolean} [opts.stats] - Show ownership statistics
 * @param {boolean} [opts.verbose] - Show raw git metadata
 */
export default async function whoCommand(input, opts = {}) {
  const startTime = Date.now();

  // ── Welcome header (suppress for JSON) ──────────────────────
  if (!opts.json) {
    console.log('');
    console.log(picocolors.bold(picocolors.magenta('🔍 Git Ownership Analysis')));
  }

  // ── No input → Interactive mode ─────────────────────────────
  if (!input) {
    await interactiveWho();
    if (!opts.json) {
      console.log(picocolors.dim(`\n  Done in ${((Date.now() - startTime) / 1000).toFixed(1)}s\n`));
    }
    return;
  }

  // ── Parse input ─────────────────────────────────────────────
  const parsed = parseFileLine(input);

  // ── Validate repository ─────────────────────────────────────
  const { errors: repoErrors, warnings: repoWarnings } = await validateRepo();
  if (repoErrors.length > 0) {
    for (const err of repoErrors) {
      console.error(picocolors.red(`✖ ${err}`));
    }
    console.log('');
    process.exit(1);
  }
  for (const warn of repoWarnings) {
    console.log(picocolors.yellow(`⚠ ${warn}`));
  }

  // ── Check empty repo ────────────────────────────────────────
  if (await isRepoEmpty()) {
    console.log(picocolors.yellow('\n⚠ This repository has no commits yet.'));
    console.log(picocolors.dim('  Make your first commit to see ownership data.\n'));
    return;
  }

  // ── Not repo root? Validate file ────────────────────────────
  if (!parsed.isRepoRoot) {
    const errors = await validateFile(parsed);
    if (errors.length > 0) {
      for (const err of errors) {
        console.error(picocolors.red(`✖ ${err}`));
      }
      console.log('');
      process.exit(1);
    }
  }

  // ── Mode routing ────────────────────────────────────────────
  try {
    if (parsed.isRepoRoot) {
      await handleRepoMode(opts);
    } else if (parsed.line !== null) {
      await handleLineMode(parsed, opts);
    } else {
      await handleFileMode(parsed, opts);
    }
  } catch (err) {
    if (!opts.json) {
      console.error(picocolors.red(`\n✖ Error: ${err.message}`));
      if (opts.verbose) {
        console.error(picocolors.dim(err.stack));
      }
    }
    process.exit(1);
  }

  if (!opts.json) {
    console.log(picocolors.dim(`\n  Done in ${((Date.now() - startTime) / 1000).toFixed(1)}s\n`));
  }
}

// ═══════════════════════════════════════════════════════════════
//  Mode Handlers
// ═══════════════════════════════════════════════════════════════

/**
 * Line mode: blame + commit details + history.
 *
 * @param {import('../utils/parser.js').ParsedFileLine} parsed
 * @param {object} opts
 */
async function handleLineMode(parsed, opts) {
  const fileShort = parsed.relativePath.split('/').pop() ||
                    parsed.relativePath.split('\\').pop();

  const data = await getLineBlame(parsed.filePath, parsed.line);

  // If --history flag, always show full history
  if (!opts.history) {
    // Still fetch history but don't display all details
  }

  const output = formatLineBlame(data, {
    json: opts.json,
    verbose: opts.verbose,
  });

  console.log(output);

  // --open: open commit in browser
  if (opts.open && data.blame?.commit) {
    const url = await getCommitUrl(data.blame.commit);
    if (url) {
      try {
        await open(url);
        console.log(picocolors.dim(`  Opened in browser: ${url}`));
      } catch {
        console.log(picocolors.yellow(`  Commit URL: ${url}`));
      }
    } else {
      console.log(picocolors.yellow('  No remote configured — cannot open in browser.'));
    }
  }
}

/**
 * File mode: ownership statistics.
 *
 * @param {import('../utils/parser.js').ParsedFileLine} parsed
 * @param {object} opts
 */
async function handleFileMode(parsed, opts) {
  const data = await getFileOwnership(parsed.filePath);

  const output = formatFileOwnership(data, {
    json: opts.json,
    stats: opts.stats,
  });

  console.log(output);

  // --history: show all commits for this file
  if (opts.history) {
    await showFileHistory(parsed.filePath, opts.json);
  }
}

/**
 * Repository mode: top contributors, most modified files, recent activity.
 *
 * @param {object} opts
 */
async function handleRepoMode(opts) {
  if (opts.json) {
    const data = await getRepoOwnership({
      contributorLimit: 20,
      fileLimit: 15,
      dirLimit: 10,
    });
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  const data = await getRepoOwnership({
    contributorLimit: 12,
    fileLimit: 10,
    dirLimit: 5,
  });

  const output = formatRepoContributors(data, { json: false });
  console.log(output);
}

/**
 * Show full commit history for a file.
 *
 * @param {string} filePath
 * @param {boolean} jsonMode
 */
async function showFileHistory(filePath, jsonMode) {
  const logs = await getLog({ file: filePath, maxCount: 50 });

  if (jsonMode) {
    console.log(JSON.stringify(logs, null, 2));
    return;
  }

  console.log(`\n  ${picocolors.dim('─').repeat(40)}`);
  console.log(`  ${picocolors.bold(picocolors.cyan('Commit History'))}`);
  console.log('');

  for (const log of logs.slice(0, 20)) {
    const hash = picocolors.yellow(log.hash.slice(0, 7));
    const date = picocolors.dim(formatShortDate(log.timestamp));
    const msg = log.message.length > 60
      ? log.message.slice(0, 57) + '...'
      : log.message;
    const author = picocolors.dim(log.author);

    console.log(`    ${hash}  ${msg}`);
    console.log(`           ${author} — ${date}`);
  }

  if (logs.length > 20) {
    console.log(picocolors.dim(`    ...and ${logs.length - 20} more commits`));
  }
}

// ═══════════════════════════════════════════════════════════════
//  Interactive Mode
// ═══════════════════════════════════════════════════════════════

/**
 * Interactive exploration mode.
 * Uses @clack/prompts for a guided experience.
 */
async function interactiveWho() {
  const { errors: repoErrors, warnings: repoWarnings } = await validateRepo();
  if (repoErrors.length > 0) {
    for (const err of repoErrors) {
      console.error(picocolors.red(`✖ ${err}`));
    }
    console.log('');
    return;
  }
  for (const warn of repoWarnings) {
    console.log(picocolors.yellow(`⚠ ${warn}`));
  }

  if (await isRepoEmpty()) {
    console.log(picocolors.yellow('\n⚠ This repository has no commits yet.'));
    return;
  }

  console.log(picocolors.dim('  Explore your repository contributors, commits, and files.\n'));

  let exit = false;

  while (!exit) {
    const mode = await clack.select({
      message: 'Choose an exploration mode:',
      options: [
        { value: 'contributors', label: '👥 Browse Contributors', hint: 'view top contributors' },
        { value: 'commits', label: '📜 Browse Commits', hint: 'recent commits + details' },
        { value: 'files', label: '📄 Browse Files', hint: 'most modified files' },
        { value: 'blame', label: '🔍 Blame a File', hint: 'enter file path to blame' },
        { value: 'exit', label: '🚪 Exit', hint: 'back to shell' },
      ],
    });

    if (clack.isCancel(mode) || mode === 'exit') {
      exit = true;
      break;
    }

    switch (mode) {
      case 'contributors':
        await interactiveContributors();
        break;
      case 'commits':
        await interactiveCommits();
        break;
      case 'files':
        await interactiveFiles();
        break;
      case 'blame':
        await interactiveBlame();
        break;
    }

    console.log('');
  }
}

/**
 * Browse contributors interactively.
 */
async function interactiveContributors() {
  const spinner = clack.spinner();
  spinner.start('Loading contributors...');

  try {
    const contributors = await getContributors({ limit: 30 });
    spinner.stop('Done');

    if (contributors.length === 0) {
      console.log(picocolors.yellow('  No contributors found.'));
      return;
    }

    const options = contributors.slice(0, 20).map((c) => ({
      value: c,
      label: `${c.name.padEnd(20)} ${c.commits} commits`,
      hint: c.email,
    }));

    const selected = await clack.select({
      message: `Select a contributor (${contributors.length} total):`,
      options: [
        ...options,
        { value: '__back', label: '🔙 Back', hint: 'return to menu' },
      ],
    });

    if (clack.isCancel(selected) || selected === '__back') return;

    // Show contributor details
    console.log('');
    console.log(picocolors.bold(`  ${selected.name}`));
    console.log(`    ${picocolors.dim('Email:')}   ${selected.email}`);
    console.log(`    ${picocolors.dim('Commits:')} ${selected.commits}`);

    // Get recent commits by this author
    const recentLogs = await getLog({
      author: selected.name,
      maxCount: 5,
    });

    if (recentLogs.length > 0) {
      console.log(`\n    ${picocolors.dim('Recent commits:')}`);
      for (const log of recentLogs) {
        const hash = picocolors.yellow(log.hash.slice(0, 7));
        console.log(`      ${hash}  ${log.message}`);
      }
    }

    const action = await clack.select({
      message: 'What next?',
      options: [
        { value: 'back', label: '🔙 Back to contributors' },
        { value: 'menu', label: '🏠 Main menu' },
      ],
    });

    if (action === 'back') {
      await interactiveContributors();
    }
  } catch (err) {
    spinner.stop('Error');
    console.error(picocolors.red(`  ✖ ${err.message}`));
  }
}

/**
 * Browse commits interactively.
 */
async function interactiveCommits() {
  const spinner = clack.spinner();
  spinner.start('Loading recent commits...');

  try {
    const logs = await getLog({ maxCount: 20 });
    spinner.stop('Done');

    if (logs.length === 0) {
      console.log(picocolors.yellow('  No commits found.'));
      return;
    }

    const options = logs.map((log) => ({
      value: log,
      label: `${picocolors.yellow(log.hash.slice(0, 7))}  ${log.message.slice(0, 50)}`,
      hint: log.author,
    }));

    const selected = await clack.select({
      message: 'Select a commit:',
      options: [
        ...options,
        { value: '__back', label: '🔙 Back', hint: 'return to menu' },
      ],
    });

    if (clack.isCancel(selected) || selected === '__back') return;

    // Show commit details
    const details = await getCommitDetails(selected.hash);

    console.log('');
    console.log(picocolors.bold(`  ${selected.hash}`));
    console.log(`    ${picocolors.dim('Author:')}    ${details.author}`);
    console.log(`    ${picocolors.dim('Date:')}      ${details.date}`);
    console.log(`    ${picocolors.dim('Message:')}   ${details.message}`);
    console.log(`    ${picocolors.dim('Files:')}     ${details.filesChanged}`);
    console.log(`    ${picocolors.green(`+${details.insertions}`)} ${picocolors.red(`−${details.deletions}`)}`);

    if (details.fileList && details.fileList.length > 0) {
      console.log('');
      for (const f of details.fileList.slice(0, 10)) {
        console.log(`      ${picocolors.dim(f.path)}`);
      }
      if (details.fileList.length > 10) {
        console.log(picocolors.dim(`      ...and ${details.fileList.length - 10} more`));
      }
    }

    const action = await clack.select({
      message: 'What next?',
      options: [
        { value: 'back', label: '🔙 Back to commits' },
        { value: 'menu', label: '🏠 Main menu' },
      ],
    });

    if (action === 'back') {
      await interactiveCommits();
    }
  } catch (err) {
    spinner.stop('Error');
    console.error(picocolors.red(`  ✖ ${err.message}`));
  }
}

/**
 * Browse most modified files interactively.
 */
async function interactiveFiles() {
  const spinner = clack.spinner();
  spinner.start('Loading file statistics...');

  try {
    const files = await getMostModifiedFiles({ limit: 20 });
    spinner.stop('Done');

    if (files.length === 0) {
      console.log(picocolors.yellow('  No file data available.'));
      return;
    }

    const options = files.map((f) => ({
      value: f,
      label: `${String(f.commits).padStart(4)}  ${f.path}`,
    }));

    const selected = await clack.select({
      message: 'Select a file to analyze:',
      options: [
        ...options,
        { value: '__back', label: '🔙 Back', hint: 'return to menu' },
      ],
    });

    if (clack.isCancel(selected) || selected === '__back') return;

    // Show file ownership
    spinner.start('Analyzing file...');
    try {
      const repoRoot = await getRepoRoot();
      const fullPath = resolve(repoRoot, selected.path);
      const data = await getFileOwnership(fullPath);
      spinner.stop('');

      console.log(formatFileOwnership(data));
    } catch (err) {
      spinner.stop('Error');
      console.log(picocolors.yellow(`  Could not analyze ${selected.path}: ${err.message}`));
    }

    const action = await clack.select({
      message: 'What next?',
      options: [
        { value: 'back', label: '🔙 Back to files' },
        { value: 'menu', label: '🏠 Main menu' },
      ],
    });

    if (action === 'back') {
      await interactiveFiles();
    }
  } catch (err) {
    spinner.stop('Error');
    console.error(picocolors.red(`  ✖ ${err.message}`));
  }
}

/**
 * Interactive file blame.
 */
async function interactiveBlame() {
  const filePath = await clack.text({
    message: 'Enter file path to blame:',
    placeholder: 'e.g. src/index.js or src/auth.ts:42',
    validate: (value) => {
      if (!value || value.trim().length === 0) return 'Please enter a file path';
    },
  });

  if (clack.isCancel(filePath)) return;

  const spinner = clack.spinner();
  spinner.start('Analyzing...');

  try {
    const parsed = parseFileLine(filePath);

    const errors = await validateFile(parsed);
    if (errors.length > 0) {
      spinner.stop('Error');
      for (const err of errors) {
        console.log(picocolors.red(`  ✖ ${err}`));
      }
      return;
    }

    if (parsed.line !== null) {
      const data = await getLineBlame(parsed.filePath, parsed.line);
      spinner.stop('');
      console.log(formatLineBlame(data));
    } else {
      const data = await getFileOwnership(parsed.filePath);
      spinner.stop('');
      console.log(formatFileOwnership(data));
    }
  } catch (err) {
    spinner.stop('Error');
    console.error(picocolors.red(`  ✖ ${err.message}`));
  }
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Validate that we're in a valid git environment.
 *
 * @returns {Promise<{errors: string[], warnings: string[]}>}
 */
async function validateRepo() {
  const errors = [];
  const warnings = [];

  try {
    await execa('git', ['--version'], { timeout: 5000 });
  } catch {
    errors.push('Git is not installed or not in PATH.');
    return { errors, warnings };
  }

  try {
    await execa('git', ['rev-parse', '--git-dir'], { timeout: 5000 });
  } catch {
    errors.push('Not a Git repository.');
    errors.push('Run this command inside a Git project.');
    return { errors, warnings };
  }

  try {
    const shallow = await isShallowClone();
    if (shallow) {
      warnings.push('This is a shallow clone. Some history features may be limited.');
    }
  } catch {
    // Ignore
  }

  return { errors, warnings };
}

/**
 * Format a unix timestamp to short date.
 *
 * @param {string} timestamp
 * @returns {string}
 */
function formatShortDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(parseInt(timestamp, 10) * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
