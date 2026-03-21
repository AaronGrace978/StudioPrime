/* ═══════════════════════════════════════════════════════════════════════
   Studio Prime — Recording Engine & UI Controller
   ═══════════════════════════════════════════════════════════════════════ */

// ── DOM refs ──────────────────────────────────────────────────────────
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const canvas        = $('#preview-canvas');
const ctx           = canvas.getContext('2d', { alpha: false });
const screenVideo   = $('#screen-video');
const webcamVideo   = $('#webcam-video');
const emptyState    = $('#empty-state');
const countdownEl   = $('#countdown');
const countdownNum  = $('#countdown-num');
const timerEl       = $('#timer');
const recBadge      = $('#rec-badge');
const toastBox      = $('#toast-container');

const btnRecord  = $('#btn-record');
const btnPause   = $('#btn-pause');
const btnStop    = $('#btn-stop');
const btnRefresh = $('#btn-refresh');

const screenSelect  = $('#screen-select');
const cameraSelect  = $('#camera-select');
const micSelect     = $('#mic-select');
const cameraToggle  = $('#camera-toggle');
const micToggle     = $('#mic-toggle');
const sysAudioToggle = $('#sysaudio-toggle');

const webcamSizeSlider = $('#webcam-size');
const webcamSizeVal    = $('#webcam-size-val');
const borderToggle     = $('#border-toggle');
const borderColorPick  = $('#border-color');
const qualitySelect    = $('#quality-select');
const fpsSelect        = $('#fps-select');
const formatSelect     = $('#format-select');
const resolutionSelect = $('#resolution-select');

const convertOverlay   = $('#convert-overlay');
const convertFill      = $('#convert-fill');
const convertPercent   = $('#convert-percent');
const convertFormatEl  = $('#convert-format');

// ── State ─────────────────────────────────────────────────────────────
let screenStream  = null;
let webcamStream  = null;
let micStream     = null;
let mediaRecorder = null;
let recordedChunks = [];
let drawLoopId    = null;

let isRecording   = false;
let isPaused      = false;
let recStartTime  = null;
let pauseOffset   = 0;
let pauseStamp    = null;
let timerInterval = null;

let micAnalyser   = null;
let micDataArray  = null;

// Settings
let camPosition   = 'bottom-right';
let camSize       = 22;
let camShape      = 'circle';
let camBorder     = true;
let camBorderColor = '#00d4ff';

// ══════════════════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════════════════
async function init() {
  await refreshSources();
  await loadDevices();
  bindEvents();
  drawIdle();
}

// ── Load screen/window sources from Electron ─────────────────────────
async function refreshSources() {
  const sources = await window.studio.getSources();
  const prev = screenSelect.value;
  screenSelect.innerHTML = '<option value="">Select a source…</option>';
  sources.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    screenSelect.appendChild(opt);
  });
  if (prev && screenSelect.querySelector(`option[value="${prev}"]`)) {
    screenSelect.value = prev;
  }
}

// ── Enumerate cameras & mics ─────────────────────────────────────────
async function loadDevices() {
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
  } catch (_) { /* permissions prompt */ }

  const devices = await navigator.mediaDevices.enumerateDevices();
  const cameras = devices.filter((d) => d.kind === 'videoinput');
  const mics    = devices.filter((d) => d.kind === 'audioinput');

  cameraSelect.innerHTML = '<option value="">No camera</option>';
  cameras.forEach((c, i) => {
    const opt = document.createElement('option');
    opt.value = c.deviceId;
    opt.textContent = c.label || `Camera ${i + 1}`;
    cameraSelect.appendChild(opt);
  });

  micSelect.innerHTML = '<option value="">No microphone</option>';
  mics.forEach((m, i) => {
    const opt = document.createElement('option');
    opt.value = m.deviceId;
    opt.textContent = m.label || `Microphone ${i + 1}`;
    micSelect.appendChild(opt);
  });

  if (cameras.length) {
    cameraSelect.value = cameras[0].deviceId;
  }
  if (mics.length) {
    micSelect.value = mics[0].deviceId;
  }
}

