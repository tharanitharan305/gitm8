import express from 'express';
import { createApiRouter } from './routes/api.js';
import { createStaticRouter } from './routes/static.js';

/**
 * Create the Atlas visualization server.
 *
 * @param {import('../graph/query.js').GraphQuery} graph
 * @param {object} [opts]
 * @param {boolean} [opts.headless] - Don't open browser
 * @param {string} [opts.defaultView] - Default view to show
 * @returns {object} { app, start, close }
 */
export function createServer(graph, opts = {}) {
  const app = express();

  // Middleware
  app.use(express.json());

  // Attach graph query to all requests
  app.use((req, _res, next) => {
    req.graph = graph;
    req.atlasOpts = opts;
    next();
  });

  // Routes
  app.use('/api', createApiRouter());
  app.use('/', createStaticRouter());

  // Error handler
  app.use((err, _req, res, _next) => {
    console.error('Atlas server error:', err.message);
    res.status(500).json({ error: err.message });
  });

  /**
   * Start the server on a random available port.
   * @returns {Promise<{server: import('http').Server, port: number}>}
   */
  function start() {
    return new Promise((resolve, reject) => {
      const server = app.listen(0, () => {
        const addr = server.address();
        const port = typeof addr === 'object' ? addr.port : 4569;
        resolve({ server, port });
      });
      server.on('error', reject);
    });
  }

  return { app, start };
}
