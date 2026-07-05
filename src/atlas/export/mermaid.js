import { NodeType } from '../graph/nodes.js';
import { EdgeType } from '../graph/edges.js';

/**
 * Export the graph as a Mermaid classDiagram or flowchart.
 *
 * @param {import('../graph/query.js').GraphQuery} graph
 * @param {object} [opts]
 * @param {'classDiagram'|'flowchart'} [opts.style='classDiagram']
 * @returns {string} Mermaid syntax
 */
export function exportMermaid(graph, opts = {}) {
  const style = opts.style || 'classDiagram';

  if (style === 'flowchart') {
    return exportAsFlowchart(graph);
  }
  return exportAsClassDiagram(graph);
}

/**
 * Export as a Mermaid classDiagram.
 *
 * @param {import('../graph/query.js').GraphQuery} graph
 * @returns {string}
 */
function exportAsClassDiagram(graph) {
  const lines = ['classDiagram'];

  // Group nodes by file
  const fileGroups = {};
  for (const node of graph.getNodesByType(NodeType.FILE)) {
    fileGroups[node.filePath] = { file: node, classes: [], methods: [] };
  }

  for (const node of graph.getNodesByType(NodeType.CLASS)) {
    const file = node.filePath || 'unknown';
    if (!fileGroups[file]) fileGroups[file] = { file: null, classes: [], methods: [] };
    fileGroups[file].classes.push(node);
  }

  for (const node of graph.getNodesByType(NodeType.METHOD)) {
    const file = node.filePath || 'unknown';
    if (!fileGroups[file]) fileGroups[file] = { file: null, classes: [], methods: [] };
    fileGroups[file].methods.push(node);
  }

  // Render each file's classes
  for (const [, group] of Object.entries(fileGroups)) {
    for (const cls of group.classes) {
      const className = cls.label.replace(/[^a-zA-Z0-9]/g, '_');
      const methods = group.methods.filter((m) => m.className === cls.label);

      lines.push(`  class ${className} {`);
      for (const method of methods) {
        lines.push(`    +${method.label.replace('()', '')}()`);
      }
      lines.push('  }');

      // Extends relationships
      if (cls.parentClass) {
        const parentName = cls.parentClass.replace(/[^a-zA-Z0-9]/g, '_');
        lines.push(`  ${className} --|> ${parentName}`);
      }
    }
  }

  // Add file notes
  for (const [, group] of Object.entries(fileGroups)) {
    if (group.file && group.classes.length > 0) {
      const note = `Note for "${group.file.label}": ${group.file.filePath}`;
      lines.push(`  note "${note}"`);
    }
  }

  return lines.join('\n');
}

/**
 * Export as a Mermaid flowchart (call graph style).
 *
 * @param {import('../graph/query.js').GraphQuery} graph
 * @returns {string}
 */
function exportAsFlowchart(graph) {
  const lines = ['flowchart TD'];

  // Collect call edges
  const callEdges = graph.edges.filter((e) => e.type === EdgeType.CALLS);
  if (callEdges.length === 0) {
    lines.push('  A[No call relationships found]');
    return lines.join('\n');
  }

  // Only render top 50 edges to avoid huge diagrams
  const maxEdges = 50;
  const edges = callEdges.slice(0, maxEdges);
  const edgeSet = new Set();

  for (const edge of edges) {
    const src = typeof edge.source === 'object' ? edge.source.id : edge.source;
    const tgt = typeof edge.target === 'object' ? edge.target.id : edge.target;

    const srcLabel = (graph.getNode(src)?.label || src).replace(/[^a-zA-Z0-9]/g, '_');
    const tgtLabel = (graph.getNode(tgt)?.label || tgt).replace(/[^a-zA-Z0-9]/g, '_');

    const key = `${srcLabel}-->${tgtLabel}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      lines.push(`  ${srcLabel} --> ${tgtLabel}`);
    }
  }

  if (callEdges.length > maxEdges) {
    lines.push(`  %% ... and ${callEdges.length - maxEdges} more edges`);
  }

  return lines.join('\n');
}
