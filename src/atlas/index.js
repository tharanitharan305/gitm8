import picocolors from 'picocolors';
import { indexRepo } from './indexer.js';
import { createServer } from './server/server.js';
import { ProgressReporter } from './progress.js';
import { exportJson } from './export/json.js';
import { exportMermaid } from './export/mermaid.js';
import { exportSvg, generateStatsSvg } from './export/svg.js';

/**
 * Command handler for `gitm8 atlas`.
 *
 * Orchestrates: index → build graph → serve → open browser.
 *
 * @param {string} rootDir - Repository root
 * @param {object} opts - CLI options
 * @param {boolean} [opts.headless] - Skip opening browser
 * @param {string} [opts.export] - Export format: json, mermaid, svg
 * @param {string} [opts.output] - Output file for export
 * @param {boolean} [opts.watch] - Watch mode
 * @param {boolean} [opts.noCache] - Force re-index
 * @param {boolean} [opts.verbose] - Verbose output
 * @param {string} [opts.view] - Default view to open
 */
export default async function atlasOrchestrator(rootDir, opts = {}) {
  const progress = new ProgressReporter();

  console.log('');
  console.log(picocolors.bold(picocolors.magenta('🗺️  gitm8 atlas — Repository Intelligence')));
  console.log(picocolors.dim('  Building knowledge graph for:'), rootDir);
  console.log(picocolors.dim('─'.repeat(50)));

  const startTime = Date.now();

  try {
    // ── Step 1: Index the repo ────────────────────────────────
    progress.update('Discovering files...');
    const graph = await indexRepo(rootDir, {
      noCache: opts.noCache,
      onProgress: (msg, current, total) => {
        if (current !== undefined && total !== undefined) {
          progress.update(msg, current, total);
        } else {
          progress.update(msg);
        }
      },
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const stats = graph.getStats();
    const typeCounts = stats.typeCounts || {};

    progress.done(picocolors.green(`Indexed in ${elapsed}s`));

    // Print summary
    console.log(`  ${picocolors.yellow('Files:')}     ${typeCounts.file || 0}`);
    console.log(`  ${picocolors.yellow('Classes:')}   ${typeCounts.class || 0}`);
    console.log(`  ${picocolors.yellow('Methods:')}   ${typeCounts.method || 0}`);
    console.log(`  ${picocolors.yellow('Functions:')} ${typeCounts.function || 0}`);
    console.log(`  ${picocolors.yellow('Routes:')}    ${typeCounts.route || 0}`);
    console.log(`  ${picocolors.yellow('Nodes:')}     ${stats.totalNodes}`);
    console.log(`  ${picocolors.yellow('Edges:')}     ${stats.totalEdges}`);

    // ── Step 2: Handle export mode ────────────────────────────
    if (opts.export) {
      await handleExport(graph, opts);
      return;
    }

    // ── Step 3: Start server ──────────────────────────────────
    const defaultView = opts.view || 'report';
    const { start } = createServer(graph, {
      headless: opts.headless,
      defaultView,
    });

    const { port } = await start();
    const url = `http://localhost:${port}`;

    console.log(picocolors.dim('─'.repeat(50)));
    console.log(`  ${picocolors.bold('🗺️  Atlas Server')}`);
    console.log(`  ─────────────────────`);
    console.log(`  ${picocolors.cyan(url)}`);
    console.log(`  ${picocolors.cyan(`${url}/views/${defaultView}`)}`);
    console.log();

    // ── Step 4: Open browser ──────────────────────────────────
    if (!opts.headless) {
      const openModule = await import('open');
      const open = openModule.default || openModule;
      try {
        await open(`${url}/views/${defaultView}`);
        console.log(picocolors.dim('  Browser opened automatically.'));
      } catch {
        console.log(picocolors.dim(`  Open ${url} in your browser.`));
      }
    } else {
      console.log(picocolors.dim('  Headless mode — no browser opened.'));
    }

    console.log(picocolors.dim('  Press Ctrl+C to stop the server.\n'));

    // ── Step 5: Keep alive until Ctrl+C ───────────────────────
    await new Promise(() => {}); // never resolves — keeps process alive

  } catch (err) {
    progress.error(picocolors.red(err.message));
    if (opts.verbose && err.stack) {
      console.error(picocolors.dim(err.stack));
    }
    process.exit(1);
  }
}

/**
 * Handle export mode.
 *
 * @param {import('./graph/query.js').GraphQuery} graph
 * @param {object} opts
 */
async function handleExport(graph, opts) {
  const format = opts.export;
  const output = opts.output;

  let content;
  let ext;

  switch (format) {
    case 'json':
      content = exportJson(graph, { pretty: true });
      ext = '.json';
      break;

    case 'mermaid':
      content = exportMermaid(graph, { style: 'flowchart' });
      ext = '.md';
      break;

    case 'svg':
      content = exportSvg(graph, opts.view || 'architecture');
      ext = '.svg';
      break;

    default:
      console.error(picocolors.red(`Unknown export format: ${format}`));
      console.log(picocolors.yellow('Supported formats: json, mermaid, svg'));
      process.exit(1);
  }

  if (output && output !== '-') {
    const fs = await import('fs');
    fs.writeFileSync(output, content, 'utf-8');
    console.log(picocolors.green(`\n✔ Exported to ${output}`));
  } else {
    console.log(content);
  }
}
