// Preset Configuration
const PRESETS = {
  relax: {
    name: 'Relax',
    inhale: 4,
    hold: 7,
    exhale: 8
  },
  quick: {
    name: 'Quick',
    inhale: 4,
    hold: 4,
    exhale: 4
  },
  sleep: {
    name: 'Sleep',
    inhale: 4,
    hold: 7,
    exhale: 10
  }
};

// State Management
let currentPreset = 'relax';
let isRunning = false;
let currentPhase = null;
let countdown = 0;
let timer = null;

// Audio Context for Ambient Sound
let audioContext = null;
let droneOscillators = [];
let droneGain = null;
let masterFilter = null;
let soundEnabled = false;

// DOM Elements
const breathCircle = document.querySelector('.breath-circle');
const phaseText = document.querySelector('.phase-text');
const timerDisplay = document.querySelector('.timer');
const startBtn = document.getElementById('startBtn');
const soundBtn = document.getElementById('soundBtn');
const presetBtns = document.querySelectorAll('.preset-btn');

// Initialize Audio - Soft Ambient Pad
function initAudio() {
  if (audioContext) return;

  audioContext = new (window.AudioContext || window.webkitAudioContext)();

  // Master gain
  droneGain = audioContext.createGain();
  droneGain.gain.value = 0;

  // Low-pass filter for warmth
  masterFilter = audioContext.createBiquadFilter();
  masterFilter.type = 'lowpass';
  masterFilter.frequency.value = 800;
  masterFilter.Q.value = 0.5;

  droneGain.connect(masterFilter);
  masterFilter.connect(audioContext.destination);

  // Create soft pad with major chord (C major: C4, E4, G4, C5)
  const notes = [
    { freq: 261.63, detune: 0 },    // C4
    { freq: 261.63, detune: 5 },    // C4 slightly sharp (warmth)
    { freq: 329.63, detune: -3 },   // E4 slightly flat
    { freq: 392.00, detune: 2 },    // G4
    { freq: 523.25, detune: 0 },    // C5
  ];

  notes.forEach((note, i) => {
    const osc = audioContext.createOscillator();
    const oscGain = audioContext.createGain();

    // Use sine waves for softness
    osc.type = 'sine';
    osc.frequency.value = note.freq;
    osc.detune.value = note.detune;

    // Softer higher notes
    const volume = i < 2 ? 0.15 : 0.08;
    oscGain.gain.value = volume;

    osc.connect(oscGain);
    oscGain.connect(droneGain);
    osc.start();

    droneOscillators.push({ osc, gain: oscGain });
  });
}

// Start Ambient Sound
function startDrone() {
  if (!soundEnabled || !audioContext) return;

  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  droneGain.gain.cancelScheduledValues(audioContext.currentTime);
  droneGain.gain.setValueAtTime(droneGain.gain.value, audioContext.currentTime);
  droneGain.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 3);
}

// Stop Ambient Sound
function stopDrone() {
  if (!audioContext || !droneGain) return;

  droneGain.gain.cancelScheduledValues(audioContext.currentTime);
  droneGain.gain.setValueAtTime(droneGain.gain.value, audioContext.currentTime);
  droneGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 2);
}

// Modulate sound based on breathing phase
function modulateDrone(phase) {
  if (!soundEnabled || !audioContext || !droneGain) return;

  const preset = PRESETS[currentPreset];
  const now = audioContext.currentTime;

  droneGain.gain.cancelScheduledValues(now);
  droneGain.gain.setValueAtTime(droneGain.gain.value, now);

  // Also modulate filter for more expression
  masterFilter.frequency.cancelScheduledValues(now);
  masterFilter.frequency.setValueAtTime(masterFilter.frequency.value, now);

  switch (phase) {
    case 'inhale':
      // Volume and brightness rises more noticeably
      droneGain.gain.linearRampToValueAtTime(0.18, now + preset.inhale);
      masterFilter.frequency.linearRampToValueAtTime(1600, now + preset.inhale);
      break;
    case 'hold':
      // Bright sustain at peak
      droneGain.gain.setValueAtTime(0.18, now);
      masterFilter.frequency.setValueAtTime(1400, now);
      break;
    case 'exhale':
      // Volume and brightness falls more dramatically
      droneGain.gain.linearRampToValueAtTime(0.08, now + preset.exhale);
      masterFilter.frequency.linearRampToValueAtTime(400, now + preset.exhale);
      break;
  }
}

