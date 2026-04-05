// ═══════════════════════════════════════════════════
//  Helix Studio — Frontend Logic v2
// ═══════════════════════════════════════════════════

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ─── State ───
let currentMode = "basic";
let currentAudioUrl = null;
let audioContext = null;
let audioBuffer = null;
let cachedPeaks = null;
const audioEl = new Audio();

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
let playbackSpeedIdx = 2;

// ─── Init ───
document.addEventListener("DOMContentLoaded", () => {
    initModeSelector();
    initTextInput();
    initTextImport();
    initTokenButtons();
    initMicRecorder();
    initFileUpload();
    initParams();
    initAdvancedParams();
    initGenerate();
    initPlayer();
    initPresets();
    initShortcuts();
    initHistory();
    initVoicePresets();
    loadLanguages();
    loadHistory();
    loadVoicePresets();
});

// ─── Toast ───
function showToast(message, type = "info") {
    const container = $("#toast-container");
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    const icons = { error: "!", success: "\u2713", info: "\u2139" };
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add("removing"); setTimeout(() => toast.remove(), 300); }, 4000);
}

// ─── Mode Selector ───
function initModeSelector() {
    $$(".mode-btn").forEach((btn) => btn.addEventListener("click", () => switchMode(btn.dataset.mode)));
}

function switchMode(mode) {
    currentMode = mode;
    $$(".mode-btn").forEach((b) => {
        const active = b.dataset.mode === mode;
        b.classList.toggle("active", active);
        b.setAttribute("aria-selected", active);
    });
    $("#clone-section").classList.toggle("hidden", mode !== "clone");
    $("#design-section").classList.toggle("hidden", mode !== "design");
}

// ─── Text Input ───
function initTextInput() {
    const textarea = $("#text-input");
    const counter = $("#char-count");
    const counterWrap = textarea.closest(".input-group").querySelector(".char-count");
    textarea.addEventListener("input", () => {
        const len = textarea.value.length;
        counter.textContent = len;
        counterWrap.classList.toggle("near-limit", len > 4000 && len <= 5000);
        counterWrap.classList.toggle("at-limit", len >= 5000);
    });
}

// ─── Non-verbal Token Buttons ───
function initTokenButtons() {
    $$(".token-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const textarea = $("#text-input");
            const token = btn.dataset.token;
            const pos = textarea.selectionStart;
            const before = textarea.value.substring(0, pos);
            const after = textarea.value.substring(textarea.selectionEnd);
            textarea.value = before + token + after;
            textarea.selectionStart = textarea.selectionEnd = pos + token.length;
            textarea.focus();
            // Update counter
            $("#char-count").textContent = textarea.value.length;
        });
    });
}

// ─── Text File Import ───
function initTextImport() {
    const btn = $("#btn-import-text");
    const input = $("#import-text-input");
    if (!btn || !input) return;

    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        input.click();
    });

    input.addEventListener("change", () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result.substring(0, 5000);
            $("#text-input").value = text;
            $("#char-count").textContent = text.length;
            showToast(`Загружен: ${file.name}`, "success");
        };
        reader.readAsText(file);
        input.value = "";
    });
}

// ─── Microphone Recorder (server-side via sounddevice) ───
function initMicRecorder() {
    const btn = $("#btn-record");
    if (!btn) return;

    let recording = false;
    let startTime = 0;
    let timerInterval = null;

    const idleEl = btn.querySelector(".rec-idle");
    const activeEl = btn.querySelector(".rec-active");
    const timerEl = $("#rec-timer");

    btn.addEventListener("click", async () => {
        if (recording) {
            // Stop recording
            btn.disabled = true;
            try {
                const res = await fetch("/api/mic/stop", { method: "POST" });
                if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || "Ошибка"); }
                const data = await res.json();

                // Download the recorded file and feed into trimmer
                const audioRes = await fetch(data.url);
                const blob = await audioRes.blob();
                const file = new File([blob], "recording.wav", { type: "audio/wav" });

                const input = $("#ref-audio-input");
                const dt = new DataTransfer();
                dt.items.add(file);
                input.files = dt.files;

                $("#file-name").textContent = "recording.wav";
                $("#selected-preset-id").value = "";
                $$(".voice-preset-card").forEach(c => c.classList.remove("selected"));
                $(".file-drop-content").classList.add("hidden");
                $("#file-loaded").classList.remove("hidden");
                initTrimmer(file);

                const dur = ((Date.now() - startTime) / 1000).toFixed(1);
                showToast(`Записано ${dur}с`, "success");
            } catch (err) {
                showToast(err.message, "error");
            } finally {
                recording = false;
                clearInterval(timerInterval);
                btn.classList.remove("recording");
                idleEl.classList.remove("hidden");
                activeEl.classList.add("hidden");
                btn.disabled = false;
            }
            return;
        }

        // Start recording
        try {
            const res = await fetch("/api/mic/start", { method: "POST" });
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || "Ошибка"); }

            recording = true;
            startTime = Date.now();
            btn.classList.add("recording");
            idleEl.classList.add("hidden");
            activeEl.classList.remove("hidden");

            timerInterval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                const m = Math.floor(elapsed / 60);
                const s = elapsed % 60;
                timerEl.textContent = `${m}:${s.toString().padStart(2, "0")}`;
                if (elapsed >= 30) btn.click(); // Auto-stop
            }, 250);
        } catch (err) {
            showToast("Не удалось начать запись: " + err.message, "error");
        }
    });
}

