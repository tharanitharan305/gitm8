"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.openConfigPanel = openConfigPanel;
const vscode = __importStar(require("vscode"));
const secrets_1 = require("../secrets");
/**
 * Open a webview panel for gitm8 configuration.
 * Contains API key, model, tone, commit style, and pipeline settings.
 */
function openConfigPanel() {
    const panel = vscode.window.createWebviewPanel('gitm8Config', 'gitm8 Configuration', vscode.ViewColumn.One, {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [],
    });
    panel.webview.html = getWebviewContent(panel.webview);
    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(async (message) => {
        switch (message.type) {
            case 'ready':
                // Webview is ready — send current config
                await sendConfigToWebview(panel);
                break;
            case 'saveConfig':
                await saveConfig(message.payload);
                panel.webview.postMessage({ type: 'saved' });
                break;
            case 'saveApiKey':
                await (0, secrets_1.storeApiKey)(message.payload.apiKey);
                panel.webview.postMessage({ type: 'apiKeySaved', masked: maskKey(message.payload.apiKey) });
                break;
            case 'deleteApiKey':
                await (0, secrets_1.deleteApiKey)();
                panel.webview.postMessage({ type: 'apiKeyDeleted' });
                break;
            case 'getApiKey':
                const key = await (0, secrets_1.getApiKey)();
                panel.webview.postMessage({
                    type: 'apiKeyValue',
                    exists: !!key,
                    masked: key ? maskKey(key) : null,
                });
                break;
        }
    });
}
async function sendConfigToWebview(panel) {
    const config = vscode.workspace.getConfiguration('gitm8');
    const apiKey = await (0, secrets_1.getApiKey)();
    panel.webview.postMessage({
        type: 'config',
        payload: {
            apiBaseUrl: config.get('apiBaseUrl'),
            model: config.get('model'),
            tone: config.get('tone'),
            customTone: config.get('customTone'),
            commitStyle: config.get('commitStyle'),
            maxDiffChars: config.get('maxDiffChars'),
            pipelinePrecheck: config.get('pipelinePrecheck'),
            pipelineAutoPush: config.get('pipelineAutoPush'),
            apiKeyExists: !!apiKey,
            apiKeyMasked: apiKey ? maskKey(apiKey) : null,
        },
    });
}
async function saveConfig(payload) {
    const config = vscode.workspace.getConfiguration('gitm8');
    const updates = {
        apiBaseUrl: payload.apiBaseUrl,
        model: payload.model,
        tone: payload.tone,
        customTone: payload.customTone ?? '',
        commitStyle: payload.commitStyle,
        maxDiffChars: parseInt(payload.maxDiffChars, 10) || 6000,
        pipelinePrecheck: !!payload.pipelinePrecheck,
        pipelineAutoPush: !!payload.pipelineAutoPush,
    };
    for (const [key, value] of Object.entries(updates)) {
        await config.update(key, value, vscode.ConfigurationTarget.Global);
    }
}
function maskKey(key) {
    if (!key || key.length < 8)
        return '•'.repeat(8);
    return key.slice(0, 4) + '••••' + key.slice(-4);
}
function getWebviewContent(webview) {
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>gitm8 Config</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background, #1e1e1e);
      --fg: var(--vscode-editor-foreground, #d4d4d4);
      --input-bg: var(--vscode-input-background, #3c3c3c);
      --input-fg: var(--vscode-input-foreground, #cccccc);
      --input-border: var(--vscode-input-border, #555);
      --focus-border: var(--vscode-focusBorder, #007fd4);
      --button-bg: var(--vscode-button-background, #0078d4);
      --button-fg: var(--vscode-button-foreground, #ffffff);
      --button-hover: var(--vscode-button-hoverBackground, #026ec1);
      --success: #4ade80;
      --error: #f87171;
      --dim: var(--vscode-descriptionForeground, #888);
      --radius: 4px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: var(--bg);
      color: var(--fg);
      padding: 20px;
      font-size: 13px;
      line-height: 1.5;
    }
    h1 { font-size: 1.3rem; font-weight: 600; margin-bottom: 0.25rem; }
    .subtitle { color: var(--dim); font-size: 0.85rem; margin-bottom: 1.5rem; }
    section {
      background: color-mix(in srgb, var(--bg) 98%, white);
      border: 1px solid var(--input-border);
      border-radius: var(--radius);
      padding: 16px;
      margin-bottom: 16px;
    }
    h2 {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--dim);
      margin-bottom: 12px;
    }
    .field { margin-bottom: 12px; }
    .field:last-child { margin-bottom: 0; }
    label { display: block; font-size: 0.85rem; font-weight: 500; margin-bottom: 4px; }
    input, select {
      width: 100%;
      padding: 6px 8px;
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: var(--radius);
      color: var(--input-fg);
      font-size: 0.85rem;
      outline: none;
    }
    input:focus, select:focus { border-color: var(--focus-border); }
    .hint { display: block; color: var(--dim); font-size: 0.75rem; margin-top: 3px; }
    .password-row { display: flex; gap: 6px; }
    .password-row input { flex: 1; }
    .password-row button {
      background: var(--button-bg);
      color: var(--button-fg);
      border: none;
      border-radius: var(--radius);
      padding: 6px 10px;
      cursor: pointer;
      font-size: 0.8rem;
      white-space: nowrap;
    }
    .password-row button:hover { background: var(--button-hover); }
    .password-row button.danger { background: var(--error); }
    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid var(--input-border);
    }
    .toggle-row:last-of-type { border-bottom: none; }
    .toggle-switch {
      position: relative;
      width: 36px;
      height: 20px;
      flex-shrink: 0;
    }
    .toggle-switch input { opacity: 0; width: 0; height: 0; }
    .toggle-slider {
      position: absolute; cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background: var(--input-border);
      border-radius: 20px;
      transition: 0.2s;
    }
    .toggle-slider::before {
      content: '';
      position: absolute;
      height: 14px; width: 14px;
      left: 3px; bottom: 3px;
      background: white;
      border-radius: 50%;
      transition: 0.2s;
    }
    .toggle-switch input:checked + .toggle-slider { background: var(--button-bg); }
    .toggle-switch input:checked + .toggle-slider::before { transform: translateX(16px); }
    .actions { display: flex; gap: 8px; margin-top: 16px; }
    .actions button {
      background: var(--button-bg);
      color: var(--button-fg);
      border: none;
      padding: 8px 16px;
      border-radius: var(--radius);
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
    }
    .actions button:hover { background: var(--button-hover); }
    .actions button:active { transform: scale(0.98); }
    .feedback { font-size: 0.8rem; font-weight: 500; margin-top: 8px; }
    .feedback.success { color: var(--success); }
    .feedback.error { color: var(--error); }
  </style>
</head>
<body>
  <h1>⚙ gitm8</h1>
  <p class="subtitle">AI-powered Git workflow — configuration</p>

  <section>
    <h2>AI Provider</h2>
    <div class="field">
      <label for="apiKey">API Key</label>
      <div class="password-row">
        <input type="password" id="apiKey" placeholder="sk-..." />
        <button id="toggleKeyBtn">Show</button>
        <button id="deleteKeyBtn" class="danger">Remove</button>
      </div>
      <span class="hint" id="apiKeyStatus">Stored securely in VS Code</span>
    </div>
    <div class="field">
      <label for="apiBaseUrl">API Base URL</label>
      <input type="url" id="apiBaseUrl" placeholder="https://api.openai.com/v1" />
      <span class="hint">Any OpenAI-compatible endpoint</span>
    </div>
    <div class="field">
      <label for="model">Model</label>
      <input type="text" id="model" placeholder="gpt-4o-mini" />
      <span class="hint">Model name your provider supports</span>
    </div>
  </section>

  <section>
    <h2>Commit Style</h2>
    <div class="field">
      <label for="commitStyle">Format</label>
      <select id="commitStyle">
        <option value="conventional">Conventional Commits (feat:, fix:, chore:, etc.)</option>
        <option value="freeform">Freeform — no prefix</option>
      </select>
    </div>
    <div class="field">
      <label for="tone">Tone</label>
      <select id="tone">
        <option value="neutral">Neutral</option>
        <option value="concise">Concise</option>
        <option value="detailed">Detailed</option>
        <option value="formal">Formal</option>
        <option value="casual">Casual</option>
        <option value="funny">Funny</option>
        <option value="custom">Custom</option>
      </select>
    </div>
    <div class="field" id="customToneField" style="display:none;">
      <label for="customTone">Custom Tone Description</label>
      <input type="text" id="customTone" placeholder="e.g. Write like a pirate" />
    </div>
    <div class="field">
      <label for="maxDiffChars">Max Diff Characters</label>
      <input type="number" id="maxDiffChars" min="1000" max="50000" />
      <span class="hint">Truncated before sending to AI</span>
    </div>
  </section>

  <section>
    <h2>Pipeline</h2>
    <div class="toggle-row">
      <span>Run precheck (build) after commit</span>
      <label class="toggle-switch">
        <input type="checkbox" id="pipelinePrecheck" />
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="toggle-row">
      <span>Auto-push after successful commit</span>
      <label class="toggle-switch">
        <input type="checkbox" id="pipelineAutoPush" />
        <span class="toggle-slider"></span>
      </label>
    </div>
  </section>

  <div class="actions">
    <button id="saveBtn">💾 Save</button>
    <button id="refreshBtn">⟳ Refresh</button>
  </div>
  <div id="feedback" class="feedback"></div>

  <script>
    (function() {
      const vscode = acquireVsCodeApi();

      // State
      let apiKeyExists = false;

      // DOM refs
      const apiKeyInput = document.getElementById('apiKey');
      const toggleKeyBtn = document.getElementById('toggleKeyBtn');
      const deleteKeyBtn = document.getElementById('deleteKeyBtn');
      const apiKeyStatus = document.getElementById('apiKeyStatus');
      const apiBaseUrl = document.getElementById('apiBaseUrl');
      const model = document.getElementById('model');
      const tone = document.getElementById('tone');
      const customTone = document.getElementById('customTone');
      const customToneField = document.getElementById('customToneField');
      const commitStyle = document.getElementById('commitStyle');
      const maxDiffChars = document.getElementById('maxDiffChars');
      const pipelinePrecheck = document.getElementById('pipelinePrecheck');
      const pipelineAutoPush = document.getElementById('pipelineAutoPush');
      const saveBtn = document.getElementById('saveBtn');
      const refreshBtn = document.getElementById('refreshBtn');
      const feedback = document.getElementById('feedback');

      // Request config on load
      vscode.postMessage({ type: 'ready' });
      vscode.postMessage({ type: 'getApiKey' });

      // Handle messages from extension
      window.addEventListener('message', event => {
        const msg = event.data;
        switch (msg.type) {
          case 'config':
            apiBaseUrl.value = msg.payload.apiBaseUrl || '';
            model.value = msg.payload.model || '';
            tone.value = msg.payload.tone || 'concise';
            customTone.value = msg.payload.customTone || '';
            commitStyle.value = msg.payload.commitStyle || 'conventional';
            maxDiffChars.value = msg.payload.maxDiffChars || 6000;
            pipelinePrecheck.checked = !!msg.payload.pipelinePrecheck;
            pipelineAutoPush.checked = !!msg.payload.pipelineAutoPush;
            apiKeyExists = !!msg.payload.apiKeyExists;
            updateApiKeyUI(msg.payload.apiKeyMasked);
            toggleCustomTone();
            break;
          case 'saved':
            feedback.className = 'feedback success';
            feedback.textContent = '✔ Settings saved!';
            setTimeout(() => { feedback.textContent = ''; }, 3000);
            break;
          case 'apiKeySaved':
            apiKeyExists = true;
            updateApiKeyUI(msg.masked);
            apiKeyStatus.textContent = '✔ API key saved securely';
            apiKeyStatus.style.color = 'var(--success)';
            setTimeout(() => { apiKeyStatus.textContent = 'Stored securely in VS Code'; apiKeyStatus.style.color = ''; }, 3000);
            break;
          case 'apiKeyDeleted':
            apiKeyExists = false;
            apiKeyInput.value = '';
            apiKeyInput.type = 'password';
            toggleKeyBtn.textContent = 'Show';
            apiKeyStatus.textContent = 'API key removed';
            break;
          case 'apiKeyValue':
            apiKeyExists = msg.exists;
            updateApiKeyUI(msg.masked);
            break;
        }
      });

      function updateApiKeyUI(masked) {
        if (masked) {
          apiKeyInput.value = masked;
          apiKeyInput.dataset.masked = 'true';
        } else {
          delete apiKeyInput.dataset.masked;
        }
      }

      // Clear masked flag when user types
      apiKeyInput.addEventListener('input', () => {
        delete apiKeyInput.dataset.masked;
      });

      // Toggle API key visibility
      toggleKeyBtn.addEventListener('click', () => {
        if (apiKeyInput.type === 'password') {
          apiKeyInput.type = 'text';
          toggleKeyBtn.textContent = 'Hide';
        } else {
          apiKeyInput.type = 'password';
          toggleKeyBtn.textContent = 'Show';
        }
      });

      // Delete API key
      deleteKeyBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'deleteApiKey' });
      });

      // Show/hide custom tone field
      tone.addEventListener('change', toggleCustomTone);
      function toggleCustomTone() {
        customToneField.style.display = tone.value === 'custom' ? 'block' : 'none';
      }

      // Save
      saveBtn.addEventListener('click', () => {
        feedback.className = 'feedback';
        feedback.textContent = 'Saving...';

        // Save API key if changed
        const apiKeyVal = apiKeyInput.value;
        if (apiKeyVal && !apiKeyInput.dataset.masked) {
          vscode.postMessage({ type: 'saveApiKey', payload: { apiKey: apiKeyVal } });
        }

        // Save other settings
        vscode.postMessage({
          type: 'saveConfig',
          payload: {
            apiBaseUrl: apiBaseUrl.value,
            model: model.value,
            tone: tone.value,
            customTone: customTone.value,
            commitStyle: commitStyle.value,
            maxDiffChars: maxDiffChars.value,
            pipelinePrecheck: pipelinePrecheck.checked,
            pipelineAutoPush: pipelineAutoPush.checked,
          }
        });
      });

      // Refresh
      refreshBtn.addEventListener('click', () => {
        feedback.className = 'feedback';
        feedback.textContent = 'Refreshing...';
        vscode.postMessage({ type: 'ready' });
        vscode.postMessage({ type: 'getApiKey' });
      });
    })();
  </script>
</body>
</html>`;
}
//# sourceMappingURL=configPanel.js.map