// Toggle Sound
soundBtn.addEventListener('click', () => {
  if (!audioContext) {
    initAudio();
  }

  soundEnabled = !soundEnabled;
  soundBtn.querySelector('.sound-icon').textContent = soundEnabled ? '🔊' : '🔇';

  if (soundEnabled && isRunning) {
    startDrone();
    modulateDrone(currentPhase);
  } else {
    stopDrone();
  }
});

// Preset Switch
presetBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    if (isRunning) return;

    presetBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPreset = btn.dataset.preset;
  });
});

// Start/Stop
startBtn.addEventListener('click', () => {
  if (isRunning) {
    stopBreathing();
  } else {
    startBreathing();
  }
});

function startBreathing() {
  isRunning = true;
  startBtn.querySelector('.btn-icon').textContent = '⏸️';
  startBtn.querySelector('.btn-text').textContent = 'Stop';

  // Disable preset buttons
  presetBtns.forEach(btn => btn.style.opacity = '0.5');

  // Start drone sound
  if (soundEnabled) {
    if (!audioContext) initAudio();
    startDrone();
  }

  // Start breathing cycle
  runPhase('inhale');
}

function stopBreathing() {
  isRunning = false;
  clearInterval(timer);

  startBtn.querySelector('.btn-icon').textContent = '▶️';
  startBtn.querySelector('.btn-text').textContent = 'Start';

  // Enable preset buttons
  presetBtns.forEach(btn => btn.style.opacity = '1');

  // Stop drone sound
  stopDrone();

  // Reset
  breathCircle.className = 'breath-circle';
  phaseText.textContent = 'Tap Start to begin';
  timerDisplay.textContent = '--';
}

function runPhase(phase) {
  if (!isRunning) return;

  currentPhase = phase;
  const preset = PRESETS[currentPreset];

  // Reset animation class
  breathCircle.className = 'breath-circle';

  // Modulate drone sound
  modulateDrone(phase);

  // Phase-specific settings
  let duration, text;
  switch (phase) {
    case 'inhale':
      duration = preset.inhale;
      text = 'Breathe in...';
      breathCircle.style.setProperty('--inhale-duration', `${duration}s`);
      requestAnimationFrame(() => {
        breathCircle.classList.add('inhale');
      });
      break;
    case 'hold':
      duration = preset.hold;
      text = 'Hold...';
      requestAnimationFrame(() => {
        breathCircle.classList.add('hold');
      });
      break;
    case 'exhale':
      duration = preset.exhale;
      text = 'Breathe out...';
      breathCircle.style.setProperty('--exhale-duration', `${duration}s`);
      requestAnimationFrame(() => {
        breathCircle.classList.add('exhale');
      });
      break;
  }

  phaseText.textContent = text;
  countdown = duration;
  timerDisplay.textContent = countdown;

  // Countdown
  clearInterval(timer);
  timer = setInterval(() => {
    countdown--;
    if (countdown <= 0) {
      clearInterval(timer);
      nextPhase();
    } else {
      timerDisplay.textContent = countdown;
    }
  }, 1000);
}

function nextPhase() {
  if (!isRunning) return;

  switch (currentPhase) {
    case 'inhale':
      runPhase('hold');
      break;
    case 'hold':
      runPhase('exhale');
      break;
    case 'exhale':
      runPhase('inhale'); // Loop
      break;
  }
}