// ─── File Upload ───
function initFileUpload() {
    const drop = $("#file-drop");
    const input = $("#ref-audio-input");
    const content = drop.querySelector(".file-drop-content");
    const loaded = $("#file-loaded");

    drop.addEventListener("click", (e) => {
        // Don't open file picker when clicking on interactive elements inside the drop zone
        if (e.target.closest(".file-remove") || e.target.closest("audio") ||
            e.target.closest(".save-preset-row") || e.target.closest(".trimmer") ||
            e.target.closest(".btn-save-preset") || e.target.closest(".preset-name-input") ||
            e.target.closest("button") || e.target.closest("input") || e.target.closest("canvas")) {
            return;
        }
        // Only open file picker when clicking on the drop content area
        if (loaded.classList.contains("hidden") || e.target.closest(".file-drop-content")) {
            input.click();
        }
    });

    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("dragover"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("dragover"));
    drop.addEventListener("drop", (e) => {
        e.preventDefault();
        drop.classList.remove("dragover");
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    input.addEventListener("change", () => { if (input.files.length) handleFile(input.files[0]); });

    function handleFile(file) {
        if (!file.type.startsWith("audio/")) { showToast("Выберите аудиофайл", "error"); return; }
        input.files = createFileList(file);
        $("#file-name").textContent = file.name;
        // Deselect any preset
        $("#selected-preset-id").value = "";
        $$(".voice-preset-card").forEach(c => c.classList.remove("selected"));

        content.classList.add("hidden");
        loaded.classList.remove("hidden");
        // Init trimmer
        initTrimmer(file);
    }

    $("#file-remove").addEventListener("click", (e) => {
        e.stopPropagation();
        input.value = "";
        content.classList.remove("hidden");
        loaded.classList.add("hidden");
        // (preview handled by trimmer)
        // Reset trimmer
        trimmerBuffer = null;
        trimmerPeaks = null;
        trimStart = 0;
        trimEnd = 1;
    });

    // Transcribe
    $("#btn-transcribe").addEventListener("click", async () => {
        const file = input.files[0];
        if (!file) { showToast("Сначала загрузите аудио", "error"); return; }
        const btn = $("#btn-transcribe");
        btn.disabled = true;
        const fd = new FormData();
        fd.append("audio", file);
        try {
            const res = await fetch("/api/transcribe", { method: "POST", body: fd });
            if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || "Ошибка"); }
            const data = await res.json();
            if (data.text) { $("#ref-text").value = data.text; showToast("Транскрипция готова", "success"); }
        } catch (err) { showToast(err.message, "error"); }
        finally { btn.disabled = false; }
    });

    // Save as voice preset
    $("#btn-save-preset").addEventListener("click", saveVoicePreset);
}

function createFileList(file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    return dt.files;
}

// ─── Audio Trimmer ───
let trimmerBuffer = null;
let trimmerCtx = null;
let trimStart = 0;    // ratio 0-1
let trimEnd = 1;      // ratio 0-1
let trimmerPeaks = null;
let trimmerPreviewAudio = null;
let draggingHandle = null;

