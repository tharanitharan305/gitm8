import { execa } from 'execa';

/**
 * Check whether cwd is inside a git repository.
 * @returns {Promise<boolean>}
 */
export async function isInRepo() {
  try {
    await execa('git', ['rev-parse', '--git-dir']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Stage files. Defaults to '.' if no files given.
 * @param {string[]} files
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
export async function add(files) {
  const args = files.length > 0 ? ['add', ...files] : ['add', '.'];
  return execa('git', args);
}

/**
 * Get a summary of staged files (names + status).
 * @returns {Promise<string>}
 */
export async function getStagedSummary() {
  const { stdout } = await execa('git', ['diff', '--cached', '--name-status']);
  return stdout;
}

/**
 * Get the staged diff (for AI commit message generation).
 * @returns {Promise<string>}
 */
export async function getStagedDiff() {
  const { stdout } = await execa('git', ['diff', '--cached']);
  return stdout;
}

/**
 * Commit with a message.
 * @param {string} message
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
export async function commit(message) {
  return execa('git', ['commit', '-m', message]);
}

/**
 * Get current branch name.
 * @returns {Promise<string>}
 */
export async function getCurrentBranch() {
  const { stdout } = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  return stdout.trim();
}

/**
 * Check whether the current branch has an upstream configured.
 * @returns {Promise<boolean>}
 */
export async function hasUpstream() {
  try {
    const { stdout } = await execa('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Push current branch. Sets upstream if needed.
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
export async function push() {
  const branch = await getCurrentBranch();
  const upstream = await hasUpstream();
  if (upstream) {
    return execa('git', ['push']);
  }
  return execa('git', ['push', '-u', 'origin', branch]);
}

/**
 * Get git status output.
 * @returns {Promise<string>}
 */
export async function getStatus() {
  const { stdout } = await execa('git', ['status']);
  return stdout;
}

/**
 * Get a short status summary.
 * @returns {Promise<string>}
 */
export async function getShortStatus() {
  const { stdout } = await execa('git', ['status', '--short']);
  return stdout;
}
