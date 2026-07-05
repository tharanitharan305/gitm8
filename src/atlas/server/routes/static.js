import { Router } from 'express';
import { buildArchitectureHtml } from '../views/architecture.js';
import { buildLayersHtml } from '../views/layers.js';
import { buildCallflowHtml } from '../views/callflow.js';
import { buildHotspotsHtml } from '../views/hotspots.js';
import { buildTimelineHtml } from '../views/timeline.js';
import { buildReportHtml } from '../views/report.js';
import { buildSearchHtml } from '../views/search.js';

const VIEWS = {
  architecture: { title: 'Architecture Map', builder: buildArchitectureHtml },
  layers: { title: 'Layer Diagram', builder: buildLayersHtml },
  callflow: { title: 'Call Flow', builder: buildCallflowHtml },
  hotspots: { title: 'Hotspots', builder: buildHotspotsHtml },
  timeline: { title: 'Timeline', builder: buildTimelineHtml },
  report: { title: 'Report', builder: buildReportHtml },
  search: { title: 'Search', builder: buildSearchHtml },
};

/**
 * Create the static view router.
 * Serves self-contained HTML pages with embedded D3.js visualizations.
 *
 * @returns {import('express').Router}
 */
export function createStaticRouter() {
  const router = Router();

  // ── GET / → redirect to default view ──
  router.get('/', (req, res) => {
    const defaultView = req.atlasOpts?.defaultView || 'report';
    res.redirect(`/views/${defaultView}`);
  });

  // ── GET /views/:name ──
  router.get('/views/:name', (req, res) => {
    const viewName = req.params.name;
    const view = VIEWS[viewName];

    if (!view) {
      return res.status(404).type('html').send(`
        <!DOCTYPE html><html><body style="background:#0f1117;color:#e1e4ed;font-family:sans-serif;padding:2rem">
        <h1>404 — View not found</h1>
        <p>Available views: ${Object.keys(VIEWS).join(', ')}</p>
        </body></html>
      `);
    }

    try {
      const html = view.builder(req.graph, req.atlasOpts);
      res.type('text/html').send(html);
    } catch (err) {
      res.status(500).type('html').send(`
        <!DOCTYPE html><html><body style="background:#0f1117;color:#e1e4ed;font-family:sans-serif;padding:2rem">
        <h1>Error rendering view</h1>
        <pre style="color:#f87171">${err.message}</pre>
        </body></html>
      `);
    }
  });

  // ── GET /views list ──
  router.get('/views', (_req, res) => {
    res.json({
      views: Object.entries(VIEWS).map(([name, v]) => ({
        name,
        title: v.title,
        url: `/views/${name}`,
      })),
    });
  });

  return router;
}
