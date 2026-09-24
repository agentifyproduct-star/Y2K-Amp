const THEME_VARIABLES = [
  '--panel-bg-top', '--panel-bg-bottom', '--panel-border',
  '--header-bg-1', '--header-bg-2', '--header-bg-3', '--header-text',
  '--strip-bg-1', '--strip-bg-2', '--strip-border', '--strip-text',
  '--btn-bg-1', '--btn-bg-2', '--btn-bg-3', '--btn-border', '--btn-text', '--btn-hover-1', '--btn-hover-2',
  '--track-bg-1', '--track-bg-2', '--track-border',
  '--handle-bg-1', '--handle-bg-2', '--handle-border',
  '--divider',
  '--accent-1', '--accent-2', '--accent-solid', '--accent-light', '--accent-highlight', '--selected-text',
  '--text-primary', '--text-secondary', '--text-muted', '--text-faint',
  '--input-bg', '--input-border', '--input-placeholder',
  '--table-bg', '--table-row-even', '--table-row-hover',
  '--dropdown-bg', '--dropdown-border',
];

const BUILTIN_THEMES = ['dark', 'classic', 'amber', 'llama', 'jedi', 'matrix'];

function clearCustomOverrides() {
  for (const varName of THEME_VARIABLES) {
    document.documentElement.style.removeProperty(varName);
  }
}

function updateThemeOptionSelection(name) {
  document.querySelectorAll('.theme-option').forEach((el) => {
    el.classList.toggle('selected', el.dataset.theme === name);
  });
}

function setBuiltinTheme(name, skipSave) {
  clearCustomOverrides();
  document.body.classList.remove(...BUILTIN_THEMES.map((t) => `theme-${t}`), 'theme-custom');
  document.body.classList.add(`theme-${name}`);
  updateThemeOptionSelection(name);
  if (!skipSave) window.themeAPI.save({ name });
}

const MAX_THEME_VALUE_LENGTH = 300;

function isValidThemeValue(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_THEME_VALUE_LENGTH && !/[\n\r]/.test(value);
}

function setCustomTheme(variables, skipSave) {
  document.body.classList.remove(...BUILTIN_THEMES.map((t) => `theme-${t}`), 'theme-custom');
  document.body.classList.add('theme-custom');
  for (const [key, value] of Object.entries(variables)) {
    if (THEME_VARIABLES.includes(key) && isValidThemeValue(value)) {
      document.documentElement.style.setProperty(key, value);
    }
  }
  updateThemeOptionSelection('custom');
  if (!skipSave) window.themeAPI.save({ name: 'custom', variables });
}

function exportCurrentTheme() {
  const computed = getComputedStyle(document.documentElement);
  const values = {};
  for (const varName of THEME_VARIABLES) {
    values[varName] = computed.getPropertyValue(varName).trim();
  }
  window.themeAPI.saveThemeFile(values);
}

// ---------- Wiring ----------
document.querySelectorAll('.theme-option').forEach((option) => {
  option.addEventListener('click', () => setBuiltinTheme(option.dataset.theme));
});

document.getElementById('theme-btn-load-custom').addEventListener('click', async () => {
  const variables = await window.themeAPI.openThemeFile();
  if (variables === false) return; // user cancelled the file picker
  if (variables === null) {
    alert('That file could not be loaded as a Y2K Amp theme. Make sure it\'s a valid theme JSON file.');
    return;
  }
  setCustomTheme(variables);
});

document.getElementById('theme-btn-export').addEventListener('click', exportCurrentTheme);

const themeModal = document.getElementById('theme-modal');

document.getElementById('eq-tab-color-themes').addEventListener('click', () => {
  themeModal.classList.add('open');
});

document.getElementById('theme-modal-close').addEventListener('click', () => {
  themeModal.classList.remove('open');
});

themeModal.addEventListener('click', (e) => {
  if (e.target.id === 'theme-modal') themeModal.classList.remove('open');
});

// ---------- Load persisted theme on startup ----------
(async () => {
  const saved = await window.themeAPI.load();
  if (saved && saved.name === 'custom' && saved.variables) {
    setCustomTheme(saved.variables, true);
  } else if (saved && BUILTIN_THEMES.includes(saved.name)) {
    setBuiltinTheme(saved.name, true);
  } else {
    setBuiltinTheme('dark', true);
  }
})();
