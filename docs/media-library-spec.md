# Media Library Window — Build Spec

## 1. Overview

A separate, resizable window within the retro MP3 player app that lets the user browse their entire local music collection in a sortable table, search it, and send tracks to the playlist. Opened via the "ML" button on the main player.

**Reference image:** a classic skinnable-player media library — left sidebar tree, main data table, search bar, view toggles.

## 2. Window Layout

### 2.1 Titlebar
- Title: "MEDIA LIBRARY"
- Standard minimize/close controls, matches main app chrome style

### 2.2 Menu Bar
- File, View, Help (File > Add Folder to Library is the core action in v1; rest can be stubs)

### 2.3 Left Sidebar (tree view)
- **Local Library** (expandable root)
  - Audio
  - Video (stub/out of scope for v1 — audio only)
  - Most Played
  - Recently Added
  - Recently Modified
  - Recently Played
  - Never Played
  - Top Rated
- **Playlists** (expandable — lists saved playlists)
- **Devices** (expandable — stub for v1, no device sync)

Clicking a sidebar item filters the right-hand table to that view (e.g. "Most Played" sorts by play count descending; "Recently Added" sorts by date-added descending).

### 2.4 Main Panel (table)
- **Toolbar above table:** view-mode icon toggles (grid/list — list is default and sufficient for v1), Search box with placeholder "Search:", Clear Search button (right-aligned)
- **Columns:** Artist, Album, Track #, Title, Length, Genre, Rating, Play Count (# Plays)
  - Column headers clickable to sort ascending/descending (indicator arrow on active sort column)
  - Columns resizable and reorderable (drag column border / drag header — stretch goal; fixed order acceptable for v1)
- **Row rendering:** alternating/selected row highlight matches app's blue accent theme; multi-select via ctrl/shift-click
- **Bottom status bar:** total track count, total duration, total size (e.g. "1,842 tracks, 5.2 days, 8.4 GB")

## 3. Data Model

Each library entry:
```json
{
  "id": "uuid",
  "filePath": "C:\\Users\\...\\track.mp3",
  "artist": "Funkadelic",
  "album": "Maggot Brain",
  "trackNumber": 3,
  "title": "Hit It and Quit It",
  "length": 231,          // seconds
  "genre": "R&B",
  "rating": 0,             // 0-5
  "playCount": 0,
  "dateAdded": "ISO timestamp",
  "dateModified": "ISO timestamp",
  "lastPlayed": "ISO timestamp or null"
}
```

## 4. Functional Requirements

### 4.1 Library Scanning (v1)
- File > Add Folder to Library opens a native folder picker (Electron `dialog.showOpenDialog`, `properties: ['openDirectory']`)
- Recursively walk the folder for supported audio files (`.mp3`, `.flac`, `.wav`, `.m4a`, `.ogg` — start with `.mp3` if scope needs trimming)
- Read ID3/metadata tags via `music-metadata` (npm package) — pull artist, album, track number, title, genre, duration
- Fallback: if tags are missing, use filename as title, "Unknown Artist"/"Unknown Album" as placeholders
- Store parsed entries in a local index — JSON file for v1 simplicity, or `better-sqlite3` if library size performance becomes an issue (recommended once library exceeds ~5,000 tracks)
- Re-scan should be incremental: skip files already indexed with an unchanged modified-time, add new files, remove entries for deleted files

### 4.2 Sorting & Filtering (v1)
- Click any column header to sort by that field; click again to reverse
- Sidebar selection sets the active filter/sort preset:
  - Audio: all tracks, default sort by Artist then Album then Track #
  - Most Played: sort by playCount desc
  - Recently Added: sort by dateAdded desc
  - Recently Modified: sort by dateModified desc
  - Recently Played: sort by lastPlayed desc, exclude nulls
  - Never Played: filter playCount === 0
  - Top Rated: sort by rating desc

### 4.3 Search (v1)
- Live filter as-you-type across Artist, Album, Title fields (case-insensitive substring match)
- Clear Search button resets to the current sidebar view with no filter

### 4.4 Interaction (v1)
- Double-click a row → adds track to the main playlist and starts playback if nothing is currently playing
- Right-click row → context menu: "Add to Playlist," "Play Now," "Show in Explorer," "Remove from Library" (removes from index only, does not delete the file)
- Multi-select + "Add to Playlist" adds all selected in table order

### 4.5 Ratings & Play Count (v2)
- Click-to-set 0-5 star rating inline in the Rating column
- playCount increments automatically when a track finishes playing (via the main player's `ended` event) and updates lastPlayed

### 4.6 Playlists Sidebar Section (v2)
- Lists saved playlists (from the Playlist window's saved files)
- Clicking a playlist filters the table to just those tracks, in playlist order

## 5. Technical Notes

- Runs as its own `BrowserWindow` (frameless, styled to match app chrome) or as a tab/panel within a single-window app shell — pick based on whichever window-management approach the main app spec settled on (see the build spec, section 3)
- Communicates with the main player window via Electron IPC (`ipcMain`/`ipcRenderer` or a shared store) to push "add to playlist" / "play now" actions
- Table rendering: for large libraries (10,000+ tracks), use a virtualized list (e.g. render only visible rows) to keep scroll performant — plain DOM rendering of every row will lag past a few thousand entries
- Metadata reads should happen off the main thread where possible (Node worker thread or batched async) so scanning a large folder doesn't freeze the UI

## 6. Out of Scope (v1)

- Video library tab
- Device sync
- Editing ID3 tags from within the app
- Smart/auto playlists based on rules
- Album art display/caching
