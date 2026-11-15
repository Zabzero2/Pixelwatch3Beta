// Speichern, Laden & Zurücksetzen der Einstellungen (LocalStorage)

import {
    chkExpert, chkShowZoom, chkShowCam, chkShowDpad,
    canvas, dpadPanel, mainSettingsWrapper, toggleSettingsBtn,
    panelDisplaySettings, panelMainSettings, panelAnchorSettings,
    panelMuteSettings, panelSmartSettings,
    btnToggleDisplayConfig, btnToggleMainConfig, btnToggleAnchorConfig,
    btnToggleMuteConfig, btnToggleSmartConfig,
    cameraSelect, slideCamZoom,
    slideSens, slideMass, slideTakt, slideToleranz,
    slideWidth, slideHeight, slidePulse, slideHold, boxCountSelect,
    slideAnchorSens, slideAnchorW, slideAnchorH, chkAnchorDrift, slideAnchorDrift, chkAnchorActive,
    slideMuteSens, slideMuteHold, slideMuteW, slideMuteH, chkMuteDrift, slideMuteDrift, chkMuteActive,
    chkTelegram, telegramSettingsBox, chkAudioGuard, selLocalSound,
    txtTelegramToken, txtTelegramChatId, selTgVideoMode,
    slideAudioThreshold, txtWeatherCities
} from './dom.js';
import { state, boxes, anchorBox, muteBox, DEFAULTS } from './state.js';
import {
    createZoomDisplays, updateMaxDeltaLimitRange, updateLabels,
    updateUIVisibility, updateSmartUI, updateMonitorButtonUI
} from './ui.js';

export function saveSettings() {
    // Welcher Ton-Status soll wirklich für den nächsten Start gespeichert werden?
    let realLocalSound = (chkAudioGuard.checked && selLocalSound.dataset.prevState)
        ? selLocalSound.dataset.prevState
        : selLocalSound.value;

    const settings = {
        expert: chkExpert.checked,
        sens: slideSens.value, mass: slideMass.value, width: slideWidth.value, height: slideHeight.value,
        takt: slideTakt.value, toleranz: slideToleranz.value,
        pulse: slidePulse.value, hold: slideHold.value, count: state.activeBoxCount,
        anchorSens: slideAnchorSens.value, anchorW: slideAnchorW.value, anchorH: slideAnchorH.value,
        anchorDrift: chkAnchorDrift.checked, anchorDriftSpeed: slideAnchorDrift.value,
        muteSens: slideMuteSens.value, muteHold: slideMuteHold.value, muteW: slideMuteW.value, muteH: slideMuteH.value,
        muteDrift: chkMuteDrift.checked, muteDriftSpeed: slideMuteDrift.value,
        showZoomValues: state.showZoomValues, showCamera: state.showCamera, dpadVisible: chkShowDpad.checked,
        settingsVisible: state.settingsVisible,
        panelDisplayOpen: state.panelDisplayOpen, panelMainOpen: state.panelMainOpen,
        panelAnchorOpen: state.panelAnchorOpen, panelMuteOpen: state.panelMuteOpen, panelSmartOpen: state.panelSmartOpen,
        cameraId: cameraSelect.value, positions: boxes.map(b => ({ x: b.x, y: b.y })),
        anchor: { x: anchorBox.x, y: anchorBox.y, active: anchorBox.active },
        mute: { x: muteBox.x, y: muteBox.y, active: muteBox.active },
        telegram: chkTelegram.checked, audioGuard: chkAudioGuard.checked,
        localSound: realLocalSound,
        tgToken: txtTelegramToken.value.trim(), tgChat: txtTelegramChatId.value.trim(),
        tgVideoMode: selTgVideoMode.value, audioThreshold: slideAudioThreshold.value, weather: txtWeatherCities.value.trim()
    };
    localStorage.setItem('pixel_settings_v2', JSON.stringify(settings));
}

