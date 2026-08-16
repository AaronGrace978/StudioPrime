const {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  dialog,
  globalShortcut,
  screen,
  shell,
} = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

// Kill WGC (Windows Graphics Capture) — it floods ProcessFrame errors on many
// GPU/driver combos. List every possible Chromium feature flag name across
// versions so at least one sticks. Disabling a nonexistent flag is a no-op.
app.commandLine.appendSwitch('disable-features', [
  'DesktopCaptureWithWGC',
  'WGCDesktopCapturer',
  'WGCScreenCapturer',
  'WGCWindowCapturer',
  'AllowWgcScreenCapturer',
  'AllowWgcWindowCapturer',
  'AllowWgcDesktopCapturer',
  'WebRtcAllowWgcScreenCapturer',
  'WebRtcAllowWgcWindowCapturer',
].join(','));

// Run GPU in-process: avoids IPC frame delivery failures between the GPU
// process and the main process, which is the root cause of WGC E_FAIL.
app.commandLine.appendSwitch('in-process-gpu');

app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-gpu-sandbox');

let mainWindow;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1400, width - 80),
    height: Math.min(900, height - 80),
    minWidth: 1024,
    minHeight: 680,
    frame: false,
    backgroundColor: '#08080e',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-state', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-state', false);
  });
}

app.whenReady().then(() => {
  createWindow();

  globalShortcut.register('CommandOrControl+Shift+R', () => {
    mainWindow?.webContents.send('shortcut', 'toggle-recording');
  });
  globalShortcut.register('CommandOrControl+Shift+P', () => {
    mainWindow?.webContents.send('shortcut', 'toggle-pause');
  });
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  app.quit();
});

// ── IPC: Window controls ──────────────────────────────────────────────
ipcMain.handle('win:minimize', () => mainWindow?.minimize());
ipcMain.handle('win:maximize', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
  return mainWindow.isMaximized();
});
ipcMain.handle('win:close', () => mainWindow?.close());
ipcMain.handle('win:is-maximized', () => mainWindow?.isMaximized());

// ── IPC: Desktop capturer ─────────────────────────────────────────────
ipcMain.handle('sources:get', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 },
    fetchWindowIcons: true,
  });
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL(),
    appIcon: s.appIcon?.toDataURL() || null,
    display_id: s.display_id,
  }));
});

// ── IPC: File save ────────────────────────────────────────────────────
ipcMain.handle('file:save-dialog', async (_, { defaultName, format }) => {
  const filterMap = {
    webm: [{ name: 'WebM Video', extensions: ['webm'] }],
    mp4:  [{ name: 'MP4 Video', extensions: ['mp4'] }],
    wav:  [{ name: 'WAV Audio', extensions: ['wav'] }],
  };
  const filters = [
    ...(filterMap[format] || filterMap.webm),
    { name: 'All Files', extensions: ['*'] },
  ];

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Recording',
    defaultPath: path.join(app.getPath('videos'), defaultName),
    filters,
  });
  return result.canceled ? null : result.filePath;
});

ipcMain.handle('file:save-buffer', async (_, { filePath, buffer }) => {
  try {
    fs.writeFileSync(filePath, Buffer.from(buffer));
    return { success: true, path: filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('file:reveal', (_, filePath) => {
  shell.showItemInFolder(filePath);
});

// ── IPC: Save WebM blob to temp file for FFmpeg conversion ────────────
ipcMain.handle('file:save-temp', async (_, buffer) => {
  const tempPath = path.join(os.tmpdir(), `studioprime_${Date.now()}.webm`);
  fs.writeFileSync(tempPath, Buffer.from(buffer));
  return tempPath;
});

// ── IPC: FFmpeg conversion (WebM → MP4 / WAV) ────────────────────────
ipcMain.handle('convert:start', async (_, { tempPath, outputPath, format }) => {
  return new Promise((resolve) => {
    let ffmpegBin;
    try {
      ffmpegBin = require('ffmpeg-static');
      if (app.isPackaged) {
        ffmpegBin = ffmpegBin.replace('app.asar', 'app.asar.unpacked');
      }
    } catch (err) {
      resolve({ success: false, error: 'FFmpeg not found. Run: npm install ffmpeg-static' });
      return;
    }

    const args = ['-y', '-i', tempPath];

    if (format === 'mp4') {
      args.push(
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '192k',
        '-threads', '0',
      );
    } else if (format === 'wav') {
      args.push('-vn', '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2');
    }

    args.push(outputPath);

    const proc = spawn(ffmpegBin, args);
    let duration = 0;

    proc.stderr.on('data', (data) => {
      const str = data.toString();
      const durMatch = str.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
      if (durMatch) {
        duration = +durMatch[1] * 3600 + +durMatch[2] * 60 + +durMatch[3];
      }
      const timeMatch = str.match(/time=(\d+):(\d+):(\d+\.\d+)/);
      if (timeMatch && duration > 0) {
        const cur = +timeMatch[1] * 3600 + +timeMatch[2] * 60 + +timeMatch[3];
        const pct = Math.min(100, Math.round((cur / duration) * 100));
        mainWindow?.webContents.send('convert:progress', pct);
      }
    });

    proc.on('close', (code) => {
      try { fs.unlinkSync(tempPath); } catch (_) {}
      resolve(code === 0
        ? { success: true, path: outputPath }
        : { success: false, error: `FFmpeg exited with code ${code}` });
    });

    proc.on('error', (err) => {
      try { fs.unlinkSync(tempPath); } catch (_) {}
      resolve({ success: false, error: err.message });
    });
  });
});