// ══════════════════════════════════════════════════════════════════════
//  CAPTURE STREAMS
// ══════════════════════════════════════════════════════════════════════

async function startScreenCapture(sourceId) {
  stopScreenCapture();
  try {
    const videoConstraints = {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId,
      },
    };

    const res = resolutionSelect.value;
    if (res !== 'native') {
      const h = parseInt(res, 10);
      const w = Math.round(h * (16 / 9));
      videoConstraints.mandatory.maxWidth = w;
      videoConstraints.mandatory.maxHeight = h;
    }

    screenStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: { chromeMediaSource: 'desktop' },
      },
      video: videoConstraints,
    });
    screenVideo.srcObject = screenStream;
    await screenVideo.play();

    const vt = screenStream.getVideoTracks()[0];
    const settings = vt.getSettings();
    canvas.width  = settings.width  || 1920;
    canvas.height = settings.height || 1080;

    emptyState.classList.add('hidden');
    startDrawLoop();
  } catch (err) {
    console.error('Screen capture failed:', err);
    toast('Could not capture display — try another source.', 'error');
  }
}

function stopScreenCapture() {
  screenStream?.getTracks().forEach((t) => t.stop());
  screenStream = null;
  screenVideo.srcObject = null;
}

async function startWebcam(deviceId) {
  stopWebcam();
  try {
    webcamStream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId }, width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    webcamVideo.srcObject = webcamStream;
    await webcamVideo.play();
  } catch (err) {
    console.error('Webcam error:', err);
    toast('Could not access camera.', 'error');
  }
}

function stopWebcam() {
  webcamStream?.getTracks().forEach((t) => t.stop());
  webcamStream = null;
  webcamVideo.srcObject = null;
}

async function startMic(deviceId) {
  stopMic();
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true },
      video: false,
    });
    setupMicMeter();
  } catch (err) {
    console.error('Mic error:', err);
    toast('Could not access microphone.', 'error');
  }
}

function stopMic() {
  micStream?.getTracks().forEach((t) => t.stop());
  micStream = null;
  micAnalyser = null;
  micDataArray = null;
  const fill = $('#mic-meter .meter-fill');
  if (fill) fill.style.width = '0%';
}

// ── Mic level meter ──────────────────────────────────────────────────
function setupMicMeter() {
  const audioCtx = new AudioContext();
  micAnalyser = audioCtx.createAnalyser();
  micAnalyser.fftSize = 256;
  micDataArray = new Uint8Array(micAnalyser.frequencyBinCount);
  const src = audioCtx.createMediaStreamSource(micStream);
  src.connect(micAnalyser);
}

function readMicLevel() {
  if (!micAnalyser || !micDataArray) return 0;
  micAnalyser.getByteFrequencyData(micDataArray);
  const sum = micDataArray.reduce((a, b) => a + b, 0);
  return (sum / micDataArray.length / 255) * 100;
}

// ══════════════════════════════════════════════════════════════════════
//  CANVAS DRAWING (preview + webcam overlay compositing)
// ══════════════════════════════════════════════════════════════════════

function drawIdle() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width || 640, canvas.height || 360);
}

function startDrawLoop() {
  cancelAnimationFrame(drawLoopId);
  function loop() {
    drawFrame();
    drawLoopId = requestAnimationFrame(loop);
  }
  loop();
}

function drawFrame() {
  if (!screenVideo.videoWidth) return;

  ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);

  if (webcamStream && webcamVideo.readyState >= 2 && cameraToggle.checked) {
    drawWebcamOverlay();
  }
}

