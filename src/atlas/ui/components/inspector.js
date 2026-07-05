/**
 * Inspector panel component for showing node details.
 */
export function inspectorComponent() {
  return `
// ══════════════════════════════════════════════════════════════════
// Inspector Component
// ══════════════════════════════════════════════════════════════════
function createInspector(panelEl, opts) {
  opts = opts || {};

  function show(node) {
    if (!node) return;

    var html = '';

    // Type badge
    var typeColors = {
      'file': '#6c8cff', 'class': '#4ade80', 'method': '#f59e0b',
      'function': '#4ade80', 'route': '#f87171', 'folder': '#8b90a5',
      'contributor': '#22d3ee', 'interface': '#a78bfa', 'enum': '#f472b6'
    };
    var color = typeColors[node.type] || '#5a5f7a';

    html += '<div class="prop-group">';
    html += '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.4rem">';
    html += '<span style="width:8px;height:8px;border-radius:50%;background:' + color + ';display:inline-block"></span>';
    html += '<span style="font-weight:600;color:#e1e4ed;font-size:0.8rem">' + (node.label || node.id) + '</span>';
    html += '</div>';
    html += '<span class="tt-type" style="background:rgba(108,140,255,.12);color:#6c8cff;font-size:0.55rem;padding:0.08rem 0.35rem;border-radius:3px;text-transform:uppercase">' + (node.type || 'unknown') + '</span>';
    html += '</div>';

    // Details
    html += '<div class="prop-group">';
    if (node.filePath) {
      html += '<div class="prop-label">File</div>';
      html += '<div class="prop-value code">' + node.filePath + '</div>';
      html += '<div class="divider"></div>';
    }
    if (node.lines) {
      html += '<div class="prop-label">Lines</div>';
      html += '<div class="prop-value">' + node.lines + '</div>';
    }
    if (node.language) {
      html += '<div class="prop-label">Language</div>';
      html += '<div class="prop-value">' + node.language + '</div>';
    }
    if (node.churn !== undefined) {
      html += '<div class="divider"></div>';
      html += '<div class="prop-label">Git Churn (commits)</div>';
      html += '<div class="prop-value">' + node.churn + '</div>';
    }
    if (node.complexity !== undefined) {
      html += '<div class="prop-label">Complexity</div>';
      html += '<div class="prop-value">' + node.complexity + '</div>';
    }
    if (node.parentClass) {
      html += '<div class="divider"></div>';
      html += '<div class="prop-label">Parent Class</div>';
      html += '<div class="prop-value">' + node.parentClass + '</div>';
    }
    if (node.topContributor) {
      html += '<div class="divider"></div>';
      html += '<div class="prop-label">Top Contributor</div>';
      html += '<div class="prop-value">' + node.topContributor + '</div>';
    }
    if (node.contributors) {
      html += '<div class="prop-label">Contributors</div>';
      html += '<div class="prop-value">' + node.contributors + '</div>';
    }
    if (node.directory) {
      html += '<div class="divider"></div>';
      html += '<div class="prop-label">Directory</div>';
      html += '<div class="prop-value">' + node.directory + '</div>';
    }
    html += '</div>';

    panelEl.innerHTML = html;
    panelEl.classList.add('open');
  }

  function hide() {
    panelEl.classList.remove('open');
  }

  function isOpen() {
    return panelEl.classList.contains('open');
  }

  return { show: show, hide: hide, isOpen: isOpen };
}
`;
}
