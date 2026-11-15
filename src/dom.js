// Zentrale DOM-Referenzen

export const video = document.getElementById('video');
export const canvas = document.getElementById('canvas');
export const ctx = canvas.getContext('2d', { willReadFrequently: true });
export const zoomHeader = document.getElementById('zoomHeader');

export const recordCanvas = document.getElementById('recordCanvas');
export const recordCtx = recordCanvas.getContext('2d');

export const startBtn = document.getElementById('startBtn');
export const monitorBtn = document.getElementById('monitorBtn');
export const activateStealthBtn = document.getElementById('activateStealthBtn');
export const stealthOverlay = document.getElementById('stealthOverlay');
export const exitStealthBtn = document.getElementById('exitStealthBtn');
export const toggleAudioGuardBtnStealth = document.getElementById('toggleAudioGuardBtnStealth');
export const toggleSettingsBtn = document.getElementById('toggleSettingsBtn');
export const mainSettingsWrapper = document.getElementById('mainSettingsWrapper');

export const helpBtn = document.getElementById('helpBtn');
export const helpOverlay = document.getElementById('helpOverlay');
export const closeHelpBtn = document.getElementById('closeHelpBtn');

export const chkExpert = document.getElementById('chkExpert');
export const chkShowZoom = document.getElementById('chkShowZoom');
export const chkShowCam = document.getElementById('chkShowCam');
export const chkShowDpad = document.getElementById('chkShowDpad');

export const btnToggleDisplayConfig = document.getElementById('btnToggleDisplayConfig');
export const btnToggleMainConfig = document.getElementById('btnToggleMainConfig');
export const btnToggleAnchorConfig = document.getElementById('btnToggleAnchorConfig');
export const btnToggleMuteConfig = document.getElementById('btnToggleMuteConfig');
export const btnToggleSmartConfig = document.getElementById('btnToggleSmartConfig');

export const chkAnchorActive = document.getElementById('chkAnchorActive');
export const chkAnchorDrift = document.getElementById('chkAnchorDrift');
export const chkMuteActive = document.getElementById('chkMuteActive');
export const chkMuteDrift = document.getElementById('chkMuteDrift');

// Smart Features UI
export const chkTelegram = document.getElementById('chkTelegram');
export const chkAudioGuard = document.getElementById('chkAudioGuard');
export const selLocalSound = document.getElementById('selLocalSound');
export const rowLocalSound = document.getElementById('rowLocalSound');
export const telegramSettingsBox = document.getElementById('telegramSettingsBox');
export const txtTelegramToken = document.getElementById('txtTelegramToken');
export const txtTelegramChatId = document.getElementById('txtTelegramChatId');
export const selTgVideoMode = document.getElementById('selTgVideoMode');
export const txtWeatherCities = document.getElementById('txtWeatherCities');
export const weatherDisplay = document.getElementById('weatherDisplay');
export const slideAudioThreshold = document.getElementById('slideAudioThreshold');
export const valAudioThreshold = document.getElementById('valAudioThreshold');
export const liveAudioLevel = document.getElementById('liveAudioLevel');
export const micAlarmUI = document.getElementById('micAlarmUI');

export const panelDisplaySettings = document.getElementById('panelDisplaySettings');
export const panelMainSettings = document.getElementById('panelMainSettings');
export const panelAnchorSettings = document.getElementById('panelAnchorSettings');
export const panelMuteSettings = document.getElementById('panelMuteSettings');
export const panelSmartSettings = document.getElementById('panelSmartSettings');
export const dpadPanel = document.getElementById('dpadPanel');

export const cameraSelect = document.getElementById('cameraSelect');
export const slideCamZoom = document.getElementById('slideCamZoom');
export const valCamZoom = document.getElementById('valCamZoom');

export const slideSens = document.getElementById('slideSens');
export const slideMass = document.getElementById('slideMass');
export const slideTakt = document.getElementById('slideTakt');
export const slideToleranz = document.getElementById('slideToleranz');
export const slideWidth = document.getElementById('slideWidth');
export const slideHeight = document.getElementById('slideHeight');
export const slidePulse = document.getElementById('slidePulse');
export const slideHold = document.getElementById('slideHold');
export const boxCountSelect = document.getElementById('boxCountSelect');

export const valSens = document.getElementById('valSens');
export const valMass = document.getElementById('valMass');
export const valTakt = document.getElementById('valTakt');
export const valToleranz = document.getElementById('valToleranz');
export const valWidth = document.getElementById('valWidth');
export const valHeight = document.getElementById('valHeight');
export const valPulse = document.getElementById('valPulse');
export const valHold = document.getElementById('valHold');

export const slideAnchorSens = document.getElementById('slideAnchorSens');
export const valAnchorSens = document.getElementById('valAnchorSens');
export const slideAnchorW = document.getElementById('slideAnchorW');
export const valAnchorW = document.getElementById('valAnchorW');
export const slideAnchorH = document.getElementById('slideAnchorH');
export const valAnchorH = document.getElementById('valAnchorH');
export const slideAnchorDrift = document.getElementById('slideAnchorDrift');
export const valAnchorDrift = document.getElementById('valAnchorDrift');
export const rowAnchorDriftSpeed = document.getElementById('rowAnchorDriftSpeed');

export const slideMuteSens = document.getElementById('slideMuteSens');
export const valMuteSens = document.getElementById('valMuteSens');
export const slideMuteHold = document.getElementById('slideMuteHold');
export const valMuteHold = document.getElementById('valMuteHold');
export const slideMuteW = document.getElementById('slideMuteW');
export const valMuteW = document.getElementById('valMuteW');
export const slideMuteH = document.getElementById('slideMuteH');
export const valMuteH = document.getElementById('valMuteH');
export const slideMuteDrift = document.getElementById('slideMuteDrift');
export const valMuteDrift = document.getElementById('valMuteDrift');
export const rowMuteDriftSpeed = document.getElementById('rowMuteDriftSpeed');

export const selectedBoxIdLabel = document.getElementById('selectedBoxId');
export const hoursHTML = document.getElementById('hoursHTML');
export const minsHTML = document.getElementById('minsHTML');
