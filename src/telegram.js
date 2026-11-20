// Telegram Bot-Kommunikation, Medienversand & Remote-Befehle

import {
    chkTelegram, txtTelegramToken, txtTelegramChatId,
    selTgVideoMode, slideListenChunk, slideListenAutoOff,
    canvas, ctx, recordCanvas
} from './dom.js';
import { state, boxes, anchorBox, DEFAULTS } from './state.js';
import { getRoomAudioStream } from './audio.js';
import { updateAppVisuals } from './ui.js';
import { drawBoxOverlays } from './analyzer.js';

const LIVE_LISTEN_OVERLAP_MS = 250;
const LIVE_LISTEN_MAX_KEPT = 4;

function getBestAudioRecorderOptions() {
    const candidates = [
        'audio/webm;codecs=opus',
        'audio/ogg;codecs=opus',
        'audio/webm',
        'audio/mp4'
    ];
    for (const mime of candidates) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(mime)) {
            return { mimeType: mime, audioBitsPerSecond: 96000 };
        }
    }
    return { audioBitsPerSecond: 96000 };
}

export async function sendTgMessage(text, disableNotification = false) {
    if (!txtTelegramToken.value || !txtTelegramChatId.value) return null;
    try {
        const res = await fetch(`https://api.telegram.org/bot${txtTelegramToken.value.trim()}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: txtTelegramChatId.value.trim(),
                text: text,
                disable_notification: disableNotification
            })
        });
        return await res.json();
    } catch (e) {
        return null;
    }
}

export async function sendTgMedia(endpoint, formData) {
    if (!txtTelegramToken.value || !txtTelegramChatId.value) return null;
    formData.append("chat_id", txtTelegramChatId.value.trim());
    try {
        const res = await fetch(`https://api.telegram.org/bot${txtTelegramToken.value.trim()}/${endpoint}`, {
            method: 'POST',
            body: formData
        });
        return await res.json();
    } catch (e) {
        return null;
    }
}

