const audioElement = document.getElementById('audio-player');

const lcdTime = document.getElementById('lcd-time');
const lcdKbps = document.getElementById('lcd-kbps');
const lcdKhz = document.getElementById('lcd-khz');
const lcdChannels = document.getElementById('lcd-channels');
const lcdPlayIcon = document.getElementById('lcd-play-icon');
const trackTitleText = document.getElementById('track-title-text');
const seekFill = document.getElementById('seek-fill');
const seekHandle = document.getElementById('seek-handle');
const seekBarEl = document.getElementById('seek-bar');

function updateSeekVisual(fraction) {
  seekFill.style.width = `${fraction * 100}%`;
  seekHandle.style.left = `${fraction * 100}%`;
  seekBarEl.setAttribute('aria-valuenow', Math.round(fraction * 100));
}

const playlist = [];
let currentIndex = -1;
let isSeeking = false;
let shuffleEnabled = false;
let repeatEnabled = true;
let originalPlaylistOrder = null; // set while shuffled, so toggling shuffle off can restore order

function shuffleArrayInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// Shuffling actually reorders the playlist itself (like classic MP3 players) so
// next()/previous() can just walk it sequentially - every track plays once
// before any repeat, and the playlist panel visibly shows the play order.
function setShuffleEnabled(enabled) {
  if (enabled === shuffleEnabled) return;
  shuffleEnabled = enabled;
  const currentTrack = currentIndex >= 0 ? playlist[currentIndex] : null;

  if (enabled) {
    originalPlaylistOrder = [...playlist];
    shuffleArrayInPlace(playlist);
  } else if (originalPlaylistOrder) {
    // Preserve tracks added/removed while shuffled instead of just
    // clobbering them with the stale pre-shuffle snapshot.
    const stillPresent = originalPlaylistOrder.filter((t) => playlist.includes(t));
    const addedSinceShuffle = playlist.filter((t) => !originalPlaylistOrder.includes(t));
    playlist.length = 0;
    playlist.push(...stillPresent, ...addedSinceShuffle);
    originalPlaylistOrder = null;
  }

  if (currentTrack) currentIndex = playlist.indexOf(currentTrack);
  refreshPlaylistView();
}

function refreshPlaylistView() {
  if (typeof renderPlaylist === 'function') renderPlaylist();
}

// Lighter-weight than refreshPlaylistView(): used when only the current-track
// pointer changes (every track change during normal playback) rather than
// the playlist's contents/order, so it just patches the highlighted row.
function refreshPlayingHighlight() {
  if (typeof updatePlayingHighlight === 'function') updatePlayingHighlight();
}

function savePlaylistToDisk() {
  window.playlistAPI.save(playlist.map((t) => t.path));
}

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function setPlayState(state) {
  lcdPlayIcon.classList.remove('state-paused', 'state-stopped', 'state-loading');
  if (state === 'paused') lcdPlayIcon.classList.add('state-paused');
  if (state === 'stopped') lcdPlayIcon.classList.add('state-stopped');
  if (state === 'loading') lcdPlayIcon.classList.add('state-loading');
}

async function loadTrack(index) {
  if (index < 0 || index >= playlist.length) return;
  currentIndex = index;
  refreshPlayingHighlight();
  const track = playlist[currentIndex];

  audioElement.src = track.url;

  trackTitleText.textContent = track.name;
  lcdKbps.textContent = '--';
  lcdKhz.textContent = '--';
  lcdChannels.textContent = '--';
  lcdTime.textContent = '--:--';
  setPlayState('loading');
  updateSeekVisual(0);

  const metadata = await window.shellAPI.getMetadata(track.path);
  if (currentIndex !== index) return; // track changed while metadata was loading

  if (metadata.bitrate) lcdKbps.textContent = String(Math.round(metadata.bitrate / 1000));
  if (metadata.sampleRate) lcdKhz.textContent = String(Math.round(metadata.sampleRate / 1000));
  if (metadata.numberOfChannels) {
    lcdChannels.textContent = metadata.numberOfChannels >= 2 ? 'STEREO' : 'MONO';
  }
  if (metadata.title) {
    const label = metadata.artist ? `${metadata.artist} - ${metadata.title}` : metadata.title;
    trackTitleText.textContent = label;
  }
}

function play() {
  if (currentIndex === -1 && playlist.length > 0) {
    loadTrack(0);
  }
  if (audioElement.src) {
    audioEngine.resume();
    audioElement.play().catch((err) => {
      console.error('Playback failed to start:', err);
      setPlayState('stopped');
    });
  }
}

function pause() {
  audioElement.pause();
  setPlayState('paused');
}

function stop() {
  audioElement.pause();
  audioElement.currentTime = 0;
  setPlayState('stopped');
}

