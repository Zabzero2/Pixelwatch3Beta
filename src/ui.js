// UI-Steuerung, Zoom-Vorschauen, Akkordeon-Menü, D-Pad & Drag-and-Drop

import {
    zoomHeader, canvas, startBtn, monitorBtn, cameraSelect,
    chkExpert, chkAnchorDrift, chkMuteDrift,
    rowAnchorDriftSpeed, rowMuteDriftSpeed,
    chkTelegram, txtTelegramToken, txtTelegramChatId,
    chkAudioGuard, selLocalSound, rowLocalSound,
    panelDisplaySettings, panelMainSettings, panelAnchorSettings,
    panelMuteSettings, panelSmartSettings,
    btnToggleDisplayConfig, btnToggleMainConfig, btnToggleAnchorConfig,
    btnToggleMuteConfig, btnToggleSmartConfig,
    slideSens, slideMass, slideTakt, slideToleranz,
    slideWidth, slideHeight, slidePulse, slideHold,
    valSens, valMass, valTakt, valToleranz,
    valWidth, valHeight, valPulse, valHold,
    slideAnchorSens, valAnchorSens, slideAnchorW, valAnchorW,
    slideAnchorH, valAnchorH, slideAnchorDrift, valAnchorDrift,
    slideMuteSens, valMuteSens, slideMuteHold, valMuteHold,
    slideMuteW, valMuteW, slideMuteH, valMuteH,
    slideMuteDrift, valMuteDrift,
    slideAudioThreshold, valAudioThreshold,
    selectedBoxIdLabel
} from './dom.js';
import { state, boxes, anchorBox, muteBox, HIT_PAD } from './state.js';
import { isLocalMuted, playBeep } from './audio.js';
import { updateStealthClock } from './weather.js';
import { saveSettings } from './storage.js';

export function drawProportional(ctxTarget, sourceCanvas, sx, sy, sw, sh, targetW, targetH) {
    ctxTarget.fillStyle = "black";
    ctxTarget.fillRect(0, 0, targetW, targetH);
    let scale = Math.min(targetW / sw, targetH / sh);
    let drawW = sw * scale;
    let drawH = sh * scale;
    let dx = (targetW - drawW) / 2;
    let dy = (targetH - drawH) / 2;
    ctxTarget.drawImage(sourceCanvas, sx, sy, sw, sh, dx, dy, drawW, drawH);
}

export function updateSmartUI() {
    const tgActive = chkTelegram.checked && txtTelegramToken.value.trim() !== '' && txtTelegramChatId.value.trim() !== '';
    rowLocalSound.style.display = tgActive ? 'flex' : 'none';

    if (chkAudioGuard.checked) {
        if (!selLocalSound.disabled) {
            selLocalSound.dataset.prevState = selLocalSound.value;
        }
        selLocalSound.value = 'off';
        selLocalSound.disabled = true;
    } else {
        if (selLocalSound.disabled) {
            if (selLocalSound.dataset.prevState) {
                selLocalSound.value = selLocalSound.dataset.prevState;
            }
        }
        selLocalSound.disabled = false;
    }
    updateAppVisuals();
}

export function updateUIVisibility() {
    const exp = chkExpert.checked;
    cameraSelect.style.display = exp ? 'block' : 'none';
    document.getElementById('rowCamZoom').style.display = exp ? 'flex' : 'none';
    document.getElementById('rowSens').style.display = exp ? 'flex' : 'none';
    document.getElementById('rowMass').style.display = exp ? 'flex' : 'none';
    document.getElementById('rowTakt').style.display = exp ? 'flex' : 'none';
    document.getElementById('rowToleranz').style.display = exp ? 'flex' : 'none';
    document.getElementById('rowPulse').style.display = exp ? 'flex' : 'none';
    document.getElementById('rowAnchorDriftCheck').style.display = exp ? 'block' : 'none';
    document.getElementById('rowAnchorSens').style.display = exp ? 'flex' : 'none';
    document.getElementById('rowMuteDriftCheck').style.display = exp ? 'block' : 'none';
    document.getElementById('rowMuteSens').style.display = exp ? 'flex' : 'none';
    rowAnchorDriftSpeed.style.display = (exp && chkAnchorDrift.checked) ? 'flex' : 'none';
    rowMuteDriftSpeed.style.display = (exp && chkMuteDrift.checked) ? 'flex' : 'none';
}

export function updateMaxDeltaLimitRange() {
    const w = parseInt(slideWidth.value);
    const h = parseInt(slideHeight.value);
    const maxPixels = w * h;
    slideMass.max = maxPixels;
    if (parseInt(slideMass.value) > maxPixels) {
        slideMass.value = maxPixels;
    }
    valMass.innerText = slideMass.value;
}