export async function deleteTgMessage(messageId) {
    if (!messageId || !txtTelegramToken.value || !txtTelegramChatId.value) return;
    try {
        await fetch(`https://api.telegram.org/bot${txtTelegramToken.value.trim()}/deleteMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: txtTelegramChatId.value.trim(),
                message_id: messageId
            })
        });
    } catch (e) {}
}

export function recordAndSendVideo(boxId, isRemote = false, durationMs = 4000) {
    if (state.isRecordingVideo || !chkTelegram.checked) return;
    state.isRecordingVideo = true;
    let sec = durationMs / 1000;
    let caption = isRemote ? `🎥 Remote Live-Video (${sec}s)` : "🎥 Alarm Box " + boxId;
    sendTgMessage(caption + " (Wird aufgezeichnet...)");

    try {
        let stream;
        const mode = isRemote ? 'full' : selTgVideoMode.value;
        if (mode === 'box' && boxId !== null) {
            state.isRecordingBoxId = boxId;
            state.isCapturingFullVideo = false;
            let b = boxes.find(x => x.id === boxId);
            recordCanvas.width = b.w * 3;
            recordCanvas.height = b.h * 3;
            stream = recordCanvas.captureStream(15);
        } else {
            state.isRecordingBoxId = null;
            state.isCapturingFullVideo = true;
            // Falls Rahmen im Tarnmodus/bei ausgeblendetem Live-Bild gerade pausieren, für Frame 0 direkt zeichnen
            if (!(state.showCamera && !state.isStealthActive)) {
                drawBoxOverlays(ctx);
            }
            stream = canvas.captureStream(15);
        }

        let recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        let chunks = [];
        recorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = async () => {
            state.isCapturingFullVideo = false;
            state.isRecordingBoxId = null;
            let blob = new Blob(chunks, { type: 'video/webm' });
            let fd = new FormData();
            fd.append("video", blob, "video.webm");
            fd.append("caption", caption);
            await sendTgMedia("sendVideo", fd);
            setTimeout(() => { state.isRecordingVideo = false; }, 5000);
        };
        recorder.start(250);
        setTimeout(() => {
            if (recorder.state !== 'inactive') recorder.stop();
        }, durationMs);
    } catch (e) {
        state.isCapturingFullVideo = false;
        state.isRecordingBoxId = null;
        sendTgPhoto(isRemote ? "📸 Remote Live-Bild" : "📸 Notfall-Bild Box " + boxId);
        setTimeout(() => { state.isRecordingVideo = false; }, 5000);
    }
}

export async function recordAndSendAudio(isRemote = false, durationMs = 10000) {
    if (!chkTelegram.checked) return;
    if (state.isLiveListening) {
        if (isRemote) {
            sendTgMessage("ℹ️ Live-Mithören läuft bereits. Sende zuerst /stop für eine Einzelaufnahme.");
        }
        return;
    }
    if (state.isRecordingAudio) return;
    state.isRecordingAudio = true;

    let sec = durationMs / 1000;
    let caption = isRemote ? `🎙️ Remote Live-Audio (${sec}s)` : "🎙️ Audio-Alarm im Raum (10s)";
    if (isRemote) sendTgMessage(caption + " (Wird aufgezeichnet...)");

    let activeStream = state.micStream;
    let tempStream = null;

    try {
        // Falls Audio-Wächter aus ist, für den /audio-Befehl kurzzeitig Mikrofon im Raum-Modus öffnen
        if (!activeStream) {
            tempStream = await getRoomAudioStream();
            activeStream = tempStream;
        }

        const options = getBestAudioRecorderOptions();
        let recorder = new MediaRecorder(activeStream, options);
        let chunks = [];
        recorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = async () => {
            if (tempStream) {
                tempStream.getTracks().forEach(t => t.stop());
            }
            let mimeType = recorder.mimeType || 'audio/webm';
            let blob = new Blob(chunks, { type: mimeType });
            let fd = new FormData();
            fd.append("voice", blob, "audio.ogg");
            fd.append("caption", caption);
            await sendTgMedia("sendVoice", fd);
            setTimeout(() => { state.isRecordingAudio = false; }, 5000);
        };
        // 250ms Timeslice verhindert Puffer-Aussetzer bei längeren Aufnahmen
        recorder.start(250);
        setTimeout(() => {
            if (recorder.state !== 'inactive') recorder.stop();
        }, durationMs);
    } catch (e) {
        if (tempStream) {
            tempStream.getTracks().forEach(t => t.stop());
        }
        setTimeout(() => { state.isRecordingAudio = false; }, 5000);
    }
}

export async function startLiveListen() {
    if (!chkTelegram.checked || !txtTelegramToken.value.trim() || !txtTelegramChatId.value.trim()) return;
    if (state.isLiveListening) {
        sendTgMessage("ℹ️ Live-Mithören läuft bereits. Sende /stop zum Beenden.");
        return;
    }

    // Eventuell noch wartende Nachlauf-Löschung einer vorherigen Auto-Abschaltung sofort abschließen
    if (state.liveListenCleanupTimer) {
        clearTimeout(state.liveListenCleanupTimer);
        state.liveListenCleanupTimer = null;
    }
    if (state.liveListenMessageIds.length > 0) {
        const leftoverIds = state.liveListenMessageIds.splice(0);
        leftoverIds.forEach(id => deleteTgMessage(id));
    }

    const chunkSec = Math.max(5, Math.min(30, parseInt(slideListenChunk.value) || DEFAULTS.listenChunkSec));
    const autoOffMin = Math.max(1, Math.min(30, parseInt(slideListenAutoOff.value) || DEFAULTS.listenAutoOffMin));
    const chunkMs = chunkSec * 1000;

    state.isLiveListening = true;
    const sessionId = ++state.liveListenSessionId;

    try {
        if (state.micStream && state.micStream.active && typeof state.micStream.clone === 'function') {
            state.liveListenStream = state.micStream.clone();
        } else {
            state.liveListenStream = await getRoomAudioStream();
        }
    } catch (e) {
        if (sessionId === state.liveListenSessionId) {
            state.isLiveListening = false;
            sendTgMessage("⚠️ Live-Mithören konnte nicht gestartet werden (Mikrofon nicht verfügbar).");
        }
        return;
    }

    // Falls während des Mikrofon-Öffnens bereits /stop kam
    if (!state.isLiveListening || sessionId !== state.liveListenSessionId) {
        if (state.liveListenStream) {
            state.liveListenStream.getTracks().forEach(t => t.stop());
            state.liveListenStream = null;
        }
        return;
    }

    await sendTgMessage(`🎧 Live-Mithören gestartet (${chunkSec}s-Schnipsel, Auto-Aus nach ${autoOffMin} Min.).\nSende /stop zum Beenden.`);
    updateAppVisuals();

    // Auto-Abschaltung planen
    state.liveListenAutoOffTimer = setTimeout(() => {
        if (state.isLiveListening && state.liveListenSessionId === sessionId) {
            stopLiveListen(true, false);
        }
    }, autoOffMin * 60 * 1000);

    let chunkIndex = 0;

    const startNextChunk = () => {
        if (!state.isLiveListening || sessionId !== state.liveListenSessionId) return;
        if (!state.liveListenStream || !state.liveListenStream.active) {
            stopLiveListen(false, false);
            return;
        }

        const currentIndex = ++chunkIndex;
        let recorder;
        try {
            recorder = new MediaRecorder(state.liveListenStream, getBestAudioRecorderOptions());
        } catch (e) {
            stopLiveListen(false, false);
            return;
        }

        const chunks = [];
        state.liveListenRecorders.add(recorder);

        recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = async () => {
            state.liveListenRecorders.delete(recorder);
            if (!state.isLiveListening || sessionId !== state.liveListenSessionId) return;
            if (chunks.length === 0) return;

            const mimeType = recorder.mimeType || 'audio/webm';
            const blob = new Blob(chunks, { type: mimeType });
            if (blob.size < 200) return;

            const fd = new FormData();
            fd.append("voice", blob, `live_${currentIndex}.ogg`);
            fd.append("caption", `🎙️ Live #${currentIndex}`);
            fd.append("disable_notification", "true");

            const res = await sendTgMedia("sendVoice", fd);
            const msgId = res && res.ok && res.result ? res.result.message_id : null;
            if (!msgId) return;

            // Falls während des Uploads gestoppt wurde
            if (!state.isLiveListening || sessionId !== state.liveListenSessionId) {
                if (state.liveListenCleanupTimer) {
                    // Auto-Aus Nachlaufzeit aktiv -> mit in die Aufräum-Liste aufnehmen
                    state.liveListenMessageIds.push(msgId);
                } else {
                    // Manuell gestoppt -> sofort löschen
                    deleteTgMessage(msgId);
                }
                return;
            }

            state.liveListenMessageIds.push(msgId);
            while (state.liveListenMessageIds.length > LIVE_LISTEN_MAX_KEPT) {
                const oldestId = state.liveListenMessageIds.shift();
                deleteTgMessage(oldestId);
            }
        };

        recorder.start(250);

        // Ping-Pong: Nächsten Recorder 250ms vor Ende starten, damit keine Lücke entsteht
        const nextDelay = Math.max(1000, chunkMs - LIVE_LISTEN_OVERLAP_MS);
        state.liveListenNextTimer = setTimeout(() => {
            startNextChunk();
        }, nextDelay);

        // Aktuellen Recorder nach voller Schnipsel-Länge stoppen
        const stopTimer = setTimeout(() => {
            state.liveListenStopTimers.delete(stopTimer);
            if (recorder.state !== 'inactive') {
                try { recorder.stop(); } catch (e) {}
            }
        }, chunkMs);
        state.liveListenStopTimers.add(stopTimer);
    };

    startNextChunk();
}

