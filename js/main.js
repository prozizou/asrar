// ============================================================
//  ASRAR PRO — main.js
//  Logique partagée : Abjad, Istihraj, Heures planétaires, onglets.
// ============================================================

// ── Abajad Letter Values ───────────────────────────────────
// Système Oriental (Machreq) — utilisé en Orient
const ABJAD_MASHRIQI = {
  'أ':1,'ا':1,'إ':1,'آ':1,'ب':2,'ج':3,'د':4,'ه':5,'ة':5,'و':6,
  'ز':7,'ح':8,'ط':9,'ي':10,'ى':10,'ك':20,'ل':30,'م':40,'ن':50,
  'س':60,'ع':70,'ف':80,'ص':90,'ق':100,'ر':200,'ش':300,'ت':400,
  'ث':500,'خ':600,'ذ':700,'ض':800,'ظ':900,'غ':1000
};

// Système Occidental (Maghreb) — utilisé en Afrique du Nord & Ouest
const ABJAD_MAGHREBI = {
  'أ':1,'ا':1,'إ':1,'آ':1,'ب':2,'ج':3,'د':4,'ه':5,'ة':5,'و':6,
  'ز':7,'ح':8,'ط':9,'ي':10,'ى':10,'ك':20,'ل':30,'م':40,'ن':50,
  'ص':60,'ع':70,'ف':80,'ض':90,'ق':100,'ر':200,'س':300,'ت':400,
  'ث':500,'خ':600,'ذ':700,'ظ':800,'ش':900,'غ':1000
};

function calcAbjadSum(text, table) {
  let sum = 0;
  for (const ch of text) {
    if (table[ch]) sum += table[ch];
  }
  return sum;
}

// ── Décomposition du « poids mystique » ───────────────────
// Pour un total N, renvoie les paires de facteurs a×b = N (a ≥ b),
// en excluant la paire triviale N×1.  Ex : 66 → ["33×2","22×3","11×6"].
function mysticWeight(n) {
  const pairs = [];
  if (!Number.isFinite(n) || n < 2) return pairs;
  for (let b = 2; b * b <= n; b++) {
    if (n % b === 0) pairs.push(`${n / b}×${b}`);
  }
  return pairs;
}

function calculateAbajad() {
  const input = document.getElementById('abajadInput').value.trim();
  const mEl  = document.getElementById('mysticResult');
  const oEl  = document.getElementById('orientalResult');
  const bdEl = document.getElementById('breakdown');
  if (!input) {
    if (mEl) mEl.innerText = '0';
    if (oEl) oEl.innerText = '0';
    if (bdEl) bdEl.innerHTML = '';
    return;
  }

  const mashriqi = calcAbjadSum(input, ABJAD_MASHRIQI);
  const maghrebi = calcAbjadSum(input, ABJAD_MAGHREBI);

  if (mEl) mEl.innerText = mashriqi || '—';
  if (oEl) oEl.innerText = maghrebi || '—';

  // Décomposition lettre par lettre (Machreqi)
  let letters = '';
  for (const ch of input) {
    if (ABJAD_MASHRIQI[ch]) letters += `${ch}=${ABJAD_MASHRIQI[ch]}  `;
  }

  // Décomposition du poids mystique du total Machreqi
  const weights = mysticWeight(mashriqi);
  const weightHtml = weights.length
    ? `<div class="mw-line"><strong>Poids mystique de ${mashriqi} :</strong> ${weights.join(' &nbsp;•&nbsp; ')}</div>`
    : (mashriqi > 1 ? `<div class="mw-line"><strong>Poids mystique de ${mashriqi} :</strong> nombre premier (indivisible)</div>` : '');

  if (bdEl) bdEl.innerHTML = (letters ? `<div class="mw-letters">${letters.trim()}</div>` : '') + weightHtml;
}

// ── Istihraj (Extraction Astrologique) ────────────────────
// Zodiaque : chargé depuis Firebase appData/zodiacs/{i}.{icon,name}
// avec repli sur la table locale si la lecture échoue.
const ZODIAC_FALLBACK = [
  { name:'Bélier',     icon:'♈' },{ name:'Taureau',    icon:'♉' },
  { name:'Gémeaux',    icon:'♊' },{ name:'Cancer',     icon:'♋' },
  { name:'Lion',       icon:'♌' },{ name:'Vierge',     icon:'♍' },
  { name:'Balance',    icon:'♎' },{ name:'Scorpion',   icon:'♏' },
  { name:'Sagittaire', icon:'♐' },{ name:'Capricorne', icon:'♑' },
  { name:'Verseau',    icon:'♒' },{ name:'Poissons',   icon:'♓' }
];
const ZODIAC_ELEMENTS = ['Feu','Terre','Air','Eau','Feu','Terre','Air','Eau','Feu','Terre','Air','Eau'];
const ZODIAC_PLANETS  = ['Mars','Vénus','Mercure','Lune','Soleil','Mercure','Vénus','Mars','Jupiter','Saturne','Saturne','Jupiter'];

let _zodiacs = null; // cache après lecture Firebase