export function updateAppVisuals() {
    if (isLocalMuted()) {
        document.body.classList.add('silent-mode-on');
    } else {
        document.body.classList.remove('silent-mode-on');
    }
    updateStealthClock(true);
}

export function updateMonitorButtonUI() {
    if (state.isRunning) {
        startBtn.innerText = "⏹ Kamera Stopp";
        startBtn.classList.add("running");

        if (state.isMonitoring) {
            monitorBtn.innerText = "🛡️ Überwachung: SCHARF";
            monitorBtn.style.background = "";
            monitorBtn.classList.remove("off");
        } else {
            monitorBtn.innerText = "⏸ Überwachung: PAUSIERT";
            monitorBtn.style.background = "#dc3545";
            monitorBtn.classList.add("off");
        }
    } else {
        startBtn.innerText = "📷 Kamera Start";
        startBtn.classList.remove("running");

        monitorBtn.innerText = "⚠️ Überwachung: AUS (Kamera starten)";
        monitorBtn.style.background = "#dc3545";
        monitorBtn.classList.add("off");
    }
    updateStealthClock(true);
}

// Akkordeon-Logik: Beim Öffnen eines Moduls schließen sich die anderen automatisch
const ALL_PANELS = [
    { key: 'display', btn: btnToggleDisplayConfig, panel: panelDisplaySettings, stateProp: 'panelDisplayOpen' },
    { key: 'main', btn: btnToggleMainConfig, panel: panelMainSettings, stateProp: 'panelMainOpen' },
    { key: 'anchor', btn: btnToggleAnchorConfig, panel: panelAnchorSettings, stateProp: 'panelAnchorOpen' },
    { key: 'mute', btn: btnToggleMuteConfig, panel: panelMuteSettings, stateProp: 'panelMuteOpen' },
    { key: 'smart', btn: btnToggleSmartConfig, panel: panelSmartSettings, stateProp: 'panelSmartOpen' }
];

export function togglePanel(btn, panel, stateVarName) {
    let isOpen = panel.style.display === 'flex';
    const nextOpenState = !isOpen;

    ALL_PANELS.forEach(item => {
        if (item.key === stateVarName && nextOpenState) {
            item.panel.style.display = 'flex';
            item.btn.classList.add('open');
            state[item.stateProp] = true;
        } else {
            item.panel.style.display = 'none';
            item.btn.classList.remove('open');
            state[item.stateProp] = false;
        }
    });

    saveSettings();
}

