import { execa } from 'execa';

/**
 * @typedef {Object} LogEntry
 * @property {string} hash - Commit hash
 * @property {string} author - Author name
 * @property {string} email - Author email
 * @property {string} date - ISO date string
 * @property {string} timestamp - Unix timestamp
 * @property {string} message - Commit message subject
 * @property {string} body - Commit message body
 * @property {string} refs - Branch/tag refs
 */

/**
 * Run `git log` with a custom format and parse results.
 *
 * @param {object} [opts]
 * @param {string} [opts.file] - File path to filter commits for
 * @param {number} [opts.maxCount] - Max number of commits
 * @param {string} [opts.author] - Filter by author
 * @param {string} [opts.since] - Date range start
 * @param {string} [opts.until] - Date range end
 * @param {string} [opts.path] - Path filter
 * @param {boolean} [opts.all] - All branches
 * @param {boolean} [opts.diffFilter] - Skip diffs for speed
 * @param {boolean} [opts.firstParent] - Follow first parent only
 * @param {string} [opts.format] - Custom format
 * @returns {Promise<LogEntry[]>}
 */
export async function getLog(opts = {}) {
  const args = ['log'];

  if (opts.all) args.push('--all');
  if (opts.firstParent) args.push('--first-parent');
  if (opts.maxCount) args.push(`--max-count=${opts.maxCount}`);
  if (opts.author) args.push(`--author=${opts.author}`);
  if (opts.since) args.push(`--since=${opts.since}`);
  if (opts.until) args.push(`--until=${opts.until}`);

  // Use a delimiter-safe format
  const format = opts.format || [
    '%H',       // hash
    '%an',      // author name
    '%ae',      // author email
    '%aI',      // author date (ISO)
    '%at',      // author timestamp
    '%s',       // subject
    '%b',       // body
    '%D',       // refs
  ].join('%n%x1f'); // newline + unit separator between fields

  args.push(`--format=${format}%n%x1e`); // record separator as record delimiter

  if (opts.file) args.push('--', opts.file);
  if (opts.path) args.push('--', opts.path);

  const { stdout } = await execa('git', args, { timeout: 30000 });
  return parseLogOutput(stdout);
}

/**
 * Parse structured log output.
 * Records are separated by \x1e, fields by \x1f.
 *
 * @param {string} output
 * @returns {LogEntry[]}
 */
function parseLogOutput(output) {
  if (!output.trim()) return [];

  const records = output.split('\x1e').filter(Boolean);
  return records.map((record) => {
    const fields = record.trim().split('\x1f').map((f) => f.trim());
    return {
      hash: fields[0] || '',
      author: fields[1] || '',
      email: fields[2] || '',
      date: fields[3] || '',
      timestamp: fields[4] || '',
      message: fields[5] || '',
      body: fields.slice(6, -1).join('\n').trim(), // everything before refs
      refs: fields[fields.length - 1] || '',
    };
  });
}

/**
 * Count total commits for a file.
 *
 * @param {string} filePath
 * @returns {Promise<number>}
 */
export async function countFileCommits(filePath) {
  const { stdout } = await execa('git', [
    'rev-list', '--count', 'HEAD', '--', filePath,
  ], { timeout: 15000 });
  return parseInt(stdout.trim(), 10) || 0;
}

/**
 * Count total commits across the whole repo.
 *
 * @returns {Promise<number>}
 */
export async function countRepoCommits() {
  const { stdout } = await execa('git', [
    'rev-list', '--count', 'HEAD',
  ], { timeout: 15000 });
  return parseInt(stdout.trim(), 10) || 0;
}

/**
 * Get the first commit that touched a file.
 *
 * @param {string} filePath
 * @returns {Promise<LogEntry|null>}
 */
export async function getFirstCommit(filePath) {
  // Use --reverse to get oldest commits first, then take the first
  const args = [
    'log', '--follow', '--reverse',
    '--format=%H%n%an%n%ae%n%aI%n%at%n%s%n%b%n%D%n%x1e',
    '--diff-filter=A',
    '--', filePath,
  ];

  try {
    const { stdout } = await execa('git', args, { timeout: 15000 });
    const records = stdout.split('\x1e').filter(Boolean);
    if (records.length === 0) return null;

    const fields = records[0].trim().split('\n').filter(Boolean);
    return {
      hash: fields[0] || '',
      author: fields[1] || '',
      email: fields[2] || '',
      date: fields[3] || '',
      timestamp: fields[4] || '',
      message: fields[5] || '',
      body: fields.slice(6, -1).join('\n').trim(),
      refs: fields[fields.length - 1] || '',
    };
  } catch {
    // Fallback: try without --diff-filter=A if the file was renamed
    try {
      const { stdout } = await execa('git', [
        'log', '--follow', '--reverse',
        '--format=%H%n%an%n%ae%n%aI%n%at%n%s%n%b%n%D%n%x1e',
        '--', filePath,
      ], { timeout: 15000 });
      const records = stdout.split('\x1e').filter(Boolean);
      if (records.length === 0) return null;
      const fields = records[0].trim().split('\n').filter(Boolean);
      return {
        hash: fields[0] || '',
        author: fields[1] || '',
        email: fields[2] || '',
        date: fields[3] || '',
        timestamp: fields[4] || '',
        message: fields[5] || '',
        body: fields.slice(6, -1).join('\n').trim(),
        refs: fields[fields.length - 1] || '',
      };
    } catch {
      return null;
    }
  }
}

/**
 * Get the most recent commit that touched a file.
 *
 * @param {string} filePath
 * @returns {Promise<LogEntry|null>}
 */
export async function getLastCommit(filePath) {
  const logs = await getLog({
    file: filePath,
    maxCount: 1,
    format: [
      '%H', '%an', '%ae', '%aI', '%at', '%s', '%b', '%D',
    ].join('%n%x1f') + '%n%x1e',
  });
  return logs.length > 0 ? logs[0] : null;
}
