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
    this.rhythmWave = 0;
    this.anticipatedBeat = 0;
    this.prevTreble = 0;
    this.extraRotation = 0;
    this.beatRotation = 0;
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
    this.rhythmWave = 0;
    this.anticipatedBeat = 0;
    this.extraRotation = 0;
    this.beatRotation = 0;
    this.lastBeatBass = 0;
  }

  update(bass, treble, time, isPlaying, deltaTime = 1 / 60) {
    const trebleDelta = treble - this.prevTreble;
    this.prevTreble = treble;

    if (!isPlaying) {
      this.currentBeat = 0;
      this.beatPhase = 0;
      this.beatPulse = 0;
      this.rhythmWave = 0;
      this.anticipatedBeat = 0;
      this.beatRotation *= 0.9;
      return {
        isBeat: false,
        currentBeat: 0,
        beatPhase: 0,
        beatPulse: 0,
        rhythmWave: 0,
        anticipatedBeat: 0,
        trebleDelta: 0,
        offbeatPulse: 0,
        estimatedBPM: this.estimatedBPM,
        extraRotation: this.extraRotation,
        beatRotation: this.beatRotation,
        kickBass: 0
      };
    }

    const beatInterval = 60 / this.estimatedBPM;
    const minCooldown = Math.max(0.08, beatInterval * 0.35);

    let isBeat = false;
    if (bass > this.historyBass && bass > 0.45 && (time - this.lastBeatTime > minCooldown)) {
      isBeat = true;
      this.historyBass = Math.min(1.0, bass + 0.08);

      if (this.lastBeatTime > 0) {
        const interval = time - this.lastBeatTime;
        if (interval > 0.2 && interval < 1.5) {
          this.beatTimestamps.push(interval);
          if (this.beatTimestamps.length > 12) this.beatTimestamps.shift();
          const medianInterval = median(this.beatTimestamps);
          const bpm = 60 / medianInterval;
          this.estimatedBPM = Math.max(80, Math.min(180, bpm));
        }
      }

      this.lastBeatTime = time;
      this.currentBeat = 1.0;
      this.beatPulse = 1.0;
      this.lastBeatBass = bass;
      this.extraRotation += bass * 1.5;
      this.beatRotation += 0.28 + bass * 0.45;
    }

    this.historyBass = Math.max(0.4, this.historyBass - 0.015);

    const interval = 60 / this.estimatedBPM;
    if (this.lastBeatTime > 0) {
      this.beatPhase = Math.min(1, (time - this.lastBeatTime) / interval);
      // Onda triangular: pico en el downbeat, valle entre kicks
      this.rhythmWave = 1.0 - Math.abs(this.beatPhase * 2.0 - 1.0);

      if (this.beatPhase > 0.82 && bass > 0.35 && bass > this.historyBass * 0.9) {
        this.anticipatedBeat = Math.max(this.anticipatedBeat, 0.35 * (this.beatPhase - 0.82) / 0.18);
      }
    } else {
      this.beatPhase = 0;
      this.rhythmWave = 0;
    }

    // Decaimiento del pulso sincronizado al BPM (~35% del intervalo de beat)
    const pulseDecay = Math.pow(0.001, deltaTime / (interval * 0.35));
    this.beatPulse *= pulseDecay;
    if (this.beatPulse < 0.001) this.beatPulse = 0;

    this.currentBeat = Math.max(this.currentBeat, this.beatPulse, this.anticipatedBeat);
    this.currentBeat *= Math.pow(0.05, deltaTime * this.estimatedBPM / 30);
    this.anticipatedBeat *= 0.7;

    if (this.currentBeat < 0.01) this.currentBeat = 0;
    if (this.anticipatedBeat < 0.01) this.anticipatedBeat = 0;

    this.extraRotation *= 0.92;
    this.beatRotation *= 0.9;

    // Hi-hat / offbeat micro-pulso en agudos
    const offbeatPulse = trebleDelta > 0.04 ? trebleDelta * 2.5 : 0;

    return {
      isBeat,
      currentBeat: this.currentBeat,
      beatPhase: this.beatPhase,
      beatPulse: this.beatPulse,
      rhythmWave: this.rhythmWave,
      anticipatedBeat: this.anticipatedBeat,
      trebleDelta,
      offbeatPulse,
      estimatedBPM: this.estimatedBPM,
      extraRotation: this.extraRotation,
      beatRotation: this.beatRotation,
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
