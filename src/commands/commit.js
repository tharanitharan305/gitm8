import picocolors from 'picocolors';
import * as clack from '@clack/prompts';
import { getStagedDiff, commit as gitCommit } from '../core/git.js';
import { generateCommitMessage, TONE_MAP } from '../core/ai.js';
import { get, set } from '../core/config-store.js';

/**
 * `gitm8 commit`
 * @param {object} opts
 * @param {boolean} opts.dryRun
 * @param {boolean} opts.yes
 */
export default async function commitCommand(opts) {
  const { dryRun = false, yes = false } = opts;

  // Check for staged changes
  const diff = await getStagedDiff();
  if (!diff || diff.trim().length === 0) {
    console.error(picocolors.red('✖ No staged changes found.'));
    console.error(picocolors.yellow('  Stage your changes first:'));
    console.error(picocolors.yellow('    gitm8 add'));
    console.error(picocolors.yellow('    gitm8 add <file1> <file2> ...'));
    process.exit(1);
  }

  let currentTone = get('tone') || 'concise';
  let message = '';

  // Generate loop: allow retry with optional tone change
  while (true) {
    try {
      console.log(picocolors.dim(`\nGenerating commit message (tone: ${currentTone})...`));
      message = await generateCommitMessage(diff);
    } catch (err) {
      console.error(picocolors.red(`✖ ${err.message}`));
      process.exit(1);
    }

    console.log('\n' + picocolors.cyan('─'.repeat(60)));
    console.log(picocolors.bold('Proposed commit message:'));
    console.log(picocolors.cyan('─'.repeat(60)));
    console.log(picocolors.white(message));
    console.log(picocolors.cyan('─'.repeat(60)));

    if (dryRun) {
      console.log(picocolors.dim('\nℹ Dry run — not committing.'));
      return;
    }

    if (yes) {
      // Auto-accept skipping the interactive prompt
      break;
    }

    const action = await clack.select({
      message: 'How would you like to proceed?',
      options: [
        { value: 'accept', label: 'Accept and commit', hint: 'enter' },
        { value: 'edit', label: 'Edit message before committing' },
        { value: 'regenerate', label: 'Regenerate message' },
        { value: 'tone', label: 'Change tone and regenerate' },
        { value: 'quit', label: 'Quit without committing' },
      ],
    });

    if (clack.isCancel(action)) {
      console.log(picocolors.yellow('\nCommit cancelled.'));
      return;
    }

    switch (action) {
      case 'accept':
        break; // exit loop and commit
      case 'edit': {
        const edited = await clack.text({
          message: 'Edit the commit message:',
          initialValue: message,
          multiline: true,
        });
        if (clack.isCancel(edited)) continue;
        message = edited.trim();
        break;
      }
      case 'regenerate':
        continue; // re-run the loop
      case 'tone': {
        const toneResult = await changeTone();
        if (toneResult !== null) {
          currentTone = toneResult;
        }
        continue;
      }
      case 'quit':
        console.log(picocolors.yellow('Commit cancelled.'));
        return;
    }
    break; // only reached on 'accept' or 'edit'
  }

  // Perform the commit
  try {
    const { stdout } = await gitCommit(message);
    console.log(picocolors.green(`\n✔ Commit successful:`));
    console.log(picocolors.dim(stdout));
  } catch (err) {
    console.error(picocolors.red(`✖ Commit failed: ${err.stderr || err.message}`));
    process.exit(1);
  }
}

/**
 * Interactive tone changer shown during commit preview.
 * @returns {Promise<string|null>}
 */
async function changeTone() {
  const presets = Object.keys(TONE_MAP);
  const options = presets.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }));
  options.push({ value: 'custom', label: 'Custom tone' });

  const toneChoice = await clack.select({
    message: 'Select a tone:',
    options,
  });

  if (clack.isCancel(toneChoice)) return null;

  if (toneChoice === 'custom') {
    const custom = await clack.text({
      message: 'Describe the tone you want:',
      placeholder: 'e.g. "like a pirate" or "very technical and precise"',
    });
    if (clack.isCancel(custom)) return null;
    if (custom.trim()) {
      set('customTone', custom.trim());
    }
    return 'custom';
  }

  set('tone', toneChoice);
  set('customTone', '');
  return toneChoice;
}
