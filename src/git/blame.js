import { execa } from 'execa';

/**
 * @typedef {Object} BlameEntry
 * @property {string} commit - Commit SHA
 * @property {string} author - Author name
 * @property {string} authorMail - Author email
 * @property {string} authorTime - Author timestamp (Unix)
 * @property {string} authorTz - Author timezone
 * @property {string} committer - Committer name
 * @property {string} committerMail - Committer email
 * @property {string} committerTime - Committer timestamp
 * @property {string} committerTz - Committer timezone
 * @property {string} summary - Commit message
 * @property {number} originalLine - Line number in original commit
 * @property {number} finalLine - Line number in final file
 * @property {string|null} previous - Previous commit SHA (null if first)
 */

/**
 * Run `git blame -p` on a file and parse the output.
 *
 * @param {string} filePath - Path relative to repo root
 * @param {object} [opts]
 * @param {number} [opts.line] - Single line to blame
 * @param {number} [opts.endLine] - End line for a range
 * @returns {Promise<BlameEntry[]>}
 */
export async function getBlame(filePath, opts = {}) {
  const args = ['blame', '-p', '--incremental'];
  if (opts.line) {
    const end = opts.endLine || opts.line;
    args.push(`-L${opts.line},${end}`);
  }
  args.push('--', filePath);

  const { stdout } = await execa('git', args, { timeout: 30000 });

  return parseBlameOutput(stdout);
}

/**
 * Parse the porcelain blame output.
 * Format:
 *   <commit> <original-line> <final-line> <group-size>
 *   author <name>
 *   author-mail <email>
 *   author-time <timestamp>
 *   author-tz <timezone>
 *   committer <name>
 *   committer-mail <email>
 *   committer-time <timestamp>
 *   committer-tz <timezone>
 *   summary <text>
 *   previous <commit> <file>
 *   filename <file>
 *   <tab-indented content lines...>
 *
 * @param {string} output - Raw blame output
 * @returns {BlameEntry[]}
 */
function parseBlameOutput(output) {
  const lines = output.split('\n');
  const entries = [];
  let current = null;
  let inBody = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty
    if (!line.trim()) continue;

    // Check if this is a header line (starts with a SHA or commit marker)
    // A header line is: <40-char-hex> <orig-line> <final-line> <group-size>
    // But in incremental mode, it's: <sha> <orig> <final> <size>
    if (!inBody && /^[0-9a-f]{40} \d+ \d+ \d+$/.test(line)) {
      if (current) entries.push(current);
      const parts = line.split(' ');
      current = {
        commit: parts[0],
        originalLine: parseInt(parts[1], 10),
        finalLine: parseInt(parts[2], 10),
        groupSize: parseInt(parts[3], 10),
      };
      inBody = true;
      continue;
    }

    if (!current) continue;

    // Parse header fields
    if (line.startsWith('author ')) {
      current.author = line.slice(7);
    } else if (line.startsWith('author-mail ')) {
      current.authorMail = line.slice(12).replace(/[<>]/g, '');
    } else if (line.startsWith('author-time ')) {
      current.authorTime = line.slice(12);
    } else if (line.startsWith('author-tz ')) {
      current.authorTz = line.slice(10);
    } else if (line.startsWith('committer ')) {
      current.committer = line.slice(10);
    } else if (line.startsWith('committer-mail ')) {
      current.committerMail = line.slice(15).replace(/[<>]/g, '');
    } else if (line.startsWith('committer-time ')) {
      current.committerTime = line.slice(15);
    } else if (line.startsWith('committer-tz ')) {
      current.committerTz = line.slice(13);
    } else if (line.startsWith('summary ')) {
      current.summary = line.slice(8);
    } else if (line.startsWith('previous ')) {
      const p = line.slice(9).split(' ');
      current.previous = p[0];
    } else if (line.startsWith('filename ')) {
      current.filename = line.slice(9);
      inBody = false; // End of header
    }
    // Content lines are tab-indented and we skip them
  }

  if (current) entries.push(current);
  return entries;
}

/**
 * Get blame for a single line of a file.
 *
 * @param {string} filePath - Path relative to repo root
 * @param {number} line - Line number (1-based)
 * @returns {Promise<BlameEntry|null>}
 */
export async function getBlameForLine(filePath, line) {
  const entries = await getBlame(filePath, { line, endLine: line });
  return entries.length > 0 ? entries[0] : null;
}