// Charge appData/zodiacs une seule fois (non bloquant). Repli local sinon.
function loadZodiacs() {
  if (_zodiacs) return Promise.resolve(_zodiacs);
  if (typeof db === 'undefined') { _zodiacs = ZODIAC_FALLBACK; return Promise.resolve(_zodiacs); }
  return db.ref('appData/zodiacs').once('value')
    .then(snap => {
      const val = snap.val();
      if (Array.isArray(val) && val.length >= 12) {
        _zodiacs = val.map((z, i) => ({
          name: (z && z.name) || ZODIAC_FALLBACK[i].name,
          icon: (z && z.icon) || ZODIAC_FALLBACK[i].icon
        }));
      } else {
        _zodiacs = ZODIAC_FALLBACK;
      }
      return _zodiacs;
    })
    .catch(() => { _zodiacs = ZODIAC_FALLBACK; return _zodiacs; });
}

// Miroir d'un entier (Batiniya) : 15 → 51, 150 → 51.
function mirrorNumber(n) {
  return parseInt(String(Math.abs(n)).split('').reverse().join(''), 10) || 0;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value;
}

async function calculateIstihraj() {
  const raw = document.getElementById('chiffreInput').value.trim();
  if (!raw) return;

  // Nombre direct, sinon valeur Abjad (Machreqi).
  let num = parseInt(raw, 10);
  if (isNaN(num)) num = calcAbjadSum(raw, ABJAD_MASHRIQI);
  if (!num) return;

  // Réduction au zodiaque (1-12)
  let reduced = num % 12;
  if (reduced === 0) reduced = 12;
  const idx = reduced - 1;

  const zodiacs = await loadZodiacs();
  const z = zodiacs[idx] || ZODIAC_FALLBACK[idx];

  // Formules ésotériques
  const zahiria  = num;                 // la valeur elle-même
  const batiniya = mirrorNumber(num);   // le miroir
  const rouwhane = num * num;           // valeur × elle-même
  const lumiere  = (num * (num + 1)) / 2; // n(n+1)/2

  setText('signeResult',   `${z.name} ${z.icon}`);
  setText('zodiacIcon',    z.icon);
  setText('numResult',     num);
  setText('natureResult',  ZODIAC_ELEMENTS[idx]);
  setText('planeteResult', ZODIAC_PLANETS[idx]);
  setText('zahiriaResult', zahiria);
  setText('batiniyaResult', batiniya);
  setText('rouwhaneResult', rouwhane);
  setText('lumiereResult',  lumiere);

  const box = document.getElementById('resultBox');
  if (box) box.style.display = '';
}

// ── Heures planétaires (Temporalité Mystique) ─────────────
// Suite chaldéenne : du plus lent au plus rapide.
const CHALDEAN = ['Saturne','Jupiter','Mars','Soleil','Vénus','Mercure','Lune'];
const PLANET_EMOJI = {
  Soleil:'☀️', Lune:'🌙', Mars:'♂️', Mercure:'☿', Jupiter:'♃', Vénus:'♀', Saturne:'♄'
};
// Maître du jour (0 = Dimanche … 6 = Samedi)
const DAY_RULER = ['Soleil','Lune','Mars','Mercure','Jupiter','Vénus','Saturne'];

// Lever / coucher du Soleil (algorithme NOAA simplifié) pour une date et un lieu.
function sunEvents(date, lat, lon) {
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const Jdate = date.valueOf() / 86400000 + 2440587.5;
  const n = Math.round(Jdate - 2451545.0 + 0.0008);
  const Jstar = n - lon / 360;
  const M = (357.5291 + 0.98560028 * Jstar) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.0200 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const Jtransit = 2451545.0 + Jstar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lambda * rad);
  const delta = Math.asin(Math.sin(lambda * rad) * Math.sin(23.4397 * rad)) * deg;
  const cosO = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(delta * rad)) /
               (Math.cos(lat * rad) * Math.cos(delta * rad));
  if (cosO > 1)  return { polar: 'night' };
  if (cosO < -1) return { polar: 'day' };
  const omega = Math.acos(cosO) * deg;
  const toDate = J => new Date((J - 2440587.5) * 86400000);
  return { sunrise: toDate(Jtransit - omega / 360), sunset: toDate(Jtransit + omega / 360) };
}

