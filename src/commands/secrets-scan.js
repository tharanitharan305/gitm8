import picocolors from 'picocolors';
import * as clack from '@clack/prompts';
import { scanStagedSecrets } from '../core/secrets.js';
import { execa } from 'execa';

const SEVERITY_COLORS = {
  critical: picocolors.red,
  high: picocolors.yellow,
  medium: picocolors.cyan,
  low: picocolors.dim,
};

const SEVERITY_LABELS = {
  critical: picocolors.bold(picocolors.inverse(picocolors.red(' CRITICAL '))),
  high: picocolors.bold(picocolors.inverse(picocolors.yellow('   HIGH   '))),
  medium: picocolors.bold(picocolors.inverse(picocolors.cyan('  MEDIUM  '))),
  low: picocolors.bold(picocolors.inverse(picocolors.dim('   LOW    '))),
};

/**
 * `gitm8 secrets-scan`
 * Scan staged files for secrets, API keys, tokens, and credentials.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.ci]  Non-interactive mode — fail on critical/high
 */
export default async function secretsScanCommand(opts = {}) {
  const { ci = false } = opts;
  console.log('');
  console.log(picocolors.bold(picocolors.magenta('🔐 Secrets Scan')));
  console.log(picocolors.dim('  Scanning staged files for secrets, keys, and credentials...'));
  console.log(picocolors.dim('─'.repeat(50)));

  const findings = await scanStagedSecrets();

  if (findings.length === 0) {
    console.log('');
    console.log(picocolors.green('✔ No secrets detected in staged changes.'));
    console.log(picocolors.dim('  Clean — safe to commit.'));
    return;
  }

  // ── Group findings by severity ──────────────────────────────
  const bySeverity = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };

  for (const f of findings) {
    bySeverity[f.severity]?.push(f);
  }

  const criticalCount = bySeverity.critical.length;
  const highCount = bySeverity.high.length;
  const total = findings.length;

  // ── Display results ─────────────────────────────────────────
  console.log('');
  console.log(picocolors.bold(picocolors.yellow(`⚠  ${total} potential secret${total > 1 ? 's' : ''} found`)));
  console.log('');

  for (const severity of ['critical', 'high', 'medium', 'low']) {
    const group = bySeverity[severity];
    if (group.length === 0) continue;

    const color = SEVERITY_COLORS[severity];
    console.log(SEVERITY_LABELS[severity], color(`${group.length} result${group.length > 1 ? 's' : ''}:`));

    // Group by file for cleaner output
    const byFile = {};
    for (const f of group) {
      if (!byFile[f.file]) byFile[f.file] = [];
      byFile[f.file].push(f);
    }

    for (const [filePath, fileFindings] of Object.entries(byFile)) {
      console.log(`    ${picocolors.underline(filePath)}`);
      for (const f of fileFindings) {
        const lineStr = picocolors.dim(`L${f.line}:${f.column}`);
        const matchStr = picocolors.dim(`\`${f.match}\``);
        console.log(`      ${lineStr}  ${color(f.name)} — ${f.description}`);
        console.log(`             ${matchStr}`);
      }
    }
    console.log('');
  }

  // ── Summary ─────────────────────────────────────────────────
  console.log(picocolors.dim('─'.repeat(50)));
  if (criticalCount > 0) {
    console.log(picocolors.red(`⚠  ${criticalCount} critical secret${criticalCount > 1 ? 's' : ''} detected!`));
  }
  if (highCount > 0 && criticalCount === 0) {
    console.log(picocolors.yellow(`⚠  ${highCount} high-severity finding${highCount > 1 ? 's' : ''} — review before commit`));
  }

  // ── Interactive action prompt ───────────────────────────────
  if (criticalCount > 0 || highCount > 0) {
    console.log('');

    // CI mode: fail on critical, warn on high, no prompts
    if (ci) {
      console.log(picocolors.dim('  (CI mode — non-interactive)'));
      if (criticalCount > 0) {
        console.log(picocolors.red(`\n✖ ${criticalCount} critical secret${criticalCount > 1 ? 's' : ''} found.`));
        process.exit(1);
      }
      console.log(picocolors.yellow(`\n⚠  ${highCount} high-severity finding${highCount > 1 ? 's' : ''} — continuing`));
      return;
    }

    const action = await clack.select({
      message: criticalCount > 0
        ? picocolors.red('Critical secrets found! What would you like to do?')
        : picocolors.yellow('High-severity findings detected. What would you like to do?'),
      options: [
        {
          value: 'unstage',
          label: 'Unstage files with secrets',
          hint: 'remove from staging',
        },
        {
          value: 'continue',
          label: 'Continue anyway',
          hint: 'not recommended',
        },
        {
          value: 'cancel',
          label: 'Cancel and return',
          hint: 'review changes first',
        },
      ],
    });

    if (clack.isCancel(action)) {
      console.log(picocolors.yellow('\nCancelled.'));
      return;
    }

    switch (action) {
      case 'unstage': {
        // Collect all unique files with critical or high findings
        const filesToUnstage = [
          ...new Set([
            ...bySeverity.critical.map((f) => f.file),
            ...bySeverity.high.map((f) => f.file),
          ]),
        ];

        console.log(picocolors.cyan(`\nUnstaging ${filesToUnstage.length} file${filesToUnstage.length > 1 ? 's' : ''}...`));

        for (const file of filesToUnstage) {
          try {
            await execa('git', ['reset', file]);
            console.log(picocolors.dim(`  ⊘ ${picocolors.yellow(file)} — unstaged`));
          } catch (err) {
            console.error(picocolors.red(`  ✖ Failed to unstage ${file}: ${err.message}`));
          }
        }

        console.log(picocolors.green('\n✔ Secrets removed from staging.'));
        console.log(picocolors.dim('  Remove the secrets from the files, then stage again.'));
        break;
      }
      case 'continue': {
        console.log(picocolors.yellow('\n⚠  Pushing with secrets is risky.'));
        console.log(picocolors.dim('  Consider using .gitignore and environment variables instead.'));
        break;
      }
      case 'cancel': {
        console.log(picocolors.yellow('\nCancelled. Review your changes and run gitm8 secrets-scan again.'));
        return;
      }
    }
  }

  console.log('');
}
