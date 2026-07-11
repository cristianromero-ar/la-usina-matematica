/* =====================================================================
   GOL DE MEDIDAS — script.js
   Juego educativo: conversión de unidades de longitud + ángulos.
   100% JavaScript puro, sin dependencias externas.
   Los sonidos se sintetizan con Web Audio API (no requieren archivos).
   Los personajes son ilustraciones SVG originales de ficción.
   ===================================================================== */

'use strict';

/* =========================================================
   1. DATOS DEL JUEGO
   ========================================================= */

// Unidades de longitud ordenadas de mayor a menor, factor relativo al metro.
const UNITS = [
  { name: 'km',  factor: 1000 },
  { name: 'hm',  factor: 100 },
  { name: 'dam', factor: 10 },
  { name: 'm',   factor: 1 },
  { name: 'dm',  factor: 0.1 },
  { name: 'cm',  factor: 0.01 },
  { name: 'mm',  factor: 0.001 }
];

// Configuración de dificultad por nivel.
const LEVELS = {
  1: { label: 'Nivel 1', sub: 'Fácil',      minDiff: 1, maxDiff: 2, decimals: 0, angleStep: 15, angleMin: 15, angleMax: 75, tolerance: 10 },
  2: { label: 'Nivel 2', sub: 'Decimales',  minDiff: 1, maxDiff: 3, decimals: 1, angleStep: 5,  angleMin: 10, angleMax: 80, tolerance: 9 },
  3: { label: 'Nivel 3', sub: 'Escalas',    minDiff: 2, maxDiff: 4, decimals: 2, angleStep: 1,  angleMin: 5,  angleMax: 85, tolerance: 7 },
  4: { label: 'Nivel 4', sub: 'Experto',    minDiff: 3, maxDiff: 6, decimals: 2, angleStep: 1,  angleMin: 5,  angleMax: 85, tolerance: 5 }
};

const TOTAL_ATTEMPTS_MATCH = 10; // cantidad de jugadas por partido
const MAX_ANGLE_TRIES = 2;       // intentos permitidos para el ángulo por jugada

// Personajes jugables — ilustraciones originales de ficción (no personas reales).
const CHARACTERS = [
  {
    id: 'tomi',
    name: 'Tomi "Zurdito"',
    desc: 'Delantero habilidoso, gambeta corta y remate preciso.',
    kit: { primary: '#75AADB', stripe: '#FFFFFF', shorts: '#0B1B33', socks: '#75AADB' },
    skin: '#E8B08A', hair: '#2b1810', type: 'boy'
  },
  {
    id: 'fer',
    name: 'Fer "La 10"',
    desc: 'Capitana del equipo, potencia y visión de juego.',
    kit: { primary: '#75AADB', stripe: '#FFFFFF', shorts: '#0B1B33', socks: '#75AADB' },
    skin: '#c98a5e', hair: '#241005', type: 'girl'
  },
  {
    id: 'naza',
    name: 'Naza "Manos de Oro"',
    desc: 'Arquero que también patea penales con puntería letal.',
    kit: { primary: '#f2b632', stripe: '#0B1B33', shorts: '#0B1B33', socks: '#f2b632' },
    skin: '#e6c29a', hair: '#111111', type: 'keeper'
  }
];

/* =========================================================
   2. ESTADO GLOBAL
   ========================================================= */

const state = {
  character: null,
  level: 1,
  goals: 0,
  attempts: 0,
  streak: 0,
  bestStreak: 0,
  score: 0,
  startTime: null,
  timerHandle: null,
  muted: false,
  medalsAwarded: new Set(),
  round: null // desafío actual
};

/* =========================================================
   3. AUDIO — sintetizado con Web Audio API (sin archivos)
   ========================================================= */

