// Haupteinstiegspunkt: Event-Listener, Initialisierung & Service Worker

import {
    canvas, startBtn, monitorBtn, activateStealthBtn, stealthOverlay,
    exitStealthBtn, toggleAudioGuardBtnStealth, toggleSettingsBtn, mainSettingsWrapper,
    helpBtn, helpOverlay, closeHelpBtn,
    chkExpert, chkShowZoom, chkShowCam, chkShowDpad, dpadPanel,
    btnToggleDisplayConfig, btnToggleMainConfig, btnToggleAnchorConfig,
    btnToggleMuteConfig, btnToggleSmartConfig,
    panelDisplaySettings, panelMainSettings, panelAnchorSettings,
    panelMuteSettings, panelSmartSettings,
    chkAnchorActive, chkAnchorDrift, chkMuteActive, chkMuteDrift,
    chkTelegram, telegramSettingsBox, chkAudioGuard, selLocalSound,
    txtTelegramToken, txtTelegramChatId, selTgVideoMode, txtWeatherCities,
    cameraSelect, slideCamZoom, valCamZoom,
    slideSens, slideMass, valMass, slideTakt, slideToleranz,
    slideWidth, slideHeight, slidePulse, slideHold, boxCountSelect,
    slideAnchorSens, slideAnchorW, slideAnchorH, slideAnchorDrift,
    slideMuteSens, slideMuteHold, slideMuteW, slideMuteH, slideMuteDrift,
    slideAudioThreshold
} from './dom.js';
import { state, boxes, anchorBox, muteBox } from './state.js';
import {
    togglePanel, updateUIVisibility, updateSmartUI, createZoomDisplays,
    updateZoomSelectionUI, updateLabels, updateMaxDeltaLimitRange,
    updateMonitorButtonUI, setupAdjBtn, bindTurboButton,
    startDrag, moveDrag, endDrag
} from './ui.js';
import {
    saveSettings, loadSettings,
    resetMainModule, resetAnchorModule, resetMuteModule, resetAllModules
} from './storage.js';
import { restartAudioSystem, stopAudioSystem } from './audio.js';
import { fetchWeather, updateStealthClock } from './weather.js';
import { startSystem, stopSystem, requestInitialPermissions } from './camera.js';

// Service Worker registrieren & direkt alle Berechtigungen (Kamera + Mikrofon) anfragen
window.addEventListener('load', () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(err => console.log('SW Setup fehlgeschlagen', err));
    }
    requestInitialPermissions();
});

// Einstellungen ein-/ausblenden
toggleSettingsBtn.addEventListener('click', () => {
    state.settingsVisible = !state.settingsVisible;
    mainSettingsWrapper.style.display = state.settingsVisible ? 'flex' : 'none';
    toggleSettingsBtn.classList.toggle('active-btn', state.settingsVisible);
    saveSettings();
});

// Modul-Konfigurationsbereiche auf-/zuklappen (Akkordeon)
btnToggleDisplayConfig.addEventListener('click', () => togglePanel(btnToggleDisplayConfig, panelDisplaySettings, 'display'));
btnToggleMainConfig.addEventListener('click', () => togglePanel(btnToggleMainConfig, panelMainSettings, 'main'));
btnToggleAnchorConfig.addEventListener('click', () => togglePanel(btnToggleAnchorConfig, panelAnchorSettings, 'anchor'));
btnToggleMuteConfig.addEventListener('click', () => togglePanel(btnToggleMuteConfig, panelMuteSettings, 'mute'));
btnToggleSmartConfig.addEventListener('click', () => togglePanel(btnToggleSmartConfig, panelSmartSettings, 'smart'));

// Anzeige-Checkboxen
chkExpert.addEventListener('change', () => { updateUIVisibility(); saveSettings(); });
chkShowZoom.addEventListener('change', (e) => {
    state.showZoomValues = e.target.checked;
    for (let i = 0; i < state.activeBoxCount; i++) {
        if (boxes[i].zoomStatsDiv) boxes[i].zoomStatsDiv.style.display = state.showZoomValues ? 'block' : 'none';
    }
    if (anchorBox.zoomStatsDiv) anchorBox.zoomStatsDiv.style.display = state.showZoomValues ? 'block' : 'none';
    if (muteBox.zoomStatsDiv) muteBox.zoomStatsDiv.style.display = state.showZoomValues ? 'block' : 'none';
    saveSettings();
});
chkShowCam.addEventListener('change', (e) => {
    state.showCamera = e.target.checked;
    canvas.style.display = state.showCamera ? 'block' : 'none';
    saveSettings();
});
chkShowDpad.addEventListener('change', (e) => {
    dpadPanel.style.display = e.target.checked ? 'flex' : 'none';
    saveSettings();
});

