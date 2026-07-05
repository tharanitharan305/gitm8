import { LAYER_DEFS } from '../../core/deps-layer.js';

/**
 * Re-export layer definitions from deps-layer for atlas use.
 */
export { LAYER_DEFS };

/**
 * Detect the architectural layer of a file based on its path.
 *
 * @param {string} filePath - Relative file path
 * @returns {string} Layer ID (e.g. 'ui', 'services', 'data')
 */
export function detectLayer(filePath) {
  for (const def of LAYER_DEFS) {
    for (const pattern of def.patterns) {
      if (pattern.test(filePath)) return def.id;
    }
  }
  return 'unknown';
}

/**
 * Get the layer color for a file path.
 *
 * @param {string} filePath
 * @returns {string} Hex color
 */
export function getLayerColor(filePath) {
  const layerId = detectLayer(filePath);
  const def = LAYER_DEFS.find((d) => d.id === layerId);
  return def ? def.color : '#4a4f6a';
}

/**
 * Get the layer name for display.
 *
 * @param {string} filePath
 * @returns {string}
 */
export function getLayerName(filePath) {
  const layerId = detectLayer(filePath);
  const def = LAYER_DEFS.find((d) => d.id === layerId);
  return def ? def.name : 'Unknown';
}