export function stopLiveListen(isAutoOff = false, silent = false) {
    if (!state.isLiveListening) {
        if (!isAutoOff && !silent) {
            sendTgMessage("ℹ️ Live-Mithören ist aktuell nicht aktiv.");
        }
        return;
    }

    const chunkSec = Math.max(5, Math.min(30, parseInt(slideListenChunk.value) || DEFAULTS.listenChunkSec));
    const autoOffMin = Math.max(1, Math.min(30, parseInt(slideListenAutoOff.value) || DEFAULTS.listenAutoOffMin));

    state.isLiveListening = false;
    state.liveListenSessionId++;
    updateAppVisuals();

    if (state.liveListenNextTimer) {
        clearTimeout(state.liveListenNextTimer);
        state.liveListenNextTimer = null;
    }
    if (state.liveListenAutoOffTimer) {
        clearTimeout(state.liveListenAutoOffTimer);
        state.liveListenAutoOffTimer = null;
    }
    state.liveListenStopTimers.forEach(t => clearTimeout(t));
    state.liveListenStopTimers.clear();

    state.liveListenRecorders.forEach(rec => {
        if (rec.state !== 'inactive') {
            try { rec.stop(); } catch (e) {}
        }
    });
    state.liveListenRecorders.clear();

    if (state.liveListenStream) {
        state.liveListenStream.getTracks().forEach(t => t.stop());
        state.liveListenStream = null;
    }

    if (isAutoOff) {
        if (!silent) {
            sendTgMessage(`⏱️ Live-Mithören automatisch nach ${autoOffMin} Min. beendet. Die letzten Schnipsel werden in Kürze entfernt.`);
        }
        // Kurze Nachlaufzeit, damit der letzte Schnipsel noch zu Ende gehört werden kann
        if (state.liveListenCleanupTimer) clearTimeout(state.liveListenCleanupTimer);
        const graceMs = Math.max(20000, chunkSec * 2000);
        state.liveListenCleanupTimer = setTimeout(() => {
            state.liveListenCleanupTimer = null;
            const ids = state.liveListenMessageIds.splice(0);
            ids.forEach(id => deleteTgMessage(id));
        }, graceMs);
    } else {
        if (state.liveListenCleanupTimer) {
            clearTimeout(state.liveListenCleanupTimer);
            state.liveListenCleanupTimer = null;
        }
        const ids = state.liveListenMessageIds.splice(0);
        ids.forEach(id => deleteTgMessage(id));
        if (!silent) {
            sendTgMessage("⏹️ Live-Mithören beendet. Chat wurde aufgeräumt.");
        }
    }
}

