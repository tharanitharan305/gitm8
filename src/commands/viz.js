import picocolors from 'picocolors';
import { fileURLToPath } from 'url';
import path from 'path';
import express from 'express';
import { discoverFiles, parseFile, buildGraph, resetGraphCache } from '../core/viz-parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * `gitm8 viz`
 * Scans the project → builds class/method relationship graph → opens interactive D3 viz.
 */
export default async function vizCommand() {
  const rootDir = process.cwd();

  console.log('');
  console.log(picocolors.bold(picocolors.magenta('🔍 Code Visualization')));
  console.log(picocolors.dim(`  Scanning ${rootDir}...`));
  console.log(picocolors.dim('─'.repeat(50)));

  // ── Step 1: Discover source files ─────────────────────────
  const startTime = Date.now();
  const files = discoverFiles(rootDir);

  if (files.length === 0) {
    console.log(picocolors.yellow('\n⚠ No supported source files found.'));
    console.log(picocolors.dim('  gitm8 viz supports JS, TS/TSX, Python, Java, and Dart.'));
    process.exit(1);
  }

  console.log(`  ${picocolors.yellow('Files found:')} ${files.length}`);

  // ── Step 2: Parse each file ────────────────────────────────
  let parsed = 0;
  resetGraphCache();
  const parsedFiles = [];

  for (const file of files) {
    const result = parseFile(file, rootDir);
    if (result) {
      parsedFiles.push(result);
      parsed++;
    }
  }

  if (parsedFiles.length === 0) {
    console.log(picocolors.yellow('\n⚠ No classes or functions found in project.'));
    process.exit(1);
  }

  console.log(`  ${picocolors.yellow('Files parsed:')} ${parsed}`);

  // Count total classes + methods
  let classCount = 0;
  let methodCount = 0;
  let funcCount = 0;
  for (const pf of parsedFiles) {
    classCount += pf.classes.length;
    for (const cls of pf.classes) methodCount += cls.methods.length;
    funcCount += pf.functions.length;
  }
  console.log(`  ${picocolors.yellow('Classes:')}     ${classCount}`);
  console.log(`  ${picocolors.yellow('Methods:')}     ${methodCount}`);
  console.log(`  ${picocolors.yellow('Functions:')}   ${funcCount}`);

  // ── Step 3: Build graph ────────────────────────────────────
  const graph = buildGraph(parsedFiles);

  console.log(`  ${picocolors.yellow('Graph nodes:')}  ${graph.nodes.length}`);
  console.log(`  ${picocolors.yellow('Edges:')}       ${graph.edges.length}`);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(picocolors.dim(`\n  Scanned in ${elapsed}s`));

  // Count cross-file edges
  const crossFileEdges = graph.edges.filter(e => {
    const srcNode = graph.nodes.find(n => n.id === e.source);
    const tgtNode = graph.nodes.find(n => n.id === e.target);
    return srcNode && tgtNode && srcNode.file !== tgtNode.file;
  });
  if (crossFileEdges.length > 0) {
    console.log(picocolors.cyan(`  ${crossFileEdges.length} cross-file relationship${crossFileEdges.length > 1 ? 's' : ''} found`));
  }

  // ── Step 4: Start visualization server ─────────────────────
  console.log(picocolors.dim('─'.repeat(50)));
  console.log(picocolors.dim('\n  Starting visualization server...\n'));

  await startVizServer(graph, classCount, methodCount);
}

/**
 * Start Express server serving the D3.js visualization.
 * @param {object} graph - { nodes, edges, files }
 * @param {number} classCount
 * @param {number} methodCount
 */
