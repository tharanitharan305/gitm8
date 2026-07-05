/**
 * Estimate cyclomatic complexity of a file using decision-point counting.
 *
 * No AST required — counts occurrences of keywords and operators
 * that create branching paths in code execution.
 *
 * @param {object} parsedFile - Result from parseFileEnhanced
 * @returns {number} Estimated complexity score
 */
export function estimateComplexity(parsedFile) {
  if (!parsedFile || (!parsedFile.classes && !parsedFile.functions)) {
    return 1;
  }

  // Base complexity
  let complexity = 1;

  // Each function/method adds a path
  const methodCount = (parsedFile.classes || [])
    .reduce((sum, cls) => sum + (cls.methods ? cls.methods.length : 0), 0);
  complexity += methodCount;
  complexity += (parsedFile.functions || []).length;

  // We don't have raw content here in most cases, so estimate from structure
  // A more accurate estimate would need the raw file content
  // For now, use declaration count as a proxy
  complexity += parsedFile.classes ? parsedFile.classes.length : 0;

  return complexity;
}

/**
 * Estimate complexity from raw file content.
 * More accurate than the parsedFile version.
 *
 * @param {string} content - Raw file content
 * @returns {number}
 */
export function estimateComplexityFromContent(content) {
  if (!content) return 1;

  let complexity = 1;

  // Count decision keywords
  const decisionPatterns = [
    /\bif\b/g, /\belse if\b/g, /\belse\b/g,
    /\bfor\b/g, /\bwhile\b/g, /\bdo\b/g,
    /\bswitch\b/g, /\bcase\b/g,
    /\bcatch\b/g, /\bfinally\b/g,
    /\bthrow\b/g,
    /\breturn\b/g,
    /\bbreak\b/g, /\bcontinue\b/g,
    /\b&&\b/g, /\b\|\|\b/g,
    /\?.*:/g, // ternary
  ];

  for (const pattern of decisionPatterns) {
    const matches = content.match(pattern);
    if (matches) complexity += matches.length;
  }

  // Also count functions/methods
  const functionPatterns = [
    /\bfunction\s+\w+\s*\(/g,
    /\bdef\s+\w+\s*\(/g,
    /\w+\s*[:=]\s*(?:async\s*)?\(/g,
    /\w+\s*\([^)]*\)\s*{/g,
  ];

  for (const pattern of functionPatterns) {
    const matches = content.match(pattern);
    if (matches) complexity += matches.length;
  }

  return complexity;
}
