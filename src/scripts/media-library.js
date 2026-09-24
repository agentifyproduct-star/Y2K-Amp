let libraryEntries = [];
let searchQuery = '';
let manualSort = { field: 'title', direction: 'asc' };
let selectedIds = new Set();
let lastClickedIndex = null;
let rowElementsById = new Map();

function debounce(fn, delayMs) {
  let timeoutId = null;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delayMs);
  };
}

function formatLength(seconds) {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatSize(bytes) {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / 1024 ** 2;
  return `${mb.toFixed(1)} MB`;
}

function applySort(entries) {
  const { field, direction } = manualSort;
  const sorted = [...entries].sort((a, b) => {
    let av = a[field];
    let bv = b[field];
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    if (av == null) av = '';
    if (bv == null) bv = '';
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
  });
  return direction === 'desc' ? sorted.reverse() : sorted;
}

function applySearch(entries) {
  if (!searchQuery) return entries;
  const q = searchQuery.toLowerCase();
  return entries.filter(
    (e) =>
      e.artist.toLowerCase().includes(q) ||
      e.album.toLowerCase().includes(q) ||
      e.title.toLowerCase().includes(q)
  );
}

function getVisibleEntries() {
  return applySort(applySearch(libraryEntries));
}

function updateStatusBar(entries) {
  const totalSeconds = entries.reduce((sum, e) => sum + (e.length || 0), 0);
  const totalBytes = entries.reduce((sum, e) => sum + (e.sizeBytes || 0), 0);
  const days = totalSeconds / 86400;
  const statusBar = document.getElementById('ml-status-bar');
  statusBar.textContent = `${entries.length} track${entries.length === 1 ? '' : 's'}, ${days.toFixed(1)} days, ${formatSize(totalBytes)}`;
}

function makeCell(text) {
  const td = document.createElement('td');
  td.textContent = text;
  return td;
}

function render() {
  const visibleEntries = getVisibleEntries();
  const tbody = document.getElementById('ml-library-rows');
  tbody.innerHTML = '';
  rowElementsById = new Map();

  visibleEntries.forEach((entry, index) => {
    const tr = document.createElement('tr');
    tr.dataset.id = entry.id;
    if (selectedIds.has(entry.id)) tr.classList.add('selected');

    tr.appendChild(makeCell(entry.title));
    tr.appendChild(makeCell(entry.album));
    tr.appendChild(makeCell(entry.artist));
    tr.appendChild(makeCell(formatLength(entry.length)));

    tr.addEventListener('click', (e) => handleRowClick(entry, index, e, visibleEntries));
    tr.addEventListener('dblclick', () => {
      playTrackNow(entry.filePath);
    });
    tr.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!selectedIds.has(entry.id)) {
        selectedIds = new Set([entry.id]);
        lastClickedIndex = index;
        applySelectionToDom();
      }
      showContextMenu(e.clientX, e.clientY);
    });

    rowElementsById.set(entry.id, tr);
    tbody.appendChild(tr);
  });

  document.getElementById('ml-empty-state').style.display = libraryEntries.length === 0 ? 'block' : 'none';
  updateStatusBar(visibleEntries);
}

// Toggling which rows are selected doesn't change the row set or its order,
// so just patch the .selected class on the existing elements rather than
// tearing down and rebuilding the whole table.
function applySelectionToDom() {
  rowElementsById.forEach((tr, id) => {
    tr.classList.toggle('selected', selectedIds.has(id));
  });
}

function handleRowClick(entry, index, event, visibleEntries) {
  if (event.shiftKey && lastClickedIndex !== null) {
    const [start, end] = [lastClickedIndex, index].sort((a, b) => a - b);
    selectedIds = new Set(visibleEntries.slice(start, end + 1).map((e) => e.id));
  } else if (event.ctrlKey || event.metaKey) {
    if (selectedIds.has(entry.id)) selectedIds.delete(entry.id);
    else selectedIds.add(entry.id);
    lastClickedIndex = index;
  } else {
    selectedIds = new Set([entry.id]);
    lastClickedIndex = index;
  }
  applySelectionToDom();
}

// ---------- Column sorting ----------
function updateSortIndicators() {
  document.querySelectorAll('.library-table th').forEach((th) => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.field === manualSort.field) {
      th.classList.add(manualSort.direction === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

document.querySelectorAll('.library-table th').forEach((th) => {
  th.addEventListener('click', () => {
    const field = th.dataset.field;
    if (manualSort.field === field) {
      manualSort.direction = manualSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      manualSort = { field, direction: 'asc' };
    }
    updateSortIndicators();
    render();
  });
});

updateSortIndicators();

// ---------- Search ----------
const mlSearchInput = document.getElementById('ml-search-input');
const debouncedSearchRender = debounce(() => render(), 200);
mlSearchInput.addEventListener('input', () => {
  searchQuery = mlSearchInput.value;
  debouncedSearchRender();
});

document.getElementById('ml-btn-clear-search').addEventListener('click', () => {
  mlSearchInput.value = '';
  searchQuery = '';
  render();
});

// ---------- Context menu ----------
const mlContextMenu = document.getElementById('ml-context-menu');

function showContextMenu(x, y) {
  mlContextMenu.style.left = `${x}px`;
  mlContextMenu.style.top = `${y}px`;
  mlContextMenu.classList.add('open');
}

document.addEventListener('click', () => mlContextMenu.classList.remove('open'));

mlContextMenu.querySelectorAll('.context-menu-item').forEach((item) => {
  item.addEventListener('click', () => {
    const action = item.dataset.action;
    const selectedEntries = libraryEntries.filter((e) => selectedIds.has(e.id));
    const paths = selectedEntries.map((e) => e.filePath);
    if (paths.length === 0) return;

    if (action === 'add-to-playlist') {
      addFromLibrary(paths);
    } else if (action === 'play-now') {
      playTrackNow(paths[0]);
    } else if (action === 'show-in-explorer') {
      window.libraryAPI.showInExplorer(paths[0]);
    } else if (action === 'remove-from-library') {
      window.libraryAPI.removeEntries([...selectedIds]).then((updated) => {
        libraryEntries = updated;
        selectedIds = new Set();
        render();
      });
    }
  });
});

// ---------- Add Folder ----------
document.getElementById('ml-btn-add-folder').addEventListener('click', async () => {
  const folderPath = await window.libraryAPI.openFolderDialog();
  if (!folderPath) return;
  document.getElementById('ml-status-bar').textContent = 'Scanning...';
  libraryEntries = await window.libraryAPI.scanFolder(folderPath);
  render();
});

// ---------- Panel open/close ----------
const libraryPanel = document.getElementById('library-panel');
let libraryPanelOpen = false;
let libraryLoaded = false;

async function ensureLibraryLoaded() {
  if (libraryLoaded) return;
  libraryLoaded = true;
  libraryEntries = await window.libraryAPI.getAll();
  render();
}

function openLibraryPanel() {
  if (typeof playlistPanelOpen !== 'undefined' && playlistPanelOpen) closePlaylistPanel();
  libraryPanelOpen = true;
  libraryPanel.classList.add('open');
  window.shellAPI.toggleDockPanel(true);
  ensureLibraryLoaded();
}

function closeLibraryPanel() {
  libraryPanelOpen = false;
  libraryPanel.classList.remove('open');
  window.shellAPI.toggleDockPanel(false);
}

document.getElementById('btn-media-library').addEventListener('click', () => {
  if (libraryPanelOpen) closeLibraryPanel();
  else openLibraryPanel();
});
