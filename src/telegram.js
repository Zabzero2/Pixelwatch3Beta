// Telegram Bot-Kommunikation, Medienversand & Remote-Befehle

import {
    chkTelegram, txtTelegramToken, txtTelegramChatId,
    selTgVideoMode, canvas, recordCanvas
} from './dom.js';
import { state, boxes, anchorBox } from './state.js';

export async function sendTgMessage(text) {
    if (!txtTelegramToken.value || !txtTelegramChatId.value) return;
    try {
        await fetch(`https://api.telegram.org/bot${txtTelegramToken.value.trim()}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: txtTelegramChatId.value.trim(), text: text })
        });
    } catch (e) {}
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
    sendTgMessage(caption + " (Wird aufgezeichnet...)");

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
        recorder.ondataavailable = e => chunks.push(e.data);
        recorder.onstop = async () => {
            let blob = new Blob(chunks, { type: 'video/webm' });
            let fd = new FormData();
            fd.append("video", blob, "video.webm");
            fd.append("caption", caption);
            await sendTgMedia("sendVideo", fd);
            state.isRecordingBoxId = null;
            setTimeout(() => { state.isRecordingVideo = false; }, 5000);
        };
        recorder.start();
        setTimeout(() => {
            if (recorder.state !== 'inactive') recorder.stop();
        }, durationMs);
    } catch (e) {
        sendTgPhoto(isRemote ? "📸 Remote Live-Bild" : "📸 Notfall-Bild Box " + boxId);
        state.isRecordingBoxId = null;
        setTimeout(() => { state.isRecordingVideo = false; }, 5000);
    }
}

export function recordAndSendAudio(isRemote = false, durationMs = 10000) {
    if (state.isRecordingAudio || !chkTelegram.checked || !state.micStream) return;
    state.isRecordingAudio = true;
    let sec = durationMs / 1000;
    let caption = isRemote ? `🎙️ Remote Live-Audio (${sec}s)` : "🎙️ Audio-Alarm im Raum (10s)";
    if (isRemote) sendTgMessage(caption + " (Wird aufgezeichnet...)");

    try {
        let recorder = new MediaRecorder(state.micStream);
        let chunks = [];
        recorder.ondataavailable = e => chunks.push(e.data);
        recorder.onstop = async () => {
            let blob = new Blob(chunks, { type: 'audio/webm' });
            let fd = new FormData();
            fd.append("voice", blob, "audio.webm");
            fd.append("caption", caption);
            await sendTgMedia("sendVoice", fd);
            setTimeout(() => { state.isRecordingAudio = false; }, 5000);
        };
        recorder.start();
        setTimeout(() => {
            if (recorder.state !== 'inactive') recorder.stop();
        }, durationMs);
    } catch (e) {
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

export async function pollTelegram() {
    if (!chkTelegram.checked || !state.isRunning || !txtTelegramToken.value) {
        setTimeout(pollTelegram, 5000);
        return;
    }
    try {
        let res = await fetch(`https://api.telegram.org/bot${txtTelegramToken.value.trim()}/getUpdates?offset=${state.tgUpdateOffset}&timeout=30`);
        let data = await res.json();
        if (data.ok && data.result.length > 0) {
            for (let item of data.result) {
                state.tgUpdateOffset = item.update_id + 1;
                if (item.message && item.message.chat.id.toString() === txtTelegramChatId.value.trim() && item.message.text) {
                    let text = item.message.text.trim();
                    if (text === '/foto') {
                        sendTgPhoto("📸 Remote Live-Bild");
                    } else if (text.startsWith('/video')) {
                        let parts = text.split(' ');
                        let durationSec = 4; // Default: 4 Sekunden
                        if (parts.length > 1 && !isNaN(parts[1])) {
                            durationSec = parseInt(parts[1]);
                            if (durationSec > 60) durationSec = 60; // Deckelung auf max 60s
                        }
                        recordAndSendVideo(null, true, durationSec * 1000);
                    } else if (text.startsWith('/audio')) {
                        let parts = text.split(' ');
                        let durationSec = 10; // Default: 10 Sekunden
                        if (parts.length > 1 && !isNaN(parts[1])) {
                            durationSec = parseInt(parts[1]);
                            if (durationSec > 60) durationSec = 60; // Deckelung auf max 60s
                        }
                        recordAndSendAudio(true, durationSec * 1000);
                    }
                }
            }
        }
    } catch (e) {}
    setTimeout(pollTelegram, 1000);
}
