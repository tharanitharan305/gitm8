import { Router } from 'express';
import { NodeType } from '../../graph/nodes.js';
import { computeHotspots } from '../../git/hotspots.js';
import { detectLayer, LAYER_DEFS } from '../../analysis/layers.js';
import { getRepoChurn } from '../../git/churn.js';
import { getCommitTimeline } from '../../git/timeline.js';
import { estimateComplexityFromContent } from '../../analysis/complexity.js';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Create the Atlas API router.
 * All endpoints require req.graph (GraphQuery instance).
 *
 * @returns {import('express').Router}
 */
export function createApiRouter() {
  const router = Router();

  // ── GET /api/graph ──
  // Returns the file-level knowledge graph
  router.get('/graph', (req, res) => {
    const lod = req.query.lod || 'file';
    const graphData = req.graph.getGraph({ lod });
    res.json(graphData);
  });

  // ── GET /api/graph/detail?node=:id ──
  // Expand a node to reveal children
  router.get('/graph/detail', (req, res) => {
    const nodeId = req.query.node;
    if (!nodeId) return res.status(400).json({ error: 'Missing node parameter' });

    const node = req.graph.getNode(nodeId);
    if (!node) return res.status(404).json({ error: 'Node not found' });

    const expanded = req.graph.expandNode(nodeId);

    // Also include the node itself
    const allNodes = [node, ...expanded.nodes];
    res.json({ nodes: allNodes, edges: expanded.edges });
  });

  // ── GET /api/graph/neighbors?node=:id&depth=1&direction=both ──
  router.get('/graph/neighbors', (req, res) => {
    const nodeId = req.query.node;
    if (!nodeId) return res.status(400).json({ error: 'Missing node parameter' });

    const depth = parseInt(req.query.depth, 10) || 1;
    const direction = req.query.direction || 'both';

    const result = req.graph.getNeighbors(nodeId, { depth, direction });

    // Include the center node
    const center = req.graph.getNode(nodeId);
    if (center) result.nodes.unshift(center);

    res.json(result);
  });

  // ── GET /api/search?q=:query&type=:type&limit=:limit ──
  router.get('/search', (req, res) => {
    const q = req.query.q;
    if (!q) return res.json({ nodes: [] });

    const type = req.query.type || null;
    const limit = parseInt(req.query.limit, 10) || 50;

    const nodes = req.graph.search(q, { type, limit });
    res.json({ nodes });
  });

  // ── GET /api/stats ──
  router.get('/stats', (req, res) => {
    const stats = req.graph.getStats();
    res.json(stats);
  });

  // ── GET /api/hotspots?limit=20 ──
  router.get('/hotspots', (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 20;
    const fileNodes = req.graph.getNodesByType(NodeType.FILE);
    const hotspots = computeHotspots(fileNodes, { limit });
    res.json({ hotspots });
  });

  // ── GET /api/timeline?sinceDays=365&groupByAuthor=false ──
  router.get('/timeline', async (req, res) => {
    try {
      const sinceDays = parseInt(req.query.sinceDays, 10) || 365;
      const groupByAuthor = req.query.groupByAuthor === 'true';
      const rootDir = process.cwd();
      const entries = await getCommitTimeline(rootDir, { sinceDays, groupByAuthor });
      res.json({ entries });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/layers ──
  router.get('/layers', (req, res) => {
    const fileNodes = req.graph.getNodesByType(NodeType.FILE);

    // Group files by layer
    const layerFiles = {};
    for (const node of fileNodes) {
      if (!node.filePath) continue;
      const layerId = detectLayer(node.filePath);
      if (!layerFiles[layerId]) layerFiles[layerId] = [];
      layerFiles[layerId].push(node.filePath);
    }

    // Build layer nodes
    const layerNodes = LAYER_DEFS.filter((d) => layerFiles[d.id] && layerFiles[d.id].length > 0)
      .map((d) => ({
        id: d.id,
        name: d.name,
        color: d.color,
        description: d.desc,
        fileCount: (layerFiles[d.id] || []).length,
      }));

    // Build dependency links between layers
    const links = [];
    const allEdges = req.graph.edges;

    // For each file in a layer, check which other layers' files it imports
    for (const sourceLayer of layerNodes) {
      for (const targetLayer of layerNodes) {
        if (sourceLayer.id === targetLayer.id) continue;

        let count = 0;
        for (const edge of allEdges) {
          if (edge.type !== 'imports') continue;

          const src = typeof edge.source === 'object' ? edge.source.id : edge.source;
          const tgt = typeof edge.target === 'object' ? edge.target.id : edge.target;

          const srcFile = src.replace(/^file:/, '');
          const tgtFile = tgt.replace(/^file:/, '');

          if (layerFiles[sourceLayer.id]?.includes(srcFile) &&
              layerFiles[targetLayer.id]?.includes(tgtFile)) {
            count++;
          }
        }

        if (count > 0) {
          links.push({ source: sourceLayer.id, target: targetLayer.id, value: count });
        }
      }
    }

    res.json({ nodes: layerNodes, links, layerFiles });
  });

  // ── GET /api/callflow?root=:id&depth=5 ──
  router.get('/callflow', (req, res) => {
    const rootId = req.query.root;
    const depth = parseInt(req.query.depth, 10) || 5;

    if (!rootId) return res.status(400).json({ error: 'Missing root parameter' });

    const root = req.graph.getNode(rootId);
    if (!root) return res.status(404).json({ error: 'Root node not found' });

    // Build call tree recursively
    function buildCallTree(nodeId, currentDepth, visited) {
      if (currentDepth > depth || visited.has(nodeId)) return null;

      const node = req.graph.getNode(nodeId);
      if (!node) return null;

      const neighbors = req.graph.getNeighbors(nodeId, { depth: 1, direction: 'outgoing' });
      const children = [];

      const nextVisited = new Set(visited);
      nextVisited.add(nodeId);

      for (const edge of neighbors.edges) {
        if (edge.type === 'calls') {
          const tgt = typeof edge.target === 'object' ? edge.target.id : edge.target;
          const child = buildCallTree(tgt, currentDepth + 1, nextVisited);
          if (child) children.push(child);
        }
      }

      return {
        id: nodeId,
        label: node.label,
        type: node.type,
        filePath: node.filePath,
        children,
      };
    }

    const tree = buildCallTree(rootId, 0, new Set());
    res.json({ tree });
  });

  // ── GET /api/node/:id ──
  // Get detailed info about a specific node
  router.get('/node/:id', (req, res) => {
    const nodeId = req.params.id;
    const node = req.graph.getNode(nodeId);
    if (!node) return res.status(404).json({ error: 'Node not found' });

    const neighbors = req.graph.getNeighbors(nodeId, { depth: 1, direction: 'both' });

    res.json({
      node,
      incoming: neighbors.edges.filter((e) => {
        const tgt = typeof e.target === 'object' ? e.target.id : e.target;
        return tgt === nodeId;
      }).length,
      outgoing: neighbors.edges.filter((e) => {
        const src = typeof e.source === 'object' ? e.source.id : e.source;
        return src === nodeId;
      }).length,
      relatedNodes: neighbors.nodes,
    });
  });

  // ── GET /api/file?path=... ──
  // Get file contents (for display in inspector)
  router.get('/file', (req, res) => {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'Missing path query parameter' });

    const rootDir = process.cwd();

    try {
      const fullPath = join(rootDir, filePath);
      const content = readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');
      const complexity = estimateComplexityFromContent(content);
      const node = req.graph.getNode(`file:${filePath}`);

      res.json({
        path: filePath,
        lines: lines.length,
        size: Buffer.byteLength(content, 'utf-8'),
        complexity,
        content: lines.slice(0, 500),
        totalLines: lines.length,
        node: node || null,
      });
    } catch (err) {
      res.status(404).json({ error: `File not found: ${filePath}` });
    }
  });

  return router;
}