// Smart-Modem & Warnungen Events
chkTelegram.addEventListener('change', () => {
    telegramSettingsBox.style.display = chkTelegram.checked ? 'flex' : 'none';
    updateSmartUI();
    saveSettings();
});
txtTelegramToken.addEventListener('input', () => { updateSmartUI(); saveSettings(); });
txtTelegramChatId.addEventListener('input', () => { updateSmartUI(); saveSettings(); });
selTgVideoMode.addEventListener('change', saveSettings);
txtWeatherCities.addEventListener('input', saveSettings);
selLocalSound.addEventListener('change', () => { updateSmartUI(); saveSettings(); });

chkAudioGuard.addEventListener('change', () => {
    if (chkAudioGuard.checked) {
        if (!chkTelegram.checked || !txtTelegramToken.value.trim() || !txtTelegramChatId.value.trim()) {
            alert('Bitte aktiviere und konfiguriere zuerst Telegram im Menü!');
            chkAudioGuard.checked = false;
            return;
        } else {
            alert('ACHTUNG: Alle lokalen Alarme sind stummgeschaltet! Warnungen erfolgen nur noch über Telegram.');
        }
    }
    updateSmartUI();
    saveSettings();
    if (state.isRunning) {
        if (chkAudioGuard.checked) restartAudioSystem();
        else stopAudioSystem();
    }
});

// Anker & Mute-Zone Events
chkAnchorDrift.addEventListener('change', () => { updateUIVisibility(); saveSettings(); });
chkMuteDrift.addEventListener('change', () => { updateUIVisibility(); saveSettings(); });

chkAnchorActive.addEventListener('change', (e) => {
    anchorBox.active = e.target.checked;
    anchorBox.baseline = null;
    if (anchorBox.active) state.selectedBox = anchorBox;
    else if (state.selectedBox === anchorBox) state.selectedBox = boxes[0];
    saveSettings();
    createZoomDisplays();
});

chkMuteActive.addEventListener('change', (e) => {
    muteBox.active = e.target.checked;
    muteBox.baseline = null;
    muteBox.state = 'IDLE';
    muteBox.continuousStart = 0;
    muteBox.wasEmpty = true;
    muteBox.emptyStartTime = 0;
    muteBox.triggerStart = 0;
    if (muteBox.active) state.selectedBox = muteBox;
    else if (state.selectedBox === muteBox) state.selectedBox = boxes[0];
    saveSettings();
    createZoomDisplays();
});

// Hilfe-Overlay
helpBtn.addEventListener('click', () => { helpOverlay.style.display = 'flex'; });
closeHelpBtn.addEventListener('click', () => { helpOverlay.style.display = 'none'; });

// +/- Buttons für alle Slider
setupAdjBtn('sensMinus', 'sensPlus', 'slideSens');
setupAdjBtn('massMinus', 'massPlus', 'slideMass');
setupAdjBtn('taktMinus', 'taktPlus', 'slideTakt');
setupAdjBtn('toleranzMinus', 'toleranzPlus', 'slideToleranz');
setupAdjBtn('widthMinus', 'widthPlus', 'slideWidth');
setupAdjBtn('heightMinus', 'heightPlus', 'slideHeight');
setupAdjBtn('pulseMinus', 'pulsePlus', 'slidePulse');
setupAdjBtn('holdMinus', 'holdPlus', 'slideHold');
setupAdjBtn('zoomMinus', 'zoomPlus', 'slideCamZoom');
setupAdjBtn('anchorSensMinus', 'anchorSensPlus', 'slideAnchorSens');
setupAdjBtn('anchorWMinus', 'anchorWPlus', 'slideAnchorW');
setupAdjBtn('anchorHMinus', 'anchorHPlus', 'slideAnchorH');
setupAdjBtn('anchorDriftMinus', 'anchorDriftPlus', 'slideAnchorDrift');
setupAdjBtn('muteSensMinus', 'muteSensPlus', 'slideMuteSens');
setupAdjBtn('muteHoldMinus', 'muteHoldPlus', 'slideMuteHold');
setupAdjBtn('muteWMinus', 'muteWPlus', 'slideMuteW');
setupAdjBtn('muteHMinus', 'muteHPlus', 'slideMuteH');
setupAdjBtn('muteDriftMinus', 'muteDriftPlus', 'slideMuteDrift');
setupAdjBtn('audioThresMinus', 'audioThresPlus', 'slideAudioThreshold');