export function sendTgPhoto(caption) {
    if (!chkTelegram.checked || !canvas.width || !canvas.height) return;
    // Temporäre Kopie anlegen und Rahmen immer einzeichnen, falls sie gerade (Tarnmodus / Live-Bild aus) pausieren
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = canvas.width;
    snapCanvas.height = canvas.height;
    const snapCtx = snapCanvas.getContext('2d');
    snapCtx.drawImage(canvas, 0, 0);

    const alreadyHasOverlays = (state.showCamera && !state.isStealthActive) || state.isCapturingFullVideo;
    if (!alreadyHasOverlays) {
        drawBoxOverlays(snapCtx);
    }

    snapCanvas.toBlob(async (blob) => {
        if (!blob) return;
        let fd = new FormData();
        fd.append("photo", blob, "live.jpg");
        fd.append("caption", caption);
        await sendTgMedia("sendPhoto", fd);
    }, 'image/jpeg', 0.85);
}

export function sendAnchorTgPhoto() {
    if (!chkTelegram.checked || !anchorBox.baseline) return;
    let scale = 3;
    let tmpC = document.createElement('canvas');
    tmpC.width = (anchorBox.w * 2 + 10) * scale;
    tmpC.height = anchorBox.h * scale;
    let tCtx = tmpC.getContext('2d');
    tCtx.fillStyle = '#111';
    tCtx.fillRect(0, 0, tmpC.width, tmpC.height);

    let imgData = new ImageData(new Uint8ClampedArray(anchorBox.baseline), anchorBox.w, anchorBox.h);
    let refC = document.createElement('canvas');
    refC.width = anchorBox.w;
    refC.height = anchorBox.h;
    refC.getContext('2d').putImageData(imgData, 0, 0);

    tCtx.imageSmoothingEnabled = false;
    tCtx.drawImage(refC, 0, 0, anchorBox.w, anchorBox.h, 0, 0, anchorBox.w * scale, anchorBox.h * scale);
    tCtx.drawImage(canvas, anchorBox.x, anchorBox.y, anchorBox.w, anchorBox.h, (anchorBox.w + 10) * scale, 0, anchorBox.w * scale, anchorBox.h * scale);

    tmpC.toBlob(async (blob) => {
        let fd = new FormData();
        fd.append("photo", blob, "anchor.jpg");
        fd.append("caption", "🚨 WARNUNG: Anker verrutscht!\nLinks: Referenzbild | Rechts: Live-Bild");
        await sendTgMedia("sendPhoto", fd);
    }, 'image/jpeg', 0.9);
}

