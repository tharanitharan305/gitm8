import picocolors from 'picocolors';
import express from 'express';

/**
 * `gitm8 deps`
 * Analyzes project architecture → shows layered dependency diagram.
 */
export default async function depsCommand() {
  const rootDir = process.cwd();

  console.log('');
  console.log(picocolors.bold(picocolors.magenta('🔗 Dependency Layer Analysis')));
  console.log(picocolors.dim(`  Scanning ${rootDir}...`));
  console.log(picocolors.dim('─'.repeat(50)));

  const startTime = Date.now();

  const { analyzeLayers } = await import('../core/deps-layer.js');
  const result = await analyzeLayers(rootDir);

  if (result.files === 0) {
    console.log(picocolors.yellow('\n⚠ No supported source files found.'));
    process.exit(1);
  }

  console.log(`  ${picocolors.yellow('Files scanned:')} ${result.files}`);
  console.log(`  ${picocolors.yellow('Layers:')}       ${result.nodes.length}`);
  console.log(`  ${picocolors.yellow('Dependencies:')} ${result.links.length}`);

  // Layer stats
  for (const node of result.nodes) {
    const fileCount = (result.layerFiles[node.id] || []).length;
    if (fileCount > 0) {
      console.log(`    ${picocolors.cyan(node.name.padEnd(25))} ${fileCount} files`);
    }
  }

  // Violations
  if (result.violations.length > 0) {
    console.log(picocolors.red(`\n⚠  ${result.violations.length} architectural violation${result.violations.length > 1 ? 's' : ''} found`));
    for (const v of result.violations.slice(0, 5)) {
      console.log(picocolors.yellow(`  ${v.message}`));
    }
    if (result.violations.length > 5) {
      console.log(picocolors.dim(`  ...and ${result.violations.length - 5} more`));
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(picocolors.dim(`\n  Analyzed in ${elapsed}s`));
  console.log(picocolors.dim('─'.repeat(50)));
  console.log(picocolors.dim('\n  Starting visualization server...\n'));

  await startDepsServer(result);
}

function startDepsServer(result) {
  const html = buildDepsHtml(result);
  const app = express();

  app.get('/', (_req, res) => {
    res.type('text/html').send(html);
  });

  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' ? addr.port : 4568;
      const url = `http://localhost:${port}`;

      console.log(`  ${picocolors.bold('🔗 Layer Dependency Diagram')}`);
      console.log(`  ─────────────────────────────────────`);
      console.log(`  ${picocolors.cyan(url)}`);
      console.log(`  Close the tab or press Ctrl+C when done.\n`);

      import('open').then((openModule) => {
        const open = openModule.default || openModule;
        open(url).catch(() => {});
      });

      resolve(server);
    });
    server.on('error', reject);
  });
}

/**
 * Build the layered dependency HTML visualization using D3.js.
 */