export function loadSettings() {
    try {
        const saved = localStorage.getItem('pixel_settings_v2') || localStorage.getItem('pixel_settings_pro');
        if (saved) {
            const s = JSON.parse(saved);
            if (s.expert !== undefined) chkExpert.checked = s.expert;
            if (s.sens) slideSens.value = s.sens;
            if (s.mass) slideMass.value = s.mass;
            if (s.width) slideWidth.value = s.width;
            if (s.height) slideHeight.value = s.height;
            if (s.pulse) slidePulse.value = s.pulse;
            if (s.hold) slideHold.value = s.hold;
            if (s.takt) slideTakt.value = s.takt;
            if (s.toleranz) slideToleranz.value = s.toleranz;

            if (s.anchorSens) slideAnchorSens.value = s.anchorSens;
            if (s.anchorW) slideAnchorW.value = s.anchorW;
            if (s.anchorH) slideAnchorH.value = s.anchorH;
            if (s.anchorDrift !== undefined) chkAnchorDrift.checked = s.anchorDrift;
            if (s.anchorDriftSpeed) slideAnchorDrift.value = s.anchorDriftSpeed;

            if (s.muteSens) slideMuteSens.value = s.muteSens;
            if (s.muteHold) slideMuteHold.value = s.muteHold;
            if (s.muteW) slideMuteW.value = s.muteW;
            if (s.muteH) slideMuteH.value = s.muteH;
            if (s.muteDrift !== undefined) chkMuteDrift.checked = s.muteDrift;
            if (s.muteDriftSpeed) slideMuteDrift.value = s.muteDriftSpeed;

            if (s.count) {
                state.activeBoxCount = parseInt(s.count);
                boxCountSelect.value = state.activeBoxCount;
            }

            if (s.showZoomValues !== undefined) {
                state.showZoomValues = s.showZoomValues;
                chkShowZoom.checked = s.showZoomValues;
            }
            if (s.showCamera !== undefined) {
                state.showCamera = s.showCamera;
                chkShowCam.checked = s.showCamera;
                canvas.style.display = state.showCamera ? 'block' : 'none';
            }
            if (s.dpadVisible !== undefined) {
                chkShowDpad.checked = s.dpadVisible;
                dpadPanel.style.display = s.dpadVisible ? 'flex' : 'none';
            }

            if (s.settingsVisible !== undefined) {
                state.settingsVisible = s.settingsVisible;
                mainSettingsWrapper.style.display = state.settingsVisible ? 'flex' : 'none';
                toggleSettingsBtn.style.background = state.settingsVisible ? '#666' : '#444';
            }

            if (s.panelDisplayOpen !== undefined) {
                state.panelDisplayOpen = s.panelDisplayOpen;
                if (state.panelDisplayOpen) { panelDisplaySettings.style.display = 'flex'; btnToggleDisplayConfig.classList.add('open'); }
            }
            if (s.panelMainOpen !== undefined) {
                state.panelMainOpen = s.panelMainOpen;
                if (state.panelMainOpen) { panelMainSettings.style.display = 'flex'; btnToggleMainConfig.classList.add('open'); }
            }
            if (s.panelAnchorOpen !== undefined) {
                state.panelAnchorOpen = s.panelAnchorOpen;
                if (state.panelAnchorOpen) { panelAnchorSettings.style.display = 'flex'; btnToggleAnchorConfig.classList.add('open'); }
            }
            if (s.panelMuteOpen !== undefined) {
                state.panelMuteOpen = s.panelMuteOpen;
                if (state.panelMuteOpen) { panelMuteSettings.style.display = 'flex'; btnToggleMuteConfig.classList.add('open'); }
            }
            if (s.panelSmartOpen !== undefined) {
                state.panelSmartOpen = s.panelSmartOpen;
                if (state.panelSmartOpen) { panelSmartSettings.style.display = 'flex'; btnToggleSmartConfig.classList.add('open'); }
            }

            if (s.positions) {
                s.positions.forEach((pos, idx) => {
                    if (boxes[idx]) { boxes[idx].x = pos.x; boxes[idx].y = pos.y; }
                });
            }
            if (s.anchor) {
                anchorBox.x = s.anchor.x; anchorBox.y = s.anchor.y;
                anchorBox.active = s.anchor.active; chkAnchorActive.checked = s.anchor.active;
            }
            if (s.mute) {
                muteBox.x = s.mute.x; muteBox.y = s.mute.y;
                muteBox.active = s.mute.active; chkMuteActive.checked = s.mute.active;
            }

            if (s.telegram !== undefined) {
                chkTelegram.checked = s.telegram;
                telegramSettingsBox.style.display = s.telegram ? 'flex' : 'none';
            }

            if (s.localSound) {
                selLocalSound.value = s.localSound;
                selLocalSound.dataset.prevState = s.localSound;
            }
            if (s.audioGuard !== undefined) chkAudioGuard.checked = s.audioGuard;

            if (s.tgToken) txtTelegramToken.value = s.tgToken;
            if (s.tgChat) txtTelegramChatId.value = s.tgChat;
            if (s.tgVideoMode) selTgVideoMode.value = s.tgVideoMode;
            if (s.audioThreshold) slideAudioThreshold.value = s.audioThreshold;
            if (s.weather) txtWeatherCities.value = s.weather;
        } else {
            chkExpert.checked = DEFAULTS.expert;
            chkAnchorActive.checked = false;
            chkMuteActive.checked = false;
        }
    } catch (e) {}

    boxCountSelect.value = state.activeBoxCount;
    createZoomDisplays();
    updateMaxDeltaLimitRange();
    updateLabels();
    updateUIVisibility();
    updateSmartUI();
    updateMonitorButtonUI();
    boxes.forEach(b => {
        b.w = parseInt(slideWidth.value);
        b.h = parseInt(slideHeight.value);
        b.baseline = null;
    });
    anchorBox.w = parseInt(slideAnchorW.value);
    anchorBox.h = parseInt(slideAnchorH.value);
    muteBox.w = parseInt(slideMuteW.value);
    muteBox.h = parseInt(slideMuteH.value);
}