function next() {
  if (playlist.length === 0) return;
  // audioElement.paused is already true by the time a track naturally ends
  // (the 'ended' event fires after playback stops) - check .ended too so
  // auto-advance keeps playing instead of loading the next track and sitting
  // there paused until the user clicks play again.
  const wasPlaying = !audioElement.paused || audioElement.ended;
  const nextIndex = (currentIndex + 1) % playlist.length;
  loadTrack(nextIndex);
  if (wasPlaying) play();
}

function previous() {
  if (playlist.length === 0) return;
  const wasPlaying = !audioElement.paused || audioElement.ended;
  loadTrack((currentIndex - 1 + playlist.length) % playlist.length);
  if (wasPlaying) play();
}

function seekTo(fraction) {
  if (!isFinite(audioElement.duration)) return;
  audioElement.currentTime = fraction * audioElement.duration;
}

function addTracksToPlaylist(filePaths) {
  const startIndex = playlist.length;
  for (const filePath of filePaths) {
    const name = filePath.split(/[\\/]/).pop();
    playlist.push({ path: filePath, url: window.shellAPI.pathToFileURL(filePath), name });
  }
  savePlaylistToDisk();
  refreshPlaylistView();
  return startIndex;
}

function clearNowPlayingDisplay() {
  trackTitleText.textContent = 'No file loaded';
  lcdKbps.textContent = '--';
  lcdKhz.textContent = '--';
  lcdChannels.textContent = '--';
  lcdTime.textContent = '0:00';
  updateSeekVisual(0);
}

function playAtIndex(index) {
  if (index < 0 || index >= playlist.length) return;
  loadTrack(index);
  play();
}

function removeFromPlaylist(index) {
  if (index < 0 || index >= playlist.length) return;
  playlist.splice(index, 1);
  if (index === currentIndex) {
    stop();
    audioElement.removeAttribute('src');
    currentIndex = -1;
    setPlayState('stopped');
    clearNowPlayingDisplay();
  } else if (index < currentIndex) {
    currentIndex -= 1;
  }
  savePlaylistToDisk();
  refreshPlaylistView();
}

function reorderPlaylist(fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= playlist.length) return;
  const [item] = playlist.splice(fromIndex, 1);
  playlist.splice(toIndex, 0, item);

  if (currentIndex === fromIndex) {
    currentIndex = toIndex;
  } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
    currentIndex -= 1;
  } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
    currentIndex += 1;
  }
  savePlaylistToDisk();
  refreshPlaylistView();
}

function clearPlaylist() {
  playlist.length = 0;
  stop();
  audioElement.removeAttribute('src');
  currentIndex = -1;
  setPlayState('stopped');
  clearNowPlayingDisplay();
  savePlaylistToDisk();
  refreshPlaylistView();
}

async function loadPersistedPlaylist() {
  const paths = await window.playlistAPI.load();
  if (paths.length > 0) addTracksToPlaylist(paths);
}

loadPersistedPlaylist();

function openFilePaths(filePaths) {
  if (filePaths.length === 0) return;
  const wasEmpty = playlist.length === 0;
  addTracksToPlaylist(filePaths);
  if (wasEmpty) {
    loadTrack(0);
    play();
  }
}

function addFromLibrary(filePaths) {
  if (filePaths.length === 0) return;
  addTracksToPlaylist(filePaths);
}

function playTrackNow(filePath) {
  const startIndex = addTracksToPlaylist([filePath]);
  loadTrack(startIndex);
  play();
}

audioElement.addEventListener('timeupdate', () => {
  if (isSeeking) return;
  lcdTime.textContent = formatTime(audioElement.currentTime);
  if (isFinite(audioElement.duration) && audioElement.duration > 0) {
    updateSeekVisual(audioElement.currentTime / audioElement.duration);
  }
});

audioElement.addEventListener('waiting', () => setPlayState('loading'));
audioElement.addEventListener('playing', () => setPlayState('playing'));
audioElement.addEventListener('pause', () => {
  if (!audioElement.ended) setPlayState('paused');
});
audioElement.addEventListener('ended', () => {
  if (!repeatEnabled && currentIndex === playlist.length - 1) {
    stop();
    return;
  }
  next();
});

const MEDIA_ERROR_NAMES = {
  1: 'MEDIA_ERR_ABORTED',
  2: 'MEDIA_ERR_NETWORK',
  3: 'MEDIA_ERR_DECODE',
  4: 'MEDIA_ERR_SRC_NOT_SUPPORTED',
};

audioElement.addEventListener('error', () => {
  const error = audioElement.error;
  const name = error ? MEDIA_ERROR_NAMES[error.code] || `code ${error.code}` : 'unknown';
  console.error('Audio element error:', name, 'src:', audioElement.currentSrc);
  trackTitleText.textContent = `Error playing file (${name})`;
  setPlayState('stopped');
});
