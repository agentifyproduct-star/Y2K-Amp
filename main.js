const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');

const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma'];
const LIBRARY_FILE = path.join(app.getPath('userData'), 'library.json');
const PLAYLIST_FILE = path.join(app.getPath('userData'), 'playlist.json');
const THEME_FILE = path.join(app.getPath('userData'), 'theme.json');
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
const UI_SCALE = 0.75;
const MAIN_WIDTH = Math.round(630 * UI_SCALE);
const MAIN_HEIGHT = Math.round(545 * UI_SCALE);
const DOCK_PANEL_HEIGHT = Math.round(320 * UI_SCALE);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: MAIN_WIDTH,
    height: MAIN_HEIGHT,
    minWidth: MAIN_WIDTH,
    maxWidth: MAIN_WIDTH,
    minHeight: MAIN_HEIGHT,
    resizable: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      zoomFactor: UI_SCALE,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.on('window:minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.on('window:close', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

ipcMain.on('window:toggleDockPanel', (event, isOpen) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  const { x, y } = win.getBounds();

  if (isOpen) {
    win.setResizable(true);
    win.setMinimumSize(MAIN_WIDTH, MAIN_HEIGHT + DOCK_PANEL_HEIGHT);
    win.setMaximumSize(MAIN_WIDTH, 20000);
    win.setBounds({ x, y, width: MAIN_WIDTH, height: MAIN_HEIGHT + DOCK_PANEL_HEIGHT });
    win.focus();
  } else {
    // Relax the min/max constraints BEFORE shrinking - setBounds is clamped
    // by whatever constraints are currently active, so shrinking first (while
    // the old, larger minimum height is still in effect) silently no-ops.
    win.setMinimumSize(MAIN_WIDTH, MAIN_HEIGHT);
    win.setMaximumSize(MAIN_WIDTH, MAIN_HEIGHT);
    win.setBounds({ x, y, width: MAIN_WIDTH, height: MAIN_HEIGHT });
    win.setResizable(false);
  }
});

