function renderPlaylist() {
  const list = document.getElementById('playlist-list');
  list.innerHTML = '';

  playlist.forEach((track, index) => {
    const li = document.createElement('li');
    li.className = 'playlist-item';
    li.draggable = true;
    li.dataset.index = String(index);
    if (index === currentIndex) li.classList.add('playing');

    const indexSpan = document.createElement('span');
    indexSpan.className = 'playlist-item-index';
    indexSpan.textContent = `${index + 1}.`;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'playlist-item-name';
    nameSpan.textContent = track.name;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'playlist-item-remove';
    removeBtn.title = 'Remove from Playlist';
    removeBtn.textContent = '✕';

    li.appendChild(indexSpan);
    li.appendChild(nameSpan);
    li.appendChild(removeBtn);

    li.addEventListener('dblclick', () => playAtIndex(index));

    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeFromPlaylist(index);
    });

    li.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', String(index));
      e.dataTransfer.effectAllowed = 'move';
      li.classList.add('dragging');
    });
    li.addEventListener('dragend', () => li.classList.remove('dragging'));
    li.addEventListener('dragover', (e) => {
      e.preventDefault();
      li.classList.add('drag-over');
    });
    li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      li.classList.remove('drag-over');
      const fromIndex = Number(e.dataTransfer.getData('text/plain'));
      reorderPlaylist(fromIndex, index);
    });

    list.appendChild(li);
  });

  document.getElementById('pl-empty-state').style.display = playlist.length === 0 ? 'block' : 'none';
  const statusBar = document.getElementById('pl-status-bar');
  statusBar.textContent = `${playlist.length} track${playlist.length === 1 ? '' : 's'}`;
}

// Called when only the current-track pointer moves (e.g. every track change
// during normal playback) - the list itself hasn't changed, so just move the
// .playing class instead of tearing down and rebuilding every <li>.
function updatePlayingHighlight() {
  const list = document.getElementById('playlist-list');
  list.querySelectorAll('.playlist-item').forEach((li) => {
    li.classList.toggle('playing', Number(li.dataset.index) === currentIndex);
  });
}

// ---------- Toolbar ----------
document.getElementById('pl-btn-add-files').addEventListener('click', () => {
  openFileDialog();
});

document.getElementById('pl-btn-clear').addEventListener('click', () => {
  clearPlaylist();
});

// ---------- Panel open/close ----------
const playlistPanel = document.getElementById('playlist-panel');
let playlistPanelOpen = false;

function openPlaylistPanel() {
  if (typeof libraryPanelOpen !== 'undefined' && libraryPanelOpen) closeLibraryPanel();
  playlistPanelOpen = true;
  playlistPanel.classList.add('open');
  window.shellAPI.toggleDockPanel(true);
  renderPlaylist();
}

function closePlaylistPanel() {
  playlistPanelOpen = false;
  playlistPanel.classList.remove('open');
  window.shellAPI.toggleDockPanel(false);
}

document.getElementById('btn-playlist').addEventListener('click', () => {
  if (playlistPanelOpen) closePlaylistPanel();
  else openPlaylistPanel();
});
