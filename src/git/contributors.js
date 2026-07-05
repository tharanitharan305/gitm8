import { execa } from 'execa';

/**
 * @typedef {Object} ContributorSummary
 * @property {string} name - Author name
 * @property {string} email - Author email
 * @property {number} commits - Total commits
 * @property {number} insertions - Total insertions
 * @property {number} deletions - Total deletions
 * @property {number} filesChanged - Total files changed
 */

/**
 * @typedef {Object} FileChangeSummary
 * @property {string} path - File path
 * @property {number} commits - Commits touching this file
 * @property {number} insertions - Total insertions
 * @property {number} deletions - Total deletions
 */

/**
 * Get top contributors across the entire repository.
 *
 * @param {object} [opts]
 * @param {number} [opts.limit=20] - Max contributors
 * @param {string} [opts.file] - Filter to a specific file
 * @returns {Promise<ContributorSummary[]>}
 */
export async function getContributors(opts = {}) {
  const limit = opts.limit || 20;

  if (opts.file) {
    // shortlog doesn't support file paths directly, so we use log + shortlog
    const { stdout } = await execa('git', [
      'log', '--all', '--format=%an%n%ae', '--', opts.file,
    ], { timeout: 30000 });

    return parseContributorPairs(stdout, limit);
  }

  const { stdout } = await execa('git', ['shortlog', '-sne', '--all'], { timeout: 30000 });
  return parseShortlog(stdout, limit);
}

/**
 * Parse `git shortlog -sne` output.
 * Format: "  42\tAuthor Name <email>"
 *
 * @param {string} output
 * @param {number} limit
 * @returns {ContributorSummary[]}
 */
function parseShortlog(output, limit) {
  const lines = output.trim().split('\n').filter(Boolean);
  const merged = new Map(); // normalized name → { name, email, commits }

  for (const line of lines) {
    const match = line.match(/^\s*(\d+)\s+(.+?)\s*<\s*(.+?)\s*>\s*$/);
    if (!match) continue;

    const name = match[2].trim();
    const email = match[3].trim();
    const commits = parseInt(match[1], 10);
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (merged.has(normalized)) {
      const existing = merged.get(normalized);
      existing.commits += commits;
      // Prefer the entry with more commits' name/email
      if (commits > existing.commits - commits) {
        existing.name = name;
        existing.email = email;
      }
    } else {
      merged.set(normalized, { name, email, commits });
    }
  }

  return [...merged.values()]
    .sort((a, b) => b.commits - a.commits)
    .slice(0, limit);
}

/**
 * Parse contributor data from --format output (name + email pairs).
 *
 * @param {string} output
 * @param {number} limit
 * @returns {ContributorSummary[]}
 */
function parseContributorPairs(output, limit) {
  const lines = output.trim().split('\n').filter(Boolean);
  const merged = new Map(); // normalized name → { name, email, commits }

  for (let i = 0; i < lines.length - 1; i += 2) {
    const name = lines[i].trim();
    const email = lines[i + 1].trim();
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (merged.has(normalized)) {
      const existing = merged.get(normalized);
      existing.commits += 1;
    } else {
      merged.set(normalized, { name, email, commits: 1 });
    }
  }

  return [...merged.values()]
    .sort((a, b) => b.commits - a.commits)
    .slice(0, limit)
    .map((c) => ({
      name: c.name,
      email: c.email,
      commits: c.commits,
      insertions: 0,
      deletions: 0,
      filesChanged: 0,
    }));
}

/**
 * Get commit stats per contributor for a file using shortlog.
 *
 * @param {string} filePath
 * @returns {Promise<ContributorSummary[]>}
 */
export async function getFileContributors(filePath) {
  return getContributors({ file: filePath, limit: 100 });
}

/**
 * Get the most frequently modified files.
 *
 * @param {object} [opts]
 * @param {number} [opts.limit=15]
 * @returns {Promise<FileChangeSummary[]>}
 */
export async function getMostModifiedFiles(opts = {}) {
  const limit = opts.limit || 15;

  // Use git log --name-only to count commit frequency per file
  const { stdout } = await execa('git', [
    'log', '--all', '--pretty=format:', '--name-only', '--diff-filter=ACDMR',
  ], { timeout: 60000 });

  const fileCounts = new Map();
  const lines = stdout.split('\n').filter(Boolean);

  for (const file of lines) {
    const trimmed = file.trim();
    if (!trimmed) continue;

    // Skip binary or generated files
    if (isGeneratedFile(trimmed)) continue;

    fileCounts.set(trimmed, (fileCounts.get(trimmed) || 0) + 1);
  }

  return [...fileCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([path, commits]) => ({
      path,
      commits,
      insertions: 0,
      deletions: 0,
    }));
}

/**
 * Get the most active directories.
 *
 * @param {object} [opts]
 * @param {number} [opts.limit=10]
 * @returns {Promise<{dir: string, commits: number}[]>}
 */
export async function getMostActiveDirectories(opts = {}) {
  const limit = opts.limit || 10;

  const { stdout } = await execa('git', [
    'log', '--all', '--pretty=format:', '--name-only', '--diff-filter=ACDMR',
  ], { timeout: 60000 });

  const dirCounts = new Map();
  const lines = stdout.split('\n').filter(Boolean);

  for (const file of lines) {
    const trimmed = file.trim();
    if (!trimmed) continue;
    if (isGeneratedFile(trimmed)) continue;

    // Extract directory
    const lastSlash = trimmed.lastIndexOf('/');
    if (lastSlash === -1) continue; // root-level file
    const dir = trimmed.slice(0, lastSlash);

    dirCounts.set(dir, (dirCounts.get(dir) || 0) + 1);
  }

  return [...dirCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([dir, commits]) => ({ dir, commits }));
}

/**
 * Check if a path looks like a generated file.
 *
 * @param {string} filePath
 * @returns {boolean}
 */
function isGeneratedFile(filePath) {
  return /\.(g|freezed|gen|config)\.(dart|ts|js)$/.test(filePath) ||
         /\.(min|bundle|chunk)\.[a-z0-9]+\.(js|css)$/.test(filePath) ||
         filePath.includes('node_modules/') ||
         filePath.includes('package-lock.json') ||
         filePath.includes('yarn.lock');
}
