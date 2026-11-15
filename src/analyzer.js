// Bildanalyse-Algorithmen (Mess-Felder, Anker-Referenz, Mute-Zone) & Canvas-Zeichnung

import {
    canvas, ctx, recordCanvas, recordCtx,
    slideSens, slideMass, slidePulse, slideHold, slideTakt, slideToleranz,
    slideAnchorSens, slideAnchorDrift, chkAnchorDrift,
    slideMuteSens, slideMuteHold, slideMuteDrift, chkMuteDrift,
    chkTelegram
} from './dom.js';
import { state, boxes, anchorBox, muteBox, PIXEL_STEP, HISTORY_MS } from './state.js';
import { drawProportional } from './ui.js';
import { playBeep, playAnchorBeep, playWarningBeep, playLoudAlarm } from './audio.js';
import { recordAndSendVideo, sendAnchorTgPhoto } from './telegram.js';

export function analyzeMute(now, fullFrame, imgW, imgH) {
    if (!muteBox.active) {
        muteBox.state = 'IDLE';
        muteBox.triggerStart = 0;
        return;
    }

    if (anchorBox.active && anchorBox.isAlarm) {
        muteBox.state = 'IDLE';
        muteBox.continuousStart = 0;
        muteBox.emptyStartTime = 0;
        muteBox.triggerStart = 0;
        return;
    }

    const mx = Math.floor(muteBox.x);
    const my = Math.floor(muteBox.y);
    const mw = Math.floor(muteBox.w);
    const mh = Math.floor(muteBox.h);
    if (muteBox.zoomCtx) {
        drawProportional(muteBox.zoomCtx, canvas, mx, my, mw, mh, 100, 50);
    }

    let safeMx = Math.max(0, Math.min(mx, imgW - mw));
    let safeMy = Math.max(0, Math.min(my, imgH - mh));
    let mData = new Uint8ClampedArray(mw * mh * 4);
    for (let y = 0; y < mh; y++) {
        let gStart = ((safeMy + y) * imgW + safeMx) * 4;
        mData.set(fullFrame.data.subarray(gStart, gStart + mw * 4), y * mw * 4);
    }

    if (muteBox.baseline === null || muteBox.baseline.length !== mData.length) {
        muteBox.baseline = new Float32Array(mData);
    }

    let baseTotal = 0;
    let currTotal = 0;
    let pCount = 0;

    for (let j = 0; j < mData.length; j += PIXEL_STEP * 4) {
        baseTotal += muteBox.baseline[j] * 0.299 + muteBox.baseline[j + 1] * 0.587 + muteBox.baseline[j + 2] * 0.114;
        currTotal += mData[j] * 0.299 + mData[j + 1] * 0.587 + mData[j + 2] * 0.114;
        pCount++;
    }
    let offset = (currTotal / pCount) - (baseTotal / pCount);
    let totalDiff = 0;
    for (let j = 0; j < mData.length; j += PIXEL_STEP * 4) {
        let baseVal = muteBox.baseline[j] * 0.299 + muteBox.baseline[j + 1] * 0.587 + muteBox.baseline[j + 2] * 0.114;
        let currVal = mData[j] * 0.299 + mData[j + 1] * 0.587 + mData[j + 2] * 0.114;
        totalDiff += Math.abs(currVal - (baseVal + offset));
    }

    let structuralDiff = Math.round(totalDiff / pCount);
    let muteThreshold = parseInt(slideMuteSens.value);
    let muteHoldMs = parseInt(slideMuteHold.value) * 1000;

    if (structuralDiff >= muteThreshold) {
        muteBox.emptyStartTime = 0;

        if (muteBox.triggerStart === 0) {
            muteBox.triggerStart = now;
        } else if (now - muteBox.triggerStart >= 1000) {
            if (muteBox.state === 'IDLE') {
                muteBox.state = 'MUTED';
                muteBox.timerStart = now;
                muteBox.continuousStart = now;
                muteBox.wasEmpty = false;
            } else if (muteBox.state === 'MUTED' && muteBox.wasEmpty) {
                muteBox.timerStart = now;
                muteBox.wasEmpty = false;
            }
        }
    } else {
        muteBox.triggerStart = 0;

        if (muteBox.emptyStartTime === 0) {
            muteBox.emptyStartTime = now;
        }
        if (now - muteBox.emptyStartTime >= 1000) {
            muteBox.wasEmpty = true;
            if (muteBox.state === 'WAITING_FOR_EMPTY') {
                muteBox.state = 'IDLE';
                muteBox.continuousStart = 0;
            }
        }

        let alpha = parseInt(slideMuteDrift.value) * 0.001;
        if (chkMuteDrift.checked && muteBox.state !== 'MUTED' && structuralDiff > 0 && structuralDiff < muteThreshold) {
            for (let j = 0; j < mData.length; j++) {
                muteBox.baseline[j] = muteBox.baseline[j] * (1 - alpha) + mData[j] * alpha;
            }
        }
    }

    if (muteBox.state === 'MUTED') {
        if (now - muteBox.timerStart >= muteHoldMs) {
            muteBox.state = 'WAITING_FOR_EMPTY';
        } else {
            let duration = now - muteBox.continuousStart;
            if (duration > 600000) {
                playLoudAlarm();
            } else if (duration > 300000) {
                if (now - muteBox.lastWarningTime > 5000) {
                    playWarningBeep();
                    muteBox.lastWarningTime = now;
                }
            }
        }
    }

    if (muteBox.zoomStatsDiv && state.showZoomValues && state.frameCounter % 4 === 0) {
        let txt = `Struktur-Abw: ${structuralDiff} / Max: ${muteThreshold}<br>`;
        if (muteBox.state === 'MUTED') {
            let duration = now - muteBox.continuousStart;
            if (duration > 600000) {
                txt += `<b style="color:#ff0000; animation: blink 1s infinite;">⚠ ALARM (>10m)</b>`;
            } else if (duration > 300000) {
                txt += `<b style="color:#ff8800;">⚠ WARNUNG (>5m)</b>`;
            } else {
                let rest = Math.ceil((muteHoldMs - (now - muteBox.timerStart)) / 1000);
                txt += `<b style="color:#ffcc00;">STUMM</b> (${rest}s)`;
            }
        } else if (muteBox.state === 'WAITING_FOR_EMPTY') {
            txt += `<span style="color:#aaa;">Wartet auf Freigabe...</span>`;
        } else if (muteBox.triggerStart > 0) {
            txt += `<b style="color:#ffcc00;">Prüfe...</b>`;
        } else {
            txt += `Inaktiv`;
        }
        txt += `<br>Größe: ${mw}x${mh} px`;
        muteBox.zoomStatsDiv.innerHTML = txt;
    }
}

