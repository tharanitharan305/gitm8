/**
 * JSON export — full serialization of the Knowledge Graph.
 */

/**
 * Serialize the graph to a JSON string.
 *
 * @param {import('../graph/query.js').GraphQuery} graph
 * @param {object} [opts]
 * @param {boolean} [opts.pretty] - Pretty-print the JSON
 * @returns {string}
 */
export function exportJson(graph, opts = {}) {
  const data = graph.toJSON();
  return opts.pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
}

/**
 * Export the graph to a JSON file.
 *
 * @param {import('../graph/query.js').GraphQuery} graph
 * @param {string} filePath - Output file path
 * @param {object} [opts]
 */
export async function exportJsonFile(graph, filePath, opts = {}) {
  const fs = await import('fs');
  const content = exportJson(graph, opts);
  fs.writeFileSync(filePath, content, 'utf-8');
}
