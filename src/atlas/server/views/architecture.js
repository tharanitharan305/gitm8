import { sharedStyles } from '../../ui/shared-styles.js';
import { forceGraphComponent } from '../../ui/components/force-graph.js';
import { searchBoxComponent } from '../../ui/components/search-box.js';
import { inspectorComponent } from '../../ui/components/inspector.js';
import { miniMapComponent } from '../../ui/components/mini-map.js';

/**
 * Build the Architecture Map view — the primary force-directed graph UI.
 *
 * @param {import('../../graph/query.js').GraphQuery} graph
 * @returns {string} Complete HTML document
 */
export function buildArchitectureHtml(graph) {
  const graphData = graph.getGraph({ lod: 'file' });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>gitm8 atlas — Architecture Map</title>
<script src="https://d3js.org/d3.v7.min.js"></script>
<style>${sharedStyles()}
.node circle.type-folder{opacity:0.3}
.node circle.type-file{opacity:0.8}
.minimap{width:150px;height:100px}
</style>
</head>
<body>

<div class="header">
  <h1>gitm8 atlas</h1>
  <nav class="header-nav">
    <a class="nav-btn active" href="/views/report">📊 Report</a>
    <a class="nav-btn" href="/views/architecture">🏛️ Map</a>
    <a class="nav-btn" href="/views/layers">🔗 Layers</a>
    <a class="nav-btn" href="/views/callflow">🌳 Calls</a>
    <a class="nav-btn" href="/views/hotspots">🔥 Hotspots</a>
    <a class="nav-btn" href="/views/timeline">📅 Timeline</a>
  </nav>
  <div class="header-right">
    <div class="search-wrap">
      <span class="search-icon">🔍</span>
      <input type="text" id="search" placeholder="Search files, classes..." autocomplete="off" spellcheck="false">
      <div class="search-results" id="searchResults"></div>
    </div>
    <div class="stats">
      <span>📁 <span class="num">${graphData.nodes.length}</span></span>
      <span>🔗 <span class="num">${graphData.edges.length}</span></span>
    </div>
  </div>
</div>

<div class="main">
  <div id="viz">
    <div class="loading" id="loading">
      <div class="spinner"></div>
      <p>Loading graph...</p>
    </div>
    <div class="tooltip" id="tooltip"></div>
    <div class="legend" id="legend">
      <span class="legend-item"><span class="legend-dot" style="background:#6c8cff"></span> File</span>
      <span class="legend-item"><span class="legend-dot" style="background:#4ade80"></span> Class</span>
      <span class="legend-item"><span class="legend-dot" style="background:#f59e0b"></span> Method</span>
      <span class="legend-item"><span class="legend-dot" style="background:#f87171"></span> Route</span>
      <span class="legend-item" style="color:#2a2e3a">--- import</span>
    </div>
    <div class="minimap" id="minimap"></div>
  </div>

  <div class="sidebar" id="inspector">
    <div class="sidebar-header">
      <span>🔍 Inspector</span>
      <button class="sidebar-close" id="inspectorClose">✕</button>
    </div>
    <div class="sidebar-body" id="inspectorBody"></div>
  </div>
</div>

<script>
const GRAPH = ${JSON.stringify(graphData)};
const nodeMap = {};
GRAPH.nodes.forEach(function(n) { nodeMap[n.id] = n; });

// ── Initialize graph ──
const graphEl = document.getElementById('viz');
const loadingEl = document.getElementById('loading');

const fg = createForceGraph(graphEl, GRAPH, {
  pinOnDrag: true,
  onNodeClick: function(d) { inspector.show(d); },
  onBackgroundClick: function() { inspector.hide(); },
});

loadingEl.style.display = 'none';

// ── Search ──
const search = createSearchBox(document.getElementById('search'), {
  resultsContainer: document.getElementById('searchResults'),
  data: GRAPH,
  onSearch: function(q) { fg.searchAndHighlight(q); },
  onSelect: function(node) {
    // Pan to the selected node
    var cx = node.x || 0, cy = node.y || 0;
    var w = graphEl.clientWidth, h = graphEl.clientHeight;
    var transform = d3.zoomIdentity.translate(w/2 - cx, h/2 - cy);
    d3.select(fg.svg.node()).transition().duration(500)
      .call(d3.zoom().transform, transform);
    fg.highlight(node.id);
    inspector.show(node);
  },
});

// ── Inspector ──
const inspector = createInspector(
  document.getElementById('inspector'),
  { bodyEl: document.getElementById('inspectorBody') }
);

document.getElementById('inspectorClose').addEventListener('click', function() {
  inspector.hide();
  fg.clearHighlight();
});

// ── Minimap ──
const minimap = createMiniMap(
  document.getElementById('minimap'),
  fg.svg.node(),
  { width: 150, height: 100 }
);
setTimeout(function() { minimap.render(GRAPH.nodes); }, 1000);

// ── Keyboard shortcuts ──
document.addEventListener('keydown', function(ev) {
  if (ev.key === 'Escape') {
    inspector.hide();
    fg.clearHighlight();
    search.clear();
  }
  if (ev.key === 'r' || ev.key === 'R') {
    fg.zoomReset();
  }
});

// ── Resize ──
window.addEventListener('resize', function() {
  var w = graphEl.clientWidth - (inspector.isOpen() ? 340 : 0);
  var h = graphEl.clientHeight;
  fg.resize(w, h);
});

${forceGraphComponent()}
${searchBoxComponent()}
${inspectorComponent()}
${miniMapComponent()}
</script>
</body>
</html>`;
}
