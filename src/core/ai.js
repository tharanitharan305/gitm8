import picocolors from 'picocolors';
import { get } from './config-store.js';

/**
 * Tone presets mapped to system-prompt fragments.
 */
const TONE_MAP = {
  neutral:
    'Write a commit message that neuturally describes the changes without stylistic flourish.',
  concise:
    'Write a single terse commit message, one line, no more than 72 characters.',
  detailed:
    'Write a commit message with a short summary line and a bullet-point body explaining the why and what of each change.',
  formal:
    'Write a commit message using professional, formal language. Avoid slang or casual phrasing.',
  casual:
    'Write a commit message in a relaxed, conversational tone. Keep it friendly but informative.',
  funny:
    'Write a commit message with a light touch of humor while staying informative about what changed.',
};

/**
 * Build the system prompt from config settings.
 * @returns {string}
 */
function buildSystemPrompt() {
  const tone = get('tone') || 'concise';
  const customTone = get('customTone') || '';
  const commitStyle = get('commitStyle') || 'conventional';

  const parts = [
    'You are an expert software engineer generating a git commit message from a diff.',
    'Analyze the diff carefully and produce a clear, accurate commit message.',
  ];

  // Tone instructions
  if (customTone) {
    parts.push(`Tone instructions: ${customTone}`);
  } else if (TONE_MAP[tone]) {
    parts.push(TONE_MAP[tone]);
  }

  // Style instructions
  if (commitStyle === 'conventional') {
    parts.push(
      'Use Conventional Commits format: <type>: <description>\n\n[optional body]\n\nTypes: feat, fix, chore, docs, refactor, test, style, perf, ci, build, revert.'
    );
  } else {
    parts.push('Use freeform style — no prefix required. Write a clear, descriptive message.');
  }

  parts.push(
    'Respond ONLY with the commit message text. No explanations, no markdown formatting, no surrounding quotes.'
  );

  return parts.join('\n\n');
}

/**
 * Truncate a diff to fit within a character limit, prioritizing file names and hunks.
 * @param {string} diff - The raw diff output
 * @param {number} maxChars - Max characters allowed
 * @returns {string}
 */
function truncateDiff(diff, maxChars) {
  if (diff.length <= maxChars) return diff;

  const lines = diff.split('\n');
  const result = [];
  let charCount = 0;

  // Priority order: header lines (diff --git, ---, +++, @@) first, then context/content
  for (const line of lines) {
    const isHeader =
      line.startsWith('diff --git') ||
      line.startsWith('---') ||
      line.startsWith('+++') ||
      line.startsWith('@@') ||
      line.startsWith('index ') ||
      line.startsWith('new file') ||
      line.startsWith('deleted file') ||
      line.startsWith('rename');

    const lineLen = line.length + 1; // +1 for newline
    if (isHeader) {
      if (charCount + lineLen > maxChars) break;
      result.push(line);
      charCount += lineLen;
    }
  }

  // Now fill remaining space with content lines
  for (const line of lines) {
    const isHeader =
      line.startsWith('diff --git') ||
      line.startsWith('---') ||
      line.startsWith('+++') ||
      line.startsWith('@@') ||
      line.startsWith('index ') ||
      line.startsWith('new file') ||
      line.startsWith('deleted file') ||
      line.startsWith('rename');

    if (isHeader) continue;

    const lineLen = line.length + 1;
    if (charCount + lineLen > maxChars) {
      result.push('... (truncated)');
      break;
    }
    result.push(line);
    charCount += lineLen;
  }

  return result.join('\n');
}

/**
 * Generate a commit message from the staged diff.
 * @param {string} diff - The raw staged diff
 * @returns {Promise<string>} The generated commit message
 */
export async function generateCommitMessage(diff) {
  const apiBaseUrl = get('apiBaseUrl');
  const apiKey = get('apiKey');
  const model = get('model');
  const maxDiffChars = get('maxDiffChars');

  if (!apiKey) {
    throw new Error(
      `API key not configured. Run:\n  gitm8 config set apiKey <your-key>\n  gitm8 config --ui`
    );
  }

  if (!apiBaseUrl) {
    throw new Error(
      `API base URL not configured. Run:\n  gitm8 config set apiBaseUrl <url>\n  gitm8 config --ui`
    );
  }

  const systemPrompt = buildSystemPrompt();
  const truncatedDiff = truncateDiff(diff, maxDiffChars);

  if (truncatedDiff.trim().length === 0) {
    throw new Error('Staged diff is empty after truncation. Nothing to generate a message from.');
  }

  const url = `${apiBaseUrl.replace(/\/+$/, '')}/chat/completions`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Generate a commit message for the following diff:\n\n${truncatedDiff}`,
          },
        ],
        temperature: 0.4,
        stream: false,
      }),
    });
  } catch (err) {
    throw new Error(
      `Network error contacting ${apiBaseUrl}: ${err.message}\nCheck your apiBaseUrl config.`
    );
  }

  if (!response.ok) {
    let detail = '';
    try {
      const errBody = await response.json();
      detail = errBody.error?.message || JSON.stringify(errBody);
    } catch {
      detail = response.statusText;
    }
    throw new Error(`AI API error (${response.status}): ${detail}`);
  }

  const data = await response.json().catch(() => null);

  if (!data) {
    // Try to read the raw text to give a helpful diagnostic
    const rawText = await response.text().catch(() => '');
    if (rawText.startsWith('data:') || rawText.includes('\ndata:')) {
      throw new Error(
        `The AI provider returned a streaming response instead of JSON.\n` +
        `This usually means the endpoint defaults to SSE streaming.\n` +
        `Try setting "stream": false in your request, or use a non-streaming model.\n` +
        `Raw response preview: ${rawText.slice(0, 200)}...`
      );
    }
    throw new Error(
      `AI returned invalid JSON. Check that your API endpoint returns a standard chat completion.\n` +
      `Raw response preview: ${rawText.slice(0, 200)}...`
    );
  }

  const message = data.choices?.[0]?.message?.content?.trim();

  if (!message) {
    throw new Error('AI returned an empty response. Try again or check your model config.');
  }

  return message;
}

export { TONE_MAP, buildSystemPrompt, truncateDiff };
