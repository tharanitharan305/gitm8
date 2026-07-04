import picocolors from 'picocolors';
import { get, set, list, getConfigPath } from '../core/config-store.js';
import { startServer } from '../ui/server.js';

/**
 * `gitm8 config <subcommand>`
 * @param {string} subcommand
 * @param {string[]} args
 * @param {object} opts
 * @param {boolean} opts.ui
 */
export default async function configCommand(subcommand, args, opts) {
  const { ui } = opts;

  if (ui) {
    await startServer();
    return;
  }

  switch (subcommand) {
    case 'get': {
      const key = args[0];
      if (!key) {
        console.error(picocolors.red('✖ Usage: gitm8 config get <key>'));
        process.exit(1);
      }
      const value = get(key);
      if (value === undefined) {
        console.error(picocolors.yellow(`Key "${key}" not found.`));
        process.exit(1);
      }
      if (key === 'apiKey') {
        console.log(maskKey(value));
      } else {
        console.log(value);
      }
      break;
    }

    case 'set': {
      const key = args[0];
      const value = args.slice(1).join(' ');
      if (!key || value === undefined) {
        console.error(picocolors.red('✖ Usage: gitm8 config set <key> <value>'));
        process.exit(1);
      }
      const validKeys = ['apiBaseUrl', 'apiKey', 'model', 'tone', 'commitStyle', 'maxDiffChars', 'customTone', 'pipelineSecretsScan', 'pipelinePrecheck', 'pipelineAutoPush'];
      if (!validKeys.includes(key)) {
        console.error(picocolors.red(`✖ Unknown key "${key}". Valid keys: ${validKeys.join(', ')}`));
        process.exit(1);
      }
      // Coerce types
      let parsed = value;
      if (key === 'maxDiffChars') {
        parsed = parseInt(value, 10);
        if (isNaN(parsed) || parsed < 1000 || parsed > 50000) {
          console.error(picocolors.red('✖ maxDiffChars must be a number between 1000 and 50000.'));
          process.exit(1);
        }
      } else if (key.startsWith('pipeline')) {
        // Boolean pipeline toggles
        if (value === 'true' || value === '1' || value === 'yes') {
          parsed = true;
        } else if (value === 'false' || value === '0' || value === 'no') {
          parsed = false;
        } else {
          console.error(picocolors.red(`✖ ${key} must be "true" or "false".`));
          process.exit(1);
        }
      }
      if (key === 'commitStyle' && !['conventional', 'freeform'].includes(parsed)) {
        console.error(picocolors.red('✖ commitStyle must be "conventional" or "freeform".'));
        process.exit(1);
      }
      if (key === 'tone') {
        const validTones = ['neutral', 'concise', 'detailed', 'formal', 'casual', 'funny', 'custom'];
        if (!validTones.includes(parsed)) {
          console.error(picocolors.red(`✖ tone must be one of: ${validTones.join(', ')}`));
          process.exit(1);
        }
      }
      set(key, parsed);
      console.log(picocolors.green(`✔ ${key} set successfully.`));
      break;
    }

    case 'list': {
      const entries = list();
      if (entries.length === 0) {
        console.log(picocolors.yellow('No config values set.'));
        break;
      }
      const maxKeyLen = Math.max(...entries.map((e) => e.key.length));
      console.log(picocolors.bold(picocolors.cyan('Current configuration:')));
      console.log(picocolors.dim(`  Config file: ${getConfigPath()}\n`));
      for (const entry of entries) {
        const keyPadded = entry.key.padEnd(maxKeyLen);
        const display = entry.masked ? picocolors.dim(entry.value) : picocolors.white(entry.value);
        console.log(`  ${picocolors.yellow(keyPadded)}  ${display}`);
      }
      break;
    }

    default: {
      console.error(picocolors.red(`✖ Unknown subcommand "${subcommand}".`));
      console.error(picocolors.yellow('  Usage: gitm8 config <get|set|list> [args]'));
      console.error(picocolors.yellow('         gitm8 config --ui'));
      process.exit(1);
    }
  }
}

function maskKey(str) {
  if (!str || str.length < 8) return '********';
  return str.slice(0, 4) + '****' + str.slice(-4);
}
