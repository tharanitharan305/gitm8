/**
 * SVG export — snapshot the current view as SVG.
 *
 * For full SVG export, this would normally use puppeteer or a headless browser
 * to render the D3 view and extract the SVG element.
 *
 * For now, we provide the SVG string from the last rendered view if available,
 * or guide the user to use the browser's save functionality.
 */

/**
 * Get SVG export instructions or attempt inline extraction.
 *
 * @param {object} graphQuery
 * @param {string} [viewName='architecture']
 * @returns {string}
 */
export function exportSvg(graphQuery, viewName = 'architecture') {
  return `<!-- gitm8 atlas — SVG Export (${viewName})
  To export as SVG:
  1. Open the ${viewName} view in your browser
  2. Right-click the SVG element → "Save as SVG"
  3. Or use the browser's dev tools to copy the SVG element

  Alternatively, run: gitm8 atlas --export json > graph.json
  and convert using your preferred tool.

  Node count: ${graphQuery.meta?.totalNodes || 'N/A'}
  Edge count: ${graphQuery.meta?.totalEdges || 'N/A'}
-->`;
}

/**
 * Generate an inline SVG from graph stats (fallback).
 *
 * @param {import('../graph/query.js').GraphQuery} graph
 * @returns {string}
 */
export function generateStatsSvg(graph) {
  const stats = graph.getStats();
  const width = 600;
  const height = 400;
  const barHeight = 20;
  const barGap = 5;

  const types = Object.entries(stats.typeCounts || {}).slice(0, 20);
  const maxCount = Math.max(...types.map(([, c]) => c), 1);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#0f1117" rx="8"/>
  <text x="20" y="30" fill="#e1e4ed" font-family="sans-serif" font-size="14" font-weight="600">gitm8 atlas — Repository Stats</text>
`;

  types.forEach(([type, count], i) => {
    const y = 50 + i * (barHeight + barGap);
    const barW = (count / maxCount) * (width - 120);
    svg += `  <text x="20" y="${y + 14}" fill="#8b90a5" font-family="sans-serif" font-size="11">${type}</text>
  <rect x="110" y="${y}" width="${barW}" height="${barHeight}" fill="#6c8cff" rx="3" opacity="0.7"/>
  <text x="${110 + barW + 5}" y="${y + 14}" fill="#e1e4ed" font-family="sans-serif" font-size="11">${count}</text>
`;
  });

  svg += `</svg>`;
  return svg;
}