// Kamera-Wechsel & Zoom
cameraSelect.addEventListener('change', () => {
    saveSettings();
    if (state.isRunning) {
        stopSystem();
        setTimeout(startSystem, 500);
    }
});

slideCamZoom.addEventListener('input', (e) => {
    valCamZoom.innerText = parseFloat(e.target.value).toFixed(1);
    if (state.currentTrack) {
        try { state.currentTrack.applyConstraints({ advanced: [{ zoom: e.target.value }] }); } catch (err) {}
    }
});

// Gespeicherte Einstellungen beim Start laden
loadSettings();

// Tarnmodus & Uhr-Intervall
setInterval(() => updateStealthClock(false), 500);

activateStealthBtn.addEventListener('click', () => {
    stealthOverlay.style.display = 'flex';
    state.isStealthActive = true;
    updateStealthClock(true);
    fetchWeather();
});

exitStealthBtn.addEventListener('click', () => {
    stealthOverlay.style.display = 'none';
    state.isStealthActive = false;
});

toggleAudioGuardBtnStealth.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!chkTelegram.checked || !txtTelegramToken.value.trim() || !txtTelegramChatId.value.trim()) return;

    chkAudioGuard.checked = !chkAudioGuard.checked;
    updateSmartUI();
    saveSettings();

    if (chkAudioGuard.checked && state.isRunning) restartAudioSystem();
    else if (!chkAudioGuard.checked) stopAudioSystem();
});

// Slider-Events
slideSens.addEventListener('input', () => { updateLabels(); saveSettings(); });
slideMass.addEventListener('input', () => { valMass.innerText = slideMass.value; saveSettings(); });
slideTakt.addEventListener('input', () => { updateLabels(); saveSettings(); });
slideToleranz.addEventListener('input', () => { updateLabels(); saveSettings(); });
slidePulse.addEventListener('input', () => { updateLabels(); saveSettings(); });
slideHold.addEventListener('input', () => { updateLabels(); saveSettings(); });
slideWidth.addEventListener('input', () => {
    updateMaxDeltaLimitRange();
    updateLabels();
    saveSettings();
    boxes.forEach(b => { b.w = parseInt(slideWidth.value); b.history = []; b.baseline = null; });
});
slideHeight.addEventListener('input', () => {
    updateMaxDeltaLimitRange();
    updateLabels();
    saveSettings();
    boxes.forEach(b => { b.h = parseInt(slideHeight.value); b.history = []; b.baseline = null; });
});
slideAudioThreshold.addEventListener('input', () => { updateLabels(); saveSettings(); });

slideAnchorSens.addEventListener('input', () => { updateLabels(); saveSettings(); });
slideAnchorW.addEventListener('input', () => { updateLabels(); saveSettings(); anchorBox.w = parseInt(slideAnchorW.value); anchorBox.baseline = null; });
slideAnchorH.addEventListener('input', () => { updateLabels(); saveSettings(); anchorBox.h = parseInt(slideAnchorH.value); anchorBox.baseline = null; });
slideAnchorDrift.addEventListener('input', () => { updateLabels(); saveSettings(); });

slideMuteSens.addEventListener('input', () => { updateLabels(); saveSettings(); });
slideMuteHold.addEventListener('input', () => { updateLabels(); saveSettings(); });
slideMuteW.addEventListener('input', () => { updateLabels(); saveSettings(); muteBox.w = parseInt(slideMuteW.value); muteBox.baseline = null; });
slideMuteH.addEventListener('input', () => { updateLabels(); saveSettings(); muteBox.h = parseInt(slideMuteH.value); muteBox.baseline = null; });
slideMuteDrift.addEventListener('input', () => { updateLabels(); saveSettings(); });

boxCountSelect.addEventListener('change', (e) => {
    state.activeBoxCount = parseInt(e.target.value);
    createZoomDisplays();
    if (state.selectedBox !== anchorBox && state.selectedBox !== muteBox && state.selectedBox.id > state.activeBoxCount) {
        state.selectedBox = boxes[0];
        updateZoomSelectionUI();
    }
    updateLabels();
    saveSettings();
});