ipcMain.handle('dialog:openFiles', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Audio Files', extensions: AUDIO_EXTENSIONS }],
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

async function parseTrackMetadata(filePath) {
  const { parseFile } = await import('music-metadata');
  try {
    const metadata = await parseFile(filePath);
    return {
      artist: metadata.common.artist || 'Unknown Artist',
      album: metadata.common.album || 'Unknown Album',
      trackNumber: metadata.common.track?.no ?? null,
      title: metadata.common.title || path.basename(filePath),
      length: metadata.format.duration ?? 0,
      genre: (metadata.common.genre && metadata.common.genre[0]) || 'Unknown',
    };
  } catch (err) {
    return {
      artist: 'Unknown Artist',
      album: 'Unknown Album',
      trackNumber: null,
      title: path.basename(filePath),
      length: 0,
      genre: 'Unknown',
    };
  }
}

const MAX_SCAN_DEPTH = 20;

function isAudioFile(filename) {
  const ext = path.extname(filename).slice(1).toLowerCase();
  return AUDIO_EXTENSIONS.includes(ext);
}

async function walkForAudioFiles(dir, visitedRealPaths = new Set(), depth = 0) {
  if (depth > MAX_SCAN_DEPTH) return [];

  // Resolve to the real (symlink-free) path and skip it if we've already
  // walked there - otherwise a symlink/junction loop recurses forever.
  let realDir;
  try {
    realDir = await fs.realpath(dir);
  } catch (err) {
    return [];
  }
  if (visitedRealPaths.has(realDir)) return [];
  visitedRealPaths.add(realDir);

  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    return [];
  }

  const results = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    let isDir = entry.isDirectory();

    if (entry.isSymbolicLink()) {
      try {
        isDir = (await fs.stat(fullPath)).isDirectory();
      } catch (err) {
        continue; // broken symlink target - skip
      }
    }

    if (isDir) {
      results.push(...(await walkForAudioFiles(fullPath, visitedRealPaths, depth + 1)));
    } else if (isAudioFile(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

async function loadLibrary() {
  try {
    const raw = await fs.readFile(LIBRARY_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

async function saveLibrary(entries) {
  await fs.writeFile(LIBRARY_FILE, JSON.stringify(entries, null, 2), 'utf-8');
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

ipcMain.handle('library:scanFolder', async (event, folderPath) => {
  const existing = await loadLibrary();
  const existingByPath = new Map(existing.map((e) => [e.filePath, e]));

  const filePaths = await walkForAudioFiles(folderPath);
  const foundPaths = new Set(filePaths);
  const now = new Date().toISOString();

  const updated = (
    await mapWithConcurrency(filePaths, 8, async (filePath) => {
      try {
        const stat = await fs.stat(filePath);
        const mtime = stat.mtimeMs;
        const prior = existingByPath.get(filePath);

        if (prior && prior.mtimeMs === mtime) return prior;

        const meta = await parseTrackMetadata(filePath);
        return {
          id: prior?.id ?? crypto.randomUUID(),
          filePath,
          mtimeMs: mtime,
          sizeBytes: stat.size,
          artist: meta.artist,
          album: meta.album,
          trackNumber: meta.trackNumber,
          title: meta.title,
          length: meta.length,
          genre: meta.genre,
          rating: prior?.rating ?? 0,
          playCount: prior?.playCount ?? 0,
          dateAdded: prior?.dateAdded ?? now,
          dateModified: now,
          lastPlayed: prior?.lastPlayed ?? null,
        };
      } catch (err) {
        // File vanished or became unreadable mid-scan - skip it rather than
        // failing the whole scan.
        return null;
      }
    })
  ).filter((entry) => entry !== null);

  // Keep entries from other, previously-scanned folders untouched; only prune
  // entries that were under this folder tree but are now missing on disk.
  // Compare against folderPath + separator (not a bare prefix) so a sibling
  // folder with the same prefix, e.g. "C:\Music2" vs "C:\Music", isn't
  // mistaken for being nested under it.
  const folderPrefix = folderPath.endsWith(path.sep) ? folderPath : folderPath + path.sep;
  const survivors = existing.filter((e) => {
    const underThisFolder = e.filePath === folderPath || e.filePath.startsWith(folderPrefix);
    return !underThisFolder || foundPaths.has(e.filePath);
  });
  const merged = [...survivors.filter((e) => !foundPaths.has(e.filePath)), ...updated].filter(
    (e, i, arr) => arr.findIndex((x) => x.filePath === e.filePath) === i
  );

  await saveLibrary(merged);
  return merged;
});

ipcMain.handle('library:getAll', () => loadLibrary());

ipcMain.handle('library:removeEntries', async (event, ids) => {
  const existing = await loadLibrary();
  const updated = existing.filter((e) => !ids.includes(e.id));
  await saveLibrary(updated);
  return updated;
});

ipcMain.on('library:showInExplorer', (event, filePath) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle('playlist:save', async (event, filePaths) => {
  await fs.writeFile(PLAYLIST_FILE, JSON.stringify(filePaths, null, 2), 'utf-8');
});

ipcMain.handle('playlist:load', async () => {
  let filePaths;
  try {
    filePaths = JSON.parse(await fs.readFile(PLAYLIST_FILE, 'utf-8'));
  } catch (err) {
    return [];
  }
  const existing = [];
  for (const filePath of filePaths) {
    try {
      await fs.access(filePath);
      existing.push(filePath);
    } catch (err) {
      // file no longer exists on disk - drop it silently
    }
  }
  return existing;
});

ipcMain.handle('theme:save', async (event, themeState) => {
  await fs.writeFile(THEME_FILE, JSON.stringify(themeState, null, 2), 'utf-8');
});

ipcMain.handle('theme:load', async () => {
  try {
    return JSON.parse(await fs.readFile(THEME_FILE, 'utf-8'));
  } catch (err) {
    return null;
  }
});

// Concurrent saves (e.g. volume released right after an EQ slider) each do a
// read-modify-write on the same file; without serializing them, one save's
// write can land between another's read and write and get silently
// overwritten. Chaining onto a shared queue forces them to run one at a time.
let settingsWriteQueue = Promise.resolve();

ipcMain.handle('settings:save', (event, partialSettings) => {
  settingsWriteQueue = settingsWriteQueue.then(async () => {
    let existing = {};
    try {
      existing = JSON.parse(await fs.readFile(SETTINGS_FILE, 'utf-8'));
    } catch (err) {
      // no existing settings file yet - start fresh
    }
    const merged = { ...existing, ...partialSettings };
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf-8');
  });
  return settingsWriteQueue;
});

ipcMain.handle('settings:load', async () => {
  try {
    return JSON.parse(await fs.readFile(SETTINGS_FILE, 'utf-8'));
  } catch (err) {
    return null;
  }
});

ipcMain.handle('dialog:openThemeFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Y2K Amp Theme', extensions: ['json'] }],
  });
  // Distinguish "user cancelled" (false, no feedback needed) from
  // "file couldn't be read/parsed" (null, renderer should tell the user).
  if (result.canceled) return false;
  try {
    const raw = await fs.readFile(result.filePaths[0], 'utf-8');
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    return parsed;
  } catch (err) {
    return null;
  }
});

ipcMain.handle('dialog:saveThemeFile', async (event, themeVariables) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: 'y2k-amp-theme.json',
    filters: [{ name: 'Y2K Amp Theme', extensions: ['json'] }],
  });
  if (result.canceled) return false;
  await fs.writeFile(result.filePath, JSON.stringify(themeVariables, null, 2), 'utf-8');
  return true;
});

ipcMain.handle('audio:getMetadata', async (event, filePath) => {
  const { parseFile } = await import('music-metadata');
  try {
    const metadata = await parseFile(filePath);
    return {
      bitrate: metadata.format.bitrate ?? null,
      sampleRate: metadata.format.sampleRate ?? null,
      numberOfChannels: metadata.format.numberOfChannels ?? null,
      duration: metadata.format.duration ?? null,
      title: metadata.common.title ?? null,
      artist: metadata.common.artist ?? null,
    };
  } catch (err) {
    return { bitrate: null, sampleRate: null, numberOfChannels: null, duration: null, title: null, artist: null };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
