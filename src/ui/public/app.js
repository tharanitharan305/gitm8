/* ── Pipeline step definitions ── */
const STEP_META = {
  add:           { icon: '📂', label: 'Add' },
  'secrets-scan': { icon: '🔐', label: 'Secrets Scan' },
  commit:        { icon: '📝', label: 'Commit' },
  precheck:      { icon: '🏗️',  label: 'Precheck' },
  push:          { icon: '🚀', label: 'Push' },
};
const STEP_ORDER = Object.keys(STEP_META);

// ── State ──
let pipelineSteps = [];
let dragSrcIndex = null;

// ── DOM refs ──
const pipelineList = document.getElementById('pipeline-list');
const pipelineFeedback = document.getElementById('pipeline-feedback');

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('config-form');
  const saveBtn = document.getElementById('save-btn');
  const feedback = document.getElementById('save-feedback');
  const toggleKeyBtn = document.getElementById('toggle-key');
  const apiKeyInput = document.getElementById('apiKey');
  const toneSelect = document.getElementById('tone');
  const customToneField = document.getElementById('custom-tone-field');
  const savePipelineBtn = document.getElementById('save-pipeline-btn');
  const runPipelineBtn = document.getElementById('run-pipeline-btn');

  // ── Load current config ──
  async function loadConfig() {
    try {
      const res = await fetch('/api/config');
      if (!res.ok) throw new Error('Failed to load config');
      const data = await res.json();

      for (const [key, { value, masked }] of Object.entries(data)) {
        const el = document.querySelector(`[name="${key}"]`);
        if (!el) continue;
        if (key === 'apiKey' && value && masked) {
          el.dataset.masked = 'true';
          el.value = value; // show masked version (e.g. "sk-****xxxx")
        } else if (el.type === 'checkbox') {
          el.checked = value === true || value === 'true';
        } else {
          el.value = value ?? '';
        }
      }

      // When user types in the API key field, clear the masked flag
      apiKeyInput.addEventListener('input', () => {
        delete apiKeyInput.dataset.masked;
      });

      // Load pipeline steps
      if (Array.isArray(data.pipelineSteps?.value)) {
        pipelineSteps = data.pipelineSteps.value;
      } else {
        pipelineSteps = getDefaultPipeline();
      }
      renderPipeline();

      // Show/hide custom tone field
      toggleCustomToneField();
    } catch (err) {
      feedback.textContent = `⚠ ${err.message}`;
      feedback.className = 'feedback error';
    }
  }

  // ── Toggle custom tone field ──
  function toggleCustomToneField() {
    customToneField.style.display = toneSelect.value === 'custom' ? 'block' : 'none';
  }

  toneSelect.addEventListener('change', toggleCustomToneField);

  // ── Toggle API key visibility ──
  toggleKeyBtn.addEventListener('click', () => {
    const type = apiKeyInput.type === 'password' ? 'text' : 'password';
    apiKeyInput.type = type;
    toggleKeyBtn.textContent = type === 'password' ? '👁' : '👁‍🗨';
  });

  // ── Save config ──
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    saveBtn.disabled = true;
    feedback.textContent = 'Saving...';
    feedback.className = 'feedback';

    const payload = {};

    for (const el of form.querySelectorAll('input:not([type="checkbox"]), select, textarea')) {
      if (el.name && el.dataset.masked !== 'true') payload[el.name] = el.value;
    }

    for (const el of form.querySelectorAll('input[type="checkbox"]')) {
      if (el.name) payload[el.name] = el.checked;
    }

    // Include pipeline
    payload.pipelineSteps = pipelineSteps;

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Save failed');
      }

      feedback.textContent = '✔ Settings saved!';
      feedback.className = 'feedback success';
      apiKeyInput.dataset.masked = 'false';
    } catch (err) {
      feedback.textContent = `✖ ${err.message}`;
      feedback.className = 'feedback error';
    } finally {
      saveBtn.disabled = false;
    }
  });

  // ── Save pipeline ──
  savePipelineBtn.addEventListener('click', async () => {
    savePipelineBtn.disabled = true;
    pipelineFeedback.textContent = 'Saving...';
    pipelineFeedback.className = 'feedback';

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineSteps }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      pipelineFeedback.textContent = '✔ Pipeline saved!';
      pipelineFeedback.className = 'feedback success';
    } catch (err) {
      pipelineFeedback.textContent = `✖ ${err.message}`;
      pipelineFeedback.className = 'feedback error';
    } finally {
      savePipelineBtn.disabled = false;
    }
  });

  // ── Run pipeline ──
  runPipelineBtn.addEventListener('click', async () => {
    runPipelineBtn.disabled = true;
    runPipelineBtn.textContent = '⏳ Running…';
    pipelineFeedback.textContent = 'Started — check your terminal for output';
    pipelineFeedback.className = 'feedback';

    try {
      await fetch('/api/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    } catch (err) {
      pipelineFeedback.textContent = `✖ ${err.message}`;
      pipelineFeedback.className = 'feedback error';
    } finally {
      runPipelineBtn.disabled = false;
      runPipelineBtn.textContent = '▶ Run Pipeline';
    }
  });

  // ── Palette buttons: add step ──
  document.querySelectorAll('.palette-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const step = btn.dataset.step;
      if (!step) return;
      // Don't add duplicates
      if (pipelineSteps.some((s) => s.step === step)) {
        pipelineFeedback.textContent = `⚠ "${STEP_META[step]?.label || step}" is already in the pipeline`;
        pipelineFeedback.className = 'feedback error';
        return;
      }
      pipelineSteps.push({ step, mode: 'auto', config: {} });
      renderPipeline();
      pipelineFeedback.textContent = `➕ Added ${STEP_META[step]?.label || step}`;
      pipelineFeedback.className = 'feedback success';
    });
  });

  // ── Load on start ──
  await loadConfig();
});

