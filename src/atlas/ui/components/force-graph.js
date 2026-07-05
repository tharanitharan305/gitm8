/**
 * Force-directed graph component for D3.js.
 * Returns a JS code string to be embedded in HTML views.
 *
 * Features: zoom/pan, drag, highlight on click, tooltip, color by type.
 */
export function forceGraphComponent() {
  return `
// ══════════════════════════════════════════════════════════════════
// ForceGraph Component
// ══════════════════════════════════════════════════════════════════
function createForceGraph(container, data, opts) {
  opts = opts || {};

  const width = container.clientWidth;
  const height = container.clientHeight;

  const svg = d3.select(container).append('svg')
    .attr('width', width).attr('height', height)
    .style('display', 'block');

  const g = svg.append('g').attr('class', 'graph-container');

  // ── Node color mapping ──
  const typeColors = {
    'file': '#6c8cff', 'folder': '#8b90a5', 'class': '#4ade80',
    'interface': '#a78bfa', 'enum': '#f472b6', 'method': '#f59e0b',
    'function': '#4ade80', 'route': '#f87171', 'variable': '#34d399',
    'export': '#38bdf8', 'decorator': '#e879f9', 'dependency': '#fb923c',
    'test': '#fbbf24', 'commit': '#f97316', 'contributor': '#22d3ee',
    'unknown': '#5a5f7a'
  };

  function nodeColor(d) { return typeColors[d.type] || typeColors.unknown; }

  // ── Edge style mapping ──
  function edgeStyle(d) {
    const styles = {
      'contains': { stroke: '#2a2e3a', dash: '', opacity: 0.2 },
      'imports': { stroke: '#6c8cff', dash: '', opacity: 0.3 },
      'calls': { stroke: '#4ade80', dash: '', opacity: 0.35 },
      'extends': { stroke: '#a78bfa', dash: '4,3', opacity: 0.3 },
      'implements': { stroke: '#a78bfa', dash: '4,3', opacity: 0.2 },
      'owns': { stroke: '#22d3ee', dash: '', opacity: 0.15 },
    };
    return styles[d.type] || { stroke: '#2a2e3a', dash: '', opacity: 0.1 };
  }

  // ── Force simulation ──
  const simulation = d3.forceSimulation(data.nodes)
    .force('link', d3.forceLink(data.edges).id(function(d) { return d.id; })
      .distance(function(d) { return d.type === 'contains' ? 60 : 120; })
      .strength(function(d) { return d.type === 'contains' ? 0.5 : 0.15; }))
    .force('charge', d3.forceManyBody().strength(-200).distanceMax(500))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide(function(d) { return d.type === 'file' ? 18 : 10; }))
    .alphaDecay(0.05).velocityDecay(0.3);

  // ── Zoom behavior ──
  const zoom = d3.zoom()
    .scaleExtent([0.05, 6])
    .on('zoom', function(ev) { g.attr('transform', ev.transform); });

  svg.call(zoom);

  // ── Draw edges ──
  const link = g.append('g').selectAll('line').data(data.edges).join('line')
    .attr('class', 'link')
    .attr('stroke', function(d) { return edgeStyle(d).stroke; })
    .attr('stroke-dasharray', function(d) { return edgeStyle(d).dash; })
    .attr('stroke-opacity', function(d) { return edgeStyle(d).opacity; })
    .attr('stroke-width', function(d) { return d.type === 'contains' ? 1 : 1.5; });

  // ── Draw nodes ──
  const node = g.append('g').selectAll('g').data(data.nodes).join('g')
    .attr('class', 'node')
    .call(d3.drag()
      .on('start', function(ev, d) {
        if (!ev.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on('drag', function(ev, d) { d.fx = ev.x; d.fy = ev.y; })
      .on('end', function(ev, d) {
        if (!ev.active) simulation.alphaTarget(0);
        if (!opts.pinOnDrag) { d.fx = null; d.fy = null; }
      }));

  // Node circles
  node.append('circle')
    .attr('r', function(d) {
      if (d.type === 'file') return Math.min(Math.max(6, Math.sqrt(d.lines || 100) * 0.3), 20);
      if (d.type === 'folder') return 4;
      return 6;
    })
    .attr('fill', function(d) { return nodeColor(d); })
    .attr('opacity', function(d) { return d.type === 'folder' ? 0.4 : 0.85; });

  // Node labels (only visible when zoomed in enough)
  node.append('text')
    .attr('class', 'node-label')
    .attr('x', function(d) { return (d.r || 8) + 4; })
    .attr('y', 3)
    .text(function(d) {
      if (d.type === 'file') return d.label;
      if (d.type === 'folder') return '';
      return d.label.replace('()', '');
    });

  // Show labels when zoomed in
  function updateLabels() {
    const transform = d3.zoomTransform(svg.node());
    const scale = transform.k;
    node.selectAll('.node-label')
      .attr('opacity', scale > 0.6 ? 1 : 0)
      .attr('font-size', Math.max(7, Math.min(12, 9 / scale)) + 'px');
  }

  svg.on('zoom', function(ev) {
    g.attr('transform', ev.transform);
    updateLabels();
  });

  // ── Tooltip ──
  node.on('mouseover', function(ev, d) {
    const tooltip = d3.select('#tooltip');
    const html = [
      '<div class="tt-title">' + (d.label || d.id) + '</div>',
      '<span class="tt-type">' + (d.type || 'unknown') + '</span>',
      d.filePath ? '<div class="tt-file">' + d.filePath + '</div>' : '',
      d.lines ? '<div class="tt-detail">' + d.lines + ' lines</div>' : '',
      d.churn ? '<div class="tt-stats"><span class="tt-stat">Changes: <span class="tt-stat-num">' + d.churn + '</span></span></div>' : '',
    ].join('');

    tooltip.html(html).classed('visible', true)
      .style('left', (ev.pageX + 15) + 'px')
      .style('top', (ev.pageY - 10) + 'px');
  }).on('mouseout', function() {
    d3.select('#tooltip').classed('visible', false);
  });

  // ── Click handling ──
  let highlightedId = null;

  function highlight(id) {
    highlightedId = id;
    const connected = new Set([id]);
    data.edges.forEach(function(e) {
      var s = e.source && e.source.id != null ? e.source.id : e.source;
      var t = e.target && e.target.id != null ? e.target.id : e.target;
      if (s === id) connected.add(t);
      if (t === id) connected.add(s);
    });

    node.classed('dimmed', function(d) { return !connected.has(d.id); });
    node.classed('highlighted', function(d) { return d.id === id; });
    link.classed('dimmed', function(d) {
      var s = d.source && d.source.id != null ? d.source.id : d.source;
      var t = d.target && d.target.id != null ? d.target.id : d.target;
      return !connected.has(s) || !connected.has(t);
    });
    link.classed('highlighted', function(d) {
      var s = d.source && d.source.id != null ? d.source.id : d.source;
      var t = d.target && d.target.id != null ? d.target.id : d.target;
      return s === id || t === id;
    });

    // Notify inspector callback
    if (opts.onNodeClick) opts.onNodeClick(d3.select(this).datum());
  }

  function clearHighlight() {
    highlightedId = null;
    node.classed('dimmed', false).classed('highlighted', false);
    link.classed('dimmed', false).classed('highlighted', false);
  }

  node.on('click', function(ev, d) {
    ev.stopPropagation();
    if (highlightedId === d.id) { clearHighlight(); return; }
    highlight(d.id);
  });

  svg.on('click', function(ev) {
    if (ev.target === this || ev.target.tagName === 'svg') {
      clearHighlight();
      if (opts.onBackgroundClick) opts.onBackgroundClick();
    }
  });

  // ── Tick ──
  simulation.on('tick', function() {
    link
      .attr('x1', function(d) { return d.source.x; })
      .attr('y1', function(d) { return d.source.y; })
      .attr('x2', function(d) { return d.target.x; })
      .attr('y2', function(d) { return d.target.y; });

    node.attr('transform', function(d) { return 'translate(' + d.x + ',' + d.y + ')'; });
  });

  // ── Resize ──
  function resize(w, h) {
    svg.attr('width', w).attr('height', h);
    simulation.force('center', d3.forceCenter(w / 2, h / 2));
    simulation.alpha(0.3).restart();
  }

  // ── Search integration ──
  function searchAndHighlight(query) {
    clearHighlight();
    if (!query) return;

    const q = query.toLowerCase();
    const matches = data.nodes.filter(function(d) {
      return (d.label && d.label.toLowerCase().includes(q)) ||
             (d.filePath && d.filePath.toLowerCase().includes(q)) ||
             (d.id && d.id.toLowerCase().includes(q));
    });

    if (matches.length > 0) {
      const ids = new Set(matches.map(function(d) { return d.id; }));
      data.edges.forEach(function(e) {
        var s = e.source && e.source.id != null ? e.source.id : e.source;
        var t = e.target && e.target.id != null ? e.target.id : e.target;
        if (ids.has(s)) ids.add(t);
        if (ids.has(t)) ids.add(s);
      });

      node.classed('dimmed', function(d) { return !ids.has(d.id); });
      link.classed('dimmed', function(d) {
        var s = d.source && d.source.id != null ? d.source.id : d.source;
        var t = d.target && d.target.id != null ? d.target.id : d.target;
        return !ids.has(s) || !ids.has(t);
      });

      // Highlight the first match
      if (matches[0]) highlight(matches[0].id);
    }

    return matches;
  }

  // ── Update data ──
  function updateData(newNodes, newEdges) {
    // Clear existing
    g.selectAll('.link').remove();
    g.selectAll('.node').remove();

    // Re-run with new data (simplified)
    data = { nodes: newNodes, edges: newEdges };
    // In a full impl, we'd use D3's data join pattern here
  }

  // Return public API
  return {
    svg, simulation, resize, searchAndHighlight,
    highlight, clearHighlight, updateData,
    zoomIn: function() { zoom.scaleBy(svg.transition().duration(300), 1.5); },
    zoomOut: function() { zoom.scaleBy(svg.transition().duration(300), 0.67); },
    zoomReset: function() { svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity); },
  };
}
`;
}
