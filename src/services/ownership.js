import { getBlame } from '../git/blame.js';
import { countFileCommits, getFirstCommit, getLastCommit, getLog } from '../git/log.js';
import { getContributors, getFileContributors } from '../git/contributors.js';
import { formatTimestamp, formatRelativeDate } from '../utils/formatter.js';

/**
 * @typedef {Object} FileOwnershipResult
 * @property {string} file - File path
 * @property {Array<{name: string, email: string, commits: number, percentage: number}>} contributors
 * @property {number} totalCommits
 * @property {string|null} created
 * @property {string|null} lastModified
 */

/**
 * @typedef {Object} LineBlameResult
 * @property {string} file - File path
 * @property {number} line - Line number
 * @property {object} blame - Blame entry data
 * @property {object|null} commit - Commit details
 * @property {object|null} history - Line history data
 */

/**
 * Get file ownership statistics.
 *
 * @param {string} filePath - Path relative to repo root
 * @returns {Promise<FileOwnershipResult>}
 */
export async function getFileOwnership(filePath) {
  const [contributors, totalCommits, firstCommit, lastCommit] = await Promise.all([
    getFileContributors(filePath),
    countFileCommits(filePath),
    getFirstCommit(filePath),
    getLastCommit(filePath),
  ]);

  const totalCommitsFromContributors = contributors.reduce((s, c) => s + c.commits, 0);

  // Calculate percentages
  const contributorPercentages = contributors.map((c) => ({
    name: c.name,
    email: c.email,
    commits: c.commits,
    percentage: totalCommitsFromContributors > 0
      ? Math.round((c.commits / totalCommitsFromContributors) * 100)
      : 0,
  }));

  return {
    file: filePath,
    contributors: contributorPercentages,
    totalCommits: totalCommits || totalCommitsFromContributors,
    created: firstCommit
      ? formatTimestamp(firstCommit.timestamp)
      : null,
    lastModified: lastCommit
      ? formatRelativeDate(lastCommit.timestamp)
      : null,
  };
}

/**
 * Get blame data for a specific line.
 *
 * @param {string} filePath - Path relative to repo root
 * @param {number} line - Line number
 * @returns {Promise<LineBlameResult>}
 */
export async function getLineBlame(filePath, line) {
  const { getBlameForLine } = await import('../git/blame.js');
  const { getCommitDetails } = await import('../git/show.js');
  const { getLineHistory } = await import('./history.js');

  const [blame, history] = await Promise.all([
    getBlameForLine(filePath, line),
    getLineHistory(filePath, line),
  ]);

  if (!blame) {
    return {
      file: filePath,
      line,
      blame: { author: 'Unknown', summary: 'No blame data' },
      commit: null,
      history,
    };
  }

  let commit = null;
  try {
    commit = await getCommitDetails(blame.commit);
  } catch {
    // Commit details may fail for some edge cases
  }

  return {
    file: filePath,
    line,
    blame: {
      commit: blame.commit,
      author: blame.author,
      authorMail: blame.authorMail,
      authorTime: blame.authorTime,
      committer: blame.committer,
      summary: blame.summary,
      previousLine: blame.originalLine,
      currentLine: blame.finalLine,
      date: formatTimestamp(blame.authorTime),
      raw: blame,
    },
    commit: commit ? {
      hash: commit.hash,
      author: commit.author,
      email: commit.email,
      date: commit.date,
      message: commit.message,
      body: commit.body,
      parent: commit.parent,
      insertions: commit.insertions,
      deletions: commit.deletions,
      filesChanged: commit.filesChanged,
      fileList: commit.fileList,
    } : null,
    history,
  };
}

/**
 * Get repo-level contributor statistics.
 *
 * @param {object} [opts]
 * @param {number} [opts.contributorLimit=15]
 * @param {number} [opts.fileLimit=10]
 * @param {number} [opts.dirLimit=5]
 * @returns {Promise<object>}
 */
export async function getRepoOwnership(opts = {}) {
  const contributorLimit = opts.contributorLimit || 15;
  const fileLimit = opts.fileLimit || 10;
  const dirLimit = opts.dirLimit || 5;

  const [contributors, topFiles, topDirs, recentLogs] = await Promise.all([
    getContributors({ limit: contributorLimit }),
    import('../git/contributors.js').then((m) =>
      m.getMostModifiedFiles({ limit: fileLimit })
    ),
    import('../git/contributors.js').then((m) =>
      m.getMostActiveDirectories({ limit: dirLimit })
    ),
    getLog({ maxCount: 10 }),
  ]);

  return {
    contributors: contributors.map((c) => ({
      name: c.name,
      email: c.email,
      commits: c.commits,
    })),
    topFiles: topFiles.map((f) => ({
      path: f.path,
      commits: f.commits,
    })),
    topDirs: topDirs.map((d) => ({
      dir: d.dir,
      commits: d.commits,
    })),
    recentActivity: recentLogs.map((log) => ({
      hash: log.hash,
      author: log.author,
      message: log.message,
      date: log.date,
      relativeDate: formatRelativeDate(log.timestamp),
    })),
  };
}
