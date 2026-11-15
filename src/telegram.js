// Telegram Bot-Kommunikation, Medienversand, Live-Babyphone & Remote-Befehle

import {
    chkTelegram, txtTelegramToken, txtTelegramChatId,
    selTgVideoMode, canvas, recordCanvas
} from './dom.js';
import { state, boxes, anchorBox } from './state.js';
import { getRoomAudioStream } from './audio.js';
import { startLiveBabyphone, stopLiveBabyphone } from './babyphone.js';

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

export async function sendTgMessage(text) {
    if (!txtTelegramToken.value || !txtTelegramChatId.value) return null;
    try {
        const res = await fetch(`https://api.telegram.org/bot${txtTelegramToken.value.trim()}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: txtTelegramChatId.value.trim(), text: text })
        });
        const data = await res.json();
        return data.ok && data.result ? data.result.message_id : null;
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

export async function sendTgTempNotice(text, deleteAfterMs = 5000) {
    const msgId = await sendTgMessage(text);
    if (msgId && deleteAfterMs > 0) {
        setTimeout(() => deleteTgMessage(msgId), deleteAfterMs);
    }
}

export async function sendTgLiveMessage(listenUrl) {
    if (!txtTelegramToken.value || !txtTelegramChatId.value) return null;
    const token = txtTelegramToken.value.trim();
    const chatId = txtTelegramChatId.value.trim();
    const text = `🔴 LIVE-BABYPHONE BEREIT\n\nTippe auf den Button unten, um sofort in Echtzeit in den Raum zu hören.\n\n(Beenden im Player oder per /stop – diese Nachricht löscht sich danach automatisch.)`;

    try {
        // Zuerst mit schickem Inline-Button versuchen
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔊 Live-Babyphone jetzt öffnen', url: listenUrl }]
                    ]
                }
            })
        });
        const data = await res.json();
        if (data.ok && data.result) {
            return data.result.message_id;
        }
    } catch (e) {}

    // Fallback (z.B. falls über lokale IP getestet wird, bei der Telegram Inline-Buttons ablehnt)
    return await sendTgMessage(`${text}\n\n🔗 Direktlink:\n${listenUrl}`);
}

export async function sendTgMedia(endpoint, formData) {
    if (!txtTelegramToken.value || !txtTelegramChatId.value) return;
    formData.append("chat_id", txtTelegramChatId.value.trim());
    try {
        await fetch(`https://api.telegram.org/bot${txtTelegramToken.value.trim()}/${endpoint}`, {
            method: 'POST',
            body: formData
        });
    } catch (e) {}
}

export function recordAndSendVideo(boxId, isRemote = false, durationMs = 4000) {
    if (state.isRecordingVideo || !chkTelegram.checked) return;
    state.isRecordingVideo = true;
    let sec = durationMs / 1000;
    let caption = isRemote ? `🎥 Remote Live-Video (${sec}s)` : "🎥 Alarm Box " + boxId;
    sendTgTempNotice(caption + " (Wird aufgezeichnet...)", durationMs + 2000);

    try {
        let stream;
        const mode = isRemote ? 'full' : selTgVideoMode.value;
        if (mode === 'box' && boxId !== null) {
            state.isRecordingBoxId = boxId;
            let b = boxes.find(x => x.id === boxId);
            recordCanvas.width = b.w * 3;
            recordCanvas.height = b.h * 3;
            stream = recordCanvas.captureStream(15);
        } else {
            stream = canvas.captureStream(15);
        }

        let recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        let chunks = [];
        recorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = async () => {
            let blob = new Blob(chunks, { type: 'video/webm' });
            let fd = new FormData();
            fd.append("video", blob, "video.webm");
            fd.append("caption", caption);
            await sendTgMedia("sendVideo", fd);
            state.isRecordingBoxId = null;
            setTimeout(() => { state.isRecordingVideo = false; }, 5000);
        };
        recorder.start(250);
        setTimeout(() => {
            if (recorder.state !== 'inactive') recorder.stop();
        }, durationMs);
    } catch (e) {
        sendTgPhoto(isRemote ? "📸 Remote Live-Bild" : "📸 Notfall-Bild Box " + boxId);
        state.isRecordingBoxId = null;
        setTimeout(() => { state.isRecordingVideo = false; }, 5000);
    }
}

