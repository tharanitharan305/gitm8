import { execa } from 'execa';
import { getLog } from '../git/log.js';
import { formatTimestamp, formatRelativeDate } from '../utils/formatter.js';

/**
 * @typedef {Object} LineHistoryResult
 * @property {string|null} created - Human-readable date of first commit touching this line
 * @property {number} modifiedCount - Number of commits that changed this line
 * @property {string|null} lastChanged - Human-readable relative date of last modification
 * @property {Array<{hash: string, author: string, date: string, message: string}>} changes - Individual changes
 */

/**
 * Get the modification history for a specific line in a file.
 *
 * Uses `git log -L` to trace the lineage of a line across commits.
 * Falls back to git log with follow mode when -L is not supported.
 *
 * @param {string} filePath - Path relative to repo root
 * @param {number} line - Line number (1-based)
 * @returns {Promise<LineHistoryResult>}
 */
export async function getLineHistory(filePath, line) {
  try {
    // Primary approach: git log -L <line>,<line>:<file>
    return await getLineHistoryWithLogFollow(filePath, line);
  } catch {
    // Fallback: use git log --follow with content matching
    return await getLineHistoryFallback(filePath, line);
  }
}

/**
 * Use `git log -L` to trace a line's history.
 *
 * @param {string} filePath
 * @param {number} line
 * @returns {Promise<LineHistoryResult>}
 */
async function getLineHistoryWithLogFollow(filePath, line) {
  const { stdout } = await execa('git', [
    'log', '-L', `${line},${line}:${filePath}`,
    '-s', // suppress patch output
    '--format=%H%n%an%n%aI%n%at%n%s%x1e',
  ], { timeout: 30000 });

  const records = stdout.split('\x1e').filter(Boolean);
  const changes = [];

  for (const record of records) {
    const fields = record.trim().split('\n').filter(Boolean);
    if (fields.length >= 5) {
      changes.push({
        hash: fields[0],
        author: fields[1],
        date: fields[2],
        timestamp: fields[3],
        message: fields[4],
      });
    }
  }

  if (changes.length === 0) {
    return {
      created: null,
      modifiedCount: 0,
      lastChanged: null,
      changes: [],
    };
  }

  const first = changes[changes.length - 1];
  const last = changes[0];

  return {
    created: formatTimestamp(first.timestamp),
    modifiedCount: changes.length,
    lastChanged: formatRelativeDate(last.timestamp),
    changes: changes.map((c) => ({
      hash: c.hash,
      author: c.author,
      date: c.date,
      message: c.message,
    })),
  };
}

/**
 * Fallback: use git log --follow and count commits touching the file,
 * then look at commits for the general time range.
 *
 * @param {string} filePath
 * @param {number} line
 * @returns {Promise<LineHistoryResult>}
 */
async function getLineHistoryFallback(filePath, line) {
  // Get all commits that touched this file (with follow for renames)
  const logs = await getLog({
    file: filePath,
    maxCount: 100,
    all: false,
    format: [
      '%H', '%an', '%aI', '%at', '%s', '%b', '%D',
    ].join('%n%x1f') + '%n%x1e',
  });

  if (logs.length === 0) {
    return {
      created: null,
      modifiedCount: 0,
      lastChanged: null,
      changes: [],
    };
  }

  const first = logs[logs.length - 1];
  const last = logs[0];

  return {
    created: formatTimestamp(first.timestamp),
    modifiedCount: logs.length,
    lastChanged: formatRelativeDate(last.timestamp),
    changes: logs.map((log) => ({
      hash: log.hash,
      author: log.author,
      date: log.date,
      message: log.message,
    })),
  };
}
