// Lokale Alarmtöne (Web Audio API) & Mikrofon Audio-Wächter (Optimiert für Raumüberwachung)

import {
    chkTelegram, txtTelegramToken, txtTelegramChatId,
    chkAudioGuard, selLocalSound, slideAudioThreshold,
    liveAudioLevel, micAlarmUI
} from './dom.js';
import { state } from './state.js';
import { recordAndSendAudio } from './telegram.js';
import { updateSmartUI, updateAppVisuals, showToast } from './ui.js';

// Deaktiviert aggressive Sprachfilter (Noise-Suppression & Echo-Cancellation),
// damit Raumgeräusche, Piepstöne und weiter entfernte Stimmen nicht abgehackt werden.
export const ROOM_AUDIO_CONSTRAINTS = {
    audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 48000
    }
};

export async function getRoomAudioStream() {
    try {
        return await navigator.mediaDevices.getUserMedia(ROOM_AUDIO_CONSTRAINTS);
    } catch (err) {
        // Fallback falls ein Gerät spezifische Constraints ablehnt
        return await navigator.mediaDevices.getUserMedia({ audio: true });
    }
}

export function isLocalMuted() {
    if (!chkTelegram.checked || !txtTelegramToken.value.trim() || !txtTelegramChatId.value.trim()) return false;
    return chkAudioGuard.checked || selLocalSound.value === 'off';
}

export function initAudio() {
    if (!state.audioCtx) {
        state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (state.audioCtx.state === 'suspended') {
        state.audioCtx.resume();
    }
}

export function playBeep() {
    if (isLocalMuted()) return;
    const now = Date.now();
    if (now - state.lastBeep < 1000) return;
    state.lastBeep = now;
    initAudio();
    const osc = state.audioCtx.createOscillator();
    const gain = state.audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = 1000;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(state.audioCtx.destination);
    osc.start();
    osc.stop(state.audioCtx.currentTime + 0.25);
}

export function playAnchorBeep() {
    if (isLocalMuted()) return;
    const now = Date.now();
    if (now - state.lastAnchorBeep < 1500) return;
    state.lastAnchorBeep = now;
    initAudio();
    const osc = state.audioCtx.createOscillator();
    const gain = state.audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 250;
    gain.gain.value = 0.1;
    osc.connect(gain);
    gain.connect(state.audioCtx.destination);
    osc.start();
    osc.stop(state.audioCtx.currentTime + 0.5);
}

export function playWarningBeep() {
    if (isLocalMuted()) return;
    initAudio();
    const osc = state.audioCtx.createOscillator();
    const gain = state.audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 800;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(state.audioCtx.destination);
    osc.start();
    osc.stop(state.audioCtx.currentTime + 0.1);
}

export function playLoudAlarm() {
    if (isLocalMuted()) return;
    const now = Date.now();
    if (now - state.lastLoudBeep < 1000) return;
    state.lastLoudBeep = now;
    initAudio();
    const osc = state.audioCtx.createOscillator();
    const gain = state.audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, state.audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(1200, state.audioCtx.currentTime + 0.5);
    gain.gain.value = 0.25;
    osc.connect(gain);
    gain.connect(state.audioCtx.destination);
    osc.start();
    osc.stop(state.audioCtx.currentTime + 0.8);
}

export function stopAudioSystem() {
    if (state.micStream) {
        state.micStream.getTracks().forEach(t => t.stop());
        state.micStream = null;
    }
    state.analyser = null;
}

export async function restartAudioSystem() {
    stopAudioSystem();
    if (!chkAudioGuard.checked || !state.isRunning) return;
    try {
        initAudio();
        state.micStream = await getRoomAudioStream();
        const source = state.audioCtx.createMediaStreamSource(state.micStream);
        state.analyser = state.audioCtx.createAnalyser();
        state.analyser.fftSize = 256;
        state.dataArray = new Uint8Array(state.analyser.frequencyBinCount);
        source.connect(state.analyser);
    } catch (e) {
        showToast("Mikrofon-Fehler: " + e.message, "error", 4500);
        chkAudioGuard.checked = false;
        updateSmartUI();
        updateAppVisuals();
    }
}

export function processAudio() {
    if (!chkAudioGuard.checked || !state.analyser) return;
    state.analyser.getByteFrequencyData(state.dataArray);
    let sum = 0;
    for (let i = 0; i < state.dataArray.length; i++) sum += state.dataArray[i];
    let avg = Math.round(sum / state.dataArray.length);
    let threshold = parseInt(slideAudioThreshold.value);

    // Update Live Pegel unabhängig vom Monitor-Status
    if (state.panelSmartOpen && state.frameCounter % 5 === 0) {
        liveAudioLevel.innerText = avg;
        liveAudioLevel.style.color = avg > threshold ? "#ff0000" : "#00ff88";
    }

    // Alarme nur auslösen wenn System scharf ist
    if (!state.isMonitoring) return;

    let now = Date.now();
    // 15 Sekunden Sperrzeit (10s Aufnahme + 5s Pause)
    if (avg > threshold && (now - state.lastAcousticAlarm > 15000)) {
        state.lastAcousticAlarm = now;

        // Kein optisches Pop-Up im Tarnmodus!
        if (!state.isStealthActive) {
            micAlarmUI.style.display = 'block';
            setTimeout(() => { micAlarmUI.style.display = 'none'; }, 4000);
        }

        if (chkTelegram.checked && !state.isLiveListening) recordAndSendAudio(false, 10000); // 10 Sekunden Aufnahme
    }
}
