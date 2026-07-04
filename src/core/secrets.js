import { readFileSync, existsSync } from 'fs';
import { join, relative } from 'path';

/**
 * Secret pattern definitions.
 * Each pattern has a name, severity, regex, and optional file extension filter.
 *
 * Severity levels:
 * - critical: plaintext credentials, private keys, auth tokens
 * - high:    API keys, secret keys with clear context
 * - medium:  potential secrets (e.g. config values named "password")
 * - low:     suspicious but needs human review
 */
const PATTERNS = [
  // ── Critical ────────────────────────────────────────────────
  {
    name: 'AWS Client ID',
    severity: 'critical',
    pattern: /(?:AKIA|ASIA)[A-Z0-9]{16}/g,
    description: 'Amazon Web Services access key ID',
  },
  {
    name: 'AWS Secret Key',
    severity: 'critical',
    pattern: /(?:aws[_\-]?secret[_\-]?access[_\-]?key|aws_secret_access_key)\s*[:=]\s*["']?[a-z0-9\/+=]{40}["']?/gi,
    description: 'AWS secret access key (with keyword context)',
  },
  {
    name: 'GitHub Token',
    severity: 'critical',
    pattern: /(?:ghp_|ghu_|gho_|ghs_|ghr_|github_pat_)[A-Za-z0-9_]{36,}/g,
    description: 'GitHub personal access token or OAuth token',
  },
  {
    name: 'GitLab Token',
    severity: 'critical',
    pattern: /glpat-[A-Za-z0-9\-_]{20,}/g,
    description: 'GitLab personal access token',
  },
  {
    name: 'Private Key',
    severity: 'critical',
    pattern: /-----BEGIN\s?(?:RSA|DSA|EC|OPENSSH|PGP)?\s?PRIVATE KEY-----/g,
    description: 'Private key block — never commit these',
  },
  {
    name: 'Slack Token',
    severity: 'critical',
    pattern: /(?:xox[abdefgrs]-[A-Za-z0-9]{10,})/g,
    description: 'Slack API token',
  },
  {
    name: 'Discord Bot Token',
    severity: 'critical',
    pattern: /[MN][A-Za-z\d]{23}\.[A-Za-z\d]{6}\.[A-Za-z\d\-_]{27,}/g,
    description: 'Discord bot or user token',
  },
  {
    name: 'Generic Bearer Token',
    severity: 'critical',
    pattern: /bearer\s+[a-z0-9\-._~+/]{20,}/gi,
    description: 'Bearer authorization token in code',
  },
  {
    name: 'JWT Token',
    severity: 'high',
    pattern: /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_+/]+/g,
    description: 'JSON Web Token — if hardcoded, could be a session token',
  },
  // ── High ────────────────────────────────────────────────────
  {
    name: 'Stripe Live Key',
    severity: 'high',
    pattern: /(?:sk_live_|pk_live_|rk_live_)[A-Za-z0-9]{24,}/g,
    description: 'Stripe live (production) API key',
  },
  {
    name: 'Stripe Test Key',
    severity: 'medium',
    pattern: /(?:sk_test_|pk_test_|rk_test_)[A-Za-z0-9]{24,}/g,
    description: 'Stripe test API key — still avoid committing',
  },
  {
    name: 'Google API Key',
    severity: 'high',
    pattern: /AIza[0-9a-z\-_]{35}/gi,
    description: 'Google Cloud API key',
  },
  {
    name: 'Google OAuth / Service Account',
    severity: 'high',
    pattern: /[0-9]+-[0-9A-Za-z_]{32}\.apps\.googleusercontent\.com/g,
    description: 'Google OAuth client ID',
  },
  {
    name: 'npm Token',
    severity: 'high',
    pattern: /npm_[A-Za-z0-9]{36,}/g,
    description: 'npm access token',
  },
  {
    name: 'Twilio API Key',
    severity: 'high',
    pattern: /SK[A-Za-z0-9]{32}/g,
    description: 'Twilio API key or auth token',
  },
  {
    name: 'Heroku API Key',
    severity: 'high',
    pattern: /heroku(?:_|-)?.{0,20}?[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi,
    description: 'Heroku API key',
  },
  {
    name: 'Azure Connection String',
    severity: 'high',
    pattern: /DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[^;]+/g,
    description: 'Azure storage account connection string',
  },
  {
    name: 'Docker Config Auth',
    severity: 'high',
    pattern: /"auths"\s*:\s*\{[^}]*"auth"\s*:\s*"[a-z0-9+/=]{30,}"/gi,
    description: 'Docker config with base64-encoded credentials',
  },
  {
    name: 'MongoDB Connection String',
    severity: 'high',
    pattern: /mongodb(?:\+srv)?:\/\/[^\/@]+:[^\/@]+@/g,
    description: 'MongoDB connection string with embedded credentials',
  },
  {
    name: 'PostgreSQL Connection String',
    severity: 'high',
    pattern: /postgres(?:ql)?:\/\/[^\/@]+:[^\/@]+@/g,
    description: 'PostgreSQL connection string with password',
  },
  {
    name: 'MySQL Connection String',
    severity: 'high',
    pattern: /mysql:\/\/[^\/@]+:[^\/@]+@/g,
    description: 'MySQL connection string with password',
  },
  {
    name: 'Redis Connection String',
    severity: 'high',
    pattern: /redis:\/\/[^:@]+:[^:@]+@/g,
    description: 'Redis connection string with password',
  },
  // ── Medium ──────────────────────────────────────────────────
  {
    name: '.env File Staged',
    severity: 'high',
    pattern: /\.env\b/g,
    description: '.env file tracked by git — likely contains secrets',
    fileFilter: /\.env$/i,
  },
  {
    name: 'Password in Config',
    severity: 'medium',
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*["'][^"']{3,}["']/gi,
    description: 'Variable named "password" with a hardcoded value',
  },
  {
    name: 'Secret Key in Config',
    severity: 'medium',
    pattern: /(?:secret_key|secretkey|secret)\s*[:=]\s*["'][^"']{8,}["']/gi,
    description: 'Variable named "secret" with a hardcoded value',
  },
  {
    name: 'API Key in Config',
    severity: 'medium',
    pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*["'][^"']{8,}["']/gi,
    description: 'Variable named "apiKey" with a hardcoded value',
  },
  {
    name: 'Token in Config',
    severity: 'medium',
    pattern: /(?:token|access_token|auth_token)\s*[:=]\s*["'][a-z0-9\-_.]{8,}["']/gi,
    description: 'Variable named "token" with a hardcoded value',
  },
  {
    name: 'Private Key Path in Config',
    severity: 'medium',
    pattern: /(?:key_file|key_path|private_key|ssh_key)\s*[:=]\s*["'][^"']+["']/gi,
    description: 'Reference to a key file path',
  },
  {
    name: 'Base64 Looks Like Credentials',
    severity: 'low',
    pattern: /["'][A-Za-z0-9+/]{40,}={0,2}["']/g,
    description: 'Base64-encoded string (40+ chars) — could be credentials',
    contextCheck: true, // only flag if near auth-related keywords
  },
  // ── Low (suspicious patterns) ────────────────────────────────
  {
    name: 'Connection String Without Credentials',
    severity: 'low',
    pattern: /(?:jdbc|odbc):[^"'\s]{10,}/g,
    description: 'JDBC/ODBC connection string',
  },
  {
    name: 'Sensitive File Extension',
    severity: 'medium',
    pattern: /\.(?:pem|key|cert|crt|pkcs12|p12|pfx|keystore|jks|secret)$/i,
    description: 'Sensitive file type — contains key material',
    fileFilter: /\.(pem|key|cert|crt|pkcs12|p12|pfx|keystore|jks|secret)$/i,
  },
  {
    name: 'Service Account JSON',
    severity: 'high',
    pattern: /"private_key_id"\s*:/g,
    description: 'Google/GCP service account key file',
    fileFilter: /\.json$/i,
  },
  {
    name: 'S3 Credentials',
    severity: 'high',
    pattern: /(?:s3[_\-]?access[_\-]?key|s3_secret|s3_key)\s*[:=]\s*["']?[a-z0-9\/+=]{20,}["']?/gi,
    description: 'S3 access credentials',
  },
];

/**
 * A matched finding on a specific line of a specific file.
 * @typedef {Object} Finding
 * @property {string} file - File path (relative to cwd)
 * @property {number} line - Line number (1-indexed)
 * @property {string} name - Pattern name
 * @property {string} severity - "critical" | "high" | "medium" | "low"
 * @property {string} description - What was found
 * @property {string} match - The matched text (truncated)
 * @property {number} column - Column position of the match
 */

/**
 * Get all staged files with their diffs.
 * Returns parsed file-by-file content.
 * @returns {Promise<{file: string, lines: string[]}[]>}
 */
export async function getStagedFiles() {
  const { execa } = await import('execa');

  // Get staged file list with status
  const { stdout: fileList } = await execa('git', [
    'diff', '--cached', '--name-status',
  ]);

  if (!fileList.trim()) return [];

  const files = [];

  for (const line of fileList.split('\n')) {
    const [status, ...pathParts] = line.trim().split('\t');
    const filePath = pathParts.join('\t');
    if (!filePath) continue;

    // Skip deleted files
    if (status === 'D') continue;

    files.push({ file: filePath, status });
  }

  return files;
}

/**
 * Get the staged content of a file.
 * @param {string} filePath
 * @returns {Promise<{ lines: string[], raw: string } | null>}
 */
async function getStagedContent(filePath) {
  const { execa } = await import('execa');
  try {
    const { stdout } = await execa('git', [
      'show', `:${filePath}`,
    ]);
    const lines = stdout.split('\n');
    return { lines, raw: stdout };
  } catch {
    // File might not exist in the index (new file)
    // Fall back to reading from disk
    try {
      const raw = readFileSync(join(process.cwd(), filePath), 'utf-8');
      const lines = raw.split('\n');
      return { lines, raw };
    } catch {
      return null;
    }
  }
}

/**
 * Scan a single file's content for secrets.
 * @param {string} filePath - Relative path
 * @param {string[]} lines - File content line by line
 * @returns {Finding[]}
 */
function scanFile(filePath, lines) {
  const findings = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    for (const patternDef of PATTERNS) {
      // Skip patterns that don't match the file extension
      if (patternDef.fileFilter && !patternDef.fileFilter.test(filePath)) continue;

      // Reset regex lastIndex (important with global flag on reused regex)
      patternDef.pattern.lastIndex = 0;
      const matches = line.matchAll(patternDef.pattern);

      for (const match of matches) {
        const matchedText = match[0] || match[1] || match[0];
        const column = (match.index || 0) + 1;

        // For patterns with contextCheck, only flag if near auth keywords
        if (patternDef.contextCheck) {
          const contextBefore = line.slice(0, match.index).toLowerCase();
          const hasAuthContext = /(?:key|secret|token|password|auth|credential|access)/i.test(contextBefore);
          if (!hasAuthContext) continue;
        }

        findings.push({
          file: filePath,
          line: lineNum,
          column,
          name: patternDef.name,
          severity: patternDef.severity,
          description: patternDef.description,
          match: truncateMatch(matchedText),
        });
      }
    }

    // Special check: line in .env file
    if (/\.env$/i.test(filePath) && /^\s*[A-Za-z_][A-Za-z0-9_]*=/.test(line) && !line.trimStart().startsWith('#')) {
      const [key] = line.split('=');
      const val = line.slice(key.length + 1).trim();
      if (val && !val.startsWith('"placeholder') && val.length > 4) {
        findings.push({
          file: filePath,
          line: lineNum,
          column: 1,
          name: '.env Variable',
          severity: 'high',
          description: `Environment variable \`${key.trim()}\` with a non-placeholder value`,
          match: `${key.trim()}=${truncateMatch(val)}`,
        });
      }
    }
  }

  return findings;
}

/**
 * Run the full secrets scan against staged changes.
 * @returns {Promise<Finding[]>}
 */
export async function scanStagedSecrets() {
  const files = await getStagedFiles();
  if (files.length === 0) return [];

  const allFindings = [];

  for (const { file } of files) {
    const content = await getStagedContent(file);
    if (!content) continue;

    const fileFindings = scanFile(file, content.lines);
    allFindings.push(...fileFindings);
  }

  return allFindings;
}

/**
 * Truncate a matched secret to a safe display length.
 * @param {string} text
 * @param {number} maxLen
 * @returns {string}
 */
function truncateMatch(text, maxLen = 60) {
  if (text.length <= maxLen) return text;
  return text.slice(0, Math.floor(maxLen / 2)) + '…' + text.slice(-Math.floor(maxLen / 4));
}

/**
 * Check whether a file path looks like it should be gitignored.
 * This is a simple heuristic — the real check is in .gitignore.
 * @param {string} filePath
 * @returns {boolean}
 */
export function isSensitiveFile(filePath) {
  const sensitive = [
    /\.env$/i,
    /\.env\./i,
    /\.pem$/i,
    /\.key$/i,
    /\.cert$/i,
    /\.keystore$/i,
    /credentials/i,
    /secrets/i,
    /\.secret/i,
    /service-account/i,
    /\.local\./i,
  ];
  return sensitive.some((re) => re.test(filePath));
}
