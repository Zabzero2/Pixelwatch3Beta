// Kamera-Steuerung, System-Start/Stop & Haupt-Renderloop

import {
    video, canvas, ctx, cameraSelect, slideCamZoom, valCamZoom,
    startBtn, chkAudioGuard
} from './dom.js';
import { state, FRAME_INTERVAL } from './state.js';
import { createZoomDisplays, updateMonitorButtonUI } from './ui.js';
import { initAudio, restartAudioSystem, processAudio } from './audio.js';
import { fetchWeather } from './weather.js';
import { pollTelegram } from './telegram.js';
import { analyzeAnchor, analyzeMute, analyzeBoxes, drawUI } from './analyzer.js';

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

export async function startSystem() {
    try {
        let constraints = { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } };
        if (cameraSelect.value && cameraSelect.value !== 'default') {
            constraints.video = { deviceId: { exact: cameraSelect.value }, width: { ideal: 1280 }, height: { ideal: 720 } };
        }
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        state.currentTrack = stream.getVideoTracks()[0];
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
        if ('wakeLock' in navigator) {
            try { state.wakeLock = await navigator.wakeLock.request('screen'); } catch (err) {}
        }
        state.isRunning = true;
        startBtn.innerText = 'Kamera Stoppen';
        state.lastFrameTime = Date.now();
        updateMonitorButtonUI();

        initAudio();
        if (chkAudioGuard.checked) restartAudioSystem();
        fetchWeather();
        setTimeout(pollTelegram, 2000);

        requestAnimationFrame(processFrame);
    } catch (err) {
        alert('Kamerafehler: ' + err.message);
    }
}

export function stopSystem() {
    state.isRunning = false;
    if (video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
    if (state.wakeLock) state.wakeLock.release();
    startBtn.innerText = 'Kamera Start';
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

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const fullFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const imgW = canvas.width;
    const imgH = canvas.height;

    analyzeAnchor(now, fullFrame, imgW, imgH);
    analyzeMute(now, fullFrame, imgW, imgH);
    analyzeBoxes(now, fullFrame, imgW, imgH);

    drawUI();
}