function initTrimmer(file) {
    const canvas = $("#trimmer-canvas");
    if (!trimmerCtx) trimmerCtx = new (window.AudioContext || window.webkitAudioContext)();

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            trimmerBuffer = await trimmerCtx.decodeAudioData(e.target.result);
            trimStart = 0;
            trimEnd = 1;
            computeTrimmerPeaks();
            drawTrimmer();
            updateTrimmerInfo();
            initTrimmerDrag();
        } catch (err) {
            console.error("Trimmer decode error:", err);
        }
    };
    reader.readAsArrayBuffer(file);

    // Play / Pause trimmed section
    const playBtn = $("#trimmer-play");
    let trimmerPlaying = false;
    let trimmerAnimFrame = null;

    function stopTrimmerPlayback() {
        if (trimmerPreviewAudio) { trimmerPreviewAudio.pause(); trimmerPreviewAudio = null; }
        trimmerPlaying = false;
        playBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="14"><polygon points="5,3 19,12 5,21"/></svg>';
        if (trimmerAnimFrame) { cancelAnimationFrame(trimmerAnimFrame); trimmerAnimFrame = null; }
        drawTrimmer(); // redraw without playhead
        updateTrimmerInfo();
    }

    function updateTrimmerPlayhead() {
        if (!trimmerPreviewAudio || trimmerPreviewAudio.paused) return;
        const startSec = trimStart * trimmerBuffer.duration;
        const endSec = trimEnd * trimmerBuffer.duration;
        const currentSec = startSec + trimmerPreviewAudio.currentTime;
        // Update time display
        $("#trimmer-time").textContent = `${currentSec.toFixed(1)}s / ${endSec.toFixed(1)}s`;
        // Draw playhead on waveform
        drawTrimmer();
        const canvas = $("#trimmer-canvas");
        const ctx = canvas.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;
        ctx.save();
        ctx.scale(dpr, dpr);
        const playRatio = currentSec / trimmerBuffer.duration;
        const px = Math.floor(playRatio * width);
        ctx.fillStyle = "#fff";
        ctx.fillRect(px, 0, 2, height);
        // Small triangle at top
        ctx.beginPath();
        ctx.moveTo(px - 4, 0);
        ctx.lineTo(px + 4, 0);
        ctx.lineTo(px, 6);
        ctx.closePath();
        ctx.fillStyle = "#e8b84d";
        ctx.fill();
        ctx.restore();
        trimmerAnimFrame = requestAnimationFrame(updateTrimmerPlayhead);
    }

    playBtn.onclick = () => {
        if (!trimmerBuffer) return;

        // If playing — pause
        if (trimmerPlaying && trimmerPreviewAudio && !trimmerPreviewAudio.paused) {
            trimmerPreviewAudio.pause();
            trimmerPlaying = false;
            playBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="14"><polygon points="5,3 19,12 5,21"/></svg>';
            if (trimmerAnimFrame) { cancelAnimationFrame(trimmerAnimFrame); trimmerAnimFrame = null; }
            return;
        }

        // If paused and there's existing audio — resume
        if (trimmerPreviewAudio && trimmerPreviewAudio.paused && trimmerPreviewAudio.currentTime > 0) {
            trimmerPreviewAudio.play();
            trimmerPlaying = true;
            playBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="14"><rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/></svg>';
            trimmerAnimFrame = requestAnimationFrame(updateTrimmerPlayhead);
            return;
        }

        // Start fresh playback
        stopTrimmerPlayback();
        const startSec = trimStart * trimmerBuffer.duration;
        const endSec = trimEnd * trimmerBuffer.duration;
        const sr = trimmerBuffer.sampleRate;
        const startSample = Math.floor(startSec * sr);
        const endSample = Math.floor(endSec * sr);
        const length = Math.max(1, endSample - startSample);
        const offlineCtx = new OfflineAudioContext(1, length, sr);
        const source = offlineCtx.createBufferSource();
        source.buffer = trimmerBuffer;
        source.connect(offlineCtx.destination);
        source.start(0, startSec, endSec - startSec);
        offlineCtx.startRendering().then(rendered => {
            const wav = audioBufferToWav(rendered);
            const blob = new Blob([wav], { type: "audio/wav" });
            const url = URL.createObjectURL(blob);
            trimmerPreviewAudio = new Audio(url);
            trimmerPreviewAudio.play();
            trimmerPlaying = true;
            playBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="14"><rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/></svg>';
            trimmerAnimFrame = requestAnimationFrame(updateTrimmerPlayhead);
            trimmerPreviewAudio.onended = () => {
                URL.revokeObjectURL(url);
                stopTrimmerPlayback();
            };
        });
    };

    // Reset
    $("#trimmer-reset").onclick = () => {
        stopTrimmerPlayback();
        trimStart = 0;
        trimEnd = 1;
        drawTrimmer();
        updateTrimmerInfo();
    };
}

function computeTrimmerPeaks() {
    if (!trimmerBuffer) return;
    const canvas = $("#trimmer-canvas");
    const width = canvas.offsetWidth;
    const data = trimmerBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    trimmerPeaks = [];
    for (let i = 0; i < width; i++) {
        let min = 1, max = -1;
        for (let j = 0; j < step; j++) {
            const val = data[i * step + j] || 0;
            if (val < min) min = val;
            if (val > max) max = val;
        }
        trimmerPeaks.push({ min, max });
    }
}

function drawTrimmer() {
    if (!trimmerPeaks) return;
    const canvas = $("#trimmer-canvas");
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    const mid = height / 2;

    const leftX = Math.floor(trimStart * width);
    const rightX = Math.floor(trimEnd * width);

    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < trimmerPeaks.length && i < width; i++) {
        const { min, max } = trimmerPeaks[i];
        const barHeight = Math.max(1, (max - min) * mid);
        const inSelection = i >= leftX && i <= rightX;
        ctx.fillStyle = inSelection ? "rgba(232, 184, 77, 0.7)" : "rgba(100, 100, 100, 0.25)";
        ctx.fillRect(i, mid - barHeight / 2, 1, barHeight);
    }

    // Update selection overlay position
    const sel = $("#trimmer-selection");
    sel.style.left = (trimStart * 100) + "%";
    sel.style.width = ((trimEnd - trimStart) * 100) + "%";
}

function updateTrimmerInfo() {
    if (!trimmerBuffer) return;
    const dur = trimmerBuffer.duration;
    const startSec = (trimStart * dur).toFixed(1);
    const endSec = (trimEnd * dur).toFixed(1);
    const selDur = ((trimEnd - trimStart) * dur).toFixed(1);
    $("#trimmer-time").textContent = `${startSec}s — ${endSec}s`;
    $("#trimmer-duration").textContent = `= ${selDur}s`;
}

