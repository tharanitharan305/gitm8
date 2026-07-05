import { sharedStyles } from '../../ui/shared-styles.js';

/**
 * Build the Timeline view — D3 area chart of commit activity.
 *
 * @returns {string}
 */
export function buildTimelineHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>gitm8 atlas — Timeline</title>
<script src="https://d3js.org/d3.v7.min.js"></script>
<style>${sharedStyles()}
.timeline-container{padding:1.5rem;height:calc(100vh - 44px);overflow-y:auto}
.chart-card{background:#0f1117;border:1px solid #1c1f2a;border-radius:10px;padding:1rem;margin-bottom:1rem}
.chart-card h3{font-size:0.75rem;font-weight:600;color:#5a5f7a;text-transform:uppercase;letter-spacing:.05em;margin-bottom:0.75rem}
.chart-area{width:100%;height:280px}
.chart-area svg{display:block}
.chart-controls{display:flex;gap:0.5rem;margin-bottom:0.75rem}
.range-btn{background:#0a0b0f;border:1px solid #1c1f2a;border-radius:4px;color:#5a5f7a;
           cursor:pointer;font-size:0.6rem;padding:0.2rem 0.45rem;transition:all .15s}
.range-btn:hover{border-color:#6c8cff;color:#e1e4ed}
.range-btn.active{background:rgba(108,140,255,.12);border-color:#6c8cff;color:#6c8cff}
.timeline-bar{fill:rgba(108,140,255,.2);transition:fill .15s;cursor:pointer}
.timeline-bar:hover{fill:rgba(108,140,255,.6)}
.axis text{fill:#5a5f7a;font-size:10px}
.axis line,.axis path{stroke:#1c1f2a}
</style>
</head>
<body>

<div class="header">
  <h1>gitm8 atlas</h1>
  <nav class="header-nav">
    <a class="nav-btn" href="/views/report">📊 Report</a>
    <a class="nav-btn" href="/views/architecture">🏛️ Map</a>
    <a class="nav-btn" href="/views/layers">🔗 Layers</a>
    <a class="nav-btn" href="/views/callflow">🌳 Calls</a>
    <a class="nav-btn" href="/views/hotspots">🔥 Hotspots</a>
    <a class="nav-btn active" href="/views/timeline">📅 Timeline</a>
  </nav>
</div>

<div class="timeline-container">
  <div class="chart-card">
    <h3>📅 Commit Activity</h3>
    <div class="chart-controls" id="rangeControls">
      <button class="range-btn" data-days="7">1W</button>
      <button class="range-btn active" data-days="30">1M</button>
      <button class="range-btn" data-days="90">3M</button>
      <button class="range-btn" data-days="180">6M</button>
      <button class="range-btn" data-days="365">1Y</button>
    </div>
    <div class="chart-area" id="timelineChart"></div>
  </div>
</div>

<script>
var currentDays = 30;

function loadTimeline(days) {
  currentDays = days;
  var container = document.getElementById('timelineChart');
  container.innerHTML = '<div class="loading" style="position:relative;transform:none;left:auto;top:auto;padding:1rem"><div class="spinner"></div></div>';

  document.querySelectorAll('.range-btn').forEach(function(b) {
    b.classList.toggle('active', parseInt(b.dataset.days) === days);
  });

  fetch('/api/timeline?sinceDays=' + days)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var entries = data.entries || [];
      container.innerHTML = '';

      if (entries.length === 0) {
        container.innerHTML = '<div class="empty-state-sm" style="padding:2rem;text-align:center">No commit data for this period</div>';
        return;
      }

      var margin = { top: 10, right: 10, bottom: 25, left: 40 };
      var w = container.clientWidth - margin.left - margin.right;
      var h = 260 - margin.top - margin.bottom;

      var svg = d3.select(container).append('svg')
        .attr('width', '100%').attr('height', 260).style('display', 'block');

      var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      var x = d3.scaleBand()
        .domain(entries.map(function(d) { return d.date; }))
        .range([0, w]).padding(0.08);

      var y = d3.scaleLinear()
        .domain([0, d3.max(entries, function(d) { return d.commits; }) || 1])
        .range([h, 0]);

      // Bars
      g.selectAll('rect').data(entries).join('rect')
        .attr('class', 'timeline-bar')
        .attr('x', function(d) { return x(d.date); })
        .attr('y', function(d) { return y(d.commits); })
        .attr('width', x.bandwidth())
        .attr('height', function(d) { return h - y(d.commits); })
        .append('title').text(function(d) { return d.date + ': ' + d.commits + ' commits' + (d.author ? ' by ' + d.author : ''); });

      // Axes
      var xAxis = d3.axisBottom(x);
      var yAxis = d3.axisLeft(y).ticks(5);

      g.append('g').attr('class', 'axis').attr('transform', 'translate(0,' + h + ')')
        .call(xAxis)
        .selectAll('text').attr('transform', 'rotate(-45)').attr('text-anchor', 'end').attr('font-size', '10px');

      g.append('g').attr('class', 'axis').call(yAxis);
    });
}

document.getElementById('rangeControls').addEventListener('click', function(ev) {
  var btn = ev.target.closest('.range-btn');
  if (btn) loadTimeline(parseInt(btn.dataset.days));
});

loadTimeline(30);
</script>
</body>
</html>`;
}