let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(freq, duration, type = 'sine', delay = 0, gainPeak = 0.18) {
  if (state.muted) return;
  const ctx = ensureAudio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = ctx.currentTime + delay;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

function playNoiseBurst(duration, delay = 0, gainPeak = 0.15, filterFreq = 1800) {
  if (state.muted) return;
  const ctx = ensureAudio();
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  const t0 = ctx.currentTime + delay;
  gain.gain.setValueAtTime(gainPeak, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(t0);
}

const SFX = {
  click: () => playTone(720, 0.06, 'square', 0, 0.08),
  whistle: () => { playTone(1800, 0.18, 'sine', 0, 0.12); playTone(1800, 0.18, 'sine', 0.22, 0.12); },
  kick: () => playNoiseBurst(0.12, 0, 0.2, 900),
  wrong: () => { playTone(300, 0.18, 'sawtooth', 0, 0.1); playTone(220, 0.22, 'sawtooth', 0.12, 0.1); },
  save: () => { playNoiseBurst(0.15, 0, 0.18, 1200); playTone(180, 0.2, 'triangle', 0.05, 0.1); },
  goal: () => {
    [523, 659, 784, 1046].forEach((f, i) => playTone(f, 0.28, 'triangle', i * 0.09, 0.16));
    playNoiseBurst(1.1, 0.05, 0.12, 2200); // "aplausos" aproximados
  },
  applause: () => playNoiseBurst(1.3, 0, 0.1, 2400)
};

function setMuted(muted) {
  state.muted = muted;
  const icon = muted ? '🔇' : '🔊';
  $('#btnSoundMenu').textContent = icon;
  $('#btnSoundGame').textContent = icon;
  try { localStorage.setItem('gdm_muted', muted ? '1' : '0'); } catch (e) { /* ignore */ }
}

/* =========================================================
   4. UTILIDADES
   ========================================================= */

function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }
function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
function round(v, decimals) {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}
// Formatea número en estilo hispanoamericano (coma decimal), sin ceros de más.
// Usa precisión adaptativa para que los números muy chicos no se muestren como "0".
function formatNumber(n) {
  const abs = Math.abs(n);
  let decimals = 2;
  if (abs === 0) decimals = 0;
  else if (abs < 0.001) decimals = 8;
  else if (abs < 0.01) decimals = 6;
  else if (abs < 1) decimals = 4;
  else if (abs < 100) decimals = 2;
  else decimals = 0;
  let v = round(n, decimals);
  let s = v.toString().replace('.', ',');
  return s;
}

/* =========================================================
   5. GENERACIÓN DE DESAFÍOS
   ========================================================= */

function generateConversionChallenge(level) {
  const cfg = LEVELS[level];
  let fromIdx, toIdx, diff;
  do {
    fromIdx = randInt(0, UNITS.length - 1);
    diff = randInt(cfg.minDiff, cfg.maxDiff);
    toIdx = Math.random() < 0.5 ? fromIdx - diff : fromIdx + diff;
  } while (toIdx < 0 || toIdx >= UNITS.length || toIdx === fromIdx);

  const from = UNITS[fromIdx];
  const to = UNITS[toIdx];

  // Genera el valor de partida (entero o decimal según nivel).
  let base = randInt(1, 9) * Math.pow(10, randInt(0, Math.min(2, cfg.decimals === 0 ? 2 : 1)));
  let value = base;
  if (cfg.decimals > 0) {
    const decPlaces = randInt(1, cfg.decimals);
    value = round(rand(0.5, 95), decPlaces);
  }

  const ratio = from.factor / to.factor;
  let answer = round(value * ratio, 6);

  // Distractores: errores frecuentes de conversión.
  const invert = round(value * (to.factor / from.factor), 6);
  const shiftUp = round(answer * 10, 6);
  const shiftDown = round(answer / 10, 6);

  let distractors = [invert, shiftUp, shiftDown];
  // Asegura valores distintos entre sí y de la respuesta correcta (comparando por su
  // representación visible, para que nunca se repita ni se muestre como "0").
  const seenText = new Set([formatNumber(answer)]);
  distractors = distractors.filter(d => {
    const text = formatNumber(d);
    if (d <= 0 || !isFinite(d) || text === '0' || seenText.has(text)) return false;
    seenText.add(text);
    return true;
  });
  // Completa si faltan distractores por colisión, probando variaciones distintas.
  const fallbackFactors = [3, 0.25, 5, 0.2, 7, 100, 0.01];
  let fi = 0;
  while (distractors.length < 3 && fi < fallbackFactors.length) {
    const candidate = round(answer * fallbackFactors[fi], 6);
    const text = formatNumber(candidate);
    fi++;
    if (candidate > 0 && isFinite(candidate) && text !== '0' && !seenText.has(text)) {
      distractors.push(candidate);
      seenText.add(text);
    }
  }

  const options = [...distractors.slice(0, 3), answer];
  // Mezclar
  for (let i = options.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [options[i], options[j]] = [options[j], options[i]];
  }
  const correctIndex = options.indexOf(answer);

  return {
    question: `¿Cuántos ${to.name} son ${formatNumber(value)} ${from.name}?`,
    from, to, value, answer, options, correctIndex,
    hints: [
      `Pensá cuál unidad es más grande: ${from.name} o ${to.name}.`,
      `1 ${ratio >= 1 ? from.name : to.name} = ${formatNumber(ratio >= 1 ? ratio : 1 / ratio)} ${ratio >= 1 ? to.name : from.name}.`,
      `${formatNumber(value)} ${ratio >= 1 ? '×' : '÷'} ${formatNumber(ratio >= 1 ? ratio : 1 / ratio)} = ...`
    ]
  };
}

function generateAngleChallenge(level) {
  const cfg = LEVELS[level];
  const steps = Math.round((cfg.angleMax - cfg.angleMin) / cfg.angleStep);
  const target = cfg.angleMin + randInt(0, steps) * cfg.angleStep;

  return { target, tolerance: cfg.tolerance, hints: buildAngleHints(target) };
}

// Genera 3 pistas de razonamiento (no reveladoras) para cualquier ángulo entre 0° y 90°.
// Pista 1: qué tipo de ángulo es. Pista 2: comparación con la mitad de un ángulo recto.
// Pista 3: una relación más precisa (fracción de un ángulo recto o cercanía a 90°),
// pero siempre expresada como relación a razonar, nunca como una cuenta para resolver.
function buildAngleHints(target) {
  // Pista 1 — clasificación
  let h1;
  if (target >= 90) h1 = 'No es un ángulo agudo: es un ángulo recto.';
  else if (target >= 65) h1 = 'Es un ángulo agudo, y está bastante cerca de ser un ángulo recto.';
  else h1 = 'Es un ángulo agudo.';

  // Pista 2 — comparación con la mitad de un ángulo recto (45°)
  let h2;
  if (target === 45) {
    h2 = 'Es exactamente la mitad de un ángulo recto.';
  } else if (target < 45) {
    h2 = (45 - target) <= 8
      ? 'Está apenas por debajo de la mitad de un ángulo recto (45°).'
      : 'Es menor que la mitad de un ángulo recto (45°).';
  } else {
    h2 = (target - 45) <= 8
      ? 'Está apenas por encima de la mitad de un ángulo recto (45°).'
      : 'Es mayor que la mitad de un ángulo recto (45°).';
  }

  // Pista 3 — relación más fina, sin operaciones explícitas
  let h3;
  if (target >= 70) {
    const falta = 90 - target;
    h3 = `Le faltan ${falta}° para convertirse en un ángulo recto.`;
  } else {
    h3 = niceFractionHint(target);
    if (!h3) {
      const nearest10 = Math.round(target / 10) * 10;
      const diff = target - nearest10;
      h3 = diff === 0
        ? `Está justo en ${nearest10}°.`
        : diff > 0
          ? `Está un poquito por encima de ${nearest10}°.`
          : `Está un poquito por debajo de ${nearest10}°.`;
    }
  }

  return [h1, h2, h3];
}

// Busca si el ángulo se acerca a una fracción "linda" de un ángulo recto (1/2, 1/3, 2/3, 1/9, 4/9, etc.)
// y lo expresa como relación a razonar, sin decir nunca el valor exacto en grados.
function niceFractionHint(target) {
  const candidates = [];
  const seen = new Map(); // val redondeado -> {den,k} con el denominador más chico
  for (let den = 2; den <= 12; den++) {
    for (let k = 1; k < den; k++) {
      const val = (90 * k) / den;
      if (val <= 0 || val >= 90) continue;
      const key = Math.round(val * 10); // agrupa valores equivalentes (ej. 1/2 y 2/4)
      if (!seen.has(key) || seen.get(key).den > den) seen.set(key, { den, k, val });
    }
  }
  seen.forEach(c => candidates.push(c));

  let best = null;
  for (const c of candidates) {
    const diff = Math.abs(c.val - target);
    if (diff <= 4 && (best === null || diff < best.diff)) best = { ...c, diff };
  }
  if (!best) return null;

  if (best.den === 2) return 'Si doblaras un ángulo recto por la mitad, obtendrías un ángulo como este.';
  if (best.k === 1) return `Si dividieras un ángulo recto en ${best.den} partes iguales, este ángulo sería aproximadamente una de ellas.`;
  return `Si dividieras un ángulo recto en ${best.den} partes iguales, este ángulo sería aproximadamente ${best.k} de esas partes.`;
}

/* =========================================================
   6. ILUSTRACIONES SVG (personajes originales de ficción)
   ========================================================= */

function footballerSVG(kit, skin, hair, type) {
  const stripes = Array.from({ length: 4 }, (_, i) =>
    `<rect x="${34 + i * 9}" y="46" width="4" height="46" fill="${kit.stripe}" opacity="0.85"/>`
  ).join('');
  const hairPath = type === 'girl'
    ? `<path d="M40 30 Q30 20 40 14 Q60 6 78 16 Q88 22 82 34 Q90 40 84 52 L78 50 Q80 36 68 30 Q76 44 70 52 L62 50 Q66 34 54 30 Q50 44 46 52 L38 50 Q40 38 40 30Z" fill="${hair}"/>`
    : `<path d="M38 28 Q40 14 60 12 Q82 12 84 30 Q86 24 80 18 Q66 6 48 12 Q34 18 38 28Z" fill="${hair}"/>`;
  const glove = type === 'keeper'
    ? `<circle cx="26" cy="96" r="9" fill="#ffd54f" stroke="#8a6d00" stroke-width="2"/><circle cx="94" cy="96" r="9" fill="#ffd54f" stroke="#8a6d00" stroke-width="2"/>`
    : '';
  return `
  <svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="60" cy="142" rx="30" ry="6" fill="rgba(0,0,0,.25)"/>
    <!-- piernas -->
    <rect x="42" y="96" width="14" height="38" rx="6" fill="${skin}"/>
    <rect x="64" y="96" width="14" height="38" rx="6" fill="${skin}"/>
    <rect x="40" y="122" width="18" height="16" rx="4" fill="${kit.socks}"/>
    <rect x="62" y="122" width="18" height="16" rx="4" fill="${kit.socks}"/>
    <rect x="38" y="132" width="22" height="8" rx="3" fill="#fff"/>
    <rect x="60" y="132" width="22" height="8" rx="3" fill="#fff"/>
    <!-- short -->
    <rect x="38" y="82" width="44" height="24" rx="8" fill="${kit.shorts}"/>
    <!-- torso -->
    <rect x="32" y="42" width="56" height="46" rx="14" fill="${kit.primary}"/>
    <g clip-path="url(#clip)">${stripes}</g>
    <!-- brazos -->
    <rect x="14" y="46" width="16" height="38" rx="8" fill="${kit.primary}" transform="rotate(-14 22 46)"/>
    <rect x="90" y="46" width="16" height="38" rx="8" fill="${kit.primary}" transform="rotate(14 98 46)"/>
    <circle cx="18" cy="82" r="7" fill="${skin}"/>
    <circle cx="102" cy="82" r="7" fill="${skin}"/>
    ${glove}
    <!-- cabeza -->
    <circle cx="60" cy="26" r="20" fill="${skin}"/>
    ${hairPath}
    <circle cx="53" cy="27" r="2.4" fill="#1a1a1a"/>
    <circle cx="67" cy="27" r="2.4" fill="#1a1a1a"/>
    <path d="M54 35 Q60 39 66 35" stroke="#7a3b26" stroke-width="2" fill="none" stroke-linecap="round"/>
  </svg>`;
}

function keeperNpcSVG() {
  const kit = { primary: '#2e2e38', stripe: '#39ff8a', shorts: '#101014', socks: '#2e2e38' };
  return footballerSVG(kit, '#d9a06b', '#151515', 'keeper');
}

/* =========================================================
   7. TRANSPORTADOR INTERACTIVO (SVG)
   ========================================================= */

const PROT = { cx: 150, cy: 160, r: 130, angle: null };

function buildProtractor() {
  const svg = $('#protractorSvg');
  svg.innerHTML = '';
  const ns = 'http://www.w3.org/2000/svg';

  const g = document.createElementNS(ns, 'g');

  // Arco base
  const base = document.createElementNS(ns, 'path');
  base.setAttribute('d', arcPath(0, 90));
  base.setAttribute('fill', 'none');
  base.setAttribute('stroke', '#0b1b33');
  base.setAttribute('stroke-width', '4');
  g.appendChild(base);

  // línea de base (0°) y línea vertical (90°)
  const baseLine = document.createElementNS(ns, 'line');
  baseLine.setAttribute('x1', PROT.cx); baseLine.setAttribute('y1', PROT.cy);
  baseLine.setAttribute('x2', PROT.cx + PROT.r); baseLine.setAttribute('y2', PROT.cy);
  baseLine.setAttribute('stroke', '#0b1b33'); baseLine.setAttribute('stroke-width', '3');
  g.appendChild(baseLine);
  const vertLine = document.createElementNS(ns, 'line');
  vertLine.setAttribute('x1', PROT.cx); vertLine.setAttribute('y1', PROT.cy);
  vertLine.setAttribute('x2', PROT.cx); vertLine.setAttribute('y2', PROT.cy - PROT.r);
  vertLine.setAttribute('stroke', '#0b1b33'); vertLine.setAttribute('stroke-width', '3');
  g.appendChild(vertLine);

  // Marcas de graduación
  for (let a = 0; a <= 90; a += 5) {
    const major = a % 15 === 0;
    const rOuter = PROT.r;
    const rInner = PROT.r - (major ? 16 : 9);
    const p1 = polar(a, rOuter);
    const p2 = polar(a, rInner);
    const tick = document.createElementNS(ns, 'line');
    tick.setAttribute('x1', p1.x); tick.setAttribute('y1', p1.y);
    tick.setAttribute('x2', p2.x); tick.setAttribute('y2', p2.y);
    tick.setAttribute('stroke', '#0b1b33');
    tick.setAttribute('stroke-width', major ? '2.4' : '1.2');
    g.appendChild(tick);

    if (major) {
      const lp = polar(a, PROT.r - 28);
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', lp.x); label.setAttribute('y', lp.y + 4);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '11');
      label.setAttribute('font-weight', '700');
      label.setAttribute('fill', '#0b1b33');
      label.textContent = a + '°';
      g.appendChild(label);
    }
  }

  // Aguja (needle)
  const needle = document.createElementNS(ns, 'line');
  needle.setAttribute('id', 'protNeedle');
  needle.setAttribute('x1', PROT.cx); needle.setAttribute('y1', PROT.cy);
  needle.setAttribute('x2', PROT.cx); needle.setAttribute('y2', PROT.cy - PROT.r + 14);
  needle.setAttribute('stroke', '#e63946');
  needle.setAttribute('stroke-width', '3');
  needle.setAttribute('stroke-linecap', 'round');
  needle.style.display = 'none';
  g.appendChild(needle);

  // Manija (handle) arrastrable
  const handle = document.createElementNS(ns, 'circle');
  handle.setAttribute('id', 'protHandle');
  handle.setAttribute('r', '9');
  handle.setAttribute('fill', '#e63946');
  handle.setAttribute('stroke', '#fff');
  handle.setAttribute('stroke-width', '2');
  handle.style.display = 'none';
  handle.style.cursor = 'grab';
  g.appendChild(handle);

  // Centro del transportador
  const center = document.createElementNS(ns, 'circle');
  center.setAttribute('cx', PROT.cx); center.setAttribute('cy', PROT.cy); center.setAttribute('r', '4');
  center.setAttribute('fill', '#0b1b33');
  g.appendChild(center);

  svg.appendChild(g);

  svg.addEventListener('pointerdown', onProtractorPointer);
  svg.addEventListener('pointermove', (e) => { if (e.buttons === 1 || e.pointerType === 'touch') onProtractorPointer(e); });
}

function arcPath(startDeg, endDeg) {
  const p1 = polar(startDeg, PROT.r);
  const p2 = polar(endDeg, PROT.r);
  return `M ${p1.x} ${p1.y} A ${PROT.r} ${PROT.r} 0 0 0 ${p2.x} ${p2.y}`;
}
// Convierte ángulo (0 = horizontal derecha, 90 = vertical arriba) a coordenadas del SVG.
function polar(deg, r) {
  const rad = (deg * Math.PI) / 180;
  return { x: PROT.cx + r * Math.cos(rad), y: PROT.cy - r * Math.sin(rad) };
}

function onProtractorPointer(e) {
  if (!state.round || state.round.phase !== 'angle' || state.round.angleLocked) return;
  const svg = $('#protractorSvg');
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
  const dx = loc.x - PROT.cx;
  const dy = PROT.cy - loc.y;
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  deg = clamp(Math.round(deg), 0, 90);
  setProtractorAngle(deg);
}

function setProtractorAngle(deg) {
  PROT.angle = deg;
  const needle = $('#protNeedle');
  const handle = $('#protHandle');
  const tip = polar(deg, PROT.r - 14);
  needle.setAttribute('x2', tip.x); needle.setAttribute('y2', tip.y);
  needle.style.display = 'block';
  const hp = polar(deg, PROT.r);
  handle.setAttribute('cx', hp.x); handle.setAttribute('cy', hp.y);
  handle.style.display = 'block';
  $('#angleReadout').textContent = deg + '°';
  $('#btnConfirmAngle').disabled = false;
}

// Ajuste fino del ángulo con los botones −5°/−1°/+1°/+5° (evita depender de un arrastre preciso).
function nudgeAngle(delta) {
  if (!state.round || state.round.phase !== 'angle' || state.round.angleLocked) return;
  SFX.click();
  const current = PROT.angle === null ? 45 : PROT.angle;
  const next = clamp(current + delta, 0, 90);
  setProtractorAngle(next);
}

/* =========================================================
   8. RENDER DE PANTALLAS
   ========================================================= */

function renderCharacterGrid() {
  const grid = $('#characterGrid');
  grid.innerHTML = '';
  CHARACTERS.forEach(c => {
    const card = document.createElement('div');
    card.className = 'character-card';
    card.setAttribute('role', 'listitem');
    card.tabIndex = 0;
    card.innerHTML = `${footballerSVG(c.kit, c.skin, c.hair, c.type)}<h3>${c.name}</h3><p>${c.desc}</p>`;
    card.addEventListener('click', () => selectCharacter(c.id, card));
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') selectCharacter(c.id, card); });
    grid.appendChild(card);
  });
}

function selectCharacter(id, cardEl) {
  SFX.click();
  state.character = CHARACTERS.find(c => c.id === id);
  $all('.character-card').forEach(el => el.classList.remove('selected'));
  cardEl.classList.add('selected');
  updateStartButton();
}

function renderLevelGrid() {
  const grid = $('#levelGrid');
  grid.innerHTML = '';
  Object.keys(LEVELS).forEach(lvl => {
    const cfg = LEVELS[lvl];
    const card = document.createElement('div');
    card.className = 'level-card' + (Number(lvl) === state.level ? ' selected' : '');
    card.setAttribute('role', 'listitem');
    card.tabIndex = 0;
    card.innerHTML = `<b>${lvl}</b>${cfg.sub}`;
    card.addEventListener('click', () => {
      SFX.click();
      state.level = Number(lvl);
      $all('.level-card').forEach(el => el.classList.remove('selected'));
      card.classList.add('selected');
    });
    grid.appendChild(card);
  });
}

function updateStartButton() {
  $('#btnStart').disabled = !state.character;
}

/* =========================================================
   9. FLUJO DE JUEGO
   ========================================================= */

function goToScreen(id) {
  $all('.screen').forEach(s => s.classList.remove('active'));
  $('#' + id).classList.add('active');
}

function startGame() {
  ensureAudio();
  SFX.whistle();
  state.goals = 0;
  state.attempts = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.score = 0;
  state.medalsAwarded = new Set();
  state.startTime = Date.now();

  renderPlayerAndKeeper();
  updateHud();
  goToScreen('screen-game');

  clearInterval(state.timerHandle);
  state.timerHandle = setInterval(updateTimer, 1000);

  buildProtractor();
  nextRound();
}

function renderPlayerAndKeeper() {
  $('#playerFigure').innerHTML = footballerSVG(state.character.kit, state.character.skin, state.character.hair, state.character.type);
  $('#keeperFigure').innerHTML = keeperNpcSVG();
}

function updateTimer() {
  const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  $('#hudTime').textContent = `${mm}:${ss}`;
}

function updateHud() {
  $('#hudLevel').textContent = state.level;
  $('#hudGoals').textContent = state.goals;
  $('#hudAttempts').textContent = state.attempts;
  $('#hudStreak').textContent = state.streak;
  $('#hudScore').textContent = state.score;
  const acc = state.attempts ? Math.round((state.goals / state.attempts) * 100) : 0;
  $('#hudAccuracy').textContent = acc + '%';
}

function nextRound() {
  if (state.attempts >= TOTAL_ATTEMPTS_MATCH) { endMatch(); return; }

  const conv = generateConversionChallenge(state.level);
  const ang = generateAngleChallenge(state.level);

  state.round = {
    phase: 'conversion',
    conv, ang,
    conversionCorrect: null,
    angleCorrect: null,
    angleTries: MAX_ANGLE_TRIES,
    angleLocked: false,
    hintsUsedConv: 0,
    hintsUsedAngle: 0,
    chosenAngle: null
  };

  // Reposiciona el arco (variable cosmética, cambia entre desafíos)
  const goalPositions = [8, 20, 34, 48, 60]; // % desde arriba del track
  $('#goalPost').style.top = pick(goalPositions) + '%';
  $('#keeperFigure').className = 'keeper-figure';
  $('#ball').className = 'ball';
  $('#ball').style.left = '15%';
  $('#ball').style.bottom = '12%';
  $('#ball').style.transition = 'none';
  $('#playerWrap').classList.remove('kick');

  $('#resultBanner').classList.remove('show', 'fail');
  $('#afterShot').classList.remove('show');
  $('#btnShoot').disabled = true;

  renderConversionCard();
  renderAngleCard(true);

  updateHud();
}

/* ---------- Tarjeta de conversión ---------- */
function renderConversionCard() {
  const round = state.round;
  const card = $('#cardConversion');
  card.classList.add('active');
  card.classList.remove('locked');

  $('#conversionQuestion').textContent = round.conv.question;
  $('#hintConvText').textContent = '';
  $('#hintConvCount').textContent = 3;
  $('#btnHintConv').disabled = false;

  const opts = $('#conversionOptions');
  opts.innerHTML = '';
  round.conv.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = formatNumber(opt) + ' ' + round.conv.to.name;
    btn.addEventListener('click', () => answerConversion(idx, btn));
    opts.appendChild(btn);
  });
}

