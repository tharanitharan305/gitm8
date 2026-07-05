import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { discoverFiles } from '../core/viz-parser.js';
import { parseFileEnhanced } from './parser/enhanced-parser.js';
import { buildGraph } from './graph/builder.js';
import { GraphQuery } from './graph/query.js';
import { getRepoChurn } from './git/churn.js';
import { getCommitTimeline } from './git/timeline.js';
import { estimateComplexity } from './analysis/complexity.js';
import { getContributors } from '../git/contributors.js';

const CACHE_DIR = '.gitm8-atlas';
const CACHE_VERSION = 1;

/**
 * Index a repository: discover files → parse → add git intel → build graph.
 *
 * @param {string} rootDir - Repository root
 * @param {object} [opts]
 * @param {boolean} [opts.noCache] - Force re-index
 * @param {object} [opts.onProgress] - Progress callback (msg, current?, total?)
 * @returns {Promise<GraphQuery>}
 */
export async function indexRepo(rootDir, opts = {}) {
  const cacheDir = join(rootDir, CACHE_DIR);
  const metaFile = join(cacheDir, 'meta.json');
  const graphFile = join(cacheDir, 'graph.json');
  const onProgress = opts.onProgress || (() => {});

  // ── Check cache ─────────────────────────────────────────────
  if (!opts.noCache) {
    onProgress('Checking cache...');
    const cached = loadFromCache(metaFile, graphFile, rootDir);
    if (cached) {
      onProgress('Loaded from cache');
      return cached;
    }
  }

  // ── Phase 1: Discover files ─────────────────────────────────
  onProgress('Discovering files...');
  const files = discoverFiles(rootDir);
  if (files.length === 0) {
    throw new Error('No supported source files found.');
  }

  // ── Phase 2: Parse files ────────────────────────────────────
  onProgress('Parsing files...', 0, files.length);
  const parsedFiles = [];

  for (let i = 0; i < files.length; i++) {
    const result = parseFileEnhanced(files[i], rootDir);
    if (result) {
      parsedFiles.push(result);
    }

    if ((i + 1) % 50 === 0 || i === files.length - 1) {
      onProgress(`Parsing files...`, i + 1, files.length);
    }
  }

  // ── Phase 3: Git intelligence ───────────────────────────────
  onProgress('Collecting Git intelligence...');

  const [churnData, timelineData, contributorsList] = await Promise.all([
    getRepoChurn(rootDir).catch(() => ({})),
    getCommitTimeline(rootDir).catch(() => []),
    getContributors({ limit: 100 }).catch(() => []),
  ]);

  // Build contributor map per file
  const contributorMap = {};
  for (const parsed of parsedFiles) {
    if (!parsed || !parsed.path) continue;
    // Use the top-level contributors list as a proxy
    // In a full implementation, we'd use git shortlog per file
    contributorMap[parsed.path] = contributorsList.slice(0, 3);
  }

  // ── Phase 4: Complexity analysis ────────────────────────────
  onProgress('Analyzing complexity...');
  const complexityMap = {};
  for (const parsed of parsedFiles) {
    if (!parsed || !parsed.path) continue;
    try {
      const filePath = join(rootDir, parsed.path.replace(/\//g, '\\'));
      complexityMap[parsed.path] = estimateComplexity(parsed);
    } catch {
      complexityMap[parsed.path] = parsed.lines ? Math.ceil(parsed.lines / 20) : 0;
    }
  }

  // ── Phase 5: Build graph ────────────────────────────────────
  onProgress('Building knowledge graph...');
  const graph = buildGraph(parsedFiles, {
    churn: churnData,
    complexity: complexityMap,
    timeline: timelineData,
    contributors: contributorMap,
  });

  // ── Phase 6: Cache ──────────────────────────────────────────
  onProgress('Caching...');
  try {
    mkdirSync(cacheDir, { recursive: true });

    // Build file manifest
    const fileManifest = {};
    for (const file of files) {
      try {
        const mtime = readFileSync ? null : null;
        const stats = existsSync(file) ? null : null;
        // Use file mtimeMs as freshness indicator
        fileManifest[file] = Date.now();
      } catch {
        // Skip
      }
    }

    const meta = {
      version: CACHE_VERSION,
      indexedAt: new Date().toISOString(),
      fileCount: files.length,
      graphNodeCount: graph.nodes.length,
      graphEdgeCount: graph.edges.length,
    };

    writeFileSync(metaFile, JSON.stringify(meta, null, 2), 'utf-8');
    writeFileSync(graphFile, JSON.stringify(graph, null, 2), 'utf-8');

    // Auto-add to .gitignore
    try {
      const gitignorePath = join(rootDir, '.gitignore');
      const gitignoreContent = existsSync(gitignorePath)
        ? readFileSync(gitignorePath, 'utf-8')
        : '';
      if (!gitignoreContent.includes(CACHE_DIR)) {
        writeFileSync(gitignorePath, gitignoreContent + `\n${CACHE_DIR}/\n`, 'utf-8');
      }
    } catch {
      // Non-fatal
    }
  } catch (err) {
    // Non-fatal: cache write failure shouldn't stop the show
    onProgress(`Note: Cache write failed (${err.message})`);
  }

  const query = new GraphQuery(graph.nodes, graph.edges, graph.meta);
  return query;
}

/**
 * Try to load graph from cache.
 *
 * @param {string} metaFile
 * @param {string} graphFile
 * @param {string} rootDir
 * @returns {GraphQuery|null}
 */
function loadFromCache(metaFile, graphFile, rootDir) {
  try {
    if (!existsSync(metaFile) || !existsSync(graphFile)) return null;

    const meta = JSON.parse(readFileSync(metaFile, 'utf-8'));
    if (meta.version !== CACHE_VERSION) return null;

    const graph = JSON.parse(readFileSync(graphFile, 'utf-8'));

    // Validate basic structure
    if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return null;

    return new GraphQuery(graph.nodes, graph.edges, graph.meta || {});
  } catch {
    return null;
  }
}
