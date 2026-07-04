import picocolors from 'picocolors';
import { add, getStagedSummary } from '../core/git.js';

/**
 * `gitm8 add [files...]`
 * @param {string[]} files
 * @param {object} opts
 */
export default async function addCommand(files, opts) {
  const { stdout, stderr } = await add(files);

  // Show colored summary of staged files
  const summary = await getStagedSummary();
  if (summary.trim()) {
    console.log(picocolors.green('✔ Staged files:'));
    const lines = summary.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      const [status, ...nameParts] = line.split('\t');
      const name = nameParts.join('\t');
      let colored;
      if (status.startsWith('M')) colored = picocolors.yellow(`  ${status}\t${name}`);
      else if (status.startsWith('A')) colored = picocolors.green(`  ${status}\t${name}`);
      else if (status.startsWith('D')) colored = picocolors.red(`  ${status}\t${name}`);
      else if (status.startsWith('R')) colored = picocolors.cyan(`  ${status}\t${name}`);
      else colored = `  ${status}\t${name}`;
      console.log(colored);
    }
  } else {
    console.log(picocolors.yellow('⚠ No files staged.'));
  }

  if (stderr) console.error(picocolors.dim(stderr));
}
