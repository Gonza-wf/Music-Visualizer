import { getDefaultPreset } from './settings.js';

export const PLAY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
export const PAUSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';

function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function initUI({ audio, visualizer, settingsManager, onSettingsChange, onPlaylistChange }) {
  const uiContainer = document.getElementById('ui-container');
  const btnPlay = document.getElementById('btn-play');
  const btnNext = document.getElementById('btn-next');
  const btnPrev = document.getElementById('btn-prev');
  const trackNameEl = document.getElementById('track-name');
  const uploadInput = document.getElementById('audio-upload');
  const playlistEl = document.getElementById('playlist');
  const progressBar = document.getElementById('progress-bar');
  const currentTimeEl = document.getElementById('current-time');
  const totalTimeEl = document.getElementById('total-time');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const mobilePlaylistBtn = document.getElementById('mobile-playlist-btn');
  const mobileSettingsBtn = document.getElementById('mobile-settings-btn');
  const closePlaylistBtn = document.getElementById('close-playlist-btn');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const sidebar = document.getElementById('sidebar');
  const settingsSidebar = document.getElementById('settings-sidebar');
  const toggleStrobe = document.getElementById('toggle-strobe');
  const toggleBwMode = document.getElementById('toggle-bw-mode');
  const sliderFlash = document.getElementById('slider-flash');
  const sliderBass = document.getElementById('slider-bass');
  const sliderGlow = document.getElementById('slider-glow');
  const sliderCam = document.getElementById('slider-cam');
  const valFlash = document.getElementById('val-flash');
  const valBass = document.getElementById('val-bass');
  const valGlow = document.getElementById('val-glow');
  const valCam = document.getElementById('val-cam');
  const trackCountEl = document.getElementById('track-count');
  const btnShuffle = document.getElementById('btn-shuffle');
  const btnClearPlaylist = document.getElementById('btn-clear-playlist');
  const btnResetSettings = document.getElementById('btn-reset-settings');

  const presetBtns = {
    low: document.getElementById('preset-low'),
    mid: document.getElementById('preset-mid'),
    high: document.getElementById('preset-high'),
    ultra: document.getElementById('preset-ultra')
  };

  let isSeeking = false;
  let dragFromIndex = null;
  let idleTimeout;

  const persistSettings = debounce(() => {
    onSettingsChange?.(settingsManager.toJSON());
  }, 300);

  const persistPlaylist = debounce(() => {
    onPlaylistChange?.(audio.getTracks());
  }, 500);

  function syncSettingsToDOM() {
    const s = settingsManager.get();
    toggleStrobe.checked = s.isStrobeEnabled;
    toggleBwMode.checked = s.isBlackAndWhite;
    sliderFlash.value = s.flashDecay;
    sliderBass.value = s.bassSensMult;
    sliderGlow.value = s.glowStrength;
    sliderCam.value = s.cameraSpeedMult;
    valFlash.textContent = s.flashDecay.toFixed(2);
    valBass.textContent = s.bassSensMult.toFixed(1);
    valGlow.textContent = s.glowStrength.toFixed(2);
    valCam.textContent = s.cameraSpeedMult.toFixed(1);
    Object.entries(presetBtns).forEach(([key, btn]) => {
      btn.classList.toggle('active', key === s.preset);
    });
  }

  function applyPreset(name) {
    visualizer.applyPreset(name);
    Object.entries(presetBtns).forEach(([key, btn]) => {
      btn.classList.toggle('active', key === name);
    });
    persistSettings();
  }

  function resetIdleTimer() {
    uiContainer.classList.remove('hidden');
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => {
      if (audio.getIsPlaying()) uiContainer.classList.add('hidden');
    }, 3000);
  }

  function renderPlaylist() {
    const tracks = audio.getTracks();
    const currentTrackIndex = audio.getCurrentIndex();

    playlistEl.innerHTML = '';
    if (tracks.length === 0) {
      playlistEl.innerHTML = '<li class="empty-state">Playlist empty</li>';
      trackCountEl.textContent = '0 tracks';
      return;
    }

    trackCountEl.textContent = `${tracks.length} track${tracks.length !== 1 ? 's' : ''}`;

    tracks.forEach((file, index) => {
      const li = document.createElement('li');
      li.draggable = true;

      const numSpan = document.createElement('span');
      numSpan.className = 'track-number';
      numSpan.textContent = `${index + 1}`;
      li.appendChild(numSpan);

      const nameSpan = document.createElement('span');
      nameSpan.className = 'track-name-text';
      nameSpan.textContent = file.name.replace(/\.[^/.]+$/, '');
      li.appendChild(nameSpan);

      const delBtn = document.createElement('button');
      delBtn.className = 'track-delete-btn';
      delBtn.innerHTML = '&times;';
      delBtn.title = 'Eliminar';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        audio.removeTrack(index);
        renderPlaylist();
        persistPlaylist();
      });
      li.appendChild(delBtn);

      li.addEventListener('click', () => {
        audio.initAudio();
        audio.loadTrack(index);
      });

      if (index === currentTrackIndex) li.classList.add('active');

      li.addEventListener('dragstart', (e) => {
        dragFromIndex = index;
        li.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      li.addEventListener('dragend', () => {
        li.classList.remove('dragging');
        dragFromIndex = null;
      });
      li.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        li.classList.add('drag-over');
      });
      li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
      li.addEventListener('drop', (e) => {
        e.preventDefault();
        li.classList.remove('drag-over');
        if (dragFromIndex !== null && dragFromIndex !== index) {
          audio.reorderTrack(dragFromIndex, index);
          renderPlaylist();
          persistPlaylist();
        }
      });

      playlistEl.appendChild(li);
    });
  }

  function closePlaylist(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    sidebar.classList.remove('open');
    mobilePlaylistBtn.style.display = '';
  }

  function closeSettings(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    settingsSidebar.classList.remove('open');
    mobileSettingsBtn.style.display = '';
  }

  // --- Settings listeners ---
  toggleStrobe.addEventListener('change', () => {
    settingsManager.set('isStrobeEnabled', toggleStrobe.checked);
    persistSettings();
  });

  toggleBwMode.addEventListener('change', () => {
    settingsManager.set('isBlackAndWhite', toggleBwMode.checked);
    persistSettings();
  });

  sliderFlash.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    settingsManager.set('flashDecay', val);
    valFlash.textContent = val.toFixed(2);
    persistSettings();
  });

  sliderBass.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    settingsManager.set('bassSensMult', val);
    valBass.textContent = val.toFixed(1);
    persistSettings();
  });

  sliderGlow.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    settingsManager.set('glowStrength', val);
    valGlow.textContent = val.toFixed(2);
    persistSettings();
  });

  sliderCam.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    settingsManager.set('cameraSpeedMult', val);
    valCam.textContent = val.toFixed(1);
    persistSettings();
  });

  Object.entries(presetBtns).forEach(([key, btn]) => {
    btn.addEventListener('click', () => applyPreset(key));
  });

  btnResetSettings.addEventListener('click', () => {
    settingsManager.reset();
    syncSettingsToDOM();
    applyPreset(getDefaultPreset());
    persistSettings();
  });

  // --- Playback controls ---
  btnPlay.addEventListener('click', () => {
    const result = audio.togglePlay();
    if (result === 'empty') {
      uploadInput.click();
      return;
    }
    btnPlay.innerHTML = result ? PAUSE_ICON : PLAY_ICON;
    resetIdleTimer();
  });

  btnNext.addEventListener('click', () => {
    if (audio.getTracks().length > 0) audio.next();
  });

  btnPrev.addEventListener('click', () => {
    if (audio.getTracks().length > 0) audio.prev();
  });

  uploadInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const existingNames = audio.getTracks().map((t) => t.name);
    const duplicates = files.filter((f) => existingNames.includes(f.name));
    const newFiles = files.filter((f) => !existingNames.includes(f.name));

    if (duplicates.length > 0) {
      const dupeNames = duplicates.map((f) => f.name.replace(/\.[^/.]+$/, '')).join(', ');
      const addAnyway = confirm(`⚠️ Estas canciones ya están en la playlist:\n\n${dupeNames}\n\n¿Quieres duplicarlas?`);
      if (addAnyway) newFiles.push(...duplicates);
    }

    if (newFiles.length === 0) { uploadInput.value = ''; return; }

    const wasEmpty = audio.getTracks().length === 0;
    audio.addTracks(newFiles);
    renderPlaylist();
    persistPlaylist();

    if (wasEmpty) {
      audio.initAudio();
      audio.loadTrack(0);
    }

    uploadInput.value = '';
  });

  progressBar.addEventListener('input', () => {
    isSeeking = true;
    currentTimeEl.textContent = formatTime(progressBar.value);
  });

  progressBar.addEventListener('change', () => {
    audio.seek(progressBar.value);
    isSeeking = false;
  });

  btnShuffle.addEventListener('click', () => {
    audio.shufflePlaylist();
    renderPlaylist();
    persistPlaylist();
  });

  btnClearPlaylist.addEventListener('click', async () => {
    if (audio.getTracks().length === 0) return;
    if (!confirm('¿Limpiar toda la playlist?')) return;
    audio.clearPlaylist();
    renderPlaylist();
    persistPlaylist();
  });

  // --- Sidebar & idle ---
  btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.log(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  });

  mobilePlaylistBtn.addEventListener('click', () => {
    sidebar.classList.add('open');
    mobilePlaylistBtn.style.display = 'none';
  });

  mobileSettingsBtn.addEventListener('click', () => {
    settingsSidebar.classList.add('open');
    mobileSettingsBtn.style.display = 'none';
  });

  closePlaylistBtn.addEventListener('click', closePlaylist);
  closePlaylistBtn.addEventListener('touchstart', closePlaylist, { passive: false });
  closeSettingsBtn.addEventListener('click', closeSettings);
  closeSettingsBtn.addEventListener('touchstart', closeSettings, { passive: false });

  document.getElementById('canvas-container').addEventListener('click', () => {
    sidebar.classList.remove('open');
    settingsSidebar.classList.remove('open');
    mobilePlaylistBtn.style.display = '';
    mobileSettingsBtn.style.display = '';
  });

  ['mousemove', 'mousedown', 'keydown', 'touchstart'].forEach((evt) => {
    document.addEventListener(evt, resetIdleTimer);
  });

  // --- Audio callbacks ---
  audio.on('error', () => {
    alert('Error al cargar la canción.');
    audio.setIsPlaying(false);
    btnPlay.innerHTML = PLAY_ICON;
  });

  audio.on('trackchange', ({ name, isPlaying }) => {
    trackNameEl.textContent = name;
    btnPlay.innerHTML = isPlaying ? PAUSE_ICON : PLAY_ICON;
    renderPlaylist();
    resetIdleTimer();
  });

  audio.on('loadedmetadata', (duration) => {
    totalTimeEl.textContent = formatTime(duration);
    progressBar.max = duration;
  });

  audio.on('timeupdate', (currentTime) => {
    if (!isSeeking) {
      progressBar.value = currentTime;
      currentTimeEl.textContent = formatTime(currentTime);
    }
  });

  audio.on('playlistchange', () => renderPlaylist());

  syncSettingsToDOM();
  resetIdleTimer();

  return { renderPlaylist, syncSettingsToDOM, applyPreset };
}
