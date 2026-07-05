/**
 * Compute hotspot scores from churn and complexity data.
 *
 * Hotspot analysis identifies files that are both:
 * - Frequently changed (high churn)
 * - Complex (many decision points)
 *
 * These are the files most likely to contain bugs and
 * most deserving of refactoring attention.
 *
 * @param {object[]} fileNodes - File nodes from the graph
 * @param {object} [opts]
 * @param {number} [opts.limit=20] - Max results
 * @returns {object[]} Sorted by score descending
 */
export function computeHotspots(fileNodes, opts = {}) {
  const limit = opts.limit || 20;

  const scored = fileNodes
    .filter((n) => n.churn || n.complexity)
    .map((n) => ({
      filePath: n.filePath,
      churn: n.churn || 0,
      complexity: n.complexity || 0,
      churnScore: 0,
      complexityScore: 0,
      score: 0,
    }));

  if (scored.length === 0) return [];

  // Normalize scores to 0-1
  const maxChurn = Math.max(...scored.map((s) => s.churn), 1);
  const maxComplexity = Math.max(...scored.map((s) => s.complexity), 1);

  for (const s of scored) {
    s.churnScore = maxChurn > 0 ? s.churn / maxChurn : 0;
    s.complexityScore = maxComplexity > 0 ? s.complexity / maxComplexity : 0;
    s.score = Math.round(((s.churnScore + s.complexityScore) / 2) * 100) / 100;
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
