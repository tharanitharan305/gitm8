import { execa } from 'execa';

/**
 * @typedef {Object} CommitDetails
 * @property {string} hash - Full commit hash
 * @property {string} author - Author name
 * @property {string} email - Author email
 * @property {string} date - ISO date
 * @property {string} message - Commit message subject
 * @property {string} body - Commit message body
 * @property {string} parent - Parent commit hash
 * @property {number} insertions - Lines inserted
 * @property {number} deletions - Lines deleted
 * @property {number} filesChanged - Number of files changed
 * @property {string[]} fileList - List of changed files
 */

/**
 * Get detailed information about a commit.
 *
 * @param {string} commitHash - Full or abbreviated commit SHA
 * @returns {Promise<CommitDetails>}
 */
export async function getCommitDetails(commitHash) {
  // Get the raw commit info
  const { stdout: logInfo } = await execa('git', [
    'log', '-1',
    '--format=%H%n%an%n%ae%n%aI%n%s%n%b%n%P',
    commitHash,
  ], { timeout: 10000 });

  const logLines = logInfo.split('\n');

  // Get diff stats (--shortstat or --numstat)
  const { stdout: diffStats } = await execa('git', [
    'diff-tree', '--no-commit-id', '-r', '--shortstat',
    commitHash,
  ], { timeout: 10000 });

  // Get list of changed files
  const { stdout: fileList } = await execa('git', [
    'diff-tree', '--no-commit-id', '-r', '--name-status',
    commitHash,
  ], { timeout: 10000 });

  // Parse shortstat: " 1 file changed, 42 insertions(+), 11 deletions(-)"
  const insertions = extractStat(diffStats, /(\d+) insertion/);
  const deletions = extractStat(diffStats, /(\d+) deletion/);
  const filesChanged = extractStat(diffStats, /(\d+) file/);

  // Parse file list
  const files = fileList
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, ...pathParts] = line.split('\t');
      return { status: status.trim(), path: pathParts.join('\t') };
    });

  // logLines: [hash, author, email, date, subject, body, parent]
  return {
    hash: logLines[0] || commitHash,
    author: logLines[1] || '',
    email: logLines[2] || '',
    date: logLines[3] || '',
    message: logLines[4] || '',
    body: logLines.slice(5, -1).join('\n').trim(),
    parent: logLines[logLines.length - 1] || '',
    insertions,
    deletions,
    filesChanged,
    fileList: files,
  };
}

/**
 * Extract a numeric stat from git output.
 *
 * @param {string} text
 * @param {RegExp} regex
 * @returns {number}
 */
function extractStat(text, regex) {
  const match = text.match(regex);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Get the raw diff for a commit (for --verbose mode).
 *
 * @param {string} commitHash
 * @returns {Promise<string>}
 */
export async function getCommitDiff(commitHash) {
  const { stdout } = await execa('git', [
    'show', commitHash, '--format=""', '--no-prefix',
  ], { timeout: 15000 });
  return stdout.trim();
}

/**
 * Attempt to open a commit URL in browser.
 * Builds URL from git remote origin URL.
 *
 * @param {string} commitHash
 * @returns {Promise<string|null>} - The URL, or null if no remote
 */
export async function getCommitUrl(commitHash) {
  try {
    const { stdout } = await execa('git', [
      'remote', 'get-url', 'origin',
    ], { timeout: 5000 });

    const url = stdout.trim();
    return buildCommitUrl(url, commitHash);
  } catch {
    return null;
  }
}

/**
 * Build a commit URL from a remote URL.
 *
 * @param {string} remoteUrl
 * @param {string} commitHash
 * @returns {string|null}
 */
function buildCommitUrl(remoteUrl, commitHash) {
  // Handle git@github.com:user/repo.git
  let normalized = remoteUrl;

  // Convert SSH to HTTPS
  if (normalized.startsWith('git@')) {
    normalized = normalized.replace(/^git@([^:]+):(.+)$/, 'https://$1/$2');
  }

  // Remove .git suffix
  normalized = normalized.replace(/\.git$/, '');

  // Supported hosts
  const providers = [
    { host: 'github.com', pattern: '/commit/' },
    { host: 'gitlab.com', pattern: '/commit/' },
    { host: 'bitbucket.org', pattern: '/commits/' },
  ];

  for (const provider of providers) {
    if (normalized.includes(provider.host)) {
      return `${normalized}${provider.pattern}${commitHash}`;
    }
  }

  // Generic attempt
  return `${normalized}/commit/${commitHash}`;
}
