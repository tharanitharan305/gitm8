import { sharedStyles } from '../../ui/shared-styles.js';
import { forceGraphComponent } from '../../ui/components/force-graph.js';

/**
 * Build the Call Flow view — hierarchical call tree with graph.
 *
 * @param {import('../../graph/query.js').GraphQuery} graph
 * @returns {string}
 */
export function buildCallflowHtml(graph) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>gitm8 atlas — Call Flow</title>
<script src="https://d3js.org/d3.v7.min.js"></script>
<style>${sharedStyles()}
.tree-panel{width:320px;overflow-y:auto;background:#0f1117;border-right:1px solid #1c1f2a;flex-shrink:0;padding:0.5rem 0}
.tree-item{cursor:pointer;padding:0.15rem 0.5rem;font-size:0.7rem;transition:background .1s;border-radius:3px;margin:0.1rem 0.2rem}
.tree-item:hover{background:#151822}
.tree-item.highlighted{background:rgba(108,140,255,.1)}
.tree-item-row{display:flex;align-items:center;gap:0.2rem}
.tree-toggle{width:12px;height:12px;display:flex;align-items:center;justify-content:center;
             font-size:0.5rem;color:#3a3f4f;flex-shrink:0;cursor:pointer;transition:transform .15s}
.tree-toggle.expanded{transform:rotate(90deg)}
.tree-toggle.leaf{visibility:hidden}
.tree-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0;margin:0 0.15rem}
.tree-label{color:#e1e4ed;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
.tree-file{color:#5a5f7a;font-size:0.6rem;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tree-children{overflow:hidden}
.empty-tree{color:#3a3f4f;font-size:0.7rem;text-align:center;padding:2rem 1rem}
</style>
</head>
<body>

<div class="header">
  <h1>gitm8 atlas</h1>
  <nav class="header-nav">
    <a class="nav-btn" href="/views/report">📊 Report</a>
    <a class="nav-btn" href="/views/architecture">🏛️ Map</a>
    <a class="nav-btn" href="/views/layers">🔗 Layers</a>
    <a class="nav-btn active" href="/views/callflow">🌳 Calls</a>
    <a class="nav-btn" href="/views/hotspots">🔥 Hotspots</a>
    <a class="nav-btn" href="/views/timeline">📅 Timeline</a>
  </nav>
  <div class="header-right">
    <div class="stats" id="callCount">0 calls</div>
  </div>
</div>

<div class="main">
  <div class="tree-panel" id="treePanel">
    <div id="treeBody"></div>
  </div>
  <div id="viz">
    <div class="loading" id="loading">
      <div class="spinner"></div>
      <p>Loading call graph...</p>
    </div>
    <div class="tooltip" id="tooltip"></div>
  </div>
</div>

<script>
// Fetch call flow data
Promise.all([
  fetch('/api/graph?lod=module').then(function(r) { return r.json(); }),
  fetch('/api/search?q=').then(function(r) { return r.json(); })
]).then(function(results) {
  var graphData = results[0];
  if (!graphData.nodes || graphData.nodes.length === 0) {
    document.getElementById('viz').innerHTML = '<div class="empty-state visible"><span>🌳</span><p>No call data</p></div>';
    return;
  }

  document.getElementById('loading').style.display = 'none';

  // Build call tree from graph
  var inDegree = {};
  graphData.nodes.forEach(function(n) { inDegree[n.id] = 0; });
  graphData.edges.forEach(function(e) {
    var t = e.target && e.target.id != null ? e.target.id : e.target;
    if (inDegree[t] !== undefined) inDegree[t]++;
  });

  var roots = graphData.nodes.filter(function(n) { return inDegree[n.id] === 0; });
  if (roots.length === 0 && graphData.nodes.length > 0) roots = [graphData.nodes[0]];
  if (roots.length > 10) roots = roots.slice(0, 10);

  var childrenMap = {};
  graphData.nodes.forEach(function(n) { childrenMap[n.id] = []; });
  graphData.edges.forEach(function(e) {
    var s = e.source && e.source.id != null ? e.source.id : e.source;
    var t = e.target && e.target.id != null ? e.target.id : e.target;
    if (childrenMap[s] && inDegree[t] !== undefined) childrenMap[s].push(t);
  });
  Object.keys(childrenMap).forEach(function(k) { childrenMap[k] = [...new Set(childrenMap[k])]; });

  function buildSubTree(nodeId, depth, visited) {
    if (depth > 15 || visited.has(nodeId)) return null;
    var n = graphData.nodes.find(function(nn) { return nn.id === nodeId; });
    if (!n) return null;
    var children = [];
    var nextVisited = new Set(visited);
    nextVisited.add(nodeId);
    (childrenMap[nodeId] || []).forEach(function(childId) {
      var sub = buildSubTree(childId, depth + 1, nextVisited);
      if (sub) children.push(sub);
    });
    return { id: nodeId, label: n.label, file: n.filePath, type: n.type, children: children, expanded: depth < 2, depth: depth };
  }

  var treeData = roots.slice(0, 15).map(function(r) { return buildSubTree(r.id, 0, new Set()); }).filter(Boolean);

  // ── Render tree ──
  function renderTree(roots) {
    var html = '';
    roots.forEach(function(root) { html += renderNode(root, 0); });
    document.getElementById('treeBody').innerHTML = html;

    document.querySelectorAll('.tree-item').forEach(function(el) {
      el.addEventListener('click', function(ev) {
        var id = this.dataset.id;
        if (!id) return;
        var toggle = this.querySelector('.tree-toggle');
        if (toggle && !toggle.classList.contains('leaf')) {
          var children = this.nextElementSibling;
          if (children && children.classList.contains('tree-children')) {
            var isOpen = children.style.display !== 'none';
            children.style.display = isOpen ? 'none' : '';
            toggle.classList.toggle('expanded', !isOpen);
          }
        }
        if (window.fg) {
          window.fg.highlight(id);
          var node = graphData.nodes.find(function(n) { return n.id === id; });
          if (node) {
            cx = node.x || 0; cy = node.y || 0;
            var w = document.getElementById('viz').clientWidth;
            var h = document.getElementById('viz').clientHeight;
            var transform = d3.zoomIdentity.translate(w/2 - cx, h/2 - cy);
            d3.select(window.fg.svg.node()).transition().duration(500)
              .call(d3.zoom().transform, transform);
          }
        }
      });
    });
  }

  function renderNode(node, depth) {
    var isLeaf = node.children.length === 0;
    var dotColor = node.type === 'method' ? '#f59e0b' : node.type === 'function' ? '#4ade80' : '#6c8cff';
    var shortFile = node.file ? node.file.split('/').pop() : '';
    var indent = depth * 14;
    var html = '<div class="tree-item" data-id="' + node.id + '" style="padding-left:' + indent + 'px">';
    html += '<div class="tree-item-row">';
    html += '<span class="tree-toggle' + (isLeaf ? ' leaf' : ' expanded') + '">' + (isLeaf ? '' : '▶') + '</span>';
    html += '<span class="tree-dot" style="background:' + dotColor + '"></span>';
    html += '<span class="tree-label">' + (node.label || node.id).replace('()','') + '</span>';
    if (shortFile) html += '<span class="tree-file">' + shortFile + '</span>';
    html += '</div></div>';
    if (!isLeaf) {
      html += '<div class="tree-children" style="display:' + (node.expanded ? '' : 'none') + '">';
      node.children.forEach(function(c) { html += renderNode(c, depth + 1); });
      html += '</div>';
    }
    return html;
  }

  // Count total
  var totalCalls = 0;
  function countCalls(t) { totalCalls++; t.children.forEach(countCalls); }
  treeData.forEach(countCalls);
  document.getElementById('callCount').innerHTML = totalCalls + ' nodes';

  if (treeData.length === 0) {
    document.getElementById('treeBody').innerHTML = '<div class="empty-tree">No call hierarchy found</div>';
    return;
  }
  renderTree(treeData);

  // ── Force graph ──
  window.fg = createForceGraph(document.getElementById('viz'), graphData, {});
});

${forceGraphComponent()}
</script>
</body>
</html>`;
}
