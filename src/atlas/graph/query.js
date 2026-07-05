import { NodeType } from './nodes.js';

/**
 * GraphQuery — the primary API for reading the Knowledge Graph.
 *
 * Designed to be importable by:
 * - Server API routes (/api/* endpoints)
 * - Future commands (gitm8 ask, gitm8 impact, gitm8 explain, etc.)
 *
 * All lookups are O(1) via Map/Set — no DB needed.
 */
export class GraphQuery {
  /**
   * @param {object[]} nodes - Graph nodes
   * @param {object[]} edges - Graph edges
   * @param {object} [meta] - Graph metadata
   */
  constructor(nodes, edges, meta = {}) {
    /** @type {Map<string, object>} */
    this.nodeMap = new Map(nodes.map((n) => [n.id, n]));

    /** Adjacency list: nodeId → { outgoing: Edge[], incoming: Edge[] } */
    this.adjacency = new Map();
    for (const node of nodes) {
      this.adjacency.set(node.id, { outgoing: [], incoming: [] });
    }
    for (const edge of edges) {
      const src = typeof edge.source === 'object' ? edge.source.id : edge.source;
      const tgt = typeof edge.target === 'object' ? edge.target.id : edge.target;
      if (this.adjacency.has(src)) this.adjacency.get(src).outgoing.push(edge);
      if (this.adjacency.has(tgt)) this.adjacency.get(tgt).incoming.push(edge);
    }

    this.edges = edges;
    this.meta = meta;

    // Pre-build type index
    /** @type {Map<string, object[]>} */
    this.typeIndex = new Map();
    for (const node of nodes) {
      const type = node.type || 'unknown';
      if (!this.typeIndex.has(type)) this.typeIndex.set(type, []);
      this.typeIndex.get(type).push(node);
    }
  }

  /**
   * Get a single node by ID.
   * @param {string} id
   * @returns {object|undefined}
   */
  getNode(id) {
    return this.nodeMap.get(id);
  }

  /**
   * Get all nodes of a specific type.
   * @param {string} type - NodeType constant
   * @returns {object[]}
   */
  getNodesByType(type) {
    return this.typeIndex.get(type) || [];
  }

  /**
   * Get the complete graph (file-level by default).
   * @param {object} [opts]
   * @param {string} [opts.lod] - Level of detail: 'file', 'module', 'detail'
   * @returns {{ nodes: object[], edges: object[], meta: object }}
   */
  getGraph(opts = {}) {
    const lod = opts.lod || 'file';
    if (lod === 'detail') {
      return { nodes: [...this.nodeMap.values()], edges: this.edges, meta: this.meta };
    }

    // Filter nodes by level of detail
    const nodeIds = new Set();
    const nodes = [];

    for (const node of this.nodeMap.values()) {
      if (node.lod === 'file' || (lod === 'module' && (node.lod === 'file' || node.lod === 'module'))) {
        nodeIds.add(node.id);
        nodes.push(node);
      }
    }

    // Only include edges where both endpoints are in the filtered set
    const edges = this.edges.filter((e) => {
      const src = typeof e.source === 'object' ? e.source.id : e.source;
      const tgt = typeof e.target === 'object' ? e.target.id : e.target;
      return nodeIds.has(src) && nodeIds.has(tgt);
    });

    return { nodes, edges, meta: this.meta };
  }

  /**
   * Get the neighbors of a node within a certain depth.
   * @param {string} nodeId
   * @param {object} [opts]
   * @param {number} [opts.depth=1]
   * @param {'outgoing'|'incoming'|'both'} [opts.direction='both']
   * @returns {{ nodes: object[], edges: object[] }}
   */
  getNeighbors(nodeId, opts = {}) {
    const depth = opts.depth || 1;
    const direction = opts.direction || 'both';

    const visited = new Set([nodeId]);
    const resultNodes = [];
    const resultEdges = [];
    const edgeSet = new Set();

    let currentLevel = [nodeId];
    for (let d = 0; d < depth && currentLevel.length > 0; d++) {
      const nextLevel = [];
      for (const id of currentLevel) {
        const adj = this.adjacency.get(id);
        if (!adj) continue;

        const candidates = [];
        if (direction === 'outgoing' || direction === 'both') {
          for (const edge of adj.outgoing) {
            const tgt = typeof edge.target === 'object' ? edge.target.id : edge.target;
            candidates.push({ targetId: tgt, edge });
          }
        }
        if (direction === 'incoming' || direction === 'both') {
          for (const edge of adj.incoming) {
            const src = typeof edge.source === 'object' ? edge.source.id : edge.source;
            candidates.push({ targetId: src, edge });
          }
        }

        for (const { targetId, edge } of candidates) {
          if (!edgeSet.has(edge.key)) {
            edgeSet.add(edge.key);
            resultEdges.push(edge);
          }
          if (!visited.has(targetId)) {
            visited.add(targetId);
            const node = this.nodeMap.get(targetId);
            if (node) {
              resultNodes.push(node);
              nextLevel.push(targetId);
            }
          }
        }
      }
      currentLevel = nextLevel;
    }

    return { nodes: resultNodes, edges: resultEdges };
  }

