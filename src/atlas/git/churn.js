import { execa } from 'execa';

/**
 * @typedef {Object} ChurnData
 * @property {number} commits - Number of commits touching this file
 * @property {number} additions - Lines added
 * @property {number} deletions - Lines deleted
 */

/**
 * Get churn data for all tracked files using a single git log --numstat pass.
 *
 * @param {string} rootDir - Repository root
 * @param {object} [opts]
 * @param {number} [opts.sinceDays=365] - Lookback period in days
 * @returns {Promise<Object<string, ChurnData>>} - Map of filePath → churn data
 */
export async function getRepoChurn(rootDir, opts = {}) {
  const sinceDays = opts.sinceDays || 365;

  try {
    const { stdout } = await execa('git', [
      'log', '--all',
      `--since="${sinceDays} days ago"`,
      '--numstat',
      '--pretty=format:%H',
      '--diff-filter=AM',
    ], { cwd: rootDir, timeout: 120000 });

    return parseNumstatOutput(stdout);
  } catch {
    // Fallback: try without --since
    try {
      const { stdout } = await execa('git', [
        'log', '--all', '--numstat', '--pretty=format:%H', '--diff-filter=AM',
        '--max-count=1000',
      ], { cwd: rootDir, timeout: 60000 });

      return parseNumstatOutput(stdout);
    } catch {
      return {};
    }
  }
}

/**
 * Parse git log --numstat output.
 * Format:
 *   commit_hash (blank line for each commit)
 *   additions  deletions  filePath
 *   additions  deletions  filePath
 *
 * @param {string} output
 * @returns {Object<string, ChurnData>}
 */
function parseNumstatOutput(output) {
  const churnMap = {};
  let currentFile = null;

  const lines = output.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip commit hashes (40-char hex in standalone line)
    if (/^[0-9a-f]{40}$/.test(trimmed)) continue;

    // Parse numstat line
    const parts = trimmed.split('\t');
    if (parts.length >= 3) {
      const additions = parseInt(parts[0], 10);
      const deletions = parseInt(parts[1], 10);
      const filePath = parts[2];

      if (isNaN(additions) || isNaN(deletions)) continue;

      if (!churnMap[filePath]) {
        churnMap[filePath] = { commits: 0, additions: 0, deletions: 0 };
      }

      churnMap[filePath].commits++;
      churnMap[filePath].additions += additions;
      churnMap[filePath].deletions += deletions;
    }
  }

  return churnMap;
}

/**
 * Get churn data for a single file.
 *
 * @param {string} filePath
 * @param {string} rootDir
 * @returns {Promise<ChurnData>}
 */
export async function getFileChurn(filePath, rootDir) {
  try {
    const { stdout } = await execa('git', [
      'log', '--all',
      '--numstat',
      '--pretty=format:%H',
      '--diff-filter=AM',
      '--', filePath,
    ], { cwd: rootDir, timeout: 15000 });

    const result = parseNumstatOutput(stdout);
    return result[filePath] || { commits: 0, additions: 0, deletions: 0 };
  } catch {
    return { commits: 0, additions: 0, deletions: 0 };
  }
}
