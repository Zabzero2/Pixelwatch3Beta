// Kamera-Steuerung, Berechtigungs-Initialisierung, System-Start/Stop & Haupt-Renderloop

import {
    video, canvas, ctx, cameraSelect, slideCamZoom, valCamZoom,
    chkAudioGuard
} from './dom.js';
import { state, FRAME_INTERVAL } from './state.js';
import { createZoomDisplays, updateMonitorButtonUI, showToast } from './ui.js';
import { initAudio, restartAudioSystem, stopAudioSystem, processAudio, getRoomAudioStream } from './audio.js';
import { fetchWeather } from './weather.js';
import { startTelegramPolling, stopTelegramPolling, stopLiveListen } from './telegram.js';
import { analyzeAnchor, analyzeMute, analyzeBoxes, drawUI } from './analyzer.js';

// Fragt direkt beim Start der Seite Kamera- UND Mikrofon-Berechtigung ab,
// damit später unterwegs auch Remote-Befehle wie /audio problemlos funktionieren.
export async function requestInitialPermissions() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        stream.getTracks().forEach(t => t.stop());
        state.permissionsGranted = true;
        await loadCameras();
    } catch (err) {
        // Falls Kamera oder Mikrofon einzeln abgefragt werden müssen:
        try {
            const vStream = await navigator.mediaDevices.getUserMedia({ video: true });
            vStream.getTracks().forEach(t => t.stop());
            await loadCameras();
        } catch (e) {}
        try {
            const aStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            aStream.getTracks().forEach(t => t.stop());
        } catch (e) {}
    }
}

export async function loadCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        if (videoDevices.length > 0) {
            cameraSelect.innerHTML = '';
            videoDevices.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Kamera ${index + 1}`;
                cameraSelect.appendChild(option);
            });
            const saved = localStorage.getItem('pixel_settings_v2');
            if (saved) {
                const s = JSON.parse(saved);
                if (s.cameraId && [...cameraSelect.options].some(opt => opt.value === s.cameraId)) {
                    cameraSelect.value = s.cameraId;
                }
            }
        }
    } catch (e) {}
}

export function adjustCanvas() {
    if (!video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    createZoomDisplays();
}

export async function requestWakeLock() {
    if (!('wakeLock' in navigator) || !state.isRunning) return;
    try {
        if (state.wakeLock) {
            try { await state.wakeLock.release(); } catch (e) {}
            state.wakeLock = null;
        }
        state.wakeLock = await navigator.wakeLock.request('screen');
        state.wakeLock.addEventListener('release', () => {
            state.wakeLock = null;
        });
    } catch (err) {}
}

export async function startSystem() {
    try {
        let constraints = { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } };
        if (cameraSelect.value && cameraSelect.value !== 'default') {
            constraints.video = { deviceId: { exact: cameraSelect.value }, width: { ideal: 1280 }, height: { ideal: 720 } };
        }
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        state.currentTrack = stream.getVideoTracks()[0];

        // Sicherstellen, dass auch die Mikrofon-Berechtigung direkt beim Start erteilt ist
        // (für späteres /audio via Telegram, auch wenn Audio-Wächter anfangs aus ist)
        if (!state.permissionsGranted && !chkAudioGuard.checked) {
            try {
                const testAudio = await getRoomAudioStream();
                testAudio.getTracks().forEach(t => t.stop());
                state.permissionsGranted = true;
            } catch (micErr) {
                console.warn('Mikrofon-Freigabe noch nicht erteilt:', micErr);
            }
        }

        setTimeout(() => {
            try {
                const caps = state.currentTrack.getCapabilities();
                if (caps.zoom) {
                    slideCamZoom.min = caps.zoom.min;
                    slideCamZoom.max = caps.zoom.max;
                    slideCamZoom.step = caps.zoom.step;
                    slideCamZoom.value = state.currentTrack.getSettings().zoom || caps.zoom.min;
                    valCamZoom.innerText = parseFloat(slideCamZoom.value).toFixed(1);
                    slideCamZoom.disabled = false;
                }
            } catch (e) {}
            loadCameras();
        }, 500);
        video.onloadedmetadata = () => { adjustCanvas(); video.play(); };
        state.isRunning = true;
        state.isMonitoring = true;
        state.lastFrameTime = Date.now();
        await requestWakeLock();
        updateMonitorButtonUI();

        initAudio();
        if (chkAudioGuard.checked) restartAudioSystem();
        fetchWeather();
        startTelegramPolling();

        requestAnimationFrame(processFrame);
    } catch (err) {
        showToast('Kamerafehler: ' + err.message, 'error', 4500);
    }
}

export function stopSystem() {
    state.isRunning = false;
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(t => t.stop());
        video.srcObject = null;
    }
    stopAudioSystem();
    stopLiveListen(false, true);
    stopTelegramPolling();
    if (state.wakeLock) {
        try { state.wakeLock.release(); } catch (e) {}
        state.wakeLock = null;
    }
    updateMonitorButtonUI();
}

export function processFrame() {
    if (!state.isRunning) return;
    requestAnimationFrame(processFrame);
    const now = Date.now();
    const elapsed = now - state.lastFrameTime;
    if (elapsed < FRAME_INTERVAL) return;
    state.lastFrameTime = now - (elapsed % FRAME_INTERVAL);

    state.frameCounter++;

    processAudio();

    if (!canvas.width || !canvas.height) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imgW = canvas.width;
    const imgH = canvas.height;

    analyzeAnchor(now, imgW, imgH);
    analyzeMute(now, imgW, imgH);
    analyzeBoxes(now, imgW, imgH);

    drawUI();
}