export function analyzeBoxes(now, fullFrame, imgW, imgH) {
    let boxAlarmTriggered = false;

    const pixelSchwelle = parseInt(slideSens.value);
    const kritischeMasse = parseInt(slideMass.value);

    const minCrossings = parseInt(slidePulse.value);
    const holdMs = parseFloat(slideHold.value) * 1000;
    const targetTakt = parseInt(slideTakt.value);

    const tolerancePct = parseInt(slideToleranz.value) / 100;
    const minAllowed = targetTakt * (1 - tolerancePct);
    const maxAllowed = targetTakt * (1 + tolerancePct);

    const data = fullFrame.data;

    for (let i = 0; i < state.activeBoxCount; i++) {
        const box = boxes[i];
        let diff = 0;
        const rx = Math.floor(box.x);
        const ry = Math.floor(box.y);
        const rw = Math.floor(box.w);
        const rh = Math.floor(box.h);
        const pixelCount = rw * rh;

        if (box.zoomCtx) {
            drawProportional(box.zoomCtx, canvas, rx, ry, rw, rh, 100, 50);
        }

        if (!box.baseline || box.baseline.length !== pixelCount) {
            box.baseline = new Float32Array(pixelCount);
            box.baseline.fill(-1);
        }

        let activePixels = 0;
        let pIdx = 0;

        for (let y = ry; y < ry + rh; y += PIXEL_STEP) {
            for (let x = rx; x < rx + rw; x += PIXEL_STEP) {
                if (x >= 0 && x < imgW && y >= 0 && y < imgH) {
                    let idx = (y * imgW + x) * 4;
                    let curr = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;

                    if (box.baseline[pIdx] === -1) box.baseline[pIdx] = curr;

                    if (curr < box.baseline[pIdx]) {
                        box.baseline[pIdx] = curr;
                    } else {
                        box.baseline[pIdx] += Math.min(curr - box.baseline[pIdx], 0.5);
                    }

                    if (curr - box.baseline[pIdx] > pixelSchwelle) {
                        activePixels++;
                    }
                }
                pIdx++;
            }
        }

        box.history.push({ val: activePixels, time: now });
        while (box.history.length > 0 && now - box.history[0].time > HISTORY_MS) {
            box.history.shift();
        }

        if (box.history.length > 5) {
            const values = box.history.map(v => v.val);
            const maxVal = Math.max(...values);
            const minVal = Math.min(...values);
            diff = Math.round(maxVal - minVal);

            if (diff < kritischeMasse) { box.validCrossings = 0; }

            const hysteresis = Math.max(diff * 0.2, kritischeMasse * 0.25);
            const mid = minVal + diff / 2;
            let currentInstantState = 0;
            if (activePixels > mid + hysteresis) currentInstantState = 1;
            else if (activePixels < mid - hysteresis) currentInstantState = -1;

            if (currentInstantState === 1 && box.lastState === -1) {
                if (box.lastRisingEdge > 0) {
                    let cycleDuration = now - box.lastRisingEdge;
                    box.lastMeasuredCycle = cycleDuration;
                    if (cycleDuration >= minAllowed && cycleDuration <= maxAllowed) {
                        box.validCrossings++;
                        box.lastValidTime = now;
                    } else {
                        if (cycleDuration > maxAllowed) box.validCrossings = 0;
                    }
                }
                box.lastRisingEdge = now;
            }
            if (currentInstantState !== 0) { box.lastState = currentInstantState; }
            if (box.validCrossings > 0 && now - box.lastValidTime > (targetTakt * 2.5)) {
                box.validCrossings = 0;
            }

            if (state.isMonitoring && diff >= kritischeMasse && box.validCrossings >= minCrossings) {
                if (now - box.lastAlarmTime > holdMs + 4000) {
                    if (chkTelegram.checked) recordAndSendVideo(box.id, false);
                }
                box.lastAlarmTime = now;
            }
        }

        if (state.isMonitoring && now - box.lastAlarmTime < holdMs) {
            box.isAlarm = true;
            boxAlarmTriggered = true;
        } else {
            box.isAlarm = false;
        }

        if (box.zoomBoxDiv) {
            if (box.isAlarm && state.isMonitoring) box.zoomBoxDiv.classList.add('alarm-zoom');
            else box.zoomBoxDiv.classList.remove('alarm-zoom');
        }

        if (box.zoomStatsDiv && state.showZoomValues && state.frameCounter % 4 === 0) {
            let txt = `Masse: <span style="color:#00aaff;">${activePixels}</span> px | Pkt: ${box.validCrossings}`;
            txt += `<br>Max-Delta: ${diff} / Limit: ${kritischeMasse}`;
            if (box.lastMeasuredCycle > 0) txt += `<br>Letzter: <span style="color:#00ff88;">${box.lastMeasuredCycle} ms</span>`;
            else txt += `<br>Letzter: --- ms`;
            if (!state.isMonitoring) txt += `<br><b style="color:#ff4444;">[PAUSE]</b>`;
            box.zoomStatsDiv.innerHTML = txt;
        }
    }

    if (boxAlarmTriggered && muteBox.state !== 'MUTED') {
        playBeep();
    }
}