function answerConversion(idx, btnEl) {
  const round = state.round;
  if (round.conversionCorrect !== null) return;
  SFX.click();
  const correct = idx === round.conv.correctIndex;
  round.conversionCorrect = correct;

  $all('#conversionOptions .option-btn').forEach((b, i) => {
    b.disabled = true;
    if (i === round.conv.correctIndex) b.classList.add('correct');
    else if (i === idx && !correct) b.classList.add('incorrect');
  });
  $('#btnHintConv').disabled = true;
  if (!correct) SFX.wrong();

  $('#cardConversion').classList.add('locked');
  renderAngleCard(false);
  round.phase = 'angle';
}

/* ---------- Tarjeta de ángulo ---------- */
function renderAngleCard(locked) {
  const card = $('#cardAngle');
  card.classList.add('active');
  card.classList.toggle('locked', locked);

  $('#hintAngleText').textContent = '';
  $('#hintAngleCount').textContent = 3;
  $('#btnHintAngle').disabled = false;
  $('#angleFeedback').textContent = '';
  $('#angleReadout').textContent = '—';
  $('#btnConfirmAngle').disabled = true;
  $('#btnConfirmAngle').textContent = 'Confirmar ángulo';
  $('#btnConfirmAngle').classList.remove('confirmed-ok', 'confirmed-fail');

  PROT.angle = null;
  const needle = $('#protNeedle');
  const handle = $('#protHandle');
  if (needle) needle.style.display = 'none';
  if (handle) handle.style.display = 'none';
}