function sendTgHelpMessage() {
    const chunkSec = Math.max(5, Math.min(30, parseInt(slideListenChunk.value) || DEFAULTS.listenChunkSec));
    const autoOffMin = Math.max(1, Math.min(30, parseInt(slideListenAutoOff.value) || DEFAULTS.listenAutoOffMin));
    const helpText = [
        '🤖 Vigilux – Verfügbare Befehle:',
        '',
        '📸 /foto',
        'Aktuelles Live-Bild (inkl. Mess-Rahmen)',
        '',
        '🎥 /video [Sek]',
        'Live-Video aufnehmen (Standard: 4s, max. 60s)',
        '',
        '🎙️ /audio [Sek]',
        'Einmalige Raum-Aufnahme (Standard: 10s, max. 60s)',
        '',
        '🎧 /listen',
        `Fortlaufendes Live-Mithören (${chunkSec}s-Schnipsel, Auto-Aus nach ${autoOffMin} Min., automatisches Aufräumen)`,
        '',
        '⏹️ /stop',
        'Live-Mithören sofort beenden & Chat aufräumen',
        '',
        '❓ /hilfe oder ?',
        'Diese Befehlsübersicht anzeigen'
    ].join('\n');
    sendTgMessage(helpText);
}

let tgPollSessionId = 0;
let tgPollAbortController = null;

// Überspringt beim Kamerastart alle älteren, aufgelaufenen Befehle aus der Zeit als die Kamera aus war
async function flushOldTelegramUpdates(sessionId) {
    if (!chkTelegram.checked || !txtTelegramToken.value.trim()) return;
    try {
        if (tgPollAbortController) {
            try { tgPollAbortController.abort(); } catch (e) {}
        }
        const controller = new AbortController();
        tgPollAbortController = controller;
        const res = await fetch(
            `https://api.telegram.org/bot${txtTelegramToken.value.trim()}/getUpdates?offset=-1&timeout=0`,
            { signal: controller.signal }
        );
        const data = await res.json();
        if (sessionId !== tgPollSessionId) return;
        if (data.ok && data.result && data.result.length > 0) {
            const latest = data.result[data.result.length - 1];
            state.tgUpdateOffset = latest.update_id + 1;
        }
    } catch (e) {}
}

export function stopTelegramPolling() {
    tgPollSessionId++;
    state.isPollingTelegram = false;
    if (state.tgPollTimeout) {
        clearTimeout(state.tgPollTimeout);
        state.tgPollTimeout = null;
    }
    if (tgPollAbortController) {
        try { tgPollAbortController.abort(); } catch (e) {}
        tgPollAbortController = null;
    }
}

