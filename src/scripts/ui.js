document.getElementById('btn-minimize').addEventListener('click', () => {
  window.shellAPI.minimize();
});

document.getElementById('btn-close').addEventListener('click', () => {
  window.shellAPI.close();
});

// ---------- Transport buttons ----------
document.getElementById('btn-play').addEventListener('click', play);
document.getElementById('btn-pause').addEventListener('click', pause);
document.getElementById('btn-stop').addEventListener('click', stop);
document.getElementById('btn-next').addEventListener('click', next);
document.getElementById('btn-prev').addEventListener('click', previous);

// ---------- Shuffle / Repeat ----------
const btnRepeat = document.getElementById('btn-repeat');
const btnShuffle = document.getElementById('btn-shuffle');

btnRepeat.classList.toggle('active', repeatEnabled);
btnShuffle.classList.toggle('active', shuffleEnabled);

btnRepeat.addEventListener('click', () => {
  repeatEnabled = !repeatEnabled;
  btnRepeat.classList.toggle('active', repeatEnabled);
});

btnShuffle.addEventListener('click', () => {
  setShuffleEnabled(!shuffleEnabled);
  btnShuffle.classList.toggle('active', shuffleEnabled);
});

// Small round Options button next to the seek bar - opens the same
// Shuffle/Repeat menu as the "Options" menubar item.
document.getElementById('btn-options-toggle').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('menu-options').click();
});

// ---------- Menu bar dropdowns ----------
const allMenuDropdowns = [];

function wireMenuDropdown(triggerId, dropdownId, onOpen) {
  const trigger = document.getElementById(triggerId);
  const dropdown = document.getElementById(dropdownId);
  allMenuDropdowns.push(dropdown);

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const opening = !dropdown.classList.contains('open');
    allMenuDropdowns.forEach((d) => d.classList.remove('open'));
    if (opening) {
      dropdown.classList.add('open');
      if (onOpen) onOpen();
    }
  });
}

document.addEventListener('click', () => {
  allMenuDropdowns.forEach((d) => d.classList.remove('open'));
});

wireMenuDropdown('menu-file', 'menu-file-dropdown');
wireMenuDropdown('menu-play', 'menu-play-dropdown');
wireMenuDropdown('menu-options', 'menu-options-dropdown', () => {
  document.getElementById('menu-toggle-shuffle').classList.toggle('checked', shuffleEnabled);
  document.getElementById('menu-toggle-repeat').classList.toggle('checked', repeatEnabled);
});
wireMenuDropdown('menu-view', 'menu-view-dropdown', () => {
  document.getElementById('menu-toggle-library').classList.toggle('checked', libraryPanelOpen);
  document.getElementById('menu-toggle-playlist').classList.toggle('checked', playlistPanelOpen);
});
wireMenuDropdown('menu-help', 'menu-help-dropdown');

async function openFileDialog() {
  const filePaths = await window.shellAPI.openFiles();
  openFilePaths(filePaths);
}

document.getElementById('menu-open-files').addEventListener('click', openFileDialog);
document.getElementById('btn-eject').addEventListener('click', openFileDialog);

// ---------- Play menu ----------
document.getElementById('menu-play-play').addEventListener('click', play);
document.getElementById('menu-play-pause').addEventListener('click', pause);
document.getElementById('menu-play-stop').addEventListener('click', stop);
document.getElementById('menu-play-previous').addEventListener('click', previous);
document.getElementById('menu-play-next').addEventListener('click', next);

// ---------- Options menu ----------
document.getElementById('menu-toggle-shuffle').addEventListener('click', () => btnShuffle.click());
document.getElementById('menu-toggle-repeat').addEventListener('click', () => btnRepeat.click());

// ---------- View menu ----------
document.getElementById('menu-toggle-library').addEventListener('click', () => {
  document.getElementById('btn-media-library').click();
});
document.getElementById('menu-toggle-playlist').addEventListener('click', () => {
  document.getElementById('btn-playlist').click();
});
document.getElementById('menu-color-themes').addEventListener('click', () => {
  document.getElementById('eq-tab-color-themes').click();
});

// ---------- Help menu ----------
document.getElementById('menu-about').addEventListener('click', () => {
  document.getElementById('about-modal').classList.add('open');
});
document.getElementById('about-modal-close').addEventListener('click', () => {
  document.getElementById('about-modal').classList.remove('open');
});

document.getElementById('about-modal').addEventListener('click', (e) => {
  if (e.target.id === 'about-modal') {
    document.getElementById('about-modal').classList.remove('open');
  }
});

// ---------- Drag and drop ----------
const shell = document.querySelector('.app-shell');

