/**
 * Route detection for web frameworks.
 * Regex-based, scans source for common route/endpoint patterns.
 *
 * Supported:
 * - Express.js: app.get(), router.post(), app.use()
 * - FastAPI/Flask: @app.get(), @router.post(), @app.route()
 * - Spring: @GetMapping, @PostMapping, @RequestMapping
 * - Generic: route(), router.get(), resource()
 */

/**
 * Detect API routes in file content.
 *
 * @param {string} content - File content
 * @param {string} filePath - Relative file path (for context)
 * @returns {Array<{method: string, path: string, handler: string, line: number}>}
 */
export function detectRoutes(content, filePath) {
  const routes = [];
  const lines = content.split('\n');

  // Pattern sets for different frameworks
  const patterns = [
    // Express: app.get('/path', handler)
    { regex: /(?:app|router|route)\s*\.\s*(get|post|put|delete|patch|head|options)\s*\(\s*['"]([^'"]+)['"]\s*,\s*(\w+)/g, methodIdx: 1, pathIdx: 2, handlerIdx: 3 },
    // Express: app.use('/path', handler)
    { regex: /(?:app|router)\s*\.\s*(?:use|all)\s*\(\s*['"]([^'"]+)['"]\s*,\s*(\w+)/g, methodIdx: null, pathIdx: 1, handlerIdx: 2, method: 'USE' },
    // FastAPI/Flask decorators: @app.get('/path')
    { regex: /@(?:app|router)\s*\.\s*(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g, methodIdx: 1, pathIdx: 2, handlerIdx: null },
    // Flask: @app.route('/path')
    { regex: /@(?:app)\s*\.\s*route\s*\(\s*['"]([^'"]+)['"]/g, methodIdx: null, pathIdx: 1, handlerIdx: null, method: 'GET' },
    // Spring: @GetMapping("/path")
    { regex: /@(Get|Post|Put|Delete|Patch|RequestMapping)\w*Mapping\s*\(\s*(?:path\s*=\s*)?['"]([^'"]+)['"]/g, methodIdx: 1, pathIdx: 2, handlerIdx: null },
    // Generic Next.js/Nuxt file-based routes (from file path)
    // Handled separately below
  ];

  // Pass 1: extract explicit route declarations
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    for (const pattern of patterns) {
      let match;
      pattern.regex.lastIndex = 0;

      while ((match = pattern.regex.exec(trimmed)) !== null) {
        let method = pattern.method;
        if (method === null && pattern.methodIdx) {
          method = match[pattern.methodIdx].toUpperCase();
        }

        const path = match[pattern.pathIdx];
        let handler = pattern.handlerIdx ? match[pattern.handlerIdx] : null;

        // For decorator-style, look at the next line for def/function name
        if (!handler && (i + 1 < lines.length)) {
          const nextLine = lines[i + 1].trim();
          const fnMatch = nextLine.match(/(?:def|function|async\s+function)\s+(\w+)/);
          if (fnMatch) handler = fnMatch[1];
        }

        routes.push({
          method: method || 'GET',
          path,
          handler: handler || 'anonymous',
          line: i + 1,
        });
      }
    }
  }

  // Pass 2: detect file-based routes from path conventions
  detectFileBasedRoutes(filePath, routes);

  return routes;
}

/**
 * Detect routes based on file path conventions (Next.js, Nuxt, etc.).
 *
 * @param {string} filePath
 * @param {Array} routes - Accumulator array
 */
function detectFileBasedRoutes(filePath, routes) {
  // Next.js pages router: pages/blog/[slug].tsx → /blog/:slug
  const nextPagesMatch = filePath.match(/pages\/(.+)\.(tsx|ts|js|jsx)$/);
  if (nextPagesMatch) {
    let routePath = '/' + nextPagesMatch[1]
      .replace(/\[\.\.\.(\w+)\]/g, ':$1*')
      .replace(/\[(\w+)\]/g, ':$1')
      .replace(/index$/, '')
      .replace(/\/$/, '') || '/';

    routes.push({
      method: 'GET',
      path: routePath,
      handler: filePath.split('/').pop().replace(/\.(tsx|ts|js|jsx)$/, ''),
      line: 1,
    });
  }

  // Next.js app router: app/blog/[slug]/page.tsx → /blog/:slug
  const nextAppMatch = filePath.match(/app\/(.+)\.(tsx|ts|js|jsx)$/);
  if (nextAppMatch) {
    // This is rough — app router has layout.tsx, page.tsx, etc.
    // For now, generate a basic path
    const segments = filePath
      .replace(/\\/g, '/')
      .replace(/\/page\.(tsx|ts|js|jsx)$/, '')
      .replace(/\/layout\.(tsx|ts|js|jsx)$/, '')
      .replace(/\/route\.(tsx|ts|js|jsx)$/, '')
      .split('/');

    const appIdx = segments.indexOf('app');
    if (appIdx >= 0) {
      let routePath = '/' + segments.slice(appIdx + 1)
        .map((s) => s.replace(/^\[\.\.\.(.+)\]$/, ':$1*').replace(/^\[(.+)\]$/, ':$1'))
        .filter(Boolean)
        .join('/');
      if (!routePath || routePath === '/') routePath = '/';

      routes.push({
        method: 'GET',
        path: routePath,
        handler: filePath.split('/').pop().replace(/\.(tsx|ts|js|jsx)$/, ''),
        line: 1,
      });
    }
  }
}
