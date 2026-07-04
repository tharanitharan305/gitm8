/**
 * Layered dependency analyzer for `gitm8 deps`.
 * Scans source files → detects architectural layers → builds layer dependency matrix.
 *
 * Supported: JS/TS/TSX (React), Dart/Flutter, Python, Java
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, extname, dirname, resolve } from 'path';

// ═══════════════════════════════════════════════════════════════
//  Layer Definitions
// ═══════════════════════════════════════════════════════════════

const LAYER_DEFS = [
  {
    name: 'UI (Pages/Components)',
    id: 'ui',
    color: '#6c8cff',
    patterns: [
      /pages\//, /components\//, /screens\//, /widgets\//, /views\//,
      /containers\//, /layouts\//, /templates\//, /ui\//,
    ],
    desc: 'React components, Flutter widgets, page files',
  },
  {
    name: 'State / Controllers',
    id: 'controllers',
    color: '#4ade80',
    patterns: [
      /controllers?\//, /commands\//, /handlers\//,
      /bloc\//, /cubit\//, /store\//, /redux\//,
      /state\//, /providers\//, /contexts?\//, /actions\//,
      /hooks\//, /middleware\//, /logic\//,
    ],
    desc: 'State management, BLoCs, Redux, React hooks, commands',
  },
  {
    name: 'Services / API',
    id: 'services',
    color: '#f59e0b',
    patterns: [
      /services\//, /api\//, /usecases\//, /use_cases\//,
      /graphql\//, /endpoints\//,
    ],
    desc: 'API clients, external service integrations',
  },
  {
    name: 'Repositories',
    id: 'repositories',
    color: '#f87171',
    patterns: [
      /repositories?\//, /repo\//,
    ],
    desc: 'Data access layer, domain repositories',
  },
  {
    name: 'Data / Database',
    id: 'data',
    color: '#a78bfa',
    patterns: [
      /models\//, /entities\//, /database\//, /db\//,
      /datasources?\//, /dto\//,
    ],
    desc: 'Database models, schemas, data sources',
  },
  {
    name: 'Utils / Config',
    id: 'utils',
    color: '#f472b6',
    patterns: [
      /utils\//, /helpers\//, /lib\//, /config\//,
      /constants\//, /types\//, /typedefs\//, /common\//,
      /core\//, /infrastructure\//,
    ],
    desc: 'Shared utilities, configuration, constants',
  },
  {
    name: 'Unknown',
    id: 'unknown',
    color: '#4a4f6a',
    patterns: [],
    desc: 'Files not matching any known layer',
  },
];

// ═══════════════════════════════════════════════════════════════
//  Import Pattern Configuration per Language
// ═══════════════════════════════════════════════════════════════

const EXT_MAP = {
  '.js': 'js', '.jsx': 'jsx', '.mjs': 'js', '.cjs': 'js',
  '.ts': 'ts', '.tsx': 'tsx', '.mts': 'ts', '.cts': 'ts',
  '.dart': 'dart',
  '.py': 'py',
  '.java': 'java',
};

/**
 * Regex patterns to extract import paths.
 * Returns capture group 1 = the module path.
 */
