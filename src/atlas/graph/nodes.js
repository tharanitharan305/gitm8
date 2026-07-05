/**
 * Node type constants for the Knowledge Graph.
 * Every node in the graph has a type property from this enum.
 */

/** @readonly @enum {string} */
export const NodeType = Object.freeze({
  REPOSITORY: 'repository',
  FOLDER: 'folder',
  FILE: 'file',
  CLASS: 'class',
  INTERFACE: 'interface',
  ENUM: 'enum',
  METHOD: 'method',
  FUNCTION: 'function',
  VARIABLE: 'variable',
  ROUTE: 'route',
  EXPORT: 'export',
  DECORATOR: 'decorator',
  DEPENDENCY: 'dependency',
  TEST: 'test',
  COMMIT: 'commit',
  CONTRIBUTOR: 'contributor',
});

/**
 * Colors for each node type (used in D3 visualizations).
 */
export const NodeColors = Object.freeze({
  [NodeType.REPOSITORY]: '#6c8cff',
  [NodeType.FOLDER]: '#8b90a5',
  [NodeType.FILE]: '#6c8cff',
  [NodeType.CLASS]: '#4ade80',
  [NodeType.INTERFACE]: '#a78bfa',
  [NodeType.ENUM]: '#f472b6',
  [NodeType.METHOD]: '#f59e0b',
  [NodeType.FUNCTION]: '#4ade80',
  [NodeType.VARIABLE]: '#34d399',
  [NodeType.ROUTE]: '#f87171',
  [NodeType.EXPORT]: '#38bdf8',
  [NodeType.DECORATOR]: '#e879f9',
  [NodeType.DEPENDENCY]: '#fb923c',
  [NodeType.TEST]: '#fbbf24',
  [NodeType.COMMIT]: '#f97316',
  [NodeType.CONTRIBUTOR]: '#22d3ee',
});

/**
 * Icons for each node type.
 */
export const NodeIcons = Object.freeze({
  [NodeType.REPOSITORY]: '📦',
  [NodeType.FOLDER]: '📁',
  [NodeType.FILE]: '📄',
  [NodeType.CLASS]: '🏛️',
  [NodeType.INTERFACE]: '📐',
  [NodeType.ENUM]: '📋',
  [NodeType.METHOD]: '⚡',
  [NodeType.FUNCTION]: 'ƒ',
  [NodeType.VARIABLE]: '📌',
  [NodeType.ROUTE]: '🔗',
  [NodeType.EXPORT]: '📤',
  [NodeType.DECORATOR]: '✨',
  [NodeType.DEPENDENCY]: '📦',
  [NodeType.TEST]: '🧪',
  [NodeType.COMMIT]: '🔖',
  [NodeType.CONTRIBUTOR]: '👤',
});

/**
 * Factory: create a file node.
 *
 * @param {string} filePath - Relative file path
 * @param {object} [meta] - Additional metadata
 * @returns {object} GraphNode
 */
export function makeFileNode(filePath, meta = {}) {
  return {
    id: `file:${filePath}`,
    type: NodeType.FILE,
    label: filePath.split('/').pop() || filePath,
    filePath,
    directory: filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : '/',
    lod: 'file',
    size: meta.size || 0,
    lines: meta.lines || 0,
    language: meta.language || null,
    ...meta,
  };
}

/**
 * Factory: create a class node.
 *
 * @param {string} name - Class name
 * @param {string} filePath - Containing file
 * @param {object} [meta]
 * @returns {object} GraphNode
 */
export function makeClassNode(name, filePath, meta = {}) {
  return {
    id: `class:${filePath}/${name}`,
    type: NodeType.CLASS,
    label: name,
    filePath,
    parentClass: meta.parentClass || null,
    lod: 'module',
    ...meta,
  };
}

/**
 * Factory: create a method node.
 *
 * @param {string} name - Method name
 * @param {string} className - Containing class
 * @param {string} filePath - Containing file
 * @param {object} [meta]
 * @returns {object} GraphNode
 */
export function makeMethodNode(name, className, filePath, meta = {}) {
  return {
    id: `method:${filePath}/${className}.${name}`,
    type: NodeType.METHOD,
    label: `${name}()`,
    filePath,
    className,
    lod: 'detail',
    ...meta,
  };
}

/**
 * Factory: create a function node.
 *
 * @param {string} name - Function name
 * @param {string} filePath - Containing file
 * @param {object} [meta]
 * @returns {object} GraphNode
 */
export function makeFunctionNode(name, filePath, meta = {}) {
  return {
    id: `func:${filePath}/${name}`,
    type: NodeType.FUNCTION,
    label: `${name}()`,
    filePath,
    lod: 'detail',
    ...meta,
  };
}

/**
 * Factory: create a folder node.
 *
 * @param {string} dirPath - Directory path
 * @param {object} [meta]
 * @returns {object} GraphNode
 */
export function makeFolderNode(dirPath, meta = {}) {
  return {
    id: `folder:${dirPath}`,
    type: NodeType.FOLDER,
    label: dirPath.split('/').pop() || dirPath,
    dirPath,
    lod: 'file',
    ...meta,
  };
}

/**
 * Factory: create a route node.
 *
 * @param {string} method - HTTP method
 * @param {string} path - Route path
 * @param {string} handler - Handler function name
 * @param {string} filePath
 * @param {object} [meta]
 * @returns {object} GraphNode
 */
export function makeRouteNode(method, path, handler, filePath, meta = {}) {
  return {
    id: `route:${filePath}/${method}:${path}`,
    type: NodeType.ROUTE,
    label: `${method} ${path}`,
    filePath,
    handler,
    lod: 'detail',
    ...meta,
  };
}