export async function recordAndSendAudio(isRemote = false, durationMs = 10000) {
    if (state.isRecordingAudio || !chkTelegram.checked) return;
    state.isRecordingAudio = true;

    let sec = durationMs / 1000;
    let caption = isRemote ? `🎙️ Remote Live-Audio (${sec}s)` : "🎙️ Audio-Alarm im Raum (10s)";
    if (isRemote) sendTgTempNotice(caption + " (Wird aufgezeichnet...)", durationMs + 2000);

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

export function sendTgPhoto(caption) {
    if (!chkTelegram.checked) return;
    canvas.toBlob(async (blob) => {
        let fd = new FormData();
        fd.append("photo", blob, "live.jpg");
        fd.append("caption", caption);
        await sendTgMedia("sendPhoto", fd);
    }, 'image/jpeg', 0.8);
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

export function stopTelegramPolling() {
    state.isPollingTelegram = false;
    if (state.tgPollTimeout) {
        clearTimeout(state.tgPollTimeout);
        state.tgPollTimeout = null;
    }
}

export function startTelegramPolling() {
    if (state.isPollingTelegram) return; // Verhindert doppelte Polling-Schleifen
    state.isPollingTelegram = true;
    pollTelegramLoop();
}

async function pollTelegramLoop() {
    if (!state.isPollingTelegram || !state.isRunning) {
        state.isPollingTelegram = false;
        return;
    }
    if (!chkTelegram.checked || !txtTelegramToken.value.trim()) {
        state.tgPollTimeout = setTimeout(pollTelegramLoop, 5000);
        return;
    }
    try {
        let res = await fetch(`https://api.telegram.org/bot${txtTelegramToken.value.trim()}/getUpdates?offset=${state.tgUpdateOffset}&timeout=25`);
        let data = await res.json();
        if (data.ok && data.result.length > 0) {
            for (let item of data.result) {
                state.tgUpdateOffset = item.update_id + 1;
                if (item.message && item.message.chat.id.toString() === txtTelegramChatId.value.trim() && item.message.text) {
                    let text = item.message.text.trim();
                    let lower = text.toLowerCase();

                    if (lower === '/foto') {
                        sendTgPhoto("📸 Remote Live-Bild");
                    } else if (lower.startsWith('/video')) {
                        let parts = text.split(' ');
                        let durationSec = 4; // Default: 4 Sekunden
                        if (parts.length > 1 && !isNaN(parts[1])) {
                            durationSec = parseInt(parts[1]);
                            if (durationSec > 60) durationSec = 60; // Deckelung auf max 60s
                        }
                        recordAndSendVideo(null, true, durationSec * 1000);
                    } else if (lower.startsWith('/audio')) {
                        let parts = text.split(' ');
                        let durationSec = 10; // Default: 10 Sekunden
                        if (parts.length > 1 && !isNaN(parts[1])) {
                            durationSec = parseInt(parts[1]);
                            if (durationSec > 60) durationSec = 60; // Deckelung auf max 60s
                        }
                        recordAndSendAudio(true, durationSec * 1000);
                    } else if (lower === '/live' || lower === '/babyphone') {
                        startLiveBabyphone();
                    } else if (lower === '/stop') {
                        stopLiveBabyphone(true);
                    }
                }
            }
        }
    } catch (e) {}
    if (state.isPollingTelegram && state.isRunning) {
        state.tgPollTimeout = setTimeout(pollTelegramLoop, 1000);
    } else {
        state.isPollingTelegram = false;
    }
}
