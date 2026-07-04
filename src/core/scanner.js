import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Framework detection rules.
 * Each detector has files to check, build/test commands to run, and conditions.
 */
const DETECTORS = [
  {
    name: 'node',
    label: 'Node.js',
    indicatorFiles: ['package.json'],
    buildCmd: 'npm run build',
    testCmd: 'npm test',
    /** Does the project actually have a build script in package.json? */
    qualifies: () => {
      const pkgPath = join(process.cwd(), 'package.json');
      if (!existsSync(pkgPath)) return false;
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        return !!(pkg.scripts?.build || pkg.scripts?.compile);
      } catch {
        return false;
      }
    },
  },
  {
    name: 'python',
    label: 'Python',
    indicatorFiles: ['requirements.txt', 'pyproject.toml', 'setup.py', 'setup.cfg', 'Pipfile'],
    buildCmd: null, // Python doesn't have a universal build step
    testCmd: 'python -m pytest',
    qualifies: () => true,
  },
  {
    name: 'rust',
    label: 'Rust',
    indicatorFiles: ['Cargo.toml'],
    buildCmd: 'cargo build',
    testCmd: 'cargo test',
    qualifies: () => true,
  },
  {
    name: 'go',
    label: 'Go',
    indicatorFiles: ['go.mod'],
    buildCmd: 'go build ./...',
    testCmd: 'go test ./...',
    qualifies: () => true,
  },
  {
    name: 'deno',
    label: 'Deno',
    indicatorFiles: ['deno.json', 'deno.jsonc', 'import_map.json'],
    buildCmd: null,
    testCmd: 'deno test',
    qualifies: () => true,
  },
  {
    name: 'dotnet',
    label: '.NET',
    indicatorFiles: ['*.csproj', '*.sln'],
    // Uses glob-ish detection via directory scan
    buildCmd: 'dotnet build',
    testCmd: 'dotnet test',
    qualifies: () => true,
    /** Override for .NET since files are project-specific */
    checkFiles: () => {
        try {
          const files = readdirSync(process.cwd());
          return files.some(f => f.endsWith('.csproj') || f.endsWith('.sln'));
        } catch {
          return false;
        }
      },
  },
  {
    name: 'dart',
    label: 'Dart / Flutter',
    indicatorFiles: ['pubspec.yaml'],
    buildCmd: 'dart compile exe bin/',
    testCmd: 'dart test',
    qualifies: () => true,
  },
];

/**
 * Default command set when no framework is detected.
 */
const FALLBACK = {
  name: 'unknown',
  label: 'Unknown (generic)',
  buildCmd: null,
  testCmd: null,
};

/**
 * Detect the project's framework / language by scanning for indicator files.
 * @returns {{ name: string, label: string, buildCmd: string | null, testCmd: string | null }}
 */
export function detectFramework() {
  for (const detector of DETECTORS) {
    // If a custom check function exists, use it
    if (typeof detector.checkFiles === 'function') {
      if (!detector.checkFiles()) continue;
    } else {
      // Standard indicator-file check
      const found = detector.indicatorFiles.some((file) => {
        // Support glob-like patterns (*.csproj) with special handling
        if (file.includes('*')) return false; // handled by checkFiles
        return existsSync(join(process.cwd(), file));
      });
      if (!found) continue;
    }

    // Run the qualifies check (e.g. does package.json have a build script?)
    if (detector.qualifies()) {
      return {
        name: detector.name,
        label: detector.label,
        buildCmd: detector.buildCmd,
        testCmd: detector.testCmd,
      };
    }

    // Found the files but didn't qualify (e.g. no build script) — skip build
    return {
      name: detector.name,
      label: detector.label,
      buildCmd: null,
      testCmd: detector.testCmd,
    };
  }

  return { ...FALLBACK };
}

/**
 * Check whether there are uncommitted changes (staged or unstaged).
 * @returns {Promise<boolean>}
 */
export async function hasUncommittedChanges() {
  const { execa } = await import('execa');
  const { stdout } = await execa('git', ['status', '--porcelain']);
  return stdout.trim().length > 0;
}
