import { sharedStyles } from '../../ui/shared-styles.js';

/**
 * Build the Hotspots view — treemap/heat grid of files by churn × complexity.
 *
 * @returns {string}
 */
export function buildHotspotsHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>gitm8 atlas — Hotspots</title>
<script src="https://d3js.org/d3.v7.min.js"></script>
<style>${sharedStyles()}
.hotspot-grid{display:flex;flex-wrap:wrap;gap:2px;padding:0.5rem;overflow-y:auto;align-content:flex-start;height:calc(100vh - 44px)}
.hotspot-cell{display:flex;flex-direction:column;align-items:center;justify-content:center;
              font-size:0.55rem;color:#e1e4ed;cursor:pointer;border-radius:3px;
              transition:opacity .15s;overflow:hidden;position:relative}
.hotspot-cell:hover{opacity:0.85;z-index:2}
.hotspot-cell .cell-label{font-size:0.5rem;text-align:center;padding:0 2px;overflow:hidden;
                          text-overflow:ellipsis;white-space:nowrap;width:100%;color:rgba(255,255,255,.7)}
.hotspot-cell .cell-score{font-size:0.45rem;color:rgba(255,255,255,.5)}
.filter-bar{display:flex;gap:0.5rem;padding:0.4rem 0.75rem;background:#0f1117;
            border-bottom:1px solid #1c1f2a;align-items:center;flex-shrink:0}
.filter-bar label{color:#5a5f7a;font-size:0.65rem}
.filter-bar select{background:#0a0b0f;border:1px solid #1c1f2a;border-radius:4px;color:#e1e4ed;
                    font-size:0.65rem;padding:0.2rem 0.4rem;outline:none}
.filter-bar select:focus{border-color:#6c8cff}
.hotspot-sort{font-size:0.55rem;color:#5a5f7a;margin-left:auto}
.empty-state-sm{color:#3a3f4f;font-size:0.7rem;text-align:center;padding:2rem;width:100%}
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
    <a class="nav-btn active" href="/views/hotspots">🔥 Hotspots</a>
    <a class="nav-btn" href="/views/timeline">📅 Timeline</a>
  </nav>
</div>

<div class="filter-bar">
  <label>Min score</label>
  <select id="minScore">
    <option value="0">All</option>
    <option value="0.1">0.1+</option>
    <option value="0.3" selected>0.3+</option>
    <option value="0.5">0.5+</option>
    <option value="0.7">0.7+</option>
  </select>
  <span class="hotspot-sort" id="hotspotCount">Loading hotspots...</span>
</div>

<div class="hotspot-grid" id="hotspotGrid">
  <div class="loading" style="position:relative;transform:none;left:auto;top:auto;padding:2rem">
    <div class="spinner"></div>
    <p>Analyzing hotspots...</p>
  </div>
</div>

<script>
fetch('/api/hotspots?limit=100')
  .then(function(r) { return r.json(); })
  .then(function(data) {
    var hotspots = data.hotspots || [];
    var grid = document.getElementById('hotspotGrid');
    var minScoreSelect = document.getElementById('minScore');
    var countEl = document.getElementById('hotspotCount');

    if (hotspots.length === 0) {
      grid.innerHTML = '<div class="empty-state-sm">No hotspot data available</div>';
      countEl.textContent = '0 hotspots';
      return;
    }

    function render(threshold) {
      var filtered = hotspots.filter(function(h) { return h.score >= threshold; });
      countEl.textContent = filtered.length + '/' + hotspots.length + ' hotspots';
      grid.innerHTML = '';

      if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-state-sm">No hotspots above ' + threshold + ' threshold</div>';
        return;
      }

      // Determine grid layout
      var cols = Math.ceil(Math.sqrt(filtered.length * 1.5));
      var totalArea = grid.clientWidth * 400;
      var cellW = Math.max(60, Math.min(180, grid.clientWidth / cols - 2));
      var maxScore = Math.max.apply(null, filtered.map(function(h) { return h.score; }));

      filtered.sort(function(a, b) { return b.score - a.score; });

      filtered.forEach(function(h, i) {
        var cell = document.createElement('div');
        cell.className = 'hotspot-cell';
        var intensity = maxScore > 0 ? h.score / maxScore : 0;
        // Red-orange gradient based on score
        var r = Math.round(240 - (1 - intensity) * 100);
        var g = Math.round(80 - (1 - intensity) * 60);
        var b = Math.round(80 - (1 - intensity) * 60);
        cell.style.background = 'rgba(' + r + ',' + g + ',' + b + ',0.7)';
        cell.style.width = cellW + 'px';
        cell.style.height = Math.max(40, cellW * 0.6) + 'px';
        cell.title = h.filePath + '\\nScore: ' + h.score + ' | Changes: ' + h.churn + ' | Complexity: ' + h.complexity;
        cell.innerHTML = '<div class="cell-label">' + (h.filePath ? h.filePath.split('/').pop() : '') + '</div>' +
          '<div class="cell-score">' + h.score + '</div>';
        cell.addEventListener('click', function() {
          // Navigate to architecture view and highlight this file
          window.location = '/views/architecture?highlight=' + encodeURIComponent(h.filePath || '');
        });
        grid.appendChild(cell);
      });
    }

    minScoreSelect.addEventListener('change', function() {
      render(parseFloat(this.value));
    });
    render(0.3);
  });
</script>
</body>
</html>`;
}
