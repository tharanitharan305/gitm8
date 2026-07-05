import { sharedStyles } from '../../ui/shared-styles.js';

/**
 * Build the Layer Dependency Diagram view.
 * Shows architectural layers as horizontal bands with dependency arcs.
 *
 * @param {import('../../graph/query.js').GraphQuery} graph
 * @returns {string}
 */
export function buildLayersHtml(graph) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>gitm8 atlas — Layer Diagram</title>
<script src="https://d3js.org/d3.v7.min.js"></script>
<style>${sharedStyles()}
.layer-list{width:200px;overflow-y:auto;padding:0.75rem;border-right:1px solid #1c1f2a;flex-shrink:0}
.layer-card{padding:0.5rem 0.6rem;border-radius:6px;margin-bottom:0.3rem;cursor:pointer;
            border:1px solid transparent;transition:border-color .15s,background .15s;font-size:0.7rem}
.layer-card:hover{border-color:#2a2e3a;background:#151822}
.layer-card.active{border-color:var(--lc);background:rgba(108,140,255,.08)}
.layer-card .layer-name{font-weight:500;color:#e1e4ed}
.layer-card .layer-count{font-size:0.6rem;color:#5a5f7a;margin-top:0.1rem}
.layer-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:0.3rem;vertical-align:middle}

.graph-area{flex:1;position:relative;overflow:hidden;min-width:0}
.dep-link{fill:none;stroke-opacity:0.3;transition:stroke-opacity .2s}
.dep-link:hover{stroke-opacity:0.7}
.layer-band{cursor:pointer;transition:opacity .2s}
.layer-band:hover{opacity:0.85}
.layer-label{font-size:0.75rem;font-weight:600;fill:#e1e4ed}
.layer-sub{font-size:0.55rem;fill:#5a5f7a}
.violation-panel{position:absolute;bottom:0.6rem;right:0.6rem;background:#151822;border:1px solid #f87171;
                 border-radius:6px;padding:0.5rem 0.8rem;max-width:300px;display:none;font-size:0.65rem}
.violation-panel.visible{display:block}
.violation-panel .vp-title{color:#f87171;font-weight:600;margin-bottom:0.25rem;font-size:0.7rem}
.violation-panel .vp-item{color:#5a5f7a;padding:0.1rem 0}
</style>
</head>
<body>

<div class="header">
  <h1>gitm8 atlas</h1>
  <nav class="header-nav">
    <a class="nav-btn" href="/views/report">📊 Report</a>
    <a class="nav-btn" href="/views/architecture">🏛️ Map</a>
    <a class="nav-btn active" href="/views/layers">🔗 Layers</a>
    <a class="nav-btn" href="/views/callflow">🌳 Calls</a>
    <a class="nav-btn" href="/views/hotspots">🔥 Hotspots</a>
    <a class="nav-btn" href="/views/timeline">📅 Timeline</a>
  </nav>
</div>

<div class="main">
  <div class="layer-list" id="layerList"></div>
  <div class="graph-area" id="graphArea">
    <svg id="graphSvg" width="100%" height="100%"></svg>
    <div class="tooltip" id="tooltip"></div>
    <div class="violation-panel" id="violationPanel"></div>
  </div>
</div>

<script>
fetch('/api/layers')
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (!data.nodes || data.nodes.length === 0) {
      document.getElementById('graphArea').innerHTML = '<div class="empty-state visible"><span>🔗</span><p>No layer data</p></div>';
      return;
    }

    // ── Render layer list ──
    var layerList = document.getElementById('layerList');
    data.nodes.forEach(function(node) {
      var card = document.createElement('div');
      card.className = 'layer-card';
      card.style.setProperty('--lc', node.color);
      card.innerHTML = '<span class="layer-dot" style="background:' + node.color + '"></span>' +
        '<span class="layer-name">' + node.name + '</span>' +
        '<div class="layer-count">' + (node.fileCount || 0) + ' files</div>';
      card.addEventListener('click', function() { highlightLayer(node.id); });
      layerList.appendChild(card);
    });

    // ── Render layer graph ──
    var svg = d3.select('#graphSvg');
    var width = svg.node().parentElement.clientWidth;
    var height = svg.node().parentElement.clientHeight;
    svg.attr('viewBox', [0, 0, width, height]);
    var g = svg.append('g');

    var LAYER_HEIGHT = 70;
    var LAYER_GAP = 30;
    var BAND_WIDTH = Math.min(600, width * 0.55);
    var BAND_X = 160;

    var layers = data.nodes.map(function(n, i) {
      return { ...n, y: 60 + i * (LAYER_HEIGHT + LAYER_GAP), height: LAYER_HEIGHT };
    });

    // Draw bands
    var bands = g.selectAll('.layer-band').data(layers).join('g')
      .attr('class', 'layer-band')
      .attr('transform', function(d) { return 'translate(' + BAND_X + ',' + d.y + ')'; });

    bands.append('rect')
      .attr('width', BAND_WIDTH).attr('height', function(d) { return d.height; })
      .attr('rx', 6).attr('ry', 6)
      .attr('fill', function(d) { return d.color; }).attr('opacity', 0.1)
      .attr('stroke', function(d) { return d.color; }).attr('stroke-width', 1);

    bands.append('text').attr('class', 'layer-label')
      .attr('x', 14).attr('y', 24).text(function(d) { return d.name; });

    bands.append('text').attr('class', 'layer-sub')
      .attr('x', 14).attr('y', 42).text(function(d) { return (d.fileCount || 0) + ' files'; });

    // Draw dependency arcs
    var linkGroup = g.append('g');
    var tooltip = d3.select('#tooltip');

    (data.links || []).forEach(function(d) {
      var src = layers.find(function(l) { return l.id === d.source; });
      var tgt = layers.find(function(l) { return l.id === d.target; });
      if (!src || !tgt) return;

      var x1 = BAND_X + BAND_WIDTH / 2;
      var y1 = src.y + src.height;
      var x2 = BAND_X + BAND_WIDTH / 2;
      var y2 = tgt.y;

      var path = d3.path();
      path.moveTo(x1, y1);
      path.quadraticCurveTo(x1, (y1 + y2) / 2, x2, y2);

      linkGroup.append('path')
        .attr('d', path.toString())
        .attr('class', 'dep-link')
        .attr('stroke', src.color)
        .attr('stroke-width', Math.min(1 + (d.value || 1) * 0.2, 5))
        .on('mouseover', function(ev) {
          tooltip.html('<div class="tt-title">' + d.source + ' → ' + d.target + '</div><div class="tt-detail">' + (d.value || 0) + ' dependencies</div>')
            .classed('visible', true)
            .style('left', (ev.pageX + 15) + 'px').style('top', (ev.pageY - 10) + 'px');
        })
        .on('mouseout', function() { tooltip.classed('visible', false); });
    });

    // Zoom
    svg.call(d3.zoom().scaleExtent([0.3, 3]).on('zoom', function(ev) {
      g.attr('transform', ev.transform);
    }));
  });

function highlightLayer(id) {
  document.querySelectorAll('.layer-card').forEach(function(c) {
    c.classList.toggle('active', c.querySelector('.layer-name').textContent.startsWith(id));
  });
}
</script>
</body>
</html>`;
}