export function analyzeAnchor(now, fullFrame, imgW, imgH) {
    if (!anchorBox.active) return false;

    const ax = Math.floor(anchorBox.x);
    const ay = Math.floor(anchorBox.y);
    const aw = Math.floor(anchorBox.w);
    const ah = Math.floor(anchorBox.h);
    if (anchorBox.zoomCtx) {
        drawProportional(anchorBox.zoomCtx, canvas, ax, ay, aw, ah, 80, 40);
    }

    let safeAx = Math.max(0, Math.min(ax, imgW - aw));
    let safeAy = Math.max(0, Math.min(ay, imgH - ah));
    let aData = new Uint8ClampedArray(aw * ah * 4);
    for (let y = 0; y < ah; y++) {
        let gStart = ((safeAy + y) * imgW + safeAx) * 4;
        aData.set(fullFrame.data.subarray(gStart, gStart + aw * 4), y * aw * 4);
    }

    if (anchorBox.baseline === null || anchorBox.baseline.length !== aData.length) {
        anchorBox.baseline = new Float32Array(aData);
        anchorBox.refNeedsDraw = true;
    }

    if (anchorBox.refNeedsDraw && anchorBox.refCtx && anchorBox.baseline) {
        try {
            let drawData = new Uint8ClampedArray(anchorBox.baseline);
            let imgData = new ImageData(drawData, aw, ah);
            let tmpC = document.createElement('canvas');
            tmpC.width = aw;
            tmpC.height = ah;
            tmpC.getContext('2d').putImageData(imgData, 0, 0);
            drawProportional(anchorBox.refCtx, tmpC, 0, 0, aw, ah, 80, 40);
            anchorBox.refNeedsDraw = false;
        } catch (e) {
            anchorBox.baseline = null;
        }
    }

    let baseTotal = 0;
    let currTotal = 0;
    let pCount = 0;

    for (let j = 0; j < aData.length; j += PIXEL_STEP * 4) {
        baseTotal += anchorBox.baseline[j] * 0.299 + anchorBox.baseline[j + 1] * 0.587 + anchorBox.baseline[j + 2] * 0.114;
        currTotal += aData[j] * 0.299 + aData[j + 1] * 0.587 + aData[j + 2] * 0.114;
        pCount++;
    }
    let offset = (currTotal / pCount) - (baseTotal / pCount);
    let totalDiff = 0;
    for (let j = 0; j < aData.length; j += PIXEL_STEP * 4) {
        let baseVal = anchorBox.baseline[j] * 0.299 + anchorBox.baseline[j + 1] * 0.587 + anchorBox.baseline[j + 2] * 0.114;
        let currVal = aData[j] * 0.299 + aData[j + 1] * 0.587 + aData[j + 2] * 0.114;
        totalDiff += Math.abs(currVal - (baseVal + offset));
    }

    let structuralDiff = Math.round(totalDiff / pCount);
    let anchorThreshold = parseInt(slideAnchorSens.value);

    if (state.isMonitoring && structuralDiff > anchorThreshold) {
        if (anchorBox.alarmStart === 0) {
            anchorBox.alarmStart = now;
        } else if (now - anchorBox.alarmStart > 1000) {
            anchorBox.isAlarm = true;
            playAnchorBeep();

            if (chkTelegram.checked && (!anchorBox.lastTgAlarm || now - anchorBox.lastTgAlarm > 60000)) {
                anchorBox.lastTgAlarm = now;
                sendAnchorTgPhoto();
            }
        }
    } else {
        anchorBox.alarmStart = 0;
        anchorBox.isAlarm = false;

        let alpha = parseInt(slideAnchorDrift.value) * 0.001;
        if (chkAnchorDrift.checked && state.isMonitoring && structuralDiff > 0 && structuralDiff < anchorThreshold) {
            for (let j = 0; j < aData.length; j++) {
                anchorBox.baseline[j] = anchorBox.baseline[j] * (1 - alpha) + aData[j] * alpha;
            }
            if (state.frameCounter % 30 === 0) anchorBox.refNeedsDraw = true;
        }
    }

    if (anchorBox.zoomBoxDiv) {
        if (anchorBox.isAlarm && state.isMonitoring) anchorBox.zoomBoxDiv.classList.add('alarm-zoom');
        else anchorBox.zoomBoxDiv.classList.remove('alarm-zoom');
    }

    if (anchorBox.zoomStatsDiv && state.showZoomValues && state.frameCounter % 4 === 0) {
        let txt = `Abw: <span style="color:#00ff88;">${structuralDiff}</span> / Max: ${anchorThreshold}`;
        if (anchorBox.isAlarm && state.isMonitoring) {
            txt += `<br><b style="color:#ffaa00;">VERRUTSCHT!</b>`;
        } else {
            txt += `<br>Größe: ${aw}x${ah} px`;
        }
        anchorBox.zoomStatsDiv.innerHTML = txt;
    }

    return anchorBox.isAlarm;
}