function initTrimmerDrag() {
    const canvas = $("#trimmer-canvas");
    const container = canvas.parentElement;

    function getPointerRatio(e) {
        const rect = canvas.getBoundingClientRect();
        return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    }

    $("#trimmer-left").onmousedown = (e) => { e.preventDefault(); draggingHandle = "left"; };
    $("#trimmer-right").onmousedown = (e) => { e.preventDefault(); draggingHandle = "right"; };
    // Touch support
    $("#trimmer-left").ontouchstart = (e) => { e.preventDefault(); draggingHandle = "left"; };
    $("#trimmer-right").ontouchstart = (e) => { e.preventDefault(); draggingHandle = "right"; };

    function onMove(e) {
        if (!draggingHandle) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const rect = canvas.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));

        if (draggingHandle === "left") {
            trimStart = Math.min(ratio, trimEnd - 0.02);
        } else {
            trimEnd = Math.max(ratio, trimStart + 0.02);
        }
        drawTrimmer();
        updateTrimmerInfo();
    }

    function onUp() { draggingHandle = null; }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onMove);
    document.addEventListener("touchend", onUp);

    // Click on waveform to set nearest handle
    canvas.addEventListener("click", (e) => {
        if (draggingHandle) return;
        const ratio = getPointerRatio(e);
        const distToLeft = Math.abs(ratio - trimStart);
        const distToRight = Math.abs(ratio - trimEnd);
        if (distToLeft < distToRight) {
            trimStart = Math.min(ratio, trimEnd - 0.02);
        } else {
            trimEnd = Math.max(ratio, trimStart + 0.02);
        }
        drawTrimmer();
        updateTrimmerInfo();
    });
}

// Get the trimmed audio as a File object for upload
function getTrimmedFile() {
    if (!trimmerBuffer) return null;
    // If no trimming was done, return original file
    if (trimStart <= 0.001 && trimEnd >= 0.999) {
        return $("#ref-audio-input").files[0] || null;
    }

    const sr = trimmerBuffer.sampleRate;
    const startSample = Math.floor(trimStart * trimmerBuffer.duration * sr);
    const endSample = Math.floor(trimEnd * trimmerBuffer.duration * sr);
    const length = endSample - startSample;

    const channels = trimmerBuffer.numberOfChannels;
    const offlineCtx = new OfflineAudioContext(channels, length, sr);
    const source = offlineCtx.createBufferSource();
    source.buffer = trimmerBuffer;
    source.connect(offlineCtx.destination);
    source.start(0, trimStart * trimmerBuffer.duration, (trimEnd - trimStart) * trimmerBuffer.duration);

    return offlineCtx.startRendering().then(rendered => {
        const wav = audioBufferToWav(rendered);
        const blob = new Blob([wav], { type: "audio/wav" });
        return new File([blob], "trimmed.wav", { type: "audio/wav" });
    });
}

// WAV encoder
function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;

    let interleaved;
    if (numChannels === 1) {
        interleaved = buffer.getChannelData(0);
    } else {
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);
        interleaved = new Float32Array(left.length + right.length);
        for (let i = 0; i < left.length; i++) {
            interleaved[i * 2] = left[i];
            interleaved[i * 2 + 1] = right[i];
        }
    }

    const dataLength = interleaved.length * bytesPerSample;
    const bufferOut = new ArrayBuffer(44 + dataLength);
    const view = new DataView(bufferOut);

    // WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
    view.setUint16(32, numChannels * bytesPerSample, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    let offset = 44;
    for (let i = 0; i < interleaved.length; i++) {
        const s = Math.max(-1, Math.min(1, interleaved[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        offset += 2;
    }

    return bufferOut;
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

// ─── Voice Presets ───
function initVoicePresets() {}

async function loadVoicePresets() {
    try {
        const res = await fetch("/api/presets");
        const presets = await res.json();
        renderVoicePresets(presets);
    } catch (err) { console.error("Presets error:", err); }
}

function renderVoicePresets(presets) {
    const list = $("#voice-presets-list");
    if (!presets.length) {
        list.innerHTML = '<div class="preset-empty">Нет сохранённых голосов</div>';
        return;
    }
    let presetAudio = null; // shared audio element for preset previews

    list.innerHTML = presets.map(p => `
        <div class="voice-preset-card" data-id="${escapeHtml(p.id)}">
            <button class="vp-play" data-id="${escapeHtml(p.id)}" title="Прослушать" aria-label="Прослушать пресет">
                <svg class="vp-play-icon" viewBox="0 0 24 24" fill="currentColor" width="14"><polygon points="6,4 18,12 6,20"/></svg>
                <svg class="vp-pause-icon hidden" viewBox="0 0 24 24" fill="currentColor" width="14"><rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/></svg>
            </button>
            <div class="vp-info">
                <div class="vp-name">${escapeHtml(p.name)}</div>
                <div class="vp-text">${escapeHtml(p.ref_text || "")}</div>
            </div>
            <button class="vp-delete" data-id="${escapeHtml(p.id)}" title="Удалить">&times;</button>
        </div>
    `).join("");

    // Play/pause preset preview
    function stopPresetAudio() {
        if (presetAudio) { presetAudio.pause(); presetAudio = null; }
        list.querySelectorAll(".vp-play").forEach(b => {
            b.querySelector(".vp-play-icon").classList.remove("hidden");
            b.querySelector(".vp-pause-icon").classList.add("hidden");
        });
    }

    list.querySelectorAll(".vp-play").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const playIcon = btn.querySelector(".vp-play-icon");
            const pauseIcon = btn.querySelector(".vp-pause-icon");

            // If already playing this preset — pause
            if (presetAudio && presetAudio._presetId === id && !presetAudio.paused) {
                presetAudio.pause();
                playIcon.classList.remove("hidden");
                pauseIcon.classList.add("hidden");
                return;
            }

            // Stop any other playing preset
            stopPresetAudio();

            // Play this preset
            presetAudio = new Audio(`/api/presets/${id}/preview`);
            presetAudio._presetId = id;
            presetAudio.play();
            playIcon.classList.add("hidden");
            pauseIcon.classList.remove("hidden");

            presetAudio.onended = () => {
                playIcon.classList.remove("hidden");
                pauseIcon.classList.add("hidden");
                presetAudio = null;
            };
        });
    });

    // Select preset (click on card, not on play/delete)
    list.querySelectorAll(".voice-preset-card").forEach(card => {
        card.addEventListener("click", (e) => {
            if (e.target.closest(".vp-delete") || e.target.closest(".vp-play")) return;
            $$(".voice-preset-card").forEach(c => c.classList.remove("selected"));
            card.classList.add("selected");
            $("#selected-preset-id").value = card.dataset.id;
            // Clear file upload when using preset
            const input = $("#ref-audio-input");
            input.value = "";
            $("#file-loaded").classList.add("hidden");
            $("#file-drop").querySelector(".file-drop-content").classList.remove("hidden");
        });
    });

    // Delete preset
    list.querySelectorAll(".vp-delete").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            if (!confirm("Удалить этот голосовой пресет?")) return;
            stopPresetAudio();
            await fetch(`/api/presets/${id}`, { method: "DELETE" });
            if ($("#selected-preset-id").value === id) $("#selected-preset-id").value = "";
            loadVoicePresets();
            showToast("Пресет удалён", "success");
        });
    });
}