function buildDepsHtml(result) {
  const dataJson = JSON.stringify({
    nodes: result.nodes,
    links: result.links,
    violations: result.violations,
    files: result.files,
    layerFiles: result.layerFiles,
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>gitm8 deps — Layer Dependency Diagram</title>
<script src="https://d3js.org/d3.v7.min.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f1117;color:#e1e4ed;overflow:hidden;height:100vh}

.header{padding:0.6rem 1.2rem;background:#1a1d27;border-bottom:1px solid #2e3348;
        display:flex;align-items:center;gap:1rem;flex-wrap:wrap}
.header h1{font-size:1rem;font-weight:600;white-space:nowrap}
.stats{display:flex;gap:0.6rem;font-size:0.7rem;color:#8b90a5;flex-wrap:wrap}
.stats span{background:#0f1117;padding:0.15rem 0.5rem;border-radius:4px;white-space:nowrap}
.stats .num{color:#6c8cff;font-weight:600}
.violation-badge{background:#f87171;color:#fff;font-size:0.65rem;padding:0.15rem 0.5rem;border-radius:4px;font-weight:600}

#viz{width:100%;height:calc(100vh - 44px);display:flex;background:#0f1117}

/* Sidebar layer list */
.layer-list{width:220px;overflow-y:auto;padding:0.75rem;border-right:1px solid #2e3348;flex-shrink:0}
.layer-list::-webkit-scrollbar{width:3px}
.layer-list::-webkit-scrollbar-thumb{background:#2e3348;border-radius:4px}
.layer-card{padding:0.5rem 0.7rem;border-radius:6px;margin-bottom:0.4rem;cursor:pointer;
            border:1px solid transparent;transition:border-color .15s,background .15s;font-size:0.75rem}
.layer-card:hover{border-color:#2e3348;background:#1a1d27}
.layer-card.active{border-color:var(--lc);background:rgba(108,140,255,.08)}
.layer-card .layer-name{font-weight:500;color:#e1e4ed}
.layer-card .layer-desc{font-size:0.6rem;color:#4a4f6a;margin-top:0.15rem}
.layer-card .layer-count{font-size:0.6rem;color:#8b90a5;margin-top:0.1rem}
.layer-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:0.4rem;vertical-align:middle}

/* Graph area */
.graph-area{flex:1;position:relative;overflow:hidden;min-width:0}

/* Tooltip */
.tooltip{position:absolute;background:#1a1d27;border:1px solid #2e3348;border-radius:8px;
         padding:0.6rem 0.9rem;font-size:0.75rem;pointer-events:none;opacity:0;
         transition:opacity .12s;max-width:320px;box-shadow:0 4px 20px rgba(0,0,0,.5);z-index:100}
.tooltip.visible{opacity:1}

/* Links */
.dep-link{fill:none;stroke-opacity:0.4;transition:stroke-opacity .2s,stroke .2s}
.dep-link:hover{stroke-opacity:0.8}
.dep-link.highlight{stroke-opacity:0.9!important;stroke-width:3.5px!important}
.dep-link.violation{stroke-dasharray:5,3}

/* Layer bands */
.layer-band{cursor:pointer;transition:opacity .2s}
.layer-band:hover{opacity:0.85}
.layer-label{font-size:0.85rem;font-weight:600;fill:#e1e4ed}
.layer-sub{font-size:0.6rem;fill:#4a4f6a}

/* Violation panel */
.violation-panel{position:absolute;bottom:1rem;right:1rem;background:#1a1d27;border:1px solid #f87171;
                 border-radius:8px;padding:0.6rem 1rem;max-width:320px;display:none;font-size:0.7rem}
.violation-panel.visible{display:block}
.violation-panel .vp-title{color:#f87171;font-weight:600;margin-bottom:0.3rem;font-size:0.75rem}
.violation-panel .vp-item{color:#8b90a5;padding:0.1rem 0}
.violation-panel .vp-file{font-family:monospace;color:#e1e4ed;font-size:0.65rem}

/* Instructions */
.instructions{position:absolute;bottom:1rem;left:1rem;background:rgba(26,29,39,.92);border:1px solid #2e3348;
              border-radius:8px;padding:0.35rem 0.7rem;font-size:0.6rem;color:#4a4f6a;backdrop-filter:blur(4px)}
</style>
</head>
<body>

<div class="header">
  <h1>🔗 Layer Dependencies</h1>
  <div class="stats">
    <span>📁 <span class="num" id="statFiles">${result.files}</span> files</span>
    <span>🔗 <span class="num" id="statLinks">${result.links.length}</span> dependencies</span>
    <span>🏛️ <span class="num" id="statLayers">${result.nodes.length}</span> layers</span>
  </div>
  ${result.violations.length > 0 ? '<span class="violation-badge" id="violationBadge">⚠ ' + result.violations.length + ' violations</span>' : ''}
</div>

<div id="viz">
  <div class="layer-list" id="layerList"></div>
  <div class="graph-area" id="graphArea">
    <svg id="graphSvg" width="100%" height="100%"></svg>
    <div class="tooltip" id="tooltip"></div>
    <div class="violation-panel" id="violationPanel"></div>
    <div class="instructions">🖱 Hover links · Click layers · Scroll to zoom</div>
  </div>
</div>

<script>
const data = ${dataJson};
const tooltip = document.getElementById('tooltip');

// ── Render layer list (sidebar) ──
const layerList = document.getElementById('layerList');
for (const node of data.nodes) {
  const files = (data.layerFiles[node.id] || []);
  const card = document.createElement('div');
  card.className = 'layer-card';
  card.style.setProperty('--lc', node.color);
  card.innerHTML = '<span class="layer-dot" style="background:' + node.color + '"></span>' +
    '<span class="layer-name">' + node.name + '</span>' +
    '<div class="layer-count">' + files.length + ' files</div>' +
    '<div class="layer-desc">' + (node.description || '') + '</div>';
  card.addEventListener('click', () => highlightLayer(node.id));
  layerList.appendChild(card);
}

// ── SVG Setup ──
const svg = d3.select('#graphSvg');
const width = svg.node().parentElement.clientWidth;
const height = svg.node().parentElement.clientHeight;
svg.attr('viewBox', [0, 0, width, height]);

const g = svg.append('g');

const LAYER_HEIGHT = 80;
const LAYER_GAP = 40;
const BAND_WIDTH = width * 0.55;
const BAND_X = width * 0.15;

// ── Build layout ──
const layers = data.nodes.map((n, i) => ({
  ...n,
  y: 80 + i * (LAYER_HEIGHT + LAYER_GAP),
  height: LAYER_HEIGHT,
  files: (data.layerFiles[n.id] || []),
}));

// ── Draw layer bands ──
const bands = g.selectAll('.layer-band').data(layers).join('g')
    .attr('class', 'layer-band')
    .attr('transform', d => 'translate(' + BAND_X + ',' + d.y + ')');

bands.append('rect')
    .attr('width', BAND_WIDTH)
    .attr('height', d => d.height)
    .attr('rx', 8)
    .attr('fill', d => d.color)
    .attr('opacity', 0.12)
    .attr('stroke', d => d.color)
    .attr('stroke-width', 1);

bands.append('text')
    .attr('class', 'layer-label')
    .attr('x', 16)
    .attr('y', 28)
    .text(d => d.name);

bands.append('text')
    .attr('class', 'layer-sub')
    .attr('x', 16)
    .attr('y', 46)
    .text(d => d.files.length + ' files — ' + (d.description || ''));

// ── Draw links ──
// Arc from bottom of source layer to top of target layer
const linkGroup = g.append('g');

data.links.forEach(d => {
  const src = layers.find(l => l.id === d.source);
  const tgt = layers.find(l => l.id === d.target);
  if (!src || !tgt) return;

  const isViolation = data.violations.some(v => v.from === d.source && v.to === d.target);

  const x1 = BAND_X + BAND_WIDTH / 2;
  const y1 = src.y + src.height;
  const x2 = BAND_X + BAND_WIDTH / 2;
  const y2 = tgt.y;
  const cy = (y1 + y2) / 2;

  const path = d3.path();
  path.moveTo(x1, y1);
  path.quadraticCurveTo(x1, cy, x2, y2);

  linkGroup.append('path')
      .attr('d', path.toString())
      .attr('class', 'dep-link' + (isViolation ? ' violation' : ''))
      .attr('stroke', isViolation ? '#f87171' : src.color)
      .attr('stroke-width', Math.min(1 + d.value * 0.3, 6))
      .attr('data-source', d.source)
      .attr('data-target', d.target)
      .attr('data-value', d.value);

  // Label: import count
  const midY = (y1 + y2) / 2;
  linkGroup.append('text')
      .attr('x', BAND_X + BAND_WIDTH / 2 + 8)
      .attr('y', midY)
      .attr('fill', '#4a4f6a')
      .attr('font-size', '10px')
      .attr('dy', '0.35em')
      .text(d.value);
});

// ── Hover tooltip for links ──
linkGroup.selectAll('.dep-link')
    .on('mouseover', function(ev, d) {
      const el = this;
      const src = el.getAttribute('data-source');
      const tgt = el.getAttribute('data-target');
      const val = el.getAttribute('data-value');
      const isViolation = el.classList.contains('violation');
      const violation = data.violations.find(v => v.from === src && v.to === tgt);

      let html = '<strong>' + src + '</strong> → <strong>' + tgt + '</strong>';
      html += '<br>' + val + ' import' + (parseInt(val) > 1 ? 's' : '');
      if (isViolation) {
        html += '<br><span style="color:#f87171">⚠ Architectural violation</span>';
        if (violation && violation.details) {
          html += '<br><br><strong>Examples:</strong>';
          violation.details.slice(0, 3).forEach(d => {
            html += '<br><span style="color:#8b90a5;font-size:0.65rem">' + d.file + '</span>';
          });
        }
      }

      const [mx, my] = d3.pointer(ev, document.body);
      document.getElementById('tooltip').innerHTML = html;
      document.getElementById('tooltip').classList.add('visible');
      document.getElementById('tooltip').style.left = (mx + 15) + 'px';
      document.getElementById('tooltip').style.top = (my - 10) + 'px';

      // Highlight
      linkGroup.selectAll('.dep-link').classed('highlight', false);
      el.classList.add('highlight');
    })
    .on('mouseout', function() {
      document.getElementById('tooltip').classList.remove('visible');
      linkGroup.selectAll('.dep-link').classed('highlight', false);
    });

// ── Click layer → show violation details ──
function highlightLayer(layerId) {
  document.querySelectorAll('.layer-card').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.layer-card').forEach(c => {
    if (c.querySelector('.layer-name').textContent.startsWith(layerId.replace('_',' ').replace(/\b\w/g, l => l.toUpperCase()))) {
      c.classList.add('active');
    }
  });
  // Find by data attribute
  document.querySelectorAll('.layer-card').forEach(c => {
    const cardLayers = data.nodes.filter(n => c.querySelector('.layer-name').textContent.includes(n.name));
    if (cardLayers.some(n => n.id === layerId)) c.classList.add('active');
  });

  // Highlight related links
  linkGroup.selectAll('.dep-link').classed('highlight', d => {
    const src = this?.getAttribute?.('data-source');
    return d3.select(this).attr('data-source') === layerId || d3.select(this).attr('data-target') === layerId;
  });

  // Show violations for this layer
  const violations = data.violations.filter(v => v.from === layerId || v.to === layerId);
  if (violations.length > 0) {
    const panel = document.getElementById('violationPanel');
    let html = '<div class="vp-title">⚠ Violations for ' + layerId + '</div>';
    violations.forEach(v => {
      html += '<div class="vp-item">' + v.from + ' → ' + v.to + ' (' + v.count + ' imports)</div>';
      if (v.details) {
        v.details.slice(0, 3).forEach(d => {
          html += '<div class="vp-file">  ' + d.file + '</div>';
        });
      }
    });
    panel.innerHTML = html;
    panel.classList.add('visible');
  }
}

// ── Zoom ──
svg.call(d3.zoom()
    .scaleExtent([0.3, 3])
    .on('zoom', (ev) => g.attr('transform', ev.transform)));

// ── Resize ──
window.addEventListener('resize', () => {
  const w = svg.node().parentElement.clientWidth;
  const h = svg.node().parentElement.clientHeight;
  svg.attr('viewBox', [0, 0, w, h]);
});
</script>
</body>
</html>`;
}