export function resetMainModule() {
    slideSens.value = DEFAULTS.sens;
    slideWidth.value = DEFAULTS.width;
    slideHeight.value = DEFAULTS.height;
    updateMaxDeltaLimitRange();
    slideMass.value = DEFAULTS.mass;
    slidePulse.value = DEFAULTS.pulse;
    slideHold.value = DEFAULTS.hold;
    slideTakt.value = DEFAULTS.takt;
    slideToleranz.value = DEFAULTS.toleranz;
    boxCountSelect.value = DEFAULTS.count;
    state.activeBoxCount = DEFAULTS.count;
    boxes.forEach((b, idx) => {
        b.w = DEFAULTS.width;
        b.h = DEFAULTS.height;
        b.x = 60;
        b.y = 60 + (idx * 100);
        b.history = [];
        b.baseline = null;
        b.validCrossings = 0;
        b.lastState = 0;
        b.lastMeasuredCycle = 0;
    });
    if (state.selectedBox !== anchorBox && state.selectedBox !== muteBox) state.selectedBox = boxes[0];
    createZoomDisplays();
    updateLabels();
    saveSettings();
}

export function resetAnchorModule() {
    slideAnchorSens.value = DEFAULTS.anchorSens;
    slideAnchorW.value = DEFAULTS.anchorW;
    slideAnchorH.value = DEFAULTS.anchorH;
    chkAnchorDrift.checked = DEFAULTS.anchorDrift;
    slideAnchorDrift.value = DEFAULTS.anchorDriftSpeed;
    anchorBox.w = DEFAULTS.anchorW;
    anchorBox.h = DEFAULTS.anchorH;
    anchorBox.baseline = null;
    anchorBox.x = 200;
    anchorBox.y = 100;
    chkAnchorActive.checked = false;
    anchorBox.active = false;
    updateLabels();
    updateUIVisibility();
    saveSettings();
    createZoomDisplays();
}

export function resetMuteModule() {
    slideMuteSens.value = DEFAULTS.muteSens;
    slideMuteHold.value = DEFAULTS.muteHold;
    slideMuteW.value = DEFAULTS.muteW;
    slideMuteH.value = DEFAULTS.muteH;
    chkMuteDrift.checked = DEFAULTS.muteDrift;
    slideMuteDrift.value = DEFAULTS.muteDriftSpeed;
    muteBox.w = DEFAULTS.muteW;
    muteBox.h = DEFAULTS.muteH;
    muteBox.baseline = null;
    muteBox.x = 200;
    muteBox.y = 200;
    muteBox.state = 'IDLE';
    muteBox.emptyStartTime = 0;
    muteBox.triggerStart = 0;
    chkMuteActive.checked = false;
    muteBox.active = false;
    updateLabels();
    updateUIVisibility();
    saveSettings();
    createZoomDisplays();
}

export function resetAllModules() {
    if (confirm("⚠ Achtung!\nSollen alle Positionen, Zähler und Modul-Einstellungen auf die Werkseinstellungen zurückgesetzt werden?")) {
        chkExpert.checked = DEFAULTS.expert;
        resetMainModule();
        resetAnchorModule();
        resetMuteModule();
        chkShowZoom.checked = true;
        chkShowZoom.dispatchEvent(new Event('change'));
        chkShowCam.checked = true;
        chkShowCam.dispatchEvent(new Event('change'));
        chkShowDpad.checked = true;
        chkShowDpad.dispatchEvent(new Event('change'));
        slideCamZoom.value = 1;
        slideCamZoom.dispatchEvent(new Event('input'));
        updateUIVisibility();
    }
}