// Détermine l'heure planétaire courante pour un lieu donné.
// Retourne { ruler, emoji, index (1-12), phase ('Jour'|'Nuit'),
//            start, end, sunrise, sunset } ou { polar }.
function planetaryHourNow(lat, lon, now = new Date()) {
  const dayMs = 86400000;
  const today = sunEvents(now, lat, lon);
  if (today.polar) return { polar: today.polar };

  let phase, hourFromSunrise, dayIndex, hStart, hDur;

  if (now >= today.sunrise && now < today.sunset) {
    // Jour : 12 heures égales entre lever et coucher
    hDur = (today.sunset - today.sunrise) / 12;
    const k = Math.floor((now - today.sunrise) / hDur);
    phase = 'Jour'; hourFromSunrise = k; dayIndex = now.getDay();
    hStart = new Date(today.sunrise.getTime() + k * hDur);
  } else if (now >= today.sunset) {
    // Nuit après le coucher : jusqu'au lever de demain
    const tomorrow = sunEvents(new Date(now.getTime() + dayMs), lat, lon);
    hDur = (tomorrow.sunrise - today.sunset) / 12;
    const k = Math.floor((now - today.sunset) / hDur);
    phase = 'Nuit'; hourFromSunrise = 12 + k; dayIndex = now.getDay(); // la journée a démarré au lever d'aujourd'hui
    hStart = new Date(today.sunset.getTime() + k * hDur);
  } else {
    // Avant le lever : nuit appartenant à la veille
    const yest = sunEvents(new Date(now.getTime() - dayMs), lat, lon);
    hDur = (today.sunrise - yest.sunset) / 12;
    const k = Math.floor((now - yest.sunset) / hDur);
    phase = 'Nuit'; hourFromSunrise = 12 + k;
    dayIndex = (now.getDay() + 6) % 7; // veille
    hStart = new Date(yest.sunset.getTime() + k * hDur);
  }

  const rulerStart = CHALDEAN.indexOf(DAY_RULER[dayIndex]);
  const ruler = CHALDEAN[(rulerStart + hourFromSunrise) % 7];

  return {
    ruler,
    emoji: PLANET_EMOJI[ruler] || '🪐',
    index: (hourFromSunrise % 12) + 1,
    phase,
    start: hStart,
    end: new Date(hStart.getTime() + hDur),
    sunrise: today.sunrise,
    sunset: today.sunset
  };
}

// Initialise la page Planète : horloge + heure planétaire live (géolocalisation
// avec repli sur Dakar). Met à jour chaque seconde.
function initPlanete(opts = {}) {
  const FALLBACK = { lat: 14.6928, lon: -17.4467, label: 'Dakar (par défaut)' };
  let coords = { lat: FALLBACK.lat, lon: FALLBACK.lon, label: FALLBACK.label };

  const timeDisplay     = document.getElementById('timeDisplay');
  const dayNightDisplay = document.getElementById('dayNightDisplay');
  const planetDisplay   = document.getElementById('planetDisplay');
  const phaseIcon       = document.getElementById('phaseIcon');
  const phaseBadge      = document.getElementById('phaseBadge');
  const sunInfo         = document.getElementById('sunInfo');
  const locInfo         = document.getElementById('locInfo');

  const hhmm = d => d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });

  function render() {
    const now = new Date();
    if (timeDisplay) timeDisplay.innerText = now.toLocaleTimeString('fr-FR');

    const ph = planetaryHourNow(coords.lat, coords.lon, now);

    if (ph.polar) {
      if (dayNightDisplay) dayNightDisplay.innerText = ph.polar === 'day' ? '☀️ Jour polaire' : '🌙 Nuit polaire';
      if (planetDisplay)   planetDisplay.innerText = '—';
      return;
    }

    const isDay = ph.phase === 'Jour';
    if (dayNightDisplay) {
      dayNightDisplay.innerText = isDay ? '☀️ Jour Mystique' : '🌙 Nuit Mystique';
      dayNightDisplay.style.color = isDay ? '#FFD700' : '#4facfe';
    }
    if (phaseIcon)  phaseIcon.innerText = isDay ? '☀️' : '🌙';
    if (phaseBadge) {
      phaseBadge.innerText = `${isDay ? 'Phase Diurne' : 'Phase Nocturne'} · ${ph.index}ᵉ heure`;
      phaseBadge.style.background = isDay ? 'rgba(255,215,0,.2)' : 'rgba(79,172,254,.2)';
      phaseBadge.style.color = isDay ? '#FFD700' : 'var(--accent)';
    }
    if (planetDisplay) {
      planetDisplay.innerHTML =
        `${ph.emoji} ${ph.ruler}` +
        `<div style="font-size:.78rem;color:var(--text-muted);margin-top:6px;">` +
        `heure ${ph.index}/12 · ${hhmm(ph.start)} → ${hhmm(ph.end)}</div>`;
      planetDisplay.style.color = isDay ? '#FFD700' : '#4facfe';
    }
    if (sunInfo)  sunInfo.innerText = `Lever ${hhmm(ph.sunrise)} · Coucher ${hhmm(ph.sunset)}`;
    if (locInfo)  locInfo.innerText = coords.label;
  }

  render();
  setInterval(render, 1000);

  // Géolocalisation (améliore la précision ; sinon on garde Dakar).
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => { coords = { lat: pos.coords.latitude, lon: pos.coords.longitude, label: 'Ta position' }; render(); },
      ()  => { /* refus / erreur → repli Dakar déjà en place */ },
      { timeout: 8000, maximumAge: 600000 }
    );
  }
}

// ── Onglets (Manuscrits) ──────────────────────────────────
function switchTab(tabId, el) {
  document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const content = document.getElementById('content-' + tabId);
  if (content) content.style.display = 'block';
  if (el) el.classList.add('active');
}