// ── Pipeline rendering ──

function renderPipeline() {
  pipelineList.innerHTML = '';

  if (pipelineSteps.length === 0) {
    pipelineList.classList.add('pipeline-dropzone--empty');
    pipelineList.innerHTML =
      '<div class="pipeline-empty">No steps yet. Click a step above to add it.</div>';
    return;
  }

  pipelineList.classList.remove('pipeline-dropzone--empty');

  pipelineSteps.forEach((step, index) => {
    const meta = STEP_META[step.step] || { icon: '❓', label: step.step };
    const card = document.createElement('div');
    card.className = 'pipeline-card';
    card.draggable = true;
    card.dataset.index = index;

    // ── Drag events ──
    card.addEventListener('dragstart', (e) => {
      dragSrcIndex = index;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', index);
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.pipeline-card.drag-over').forEach((c) => c.classList.remove('drag-over'));
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('.pipeline-card.drag-over').forEach((c) => c.classList.remove('drag-over'));
      card.classList.add('drag-over');
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over');
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
      if (fromIndex === index) return;
      moveStep(fromIndex, index);
    });

    // ── Card content ──
    card.innerHTML = `
      <span class="pipeline-card-drag">⠿</span>
      <span class="pipeline-card-icon">${meta.icon}</span>
      <span class="pipeline-card-name">${meta.label}</span>
      <select class="pipeline-card-mode">
        <option value="auto" ${step.mode === 'auto' ? 'selected' : ''}>Auto</option>
        <option value="manual" ${step.mode === 'manual' ? 'selected' : ''}>Manual</option>
      </select>
      <button class="pipeline-card-remove" title="Remove step">✕</button>
    `;

    // ── Mode change ──
    card.querySelector('.pipeline-card-mode').addEventListener('change', (e) => {
      pipelineSteps[index].mode = e.target.value;
    });

    // ── Remove ──
    card.querySelector('.pipeline-card-remove').addEventListener('click', () => {
      pipelineSteps.splice(index, 1);
      renderPipeline();
    });

    pipelineList.appendChild(card);
  });
}

function moveStep(from, to) {
  const [item] = pipelineSteps.splice(from, 1);
  pipelineSteps.splice(to, 0, item);
  renderPipeline();
}

function getDefaultPipeline() {
  return [
    { step: 'add', mode: 'auto', config: { files: '.' } },
    { step: 'secrets-scan', mode: 'auto' },
    { step: 'commit', mode: 'manual' },
    { step: 'precheck', mode: 'auto' },
    { step: 'push', mode: 'manual' },
  ];
}