function confirmAngle() {
  const round = state.round;
  if (round.angleLocked || PROT.angle === null) return;
  SFX.click();
  const chosen = PROT.angle;
  round.chosenAngle = chosen;
  const target = round.ang.target;
  const tol = round.ang.tolerance;
  const diff = chosen - target;
  const within = Math.abs(diff) <= tol;

  round.angleTries -= 1;

  if (within) {
    round.angleCorrect = true;
    round.angleLocked = true;
    $('#angleFeedback').textContent = '¡Justo ahí! 🎯';
    $('#btnConfirmAngle').textContent = '✅ Ángulo confirmado';
    $('#btnConfirmAngle').classList.add('confirmed-ok');
    lockAngleUI();
  } else if (round.angleTries > 0) {
    $('#angleFeedback').textContent = diff > 0
      ? `Muy alto. Probá con un ángulo más chico. (Te quedan ${round.angleTries} intento/s)`
      : `Muy bajo. Probá con un ángulo más grande. (Te quedan ${round.angleTries} intento/s)`;
    SFX.wrong();
  } else {
    round.angleCorrect = false;
    round.angleLocked = true;
    round.angleOverUnder = diff > 0 ? 'over' : 'under';
    $('#angleFeedback').textContent = diff > 0
      ? 'Se acabaron los intentos: quedó muy alto.'
      : 'Se acabaron los intentos: quedó muy bajo.';
    $('#btnConfirmAngle').textContent = '❌ Sin más intentos';
    $('#btnConfirmAngle').classList.add('confirmed-fail');
    SFX.wrong();
    lockAngleUI();
  }

  maybeEnableShoot();
}