export function createZoomDisplays() {
    zoomHeader.innerHTML = '';
    for (let i = 0; i < state.activeBoxCount; i++) {
        const div = document.createElement('div');
        div.className = 'zoom-box';
        div.onclick = () => { state.selectedBox = boxes[i]; updateZoomSelectionUI(); };
        const c = document.createElement('canvas');
        c.className = 'zoom-canvas';
        c.width = 100;
        c.height = 50;
        const label = document.createElement('div');
        label.className = 'zoom-label';
        label.innerText = 'BOX ' + (i + 1);
        const stats = document.createElement('div');
        stats.className = 'zoom-stats';
        stats.style.display = state.showZoomValues ? 'block' : 'none';
        stats.innerHTML = `Masse: 0`;
        div.appendChild(c);
        div.appendChild(label);
        div.appendChild(stats);
        zoomHeader.appendChild(div);
        boxes[i].zoomCtx = c.getContext('2d');
        boxes[i].zoomStatsDiv = stats;
        boxes[i].zoomBoxDiv = div;
    }

    if (anchorBox.active) {
        const div = document.createElement('div');
        div.className = 'zoom-box anchor-zoom';
        div.onclick = () => { state.selectedBox = anchorBox; updateZoomSelectionUI(); };
        const label = document.createElement('div');
        label.className = 'zoom-label';
        label.innerText = 'ANKER';
        const canvasContainer = document.createElement('div');
        canvasContainer.style.cssText = "display:flex; gap:5px; margin-top:4px;";
        const liveWrap = document.createElement('div');
        const liveLabel = document.createElement('div');
        liveLabel.style.cssText = "font-size:9px; color:#ccc;";
        liveLabel.innerText = "LIVE";
        const cLive = document.createElement('canvas');
        cLive.className = 'zoom-canvas';
        cLive.width = 80;
        cLive.height = 40;
        liveWrap.appendChild(liveLabel);
        liveWrap.appendChild(cLive);
        const refWrap = document.createElement('div');
        const refLabel = document.createElement('div');
        refLabel.style.cssText = "font-size:9px; color:#00aaff;";
        refLabel.innerText = "REFERENZ";
        const cRef = document.createElement('canvas');
        cRef.className = 'zoom-canvas';
        cRef.width = 80;
        cRef.height = 40;
        refWrap.appendChild(refLabel);
        refWrap.appendChild(cRef);
        canvasContainer.appendChild(liveWrap);
        canvasContainer.appendChild(refWrap);
        const stats = document.createElement('div');
        stats.className = 'zoom-stats';
        stats.style.display = state.showZoomValues ? 'block' : 'none';
        stats.innerHTML = `Lade...`;
        const rst = document.createElement('button');
        rst.innerText = "🔄 Neu setzen";
        rst.style.cssText = "font-size:11px; padding:4px 8px; margin-top:5px; background:#17a2b8; border-radius:4px;";
        rst.onclick = (e) => { e.stopPropagation(); anchorBox.baseline = null; playBeep(); };
        div.appendChild(label);
        div.appendChild(canvasContainer);
        div.appendChild(stats);
        div.appendChild(rst);
        zoomHeader.appendChild(div);
        anchorBox.zoomCtx = cLive.getContext('2d');
        anchorBox.refCtx = cRef.getContext('2d');
        anchorBox.zoomStatsDiv = stats;
        anchorBox.zoomBoxDiv = div;
        if (anchorBox.baseline) anchorBox.refNeedsDraw = true;
    }

    if (muteBox.active) {
        const div = document.createElement('div');
        div.className = 'zoom-box mute-zoom';
        div.onclick = () => { state.selectedBox = muteBox; updateZoomSelectionUI(); };
        const c = document.createElement('canvas');
        c.className = 'zoom-canvas';
        c.width = 100;
        c.height = 50;
        const label = document.createElement('div');
        label.className = 'zoom-label';
        label.innerText = 'MUTE-ZONE';
        const stats = document.createElement('div');
        stats.className = 'zoom-stats';
        stats.style.display = state.showZoomValues ? 'block' : 'none';
        stats.innerHTML = `Lade...`;
        const rst = document.createElement('button');
        rst.innerText = "🔄 Leer setzen";
        rst.style.cssText = "font-size:11px; padding:4px 8px; margin-top:5px; background:#28a745; border-radius:4px;";
        rst.onclick = (e) => {
            e.stopPropagation();
            muteBox.baseline = null;
            muteBox.state = 'IDLE';
            muteBox.emptyStartTime = 0;
            muteBox.triggerStart = 0;
            playBeep();
        };
        div.appendChild(c);
        div.appendChild(label);
        div.appendChild(stats);
        div.appendChild(rst);
        zoomHeader.appendChild(div);
        muteBox.zoomCtx = c.getContext('2d');
        muteBox.zoomStatsDiv = stats;
        muteBox.zoomBoxDiv = div;
    }
    updateZoomSelectionUI();
}

export function updateZoomSelectionUI() {
    let allDivs = [...boxes.map(b => b.zoomBoxDiv)];
    if (anchorBox.active) allDivs.push(anchorBox.zoomBoxDiv);
    if (muteBox.active) allDivs.push(muteBox.zoomBoxDiv);
    allDivs.forEach((div) => { if (div) div.classList.remove('active-zoom'); });
    if (state.selectedBox && state.selectedBox.zoomBoxDiv) {
        state.selectedBox.zoomBoxDiv.classList.add('active-zoom');
        selectedBoxIdLabel.innerText = state.selectedBox.id;
    }
}

export function updateLabels() {
    valSens.innerText = slideSens.value;
    valWidth.innerText = slideWidth.value;
    valHeight.innerText = slideHeight.value;
    valPulse.innerText = slidePulse.value;
    valHold.innerText = slideHold.value;
    valTakt.innerText = slideTakt.value;
    valToleranz.innerText = slideToleranz.value;
    valAnchorSens.innerText = slideAnchorSens.value;
    valAnchorW.innerText = slideAnchorW.value;
    valAnchorH.innerText = slideAnchorH.value;
    valAnchorDrift.innerText = slideAnchorDrift.value;
    valMuteSens.innerText = slideMuteSens.value;
    valMuteHold.innerText = slideMuteHold.value;
    valMuteW.innerText = slideMuteW.value;
    valMuteH.innerText = slideMuteH.value;
    valMuteDrift.innerText = slideMuteDrift.value;
    valAudioThreshold.innerText = slideAudioThreshold.value;
    updateMaxDeltaLimitRange();
}

export function setupAdjBtn(minusId, plusId, sliderId) {
    const slider = document.getElementById(sliderId);
    document.getElementById(minusId).addEventListener('click', (e) => {
        e.preventDefault();
        slider.value = parseFloat(slider.value) - (parseFloat(slider.step) || 1);
        slider.dispatchEvent(new Event('input'));
    });
    document.getElementById(plusId).addEventListener('click', (e) => {
        e.preventDefault();
        slider.value = parseFloat(slider.value) + (parseFloat(slider.step) || 1);
        slider.dispatchEvent(new Event('input'));
    });
}

