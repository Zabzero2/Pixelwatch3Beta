// Konstanten, Standardwerte und zentraler App-Zustand

export const TARGET_FPS = 15;
export const FRAME_INTERVAL = 1000 / TARGET_FPS;
export const HIT_PAD = 30;
export const HISTORY_MS = 5000;
export const PIXEL_STEP = 1;

export const DEFAULTS = {
    sens: 30, mass: 60, width: 35, height: 20, pulse: 3, hold: 6.0, count: 2, takt: 2000, toleranz: 10,
    anchorSens: 15, anchorW: 10, anchorH: 10, anchorDrift: true, anchorDriftSpeed: 1,
    muteSens: 30, muteHold: 60, muteW: 9, muteH: 11, muteDrift: true, muteDriftSpeed: 1,
    expert: false, audioThreshold: 25, tgVideoMode: 'box'
};

export const boxes = [
    { id: 1, x: 60, y: 60, w: 35, h: 20, baseline: null, history: [], isAlarm: false, lastAlarmTime: 0, zoomCtx: null, zoomBoxDiv: null, zoomStatsDiv: null, lastState: 0, lastRisingEdge: 0, lastMeasuredCycle: 0, validCrossings: 0, lastValidTime: 0 },
    { id: 2, x: 60, y: 160, w: 35, h: 20, baseline: null, history: [], isAlarm: false, lastAlarmTime: 0, zoomCtx: null, zoomBoxDiv: null, zoomStatsDiv: null, lastState: 0, lastRisingEdge: 0, lastMeasuredCycle: 0, validCrossings: 0, lastValidTime: 0 },
    { id: 3, x: 60, y: 260, w: 35, h: 20, baseline: null, history: [], isAlarm: false, lastAlarmTime: 0, zoomCtx: null, zoomBoxDiv: null, zoomStatsDiv: null, lastState: 0, lastRisingEdge: 0, lastMeasuredCycle: 0, validCrossings: 0, lastValidTime: 0 },
    { id: 4, x: 60, y: 360, w: 35, h: 20, baseline: null, history: [], isAlarm: false, lastAlarmTime: 0, zoomCtx: null, zoomBoxDiv: null, zoomStatsDiv: null, lastState: 0, lastRisingEdge: 0, lastMeasuredCycle: 0, validCrossings: 0, lastValidTime: 0 }
];

export const anchorBox = {
    id: 'Anker', x: 200, y: 100, w: 10, h: 10, active: false, baseline: null,
    alarmStart: 0, isAlarm: false, lastTgAlarm: 0,
    zoomCtx: null, refCtx: null, zoomBoxDiv: null, zoomStatsDiv: null, refNeedsDraw: false
};

export const muteBox = {
    id: 'Mute', x: 200, y: 200, w: 9, h: 11, active: false, baseline: null,
    state: 'IDLE', timerStart: 0, continuousStart: 0, wasEmpty: true, lastWarningTime: 0, emptyStartTime: 0,
    triggerStart: 0,
    zoomCtx: null, zoomBoxDiv: null, zoomStatsDiv: null
};

export const state = {
    isRunning: false,
    isMonitoring: true,
    showZoomValues: true,
    showCamera: true,

    settingsVisible: false,
    panelDisplayOpen: false,
    panelMainOpen: false,
    panelAnchorOpen: false,
    panelMuteOpen: false,
    panelSmartOpen: false,

    isStealthActive: false,
    currentTrack: null,

    draggingBox: null,
    dragOffsetX: 0,
    dragOffsetY: 0,
    audioCtx: null,
    wakeLock: null,

    // Sound Debouncers
    lastBeep: 0,
    lastAnchorBeep: 0,
    lastLoudBeep: 0,

    // Smart Features Variablen
    analyser: null,
    dataArray: null,
    micStream: null,
    lastAcousticAlarm: 0,
    isRecordingVideo: false,
    isRecordingAudio: false,
    isRecordingBoxId: null,
    tgUpdateOffset: 0,

    // Frame Loop Variablen
    lastFrameTime: 0,
    frameCounter: 0,

    activeBoxCount: 2,
    selectedBox: boxes[0]
};