['dragenter', 'dragover'].forEach((eventName) => {
  document.addEventListener(eventName, (e) => {
    e.preventDefault();
    shell.classList.add('drag-active');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  document.addEventListener(eventName, (e) => {
    e.preventDefault();
    shell.classList.remove('drag-active');
  });
});

document.addEventListener('drop', (e) => {
  const files = [...e.dataTransfer.files];
  const filePaths = files.map((file) => window.shellAPI.getPathForFile(file));
  openFilePaths(filePaths);
});

// ---------- Seek bar ----------
const seekBar = document.getElementById('seek-bar');

function fractionFromEvent(track, e) {
  const rect = track.getBoundingClientRect();
  return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
}

seekBar.addEventListener('mousedown', (e) => {
  isSeeking = true;
  seekTo(fractionFromEvent(seekBar, e));

  function onMouseMove(moveEvent) {
    updateSeekVisual(fractionFromEvent(seekBar, moveEvent));
  }

  function onMouseUp(upEvent) {
    seekTo(fractionFromEvent(seekBar, upEvent));
    isSeeking = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
});

const SEEK_KEY_STEP_SECONDS = 5;

seekBar.addEventListener('keydown', (e) => {
  if (!isFinite(audioElement.duration) || audioElement.duration <= 0) return;
  let nextTime = null;

  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') nextTime = audioElement.currentTime + SEEK_KEY_STEP_SECONDS;
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') nextTime = audioElement.currentTime - SEEK_KEY_STEP_SECONDS;
  else if (e.key === 'Home') nextTime = 0;
  else if (e.key === 'End') nextTime = audioElement.duration;
  else return;

  e.preventDefault();
  nextTime = Math.min(audioElement.duration, Math.max(0, nextTime));
  seekTo(nextTime / audioElement.duration);
  updateSeekVisual(nextTime / audioElement.duration);
});

// ---------- Volume slider ----------
const volumeSlider = document.getElementById('volume-slider');
const volumeHandle = document.getElementById('volume-handle');
let volumeFraction = 1;

function setVolumeFraction(fraction) {
  volumeFraction = Math.min(1, Math.max(0, fraction));
  volumeHandle.style.left = `${volumeFraction * 100}%`;
  volumeSlider.setAttribute('aria-valuenow', Math.round(volumeFraction * 100));
  audioElement.volume = volumeFraction;
}

function saveVolumeSetting() {
  window.settingsAPI.save({ volume: volumeFraction });
}

volumeSlider.addEventListener('mousedown', (e) => {
  setVolumeFraction(fractionFromEvent(volumeSlider, e));

  function onMouseMove(moveEvent) {
    setVolumeFraction(fractionFromEvent(volumeSlider, moveEvent));
  }

  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    saveVolumeSetting();
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
});

document.getElementById('btn-volume-reset').addEventListener('click', () => {
  setVolumeFraction(1);
  saveVolumeSetting();
});

setVolumeFraction(1);

// ---------- Keyboard volume control (mimics a system volume control:
// Up/Down arrows anywhere in the window nudge volume) ----------
const VOLUME_KEY_STEP = 0.05;

document.addEventListener('keydown', (e) => {
  const active = document.activeElement;
  const activeTag = active?.tagName;
  if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
  if (active?.classList?.contains('library-table-wrapper')) return; // let it scroll natively
  // Other custom sliders (EQ bands, preamp, seek bar) handle their own arrow
  // keys while focused - don't also nudge volume out from under them.
  if (active?.getAttribute?.('role') === 'slider' && active !== volumeSlider) return;

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    setVolumeFraction(volumeFraction + VOLUME_KEY_STEP);
    saveVolumeSetting();
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    setVolumeFraction(volumeFraction - VOLUME_KEY_STEP);
    saveVolumeSetting();
  }
});

// ---------- Marquee scroll ----------
const trackTitleContainer = document.getElementById('track-title');
let marqueeOffset = 0;
let lastMarqueeTime = 0;
const MARQUEE_SPEED = 40; // px per second
const MARQUEE_GAP = 40; // px of blank space between loops

function marqueeStep(timestamp) {
  if (!lastMarqueeTime) lastMarqueeTime = timestamp;
  const delta = (timestamp - lastMarqueeTime) / 1000;
  lastMarqueeTime = timestamp;

  const textWidth = trackTitleText.scrollWidth;
  const containerWidth = trackTitleContainer.clientWidth;

  if (textWidth > containerWidth) {
    marqueeOffset += MARQUEE_SPEED * delta;
    if (marqueeOffset > textWidth + MARQUEE_GAP) marqueeOffset = 0;
    trackTitleText.style.transform = `translateX(${-marqueeOffset}px)`;
  } else {
    marqueeOffset = 0;
    trackTitleText.style.transform = 'translateX(0)';
  }

  requestAnimationFrame(marqueeStep);
}

requestAnimationFrame(marqueeStep);

// ---------- Restore persisted volume + EQ settings from a previous session
// on this machine (settings live in this machine's local app-data folder,
// so a fresh install on another machine naturally starts at the defaults) ----------
(async () => {
  const saved = await window.settingsAPI.load();
  if (!saved) return;

  if (typeof saved.volume === 'number') {
    setVolumeFraction(saved.volume);
  }

  if (typeof saved.eqEnabled === 'boolean') {
    eqEnabledUi = saved.eqEnabled;
    eqOnBtn.classList.toggle('active', eqEnabledUi);
    audioEngine.setEnabled(eqEnabledUi);
  }

  if (typeof saved.autoEnabled === 'boolean') {
    document.getElementById('eq-auto').classList.toggle('active', saved.autoEnabled);
  }

  if (typeof saved.preampDb === 'number') {
    setSliderPosition(preampTrack, preampHandle, fractionFromDb(saved.preampDb));
    audioEngine.setPreampGain(saved.preampDb);
  }

  if (Array.isArray(saved.bandGains)) {
    bandSliders.forEach(({ index, track, handle }) => {
      const db = saved.bandGains[index];
      if (typeof db === 'number') {
        setSliderPosition(track, handle, fractionFromDb(db));
        audioEngine.setBandGain(index, db);
      }
    });
  }
})();
