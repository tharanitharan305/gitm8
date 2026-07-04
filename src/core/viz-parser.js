/**
 * Multi-language code parser for `gitm8 viz`.
 * Extracts classes, methods, functions, and cross-file call relationships.
 *
 * Supported: JavaScript, TypeScript/TSX, Python, Java, Dart
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, extname } from 'path';

// ── File extension → language map ────────────────────────────
const EXT_MAP = {
  '.js': 'js', '.jsx': 'jsx', '.mjs': 'js', '.cjs': 'js',
  '.ts': 'ts', '.tsx': 'tsx', '.mts': 'ts', '.cts': 'ts',
  '.py': 'py',
  '.java': 'java',
  '.dart': 'dart',
};

// ── Language configs ─────────────────────────────────────────
const LANG_CONFIG = {
  js: {
    class:    /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?/,
    method:   /^\s*(?:public|private|protected|static|async|get|set|\*)?\s*(?:\[?\w+\]?)\s*\([^)]*\)\s*\{/,
    function: /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/,
    arrow:    /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\(|function)/,
    usesBraces: true,
  },
  ts: {
    class:    /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+[^{]+)?/,
    method:   /^\s*(?:public|private|protected|static|async|get|set|readonly|abstract)?\s*(?:\w+\s+)?(\w+)\s*[(<]/,
    function: /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/,
    arrow:    /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*[=:]\s*(?:async\s+)?(?:\(|function)/,
    usesBraces: true,
  },
  py: {
    class:    /^\s*class\s+(\w+)(?:\(([\w,\s.]+)\))?\s*:/,
    method:   /^\s*def\s+(\w+)\s*\(/,
    function: /^\s*def\s+(\w+)\s*\(/,
    arrow:    null,
    usesBraces: false,
  },
  java: {
    class:    /^\s*(?:public\s+|private\s+|protected\s+)?(?:abstract\s+|final\s+)?(?:static\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+[\w,\s<>.]+)?/,
    method:   /^\s*(?:public|private|protected)?\s*(?:static|final|abstract|synchronized|native)?\s*(?:\w+(?:<[^>]+>)?\s+)?(\w+)\s*\(/,
    function: /^\s*(?:public|private|protected)?\s*(?:static|final)?\s*(?:\w+(?:<[^>]+>)?\s+)?(\w+)\s*\(/,
    arrow:    null,
    usesBraces: true,
  },
  dart: {
    class:    /^\s*(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+[\w,\s]+)?(?:\s+with\s+[\w,\s]+)?/,
    method:   /^\s*(?:@\w+\s+)*(?:Future\s*<[^>]+>\s*|Stream\s*<[^>]+>\s*)?(\w+)\s*\(/,
    function: /^\s*(?:@\w+\s+)*(?:Future\s*<[^>]+>\s*)?(\w+)\s*\(/,
    arrow:    null,
    usesBraces: true,
  },
};

// ── Call detection (universal) ───────────────────────────────
const CALL_REGEX = /(?:\w+\.)?(\w+)\s*\(/g;

// ── Stopped/killed keywords in calls ─────────────────────────
const SKIP_CALLS = new Set([
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'catch', 'then',
  'return', 'throw', 'new', 'delete', 'typeof', 'instanceof', 'void',
  'try', 'finally', 'with', 'debugger', 'yield', 'await', 'async',
  'import', 'export', 'default', 'from', 'of', 'in',
  'var', 'let', 'const', 'this', 'super', 'true', 'false', 'null',
  'undefined', 'self', 'cls', 'class', 'function', 'extends', 'implements',
  'public', 'private', 'protected', 'static', 'readonly', 'abstract',
  'enum', 'interface', 'type', 'as', 'is', 'keyof', 'typeof',
  'String', 'Number', 'Boolean', 'Object', 'Array', 'Map', 'Set', 'Symbol',
  'Promise', 'Error', 'Date', 'RegExp', 'Math', 'JSON', 'console',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'decodeURI', 'encodeURI',
  'require', 'define', 'describe', 'it', 'test', 'expect', 'assert',
  'beforeEach', 'afterEach', 'beforeAll', 'afterAll', 'jest',
  'print', 'len', 'range', 'type', 'str', 'int', 'float', 'list', 'dict',
  'open', 'input', 'isinstance', 'hasattr', 'getattr', 'enumerate',
  'zip', 'sorted', 'reversed', 'sum', 'min', 'max', 'abs', 'round',
  'super', '__init__', '__str__', '__repr__', '__call__',
  'System', 'Integer', 'Double', 'Float', 'Long', 'Short', 'Byte',
  'ArrayList', 'HashMap', 'HashSet', 'Collections', 'Arrays', 'Objects',
  'Optional', 'Thread', 'Runnable', 'Stream', 'Collectors',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'fetch', 'localStorage', 'sessionStorage', 'window', 'document',
  'Buffer', 'process', 'global', 'module', 'exports', '__dirname', '__filename',
]);

// ═══════════════════════════════════════════════════════════════
//  Public API
// ═══════════════════════════════════════════════════════════════

/**
 * Parse a single file into classes, methods, functions, and calls.
 * @param {string} filePath
 * @param {string} rootDir
 * @returns {object|null}
 */