function lockAngleUI() {
  $('#btnConfirmAngle').disabled = true;
  $('#btnHintAngle').disabled = true;
  $('#cardAngle').classList.add('locked');
}

function maybeEnableShoot() {
  const round = state.round;
  if (round.conversionCorrect !== null && round.angleLocked) {
    $('#btnShoot').disabled = false;
  }
}

/* ---------- Pistas ---------- */
function useConversionHint() {
  const round = state.round;
  if (round.conversionCorrect !== null) return;
  if (round.hintsUsedConv >= 3) return;
  SFX.click();
  $('#hintConvText').textContent = round.conv.hints[round.hintsUsedConv];
  round.hintsUsedConv++;
  $('#hintConvCount').textContent = 3 - round.hintsUsedConv;
  if (round.hintsUsedConv >= 3) $('#btnHintConv').disabled = true;
}

function useAngleHint() {
  const round = state.round;
  if (round.angleLocked) return;
  if (round.hintsUsedAngle >= 3) return;
  SFX.click();
  const medals = ['🥉', '🥈', '🥇'];
  $('#hintAngleText').textContent = medals[round.hintsUsedAngle] + ' ' + round.ang.hints[round.hintsUsedAngle];
  round.hintsUsedAngle++;
  $('#hintAngleCount').textContent = 3 - round.hintsUsedAngle;
  if (round.hintsUsedAngle >= 3) $('#btnHintAngle').disabled = true;
}

