import picocolors from 'picocolors';
import { fileURLToPath } from 'url';
import path from 'path';
import express from 'express';
import { discoverFiles, parseFile, buildGraph, resetGraphCache } from '../core/viz-parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * `gitm8 viz`
 * Scans the project → builds class/method relationship graph → opens interactive D3 viz + call tree.
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
 */
function startVizServer(graph, classCount, methodCount) {
  const app = express();

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
 * Build a self-contained HTML page with embedded D3.js visualization + call tree.
 */
function buildVizHtml(graph, classCount, methodCount) {
  const graphJson = JSON.stringify(graph);

  // ── Pre-compute per-node cross-file flag ──
  for (const n of graph.nodes) {
    n.crossFile = graph.edges.some(e => {
      const s = typeof e.source === 'object' ? e.source.id : e.source;
      const t = typeof e.target === 'object' ? e.target.id : e.target;
      return (s === n.id || t === n.id) && linkCrossesFile(e, graph);
    });
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>gitm8 viz — Code Relationship Diagram</title>
<script src="https://d3js.org/d3.v7.min.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f1117;color:#e1e4ed;overflow:hidden;height:100vh}

/* ── Header ── */
.header{padding:0.55rem 1rem;background:#1a1d27;border-bottom:1px solid #2e3348;
        display:flex;align-items:center;gap:0.8rem;flex-wrap:wrap}
.header h1{font-size:0.95rem;font-weight:600;white-space:nowrap}
.header-btn{background:#0f1117;border:1px solid #2e3348;border-radius:5px;color:#8b90a5;
            cursor:pointer;font-size:0.75rem;padding:0.3rem 0.6rem;white-space:nowrap;
            transition:border-color .15s,color .15s}
.header-btn:hover{border-color:#6c8cff;color:#e1e4ed}
.header-btn.active{border-color:#6c8cff;color:#6c8cff}
.search-wrap{flex:1;min-width:140px;position:relative}
.search-wrap input{width:100%;padding:0.35rem 0.6rem 0.35rem 1.7rem;background:#0f1117;border:1px solid #2e3348;
                   border-radius:5px;color:#e1e4ed;font-size:0.75rem;outline:none;transition:border-color .15s}
.search-wrap input:focus{border-color:#6c8cff}
.search-wrap input::placeholder{color:#4a4f6a}
.search-icon{position:absolute;left:0.5rem;top:50%;transform:translateY(-50%);color:#4a4f6a;font-size:0.65rem;pointer-events:none}
.search-clear{position:absolute;right:0.3rem;top:50%;transform:translateY(-50%);background:none;border:none;
              color:#4a4f6a;cursor:pointer;font-size:0.6rem;display:none;padding:0.15rem}
.search-clear.visible{display:block}
.search-clear:hover{color:#e1e4ed}
.stats{display:flex;gap:0.5rem;font-size:0.65rem;color:#8b90a5;flex-wrap:wrap}
.stats span{background:#0f1117;padding:0.12rem 0.45rem;border-radius:4px;white-space:nowrap}
.stats .num{color:#6c8cff;font-weight:600}
.stats .highlight-num{color:#6c8cff;font-weight:600;transition:color .3s}

/* ── Layout: graph + tree side by side ── */
.main{display:flex;height:calc(100vh - 45px);width:100%}
#viz{flex:1;background:#0f1117;cursor:grab;min-width:0}
#viz:active{cursor:grabbing}

/* ── Tree panel ── */
.tree-panel{width:0;overflow:hidden;background:#14171f;border-left:1px solid #2e3348;
            transition:width .25s ease;display:flex;flex-direction:column;flex-shrink:0}
.tree-panel.open{width:320px}
.tree-header{padding:0.5rem 0.75rem;border-bottom:1px solid #2e3348;font-size:0.75rem;font-weight:600;color:#8b90a5;
             display:flex;align-items:center;gap:0.5rem;flex-shrink:0}
.tree-header .tree-count{color:#4a4f6a;font-weight:400;font-size:0.65rem}
.tree-body{flex:1;overflow-y:auto;overflow-x:hidden;padding:0.25rem 0;font-size:0.72rem}
.tree-body::-webkit-scrollbar{width:4px}
.tree-body::-webkit-scrollbar-track{background:transparent}
.tree-body::-webkit-scrollbar-thumb{background:#2e3348;border-radius:4px}

/* ── Tree nodes ── */
.tree-item{cursor:pointer;user-select:none;transition:background .1s;border-radius:3px;margin:0.1rem 0.3rem;line-height:1.4}
.tree-item:hover{background:#1a1d27}
.tree-item.highlighted{background:rgba(108,140,255,.12)}
.tree-item.active-path{background:rgba(108,140,255,.08)}
.tree-item-row{display:flex;align-items:center;gap:0.2rem;padding:0.15rem 0.3rem}
.tree-toggle{width:14px;height:14px;display:flex;align-items:center;justify-content:center;
             font-size:0.55rem;color:#4a4f6a;flex-shrink:0;transition:transform .15s}
.tree-toggle.expanded{transform:rotate(90deg)}
.tree-toggle.leaf{visibility:hidden}
.tree-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;margin:0 0.2rem}
.tree-label{color:#e1e4ed;font-size:0.72rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tree-file{color:#4a4f6a;font-size:0.6rem;margin-left:auto;padding-left:0.4rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px;flex-shrink:0;text-align:right}
.tree-children{overflow:hidden}
.tree-root>.tree-item-row{font-weight:500}
.tree-root>.tree-item-row .tree-label{color:#6c8cff}
.tree-cross-file .tree-file{color:#f59e0b}

/* Tooltip */
.tooltip{position:absolute;background:#1a1d27;border:1px solid #2e3348;border-radius:8px;
         padding:0.6rem 0.9rem;font-size:0.75rem;pointer-events:none;opacity:0;
         transition:opacity .12s;max-width:380px;box-shadow:0 4px 20px rgba(0,0,0,.5);
         z-index:100}
.tooltip.visible{opacity:1}
.tooltip .tt-title{font-weight:600;color:#e1e4ed;margin-bottom:0.2rem;font-size:0.8rem}
.tooltip .tt-detail{color:#8b90a5;font-size:0.7rem}
.tooltip .tt-file{color:#6c8cff;font-size:0.65rem;font-family:monospace;margin-top:0.25rem}
.tooltip .tt-calls{color:#4ade80;font-size:0.65rem;margin-top:0.15rem}
.tooltip .tt-called{color:#f59e0b;font-size:0.65rem;margin-top:0.1rem}

/* D3 Nodes */
.node circle{stroke-width:1.5px;cursor:pointer;transition:r .12s,opacity .2s}
.node circle:hover{filter:brightness(1.4)}
.node text{font-size:10px;font-family:'SF Mono','Cascadia Code',monospace;pointer-events:none;
           fill:#8b90a5;transition:opacity .2s}
.node.search-match text{fill:#e1e4ed;font-weight:500}
.node.dimmed{opacity:0.12}
.node.dimmed text{opacity:0}

/* D3 Edges */
.link{stroke:#2e3348;stroke-opacity:0.3;fill:none;stroke-width:1.2px;transition:stroke-opacity .2s,stroke .2s}
.link.highlight{stroke:#6c8cff;stroke-opacity:0.9;stroke-width:2.5px}
.link.cross-file{stroke-dasharray:4,3;stroke-opacity:0.25}
.link.dimmed{stroke-opacity:0.03!important}

/* Legend */
.legend{position:absolute;bottom:0.8rem;left:0.8rem;background:rgba(26,29,39,.92);border:1px solid #2e3348;
        border-radius:8px;padding:0.35rem 0.7rem;font-size:0.6rem;display:flex;gap:0.7rem;backdrop-filter:blur(4px);z-index:10}
.legend-item{display:flex;align-items:center;gap:0.25rem}
.legend-dot{width:7px;height:7px;border-radius:50%}

/* Empty state */
.empty-state{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#4a4f6a;
             text-align:center;display:none;pointer-events:none}
.empty-state.visible{display:block}
.empty-state span{font-size:2rem;display:block;margin-bottom:0.5rem}
.empty-state p{font-size:0.8rem}

/* ── Tree empty ── */
.tree-empty{color:#4a4f6a;font-size:0.7rem;text-align:center;padding:2rem 1rem}
</style>
</head>
<body>

<div class="header">
  <h1>📊 Viz</h1>
  <button class="header-btn" id="treeToggle">🌳 Tree</button>
  <div class="search-wrap">
    <span class="search-icon">🔍</span>
    <input type="text" id="search" placeholder="Search..." autocomplete="off" spellcheck="false">
    <button class="search-clear" id="searchClear">✕</button>
  </div>
  <div class="stats">
    <span>📁 <span class="num" id="statFiles">${graph.files}</span></span>
    <span>🏛️ <span class="num" id="statClasses">${classCount}</span></span>
    <span>⚡ <span class="num" id="statMethods">${methodCount}</span></span>
    <span>🔗 <span class="num" id="statEdges">${graph.edges.length}</span></span>
  </div>
</div>

<div class="main">
  <div id="viz"></div>
  <div class="tree-panel" id="treePanel">
    <div class="tree-header">
      🌳 Call Tree
      <span class="tree-count" id="treeCount"></span>
    </div>
    <div class="tree-body" id="treeBody"></div>
  </div>
</div>

<div class="tooltip" id="tooltip"></div>

<div class="legend">
  <span class="legend-item"><span class="legend-dot" style="background:#6c8cff"></span> Method</span>
  <span class="legend-item"><span class="legend-dot" style="background:#4ade80"></span> Function</span>
  <span class="legend-item" style="opacity:.6">--- cross-file</span>
</div>

<div class="empty-state" id="emptyState">
  <span>🔍</span>
  <p>No matches found</p>
</div>

<script>
const graph = ${graphJson};
const nodeMap = {};
graph.nodes.forEach(n => nodeMap[n.id] = n);

// ═══════════════════════════════════════════════════════════════
//  D3 Force Graph
// ═══════════════════════════════════════════════════════════════

const width = window.innerWidth;
const height = window.innerHeight - 45;

const svg = d3.select('#viz').append('svg')
    .attr('width', width).attr('height', height);
const container = svg.append('g').attr('class', 'container');
const tooltip = d3.select('#tooltip');

const color = d3.scaleOrdinal().domain(['method','function']).range(['#6c8cff','#4ade80']);

// ── Force simulation ──
const linkForce = d3.forceLink(graph.edges).id(d => d.id).distance(150).strength(0.25);
const simulation = d3.forceSimulation(graph.nodes)
    .force('link', linkForce)
    .force('charge', d3.forceManyBody().strength(-350).distanceMax(600))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide(36))
    .alphaDecay(0.03).velocityDecay(0.3);

// ── Draw links ──
const link = container.append('g').selectAll('line').data(graph.edges).join('line')
    .attr('class', d => 'link' + (linkCrossesFile(d) ? ' cross-file' : ''));

// ── Draw nodes ──
const node = container.append('g').selectAll('g').data(graph.nodes).join('g')
    .attr('class', 'node')
    .call(d3.drag()
        .on('start', (ev, d) => { if (!ev.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
        .on('end', (ev, d) => { if (!ev.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }));

node.append('circle').attr('r', d => d.type === 'method' ? 12 : 8)
    .attr('fill', d => color(d.type)).attr('stroke', '#0f1117');
node.append('text').attr('x', d => (d.type === 'method' ? 18 : 14)).attr('y', 4)
    .text(d => d.label.replace('()',''));

// ── Tooltip ──
node.on('mouseover', function(ev, d) {
    const [mx, my] = d3.pointer(ev, document.body);
    const callsOut = graph.edges.filter(e => { const s = e.source?.id || e.source; return s === d.id; });
    const calledBy = graph.edges.filter(e => { const t = e.target?.id || e.target; return t === d.id; });
    let h = '<div class="tt-title">' + d.label + '</div><div class="tt-file">' + d.file + '</div>';
    if (d.parentClass) h += '<div class="tt-detail">extends ' + d.parentClass + '</div>';
    if (callsOut.length) h += '<div class="tt-calls">→ calls ' + callsOut.length + '</div>';
    if (calledBy.length) h += '<div class="tt-called">← called by ' + calledBy.length + '</div>';
    tooltip.html(h).classed('visible', true).style('left', (mx + 15) + 'px').style('top', (my - 10) + 'px');
}).on('mouseout', () => tooltip.classed('visible', false));

// ── Highlight / click ──
let highlightedNodeId = null;

function highlightPaths(clickedId) {
  highlightedNodeId = clickedId;
  const connected = new Set([clickedId]);
  graph.edges.forEach(e => {
    const s = e.source?.id || e.source, t = e.target?.id || e.target;
    if (s === clickedId) connected.add(t);
    if (t === clickedId) connected.add(s);
  });
  node.classed('dimmed', d => !connected.has(d.id));
  node.select('circle').attr('opacity', d => connected.has(d.id) ? 1 : 0.08);
  link.classed('dimmed', d => { const s = d.source?.id || d.source, t = d.target?.id || d.target; return !connected.has(s) || !connected.has(t); });
  link.classed('highlight', d => { const s = d.source?.id || d.source, t = d.target?.id || d.target; return s === clickedId || t === clickedId; });
  highlightTreeItem(clickedId);
}

function clearHighlight() {
  highlightedNodeId = null;
  node.classed('dimmed', false); node.select('circle').attr('opacity', 1);
  link.classed('dimmed', false); link.classed('highlight', false);
  clearTreeHighlight();
}

node.on('click', function(ev, d) { ev.stopPropagation(); highlightPaths(d.id); });
svg.on('click', function(ev) {
  if (ev.target === this || ev.target.tagName === 'svg') { clearHighlight(); applySearch(document.getElementById('search').value); }
});

// ── Zoom ──
svg.call(d3.zoom().scaleExtent([0.08, 6]).on('zoom', (ev) => container.attr('transform', ev.transform)));

// ── Resize ──
window.addEventListener('resize', () => {
  const w = window.innerWidth - (panelOpen ? 320 : 0);
  const h = window.innerHeight - 45;
  svg.attr('width', w).attr('height', h);
  simulation.force('center', d3.forceCenter(w / 2, h / 2)).alpha(0.2).restart();
});

// ── Tick ──
simulation.on('tick', () => {
  link.attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y);
  node.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
});

// ── Helper ──
function linkCrossesFile(d) {
  const s = d.source?.id || d.source, t = d.target?.id || d.target;
  const sn = nodeMap[s], tn = nodeMap[t];
  return sn && tn && sn.file !== tn.file;
}

// ═══════════════════════════════════════════════════════════════
//  Search
// ═══════════════════════════════════════════════════════════════

const searchInput = document.getElementById('search');
const searchClear = document.getElementById('searchClear');
const emptyState = document.getElementById('emptyState');

function applySearch(text) {
  const q = text.toLowerCase().trim();
  let matchCount = 0;
  if (!q) {
    node.classed('search-match', false).classed('dimmed', false);
    node.select('circle').attr('opacity', 1);
    link.classed('dimmed', false).classed('highlight', false);
    searchClear.classList.remove('visible');
    emptyState.classList.remove('visible');
    document.getElementById('statEdges').textContent = graph.edges.length;
    return;
  }
  searchClear.classList.add('visible');
  clearHighlight();
  const matchingIds = new Set();
  graph.nodes.forEach(n => {
    if (n.label.toLowerCase().includes(q) || n.file.toLowerCase().includes(q) || (n.group && n.group.toLowerCase().includes(q)) || n.id.toLowerCase().includes(q)) {
      matchingIds.add(n.id); matchCount++;
    }
  });
  const extended = new Set(matchingIds);
  graph.edges.forEach(e => { const s = e.source?.id || e.source, t = e.target?.id || e.target; if (matchingIds.has(s)) extended.add(t); if (matchingIds.has(t)) extended.add(s); });
  node.classed('search-match', d => extended.has(d.id));
  node.classed('dimmed', d => !extended.has(d.id));
  node.select('circle').attr('opacity', d => extended.has(d.id) ? 1 : 0.06);
  link.classed('dimmed', d => { const s = d.source?.id || d.source, t = d.target?.id || d.target; return !extended.has(s) || !extended.has(t); });
  link.classed('highlight', d => { const s = d.source?.id || d.source, t = d.target?.id || d.target; return matchingIds.has(s) && matchingIds.has(t); });
  const visibleEdges = graph.edges.filter(e => { const s = e.source?.id || e.source, t = e.target?.id || e.target; return extended.has(s) && extended.has(t); }).length;
  document.getElementById('statEdges').textContent = visibleEdges + '/' + graph.edges.length;
  emptyState.classList.toggle('visible', matchCount === 0);
}

searchInput.addEventListener('input', () => applySearch(searchInput.value));
searchClear.addEventListener('click', () => { searchInput.value = ''; applySearch(''); searchInput.focus(); });
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') { searchInput.value = ''; applySearch(''); searchInput.blur(); }
  if ((ev.ctrlKey || ev.metaKey) && ev.key === 'f') { ev.preventDefault(); searchInput.focus(); }
});

// ═══════════════════════════════════════════════════════════════
//  Call Tree
// ═══════════════════════════════════════════════════════════════

let panelOpen = false;
const treeToggle = document.getElementById('treeToggle');
const treePanel = document.getElementById('treePanel');
const treeBody = document.getElementById('treeBody');
const treeCount = document.getElementById('treeCount');

// Build tree from graph
function buildCallTree() {
  // In-degree: how many edges point TO each node
  const inDegree = {};
  graph.nodes.forEach(n => inDegree[n.id] = 0);
  graph.edges.forEach(e => {
    const t = e.target?.id || e.target;
    if (inDegree[t] !== undefined) inDegree[t]++;
  });

  // Roots = no incoming edges
  const roots = graph.nodes.filter(n => inDegree[n.id] === 0);
  if (roots.length === 0 && graph.nodes.length > 0) {
    // If everything is called (circular), pick nodes with lowest in-degree
    const minDeg = Math.min(...graph.nodes.map(n => inDegree[n.id]));
    roots.push(...graph.nodes.filter(n => inDegree[n.id] === minDeg).slice(0, 5));
  }

  // Children map
  const childrenMap = {};
  graph.nodes.forEach(n => childrenMap[n.id] = []);
  graph.edges.forEach(e => {
    const s = e.source?.id || e.source, t = e.target?.id || e.target;
    if (childrenMap[s] && nodeMap[t]) childrenMap[s].push(t);
  });

  // Deduplicate
  Object.keys(childrenMap).forEach(k => { childrenMap[k] = [...new Set(childrenMap[k])]; });

  // Build tree recursively (limit depth to prevent cycles)
  function buildSubTree(nodeId, depth, visited) {
    if (depth > 20 || visited.has(nodeId)) return null;
    const n = nodeMap[nodeId];
    if (!n) return null;

    const children = [];
    const nextVisited = new Set(visited);
    nextVisited.add(nodeId);

    for (const childId of (childrenMap[nodeId] || [])) {
      const sub = buildSubTree(childId, depth + 1, nextVisited);
      if (sub) children.push(sub);
    }

    return {
      id: nodeId,
      label: n.label,
      file: n.file,
      type: n.type,
      children,
      expanded: depth < 2, // auto-expand first 2 levels
      depth,
    };
  }

  const treeRoots = [];
  const globalVisited = new Set();
  for (const root of roots.slice(0, 20)) { // cap roots
    const sub = buildSubTree(root.id, 0, globalVisited);
    if (sub) treeRoots.push(sub);
  }

  // Total node count
  let totalNodes = 0;
  function countNodes(t) { totalNodes++; t.children.forEach(countNodes); }
  treeRoots.forEach(countNodes);
  treeCount.textContent = '(' + totalNodes + ' nodes)';

  return treeRoots;
}

let treeData = [];

function renderTree(roots) {
  if (!roots.length) {
    treeBody.innerHTML = '<div class="tree-empty">No call hierarchy found</div>';
    return;
  }

  let html = '';
  for (const root of roots) {
    html += renderTreeNode(root, 0);
  }
  treeBody.innerHTML = html;

  // Attach click handlers
  treeBody.querySelectorAll('.tree-item').forEach(el => {
    el.addEventListener('click', function(ev) {
      const id = this.dataset.id;
      if (!id) return;
      const toggle = this.querySelector('.tree-toggle');
      if (toggle && !toggle.classList.contains('leaf')) {
        const children = this.nextElementSibling;
        if (children && children.classList.contains('tree-children')) {
          const isOpen = children.style.display !== 'none';
          children.style.display = isOpen ? 'none' : '';
          toggle.classList.toggle('expanded', !isOpen);
        }
      }
      // Highlight in graph
      ev.stopPropagation();
      highlightPaths(id);
    });
  });
}

function renderTreeNode(node, depth) {
  const isLeaf = node.children.length === 0;
  const isRoot = depth === 0;
  const dotColor = node.type === 'method' ? '#6c8cff' : '#4ade80';
  const shortFile = node.file.split('/').pop() || node.file;
  const toggleIcon = isLeaf ? '' : '▶';
  const indent = depth * 16;

  let html = '<div class="tree-item' + (isRoot ? ' tree-root' : '') + '" data-id="' + node.id + '" style="padding-left:' + indent + 'px">';
  html += '<div class="tree-item-row">';
  html += '<span class="tree-toggle' + (isLeaf ? ' leaf' : ' expanded') + '">' + toggleIcon + '</span>';
  html += '<span class="tree-dot" style="background:' + dotColor + '"></span>';
  html += '<span class="tree-label">' + node.label.replace('()','') + '</span>';
  html += '<span class="tree-file">' + shortFile + '</span>';
  html += '</div></div>';

  if (!isLeaf) {
    html += '<div class="tree-children" style="display:' + (node.expanded ? '' : 'none') + '">';
    for (const child of node.children) {
      html += renderTreeNode(child, depth + 1);
    }
    html += '</div>';
  }

  return html;
}

function highlightTreeItem(id) {
  treeBody.querySelectorAll('.tree-item').forEach(el => {
    el.classList.toggle('highlighted', el.dataset.id === id);
  });
}

function clearTreeHighlight() {
  treeBody.querySelectorAll('.tree-item').forEach(el => el.classList.remove('highlighted'));
}

// Build tree on load
treeData = buildCallTree();

// Toggle tree panel
treeToggle.addEventListener('click', () => {
  panelOpen = !panelOpen;
  treePanel.classList.toggle('open', panelOpen);
  treeToggle.classList.toggle('active', panelOpen);

  // Trigger resize
  const w = window.innerWidth - (panelOpen ? 320 : 0);
  const h = window.innerHeight - 45;
  svg.attr('width', w).attr('height', h);
  simulation.force('center', d3.forceCenter(w / 2, h / 2));
  simulation.alpha(0.3).restart();

  // Render tree on first open
  if (panelOpen && treeBody.children.length === 0) {
    renderTree(treeData);
  }
});
</script>
</body>
</html>`;
}

/** Check if a link connects nodes in different files */
function linkCrossesFile(edge, graph) {
  const src = graph.nodes.find(n => n.id === (edge.source?.id || edge.source));
  const tgt = graph.nodes.find(n => n.id === (edge.target?.id || edge.target));
  return src && tgt && src.file !== tgt.file;
}