async function saveVoicePreset() {
    const file = $("#ref-audio-input").files[0];
    if (!file) { showToast("Сначала загрузите аудиофайл", "error"); return; }
    const name = $("#preset-name-input").value.trim() || file.name.replace(/\.[^.]+$/, "");

    const btn = $("#btn-save-preset");
    const btnText = btn.querySelector("span");
    const origText = btnText.textContent;
    btn.disabled = true;
    btnText.textContent = "Сохраняю...";

    const fd = new FormData();
    fd.append("name", name);
    fd.append("ref_audio", file);
    fd.append("ref_text", $("#ref-text").value);

    try {
        const res = await fetch("/api/presets", { method: "POST", body: fd });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || "Ошибка сохранения"); }
        const preset = await res.json();
        showToast(`Голос «${preset.name}» сохранён!`, "success");
        $("#preset-name-input").value = "";
        await loadVoicePresets();
        // Auto-select the new preset and highlight it
        setTimeout(() => {
            const card = $(`.voice-preset-card[data-id="${preset.id}"]`);
            if (card) {
                card.click();
                card.style.animation = "fadeIn 0.5s ease";
            }
        }, 300);
    } catch (err) { showToast(err.message, "error"); }
    finally { btn.disabled = false; btnText.textContent = origText; }
}

// ─── Parameters ───
function initParams() {
    const toggle = $("#params-toggle");
    const body = $("#params-body");
    toggle.addEventListener("click", () => {
        body.classList.toggle("collapsed");
        toggle.querySelector(".params-chevron").style.transform = body.classList.contains("collapsed") ? "rotate(-90deg)" : "";
    });

    bindSlider("speed-slider", "speed-display", (v) => parseFloat(v).toFixed(1) + "\u00d7");
    bindSlider("steps-slider", "steps-display");

    const durInput = $("#duration-input");
    durInput.addEventListener("input", () => {
        const v = parseFloat(durInput.value) || 0;
        $("#duration-display").textContent = v > 0 ? v + "s" : "Авто";
    });
}

function bindSlider(sliderId, displayId, format) {
    const slider = $(`#${sliderId}`);
    const display = $(`#${displayId}`);
    slider.addEventListener("input", () => {
        display.textContent = format ? format(slider.value) : slider.value;
    });
}

// ─── Advanced Parameters ───
function initAdvancedParams() {
    const toggle = $("#advanced-toggle");
    const panel = $("#advanced-params");
    toggle.addEventListener("click", () => {
        panel.classList.toggle("hidden");
        toggle.querySelector(".params-chevron").style.transform = panel.classList.contains("hidden") ? "rotate(-90deg)" : "";
    });

    bindSlider("guidance-slider", "guidance-display", (v) => parseFloat(v).toFixed(1));
    bindSlider("class-temp-slider", "class-temp-display", (v) => parseFloat(v).toFixed(1));
    bindSlider("pos-temp-slider", "pos-temp-display", (v) => parseFloat(v).toFixed(1));
}

// ─── Presets & Tags ───
function initPresets() {
    $$(".preset-chip[data-preset]").forEach((chip) => {
        chip.addEventListener("click", () => { $("#instruct-input").value = chip.dataset.preset; syncTagHighlights(); });
    });
    $$(".preset-chip[data-tag]").forEach((chip) => {
        chip.addEventListener("click", () => {
            const tag = chip.dataset.tag;
            const input = $("#instruct-input");
            const tags = parseTags(input.value);
            if (tags.includes(tag)) tags.splice(tags.indexOf(tag), 1);
            else tags.push(tag);
            input.value = tags.join(", ");
            syncTagHighlights();
        });
    });
    $("#instruct-input").addEventListener("input", syncTagHighlights);
}

