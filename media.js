// GeeChat — media handling: validated uploads with live progress and cancel,
// responsive image preparation, voice recording.
import { MEDIA_BASE, MEDIA_UPLOAD_PRESET, LIMITS } from './firebase.js';
import { el, qs, fmtSize, toast } from './ui.js';

// ---------- validation ----------
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
export const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/3gpp'];
export const AUDIO_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/webm', 'audio/wav'];
const DOC_TYPES = [
  'application/pdf', 'application/zip', 'text/plain', 'text/csv', 'text/markdown',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

export function validateFile(file, kind) {
  const map = {
    image: { types: IMAGE_TYPES, size: LIMITS.image, label: 'Image' },
    video: { types: VIDEO_TYPES, size: LIMITS.video, label: 'Video' },
    audio: { types: AUDIO_TYPES, size: LIMITS.audio, label: 'Audio' },
    file: { types: null, size: LIMITS.file, label: 'File' }, // documents: broad whitelist below
  };
  const rule = map[kind] || map.file;
  if (rule.types && !rule.types.includes(file.type) && !file.type.startsWith(`${kind}/`)) {
    throw new Error(`Unsupported ${rule.label.toLowerCase()} format (${file.type || 'unknown'}).`);
  }
  if (kind === 'file' && file.type && !DOC_TYPES.includes(file.type) && !/^image\//.test(file.type) && !/^video\//.test(file.type) && !/^audio\//.test(file.type)) {
    throw new Error('This document type is not supported.');
  }
  if (file.size > rule.size) throw new Error(`${rule.label} is too large — the limit is ${fmtSize(rule.size)}.`);
  if (file.size === 0) throw new Error('That file is empty.');
  return true;
}

// Downscale large images in the browser for faster uploads and delivery.
export function prepareImage(file, maxDim = 1920, quality = 0.86) {
  return new Promise((resolve) => {
    if (!IMAGE_TYPES.includes(file.type) || file.type === 'image/gif') return resolve(file);
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      if (scale === 1 && file.size < 1.5 * 1024 * 1024) return resolve(file);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => resolve(blob || file), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// Cloudinary square-crop URLs for avatars / thumbnails (responsive delivery).
export function sizedUrl(url, size) {
  if (!url || !url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${size},h_${size},c_fill/`);
}
export function fluidUrl(url) {
  if (!url || !url.includes('/upload/')) return url;
  return url.replace('/upload/', '/upload/f_auto,q_auto/');
}

// ---------- upload ----------
// Real XHR upload with progress events and cancellation. Resolves with the
// delivery metadata only after the service confirms the upload.
export function uploadMedia(file, { kind = 'file', onProgress = null } = {}) {
  return new Promise((resolve, reject) => {
    let prepared = file;
    const proceed = () => {
      const resourceType = ['image', 'video'].includes(kind) ? kind : 'auto';
      const endpoint = `${MEDIA_BASE}/${resourceType}/upload`;
      const form = new FormData();
      form.append('file', prepared);
      form.append('upload_preset', MEDIA_UPLOAD_PRESET);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', endpoint, true);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && res.secure_url) {
            resolve({
              url: res.secure_url,
              name: file.name || `${kind}-${Date.now()}`,
              size: file.size,
              mime: file.type || res.format && `${resourceType}/${res.format}` || kind,
              width: res.width || null,
              height: res.height || null,
              duration: res.duration ? Math.round(res.duration) : null,
              bytes: res.bytes,
            });
          } else {
            reject(new Error(res?.error?.message || 'The upload was rejected. Please try again.'));
          }
        } catch { reject(new Error('Unexpected upload response.')); }
      };
      xhr.onerror = () => reject(new Error('Network error during upload.'));
      xhr.onabort = () => reject(Object.assign(new Error('Upload cancelled'), { cancelled: true }));
      xhr.send(form);
      currentUploads.add(xhr);
    };
    if (kind === 'image') prepareImage(file).then(img => { prepared = img; proceed(); });
    else proceed();
  });
}
const currentUploads = new Set();
export function cancelAllUploads() {
  for (const xhr of currentUploads) xhr.abort();
  currentUploads.clear();
}

// ---------- pickers ----------
export function pickFile(accept, { capture } = {}) {
  return new Promise(resolve => {
    const input = qs('#hiddenFileInput');
    input.value = '';
    input.accept = accept || '';
    if (capture) input.setAttribute('capture', capture); else input.removeAttribute('capture');
    input.onchange = () => resolve(input.files[0] || null);
    input.click();
  });
}

// Generic upload progress bubble appended into the message stream.
export function makeProgressBubble(typeLabel, onCancel) {
  const bar = el('i');
  const bubble = el('div', { class: 'msg out' },
    el('div', { class: 'msg-body' },
      el('div', { class: 'bubble' },
        el('div', { class: 'm-upload' },
          el('span', { text: `${typeLabel}` }),
          el('div', { class: 'bar' }, bar),
          el('button', { class: 'icon-btn plain', 'aria-label': 'Cancel upload', onclick: () => onCancel?.() }, el('span', { text: '✕' })),
        ),
      ),
    ),
  );
  return {
    node: bubble,
    set(pct) { bar.style.width = `${pct}%`; },
    remove() { bubble.remove(); },
  };
}

// ---------- voice recorder ----------
export class VoiceRecorder {
  constructor() {
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
    this.startedAt = 0;
    this.mimeType = '';
  }
  async start() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Recording is not supported by this browser.');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const candidateTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
    this.mimeType = candidateTypes.find(t => MediaRecorder.isTypeSupported?.(t)) || '';
    this.recorder = new MediaRecorder(this.stream, this.mimeType ? { mimeType: this.mimeType } : undefined);
    this.chunks = [];
    this.recorder.ondataavailable = e => { if (e.data.size) this.chunks.push(e.data); };
    this.recorder.start(250);
    this.startedAt = Date.now();
  }
  get durationSec() { return (Date.now() - this.startedAt) / 1000; }
  async stop(cancel = false) {
    if (!this.recorder) return null;
    const done = new Promise(resolve => { this.recorder.onstop = resolve; });
    this.recorder.stop();
    await done;
    this.stream?.getTracks().forEach(t => t.stop());
    const duration = Math.max(1, Math.round(this.durationSec));
    if (cancel || this.chunks.length === 0) return null;
    const blob = new Blob(this.chunks, { type: this.mimeType || 'audio/webm' });
    if (duration < 1) return null;
    return new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
  }
}

// Voice playback widget with waveform bars and progress.
export function buildVoicePlayer(url, durationSec) {
  const audio = new Audio(url);
  audio.preload = 'metadata';
  const total = durationSec || 0;
  const timeLbl = el('span', { class: 'voice-time', text: fmtDuration(total) });
  const playBtn = el('button', { class: 'voice-play', 'aria-label': 'Play voice message' });
  let bars = [];
  const wave = el('div', { class: 'voice-wave' });
  const BAR_COUNT = 28;
  let seed = 7;
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = 0; i < BAR_COUNT; i++) {
    const h = 6 + rand() * 16;
    bars.push(el('i', { style: `height:${h}px` }));
  }
  wave.append(...bars);
  const track = el('div', { class: 'voice-track' }, wave);

  const setPlaying = (playing) => {
    playBtn.innerHTML = '';
    playBtn.append(el('span', { class: 'ic-16', text: playing ? '❚❚' : '▶' }));
  };
  setPlaying(false);

  const markProgress = () => {
    const played = audio.duration && audio.currentTime ? audio.currentTime / audio.duration : 0;
    const idx = Math.floor(played * BAR_COUNT);
    bars.forEach((b, i) => b.classList.toggle('played', i < idx));
    timeLbl.textContent = fmtDuration(audio.currentTime || 0);
  };

  playBtn.addEventListener('click', () => {
    if (audio.paused) { audio.play().catch(() => toast('Playback error', 'Could not play this recording.', { error: true })); }
    else audio.pause();
  });
  track.addEventListener('click', (e) => {
    const r = track.getBoundingClientRect();
    if (audio.duration) audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
  });
  audio.addEventListener('play', () => setPlaying(true));
  audio.addEventListener('pause', () => setPlaying(false));
  audio.addEventListener('ended', () => { setPlaying(false); markProgress(); });
  audio.addEventListener('timeupdate', markProgress);
  audio.addEventListener('loadedmetadata', () => { timeLbl.textContent = fmtDuration(audio.duration); });

  return el('div', { class: 'voice' }, playBtn, track, timeLbl);
}