  /**
   * Search for nodes by label, filePath, or id.
   * @param {string} query - Search string
   * @param {object} [opts]
   * @param {number} [opts.limit=50]
   * @param {string} [opts.type] - Filter by node type
   * @returns {object[]} Matching nodes sorted by relevance
   */
  search(query, opts = {}) {
    const q = query.toLowerCase().trim();
    if (!q) return [];

    const limit = opts.limit || 50;
    const results = [];

    for (const node of this.nodeMap.values()) {
      if (opts.type && node.type !== opts.type) continue;

      let score = 0;
      if (node.label && node.label.toLowerCase().includes(q)) score += 10;
      if (node.filePath && node.filePath.toLowerCase().includes(q)) score += 5;
      if (node.id && node.id.toLowerCase().includes(q)) score += 3;
      if (node.type && node.type.toLowerCase().includes(q)) score += 2;

      // Exact match boost
      if (node.label && node.label.toLowerCase() === q) score += 20;
      if (node.filePath && node.filePath.toLowerCase() === q) score += 15;

      if (score > 0) {
        results.push({ node, score });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r) => r.node);
  }

  /**
   * Get aggregate statistics.
   * @returns {object}
   */
  getStats() {
    const typeCounts = {};
    for (const node of this.nodeMap.values()) {
      typeCounts[node.type] = (typeCounts[node.type] || 0) + 1;
    }

    // Language breakdown
    const languages = {};
    for (const node of this.nodeMap.values()) {
      if (node.type === NodeType.FILE && node.language) {
        languages[node.language] = (languages[node.language] || 0) + 1;
      }
    }

    // Top directories
    const dirCounts = {};
    for (const node of this.nodeMap.values()) {
      if (node.type === NodeType.FILE && node.directory) {
        const dir = node.directory;
        dirCounts[dir] = (dirCounts[dir] || 0) + 1;
      }
    }

    const topDirs = Object.entries(dirCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([dir, count]) => ({ dir, count }));

    // Top contributors
    const contributorCounts = {};
    for (const node of this.nodeMap.values()) {
      if (node.type === NodeType.FILE && node.topContributor) {
        const name = node.topContributor;
        contributorCounts[name] = (contributorCounts[name] || 0) + 1;
      }
    }

    const topContributors = Object.entries(contributorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, files]) => ({ name, files }));

    // Most complex/changed files
    const fileNodes = this.getNodesByType(NodeType.FILE);
    const mostComplex = [...fileNodes]
      .filter((n) => n.complexity)
      .sort((a, b) => (b.complexity || 0) - (a.complexity || 0))
      .slice(0, 10)
      .map((n) => ({ path: n.filePath, complexity: n.complexity }));

    const mostChurned = [...fileNodes]
      .filter((n) => n.churn)
      .sort((a, b) => (b.churn || 0) - (a.churn || 0))
      .slice(0, 10)
      .map((n) => ({ path: n.filePath, churn: n.churn }));

    return {
      typeCounts,
      totalNodes: this.nodeMap.size,
      totalEdges: this.edges.length,
      languages,
      topDirs,
      topContributors,
      mostComplex,
      mostChurned,
    };
  }

  /**
   * Get file-level graph only (for initial render).
   * @returns {{ nodes: object[], edges: object[] }}
   */
  getFileGraph() {
    return this.getGraph({ lod: 'file' });
  }

  /**
   * Expand a node to reveal its children (class/method level).
   * @param {string} nodeId
   * @returns {{ nodes: object[], edges: object[] }}
   */
  expandNode(nodeId) {
    const adj = this.adjacency.get(nodeId);
    if (!adj) return { nodes: [], edges: [] };

    const nodeIds = new Set([nodeId]);
    const resultNodes = [];
    const resultEdges = [];

    for (const edge of adj.outgoing) {
      if (edge.type === 'contains') {
        const tgt = typeof edge.target === 'object' ? edge.target.id : edge.target;
        if (!nodeIds.has(tgt)) {
          nodeIds.add(tgt);
          const node = this.nodeMap.get(tgt);
          if (node) resultNodes.push(node);
          resultEdges.push(edge);
        }
      }
    }

    for (const edge of adj.incoming) {
      if (edge.type === 'contains') {
        const src = typeof edge.source === 'object' ? edge.source.id : edge.source;
        if (!nodeIds.has(src)) {
          nodeIds.add(src);
          const node = this.nodeMap.get(src);
          if (node) resultNodes.push(node);
          resultEdges.push(edge);
        }
      }
    }

    return { nodes: resultNodes, edges: resultEdges };
  }

  /**
   * Get hotspots: files sorted by churn × complexity.
   * @param {number} [limit=20]
   * @returns {object[]}
   */
  getHotspots(limit = 20) {
    const files = this.getNodesByType(NodeType.FILE).filter((n) => n.churn || n.complexity);

    // Normalize churn and complexity to 0-1
    const maxChurn = Math.max(...files.map((n) => n.churn || 0), 1);
    const maxComplexity = Math.max(...files.map((n) => n.complexity || 0), 1);

    const scored = files.map((n) => ({
      node: n,
      churnScore: (n.churn || 0) / maxChurn,
      complexityScore: (n.complexity || 0) / maxComplexity,
      hotspotScore: ((n.churn || 0) / maxChurn + (n.complexity || 0) / maxComplexity) / 2,
    }));

    return scored
      .sort((a, b) => b.hotspotScore - a.hotspotScore)
      .slice(0, limit)
      .map((s) => ({
        filePath: s.node.filePath,
        churn: s.node.churn || 0,
        complexity: s.node.complexity || 0,
        score: Math.round(s.hotspotScore * 100) / 100,
        language: s.node.language,
      }));
  }

  /**
   * Serialize the graph to a plain object (for caching/export).
   * @returns {object}
   */
  toJSON() {
    return {
      nodes: [...this.nodeMap.values()],
      edges: this.edges,
      meta: this.meta,
    };
  }
}