function parseTags(value) { return value.split(",").map(s => s.trim()).filter(Boolean); }

function syncTagHighlights() {
    const tags = parseTags($("#instruct-input").value);
    $$(".preset-chip[data-tag]").forEach(c => c.classList.toggle("active-tag", tags.includes(c.dataset.tag)));
}

// ─── Languages ───
let allLanguages = []; // [{id, name, flag, popular}]
let selectedLangId = "";

function getLangInfo(id) {
    const d = (typeof LANG_DATA !== "undefined") ? LANG_DATA[id] : null;
    return d || { flag: "🌐", name: id };
}

async function loadLanguages() {
    try {
        const res = await fetch("/api/languages");
        const data = await res.json();
        const popularIds = new Set(data.popular.map(p => p.id));

        allLanguages = [
            ...data.popular.map(p => {
                const info = getLangInfo(p.id);
                return { id: p.id, name: p.name, flag: info.flag, popular: true };
            }),
            ...data.all_ids.filter(id => !popularIds.has(id)).map(id => {
                const info = getLangInfo(id);
                return { id, name: info.name, flag: info.flag, popular: false };
            }),
        ];

        initLangPicker();
    } catch (err) { console.error("Languages:", err); }
}

function initLangPicker() {
    const picker = $("#lang-picker");
    const btn = $("#lang-picker-btn");
    const dropdown = $("#lang-dropdown");
    const searchInput = $("#lang-search");

    // Toggle dropdown
    btn.addEventListener("click", () => {
        const isOpen = !dropdown.classList.contains("hidden");
        if (isOpen) { closeLangPicker(); } else { openLangPicker(); }
    });

    // Close on outside click
    document.addEventListener("click", (e) => {
        if (!picker.contains(e.target)) closeLangPicker();
    });

    // Search
    searchInput.addEventListener("input", () => renderLangList(searchInput.value.trim()));

    // Initial render
    renderLangList("");
}

function openLangPicker() {
    $("#lang-dropdown").classList.remove("hidden");
    $("#lang-picker").classList.add("open");
    const searchInput = $("#lang-search");
    searchInput.value = "";
    searchInput.focus();
    renderLangList("");
}

function closeLangPicker() {
    $("#lang-dropdown").classList.add("hidden");
    $("#lang-picker").classList.remove("open");
}

function selectLanguage(id) {
    selectedLangId = id;
    $("#language-select").value = id;
    const lang = allLanguages.find(l => l.id === id);
    if (id && lang) {
        $("#lang-picker-flag").textContent = lang.flag;
        $("#lang-picker-text").textContent = `${lang.name} (${lang.id})`;
        $("#lang-display").textContent = lang.name;
    } else {
        $("#lang-picker-flag").textContent = "🌐";
        $("#lang-picker-text").textContent = "Авто-определение";
        $("#lang-display").textContent = "Авто";
    }
    closeLangPicker();
}

function langItemHtml(l) {
    return `<div class="lang-item${selectedLangId === l.id ? " selected" : ""}" data-id="${l.id}">
        <span class="li-flag">${l.flag}</span><span class="li-name">${escapeHtml(l.name)}</span><span class="li-code">${l.id}</span>
    </div>`;
}

function renderLangList(query) {
    const list = $("#lang-list");
    const q = query.toLowerCase();

    let html = "";

    // Auto option
    const autoMatch = !q || "авто".includes(q) || "auto".includes(q);
    if (autoMatch) {
        html += `<div class="lang-item${selectedLangId === "" ? " selected" : ""}" data-id="">
            <span class="li-flag">🌐</span><span class="li-name">Авто-определение</span><span class="li-code">auto</span>
        </div>`;
    }

    // Filter all languages
    const filtered = q
        ? allLanguages.filter(l => l.name.toLowerCase().includes(q) || l.id.includes(q))
        : allLanguages;

    // Popular
    const popular = filtered.filter(l => l.popular);
    if (popular.length) {
        html += `<div class="lang-group-label">Популярные</div>`;
        html += popular.map(langItemHtml).join("");
    }

    // Others — show all with names, sorted alphabetically
    const others = filtered.filter(l => !l.popular).sort((a, b) => a.name.localeCompare(b.name));
    if (others.length) {
        html += `<div class="lang-group-label">Все языки (${others.length})</div>`;
        // Show up to 80 to keep it smooth
        html += others.slice(0, 80).map(langItemHtml).join("");
        if (others.length > 80) {
            html += `<div class="lang-no-results">Ещё ${others.length - 80}... введите запрос для поиска</div>`;
        }
    }

    if (!html) {
        html = `<div class="lang-no-results">Ничего не найдено</div>`;
    }

    list.innerHTML = html;

    list.querySelectorAll(".lang-item").forEach(item => {
        item.addEventListener("click", () => selectLanguage(item.dataset.id));
    });
}

