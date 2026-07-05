/**
 * Edge type constants for the Knowledge Graph.
 * Every edge in the graph has a type property from this enum.
 */

/** @readonly @enum {string} */
export const EdgeType = Object.freeze({
  CONTAINS: 'contains',
  IMPORTS: 'imports',
  EXPORTS: 'exports',
  CALLS: 'calls',
  EXTENDS: 'extends',
  IMPLEMENTS: 'implements',
  RENDERS: 'renders',
  TESTS: 'tests',
  OWNS: 'owns',
  MODIFIED_BY: 'modified_by',
  INTRODUCED_IN: 'introduced_in',
  DEPENDS_ON: 'depends_on',
  CONNECTED_TO: 'connected_to',
});

/**
 * Edge style config for D3 rendering.
 */
export const EdgeStyles = Object.freeze({
  [EdgeType.CONTAINS]: { stroke: '#2e3348', dashed: false, opacity: 0.25 },
  [EdgeType.IMPORTS]: { stroke: '#6c8cff', dashed: false, opacity: 0.35 },
  [EdgeType.EXPORTS]: { stroke: '#38bdf8', dashed: false, opacity: 0.3 },
  [EdgeType.CALLS]: { stroke: '#4ade80', dashed: false, opacity: 0.4 },
  [EdgeType.EXTENDS]: { stroke: '#a78bfa', dashed: true, opacity: 0.4 },
  [EdgeType.IMPLEMENTS]: { stroke: '#a78bfa', dashed: true, opacity: 0.3 },
  [EdgeType.RENDERS]: { stroke: '#f472b6', dashed: false, opacity: 0.3 },
  [EdgeType.TESTS]: { stroke: '#fbbf24', dashed: true, opacity: 0.3 },
  [EdgeType.OWNS]: { stroke: '#22d3ee', dashed: false, opacity: 0.25 },
  [EdgeType.MODIFIED_BY]: { stroke: '#f97316', dashed: false, opacity: 0.2 },
  [EdgeType.INTRODUCED_IN]: { stroke: '#f97316', dashed: true, opacity: 0.15 },
  [EdgeType.DEPENDS_ON]: { stroke: '#fb923c', dashed: false, opacity: 0.3 },
  [EdgeType.CONNECTED_TO]: { stroke: '#8b90a5', dashed: false, opacity: 0.15 },
});

/**
 * Create an edge with dedup-safe key.
 *
 * @param {string} sourceId - Source node ID
 * @param {string} targetId - Target node ID
 * @param {string} type - EdgeType constant
 * @param {object} [meta] - Additional metadata
 * @returns {object} GraphEdge
 */
export function makeEdge(sourceId, targetId, type, meta = {}) {
  // Sort source/target so undirected edges dedup properly
  const key = `${sourceId}|${type}|${targetId}`;
  return {
    source: sourceId,
    target: targetId,
    type,
    key,
    style: EdgeStyles[type] || EdgeStyles[EdgeType.CONNECTED_TO],
    ...meta,
  };
}