// Reset-Buttons
document.getElementById('btnResetMain').addEventListener('click', resetMainModule);
document.getElementById('btnResetAnchor').addEventListener('click', resetAnchorModule);
document.getElementById('btnResetMute').addEventListener('click', resetMuteModule);
document.getElementById('btnResetAll').addEventListener('click', resetAllModules);

// Überwachung Aktiv/Pausiert Button
monitorBtn.addEventListener('click', () => {
    if (!state.isRunning) {
        alert('Bitte erst Kamera starten!');
        return;
    }
    state.isMonitoring = !state.isMonitoring;
    if (!state.isMonitoring) {
        boxes.forEach(b => { b.isAlarm = false; b.validCrossings = 0; });
        anchorBox.isAlarm = false;
        muteBox.state = 'IDLE';
        muteBox.emptyStartTime = 0;
        muteBox.triggerStart = 0;
    }
    updateMonitorButtonUI();
});

// D-Pad Richtung & Größenänderung
bindTurboButton('btnUp', (s) => state.selectedBox.y -= s);
bindTurboButton('btnDown', (s) => state.selectedBox.y += s);
bindTurboButton('btnLeft', (s) => state.selectedBox.x -= s);
bindTurboButton('btnRight', (s) => state.selectedBox.x += s);

bindTurboButton('btnWMinus', (s) => {
    state.selectedBox.w = Math.max(5, state.selectedBox.w - s);
    if (state.selectedBox === anchorBox) {
        slideAnchorW.value = state.selectedBox.w;
        slideAnchorW.dispatchEvent(new Event('input'));
    } else if (state.selectedBox === muteBox) {
        slideMuteW.value = state.selectedBox.w;
        slideMuteW.dispatchEvent(new Event('input'));
    } else {
        slideWidth.value = state.selectedBox.w;
        slideWidth.dispatchEvent(new Event('input'));
    }
});

bindTurboButton('btnWPlus', (s) => {
    state.selectedBox.w = Math.min(100, state.selectedBox.w + s);
    if (state.selectedBox === anchorBox) {
        slideAnchorW.value = state.selectedBox.w;
        slideAnchorW.dispatchEvent(new Event('input'));
    } else if (state.selectedBox === muteBox) {
        slideMuteW.value = state.selectedBox.w;
        slideMuteW.dispatchEvent(new Event('input'));
    } else {
        slideWidth.value = state.selectedBox.w;
        slideWidth.dispatchEvent(new Event('input'));
    }
});

bindTurboButton('btnHMinus', (s) => {
    state.selectedBox.h = Math.max(5, state.selectedBox.h - s);
    if (state.selectedBox === anchorBox) {
        slideAnchorH.value = state.selectedBox.h;
        slideAnchorH.dispatchEvent(new Event('input'));
    } else if (state.selectedBox === muteBox) {
        slideMuteH.value = state.selectedBox.h;
        slideMuteH.dispatchEvent(new Event('input'));
    } else {
        slideHeight.value = state.selectedBox.h;
        slideHeight.dispatchEvent(new Event('input'));
    }
});

bindTurboButton('btnHPlus', (s) => {
    state.selectedBox.h = Math.min(50, state.selectedBox.h + s);
    if (state.selectedBox === anchorBox) {
        slideAnchorH.value = state.selectedBox.h;
        slideAnchorH.dispatchEvent(new Event('input'));
    } else if (state.selectedBox === muteBox) {
        slideMuteH.value = state.selectedBox.h;
        slideMuteH.dispatchEvent(new Event('input'));
    } else {
        slideHeight.value = state.selectedBox.h;
        slideHeight.dispatchEvent(new Event('input'));
    }
});

// Canvas Drag & Drop Events
canvas.addEventListener('mousedown', startDrag);
canvas.addEventListener('mousemove', moveDrag);
window.addEventListener('mouseup', endDrag);
canvas.addEventListener('touchstart', startDrag, { passive: false });
canvas.addEventListener('touchmove', moveDrag, { passive: false });
window.addEventListener('touchend', endDrag);

// Kamera Start/Stop Button
startBtn.addEventListener('click', () => {
    if (!state.isRunning) startSystem();
    else stopSystem();
});

// Wetter-Update alle 5 Minuten
setInterval(fetchWeather, 5 * 60 * 1000);
