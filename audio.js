function getAvg(arr, start, end) {
  let sum = 0;
  for (let i = start; i < end; i++) sum += arr[i];
  return (sum / (end - start)) / 255.0;
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export class BeatDetector {
  constructor() {
    this.historyBass = 0.4;
    this.lastBeatTime = 0;
    this.beatTimestamps = [];
    this.estimatedBPM = 128;
    this.currentBeat = 0;
    this.beatPhase = 0;
    this.beatPulse = 0;
    this.dropPulse = 0;
    this.rhythmWave = 0;
    this.anticipatedBeat = 0;
    this.impactLevel = 0;
    this.prevTreble = 0;
    this.prevMid = 0;
    this.prevEnergy = 0;
    this.tiltX = 0;
    this.tiltY = 0;
    this.lastBeatBass = 0;
  }

  reset() {
    this.historyBass = 0.4;
    this.lastBeatTime = 0;
    this.beatTimestamps = [];
    this.estimatedBPM = 128;
    this.currentBeat = 0;
    this.beatPhase = 0;
    this.beatPulse = 0;
    this.dropPulse = 0;
    this.rhythmWave = 0;
    this.anticipatedBeat = 0;
    this.impactLevel = 0;
    this.prevTreble = 0;
    this.prevMid = 0;
    this.prevEnergy = 0;
    this.tiltX = 0;
    this.tiltY = 0;
    this.lastBeatBass = 0;
  }

  update(bass, mid, treble, time, isPlaying, deltaTime = 1 / 60) {
    const trebleDelta = treble - this.prevTreble;
    this.prevTreble = treble;

    const instantEnergy = bass * 0.55 + mid * 0.30 + treble * 0.15;
    const energyDelta = instantEnergy - this.prevEnergy;
    this.prevEnergy = instantEnergy;

    const empty = {
      isBeat: false,
      isDrop: false,
      isHeavyHit: false,
      currentBeat: 0,
      beatPhase: 0,
      beatPulse: 0,
      dropPulse: 0,
      rhythmWave: 0,
      anticipatedBeat: 0,
      trebleDelta: 0,
      offbeatPulse: 0,
      snarePulse: 0,
      midPulse: 0,
      impactLevel: 0,
      estimatedBPM: this.estimatedBPM,
      tiltX: 0,
      tiltY: 0,
      kickBass: 0
    };

    if (!isPlaying) {
      this.tiltX *= 0.88;
      this.tiltY *= 0.88;
      this.dropPulse *= 0.9;
      this.impactLevel *= 0.9;
      return empty;
    }

    const beatInterval = 60 / this.estimatedBPM;
    const minCooldown = Math.max(0.08, beatInterval * 0.38);

    let isBeat = false;
    let isHeavyHit = false;

    // KICK: bajos rompen umbral adaptativo
    if (bass > this.historyBass && bass > 0.42 && (time - this.lastBeatTime > minCooldown)) {
      isBeat = true;
      isHeavyHit = bass > 0.62;
      this.historyBass = Math.min(1.0, bass + 0.08);

      if (this.lastBeatTime > 0) {
        const interval = time - this.lastBeatTime;
        if (interval > 0.2 && interval < 1.5) {
          this.beatTimestamps.push(interval);
          if (this.beatTimestamps.length > 12) this.beatTimestamps.shift();
          const medianInterval = median(this.beatTimestamps);
          this.estimatedBPM = Math.max(80, Math.min(180, 60 / medianInterval));
        }
      }

      this.lastBeatTime = time;
      this.currentBeat = 1.0;
      this.beatPulse = isHeavyHit ? 1.0 : 0.75;
      this.lastBeatBass = bass;
      this.impactLevel = Math.max(this.impactLevel, bass * (isHeavyHit ? 1.2 : 0.85));

      // Tilt impulsivo — NO rotación acumulativa
      this.tiltX = (bass - 0.35) * (isHeavyHit ? 0.32 : 0.18);
      this.tiltY = (mid - 0.25) * 0.12;
    }

    this.historyBass = Math.max(0.38, this.historyBass - 0.018);

    // DROP: pico brusco de energía total (prioridad máxima)
    let isDrop = false;
    if (energyDelta > 0.11 && bass > 0.48 && instantEnergy > 0.42) {
      isDrop = true;
      this.dropPulse = 1.0;
      this.beatPulse = Math.max(this.beatPulse, 1.0);
      this.impactLevel = Math.max(this.impactLevel, Math.min(1.0, instantEnergy * 1.35));
      this.tiltX = bass * 0.42;
      this.tiltY = mid * 0.22;
    }

    const interval = 60 / this.estimatedBPM;
    if (this.lastBeatTime > 0) {
      this.beatPhase = Math.min(1, (time - this.lastBeatTime) / interval);
      this.rhythmWave = 1.0 - Math.abs(this.beatPhase * 2.0 - 1.0);

      if (this.beatPhase > 0.84 && bass > 0.32 && bass > this.historyBass * 0.88) {
        this.anticipatedBeat = Math.max(this.anticipatedBeat, 0.28 * (this.beatPhase - 0.84) / 0.16);
      }
    } else {
      this.beatPhase = 0;
      this.rhythmWave = 0;
    }

    // Decaimientos sincronizados al BPM
    const pulseDecay = Math.pow(0.001, deltaTime / (interval * 0.32));
    this.beatPulse *= pulseDecay;
    if (this.beatPulse < 0.001) this.beatPulse = 0;

    this.dropPulse *= Math.pow(0.001, deltaTime / 0.28);
    if (this.dropPulse < 0.001) this.dropPulse = 0;

    this.currentBeat = Math.max(this.currentBeat, this.beatPulse, this.dropPulse * 0.9, this.anticipatedBeat);
    this.currentBeat *= Math.pow(0.04, deltaTime * this.estimatedBPM / 28);
    this.anticipatedBeat *= 0.65;
    this.impactLevel *= Math.pow(0.05, deltaTime * 6);

    if (this.currentBeat < 0.01) this.currentBeat = 0;
    if (this.anticipatedBeat < 0.01) this.anticipatedBeat = 0;
    if (this.impactLevel < 0.01) this.impactLevel = 0;

    // Tilt decae rápido — vuelve al centro, no sigue girando
    this.tiltX *= Math.pow(0.02, deltaTime * 7);
    this.tiltY *= Math.pow(0.02, deltaTime * 7);

    // Capas secundarias: snare/hihat y movimiento de medios
    const snarePulse = trebleDelta > 0.032 ? Math.min(1, trebleDelta * 3.5) : 0;
    const midPulse = mid > this.prevMid * 1.12 && mid > 0.3
      ? Math.min(1, (mid - this.prevMid) * 3)
      : 0;
    this.prevMid = mid;

    const offbeatPulse = snarePulse * 0.6 + midPulse * 0.4;

    return {
      isBeat,
      isDrop,
      isHeavyHit,
      currentBeat: this.currentBeat,
      beatPhase: this.beatPhase,
      beatPulse: this.beatPulse,
      dropPulse: this.dropPulse,
      rhythmWave: this.rhythmWave,
      anticipatedBeat: this.anticipatedBeat,
      trebleDelta,
      offbeatPulse,
      snarePulse,
      midPulse,
      impactLevel: this.impactLevel,
      estimatedBPM: this.estimatedBPM,
      tiltX: this.tiltX,
      tiltY: this.tiltY,
      kickBass: this.beatPulse * this.lastBeatBass
    };
  }
}

export function createAudioEngine(settingsManager) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioCtx;
  let analyser;
  let source;
  let dataArray;

  let isPlaying = false;
  let currentTrackIndex = -1;
  const tracks = [];
  const objectUrls = new Map();

  const audioElement = new Audio();
  const beatDetector = new BeatDetector();

  const listeners = {
    error: null,
    ended: null,
    loadedmetadata: null,
    timeupdate: null,
    trackchange: null,
    playlistchange: null
  };

  function on(event, fn) {
    listeners[event] = fn;
  }

  function revokeUrlForFile(file) {
    const url = objectUrls.get(file);
    if (url) {
      URL.revokeObjectURL(url);
      objectUrls.delete(file);
    }
  }

  function getUrlForFile(file) {
    if (!objectUrls.has(file)) {
      objectUrls.set(file, URL.createObjectURL(file));
    }
    return objectUrls.get(file);
  }

  function revokeAllUrls() {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.clear();
  }

  function initAudio() {
    if (!audioCtx) {
      audioCtx = new AudioContext();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;
      source = audioCtx.createMediaElementSource(audioElement);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      dataArray = new Uint8Array(analyser.frequencyBinCount);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function getTrackFile(index) {
    return tracks[index]?.file ?? null;
  }

  function loadTrack(index, autoplay = true) {
    if (index < 0 || index >= tracks.length) return false;

    currentTrackIndex = index;
    settingsManager.set('currentTrackIndex', index);

    const track = tracks[index];
    audioElement.src = getUrlForFile(track.file);
    audioElement.load();

    if (autoplay) {
      audioElement.play().catch(() => {});
      isPlaying = true;
    }

    listeners.trackchange?.({
      index,
      name: track.file.name.replace(/\.[^/.]+$/, ''),
      isPlaying
    });

    return true;
  }

  function togglePlay() {
    if (tracks.length === 0) return 'empty';

    initAudio();
    if (isPlaying) {
      audioElement.pause();
      isPlaying = false;
    } else {
      audioElement.play().catch(() => {});
      isPlaying = true;
    }
    listeners.trackchange?.({
      index: currentTrackIndex,
      name: tracks[currentTrackIndex]?.file.name.replace(/\.[^/.]+$/, '') ?? 'No track',
      isPlaying
    });
    return isPlaying;
  }

  function addTracks(files) {
    files.forEach((file) => tracks.push({ file }));
    listeners.playlistchange?.(tracks.map((t) => t.file));
    return tracks.length;
  }

  function setTracksFromFiles(files, startIndex = -1) {
    revokeAllUrls();
    tracks.length = 0;

    files.forEach((file) => tracks.push({ file }));

    if (tracks.length === 0) {
      currentTrackIndex = -1;
      settingsManager.set('currentTrackIndex', -1);
      listeners.playlistchange?.([]);
      return;
    }

    const idx = startIndex >= 0 && startIndex < tracks.length ? startIndex : 0;
    listeners.playlistchange?.(tracks.map((t) => t.file));
    initAudio();
    loadTrack(idx, false);
  }

  function removeTrack(index) {
    const removed = tracks[index];
    revokeUrlForFile(removed.file);
    tracks.splice(index, 1);

    if (tracks.length === 0) {
      audioElement.pause();
      audioElement.src = '';
      isPlaying = false;
      currentTrackIndex = -1;
      settingsManager.set('currentTrackIndex', -1);
      listeners.playlistchange?.([]);
      listeners.trackchange?.({ index: -1, name: 'No track', isPlaying: false });
      return;
    }

    if (index === currentTrackIndex) {
      const nextIndex = index >= tracks.length ? 0 : index;
      loadTrack(nextIndex);
    } else if (index < currentTrackIndex) {
      currentTrackIndex--;
      settingsManager.set('currentTrackIndex', currentTrackIndex);
    }

    listeners.playlistchange?.(tracks.map((t) => t.file));
  }

  function reorderTrack(from, to) {
    const [moved] = tracks.splice(from, 1);
    tracks.splice(to, 0, moved);

    if (currentTrackIndex === from) {
      currentTrackIndex = to;
    } else if (from < currentTrackIndex && to >= currentTrackIndex) {
      currentTrackIndex--;
    } else if (from > currentTrackIndex && to <= currentTrackIndex) {
      currentTrackIndex++;
    }

    settingsManager.set('currentTrackIndex', currentTrackIndex);
    listeners.playlistchange?.(tracks.map((t) => t.file));
  }

  function shufflePlaylist() {
    if (tracks.length <= 1) return;
    const currentFile = tracks[currentTrackIndex]?.file;
    for (let i = tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
    }
    currentTrackIndex = currentFile ? tracks.findIndex((t) => t.file === currentFile) : 0;
    settingsManager.set('currentTrackIndex', currentTrackIndex);
    listeners.playlistchange?.(tracks.map((t) => t.file));
  }

  function clearPlaylist() {
    revokeAllUrls();
    tracks.length = 0;
    audioElement.pause();
    audioElement.src = '';
    isPlaying = false;
    currentTrackIndex = -1;
    beatDetector.reset();
    settingsManager.set('currentTrackIndex', -1);
    listeners.playlistchange?.([]);
    listeners.trackchange?.({ index: -1, name: 'No track', isPlaying: false });
  }

  function getFrequencyBands() {
    if (!analyser || !isPlaying) {
      return { bass: 0, mid: 0, treble: 0, rawBass: 0, rawMid: 0, rawTreble: 0 };
    }

    analyser.getByteFrequencyData(dataArray);
    const mult = settingsManager.get().bassSensMult;
    const rawBass = getAvg(dataArray, 0, 3) * mult;
    const rawMid = getAvg(dataArray, 4, 40) * mult;
    const rawTreble = getAvg(dataArray, 40, 128) * mult;
    return {
      bass: rawBass,
      mid: rawMid,
      treble: rawTreble,
      rawBass,
      rawMid,
      rawTreble
    };
  }

  audioElement.addEventListener('error', (e) => {
    console.error('Audio playback error:', e);
    isPlaying = false;
    listeners.error?.(e);
  });

  audioElement.addEventListener('ended', () => {
    if (tracks.length > 0) {
      loadTrack((currentTrackIndex + 1) % tracks.length);
    }
  });

  audioElement.addEventListener('loadedmetadata', () => {
    listeners.loadedmetadata?.(audioElement.duration);
  });

  audioElement.addEventListener('timeupdate', () => {
    listeners.timeupdate?.(audioElement.currentTime);
  });

  return {
    audioElement,
    beatDetector,
    on,
    initAudio,
    loadTrack,
    togglePlay,
    addTracks,
    setTracksFromFiles,
    removeTrack,
    reorderTrack,
    shufflePlaylist,
    clearPlaylist,
    getFrequencyBands,
    getTracks: () => tracks.map((t) => t.file),
    getCurrentIndex: () => currentTrackIndex,
    getIsPlaying: () => isPlaying,
    setIsPlaying: (val) => { isPlaying = val; },
    seek: (time) => { audioElement.currentTime = time; },
    next: () => tracks.length && loadTrack((currentTrackIndex + 1) % tracks.length),
    prev: () => tracks.length && loadTrack((currentTrackIndex - 1 + tracks.length) % tracks.length)
  };
}
