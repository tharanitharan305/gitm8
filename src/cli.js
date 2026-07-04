import { program } from 'commander';
import picocolors from 'picocolors';
import { isInRepo } from './core/git.js';
import addCommand from './commands/add.js';
import commitCommand from './commands/commit.js';
import pushCommand from './commands/push.js';
import statusCommand from './commands/status.js';
import configCommand from './commands/config.js';

const pkg = { version: '1.0.0', description: 'AI-powered Git CLI wrapper' };

/**
 * Require being inside a git repository before running a command.
 */
async function requireRepo() {
  if (!(await isInRepo())) {
    console.error(picocolors.red('✖ Not inside a git repository.'));
    console.error(picocolors.yellow('  Run gitm8 commands from within a git-tracked directory.'));
    process.exit(1);
  }
}

program
  .name('gitm8')
  .description(pkg.description)
  .version(pkg.version);

program
  .command('add')
  .description('Stage files (defaults to all)')
  .argument('[files...]', 'Files to stage')
  .action(async (files) => {
    await requireRepo();
    await addCommand(files || []);
  });

program
  .command('commit')
  .description('Generate an AI commit message and commit staged changes')
  .option('--dry-run', 'Show the generated message without committing')
  .option('-y, --yes', 'Skip interactive review and commit immediately')
  .action(async (opts) => {
    await requireRepo();
    await commitCommand(opts);
  });

program
  .command('push')
  .description('Push current branch to origin (sets upstream if needed)')
  .action(async () => {
    await requireRepo();
    await pushCommand();
  });

program
  .command('status')
  .description('Show working tree status (colored)')
  .action(async () => {
    await requireRepo();
    await statusCommand();
  });

program
  .command('config')
  .description('Manage gitm8 configuration')
  .argument('[subcommand]', 'get, set, or list')
  .argument('[args...]', 'Key and value for set, or key for get')
  .option('--ui', 'Open the settings UI in a browser')
  .action(async (subcommand, args, opts) => {
    // If no subcommand and no --ui, show help
    if (!subcommand && !opts.ui) {
      program.commands.find((c) => c.name() === 'config').help();
      return;
    }
    await configCommand(subcommand || 'list', args || [], opts);
  });

// If no command is given, show help
program.on('command:*', () => {
  console.error(picocolors.red(`✖ Unknown command: ${program.args.join(' ')}`));
  console.error(picocolors.yellow('  See gitm8 --help for available commands.'));
  process.exit(1);
});

// Parse and run
program.parse(process.argv);
