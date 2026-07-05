import { sharedStyles } from '../../ui/shared-styles.js';

/**
 * Build the Report dashboard view — summary stats at a glance.
 *
 * @param {import('../../graph/query.js').GraphQuery} graph
 * @returns {string} Complete HTML document
 */
export function buildReportHtml(graph) {
  const stats = graph.getStats();
  const fileGraph = graph.getGraph({ lod: 'file' });
  const hotspots = graph.getHotspots(10);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>gitm8 atlas — Report</title>
<script src="https://d3js.org/d3.v7.min.js"></script>
<style>${sharedStyles()}
.report-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem;padding:1.5rem;overflow-y:auto;height:calc(100vh - 44px)}
.card{background:#0f1117;border:1px solid #1c1f2a;border-radius:10px;padding:1rem}
.card h3{font-size:0.75rem;font-weight:600;color:#5a5f7a;text-transform:uppercase;letter-spacing:.05em;margin-bottom:0.75rem}
.stat-row{display:flex;justify-content:space-between;align-items:center;padding:0.3rem 0;border-bottom:1px solid #14161f}
.stat-row:last-child{border:none}
.stat-label{color:#8b90a5;font-size:0.7rem}
.stat-value{color:#e1e4ed;font-size:0.85rem;font-weight:600}
.stat-value.highlight{color:#6c8cff}
.stat-value.green{color:#4ade80}
.stat-value.orange{color:#f59e0b}
.stat-value.red{color:#f87171}

.language-bar{display:flex;height:6px;border-radius:3px;overflow:hidden;margin-top:0.5rem}
.lang-seg{height:100%}
.hotspot-item{padding:0.4rem 0;border-bottom:1px solid #14161f;font-size:0.7rem}
.hotspot-item:last-child{border:none}
.hotspot-path{color:#6c8cff;font-family:monospace;font-size:0.65rem;display:block;margin-bottom:0.15rem}
.hotspot-score{display:flex;gap:0.5rem}
.hs{font-size:0.6rem;color:#5a5f7a}
.hs-num{color:#e1e4ed;font-weight:500}
.dir-item{display:flex;justify-content:space-between;padding:0.2rem 0;font-size:0.7rem}
.dir-name{color:#8b90a5}
.dir-count{color:#6c8cff}

.contributor-item{display:flex;justify-content:space-between;padding:0.2rem 0;font-size:0.7rem}
.con-name{color:#e1e4ed}
.con-files{color:#5a5f7a}
.empty-state-sm{color:#3a3f4f;font-size:0.7rem;text-align:center;padding:1rem}

.mini-timeline{width:100%;height:80px}
.timeline-bar{fill:rgba(108,140,255,.15);transition:fill .15s;cursor:pointer}
.timeline-bar:hover{fill:rgba(108,140,255,.4)}
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
</div>

<div class="report-grid">

  <!-- Stats card -->
  <div class="card">
    <h3>📊 Repository Stats</h3>
    <div class="stat-row"><span class="stat-label">Files</span><span class="stat-value highlight">${stats.typeCounts.file || 0}</span></div>
    <div class="stat-row"><span class="stat-label">Classes</span><span class="stat-value">${stats.typeCounts.class || 0}</span></div>
    <div class="stat-row"><span class="stat-label">Methods</span><span class="stat-value">${stats.typeCounts.method || 0}</span></div>
    <div class="stat-row"><span class="stat-label">Functions</span><span class="stat-value">${stats.typeCounts.function || 0}</span></div>
    <div class="stat-row"><span class="stat-label">Routes</span><span class="stat-value orange">${stats.typeCounts.route || 0}</span></div>
    <div class="stat-row"><span class="stat-label">Graph Edges</span><span class="stat-value">${stats.totalEdges}</span></div>
  </div>

  <!-- Languages card -->
  <div class="card">
    <h3>🔤 Languages</h3>
    ${Object.entries(stats.languages || {}).length > 0
      ? Object.entries(stats.languages).map(([lang, count], i) => {
          const colors = ['#6c8cff','#4ade80','#f59e0b','#f87171','#a78bfa','#22d3ee'];
          const color = colors[i % colors.length];
          const total = Object.values(stats.languages).reduce((s, v) => s + v, 0);
          const pct = Math.round((count / total) * 100);
          return '<div class="stat-row"><span class="stat-label">' + lang + '</span><span class="stat-value">' + count + ' files <span style="font-size:0.6rem;color:#5a5f7a">(' + pct + '%)</span></span></div>';
        }).join('')
      : '<div class="empty-state-sm">No language data</div>'
    }
  </div>

  <!-- Hotspots card -->
  <div class="card">
    <h3>🔥 Top Hotspots</h3>
    ${hotspots.length > 0
      ? hotspots.slice(0, 8).map(function(h) {
          var scoreColor = h.score > 0.5 ? '#f87171' : h.score > 0.3 ? '#f59e0b' : '#4ade80';
          return '<div class="hotspot-item">' +
            '<span class="hotspot-path">' + (h.filePath || 'unknown') + '</span>' +
            '<div class="hotspot-score">' +
            '<span class="hs">Score: <span class="hs-num" style="color:' + scoreColor + '">' + h.score + '</span></span>' +
            '<span class="hs">Changes: <span class="hs-num">' + h.churn + '</span></span>' +
            '</div></div>';
        }).join('')
      : '<div class="empty-state-sm">No hotspot data</div>'
    }
  </div>

  <!-- Top Directories card -->
  <div class="card">
    <h3>📁 Top Directories</h3>
    ${(stats.topDirs || []).slice(0, 10).map(function(d) {
      return '<div class="dir-item"><span class="dir-name">' + d.dir + '</span><span class="dir-count">' + d.count + '</span></div>';
    }).join('') || '<div class="empty-state-sm">No directory data</div>'}
  </div>

  <!-- Contributors card -->
  <div class="card">
    <h3>👥 Top Contributors</h3>
    ${(stats.topContributors || []).slice(0, 8).map(function(c) {
      return '<div class="contributor-item"><span class="con-name">' + c.name + '</span><span class="con-files">' + c.files + ' files</span></div>';
    }).join('') || '<div class="empty-state-sm">No contributor data</div>'}
  </div>

  <!-- Mini Timeline card -->
  <div class="card" style="grid-column:span 2">
    <h3>📅 Commit Activity (Last 30 days)</h3>
    <div class="mini-timeline" id="miniTimeline"></div>
  </div>

</div>

<script>
// Mini timeline — sparkline from /api/timeline
fetch('/api/timeline?sinceDays=30')
  .then(function(r) { return r.json(); })
  .then(function(data) {
    var entries = data.entries || [];
    if (entries.length === 0) return;

    var svg = d3.select('#miniTimeline').append('svg')
      .attr('width', '100%').attr('height', 80).style('display','block');

    var margin = { top: 5, right: 5, bottom: 15, left: 30 };
    var w = svg.node().parentElement.clientWidth - margin.left - margin.right;
    var h = 80 - margin.top - margin.bottom;

    var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    var x = d3.scaleBand().domain(entries.map(function(d) { return d.date; }))
      .range([0, w]).padding(0.1);
    var y = d3.scaleLinear().domain([0, d3.max(entries, function(d) { return d.commits; }) || 1])
      .range([h, 0]);

    g.selectAll('rect').data(entries).join('rect')
      .attr('class', 'timeline-bar')
      .attr('x', function(d) { return x(d.date); })
      .attr('y', function(d) { return y(d.commits); })
      .attr('width', x.bandwidth())
      .attr('height', function(d) { return h - y(d.commits); })
      .append('title').text(function(d) { return d.date + ': ' + d.commits + ' commits'; });

    g.append('g').call(d3.axisLeft(y).ticks(3));
    g.append('g').attr('transform', 'translate(0,' + h + ')')
      .call(d3.axisBottom(x).ticks(5));
  });
</script>
</body>
</html>`;
}
