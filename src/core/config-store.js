import Conf from 'conf';

const schema = {
  apiBaseUrl: {
    type: 'string',
    default: 'https://api.openai.com/v1',
  },
  apiKey: {
    type: 'string',
    default: '',
  },
  model: {
    type: 'string',
    default: 'gpt-4o-mini',
  },
  tone: {
    type: 'string',
    default: 'concise',
  },
  customTone: {
    type: 'string',
    default: '',
  },
  commitStyle: {
    type: 'string',
    enum: ['conventional', 'freeform'],
    default: 'conventional',
  },
  maxDiffChars: {
    type: 'number',
    default: 6000,
    minimum: 1000,
    maximum: 50000,
  },
  pipelineSecretsScan: {
    type: 'boolean',
    default: true,
  },
  pipelinePrecheck: {
    type: 'boolean',
    default: false,
  },
  pipelineAutoPush: {
    type: 'boolean',
    default: false,
  },
  pipelineSteps: {
    type: 'array',
    default: [
      { step: 'add', mode: 'auto', config: { files: '.' } },
      { step: 'secrets-scan', mode: 'auto' },
      { step: 'commit', mode: 'manual' },
      { step: 'precheck', mode: 'auto' },
      { step: 'push', mode: 'manual' },
    ],
  },
};

const config = new Conf({
  projectName: 'gitm8',
  schema,
  defaults: {
    apiBaseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    tone: 'concise',
    customTone: '',
    commitStyle: 'conventional',
    maxDiffChars: 6000,
    pipelineSecretsScan: true,
    pipelinePrecheck: false,
    pipelineAutoPush: false,
    pipelineSteps: [
      { step: 'add', mode: 'auto', config: { files: '.' } },
      { step: 'secrets-scan', mode: 'auto' },
      { step: 'commit', mode: 'manual' },
      { step: 'precheck', mode: 'auto' },
      { step: 'push', mode: 'manual' },
    ],
  },
});

/**
 * Mask a string for safe display — shows first 4 and last 4 chars.
 * @param {string} str
 * @returns {string}
 */
function maskKey(str) {
  if (!str || str.length < 8) return '********';
  return str.slice(0, 4) + '****' + str.slice(-4);
}

export function get(key) {
  return config.get(key);
}

export function set(key, value) {
  config.set(key, value);
}

export function list() {
  const all = config.store;
  const entries = [];
  for (const [key, value] of Object.entries(all)) {
    if (key === 'apiKey') {
      entries.push({ key, value: maskKey(value), masked: true });
    } else {
      entries.push({ key, value, masked: false });
    }
  }
  return entries;
}

export function getConfigPath() {
  return config.path;
}

export default config;
