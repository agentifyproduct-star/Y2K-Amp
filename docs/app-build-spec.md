# Retro MP3 Player — Build Spec

## 1. Overview

A desktop music player for Windows that replicates the classic early-2000s skinnable-MP3-player UI and core functionality: main player window, 10-band graphic equalizer, and playlist window. Built with Electron so it runs as a native-feeling Windows app while using web tech for the UI.

**Reference image:** a classic skinnable-player look — dark blue/silver chrome, LCD-style display, chrome transport buttons, 10-band EQ with vertical sliders.

## 2. Tech Stack

- **Shell:** Electron (frameless `BrowserWindow`, custom titlebar)
- **UI:** HTML + CSS (absolute-positioned elements, no framework needed — this UI doesn't benefit from React's overhead)
- **Audio playback:** HTML5 `<audio>` element as the source, piped through the Web Audio API
- **EQ:** Web Audio `BiquadFilterNode` chain (10 peaking filters + 1 preamp gain node)
- **Spectrum analyzer:** Web Audio `AnalyserNode` → `<canvas>` bar/dot rendering
- **File access:** Electron `dialog` + drag-and-drop via renderer
- **Packaging:** `electron-builder` for a Windows installer/exe

## 3. Window Architecture

Three separate frameless, always-on-top-capable, independently draggable windows that snap together (classic skinnable-player behavior), OR a simpler single-window mode with all three panels stacked (recommended for v1 to cut scope):

1. **Main window** — titlebar, transport controls, LCD display, seek bar, volume/balance
2. **Equalizer window** — 10-band EQ + preamp, ON/AUTO/PRESETS
3. **Playlist window** — track list, add/remove, drag-drop reorder

**v1 recommendation:** build as one fixed-layout window (main + EQ stacked, matching the reference screenshot exactly), add the separate playlist window in v2, add window-docking/snapping in v3.

## 4. Visual Spec (from reference image)

### 4.1 Main Player Panel
- Titlebar: app name centered, minimize/maximize/close buttons (top right), small logo icon (top left)
- Menu bar: File, Play, Options, View, Help (cosmetic in v1 — File > Open should work; rest can be stubs)
- LCD display region (dark blue background, pixel-font digits):
  - Time counter (M:SS), monospace LCD digit font
  - KBPS value box, kHz value box, STEREO/MONO indicator
  - Mini spectrum analyzer (bar graph, top-right of LCD)
  - Scrolling track title text ("ARTIST - TRACK") — marquee scroll when text overflows
- Seek bar: horizontal slider below LCD
- Transport buttons (left to right): Previous, Play, Pause, Stop, Next, Eject — classic chrome circular buttons
- Balance/volume slider (horizontal, bottom left area) + "CONFIG" label + lightning bolt icon (visualizer toggle)
- Right-side small buttons: shuffle toggle, repeat toggle, playlist (PL), mini-library (ML), eject

### 4.2 Equalizer Panel
- ON / AUTO / PRESETS buttons (left column)
- Preamp vertical slider (separate, labeled "PREAMP")
- 10 vertical sliders labeled: 60, 170, 310, 600, 1K, 3K, 6K, 12K, 14K, 16K (Hz)
- dB scale markers: +12 dB, 0 dB, -12 dB
- Tabs at bottom: EQUALIZER, OPTIONS, COLOR THEMES

### 4.3 Color/Style
- Base palette: steel blue/silver gradient chrome (`#8fa8c4` → `#c8d4e0` range for panel bevels), dark navy LCD background (`#0a1428`), cyan/white LCD text (`#00ffff` / `#ffffff`)
- All buttons: beveled 3D look via `box-shadow` (light top-left, dark bottom-right) — no image assets required if approximated in CSS, but pixel-accurate reproduction needs cropped sprites

## 5. Functional Requirements

### 5.1 Playback (v1 — must have)
- Open file(s) via File menu or drag-and-drop onto window
- Play / Pause / Stop / Next / Previous
- Seek via progress bar (click + drag)
- Volume + balance sliders control `GainNode` / `StereoPannerNode`
- Time display counts up (or down in "remaining time" mode — stretch)
- Track title marquee-scrolls in LCD when longer than display width
- Display real bitrate/sample rate/channel count read from the loaded file

### 5.2 Equalizer (v1 — must have)
- 10 `BiquadFilterNode`s (type `peaking`), center frequencies matching the labeled bands, connected in series between source and destination
- Preamp = single `GainNode` before the filter chain
- Each slider: -12 dB to +12 dB, updates its filter's `.gain.value` live
- ON toggle: bypass the whole filter chain when off (route source straight to destination)
- AUTO: stretch goal — auto-adjust based on track loudness
- PRESETS: dropdown/list of built-in presets (Rock, Pop, Jazz, Flat, etc.) that set all 10 sliders at once

### 5.3 Spectrum Analyzer (v1 — must have, simplified)
- `AnalyserNode` with small FFT size (e.g. 32-64 bins) feeding the mini bar-graph in the LCD
- Canvas redraw on `requestAnimationFrame`

### 5.4 Playlist (v2)
- Add/remove tracks, reorder via drag
- Double-click to play
- Persist playlist to disk (JSON) between sessions

### 5.5 Skinning (v3 / stretch)
- Support loading classic skinnable-player skin archives (renamed ZIPs of BMP sprites + config); significant scope, treat as optional

## 6. Project Structure

```
y2k-amp/
├── package.json
├── main.js                 # Electron main process — window creation, file dialogs
├── preload.js               # contextBridge API exposed to renderer
├── src/
│   ├── index.html
│   ├── styles/
│   │   ├── main-window.css
│   │   └── equalizer.css
│   ├── scripts/
│   │   ├── player.js         # <audio> + transport logic
│   │   ├── audio-engine.js   # Web Audio graph: source → EQ chain → analyser → destination
│   │   ├── equalizer.js      # slider → BiquadFilterNode binding, presets
│   │   ├── visualizer.js     # canvas spectrum draw loop
│   │   └── ui.js             # drag window, marquee text, button wiring
│   └── assets/
│       ├── fonts/            # LCD digit bitmap font (or webfont equivalent)
│       └── sprites/          # cropped button/slider images if pixel-matching
└── build/                    # electron-builder output
```

## 7. Audio Graph

```
<audio> element
   └─ MediaElementAudioSourceNode
        └─ GainNode (preamp)
             └─ BiquadFilterNode (60Hz, peaking)
                  └─ BiquadFilterNode (170Hz, peaking)
                       └─ ... (8 more bands)
                            └─ AnalyserNode (for visualizer)
                                 └─ StereoPannerNode (balance)
                                      └─ GainNode (master volume)
                                           └─ AudioContext.destination
```

## 8. Build Phases (suggested milestones for Claude Code)

1. **Scaffold** — Electron boilerplate, frameless window, basic CSS layout matching reference screenshot proportions (static, no function)
2. **Playback core** — wire real audio file, transport buttons, seek bar, time display
3. **Audio engine + EQ** — build the filter chain, wire all 10 sliders + preamp + ON toggle
4. **Visualizer** — spectrum analyzer canvas in LCD
5. **Polish** — marquee text scroll, LCD bitmap-style font, button press states, balance control
6. **Packaging** — `electron-builder` config, produce a Windows `.exe`
7. **(v2) Playlist window**
8. **(v3) Skin file support / window docking**

## 9. Out of Scope for v1

- Multiple simultaneous skins / skin switching
- Streaming radio / internet playback
- Video/visualization plugins (Milkdrop, etc.)
- Cross-platform builds (Windows-only target per the request)