export async function startTelegramPolling() {
    if (state.isPollingTelegram) return; // Verhindert doppelte Polling-Schleifen
    const sessionId = ++tgPollSessionId;
    state.isPollingTelegram = true;
    await flushOldTelegramUpdates(sessionId);
    if (sessionId !== tgPollSessionId || !state.isPollingTelegram || !state.isRunning) {
        if (sessionId === tgPollSessionId) state.isPollingTelegram = false;
        return;
    }
    pollTelegramLoop(sessionId);
}

async function pollTelegramLoop(sessionId) {
    if (sessionId !== tgPollSessionId || !state.isPollingTelegram || !state.isRunning) {
        if (sessionId === tgPollSessionId) state.isPollingTelegram = false;
        return;
    }
    if (!chkTelegram.checked || !txtTelegramToken.value.trim()) {
        state.tgPollTimeout = setTimeout(() => pollTelegramLoop(sessionId), 5000);
        return;
    }
    try {
        const controller = new AbortController();
        tgPollAbortController = controller;
        let res = await fetch(
            `https://api.telegram.org/bot${txtTelegramToken.value.trim()}/getUpdates?offset=${state.tgUpdateOffset}&timeout=25`,
            { signal: controller.signal }
        );
        let data = await res.json();
        if (sessionId !== tgPollSessionId || !state.isPollingTelegram || !state.isRunning) return;
        if (data.ok && data.result.length > 0) {
            for (let item of data.result) {
                if (item.update_id < state.tgUpdateOffset) continue;
                state.tgUpdateOffset = item.update_id + 1;
                if (item.message && item.message.chat.id.toString() === txtTelegramChatId.value.trim() && item.message.text) {
                    let text = item.message.text.trim();
                    let cmd = text.toLowerCase();
                    if (cmd === '/foto' || cmd.startsWith('/foto@')) {
                        sendTgPhoto("📸 Remote Live-Bild");
                    } else if (cmd.startsWith('/video')) {
                        let parts = text.split(/\s+/);
                        let durationSec = 4; // Default: 4 Sekunden
                        if (parts.length > 1 && !isNaN(parts[1])) {
                            durationSec = parseInt(parts[1]);
                            if (durationSec > 60) durationSec = 60; // Deckelung auf max 60s
                            if (durationSec < 1) durationSec = 1;
                        }
                        recordAndSendVideo(null, true, durationSec * 1000);
                    } else if (cmd.startsWith('/audio')) {
                        let parts = text.split(/\s+/);
                        let durationSec = 10; // Default: 10 Sekunden
                        if (parts.length > 1 && !isNaN(parts[1])) {
                            durationSec = parseInt(parts[1]);
                            if (durationSec > 60) durationSec = 60; // Deckelung auf max 60s
                            if (durationSec < 1) durationSec = 1;
                        }
                        recordAndSendAudio(true, durationSec * 1000);
                    } else if (cmd === '/listen' || cmd.startsWith('/listen ') || cmd.startsWith('/listen@')) {
                        // Schnipselgröße wird ausschließlich über den Schieberegler im App-Menü gesteuert
                        startLiveListen();
                    } else if (cmd === '/stop' || cmd.startsWith('/stop@')) {
                        stopLiveListen(false, false);
                    } else if (cmd === '?' || cmd === '/hilfe' || cmd.startsWith('/hilfe@') || cmd === '/help' || cmd.startsWith('/help@')) {
                        sendTgHelpMessage();
                    }
                }
            }
        }
    } catch (e) {}
    if (sessionId === tgPollSessionId && state.isPollingTelegram && state.isRunning) {
        state.tgPollTimeout = setTimeout(() => pollTelegramLoop(sessionId), 1000);
    } else if (sessionId === tgPollSessionId) {
        state.isPollingTelegram = false;
    }
}