export function parseFile(filePath, rootDir) {
  const ext = extname(filePath).toLowerCase();
  const lang = EXT_MAP[ext];
  if (!lang) return null;

  let content;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }

  const cfg = LANG_CONFIG[lang] || LANG_CONFIG.js;
  const relPath = relative(rootDir, filePath).replace(/\\/g, '/');
  const lines = content.split('\n');
  const totalLines = lines.length;

  const classes = [];
  const functions = [];
  const calls = [];

  // ── Line-by-line scan ──────────────────────────────────────
  let currentClass = null;
  let braceDepth = 0;
  let classBraceDepth = -1;
  let inClass = false;

  // Python indentation tracking
  let classIndent = -1;

  for (let i = 0; i < totalLines; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    const lineNum = i + 1;

    if (!trimmed) continue;

    // Skip comments and imports
    if (isSkippedLine(trimmed, lang)) continue;

    // ── Class detection ─────────────────────────────────────
    const classMatch = trimmed.match(cfg.class);
    if (classMatch) {
      const className = classMatch[1];
      const parentClass = cleanParentClass(classMatch[classMatch.length > 2 ? 2 : 1], lang);

      currentClass = { name: className, methods: [], parentClass };
      classes.push(currentClass);
      inClass = true;

      if (cfg.usesBraces) {
        const openBraces = countChar(trimmed, '{');
        if (openBraces > 0) {
          braceDepth += openBraces - countChar(trimmed, '}');
          classBraceDepth = braceDepth;
        } else {
          // Brace on next line
          braceDepth = 0;
          classBraceDepth = -2; // marker: find the first increase
        }
      } else {
        // Python: track indent level
        classIndent = rawLine.search(/\S/);
      }
      continue;
    }

    // ── Brace tracking ──────────────────────────────────────
    let braceBefore = braceDepth; // depth before braces on this line
    if (cfg.usesBraces) {
      const opens = countChar(trimmed, '{');
      const closes = countChar(trimmed, '}');

      if (classBraceDepth === -2 && opens > 0) {
        classBraceDepth = braceDepth + opens - closes;
      }

      braceDepth += opens - closes;

      // Check if we've left the class scope
      if (inClass && currentClass && classBraceDepth >= 0 && braceDepth < classBraceDepth) {
        inClass = false;
        currentClass = null;
        classBraceDepth = -1;
      }
    } else if (inClass && currentClass) {
      // Python: check indent
      const indent = rawLine.search(/\S/);
      if (indent <= classIndent && !trimmed.startsWith('#')) {
        inClass = false;
        currentClass = null;
        classIndent = -1;
      }
    }

    // ── Method detection (inside class, at class brace depth) ─
    if (inClass && currentClass) {
      let methodName = null;
      const isAtClassDepth = cfg.usesBraces
        ? (braceBefore === classBraceDepth)
        : (rawLine.search(/\S/) === classIndent + 4 || rawLine.search(/\S/) === classIndent + 2); // Python: 4-space or 2-space indent

      if (isAtClassDepth) {
        if (cfg.usesBraces) {
          // Extract name before parenthesis
          // Must have opening paren AND end with opening brace on same line
          const openIdx = trimmed.indexOf('(');
          const closeIdx = trimmed.indexOf(')');
          if (openIdx > 0 && closeIdx > openIdx) {
            const before = trimmed.slice(0, openIdx).trim().split(/\s+/);
            const candidate = before[before.length - 1]?.replace(/[\[\]<>*]/g, '');
            if (candidate && !SKIP_CALLS.has(candidate) && candidate.length > 1 &&
                !['if', 'for', 'while', 'switch', 'catch'].includes(candidate)) {
              methodName = candidate;
            }
          }
        } else {
          // Python
          const m = trimmed.match(cfg.method);
          if (m) methodName = m[1];
        }
      }

      if (methodName && !currentClass.methods.some(m => m.name === methodName)) {
        currentClass.methods.push({ name: methodName, line: lineNum });
      }
    }

    // ── Standalone function detection ───────────────────────
    if (!inClass) {
      let funcName = null;

      const fnMatch = trimmed.match(cfg.function);
      if (fnMatch && fnMatch[1]) {
        funcName = fnMatch[1];
      }

      // Arrow functions (JS/TS)
      if (!funcName && cfg.arrow) {
        const arrowMatch = trimmed.match(cfg.arrow);
        if (arrowMatch) funcName = arrowMatch[1] || arrowMatch[2];
      }

      if (funcName && !SKIP_CALLS.has(funcName)) {
        functions.push({ name: funcName, line: lineNum });
      }
    }
  }

  // ── Pass 2: Extract call references ────────────────────────
  for (let i = 0; i < totalLines; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || isSkippedLine(trimmed, lang)) continue;

    // Find ALL potential call sites with object.method() pattern
    CALL_REGEX.lastIndex = 0;
    const matches = [...trimmed.matchAll(CALL_REGEX)];

    for (const match of matches) {
      const callName = match[1];
      if (SKIP_CALLS.has(callName) || callName.length < 2) continue;

      // Determine context: which method or function does this call belong to?
      let contextClass = null;
      let contextMethod = null;
      let contextFunc = null;

      // Find the enclosing method (if inside a class method)
      for (const cls of classes) {
        for (const m of cls.methods) {
          const mIdx = m.line - 1;
          if (i >= mIdx) {
            // Check if we're still in this method (before the next method starts)
            const nextMethod = cls.methods
              .filter(mm => mm.line > m.line)
              .sort((a, b) => a.line - b.line)[0];
            const endLine = nextMethod ? nextMethod.line - 2 : totalLines;
            if (i < endLine) {
              contextClass = cls.name;
              contextMethod = m.name;
              break;
            }
          }
        }
        if (contextMethod) break;
      }

      // If not in a class method, check if in a standalone function
      if (!contextMethod) {
        for (const fn of functions) {
          const fnIdx = fn.line - 1;
          if (i >= fnIdx && i < fnIdx + 100) {
            contextFunc = fn.name;
            break;
          }
        }
      }

      calls.push({
        className: contextClass,
        methodName: contextMethod,
        funcName: contextFunc,
        callName,
        line: lineNum(i),
      });
    }
  }

  // Return null if nothing useful found
  if (classes.length === 0 && functions.length === 0) return null;

  return { path: relPath, language: lang, classes, functions, calls };
}