function drawWebcamOverlay() {
  const pad  = canvas.width * 0.018;
  const size = canvas.width * (camSize / 100);

  let x, y;
  switch (camPosition) {
    case 'top-left':     x = pad;                        y = pad; break;
    case 'top-right':    x = canvas.width - size - pad;  y = pad; break;
    case 'bottom-left':  x = pad;                        y = canvas.height - size - pad; break;
    case 'bottom-right': x = canvas.width - size - pad;  y = canvas.height - size - pad; break;
    default:             x = canvas.width - size - pad;  y = canvas.height - size - pad;
  }

  ctx.save();

  if (camShape === 'circle') {
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
  } else if (camShape === 'rounded') {
    roundRect(ctx, x, y, size, size, size * 0.12);
    ctx.clip();
  }

  const vw = webcamVideo.videoWidth;
  const vh = webcamVideo.videoHeight;
  const minDim = Math.min(vw, vh);
  const sx = (vw - minDim) / 2;
  const sy = (vh - minDim) / 2;
  ctx.drawImage(webcamVideo, sx, sy, minDim, minDim, x, y, size, size);
  ctx.restore();

  if (camBorder) {
    ctx.save();
    ctx.strokeStyle = camBorderColor;
    ctx.lineWidth   = Math.max(2, canvas.width * 0.002);
    if (camShape === 'circle') {
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      ctx.stroke();
    } else if (camShape === 'rounded') {
      roundRect(ctx, x, y, size, size, size * 0.12);
      ctx.stroke();
    } else {
      ctx.strokeRect(x, y, size, size);
    }
    ctx.restore();
  }
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

// ══════════════════════════════════════════════════════════════════════
//  RECORDING
// ══════════════════════════════════════════════════════════════════════

async function beginRecording() {
  if (!screenStream) {
    toast('Select a display source first.', 'error');
    return;
  }

  await countdown();

  recordedChunks = [];

  const fps = parseInt(fpsSelect.value, 10);
  const useCanvas = cameraToggle.checked && webcamStream;

  // Direct stream path: bypass canvas entirely for maximum quality.
  // Canvas path: only when webcam overlay compositing is needed.
  let videoStream;
  if (useCanvas) {
    videoStream = canvas.captureStream(fps);
  } else {
    videoStream = new MediaStream(screenStream.getVideoTracks());
  }

  // Mix audio
  const audioCtx = new AudioContext();
  const dest = audioCtx.createMediaStreamDestination();
  let hasAudio = false;

  if (sysAudioToggle.checked && screenStream) {
    const sysTracks = screenStream.getAudioTracks();
    if (sysTracks.length) {
      audioCtx.createMediaStreamSource(new MediaStream([sysTracks[0]])).connect(dest);
      hasAudio = true;
    }
  }

  if (micToggle.checked && micStream) {
    audioCtx.createMediaStreamSource(micStream).connect(dest);
    hasAudio = true;
  }

  const tracks = [...videoStream.getVideoTracks()];
  if (hasAudio) tracks.push(...dest.stream.getAudioTracks());

  const combined = new MediaStream(tracks);

  // H.264 gets hardware acceleration on most GPUs; fall back to VP9 then VP8
  const mimeType =
    MediaRecorder.isTypeSupported('video/webm;codecs=h264,opus') ? 'video/webm;codecs=h264,opus' :
    MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')  ? 'video/webm;codecs=vp9,opus' :
    MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')  ? 'video/webm;codecs=vp8,opus' :
    'video/webm';

  mediaRecorder = new MediaRecorder(combined, {
    mimeType,
    videoBitsPerSecond: parseInt(qualitySelect.value, 10),
  });

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.onstop = () => finishRecording();

  // 200ms chunks: smoother output, less data loss on crash vs 1s chunks
  mediaRecorder.start(200);

  isRecording  = true;
  isPaused     = false;
  pauseOffset  = 0;
  recStartTime = Date.now();
  startTimer();
  updateControlsUI();

  const mode = useCanvas ? 'canvas compositing' : 'direct capture';
  toast(`Recording started (${mode})`, 'success');
}

function pauseRecording() {
  if (!mediaRecorder) return;
  if (mediaRecorder.state === 'recording') {
    mediaRecorder.pause();
    isPaused = true;
    pauseStamp = Date.now();
  } else if (mediaRecorder.state === 'paused') {
    mediaRecorder.resume();
    isPaused = false;
    pauseOffset += Date.now() - pauseStamp;
    pauseStamp = null;
  }
  updateControlsUI();
}

function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
  mediaRecorder.stop();
  isRecording = false;
  isPaused = false;
  stopTimer();
  updateControlsUI();
}

