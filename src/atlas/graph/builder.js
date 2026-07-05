import { NodeType, makeFileNode, makeClassNode, makeMethodNode, makeFunctionNode, makeFolderNode, makeRouteNode } from './nodes.js';
import { EdgeType, makeEdge } from './edges.js';

/**
 * Build a KnowledgeGraph from parsed files and optional git data.
 *
 * @param {Array} parsedFiles - Results from enhanced-parser.js parseFileEnhanced()
 * @param {object} [gitData] - Git intelligence data (churn, timeline, contributors)
 * @returns {object} KnowledgeGraph { nodes, edges, meta }
 */
export function buildGraph(parsedFiles, gitData = {}) {
  /** @type {Map<string, object>} */
  const nodeMap = new Map();
  /** @type {Map<string, object>} */
  const edgeMap = new Map();
  /** @type {Set<string>} */
  const dirs = new Set();

  // ── Phase 1: Create file + class + method nodes ──────────────
  for (const pf of parsedFiles) {
    if (!pf || !pf.path) continue;

    // Track directories
    const dir = pf.path.includes('/') ? pf.path.slice(0, pf.path.lastIndexOf('/')) : '/';
    dirs.add(dir);

    // Attach git metadata if available
    const fileMeta = {
      language: pf.language,
      lines: pf.lines || 0,
      size: pf.size || 0,
    };

    // Add churn/complexity data if available
    if (gitData.churn && gitData.churn[pf.path]) {
      fileMeta.churn = gitData.churn[pf.path].commits;
      fileMeta.additions = gitData.churn[pf.path].additions;
      fileMeta.deletions = gitData.churn[pf.path].deletions;
    }
    if (gitData.complexity && gitData.complexity[pf.path] !== undefined) {
      fileMeta.complexity = gitData.complexity[pf.path];
    }
    if (gitData.contributors && gitData.contributors[pf.path]) {
      fileMeta.contributors = gitData.contributors[pf.path].length;
      fileMeta.topContributor = gitData.contributors[pf.path][0] || null;
    }

    const fileNode = makeFileNode(pf.path, fileMeta);
    nodeMap.set(fileNode.id, fileNode);

    // Contains edge: directory → file
    const folderId = `folder:${dir}`;
    if (!nodeMap.has(folderId)) {
      nodeMap.set(folderId, makeFolderNode(dir));
    }

    const containerEdge = makeEdge(folderId, fileNode.id, EdgeType.CONTAINS);
    edgeMap.set(containerEdge.key, containerEdge);

    // Routes from this file
    if (pf.routes) {
      for (const route of pf.routes) {
        const routeNode = makeRouteNode(route.method, route.path, route.handler, pf.path, { line: route.line });
        nodeMap.set(routeNode.id, routeNode);

        const routeEdge = makeEdge(fileNode.id, routeNode.id, EdgeType.CONTAINS);
        edgeMap.set(routeEdge.key, routeEdge);
      }
    }

    // Classes from this file
    for (const cls of (pf.classes || [])) {
      const classNode = makeClassNode(cls.name, pf.path, { parentClass: cls.parentClass, line: cls.line });
      nodeMap.set(classNode.id, classNode);

      const containsEdge = makeEdge(fileNode.id, classNode.id, EdgeType.CONTAINS);
      edgeMap.set(containsEdge.key, containsEdge);

      // Extends edge
      if (cls.parentClass) {
        const parentId = `class:${pf.path}/${cls.parentClass}`;
        // May cross files — we'll resolve cross-file extends in phase 2
        const extendsEdge = makeEdge(classNode.id, parentId, EdgeType.EXTENDS, { line: cls.line });
        edgeMap.set(extendsEdge.key, extendsEdge);
      }

      // Methods in this class
      for (const method of (cls.methods || [])) {
        const methodNode = makeMethodNode(method.name, cls.name, pf.path, { line: method.line });
        nodeMap.set(methodNode.id, methodNode);

        const methodEdge = makeEdge(classNode.id, methodNode.id, EdgeType.CONTAINS);
        edgeMap.set(methodEdge.key, methodEdge);
      }
    }

    // Standalone functions
    for (const fn of (pf.functions || [])) {
      const funcNode = makeFunctionNode(fn.name, pf.path, { line: fn.line });
      nodeMap.set(funcNode.id, funcNode);

      const funcEdge = makeEdge(fileNode.id, funcNode.id, EdgeType.CONTAINS);
      edgeMap.set(funcEdge.key, funcEdge);
    }

    // Imports → will be resolved as IMPORTS edges in phase 3 (needs cross-file resolution)
    // Store raw imports on the file node for later processing
    if (pf.imports && pf.imports.length > 0) {
      fileNode._imports = pf.imports;
    }
  }

  // ── Phase 2: Cross-file import resolution ────────────────────
  // Resolve each file's _imports to known file nodes
  for (const node of nodeMap.values()) {
    if (node.type !== NodeType.FILE || !node._imports) continue;

    for (const imp of node._imports) {
      const resolved = resolveImport(imp, node.filePath, parsedFiles);
      if (resolved) {
        const targetId = `file:${resolved}`;
        if (nodeMap.has(targetId)) {
          const importEdge = makeEdge(node.id, targetId, EdgeType.IMPORTS, { line: imp.line });
          edgeMap.set(importEdge.key, importEdge);
        }
      }
    }

    // Clean up _imports after processing
    delete node._imports;
  }

  // ── Phase 3: Cross-reference calls to known methods/functions ─
  // Build a map: callName → [matching method/function nodes]
  const callableMap = new Map();
  for (const node of nodeMap.values()) {
    if (node.type === NodeType.METHOD || node.type === NodeType.FUNCTION) {
      // Key by the short name (method or function name)
      const shortName = node.label.replace('()', '');
      if (!callableMap.has(shortName)) callableMap.set(shortName, []);
      callableMap.get(shortName).push(node);
    }
  }

  // Match calls from parsed files to known nodes
  for (const pf of parsedFiles) {
    if (!pf || !pf.calls) continue;

    for (const call of pf.calls) {
      const targets = callableMap.get(call.callName);
      if (!targets) continue;

      // Determine caller ID based on context
      let callerId = null;
      if (call.className && call.methodName) {
        callerId = `method:${pf.path}/${call.className}.${call.methodName}`;
      } else if (call.funcName) {
        callerId = `func:${pf.path}/${call.funcName}`;
      }

      if (!callerId || !nodeMap.has(callerId)) continue;

      for (const target of targets) {
        // Skip self-calls
        if (target.id === callerId) continue;

        const callEdge = makeEdge(callerId, target.id, EdgeType.CALLS, {
          file: pf.path,
          line: call.line,
        });
        edgeMap.set(callEdge.key, callEdge);
      }
    }
  }

  // ── Phase 4: Augment with git ownership data ─────────────────
  if (gitData.contributors) {
    for (const [filePath, contributors] of Object.entries(gitData.contributors)) {
      const fileId = `file:${filePath}`;
      if (!nodeMap.has(fileId)) continue;

      for (const contributor of contributors) {
        const contributorId = `contributor:${contributor.name}`;
        if (!nodeMap.has(contributorId)) {
          nodeMap.set(contributorId, {
            id: contributorId,
            type: NodeType.CONTRIBUTOR,
            label: contributor.name,
            email: contributor.email,
            lod: 'file',
          });
        }

        const ownsEdge = makeEdge(contributorId, fileId, EdgeType.OWNS, {
          percentage: contributor.percentage,
        });
        edgeMap.set(ownsEdge.key, ownsEdge);
      }
    }
  }

  // ── Phase 5: Build result ────────────────────────────────────
  const nodes = [...nodeMap.values()];
  const edges = [...edgeMap.values()];

  // Compute stats
  const typeCounts = {};
  for (const n of nodes) {
    typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
  }

  return {
    nodes,
    edges,
    meta: {
      typeCounts,
      totalNodes: nodes.length,
      totalEdges: edges.length,
      totalFiles: typeCounts[NodeType.FILE] || 0,
      totalClasses: typeCounts[NodeType.CLASS] || 0,
      totalMethods: typeCounts[NodeType.METHOD] || 0,
      totalFunctions: typeCounts[NodeType.FUNCTION] || 0,
      totalRoutes: typeCounts[NodeType.ROUTE] || 0,
      languages: [...new Set(parsedFiles.filter(Boolean).map((f) => f.language))],
    },
  };
}