/**
 * Discover all parseable source files in a project directory.
 * Skips node_modules, .git, build dirs, etc.
 * @param {string} rootDir
 * @returns {string[]} Absolute paths
 */
export function discoverFiles(rootDir) {
  const results = [];
  const skipDirs = new Set([
    'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
    'out', '.output', 'target', 'bin', 'obj', '.dart_tool',
    '__pycache__', 'venv', '.venv', '.eggs', 'egg-info',
    'coverage', '.nyc_output', '.tox', '.mypy_cache', '.pytest_cache',
    '.gradle', '.idea', '.vscode', '.svelte-kit', '.vercel',
    'cdk.out', '.serverless', '.terraform', '.next',
    'packages', // skip monorepo inner roots — user can `cd` into sub-pkg
  ]);

  function walk(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name) && !entry.name.startsWith('.')) {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (EXT_MAP[ext]) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(rootDir);
  return results;
}

/**
 * Build the relationship graph: find which method calls which.
 * Cross-references all calls against all known methods/functions.
 *
 * @param {Array} parsedFiles - Results from parseFile()
 * @returns {{ nodes: Array, edges: Array, files: number }}
 */
export function buildGraph(parsedFiles) {
  // Reset dedup set
  edgeSet.clear();

  // Build a lookup: callName → {file, class, method} definitions
  const definitions = new Map();
  const fileSet = new Set();

  for (const pf of parsedFiles) {
    if (!pf) continue;
    fileSet.add(pf.path);

    for (const cls of pf.classes) {
      for (const m of cls.methods) {
        const key = m.name;
        if (!definitions.has(key)) definitions.set(key, []);
        definitions.get(key).push({
          file: pf.path,
          className: cls.name,
          methodName: m.name,
          type: 'method',
          parentClass: cls.parentClass,
        });
      }
    }

    for (const fn of pf.functions) {
      const key = fn.name;
      if (!definitions.has(key)) definitions.set(key, []);
      definitions.get(key).push({
        file: pf.path,
        className: null,
        methodName: fn.name,
        type: 'function',
      });
    }
  }

  // Build nodes + edges
  const nodeMap = new Map();
  const nodeNames = new Set();
  const edges = [];

  /** Unique ID per definition — qualified by file path to avoid collisions */
  function getNodeId(def) {
    if (def.type === 'method') return `${def.className}.${def.methodName}@${def.file}`;
    return `${def.methodName}@${def.file}`;
  }

  function getNodeLabel(def) {
    if (def.type === 'method') return `${def.className}.${def.methodName}()`;
    return `${def.methodName}()`;
  }

  function getNodeGroup(def) {
    return def.className || '(functions)';
  }

  function getCallerId(call, file) {
    if (call.methodName) return `${call.className}.${call.methodName}@${file}`;
    if (call.funcName) return `${call.funcName}@${file}`;
    return null;
  }

  // Create nodes from definitions
  for (const [, defs] of definitions) {
    for (const def of defs) {
      const id = getNodeId(def);
      if (!nodeMap.has(id)) {
        nodeNames.add(def.methodName);
        nodeMap.set(id, {
          id,
          label: getNodeLabel(def),
          group: getNodeGroup(def),
          file: def.file,
          type: def.type,
          parentClass: def.parentClass || null,
        });
      }
    }
  }

  // Create edges from calls to definitions
  for (const pf of parsedFiles) {
    if (!pf) continue;

    for (const call of pf.calls) {
      const callerId = getCallerId(call, pf.path);
      if (!callerId) continue;

      // Find matching definitions for this call
      const targets = definitions.get(call.callName);
      if (!targets) continue;

      for (const target of targets) {
        // Skip self-calls (same file, same class, same method)
        if (call.className &&
            target.file === pf.path &&
            target.methodName === call.methodName &&
            target.className === call.className) continue;

        const targetId = getNodeId(target);

        // Don't create duplicate edges
        const edgeKey = `${callerId}→${targetId}`;
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey);
          edges.push({
            source: callerId,
            target: targetId,
            file: pf.path,
            line: call.line,
          });
        }
      }
    }
  }

  // Include all defined nodes (even isolated ones)
  for (const [, defs] of definitions) {
    for (const def of defs) {
      const id = getNodeId(def);
      if (!nodeMap.has(id)) {
        nodeMap.set(id, {
          id,
          label: getNodeLabel(def),
          group: getNodeGroup(def),
          file: def.file,
          type: def.type,
        });
      }
    }
  }

  return {
    nodes: [...nodeMap.values()],
    edges,
    files: fileSet.size,
  };
}

// ── Internal helpers ──────────────────────────────────────────

const edgeSet = new Set(); // reused across buildGraph calls — reset before each run

/** Reset the internal edge dedup set */
export function resetGraphCache() {
  edgeSet.clear();
}

function lineNum(i) { return i + 1; }

function isSkippedLine(trimmed, lang) {
  if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') ||
      trimmed.startsWith('*') || trimmed.startsWith('*/')) return true;
  if (trimmed.startsWith('import ') || trimmed.startsWith('from ') ||
      trimmed.startsWith('package ') || trimmed.startsWith('namespace ')) return true;
  return false;
}

function countChar(str, ch) {
  let count = 0;
  for (const c of str) if (c === ch) count++;
  return count;
}

function cleanParentClass(raw, lang) {
  if (!raw) return null;
  // Clean up generics and whitespace
  return raw.replace(/<[^>]+>/g, '').split(',')[0].trim() || null;
}
