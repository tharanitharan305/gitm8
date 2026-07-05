import atlasOrchestrator from '../atlas/index.js';

/**
 * `gitm8 atlas`
 *
 * Interactive repository intelligence platform.
 * Scans the repo, builds a knowledge graph, and opens an interactive web UI.
 *
 * @param {object} opts
 * @param {boolean} [opts.headless] - Don't open browser
 * @param {string} [opts.export] - Export format (json, mermaid, svg)
 * @param {string} [opts.output] - Output file for export
 * @param {boolean} [opts.watch] - Watch mode for live updates
 * @param {boolean} [opts.noCache] - Force re-index from scratch
 * @param {boolean} [opts.verbose] - Verbose output
 * @param {string} [opts.view] - Default view
 */
export default async function atlasCommand(opts) {
  const rootDir = process.cwd();
  await atlasOrchestrator(rootDir, opts);
}