// ─── Shortcuts ───
function initShortcuts() {
    $("#shortcuts-toggle").addEventListener("click", () => $("#shortcuts-overlay").classList.toggle("hidden"));
    $("#shortcuts-close").addEventListener("click", () => $("#shortcuts-overlay").classList.add("hidden"));
    $("#shortcuts-overlay").addEventListener("click", (e) => { if (e.target === $("#shortcuts-overlay")) $("#shortcuts-overlay").classList.add("hidden"); });

    document.addEventListener("keydown", (e) => {
        const inInput = ["TEXTAREA", "INPUT", "SELECT"].includes(document.activeElement?.tagName);

        if (e.key === "Escape") { $("#shortcuts-overlay").classList.add("hidden"); return; }
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); generate(); return; }
        if (inInput) return;
        if (e.key === " " && currentAudioUrl) { e.preventDefault(); audioEl.paused ? audioEl.play() : audioEl.pause(); return; }
        if (e.key === "1") switchMode("basic");
        if (e.key === "2") switchMode("clone");
        if (e.key === "3") switchMode("design");
    });
}

// ─── Generate ───
function initGenerate() {
    $("#btn-generate").addEventListener("click", generate);
    $("#error-retry").addEventListener("click", generate);
}

async function generate() {
    const btn = $("#btn-generate");
    if (btn.disabled) return;

    const text = $("#text-input").value.trim();
    if (!text) { $("#text-input").focus(); showToast("Введите текст", "error"); return; }

    btn.disabled = true;
    btn.querySelector(".btn-generate-content").classList.add("hidden");
    btn.querySelector(".btn-generate-loading").classList.remove("hidden");
    $("#output-error").classList.add("hidden");

    const fd = new FormData();
    fd.append("text", text);
    fd.append("mode", currentMode);
    fd.append("language", $("#language-select").value);
    fd.append("speed", $("#speed-slider").value);
    fd.append("num_step", $("#steps-slider").value);
    fd.append("duration", $("#duration-input").value || "0");
    fd.append("guidance_scale", $("#guidance-slider").value);
    fd.append("class_temperature", $("#class-temp-slider").value);
    fd.append("position_temperature", $("#pos-temp-slider").value);
    fd.append("denoise", $("#denoise-check").checked ? "true" : "false");
    fd.append("preprocess_prompt", $("#preprocess-check").checked ? "true" : "false");
    fd.append("postprocess_output", $("#postprocess-check").checked ? "true" : "false");

    if (currentMode === "clone") {
        const presetId = $("#selected-preset-id").value;
        if (presetId) {
            fd.append("preset_id", presetId);
        } else if (trimmerBuffer && (trimStart > 0.001 || trimEnd < 0.999)) {
            // Use trimmed audio
            const trimmedFile = await getTrimmedFile();
            if (trimmedFile) fd.append("ref_audio", trimmedFile);
        } else {
            const refFile = $("#ref-audio-input").files[0];
            if (refFile) fd.append("ref_audio", refFile);
        }
        fd.append("ref_text", $("#ref-text").value);
    } else if (currentMode === "design") {
        fd.append("instruct", $("#instruct-input").value);
    }

    try {
        const res = await fetch("/api/generate", { method: "POST", body: fd });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || "Ошибка"); }
        const data = await res.json();
        showPlayer(data);
        loadHistory();
        showToast(`Готово за ${data.elapsed}с`, "success");
    } catch (err) {
        showError(err.message);
    } finally {
        btn.disabled = false;
        btn.querySelector(".btn-generate-content").classList.remove("hidden");
        btn.querySelector(".btn-generate-loading").classList.add("hidden");
    }
}

function showError(message) {
    $("#output-empty").classList.add("hidden");
    $("#output-player").classList.add("hidden");
    $("#output-error").classList.remove("hidden");
    $("#error-message").textContent = message;
}

// ─── Player ───
function initPlayer() {
    $("#player-play").addEventListener("click", () => { audioEl.paused ? audioEl.play() : audioEl.pause(); });
    audioEl.addEventListener("play", () => { $("#play-icon").classList.add("hidden"); $("#pause-icon").classList.remove("hidden"); });
    audioEl.addEventListener("pause", () => { $("#play-icon").classList.remove("hidden"); $("#pause-icon").classList.add("hidden"); });
    audioEl.addEventListener("ended", () => { $("#play-icon").classList.remove("hidden"); $("#pause-icon").classList.add("hidden"); });
    audioEl.addEventListener("timeupdate", () => { $("#player-current").textContent = formatTime(audioEl.currentTime); drawWaveformProgress(); });

    $("#waveform-canvas").addEventListener("click", (e) => {
        if (!audioEl.duration) return;
        const rect = e.target.getBoundingClientRect();
        audioEl.currentTime = ((e.clientX - rect.left) / rect.width) * audioEl.duration;
    });

    $("#playback-speed").addEventListener("click", () => {
        playbackSpeedIdx = (playbackSpeedIdx + 1) % PLAYBACK_SPEEDS.length;
        const speed = PLAYBACK_SPEEDS[playbackSpeedIdx];
        audioEl.playbackRate = speed;
        $("#playback-speed").textContent = speed + "\u00d7";
    });

    // Download buttons — use fetch+blob for pywebview compatibility
    $("#player-download").addEventListener("click", (e) => {
        e.preventDefault();
        downloadFile($("#player-download").href, "helix-audio.wav");
    });
    $("#player-download-mp3").addEventListener("click", (e) => {
        e.preventDefault();
        downloadFile($("#player-download-mp3").href, "helix-audio.mp3");
    });
}