async function finishRecording() {
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const format = formatSelect.value;
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const defaultName = `StudioPrime_${ts}.${format}`;
  const filePath = await window.studio.saveDialog(defaultName, format);

  if (!filePath) {
    toast('Recording discarded.', 'error');
    recordedChunks = [];
    return;
  }

  if (format === 'webm') {
    const buf = await blob.arrayBuffer();
    const result = await window.studio.saveBuffer(filePath, buf);
    if (result.success) {
      toast('Recording saved!', 'success');
      window.studio.revealFile(result.path);
    } else {
      toast('Save failed: ' + result.error, 'error');
    }
  } else {
    showConvertOverlay(format);
    const buf = await blob.arrayBuffer();
    const tempPath = await window.studio.saveTempBuffer(buf);
    const result = await window.studio.convertFile(tempPath, filePath, format);
    hideConvertOverlay();

    if (result.success) {
      toast(`Saved as ${format.toUpperCase()}!`, 'success');
      window.studio.revealFile(result.path);
    } else {
      toast('Conversion failed: ' + result.error, 'error');
    }
  }

  recordedChunks = [];
}

// ── Conversion overlay ───────────────────────────────────────────────
function showConvertOverlay(format) {
  convertFormatEl.textContent = format.toUpperCase();
  convertFill.style.width = '0%';
  convertPercent.textContent = '0%';
  convertOverlay.classList.remove('hidden');
}

function hideConvertOverlay() {
  convertOverlay.classList.add('hidden');
}

// ── Countdown ────────────────────────────────────────────────────────
function countdown() {
  return new Promise((resolve) => {
    countdownEl.classList.remove('hidden');
    let n = 3;
    countdownNum.textContent = n;

    const iv = setInterval(() => {
      n--;
      if (n <= 0) {
        clearInterval(iv);
        countdownEl.classList.add('hidden');
        resolve();
      } else {
        countdownNum.textContent = n;
      }
    }, 800);
  });
}

// ── Timer ────────────────────────────────────────────────────────────
function startTimer() {
  timerInterval = setInterval(updateTimer, 200);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerEl.textContent = '00:00:00';
}

function updateTimer() {
  if (!recStartTime) return;
  let elapsed = Date.now() - recStartTime - pauseOffset;
  if (isPaused && pauseStamp) elapsed -= (Date.now() - pauseStamp);
  if (elapsed < 0) elapsed = 0;

  const h = Math.floor(elapsed / 3600000);
  const m = Math.floor((elapsed % 3600000) / 60000);
  const s = Math.floor((elapsed % 60000) / 1000);
  timerEl.textContent =
    String(h).padStart(2, '0') + ':' +
    String(m).padStart(2, '0') + ':' +
    String(s).padStart(2, '0');
}

// ══════════════════════════════════════════════════════════════════════
//  UI HELPERS
// ══════════════════════════════════════════════════════════════════════

