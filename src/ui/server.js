import { fileURLToPath } from 'url';
import path from 'path';
import express from 'express';
import picocolors from 'picocolors';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Start the settings UI server on a random available port.
 * Opens the browser to the UI.
 */
export async function startServer() {
  const app = express();

  // Parse JSON bodies from the frontend
  app.use(express.json());

  // Serve static files
  const publicPath = path.join(__dirname, 'public');
  app.use(express.static(publicPath));

  // API endpoints for reading/writing config
  const { get, set, list } = await import('../core/config-store.js');

  app.get('/api/config', (_req, res) => {
    const entries = list();
    const obj = {};
    for (const { key, value, masked } of entries) {
      obj[key] = { value, masked };
    }
    res.json(obj);
  });

  app.post('/api/config', (req, res) => {
    const body = req.body;
    const allowedKeys = [
      'apiBaseUrl', 'apiKey', 'model', 'tone', 'customTone',
      'commitStyle', 'maxDiffChars',
      'pipelineSecretsScan', 'pipelinePrecheck', 'pipelineAutoPush',
    ];

    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        let value = body[key];
        if (key === 'maxDiffChars') {
          value = parseInt(value, 10);
          if (isNaN(value) || value < 1000 || value > 50000) {
            res.status(400).json({ error: 'maxDiffChars must be between 1000 and 50000' });
            return;
          }
        }
        if (key === 'commitStyle' && !['conventional', 'freeform'].includes(value)) {
          res.status(400).json({ error: 'commitStyle must be "conventional" or "freeform"' });
          return;
        }
        set(key, value);
      }
    }

    res.json({ status: 'ok', message: 'Configuration saved.' });
  });

  // Start on a random available port
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' ? addr.port : 4545;
      const url = `http://localhost:${port}`;

      console.log(`\n  ⚙  ${picocolors.bold('gitm8 settings')}`);
      console.log(`  ─────────────────────────────────────`);
      console.log(`  ${picocolors.cyan(url)}`);
      console.log(`  Close this tab or press Ctrl+C when done.\n`);

      // Open the browser
      import('open').then((openModule) => {
        const open = openModule.default || openModule;
        open(url).catch(() => {
          // Browser open is optional — silently ignore failure
        });
      });

      resolve(server);
    });

    server.on('error', reject);
  });
}
