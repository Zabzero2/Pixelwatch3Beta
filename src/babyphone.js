// WebRTC Echtzeit-Babyphone (Sender auf dem Überwachungsgerät & Empfänger per 1-Klick-Link)

import { Peer } from 'peerjs';
import { state } from './state.js';
import { getRoomAudioStream } from './audio.js';
import { sendTgLiveMessage, deleteTgMessage, sendTgTempNotice } from './telegram.js';

// Kombination aus Google STUN-Servern & freien TURN-Relay-Servern (Port 80/443 UDP & TCP),
// damit die Verbindung auch durch strenge Mobilfunk-Firewalls (Carrier-NAT) klappt.
const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:openrelay.metered.ca:80' },
    {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
    },
    {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
    },
    {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
    }
];

let senderPeer = null;
let liveMicStream = null;
let liveTgMessageId = null;
let activeConnections = [];

function generateRoomId() {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let id = 'pw2-';
    for (let i = 0; i < 12; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}

// ============================================================================
// 1. SENDER-SEITE (Tablet / Überwachungsgerät)
// ============================================================================

export async function startLiveBabyphone() {
    // Falls bereits eine Session läuft, diese zuerst sauber beenden
    await stopLiveBabyphone(false);

    let streamToUse = state.micStream;
    try {
        if (!streamToUse || streamToUse.getAudioTracks().length === 0 || streamToUse.getAudioTracks()[0].readyState === 'ended') {
            liveMicStream = await getRoomAudioStream();
            streamToUse = liveMicStream;
        }
    } catch (err) {
        await sendTgTempNotice('❌ Mikrofon konnte für Live-Babyphone nicht geöffnet werden: ' + err.message, 8000);
        return;
    }

    const roomId = generateRoomId();

    senderPeer = new Peer(roomId, {
        config: { iceServers: ICE_SERVERS }
    });

    senderPeer.on('open', async (id) => {
        const baseUrl = window.location.origin + window.location.pathname;
        const listenUrl = `${baseUrl}?listen=${encodeURIComponent(id)}`;

        const msgId = await sendTgLiveMessage(listenUrl);
        if (msgId) {
            liveTgMessageId = msgId;
        }
    });

    senderPeer.on('connection', (conn) => {
        activeConnections.push(conn);

        conn.on('data', (data) => {
            if (data && data.type === 'REQUEST_STREAM') {
                // Sobald der Empfänger im Browser bereit ist, rufen wir ihn mit dem Mikrofon-Stream an
                const currentStream = state.micStream || liveMicStream;
                if (currentStream && senderPeer && !senderPeer.destroyed) {
                    senderPeer.call(conn.peer, currentStream);
                }
            } else if (data && data.type === 'STOP_LIVE') {
                stopLiveBabyphone(true);
            }
        });

        conn.on('close', () => {
            activeConnections = activeConnections.filter(c => c !== conn);
        });
    });

    // Falls der Empfänger direkt per peer.call() anruft, antworten wir mit unserem Mikrofon-Stream
    senderPeer.on('call', (call) => {
        const currentStream = state.micStream || liveMicStream;
        if (currentStream) {
            call.answer(currentStream);
        }
    });

    senderPeer.on('error', (err) => {
        console.warn('Babyphone Peer Fehler:', err);
    });
}

export async function stopLiveBabyphone(sendConfirmation = true) {
    // Alle verbundenen Empfänger informieren
    activeConnections.forEach(conn => {
        try { conn.send({ type: 'LIVE_ENDED' }); conn.close(); } catch (e) {}
    });
    activeConnections = [];

    if (senderPeer) {
        try { senderPeer.destroy(); } catch (e) {}
        senderPeer = null;
    }

    if (liveMicStream) {
        liveMicStream.getTracks().forEach(t => t.stop());
        liveMicStream = null;
    }

    // Telegram-Nachricht mit dem Link automatisch löschen, damit der Chat sauber bleibt
    if (liveTgMessageId) {
        const msgIdToDelete = liveTgMessageId;
        liveTgMessageId = null;
        await deleteTgMessage(msgIdToDelete);
    }

    if (sendConfirmation) {
        await sendTgTempNotice('🔇 Live-Babyphone beendet (Nachricht bereinigt).', 5000);
    }
}

// ============================================================================
// 2. EMPFÄNGER-SEITE (Handy unterwegs via ?listen=...)
// ============================================================================

export function checkAndInitReceiverMode() {
    const params = new URLSearchParams(window.location.search);
    const listenRoomId = params.get('listen');
    if (!listenRoomId) return false;

    // Normale Kamera-Oberfläche ausblenden und Babyphone-Empfänger anzeigen
    const appShell = document.querySelector('.app-shell');
    if (appShell) appShell.style.display = 'none';

    const receiverDiv = document.createElement('div');
    receiverDiv.className = 'babyphone-receiver';
    receiverDiv.innerHTML = `
        <div class="bp-card">
            <div class="bp-badge" id="bpStatusBadge">🟡 Verbinde...</div>
            <h2 class="bp-title">🔊 Live-Babyphone</h2>
            <p class="bp-subtitle" id="bpStatusText">Stelle Direktverbindung zum Überwachungsgerät her...</p>

            <div class="bp-meter-wrap">
                <div class="bp-meter-label">
                    <span>Raum-Pegel (Echtzeit)</span>
                    <span id="bpLevelVal">0 %</span>
                </div>
                <div class="bp-meter-track">
                    <div class="bp-meter-fill" id="bpMeterFill"></div>
                </div>
            </div>

            <div class="slider-stack" style="margin-top: 6px;">
                <div class="slider-header">
                    <span>Mikrofon-Verstärker (Boost)</span>
                    <span class="slider-val-badge" id="bpGainVal">150 %</span>
                </div>
                <div class="slider-controls">
                    <input type="range" id="bpGainSlider" min="50" max="400" step="10" value="150">
                </div>
            </div>

            <button id="bpUnmuteBtn" class="bp-play-btn" style="display: none;">
                🔊 Hier tippen, um Ton einzuschalten
            </button>

            <button id="bpStopBtn" class="bp-stop-btn">
                🔇 Babyphone beenden &amp; Chat aufräumen
            </button>
        </div>
        <audio id="bpRemoteAudio" autoplay playsinline></audio>
    `;
    document.body.appendChild(receiverDiv);

    initReceiverConnection(listenRoomId);
    return true;
}

function initReceiverConnection(roomId) {
    const statusBadge = document.getElementById('bpStatusBadge');
    const statusText = document.getElementById('bpStatusText');
    const meterFill = document.getElementById('bpMeterFill');
    const levelVal = document.getElementById('bpLevelVal');
    const gainSlider = document.getElementById('bpGainSlider');
    const gainVal = document.getElementById('bpGainVal');
    const unmuteBtn = document.getElementById('bpUnmuteBtn');
    const stopBtn = document.getElementById('bpStopBtn');
    const remoteAudio = document.getElementById('bpRemoteAudio');

    let receiverPeer = new Peer({ config: { iceServers: ICE_SERVERS } });
    let dataConn = null;
    let audioCtx = null;
    let gainNode = null;
    let analyser = null;
    let animFrame = null;

    function setupWebAudioAmplifier(stream) {
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const source = audioCtx.createMediaStreamSource(stream);
            gainNode = audioCtx.createGain();
            gainNode.gain.value = parseInt(gainSlider.value) / 100;

            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            const dataArr = new Uint8Array(analyser.frequencyBinCount);

            source.connect(gainNode);
            gainNode.connect(analyser);
            gainNode.connect(audioCtx.destination);

            // Falls das HTML-Audio-Element parallel läuft, stummschalten, damit WebAudio mit Boost übernimmt
            remoteAudio.muted = true;

            function updateMeter() {
                if (!analyser) return;
                analyser.getByteFrequencyData(dataArr);
                let sum = 0;
                for (let i = 0; i < dataArr.length; i++) sum += dataArr[i];
                let avg = Math.min(100, Math.round((sum / dataArr.length) * 1.8));
                meterFill.style.width = avg + '%';
                meterFill.style.background = avg > 60 ? '#ff4444' : (avg > 25 ? '#00e5ff' : '#00ff88');
                levelVal.innerText = avg + ' %';
                animFrame = requestAnimationFrame(updateMeter);
            }
            updateMeter();

            if (audioCtx.state === 'suspended') {
                unmuteBtn.style.display = 'inline-flex';
            }
        } catch (e) {
            remoteAudio.muted = false;
        }
    }

    gainSlider.addEventListener('input', () => {
        gainVal.innerText = gainSlider.value + ' %';
        if (gainNode) {
            gainNode.gain.value = parseInt(gainSlider.value) / 100;
        }
    });

    unmuteBtn.addEventListener('click', async () => {
        if (audioCtx && audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }
        try {
            await remoteAudio.play();
        } catch (e) {}
        unmuteBtn.style.display = 'none';
    });

    function handleIncomingStream(stream) {
        statusBadge.innerText = '🟢 LIVE – Übertragung aktiv';
        statusBadge.classList.add('live');
        statusText.innerText = 'Du hörst jetzt den Raumton in Echtzeit.';

        remoteAudio.srcObject = stream;
        remoteAudio.play().catch(() => {
            unmuteBtn.style.display = 'inline-flex';
        });

        setupWebAudioAmplifier(stream);
    }

    receiverPeer.on('open', () => {
        dataConn = receiverPeer.connect(roomId, { reliable: true });

        dataConn.on('open', () => {
            statusText.innerText = 'Verbunden! Starte Audio-Stream...';
            dataConn.send({ type: 'REQUEST_STREAM' });
        });

        dataConn.on('data', (data) => {
            if (data && data.type === 'LIVE_ENDED') {
                if (animFrame) cancelAnimationFrame(animFrame);
                statusBadge.innerText = '⚪ Beendet';
                statusBadge.classList.remove('live');
                statusText.innerText = 'Das Live-Babyphone wurde beendet.';
            }
        });
    });

    receiverPeer.on('call', (call) => {
        call.answer(); // Keine eigene Audiospur zurücksenden (reiner Zuhör-Modus)
        call.on('stream', (remoteStream) => {
            handleIncomingStream(remoteStream);
        });
    });

    receiverPeer.on('error', () => {
        statusBadge.innerText = '🔴 Nicht erreichbar';
        statusBadge.classList.remove('live');
        statusText.innerText = 'Dieser Babyphone-Link ist abgelaufen oder wurde bereits beendet.';
    });

    stopBtn.addEventListener('click', () => {
        if (animFrame) cancelAnimationFrame(animFrame);
        if (dataConn && dataConn.open) {
            try { dataConn.send({ type: 'STOP_LIVE' }); } catch (e) {}
        }
        setTimeout(() => {
            if (receiverPeer) receiverPeer.destroy();
            if (audioCtx) audioCtx.close();
            statusBadge.innerText = '⚪ Beendet';
            statusBadge.classList.remove('live');
            statusText.innerText = 'Babyphone beendet und Telegram-Nachricht gelöscht.';
            stopBtn.disabled = true;
            stopBtn.style.opacity = '0.5';
        }, 300);
    });
}
