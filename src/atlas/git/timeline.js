import { execa } from 'execa';

/**
 * @typedef {Object} TimelineEntry
 * @property {string} date - ISO date (YYYY-MM-DD)
 * @property {string} author - Author name
 * @property {number} commits - Commit count for that day
 */

/**
 * Get commit timeline data.
 * Groups commits by day from git log.
 *
 * @param {string} rootDir - Repository root
 * @param {object} [opts]
 * @param {number} [opts.sinceDays=365] - Lookback period
 * @param {boolean} [opts.groupByAuthor=false] - Group by author
 * @returns {Promise<TimelineEntry[]>}
 */
export async function getCommitTimeline(rootDir, opts = {}) {
  const sinceDays = opts.sinceDays || 365;

  try {
    const { stdout } = await execa('git', [
      'log', '--all',
      `--since="${sinceDays} days ago"`,
      '--format=%aI%x1f%an',
    ], { cwd: rootDir, timeout: 30000 });

    return parseTimelineOutput(stdout, opts.groupByAuthor);
  } catch {
    return [];
  }
}

/**
 * Parse git log --format output into timeline entries.
 *
 * @param {string} output
 * @param {boolean} groupByAuthor
 * @returns {TimelineEntry[]}
 */
function parseTimelineOutput(output, groupByAuthor) {
  const lines = output.trim().split('\n').filter(Boolean);
  const dateCounts = {};

  for (const line of lines) {
    const [isoDate, author] = line.split('\x1f');
    if (!isoDate) continue;

    const date = isoDate.slice(0, 10); // YYYY-MM-DD
    const key = groupByAuthor && author ? `${date}|${author}` : date;

    if (!dateCounts[key]) {
      dateCounts[key] = { date, author: author || 'unknown', commits: 0 };
    }
    dateCounts[key].commits++;
  }

  return Object.values(dateCounts).sort((a, b) => a.date.localeCompare(b.date));
}