async function downloadFile(url, filename) {
    try {
        // Try pywebview native save dialog
        if (window.pywebview && window.pywebview.api) {
            const saved = await window.pywebview.api.save_file(url, filename);
            if (saved) showToast("Файл сохранён", "success");
            return;
        }
        // Fallback for browser
        const res = await fetch(url);
        if (!res.ok) throw new Error("Ошибка скачивания");
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    } catch (err) {
        showToast(err.message, "error");
    }
}

function showPlayer(data) {
    $("#output-empty").classList.add("hidden");
    $("#output-error").classList.add("hidden");
    $("#output-player").classList.remove("hidden");
    currentAudioUrl = data.audio_url;
    audioEl.src = data.audio_url;
    audioEl.playbackRate = PLAYBACK_SPEEDS[playbackSpeedIdx];
    audioEl.load();
    $("#player-duration").textContent = formatTime(data.duration);
    $("#player-current").textContent = "0:00";
    $("#meta-elapsed").textContent = data.elapsed ? data.elapsed + "s" : "";
    $("#player-download").href = data.audio_url;
    $("#player-download-mp3").href = data.audio_url + "/mp3";
    fetchAndDrawWaveform(data.audio_url);
    audioEl.play().catch(() => {});
}

async function fetchAndDrawWaveform(url) {
    try {
        if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const resp = await fetch(url);
        const ab = await resp.arrayBuffer();
        audioBuffer = await audioContext.decodeAudioData(ab);
        computePeaks();
        drawWaveformProgress();
    } catch (err) { console.error("Waveform:", err); }
}

function computePeaks() {
    if (!audioBuffer) return;
    const canvas = $("#waveform-canvas");
    const width = canvas.offsetWidth;
    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    cachedPeaks = [];
    for (let i = 0; i < width; i++) {
        let min = 1, max = -1;
        for (let j = 0; j < step; j++) {
            const val = data[i * step + j] || 0;
            if (val < min) min = val;
            if (val > max) max = val;
        }
        cachedPeaks.push({ min, max });
    }
}

function drawWaveformProgress() {
    if (!cachedPeaks || !cachedPeaks.length) return;
    const canvas = $("#waveform-canvas");
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    const mid = height / 2;
    const progress = audioEl.duration ? audioEl.currentTime / audioEl.duration : 0;
    const progressX = Math.floor(progress * width);
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < cachedPeaks.length && i < width; i++) {
        const { min, max } = cachedPeaks[i];
        const barHeight = Math.max(2, (max - min) * mid);
        ctx.fillStyle = i <= progressX ? "rgba(232, 184, 77, 0.85)" : "rgba(212, 160, 67, 0.2)";
        ctx.fillRect(i, mid - barHeight / 2, 1, barHeight);
    }
    if (progressX > 0) { ctx.fillStyle = "#e8b84d"; ctx.fillRect(progressX, 0, 2, height); }
}

// ─── History ───
function initHistory() {
    $("#history-clear").addEventListener("click", clearHistory);
}

async function clearHistory() {
    if (!confirm("Очистить всю историю?")) return;
    audioEl.pause(); audioEl.src = ""; currentAudioUrl = null;
    await fetch("/api/history/clear", { method: "POST" });
    loadHistory();
    $("#output-empty").classList.remove("hidden");
    $("#output-player").classList.add("hidden");
    $("#output-error").classList.add("hidden");
    showToast("История очищена", "success");
}

async function loadHistory() {
    try {
        const res = await fetch("/api/history");
        renderHistory(await res.json());
    } catch (err) { console.error("History:", err); }
}

function renderHistory(history) {
    const list = $("#history-list");
    const countEl = $("#history-count");
    if (!history.length) { list.innerHTML = '<div class="history-empty">Пока пусто</div>'; countEl.textContent = ""; return; }
    countEl.textContent = `(${history.length})`;
    const modeLabels = { basic: "ТТС", clone: "Клон", design: "Дизайн" };
    list.innerHTML = history.map(item => `
        <div class="history-item" data-url="/audio/${escapeHtml(item.filename)}" data-duration="${item.duration || 0}">
            <div class="history-play"><svg viewBox="0 0 24 24" fill="currentColor" width="12"><polygon points="6,4 18,12 6,20"/></svg></div>
            <div class="history-info">
                <div class="history-text">${escapeHtml(item.text)}</div>
                <div class="history-meta">
                    <span class="history-mode">${modeLabels[item.mode] || item.mode}</span>
                    <span>${item.duration || 0}s</span>
                    <span>${(item.timestamp || "").split(" ")[1] || ""}</span>
                </div>
            </div>
        </div>
    `).join("");

    list.querySelectorAll(".history-item").forEach(el => {
        el.addEventListener("click", () => {
            showPlayer({ audio_url: el.dataset.url, duration: parseFloat(el.dataset.duration) || 0, elapsed: "" });
            audioEl.addEventListener("loadedmetadata", () => { $("#player-duration").textContent = formatTime(audioEl.duration); }, { once: true });
        });
    });
}

// ─── Utilities ───
function formatTime(s) {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