const IMPORT_RE = {
  js:  /(?:import\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g,
  ts:  /(?:import\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g,
  jsx: /(?:import\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g,
  tsx: /(?:import\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g,
  dart: /import\s+(?:\w+\s+)?['"]([^'"]+)['"]/g,
  py:  /(?:import\s+(\w+)|from\s+(\w+(?:\.\w+)*)\s+import)/g,
  java: /import\s+([\w.*]+);/g,
};

// ═══════════════════════════════════════════════════════════════
//  Public API
// ═══════════════════════════════════════════════════════════════

/**
 * Analyze a project's layered dependencies.
 * @param {string} rootDir - Project root
 * @returns {Promise<object>} Layer analysis result
 */
export async function analyzeLayers(rootDir) {
  const files = discoverFiles(rootDir);
  const parsedFiles = [];

  // Parse each file: layer + imports
  for (const filePath of files) {
    const ext = extname(filePath).toLowerCase();
    const lang = EXT_MAP[ext];
    if (!lang) continue;

    const content = readFileSafe(filePath);
    if (!content) continue;

    const relPath = relative(rootDir, filePath).replace(/\\/g, '/');
    const layer = detectLayer(relPath);
    const imports = extractImports(content, lang, relPath, rootDir);

    if (layer || imports.length > 0) {
      parsedFiles.push({ path: relPath, layer, imports, lang });
    }
  }

  // Build layer dependency matrix
  const layerFiles = {};   // layerId → [file paths]
  const layerDeps = {};    // layerId → { targetLayerId → count }
  const allLayers = LAYER_DEFS.map(l => l.id);

  for (const layer of allLayers) {
    layerFiles[layer] = [];
    layerDeps[layer] = {};
    for (const target of allLayers) {
      layerDeps[layer][target] = 0;
    }
  }

  // Map each file to its layer
  for (const pf of parsedFiles) {
    if (!layerFiles[pf.layer]) layerFiles[pf.layer] = [];
    layerFiles[pf.layer].push(pf.path);
  }

  // Resolve each import to a target layer
  for (const pf of parsedFiles) {
    for (const imp of pf.imports) {
      const targetLayer = resolveImportToLayer(imp, pf.path, parsedFiles);
      if (targetLayer && targetLayer !== pf.layer) {
        // Avoid self-layer dependencies at file level
        layerDeps[pf.layer][targetLayer]++;
      }
    }
  }

  // Build nodes for Sankey / layered viz
  const nodes = [];
  const links = [];

  for (const layerDef of LAYER_DEFS) {
    const id = layerDef.id;
    const fileCount = (layerFiles[id] || []).length;
    if (fileCount === 0 && id !== 'unknown') continue;

    nodes.push({
      id,
      name: layerDef.name,
      color: layerDef.color,
      fileCount,
      description: layerDef.desc,
    });
  }

  // Create links between layers (only significant ones)
  for (const source of allLayers) {
    for (const [target, count] of Object.entries(layerDeps[source] || {})) {
      if (count > 0) {
        // Check both source and target have files
        const srcHasFiles = (layerFiles[source] || []).length > 0;
        const tgtHasFiles = (layerFiles[target] || []).length > 0;
        if (srcHasFiles && tgtHasFiles) {
          links.push({
            source,
            target,
            value: count,
          });
        }
      }
    }
  }

  // Sort links by value descending
  links.sort((a, b) => b.value - a.value);

  // Detect architectural violations (e.g. UI directly importing data)
  const violations = detectViolations(layerDeps, layerFiles, parsedFiles);

  // File-level details for click-to-explore
  const fileDetails = [];
  for (const pf of parsedFiles) {
    if (pf.imports.length === 0) continue;
    fileDetails.push({
      path: pf.path,
      layer: pf.layer,
      imports: pf.imports,
    });
  }

  return {
    nodes,
    links,
    files: parsedFiles.length,
    layerFiles,
    violations,
    fileDetails,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Layer Detection
// ═══════════════════════════════════════════════════════════════

function detectLayer(filePath) {
  for (const def of LAYER_DEFS) {
    for (const pattern of def.patterns) {
      if (pattern.test(filePath)) return def.id;
    }
  }
  return 'unknown';
}

// ═══════════════════════════════════════════════════════════════
//  Import Extraction
// ═══════════════════════════════════════════════════════════════

function extractImports(content, lang, filePath, rootDir) {
  const re = IMPORT_RE[lang];
  if (!re) return [];

  const imports = [];
  let match;
  re.lastIndex = 0;

  while ((match = re.exec(content)) !== null) {
    const rawPath = match[1] || match[2] || match[3] || '';
    if (!rawPath || rawPath.startsWith('node:') || rawPath.startsWith('dart:')) continue;

    imports.push({
      raw: rawPath,
      resolved: resolveImportPath(rawPath, filePath, rootDir),
    });
  }

  return imports;
}

/**
 * Resolve a relative import path to an absolute project path.
 */
function resolveImportPath(raw, sourceFile, rootDir) {
  // Skip package imports (not relative)
  if (!raw.startsWith('.') && !raw.startsWith('/')) return null;

  const sourceDir = dirname(join(rootDir, sourceFile));

  // Try common extensions and index files
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.dart', '.py', '.java',
                       '/index.ts', '/index.tsx', '/index.js', '/index.jsx',
                       '/index.dart', '/__init__.py'];

  // Remove file extension from raw if present
  // Strip file extension (e.g. '.js') but NOT path dots like '../'
  const basePath = raw.replace(/\.[a-z0-9]+$/i, '');

  for (const ext of extensions) {
    const candidate = resolve(sourceDir, basePath + ext);
    try {
      if (statSync(candidate).isFile()) {
        return relative(rootDir, candidate).replace(/\\/g, '/');
      }
    } catch {}
  }

  return null;
}

/**
 * Resolve an import to its target layer.
 */
function resolveImportToLayer(imp, sourceFile, allFiles) {
  if (!imp.resolved) return null;

  const resolvedPath = imp.resolved;

  // Check if resolved path maps to a known file
  for (const pf of allFiles) {
    if (pf.path === resolvedPath) {
      return pf.layer;
    }
  }

  // Try partial match (resolved might differ from stored path)
  for (const pf of allFiles) {
    if (resolvedPath.endsWith(pf.path) || pf.path.endsWith(resolvedPath)) {
      return pf.layer;
    }
  }

  // Fall back to layer detection from the resolved path
  return detectLayer(resolvedPath);
}

// ═══════════════════════════════════════════════════════════════
//  File Discovery
// ═══════════════════════════════════════════════════════════════

function discoverFiles(rootDir) {
  const results = [];
  const skipDirs = new Set([
    'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
    'out', '.output', 'target', 'bin', 'obj', '.dart_tool', '.pub-cache',
    '__pycache__', 'venv', '.venv', '.eggs', 'egg-info',
    'coverage', '.nyc_output', '.tox', '.mypy_cache', '.pytest_cache',
    '.gradle', '.idea', '.vscode', '.svelte-kit', '.vercel',
    '.cdk.out', '.serverless', '.terraform', '.next',
    'packages',
    // Flutter platform dirs — no user application code
    'android', 'ios', 'web', 'test', 'integration_test',
    // Test dirs
    'tests', '__tests__',
  ]);

  function isGeneratedFile(name) {
    return /\.(g|freezed|gen|config)\.(dart|ts|js)$/.test(name) ||
           name.endsWith('.g.dart') || name.endsWith('.freezed.dart') ||
           name.endsWith('.gen.dart') || name.endsWith('.min.js');
  }

  function walk(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name) && !entry.name.startsWith('.')) {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (EXT_MAP[ext] && !isGeneratedFile(entry.name)) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(rootDir);
  return results;
}

// ═══════════════════════════════════════════════════════════════
//  Violation Detection
// ═══════════════════════════════════════════════════════════════

/**
 * Allowed dependency directions (layer → canImport)
 * Lower layers should not import higher layers.
 */
const ALLOWED_ORDER = [
  'ui', 'controllers', 'services', 'repositories', 'data', 'utils', 'unknown',
];

function detectViolations(layerDeps, layerFiles, parsedFiles) {
  const violations = [];

  for (const [srcLayer, targets] of Object.entries(layerDeps)) {
    const srcIdx = ALLOWED_ORDER.indexOf(srcLayer);
    if (srcIdx === -1) continue;

    for (const [tgtLayer, count] of Object.entries(targets)) {
      if (count === 0) continue;
      const tgtIdx = ALLOWED_ORDER.indexOf(tgtLayer);
      if (tgtIdx === -1) continue;

      // Violation: lower layer importing higher layer
      if (tgtIdx < srcIdx) {
        // Find specific files causing this violation
        const culprits = [];
        for (const pf of parsedFiles) {
          if (pf.layer !== srcLayer) continue;
          for (const imp of pf.imports) {
            if (!imp.resolved) continue;
            const targetL = resolveImportToLayer(imp, pf.path, parsedFiles);
            if (targetL === tgtLayer) {
              culprits.push({ file: pf.path, imports: imp.raw });
              break;
            }
          }
        }

        violations.push({
          from: srcLayer,
          to: tgtLayer,
          count,
          details: culprits.slice(0, 10),
          message: `${srcLayer} → ${tgtLayer}: ${count} import${count > 1 ? 's' : ''}`,
        });
      }
    }
  }

  return violations;
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function readFileSafe(filePath) {
  try { return readFileSync(filePath, 'utf-8'); }
  catch { return null; }
}

export { LAYER_DEFS };
