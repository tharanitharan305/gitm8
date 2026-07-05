/**
 * Minimap component showing a small overview of the graph with viewport indicator.
 */
export function miniMapComponent() {
  return `
// ══════════════════════════════════════════════════════════════════
// MiniMap Component
// ══════════════════════════════════════════════════════════════════
function createMiniMap(container, svgElement, opts) {
  opts = opts || {};

  var width = container.clientWidth || 160;
  var height = container.clientHeight || 120;

  var miniSvg = d3.select(container).append('svg')
    .attr('width', width).attr('height', height)
    .style('display', 'block');

  var miniG = miniSvg.append('g');
  var viewportRect = miniG.append('rect').attr('class', 'minimap-viewport');

  // Listen to zoom events on the main SVG
  var mainZoom = d3.zoom().on('zoom.minimap', function() {
    updateViewport();
  });

  function updateViewport() {
    var transform;
    try { transform = d3.zoomTransform(svgElement); } catch(e) { return; }

    var mainWidth = svgElement.getAttribute('width') || 800;
    var mainHeight = svgElement.getAttribute('height') || 600;
    var scaleX = width / mainWidth;
    var scaleY = height / mainHeight;

    viewportRect
      .attr('x', -transform.x * scaleX / transform.k)
      .attr('y', -transform.y * scaleY / transform.k)
      .attr('width', width / transform.k)
      .attr('height', height / transform.k);
  }

  // Render mini nodes
  function render(nodes) {
    miniG.selectAll('*').remove();

    // Scale nodes down
    var miniNodes = nodes.slice(0, 500); // Cap for performance
    var miniColor = d3.scaleOrdinal()
      .domain(['file', 'class', 'method', 'function', 'route'])
      .range(['#6c8cff', '#4ade80', '#f59e0b', '#4ade80', '#f87171']);

    miniG.selectAll('circle').data(miniNodes).join('circle')
      .attr('cx', function(d) { return (d.x || 0) * width / 800; })
      .attr('cy', function(d) { return (d.y || 0) * height / 600; })
      .attr('r', 1.5)
      .attr('fill', function(d) { return miniColor(d.type) || '#5a5f7a'; })
      .attr('opacity', 0.6);

    updateViewport();
  }

  // Click on minimap to navigate
  miniSvg.on('click', function(ev) {
    var rect = this.getBoundingClientRect();
    var x = (ev.clientX - rect.left) * 800 / width;
    var y = (ev.clientY - rect.top) * 600 / height;

    var transform;
    try { transform = d3.zoomTransform(svgElement); } catch(e) { return; }

    var newTransform = d3.zoomIdentity
      .translate(width/2 - x * transform.k, height/2 - y * transform.k)
      .scale(transform.k);

    d3.select(svgElement).transition().duration(300)
      .call(d3.zoom().transform, newTransform);
  });

  return { render: render, updateViewport: updateViewport };
}
`;
}
