import picocolors from 'picocolors';
import { getStatus, getShortStatus } from '../core/git.js';

/**
 * `gitm8 status`
 */
export default async function statusCommand() {
  try {
    const full = await getStatus();
    const short = await getShortStatus();

    // Color the full output for readability
    const lines = full.split('\n');
    for (const line of lines) {
      let colored = line;
      if (line.startsWith('On branch')) {
        colored = picocolors.bold(picocolors.cyan(line));
      } else if (line.startsWith('Your branch')) {
        colored = picocolors.green(line);
      } else if (line.includes('nothing to commit')) {
        colored = picocolors.green(line);
      } else if (line.includes('Changes to be committed')) {
        colored = picocolors.green(picocolors.bold(line));
      } else if (line.includes('Changes not staged')) {
        colored = picocolors.yellow(picocolors.bold(line));
      } else if (line.includes('Untracked files')) {
        colored = picocolors.red(picocolors.bold(line));
      } else if (line.startsWith('\t')) {
        // Color individual file entries
        if (line.includes('modified:')) colored = picocolors.yellow(line);
        else if (line.includes('new file:')) colored = picocolors.green(line);
        else if (line.includes('deleted:')) colored = picocolors.red(line);
        else if (line.includes('renamed:')) colored = picocolors.cyan(line);
      }
      console.log(colored);
    }

    // Print staged file count summary
    if (short.trim()) {
      const stagedCount = short.split('\n').filter((l) => l.trim().startsWith('M') || l.trim().startsWith('A') || l.trim().startsWith('D') || l.trim().startsWith('R')).length;
      const unstagedCount = short.split('\n').filter((l) => l.trim().startsWith(' M') || l.trim().startsWith(' D') || l.trim().startsWith('??')).length;
      console.log(picocolors.dim(`\n${stagedCount} staged, ${unstagedCount} unstaged changes`));
    }
  } catch (err) {
    console.error(picocolors.red(`✖ Failed to get status: ${err.stderr || err.message}`));
    process.exit(1);
  }
}
