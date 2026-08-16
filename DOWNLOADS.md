# Studio Prime — Downloads (v1.0.0)

**Release:** https://github.com/AaronGrace978/StudioPrime/releases/tag/v1.0.0

Studio Prime is **free**. No license, no subscription, no paywall.

---

## Downloads by platform

| Platform | File | Link |
| -------- | ---- | ---- |
| **Windows installer** | `StudioPrime-1.0.0-win-x64-setup.exe` | [Download](https://github.com/AaronGrace978/StudioPrime/releases/download/v1.0.0/StudioPrime-1.0.0-win-x64-setup.exe) |
| **Windows portable** | `StudioPrime-1.0.0-win-x64-portable.exe` | [Download](https://github.com/AaronGrace978/StudioPrime/releases/download/v1.0.0/StudioPrime-1.0.0-win-x64-portable.exe) |
| **macOS Apple Silicon** | `StudioPrime-1.0.0-mac-arm64.dmg` | [Download](https://github.com/AaronGrace978/StudioPrime/releases/download/v1.0.0/StudioPrime-1.0.0-mac-arm64.dmg) |
| **macOS Intel** | `StudioPrime-1.0.0-mac-x64.dmg` | [Download](https://github.com/AaronGrace978/StudioPrime/releases/download/v1.0.0/StudioPrime-1.0.0-mac-x64.dmg) |
| **Linux AppImage** | `StudioPrime-1.0.0-linux-x64.AppImage` | [Download](https://github.com/AaronGrace978/StudioPrime/releases/download/v1.0.0/StudioPrime-1.0.0-linux-x64.AppImage) |
| **Linux .deb** | `StudioPrime-1.0.0-linux-x64.deb` | [Download](https://github.com/AaronGrace978/StudioPrime/releases/download/v1.0.0/StudioPrime-1.0.0-linux-x64.deb) |

---

## What's in 1.0.0

- Game, screen, and window capture
- Webcam overlay (circle / rounded / square)
- System audio + microphone mix
- MP4, WebM, and WAV export
- Bitrate presets through 50 Mbps
- Resolution presets through 4K
- 24 / 30 / 60 / 120 fps
- H.264 hardware encoding with VP9/VP8 fallback
- DXGI capture backend on Windows
- Bundled FFmpeg conversion with progress overlay

All of the above is included. Nothing is gated.

---

## Install notes

### Windows
Run `StudioPrime-1.0.0-win-x64-setup.exe` and allow SmartScreen / UAC if prompted. Prefer the portable `.exe` if you do not want an installer.

### macOS
Open the `.dmg` → drag **Studio Prime** into Applications → launch (right-click → Open the first time if Gatekeeper prompts). Builds are unsigned.

### Linux
```bash
chmod +x StudioPrime-1.0.0-linux-x64.AppImage
./StudioPrime-1.0.0-linux-x64.AppImage
```

Or: `sudo dpkg -i StudioPrime-1.0.0-linux-x64.deb`

### From source
```bash
npm install
npm start
```
