import { program } from 'commander';
import picocolors from 'picocolors';
import { isInRepo } from './core/git.js';
import addCommand from './commands/add.js';
import commitCommand from './commands/commit.js';
import pushCommand from './commands/push.js';
import statusCommand from './commands/status.js';
import configCommand from './commands/config.js';
import pipelineCommand from './commands/pipeline.js';
import precheckCommand from './commands/precheck.js';
import secretsScanCommand from './commands/secrets-scan.js';
import vizCommand from './commands/viz.js';
import depsCommand from './commands/deps.js';
import whoCommand from './commands/who.js';
import atlasCommand from './commands/atlas.js';

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
  .command('precheck')
  .description('Detect framework → run build → push on success')
  .action(async () => {
    await requireRepo();
    await precheckCommand();
  });

program
  .command('secrets-scan')
  .description('Scan staged files for secrets, API keys, and credentials')
  .action(async () => {
    await requireRepo();
    await secretsScanCommand();
  });

program
  .command('viz')
  .description('Visualize class/method relationships in an interactive diagram')
  .action(async () => {
    await vizCommand();
  });

program
  .command('deps')
  .description('Analyze layered architecture — UI → Controllers → Services → Data')
  .action(async () => {
    await depsCommand();
  });

program
  .command('who')
  .description('Show ownership and contribution insights for files, lines, or the repo')
  .argument('[file]', 'File path, file:line, or "." for repo overview')
  .option('--json', 'Machine-readable JSON output')
  .option('--open', 'Open commit in browser if remote is configured')
  .option('--history', 'Show full modification history')
  .option('--stats', 'Show detailed ownership statistics')
  .option('--verbose', 'Display raw Git metadata')
  .action(async (file, opts) => {
    // Commander passes the argument and options separately
    await whoCommand(file, opts);
  });

program
  .command('atlas')
  .description('Interactive repository intelligence platform — graph, hotspots, timeline, layers')
  .option('--headless', 'Do not open browser')
  .option('--export <format>', 'Export mode: json, mermaid, svg')
  .option('--output <file>', 'Output file for export (use "-" for stdout)')
  .option('--watch', 'Watch files for changes and live-update the UI')
  .option('--no-cache', 'Force re-indexing from scratch')
  .option('--verbose', 'Show detailed progress information')
  .option('--view <name>', 'Open a specific view: report, architecture, layers, callflow, hotspots, timeline')
  .action(async (opts) => {
    await atlasCommand(opts);
  });

program
  .command('go')
  .description('Run your configured pipeline — add → scan → commit → precheck → push')
  .option('-y, --yes', 'Skip all manual prompts, run everything auto')
  .action(async (opts) => {
    await requireRepo();
    await pipelineCommand(opts);
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