function updateControlsUI() {
  btnPause.disabled = !isRecording;
  btnStop.disabled  = !isRecording;
  btnRecord.classList.toggle('recording', isRecording);
  recBadge.classList.toggle('hidden', !isRecording);

  if (isPaused) {
    btnPause.classList.add('is-paused');
    recBadge.querySelector('.rec-label').textContent = 'PAUSED';
  } else {
    btnPause.classList.remove('is-paused');
    recBadge.querySelector('.rec-label').textContent = 'REC';
  }

  const hint = $('#shortcut-hint');
  if (isRecording) {
    hint.textContent = 'Ctrl+Shift+P to pause';
  } else {
    hint.textContent = 'Ctrl+Shift+R to record';
  }

  screenSelect.disabled = isRecording;
  btnRefresh.disabled   = isRecording;
}

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${type === 'success' ? '✓' : '!'}</span><span>${msg}</span>`;
  toastBox.appendChild(el);

  setTimeout(() => {
    el.style.animation = 'toastOut 0.3s ease-in forwards';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

// ── Mic meter animation loop ─────────────────────────────────────────
function meterLoop() {
  const level = readMicLevel();
  const fill = $('#mic-meter .meter-fill');
  if (fill) fill.style.width = `${level}%`;
  requestAnimationFrame(meterLoop);
}

// ══════════════════════════════════════════════════════════════════════
//  EVENT BINDINGS
// ══════════════════════════════════════════════════════════════════════

function bindEvents() {
  // ── Window controls ──
  $('#btn-min').addEventListener('click', () => window.studio.minimize());
  $('#btn-max').addEventListener('click', () => window.studio.maximize());
  $('#btn-close').addEventListener('click', () => window.studio.close());

  window.studio.onWindowState((maximized) => {
    const svg = $('#btn-max svg');
    if (maximized) {
      svg.innerHTML = '<rect x="4" y="4" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="2" y="2" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>';
    } else {
      svg.innerHTML = '<rect x="2" y="2" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/>';
    }
  });

  // ── Sources ──
  btnRefresh.addEventListener('click', async () => {
    btnRefresh.style.transform = 'rotate(360deg)';
    await refreshSources();
    setTimeout(() => { btnRefresh.style.transform = ''; }, 400);
  });

  screenSelect.addEventListener('change', () => {
    const id = screenSelect.value;
    if (id) startScreenCapture(id);
    else {
      stopScreenCapture();
      emptyState.classList.remove('hidden');
      cancelAnimationFrame(drawLoopId);
      drawIdle();
    }
  });

  // ── Resolution change restarts capture with new constraints ──
  resolutionSelect.addEventListener('change', () => {
    const id = screenSelect.value;
    if (id && !isRecording) startScreenCapture(id);
  });

  // ── Camera ──
  cameraToggle.addEventListener('change', () => {
    if (cameraToggle.checked && cameraSelect.value) {
      startWebcam(cameraSelect.value);
    } else {
      stopWebcam();
    }
  });

  cameraSelect.addEventListener('change', () => {
    if (cameraToggle.checked && cameraSelect.value) {
      startWebcam(cameraSelect.value);
    }
  });

  // ── Mic ──
  micToggle.addEventListener('change', () => {
    if (micToggle.checked && micSelect.value) {
      startMic(micSelect.value);
    } else {
      stopMic();
    }
  });

  micSelect.addEventListener('change', () => {
    if (micToggle.checked && micSelect.value) {
      startMic(micSelect.value);
    }
  });

  // ── Webcam overlay settings ──
  $$('.pos-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.pos-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      camPosition = btn.dataset.pos;
    });
  });

  webcamSizeSlider.addEventListener('input', () => {
    camSize = parseInt(webcamSizeSlider.value, 10);
    webcamSizeVal.textContent = camSize + '%';
  });

  $$('.shape-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.shape-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      camShape = btn.dataset.shape;
    });
  });

  borderToggle.addEventListener('change', () => {
    camBorder = borderToggle.checked;
  });

  borderColorPick.addEventListener('input', () => {
    camBorderColor = borderColorPick.value;
  });

  // ── Recording controls ──
  btnRecord.addEventListener('click', () => {
    if (!isRecording) beginRecording();
    else stopRecording();
  });

  btnPause.addEventListener('click', () => pauseRecording());
  btnStop.addEventListener('click', () => stopRecording());

  // ── Keyboard shortcuts from main process ──
  window.studio.onShortcut((action) => {
    if (action === 'toggle-recording') {
      if (!isRecording) beginRecording();
      else stopRecording();
    } else if (action === 'toggle-pause') {
      if (isRecording) pauseRecording();
    }
  });

  // ── Conversion progress from main process ──
  window.studio.onConvertProgress((pct) => {
    convertFill.style.width = `${pct}%`;
    convertPercent.textContent = `${pct}%`;
  });

  // Start mic if default is checked
  if (micToggle.checked && micSelect.value) {
    startMic(micSelect.value);
  }

  meterLoop();
}

// ══════════════════════════════════════════════════════════════════════
//  BOOT
// ══════════════════════════════════════════════════════════════════════
init();
