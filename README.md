# Studio Prime

Premium screen & game capture for creators — built with Electron.

## Features

- **Game Capture** — direct stream recording bypasses the canvas entirely for maximum quality and zero dropped frames
- **Screen & Window Capture** — record any display or individual window at native resolution
- **Webcam Overlay** — picture-in-picture camera in any corner (circle, rounded, or square) with customizable size and border
- **System Audio + Mic** — mix desktop audio with microphone input, noise suppression & echo cancellation built-in
- **Save as MP4, WebM, or WAV** — MP4 for universal playback, WebM for native speed, WAV for audio-only extraction
- **High Bitrate Recording** — up to 50 Mbps for crystal clear output (default 15 Mbps)
- **Resolution Presets** — Native, 4K, 1440p, 1080p, 720p
- **Frame Rate Control** — 24 / 30 / 60 / 120 fps
- **H.264 Hardware Acceleration** — uses GPU encoding when available, falls back to VP9/VP8
- **DXGI Capture Backend** — disables WGC to avoid the ProcessFrame dropped-frame bug on Windows
- **FFmpeg Conversion** — bundled FFmpeg converts recordings to MP4 (H.264 + AAC) or extracts audio to WAV with a real-time progress bar
- **3-2-1 Countdown** — gives you time to get ready before recording starts
- **Global Shortcuts** — `Ctrl+Shift+R` to record/stop, `Ctrl+Shift+P` to pause/resume
- **Live Mic Meter** — visual audio level indicator

## Quick Start

```bash
npm install
npm start
```

## Keyboard Shortcuts

| Shortcut         | Action              |
|------------------|---------------------|
| `Ctrl+Shift+R`   | Start / Stop record |
| `Ctrl+Shift+P`   | Pause / Resume      |

## Output Settings

| Setting    | Options                                              |
|------------|------------------------------------------------------|
| Format     | MP4 (default), WebM, WAV                             |
| Resolution | Native (default), 4K, 1440p, 1080p, 720p            |
| Quality    | 2.5 / 5 / 8 / **15** / 25 / 50 Mbps                 |
| Frame Rate | 24 / 30 / **60** / 120 fps                           |

## How It Works

1. **Source selection** — pick a screen or window via Electron's `desktopCapturer`
2. **Direct stream path** — when no webcam overlay is needed, the capture stream feeds directly into MediaRecorder with zero canvas overhead
3. **Canvas compositing** — when the webcam overlay is active, screen + camera are composited on a 2D canvas per frame
4. **Recording** — MediaRecorder encodes to WebM (H.264 > VP9 > VP8 fallback) at the selected bitrate
5. **Conversion** — if MP4 or WAV is chosen, the WebM is piped through bundled FFmpeg (`-preset veryfast -crf 18`) and a progress overlay tracks the conversion

## Tech Stack

- **Electron 33** — desktop runtime (Chromium 130)
- **Canvas API** — real-time compositing for webcam overlay
- **MediaRecorder API** — WebM encoding with H.264/VP9/VP8 codec selection
- **Web Audio API** — system audio + mic mixing, level metering
- **FFmpeg** (via `ffmpeg-static`) — WebM → MP4 / WAV conversion

## Build

```bash
npx electron-builder --win
```

## License

MIT
