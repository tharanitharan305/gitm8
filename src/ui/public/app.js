document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('config-form');
  const saveBtn = document.getElementById('save-btn');
  const feedback = document.getElementById('save-feedback');
  const toggleKeyBtn = document.getElementById('toggle-key');
  const apiKeyInput = document.getElementById('apiKey');
  const toneSelect = document.getElementById('tone');
  const customToneField = document.getElementById('custom-tone-field');

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
        } else if (el.type === 'checkbox') {
          el.checked = value === true || value === 'true';
        } else {
          el.value = value ?? '';
        }
      }

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

    // Text inputs
    for (const el of form.querySelectorAll('input:not([type="checkbox"]), select, textarea')) {
      if (el.name) payload[el.name] = el.value;
    }

    // Checkboxes (explicitly send true/false)
    for (const el of form.querySelectorAll('input[type="checkbox"]')) {
      if (el.name) payload[el.name] = el.checked;
    }

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

      // Clear masked flag so we don't re-mask what user typed
      apiKeyInput.dataset.masked = 'false';
    } catch (err) {
      feedback.textContent = `✖ ${err.message}`;
      feedback.className = 'feedback error';
    } finally {
      saveBtn.disabled = false;
    }
  });

  // ── Load on start ──
  await loadConfig();
});
