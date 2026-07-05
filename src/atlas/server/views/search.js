import { sharedStyles } from '../../ui/shared-styles.js';

/**
 * Build the Search page — full-text search across all nodes.
 *
 * @returns {string}
 */
export function buildSearchHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>gitm8 atlas — Search</title>
<script src="https://d3js.org/d3.v7.min.js"></script>
<style>${sharedStyles()}
.search-page{padding:2rem;height:calc(100vh - 44px);overflow-y:auto;max-width:800px;margin:0 auto}
.search-hero{text-align:center;margin-bottom:2rem}
.search-hero h2{font-size:1.2rem;font-weight:600;color:#e1e4ed;margin-bottom:0.3rem}
.search-hero p{color:#5a5f7a;font-size:0.75rem}
.search-input-wrap{position:relative;max-width:600px;margin:0 auto}
.search-main-input{width:100%;padding:0.6rem 0.8rem 0.6rem 2.2rem;background:#0f1117;border:1px solid #2a2e3a;
                    border-radius:8px;color:#e1e4ed;font-size:0.85rem;outline:none;transition:border-color .15s}
.search-main-input:focus{border-color:#6c8cff}
.search-main-input::placeholder{color:#3a3f4f}
.search-input-icon{position:absolute;left:0.7rem;top:50%;transform:translateY(-50%);color:#3a3f4f;font-size:0.8rem;pointer-events:none}

.search-results-page{margin-top:1rem}
.search-result-page{padding:0.6rem 0.75rem;border:1px solid #1c1f2a;border-radius:8px;margin-bottom:0.4rem;
                     cursor:pointer;transition:background .15s;display:flex;align-items:center;gap:0.5rem}
.search-result-page:hover{background:#151822}
.srp-icon{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.srp-info{flex:1;min-width:0}
.srp-label{font-size:0.75rem;color:#e1e4ed;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.srp-path{font-size:0.6rem;color:#5a5f7a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.srp-type{font-size:0.55rem;color:#6c8cff;background:rgba(108,140,255,.1);padding:0.1rem 0.35rem;border-radius:3px;flex-shrink:0}
.srp-score{font-size:0.55rem;color:#5a5f7a;flex-shrink:0}
.empty-state-sm{color:#3a3f4f;font-size:0.7rem;text-align:center;padding:2rem}
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
    <a class="nav-btn active" href="/views/search">🔍 Search</a>
  </nav>
</div>

<div class="search-page">
  <div class="search-hero">
    <h2>🔍 Search Repository</h2>
    <p>Find files, classes, methods, routes, and more</p>
  </div>

  <div class="search-input-wrap">
    <span class="search-input-icon">🔍</span>
    <input type="text" class="search-main-input" id="searchInput"
           placeholder="Search by name, path, or type..." autofocus>
  </div>

  <div class="search-results-page" id="searchResults">
    <div class="empty-state-sm">Type a query to search</div>
  </div>
</div>

<script>
var debounceTimer = null;
var nodesCache = [];

// Load all nodes
fetch('/api/graph?lod=detail')
  .then(function(r) { return r.json(); })
  .then(function(data) {
    nodesCache = data.nodes || [];
  });

function doSearch(q) {
  var container = document.getElementById('searchResults');
  if (!q || q.length < 2) {
    container.innerHTML = '<div class="empty-state-sm">Type at least 2 characters to search</div>';
    return;
  }

  var query = q.toLowerCase();
  var results = [];

  nodesCache.forEach(function(n) {
    var score = 0;
    if (n.label && n.label.toLowerCase().includes(query)) score += 10;
    if (n.filePath && n.filePath.toLowerCase().includes(query)) score += 6;
    if (n.id && n.id.toLowerCase().includes(query)) score += 3;
    if (n.directory && n.directory.toLowerCase().includes(query)) score += 2;
    if (n.type && n.type.toLowerCase().includes(query)) score += 1;
    if (score > 0) results.push({ node: n, score: score });
  });

  results.sort(function(a, b) { return b.score - a.score; });
  results = results.slice(0, 50);

  if (results.length === 0) {
    container.innerHTML = '<div class="empty-state-sm">No results for "' + q + '"</div>';
    return;
  }

  var typeColors = {
    'file': '#6c8cff', 'class': '#4ade80', 'method': '#f59e0b',
    'function': '#4ade80', 'route': '#f87171', 'folder': '#8b90a5',
    'contributor': '#22d3ee', 'interface': '#a78bfa', 'enum': '#f472b6'
  };

  var html = '<div style="color:#5a5f7a;font-size:0.6rem;margin-bottom:0.5rem">' + results.length + ' results</div>';
  results.forEach(function(r) {
    var n = r.node;
    var color = typeColors[n.type] || '#5a5f7a';
    var fileDisplay = n.filePath || n.directory || '';
    html += '<div class="search-result-page" data-id="' + n.id + '">';
    html += '<span class="srp-icon" style="background:' + color + '"></span>';
    html += '<div class="srp-info"><div class="srp-label">' + (n.label || n.id) + '</div>';
    if (fileDisplay) html += '<div class="srp-path">' + fileDisplay + '</div>';
    html += '</div><span class="srp-type">' + (n.type || '') + '</span>';
    html += '<span class="srp-score">' + r.score + '</span></div>';
  });
  container.innerHTML = html;

  // Click to navigate
  container.querySelectorAll('.search-result-page').forEach(function(el) {
    el.addEventListener('click', function() {
      // Navigate to architecture view — in a real app we'd pass the highlight param
      window.location = '/views/architecture?highlight=' + encodeURIComponent(this.dataset.id);
    });
  });
}

document.getElementById('searchInput').addEventListener('input', function() {
  clearTimeout(debounceTimer);
  var val = this.value;
  debounceTimer = setTimeout(function() { doSearch(val); }, 200);
});

document.addEventListener('keydown', function(ev) {
  if (ev.key === 'Escape') {
    document.getElementById('searchInput').blur();
  }
});
</script>
</body>
</html>`;
}