// D-Pad Turbo-Steuerung (Speichert erst beim Loslassen in den LocalStorage)
let turboTimeout = null;
let turboInterval = null;
let turboDirty = false;

function resetSelectedBoxBaseline() {
    if (state.selectedBox === anchorBox) {
        anchorBox.baseline = null;
    } else if (state.selectedBox === muteBox) {
        muteBox.baseline = null;
        muteBox.state = 'IDLE';
        muteBox.emptyStartTime = 0;
        muteBox.triggerStart = 0;
    } else if (state.selectedBox) {
        state.selectedBox.baseline = null;
    }
}

function startTurboAction(actionFn) {
    if (!state.selectedBox) return;
    actionFn(1);
    resetSelectedBoxBaseline();
    turboDirty = true;

    turboTimeout = setTimeout(() => {
        let speed = 1;
        let tick = 0;
        turboInterval = setInterval(() => {
            tick++;
            if (tick > 15) speed = 3;
            if (tick > 35) speed = 8;
            actionFn(speed);
            resetSelectedBoxBaseline();
            turboDirty = true;
        }, 50);
    }, 600);
}

function stopTurboAction() {
    if (turboTimeout) clearTimeout(turboTimeout);
    if (turboInterval) clearInterval(turboInterval);
    turboTimeout = null;
    turboInterval = null;
    if (turboDirty) {
        turboDirty = false;
        saveSettings();
    }
}

export function bindTurboButton(btnId, actionFn) {
    const btn = document.getElementById(btnId);
    btn.addEventListener('mousedown', (e) => { e.preventDefault(); startTurboAction(actionFn); });
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); startTurboAction(actionFn); });
    btn.addEventListener('mouseup', stopTurboAction);
    btn.addEventListener('mouseleave', stopTurboAction);
    btn.addEventListener('touchend', stopTurboAction);
    btn.addEventListener('touchcancel', stopTurboAction);
}

// Canvas Drag & Drop
function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if (e.type.includes('touch')) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }
    return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
    };
}

export function startDrag(e) {
    if (!state.isRunning || !state.showCamera) return;
    const pos = getPointerPos(e);
    let checkBoxes = boxes.slice(0, state.activeBoxCount);
    if (anchorBox.active) checkBoxes.push(anchorBox);
    if (muteBox.active) checkBoxes.push(muteBox);

    let boxHit = false;
    for (let i = checkBoxes.length - 1; i >= 0; i--) {
        const box = checkBoxes[i];
        if (pos.x >= box.x - HIT_PAD && pos.x <= box.x + box.w + HIT_PAD && pos.y >= box.y - HIT_PAD && pos.y <= box.y + box.h + HIT_PAD) {
            state.draggingBox = box;
            state.selectedBox = box;
            updateZoomSelectionUI();
            updateLabels();
            state.dragOffsetX = pos.x - box.x;
            state.dragOffsetY = pos.y - box.y;
            if (box !== anchorBox && box !== muteBox) {
                box.history = [];
                box.baseline = null;
            } else if (box === anchorBox) {
                anchorBox.baseline = null;
            } else if (box === muteBox) {
                muteBox.baseline = null;
                muteBox.state = 'IDLE';
                muteBox.emptyStartTime = 0;
                muteBox.triggerStart = 0;
            }
            boxHit = true;
            break;
        }
    }

    if (boxHit && e.cancelable) { e.preventDefault(); }
}

export function moveDrag(e) {
    if (!state.draggingBox || !state.showCamera) return;
    const pos = getPointerPos(e);
    state.draggingBox.x = Math.max(0, Math.min(canvas.width - state.draggingBox.w, pos.x - state.dragOffsetX));
    state.draggingBox.y = Math.max(0, Math.min(canvas.height - state.draggingBox.h, pos.y - state.dragOffsetY));
    if (state.draggingBox !== anchorBox && state.draggingBox !== muteBox) {
        state.draggingBox.history = [];
        state.draggingBox.baseline = null;
    } else if (state.draggingBox === anchorBox) {
        anchorBox.baseline = null;
    } else if (state.draggingBox === muteBox) {
        muteBox.baseline = null;
        muteBox.state = 'IDLE';
        muteBox.emptyStartTime = 0;
        muteBox.triggerStart = 0;
    }

    if (e.cancelable) { e.preventDefault(); }
}

export function endDrag() {
    if (state.draggingBox) saveSettings();
    state.draggingBox = null;
}
