// Wetter-Station, Mondphasen-Berechnung & Tarnmodus-Uhr

import {
    txtWeatherCities, weatherDisplay, hoursHTML, minsHTML,
    chkTelegram, txtTelegramToken, txtTelegramChatId,
    chkAudioGuard, selLocalSound, stealthOverlay,
    toggleAudioGuardBtnStealth, exitStealthBtn
} from './dom.js';
import { state, muteBox } from './state.js';

export function getMoonEmoji(lat) {
    // Exakter Neumond-Anker: 6. Jan 2000 12:24 UTC = 947161440000 ms
    const epoch = 947161440000;
    // Ein Mondzyklus in Millisekunden: 29.53058868 Tage
    const cycleMs = 29.53058868 * 24 * 60 * 60 * 1000;

    let now = Date.now();
    let phase = ((now - epoch) % cycleMs) / cycleMs;

    // Unterteilung in 8 Phasen (Index 0 bis 7)
    let index = Math.floor((phase * 8) + 0.5) % 8;

    // Symbol-Sets (Je nach Hemisphäre spiegelverkehrt)
    const northern = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
    const southern = ['🌑', '🌘', '🌗', '🌖', '🌕', '🌔', '🌓', '🌒'];

    return (lat >= 0) ? northern[index] : southern[index];
}

export async function fetchWeather() {
    if (!txtWeatherCities.value) {
        weatherDisplay.innerHTML = '';
        return;
    }

    let cities = txtWeatherCities.value.split(';').map(c => c.trim()).filter(c => c);
    let output = [];

    for (let cityEntry of cities) {
        try {
            let displayName = cityEntry;
            let searchQuery = cityEntry;

            // Format: "Zuhause=München" oder "Lauingen=48.57,10.43"
            if (cityEntry.includes('=')) {
                let parts = cityEntry.split('=');
                displayName = parts[0].trim();
                searchQuery = parts[1].trim();
            }

            // Prüfen ob searchQuery GPS Koordinaten sind
            let isGps = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(searchQuery);
            let lat, lon;

            if (isGps) {
                let coords = searchQuery.split(',');
                lat = parseFloat(coords[0].trim());
                lon = parseFloat(coords[1].trim());
            } else {
                let geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchQuery)}&count=1&language=de`);
                let geoData = await geoRes.json();
                if (!geoData.results || geoData.results.length === 0) continue;
                lat = geoData.results[0].latitude;
                lon = geoData.results[0].longitude;
            }

            let wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
            let wData = await wRes.json();
            let code = wData.current_weather.weathercode;
            let temp = Math.round(wData.current_weather.temperature);
            let isDay = wData.current_weather.is_day === 1;

            let emoji = '☁️';
            let desc = '';

            if (code === 0 || code === 1) {
                emoji = isDay ? '☀️' : getMoonEmoji(lat);
                desc = 'Klar';
            }
            else if (code === 2 || code === 3) { emoji = isDay ? '⛅' : '☁️'; desc = 'Bewölkt'; }
            else if (code === 45 || code === 48) { emoji = '🌫️'; desc = 'Nebel'; }
            else if (code >= 51 && code <= 67) { emoji = '🌧️'; desc = 'Regen'; }
            else if (code >= 71 && code <= 77) { emoji = '❄️'; desc = 'Schnee'; }
            else if (code >= 80 && code <= 82) { emoji = '🌧️'; desc = 'Regen'; }
            else if (code >= 95) { emoji = '⛈️'; desc = 'Gewitter'; }

            output.push(`
                <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5vw;">
                    <div style="font-size: 4vw; color: white;">${emoji} ${temp}°C</div>
                    <div style="font-size: 2vw; font-weight: bold; letter-spacing: 1px;">${displayName}</div>
                    <div style="font-size: 1.8vw; color: #888;">${desc}</div>
                </div>
            `);
        } catch (e) {}
    }
    weatherDisplay.innerHTML = output.join("");
}

export function updateStealthClock(forceUpdate = false) {
    if (!state.isStealthActive && !forceUpdate) return;

    const d = new Date();
    hoursHTML.innerText = String(d.getHours()).padStart(2, '0');
    minsHTML.innerText = String(d.getMinutes()).padStart(2, '0');

    const dotOpacity = (state.isStealthActive && muteBox.active && muteBox.state === 'MUTED' && d.getSeconds() % 2 !== 0) ? "0" : "1";
    toggleAudioGuardBtnStealth.style.opacity = dotOpacity;
    exitStealthBtn.style.opacity = dotOpacity;

    const tgActive = chkTelegram.checked && txtTelegramToken.value.trim() !== '' && txtTelegramChatId.value.trim() !== '';

    if (!state.isMonitoring || !state.isRunning) {
        stealthOverlay.style.color = '#ffcccc'; // Rosa: Pausiert
    } else if (chkAudioGuard.checked) {
        stealthOverlay.style.color = '#88ccff'; // Blau: Audio-Wächter (lauscht stumm)
    } else if (selLocalSound.value === 'off' && tgActive) {
        stealthOverlay.style.color = '#ffdd77'; // Gelb: Silent (Kein lokaler Ton, nur Telegram)
    } else {
        stealthOverlay.style.color = 'white'; // Weiß: Normal (Lokaler Ton an)
    }
}