/* =========================================================
   10. RESOLUCIÓN DEL REMATE
   ========================================================= */

function shoot() {
  const round = state.round;
  if ($('#btnShoot').disabled) return;
  SFX.click();
  $('#btnShoot').disabled = true;
  $('#playerWrap').classList.add('kick');
  SFX.kick();

  const ball = $('#ball');
  ball.classList.add('spin');
  ball.style.transition = 'left .75s cubic-bezier(.2,.6,.3,1), bottom .75s cubic-bezier(.2,.6,.3,1)';

  const outcome = computeOutcome(round);

  setTimeout(() => { animateBall(ball, outcome); }, 180);
  setTimeout(() => { resolveOutcome(outcome); }, 950);
}

function computeOutcome(round) {
  if (round.conversionCorrect && round.angleCorrect) return 'goal';
  if (!round.conversionCorrect && round.angleCorrect) return 'short';
  if (round.conversionCorrect && !round.angleCorrect) return round.angleOverUnder === 'over' ? 'over' : 'under';
  return 'wide';
}

function animateBall(ball, outcome) {
  const targets = {
    goal:  { left: '84%', bottom: '46%' },
    short: { left: '46%', bottom: '15%' },
    over:  { left: '90%', bottom: '92%' },
    under: { left: '78%', bottom: '8%' },
    wide:  { left: '92%', bottom: '82%' }
  };
  const t = targets[outcome];
  ball.style.left = t.left;
  ball.style.bottom = t.bottom;

  if (outcome === 'goal') {
    setTimeout(() => {
      $('#goalPost .goal-net').classList.add('ripple');
      const dir = pick(['dive-left', 'dive-right']);
      $('#keeperFigure').classList.add(dir);
    }, 600);
  } else if (outcome === 'under') {
    setTimeout(() => $('#keeperFigure').classList.add('dive-center'), 500);
  } else {
    setTimeout(() => $('#keeperFigure').classList.add(pick(['dive-left', 'dive-right'])), 500);
  }
}