/**
 * Try to resolve an import string to a known parsed file path.
 *
 * @param {object} imp - Import descriptor { raw, resolved? }
 * @param {string} sourceFile - Source file path
 * @param {Array} parsedFiles - All parsed files
 * @returns {string|null} - Resolved file path
 */
function resolveImport(imp, sourceFile, parsedFiles) {
  // If already resolved by the parser, use it
  if (imp.resolved) return imp.resolved;

  const raw = imp.raw || imp;
  if (!raw) return null;

  // Skip node_modules, core modules
  if (raw.startsWith('node:') || raw.startsWith('dart:') || raw.startsWith('@')) return null;

  // Try to match against known parsed file paths
  // Simple match: does the import end with a known file name?
  // More sophisticated resolution would follow Node.js module resolution
  const importName = raw.split('/').pop();
  if (!importName) return null;

  for (const pf of parsedFiles) {
    if (!pf || !pf.path) continue;
    const fileName = pf.path.split('/').pop();
    if (fileName === importName || fileName === importName + '.js' ||
        fileName === importName + '.ts' || fileName === importName + '.tsx' ||
        fileName === importName + '.jsx') {
      return pf.path;
    }
  }

  // Try matching the import path segment against file paths
  const normalizedImport = raw.replace(/\\/g, '/');
  for (const pf of parsedFiles) {
    if (!pf || !pf.path) continue;
    if (pf.path.endsWith(normalizedImport) || pf.path.includes(normalizedImport)) {
      return pf.path;
    }
  }

  return null;
}
