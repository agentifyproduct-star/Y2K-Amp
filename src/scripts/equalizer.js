const EQ_MIN_DB = -12;
const EQ_MAX_DB = 12;

function dbFromFraction(fraction) {
  return EQ_MAX_DB - fraction * (EQ_MAX_DB - EQ_MIN_DB);
}

function fractionFromDb(db) {
  return (EQ_MAX_DB - db) / (EQ_MAX_DB - EQ_MIN_DB);
}

function verticalFractionFromEvent(track, e) {
  const rect = track.getBoundingClientRect();
  return Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
}

function setSliderPosition(track, handle, fraction) {
  handle.style.top = `${fraction * 100}%`;
  track.setAttribute('aria-valuenow', Math.round(dbFromFraction(fraction) * 10) / 10);
}

const EQ_KEY_STEP_DB = 1;

function wireVerticalSlider(track, handle, onChange, onCommit) {
  track.addEventListener('mousedown', (e) => {
    updateFromEvent(e);

    function updateFromEvent(event) {
      const fraction = verticalFractionFromEvent(track, event);
      setSliderPosition(track, handle, fraction);
      onChange(dbFromFraction(fraction));
    }

    function onMouseMove(moveEvent) {
      updateFromEvent(moveEvent);
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (onCommit) onCommit();
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  track.addEventListener('keydown', (e) => {
    const currentDb = dbFromFraction(parseFloat(handle.style.top) / 100);
    let nextDb = null;

    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') nextDb = currentDb + EQ_KEY_STEP_DB;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') nextDb = currentDb - EQ_KEY_STEP_DB;
    else if (e.key === 'Home') nextDb = EQ_MAX_DB;
    else if (e.key === 'End') nextDb = EQ_MIN_DB;
    else return;

    e.preventDefault();
    nextDb = Math.min(EQ_MAX_DB, Math.max(EQ_MIN_DB, nextDb));
    setSliderPosition(track, handle, fractionFromDb(nextDb));
    onChange(nextDb);
    if (onCommit) onCommit();
  });
}

const bandSliders = [...document.querySelectorAll('[data-band-index]')].map((track) => ({
  index: Number(track.dataset.bandIndex),
  track,
  handle: track.querySelector('.eq-slider-handle'),
}));

function saveEqSettings() {
  const bandGains = bandSliders.map(({ handle }) => dbFromFraction(parseFloat(handle.style.top) / 100));
  const preampDb = dbFromFraction(parseFloat(preampHandle.style.top) / 100);
  window.settingsAPI.save({
    eqEnabled: eqEnabledUi,
    autoEnabled: document.getElementById('eq-auto').classList.contains('active'),
    preampDb,
    bandGains,
  });
}

bandSliders.forEach(({ index, track, handle }) => {
  wireVerticalSlider(track, handle, (db) => audioEngine.setBandGain(index, db), saveEqSettings);
});

const preampTrack = document.getElementById('preamp-slider');
const preampHandle = preampTrack.querySelector('.eq-slider-handle');
wireVerticalSlider(preampTrack, preampHandle, (db) => audioEngine.setPreampGain(db), saveEqSettings);

// ---------- ON toggle ----------
const eqOnBtn = document.getElementById('eq-on');
let eqEnabledUi = true;

eqOnBtn.addEventListener('click', () => {
  eqEnabledUi = !eqEnabledUi;
  eqOnBtn.classList.toggle('active', eqEnabledUi);
  audioEngine.setEnabled(eqEnabledUi);
  saveEqSettings();
});

// ---------- AUTO toggle (visual only - stretch goal per spec) ----------
document.getElementById('eq-auto').addEventListener('click', (e) => {
  e.currentTarget.classList.toggle('active');
  saveEqSettings();
});

// ---------- Presets ----------
const PRESETS = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  Rock: [5, 4, -3, -5, -2, 2, 5, 6, 6, 6],
  Pop: [-2, -1, 2, 4, 5, 3, -1, -2, -2, -3],
  Jazz: [3, 2, 1, 2, -2, -2, 0, 1, 2, 3],
  Classical: [4, 3, 2, 0, 0, 0, -2, -2, -2, 4],
  BassBoost: [8, 6, 4, 2, 0, 0, 0, 0, 0, 0],
  TrebleBoost: [0, 0, 0, 0, 0, 1, 3, 5, 6, 7],
};

function applyPreset(name) {
  const gains = PRESETS[name];
  if (!gains) return;
  bandSliders.forEach(({ index, track, handle }) => {
    const db = gains[index];
    setSliderPosition(track, handle, fractionFromDb(db));
    audioEngine.setBandGain(index, db);
  });
  saveEqSettings();
}

const presetsBtn = document.getElementById('eq-presets');
const presetsDropdown = document.getElementById('eq-presets-dropdown');

presetsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  presetsDropdown.classList.toggle('open');
});

document.addEventListener('click', () => {
  presetsDropdown.classList.remove('open');
});

presetsDropdown.querySelectorAll('.menu-dropdown-item').forEach((item) => {
  item.addEventListener('click', () => applyPreset(item.dataset.preset));
});
