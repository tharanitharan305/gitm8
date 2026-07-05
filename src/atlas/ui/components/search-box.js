/**
 * Search box component with autocomplete dropdown.
 */
export function searchBoxComponent() {
  return `
// ══════════════════════════════════════════════════════════════════
// SearchBox Component
// ══════════════════════════════════════════════════════════════════
function createSearchBox(inputEl, opts) {
  opts = opts || {};
  var resultsEl = opts.resultsContainer || document.getElementById('searchResults');
  var debounceTimer = null;
  var currentQuery = '';
  var allData = opts.data || { nodes: [] };

  function doSearch(q) {
    if (!q || q.length < 1) {
      if (resultsEl) resultsEl.classList.remove('visible');
      if (opts.onSearch) opts.onSearch('');
      return;
    }

    var query = q.toLowerCase();
    var matches = [];

    for (var i = 0; i < allData.nodes.length; i++) {
      var d = allData.nodes[i];
      var score = 0;
      if (d.label && d.label.toLowerCase().includes(query)) score += 10;
      if (d.filePath && d.filePath.toLowerCase().includes(query)) score += 5;
      if (d.id && d.id.toLowerCase().includes(query)) score += 3;
      if (score > 0) matches.push({ node: d, score: score });
    }

    matches.sort(function(a, b) { return b.score - a.score; });
    matches = matches.slice(0, 20);

    // Render results
    if (resultsEl) {
      resultsEl.innerHTML = '';
      if (matches.length === 0) {
        resultsEl.innerHTML = '<div class="search-result" style="color:#5a5f7a;justify-content:center">No matches</div>';
        resultsEl.classList.add('visible');
      } else {
        matches.forEach(function(m) {
          var n = m.node;
          var typeColors = {
            'file': '#6c8cff', 'class': '#4ade80', 'method': '#f59e0b',
            'function': '#4ade80', 'route': '#f87171', 'folder': '#8b90a5',
            'contributor': '#22d3ee'
          };
          var color = typeColors[n.type] || '#5a5f7a';
          var item = document.createElement('div');
          item.className = 'search-result';
          item.innerHTML = '<span class="sr-badge" style="background:' + color + '"></span>' +
            '<span class="sr-label">' + (n.label || n.id) + '</span>' +
            '<span class="sr-type">' + (n.type || '') + '</span>' +
            (n.filePath ? '<span class="sr-file">' + n.filePath + '</span>' : '');
          item.addEventListener('click', function() {
            if (opts.onSelect) opts.onSelect(n);
            resultsEl.classList.remove('visible');
            inputEl.value = n.label || n.id;
          });
          resultsEl.appendChild(item);
        });
        resultsEl.classList.add('visible');
      }
    }

    if (opts.onSearch) opts.onSearch(q);
  }

  inputEl.addEventListener('input', function() {
    currentQuery = this.value;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function() { doSearch(currentQuery); }, 150);
  });

  inputEl.addEventListener('focus', function() {
    if (currentQuery) doSearch(currentQuery);
  });

  document.addEventListener('click', function(ev) {
    if (!inputEl.contains(ev.target) && (!resultsEl || !resultsEl.contains(ev.target))) {
      if (resultsEl) resultsEl.classList.remove('visible');
    }
  });

  inputEl.addEventListener('keydown', function(ev) {
    if (ev.key === 'Escape') {
      if (resultsEl) resultsEl.classList.remove('visible');
      inputEl.blur();
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.key === 'f') {
      ev.preventDefault();
      inputEl.focus();
    }
  });

  return {
    search: function(q) { inputEl.value = q; doSearch(q); },
    clear: function() { inputEl.value = ''; if (resultsEl) resultsEl.classList.remove('visible'); },
    setData: function(d) { allData = d; },
  };
}
`;
}