function startVizServer(graph, classCount, methodCount) {
  const app = express();

  // Serve the D3 visualization HTML
  const html = buildVizHtml(graph, classCount, methodCount);

  app.get('/', (_req, res) => {
    res.type('text/html').send(html);
  });

  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' ? addr.port : 4567;
      const url = `http://localhost:${port}`;

      console.log(`  ${picocolors.bold('📊 Code Relationship Diagram')}`);
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
 * Build a self-contained HTML page with embedded D3.js visualization.
 */
function buildVizHtml(graph, classCount, methodCount) {
  const graphJson = JSON.stringify(graph);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>gitm8 viz — Code Relationship Diagram</title>
<script src="https://d3js.org/d3.v7.min.js"></script>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
       background: #0f1117; color: #e1e4ed; overflow: hidden; height: 100vh; }

/* Header */
.header { padding: 1rem 1.5rem; background: #1a1d27; border-bottom: 1px solid #2e3348;
           display: flex; align-items: center; justify-content: space-between; }
.header h1 { font-size: 1.1rem; font-weight: 600; }
.header .stats { display: flex; gap: 1.5rem; font-size: 0.8rem; color: #8b90a5; }
.header .stats span { background: #0f1117; padding: 0.2rem 0.6rem; border-radius: 4px; }
.header .stats .num { color: #6c8cff; font-weight: 600; }

/* SVG container */
#viz { width: 100%; height: calc(100vh - 52px); background: #0f1117; }

/* Tooltip */
.tooltip { position: absolute; background: #1a1d27; border: 1px solid #2e3348;
           border-radius: 8px; padding: 0.75rem 1rem; font-size: 0.8rem;
           pointer-events: none; opacity: 0; transition: opacity 0.15s;
           max-width: 360px; box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
.tooltip.visible { opacity: 1; }
.tooltip .tt-title { font-weight: 600; color: #e1e4ed; margin-bottom: 0.25rem; }
.tooltip .tt-detail { color: #8b90a5; font-size: 0.75rem; }
.tooltip .tt-file { color: #6c8cff; font-size: 0.7rem; font-family: monospace; margin-top: 0.3rem; }

/* Nodes */
.node circle { stroke-width: 2px; cursor: pointer; transition: r 0.15s; }
.node circle:hover { filter: brightness(1.3); }
.node text { font-size: 11px; font-family: monospace; pointer-events: none;
             fill: #8b90a5; }
.node.highlight text { fill: #e1e4ed; }

/* Edges */
.link { stroke: #2e3348; stroke-opacity: 0.4; fill: none; stroke-width: 1.5px; }
.link.highlight { stroke: #6c8cff; stroke-opacity: 0.8; stroke-width: 2.5px; }
.link.cross-file { stroke-dasharray: 4,3; }

/* Legend */
.legend { position: absolute; bottom: 1rem; left: 1rem; background: #1a1d27;
          border: 1px solid #2e3348; border-radius: 8px; padding: 0.6rem 1rem;
          font-size: 0.7rem; display: flex; gap: 1rem; }
.legend-item { display: flex; align-items: center; gap: 0.4rem; }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; }

/* Instructions */
.instructions { position: absolute; bottom: 1rem; right: 1rem; background: #1a1d27;
                border: 1px solid #2e3348; border-radius: 8px; padding: 0.5rem 0.8rem;
                font-size: 0.65rem; color: #8b90a5; }
</style>
</head>
<body>

<div class="header">
  <h1>📊 Code Relationship Diagram</h1>
  <div class="stats">
    <span>📁 <span class="num">${graph.files}</span> files</span>
    <span>🏛️ <span class="num">${classCount}</span> classes</span>
    <span>⚡ <span class="num">${methodCount}</span> methods</span>
    <span>🔗 <span class="num">${graph.edges.length}</span> relationships</span>
  </div>
</div>

<div id="viz"></div>

<div class="tooltip" id="tooltip"></div>

<div class="legend">
  <span class="legend-item"><span class="legend-dot" style="background:#6c8cff"></span> Method</span>
  <span class="legend-item"><span class="legend-dot" style="background:#4ade80"></span> Function</span>
  <span class="legend-item" style="opacity:0.6">--- cross-file</span>
</div>

<div class="instructions">🖱 Drag nodes · Scroll to zoom · Hover for details · Click to highlight</div>

<script>
const graph = ${graphJson};

const width = window.innerWidth;
const height = window.innerHeight - 52;
const svg = d3.select('#viz').append('svg')
    .attr('width', width).attr('height', height);

// Tooltip
const tooltip = d3.select('#tooltip');

// Color scale
const color = d3.scaleOrdinal()
    .domain(['method', 'function'])
    .range(['#6c8cff', '#4ade80']);

// ── Build simulation ──
const simulation = d3.forceSimulation(graph.nodes)
    .force('link', d3.forceLink(graph.edges).id(d => d.id).distance(180).strength(0.3))
    .force('charge', d3.forceManyBody().strength(-400))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide(40));

// ── Draw links ──
const link = svg.append('g')
    .selectAll('line')
    .data(graph.edges)
    .join('line')
    .attr('class', d => {
      const src = graph.nodes.find(n => n.id === d.source?.id || n.id === d.source);
      const tgt = graph.nodes.find(n => n.id === d.target?.id || n.id === d.target);
      return 'link' + (src && tgt && src.file !== tgt.file ? ' cross-file' : '');
    })
    .attr('stroke', '#2e3348')
    .attr('stroke-opacity', 0.4);

// ── Draw nodes ──
const node = svg.append('g')
    .selectAll('g')
    .data(graph.nodes)
    .join('g')
    .attr('class', 'node')
    .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        }));

node.append('circle')
    .attr('r', d => d.type === 'method' ? 14 : 10)
    .attr('fill', d => color(d.type))
    .attr('stroke', '#0f1117');

node.append('text')
    .attr('x', d => (d.type === 'method' ? 20 : 16))
    .attr('y', 4)
    .text(d => d.label);

// ── Hover tooltip ──
node.on('mouseover', function(event, d) {
      const [x, y] = d3.pointer(event, document.body);
      tooltip
        .html('<div class="tt-title">' + d.label + '</div>' +
              '<div class="tt-detail">' + (d.parentClass ? 'extends ' + d.parentClass : d.type) + '</div>' +
              '<div class="tt-file">' + d.file + '</div>')
        .classed('visible', true)
        .style('left', (x + 15) + 'px')
        .style('top', (y - 10) + 'px');
    })
    .on('mouseout', () => tooltip.classed('visible', false));

// ── Click to highlight paths ──
node.on('click', function(event, clickedNode) {
  const connectedIds = new Set();
  connectedIds.add(clickedNode.id);

  // Find direct connections
  graph.edges.forEach(e => {
    const srcId = e.source?.id || e.source;
    const tgtId = e.target?.id || e.target;
    if (srcId === clickedNode.id) connectedIds.add(tgtId);
    if (tgtId === clickedNode.id) connectedIds.add(srcId);
  });

  // Highlight connected nodes and edges
  node.classed('highlight', d => connectedIds.has(d.id));
  node.select('circle').attr('opacity', d => connectedIds.has(d.id) ? 1 : 0.15);
  node.select('text').attr('opacity', d => connectedIds.has(d.id) ? 1 : 0.2);
  link.attr('stroke-opacity', d => {
    const s = d.source?.id || d.source;
    const t = d.target?.id || d.target;
    return (connectedIds.has(s) && connectedIds.has(t)) ? 0.8 : 0.05;
  });
  link.attr('stroke', d => {
    const s = d.source?.id || d.source;
    const t = d.target?.id || d.target;
    return (s === clickedNode.id || t === clickedNode.id) ? '#6c8cff' : '#2e3348';
  });
});

// Click background to reset
svg.on('click', function(event) {
  if (event.target === this || event.target.tagName === 'svg') {
    node.classed('highlight', false);
    node.select('circle').attr('opacity', 1);
    node.select('text').attr('opacity', 1);
    link.attr('stroke-opacity', 0.4).attr('stroke', '#2e3348');
  }
});

// ── Zoom ──
svg.call(d3.zoom()
    .extent([[0, 0], [width, height]])
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      svg.selectAll('g').attr('transform', event.transform);
    }));

// ── Tick ──
simulation.on('tick', () => {
  link
    .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
    .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
  node.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
});

// ── Resize handler ──
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight - 52;
  svg.attr('width', w).attr('height', h);
  simulation.force('center', d3.forceCenter(w / 2, h / 2));
  simulation.alpha(0.3).restart();
});
</script>
</body>
</html>`;
}