export function drawUI() {
    if (state.isRecordingBoxId !== null) {
        let b = boxes.find(x => x.id === state.isRecordingBoxId);
        if (b) {
            recordCtx.fillStyle = 'black';
            recordCtx.fillRect(0, 0, recordCanvas.width, recordCanvas.height);
            recordCtx.drawImage(canvas, b.x, b.y, b.w, b.h, 0, 0, recordCanvas.width, recordCanvas.height);
        }
    }

    if (!state.showCamera) return;

    for (let i = 0; i < state.activeBoxCount; i++) {
        const box = boxes[i];
        let fillColor = box.isAlarm ? 'rgba(255,0,0,0.3)' : 'rgba(0,255,0,0.15)';
        let borderColor = box.isAlarm ? '#ff0000' : '#00ff00';

        ctx.fillStyle = fillColor;
        ctx.fillRect(box.x, box.y, box.w, box.h);
        if (box === state.selectedBox) {
            ctx.beginPath();
            ctx.rect(box.x - 4, box.y - 4, box.w + 8, box.h + 8);
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#00aaff';
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.rect(box.x, box.y, box.w, box.h);
        ctx.lineWidth = box.isAlarm ? 4 : 2;
        if (!state.isMonitoring) ctx.setLineDash([4, 4]);
        ctx.strokeStyle = borderColor;
        ctx.stroke();
        ctx.setLineDash([]);
    }

    if (anchorBox.active) {
        let aFillColor = anchorBox.isAlarm ? 'rgba(255,170,0,0.3)' : 'rgba(0,170,255,0.15)';
        let aBorderColor = anchorBox.isAlarm ? '#ffaa00' : '#00aaff';

        ctx.fillStyle = aFillColor;
        ctx.fillRect(anchorBox.x, anchorBox.y, anchorBox.w, anchorBox.h);
        if (anchorBox === state.selectedBox) {
            ctx.beginPath();
            ctx.rect(anchorBox.x - 4, anchorBox.y - 4, anchorBox.w + 8, anchorBox.h + 8);
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#00aaff';
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.rect(anchorBox.x, anchorBox.y, anchorBox.w, anchorBox.h);
        ctx.lineWidth = anchorBox.isAlarm ? 4 : 2;
        if (!state.isMonitoring) ctx.setLineDash([4, 4]);
        ctx.strokeStyle = aBorderColor;
        ctx.stroke();
        ctx.setLineDash([]);
    }

    if (muteBox.active) {
        let mFillColor = muteBox.state === 'MUTED' ? 'rgba(255,204,0,0.5)' : 'rgba(255,204,0,0.15)';
        let mBorderColor = '#ffcc00';

        ctx.fillStyle = mFillColor;
        ctx.fillRect(muteBox.x, muteBox.y, muteBox.w, muteBox.h);
        if (muteBox === state.selectedBox) {
            ctx.beginPath();
            ctx.rect(muteBox.x - 4, muteBox.y - 4, muteBox.w + 8, muteBox.h + 8);
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#00aaff';
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.rect(muteBox.x, muteBox.y, muteBox.w, muteBox.h);
        ctx.lineWidth = muteBox.state === 'MUTED' ? 4 : 2;
        if (!state.isMonitoring) ctx.setLineDash([4, 4]);
        ctx.strokeStyle = mBorderColor;
        ctx.stroke();
        ctx.setLineDash([]);
    }
}
