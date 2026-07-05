import picocolors from 'picocolors';

/**
 * Format a line blame result for terminal output.
 *
 * @param {object} data - Blame data from services/ownership
 * @param {object} [opts]
 * @param {boolean} [opts.json] - JSON output
 * @param {boolean} [opts.verbose] - Show extra details
 * @returns {string}
 */
export function formatLineBlame(data, opts = {}) {
  if (opts.json) {
    return JSON.stringify(data, null, 2);
  }

  const { file, line, blame, commit } = data;
  const lines = [];

  lines.push('');
  lines.push(picocolors.bold(picocolors.cyan(`  ${picocolors.underline(file)}`)));

  lines.push('');
  lines.push(`  ${picocolors.dim('Line')}`);
  lines.push(`  ${picocolors.bold(String(line))}`);

  lines.push('');
  lines.push(`  ${picocolors.dim('Author')}`);
  lines.push(`  ${blame.author}`);

  if (blame.authorMail) {
    lines.push('');
    lines.push(`  ${picocolors.dim('Email')}`);
    lines.push(`  ${blame.authorMail}`);
  }

  lines.push('');
  lines.push(`  ${picocolors.dim('Commit')}`);
  lines.push(`  ${picocolors.yellow(blame.commit?.slice(0, 7) || '')}`);

  lines.push('');
  lines.push(`  ${picocolors.dim('Date')}`);
  lines.push(`  ${blame.date || formatTimestamp(blame.authorTime)}`);

  lines.push('');
  lines.push(`  ${picocolors.dim('Message')}`);
  lines.push(`  ${blame.summary || ''}`);

  // Commit details
  if (commit) {
    lines.push('');
    lines.push(`  ${picocolors.dim('─').repeat(40)}`);
    lines.push('');

    // Files changed
    if (commit.fileList && commit.fileList.length > 0) {
      lines.push(`  ${picocolors.dim('Files changed')}`);
      for (const f of commit.fileList) {
        const icon = f.status === 'A' ? picocolors.green('+') :
                     f.status === 'D' ? picocolors.red('−') :
                     f.status === 'M' ? picocolors.yellow('~') : ' ';
        const displayPath = f.path.length > 60
          ? '...' + f.path.slice(-57)
          : f.path;
        lines.push(`    ${icon} ${displayPath}`);
      }
      lines.push('');
    }

    // Insertions / Deletions
    lines.push(`  ${picocolors.dim('Insertions')}`);
    lines.push(`  ${picocolors.green(`+${commit.insertions}`)}`);

    lines.push('');
    lines.push(`  ${picocolors.dim('Deletions')}`);
    lines.push(`  ${picocolors.red(`−${commit.deletions}`)}`);

    if (commit.parent) {
      lines.push('');
      lines.push(`  ${picocolors.dim('Parent')}`);
      lines.push(`  ${picocolors.dim(commit.parent.slice(0, 7))}`);
    }
  }

  // History
  if (data.history) {
    lines.push('');
    lines.push(`  ${picocolors.dim('─').repeat(40)}`);
    lines.push('');

    const { history } = data;

    if (history.created) {
      lines.push(`  ${picocolors.dim('History')}`);
      lines.push('');
      lines.push(`    ${picocolors.dim('Created')}`);
      lines.push(`    ${history.created}`);
      lines.push('');
      lines.push(`    ${picocolors.dim('Modified')}`);
      lines.push(`    ${history.modifiedCount} ${history.modifiedCount === 1 ? 'time' : 'times'}`);
      lines.push('');
      lines.push(`    ${picocolors.dim('Last changed')}`);
      lines.push(`    ${history.lastChanged}`);
    }
  }

  if (opts.verbose && blame.raw) {
    lines.push('');
    lines.push(`  ${picocolors.dim('─').repeat(40)}`);
    lines.push(`  ${picocolors.dim('Raw Metadata')}`);
    for (const [key, value] of Object.entries(blame.raw)) {
      if (value) {
        lines.push(`    ${picocolors.dim(key)}: ${value}`);
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Format file ownership data for terminal output.
 *
 * @param {object} data
 * @param {object} [opts]
 * @param {boolean} [opts.json]
 * @returns {string}
 */
export function formatFileOwnership(data, opts = {}) {
  if (opts.json) {
    return JSON.stringify(data, null, 2);
  }

  const { file, contributors, totalCommits, created, lastModified } = data;
  const lines = [];

  lines.push('');
  lines.push(picocolors.bold(picocolors.cyan(`  ${picocolors.underline(file)}`)));

  // Contributors section
  if (contributors && contributors.length > 0) {
    lines.push('');
    lines.push(`  ${picocolors.dim('Contributors')}`);
    lines.push('');

    // Calculate bar width
    const maxCommits = Math.max(...contributors.map((c) => c.commits));
    const barMax = 30;

    for (const c of contributors) {
      const barLen = maxCommits > 0
        ? Math.round((c.commits / maxCommits) * barMax)
        : 0;
      const bar = picocolors.cyan('█'.repeat(Math.max(barLen, 1)));

      const pct = c.percentage !== undefined
        ? picocolors.dim(`${String(Math.round(c.percentage)).padStart(2)}%`)
        : '';

      lines.push(`    ${picocolors.bold(c.name.padEnd(20))} ${bar} ${pct}`);
      lines.push(`    ${' '.repeat(20)} ${picocolors.dim(`${c.commits} commit${c.commits !== 1 ? 's' : ''}`)}`);
      lines.push('');
    }
  }

  // Summary
  lines.push(`  ${picocolors.dim('Commits')}`);
  lines.push(`  ${picocolors.bold(String(totalCommits))}`);

  if (created) {
    lines.push('');
    lines.push(`  ${picocolors.dim('Created')}`);
    lines.push(`  ${created}`);
  }

  if (lastModified) {
    lines.push('');
    lines.push(`  ${picocolors.dim('Last Modified')}`);
    lines.push(`  ${lastModified}`);
  }

  // Stats (if --stats flag)
  if (opts.stats && contributors) {
    const total = contributors.reduce((s, c) => s + c.commits, 0);
    const topContributor = contributors[0];
    const uniqueAuthors = contributors.length;

    lines.push('');
    lines.push(`  ${picocolors.dim('─').repeat(40)}`);
    lines.push('');
    lines.push(`  ${picocolors.dim('Statistics')}`);
    lines.push(`    ${picocolors.dim('Total authors:')}  ${uniqueAuthors}`);
    if (topContributor) {
      lines.push(`    ${picocolors.dim('Top contributor:')}  ${topContributor.name} (${topContributor.percentage}%)`);
    }
    lines.push(`    ${picocolors.dim('Average commits/author:')}  ${(total / uniqueAuthors).toFixed(1)}`);
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Format repository-level contributor data.
 *
 * @param {object} data
 * @param {object} [opts]
 * @param {boolean} [opts.json]
 * @returns {string}
 */
export function formatRepoContributors(data, opts = {}) {
  if (opts.json) {
    return JSON.stringify(data, null, 2);
  }

  const { contributors, topFiles, topDirs, recentActivity } = data;
  const lines = [];

  lines.push('');
  lines.push(picocolors.bold(picocolors.magenta('  📊 Repository Overview')));
  lines.push(picocolors.dim('  ─'.repeat(30)));

  // Top contributors
  if (contributors && contributors.length > 0) {
    lines.push('');
    lines.push(`  ${picocolors.dim('Top Contributors')}`);
    lines.push('');

    const maxCommits = Math.max(...contributors.map((c) => c.commits));

    for (const c of contributors) {
      const barLen = maxCommits > 0
        ? Math.round((c.commits / maxCommits) * 20)
        : 0;
      const bar = picocolors.magenta('█'.repeat(Math.max(barLen, 1)));
      lines.push(`    ${picocolors.bold(c.name.padEnd(20))} ${bar} ${picocolors.dim(String(c.commits))} commits`);
    }
  }

  // Most modified files
  if (topFiles && topFiles.length > 0) {
    lines.push('');
    lines.push(`  ${picocolors.dim('Most Modified Files')}`);
    lines.push('');

    for (const f of topFiles.slice(0, 8)) {
      const displayPath = f.path.length > 50
        ? '..' + f.path.slice(-48)
        : f.path;
      lines.push(`    ${picocolors.bold(String(f.commits).padStart(4))}  ${picocolors.dim(displayPath)}`);
    }
  }

  // Most active directories
  if (topDirs && topDirs.length > 0) {
    lines.push('');
    lines.push(`  ${picocolors.dim('Most Active Directories')}`);
    lines.push('');

    for (const d of topDirs.slice(0, 5)) {
      lines.push(`    ${picocolors.bold(String(d.commits).padStart(4))}  ${picocolors.dim(d.dir)}`);
    }
  }

  // Recent activity
  if (recentActivity && recentActivity.length > 0) {
    lines.push('');
    lines.push(`  ${picocolors.dim('Recent Activity')}`);
    lines.push('');

    for (const r of recentActivity.slice(0, 5)) {
      const hash = picocolors.yellow(r.hash.slice(0, 7));
      const msg = r.message.length > 50
        ? r.message.slice(0, 47) + '...'
        : r.message;
      lines.push(`    ${hash}  ${msg}`);
      lines.push(`    ${' '.repeat(9)}${picocolors.dim(r.author)} — ${picocolors.dim(r.relativeDate || r.date)}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Format a relative date string from a date input.
 *
 * @param {string} dateInput - ISO date or timestamp string
 * @returns {string}
 */
export function formatRelativeDate(dateInput) {
  if (!dateInput) return 'N/A';

  const now = Date.now();
  let date;

  // Try parsing as Unix timestamp
  if (/^\d+$/.test(dateInput)) {
    date = new Date(parseInt(dateInput, 10) * 1000);
  } else {
    date = new Date(dateInput);
  }

  if (isNaN(date.getTime())) return dateInput;

  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 60) return 'moments ago';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  if (diffWeek < 5) return `${diffWeek} week${diffWeek !== 1 ? 's' : ''} ago`;
  if (diffMonth < 12) return `${diffMonth} month${diffMonth !== 1 ? 's' : ''} ago`;
  return `${diffYear} year${diffYear !== 1 ? 's' : ''} ago`;
}

/**
 * Format a unix timestamp to a readable date.
 *
 * @param {string} timestamp - Unix timestamp
 * @returns {string}
 */
export function formatTimestamp(timestamp) {
  if (!timestamp) return 'N/A';
  const date = new Date(parseInt(timestamp, 10) * 1000);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