function resolveOutcome(outcome) {
  const round = state.round;
  state.attempts++;

  const messages = {
    goal:  { text: '¡GOOOOL! ⚽🎉', fail: false },
    short: { text: 'La pelota quedó corta 😕 (revisá la conversión)', fail: true },
    over:  { text: 'Por arriba del travesaño 😬 (el ángulo era muy grande)', fail: true },
    under: { text: 'Atajada del arquero 🧤 (el ángulo era muy chico)', fail: true },
    wide:  { text: 'La pelota salió desviada 😵 (revisá los dos desafíos)', fail: true }
  };
  const msg = messages[outcome];

  const banner = $('#resultBanner');
  banner.textContent = msg.text;
  banner.classList.toggle('fail', msg.fail);
  banner.classList.add('show');

  if (outcome === 'goal') {
    state.goals++;
    state.streak++;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    const hintsUsed = round.hintsUsedConv + round.hintsUsedAngle;
    const bonus = Math.max(40, 100 * state.level - hintsUsed * 10);
    state.score += bonus;
    SFX.goal();
    spawnConfetti();
    maybeLevelUp();
  } else {
    state.streak = 0;
    SFX.save();
  }

  checkMedals();
  updateHud();

  $('#afterShotText').textContent = outcome === 'goal'
    ? `+${Math.max(40, 100 * state.level - (round.hintsUsedConv + round.hintsUsedAngle) * 10)} puntos. ¡Seguimos!`
    : 'Segui practicando: revisá la pista si te quedó alguna duda.';
  $('#afterShot').classList.add('show');
}

