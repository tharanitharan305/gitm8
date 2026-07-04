import picocolors from 'picocolors';
import { push, getCurrentBranch } from '../core/git.js';

/**
 * `gitm8 push`
 */
export default async function pushCommand() {
  const branch = await getCurrentBranch();

  console.log(picocolors.cyan(`Pushing branch: ${picocolors.bold(branch)}`));

  try {
    const { stdout, stderr } = await push();
    if (stdout) console.log(picocolors.green(stdout));
    if (stderr) console.error(picocolors.dim(stderr));
  } catch (err) {
    console.error(picocolors.red(`✖ Push failed:`));
    console.error(picocolors.red(err.stderr || err.message));
    process.exit(1);
  }
}