function maybeLevelUp() {
  if (state.level < 4 && state.streak > 0 && state.streak % 3 === 0) {
    state.level++;
    awardMedal(`nivel${state.level}`, `¡Subiste a Nivel ${state.level}!`);
  }
}

/* =========================================================
   11. MEDALLAS
   ========================================================= */

function checkMedals() {
  if (state.goals === 1) awardMedal('primer_gol', '🥉 Primer gol');
  if (state.streak === 3) awardMedal('racha3', '🔥 Racha de 3');
  if (state.streak === 5) awardMedal('racha5', '🔥🔥 Racha de 5');
  if (state.goals === 5) awardMedal('crack', '🏆 Crack del equipo');
  if (state.attempts >= 5) {
    const acc = state.goals / state.attempts;
    if (acc >= 0.8) awardMedal('punteria', '🎯 Puntería de élite');
  }
}

function awardMedal(id, label) {
  if (state.medalsAwarded.has(id)) return;
  state.medalsAwarded.add(id);
  const toast = document.createElement('div');
  toast.className = 'medal-toast';
  toast.textContent = label;
  $('#medalTray').appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}

/* =========================================================
   12. CONFETI
   ========================================================= */

function spawnConfetti() {
  const layer = $('#confettiLayer');
  const colors = ['#ffc72c', '#75aadb', '#ffffff', '#2ecc71', '#e63946'];
  for (let i = 0; i < 36; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = rand(0, 100) + '%';
    piece.style.background = pick(colors);
    piece.style.animationDuration = rand(1.2, 2.2) + 's';
    piece.style.animationDelay = rand(0, 0.4) + 's';
    layer.appendChild(piece);
    setTimeout(() => piece.remove(), 3000);
  }
}

/* =========================================================
   13. FIN DE PARTIDO
   ========================================================= */

function endMatch() {
  clearInterval(state.timerHandle);
  const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const acc = state.attempts ? Math.round((state.goals / state.attempts) * 100) : 0;

  let best = 0;
  try { best = Number(localStorage.getItem('gdm_best_score') || 0); } catch (e) { /* ignore */ }
  if (state.score > best) {
    best = state.score;
    try { localStorage.setItem('gdm_best_score', String(best)); } catch (e) { /* ignore */ }
  }

  $('#summaryGrid').innerHTML = `
    <div><b>${state.goals}</b>Goles</div>
    <div><b>${state.attempts}</b>Intentos</div>
    <div><b>${acc}%</b>Precisión</div>
    <div><b>${mm}:${ss}</b>Tiempo</div>
    <div><b>${state.bestStreak}</b>Mejor racha</div>
    <div><b>${state.score}</b>Puntaje (Récord: ${best})</div>
  `;
  $('#summaryMedals').innerHTML = state.medalsAwarded.size
    ? Array.from(state.medalsAwarded).map(() => '🏅').join(' ')
    : 'Todavía sin medallas — ¡a seguir practicando!';

  goToScreen('screen-summary');
}

/* =========================================================
   14. EVENTOS DE INTERFAZ
   ========================================================= */

function initUI() {
  renderCharacterGrid();
  renderLevelGrid();

  let mutedSaved = false;
  try { mutedSaved = localStorage.getItem('gdm_muted') === '1'; } catch (e) { /* ignore */ }
  setMuted(mutedSaved);

  $('#btnStart').addEventListener('click', startGame);
  $('#btnSoundMenu').addEventListener('click', () => setMuted(!state.muted));
  $('#btnSoundGame').addEventListener('click', () => setMuted(!state.muted));

  $('#btnHintConv').addEventListener('click', useConversionHint);
  $('#btnHintAngle').addEventListener('click', useAngleHint);
  $('#btnConfirmAngle').addEventListener('click', confirmAngle);
  $all('#angleNudge .nudge-btn').forEach(btn => {
    btn.addEventListener('click', () => nudgeAngle(Number(btn.dataset.delta)));
  });
  $('#btnShoot').addEventListener('click', shoot);
  $('#btnNextRound').addEventListener('click', nextRound);

  $('#btnMenu').addEventListener('click', () => {
    if (confirm('¿Terminar el partido y ver el resumen?')) endMatch();
  });
  $('#btnPlayAgain').addEventListener('click', () => { goToScreen('screen-menu'); });
  $('#btnBackMenu').addEventListener('click', () => { goToScreen('screen-menu'); });
}

document.addEventListener('DOMContentLoaded', initUI);
