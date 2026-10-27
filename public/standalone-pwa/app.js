(() => {
  const videoEl = document.getElementById('camera-stream');
  const canvasEl = document.getElementById('capture-canvas');
  const flashEl = document.getElementById('shutter-flash');
  const shutterBtn = document.getElementById('shutter-btn');
  const flipBtn = document.getElementById('flip-btn');
  const lensLabel = document.getElementById('lens-label');
  const galleryBtn = document.getElementById('gallery-btn');
  const galleryImg = document.getElementById('gallery-img');
  const galleryPlaceholder = document.getElementById('gallery-placeholder');
  const statusToast = document.getElementById('status-toast');
  const installBtn = document.getElementById('install-btn');
  const iosModal = document.getElementById('ios-modal');
  const iosModalClose = document.getElementById('ios-modal-close');

  let currentStream = null;
  let currentFacingMode = 'environment'; // 'environment' (rear) or 'user' (front)
  let lastCapturedDataUrl = null;
  let deferredInstallPrompt = null;

  // 1. Register Service Worker for Chrome PWA Installability
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service Worker registration warning:', err);
      });
    });
  }

  // 2. Detect Standalone Mode & Platform (Android Chrome vs iOS Safari)
  function isRunningStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  }

  function isIOSDevice() {
    const ua = window.navigator.userAgent.toLowerCase();
    const isIPhoneIPad = /iphone|ipad|ipod/.test(ua);
    const isIPadOS =
      navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return isIPhoneIPad || isIPadOS;
  }

  function updateInstallButtonVisibility() {
    // Permanently hide install button when running inside standalone mode
    if (isRunningStandalone()) {
      installBtn.hidden = true;
      iosModal.hidden = true;
      return;
    }

    if (deferredInstallPrompt) {
      installBtn.textContent = 'Install Web App';
      installBtn.hidden = false;
    } else if (isIOSDevice()) {
      installBtn.textContent = '+ Add to Shortcut';
      installBtn.hidden = false;
    }
  }

  // Intercept Android / Chrome native beforeinstallprompt
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallButtonVisibility();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    installBtn.hidden = true;
    iosModal.hidden = true;
    setStatus('APP INSTALLED // RUNNING STANDALONE');
  });

  // Listen for display-mode changes
  const standaloneQuery = window.matchMedia('(display-mode: standalone)');
  if (standaloneQuery.addEventListener) {
    standaloneQuery.addEventListener('change', updateInstallButtonVisibility);
  }

  installBtn.addEventListener('click', async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        deferredInstallPrompt = null;
        installBtn.hidden = true;
      }
      return;
    }
    if (isIOSDevice()) {
      iosModal.hidden = false;
    }
  });

  iosModalClose.addEventListener('click', () => {
    iosModal.hidden = true;
  });

  iosModal.addEventListener('click', (event) => {
    if (event.target === iosModal) {
      iosModal.hidden = true;
    }
  });

  // 3. Media Capture API: Stop existing tracks before starting a new stream
  function stopCurrentStream() {
    if (currentStream) {
      currentStream.getTracks().forEach((track) => {
        track.stop();
      });
      currentStream = null;
    }
    if (videoEl) {
      videoEl.srcObject = null;
    }
  }

  function setStatus(message) {
    if (statusToast) {
      statusToast.textContent = message;
    }
  }

  async function startCamera(facingMode) {
    stopCurrentStream();
    setStatus(`LOCKING ${facingMode === 'user' ? 'FRONT' : 'REAR'} LENS...`);

    const constraints = {
      audio: false,
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      currentStream = stream;
      videoEl.srcObject = stream;
      videoEl.classList.toggle('mirrored', facingMode === 'user');
      lensLabel.textContent = facingMode === 'user' ? 'FRONT' : 'REAR';
      await videoEl.play();
      setStatus(`LIVE // ${facingMode === 'user' ? 'FRONT' : 'REAR'} LENS ACTIVE`);
    } catch (err) {
      console.error('Camera access error:', err);
      setStatus('CAMERA PERMISSION REQUIRED OR NO LENS FOUND');
    }
  }

  // Flip Camera Handler (Front <-> Rear)
  flipBtn.addEventListener('click', () => {
    currentFacingMode =
      currentFacingMode === 'environment' ? 'user' : 'environment';
    startCamera(currentFacingMode);
  });

  // 4. Shutter Button: Capture High-Resolution Frame to Hidden Canvas
  shutterBtn.addEventListener('click', () => {
    if (!currentStream || !videoEl.videoWidth) {
      setStatus('WAIT FOR CAMERA STREAM...');
      return;
    }

    const width = videoEl.videoWidth;
    const height = videoEl.videoHeight;
    canvasEl.width = width;
    canvasEl.height = height;

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    if (currentFacingMode === 'user') {
      ctx.save();
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoEl, 0, 0, width, height);
      ctx.restore();
    } else {
      ctx.drawImage(videoEl, 0, 0, width, height);
    }

    lastCapturedDataUrl = canvasEl.toDataURL('image/png');

    // Update circular gallery thumbnail preview
    galleryImg.src = lastCapturedDataUrl;
    galleryImg.hidden = false;
    galleryPlaceholder.hidden = true;
    galleryBtn.disabled = false;

    // Trigger visual shutter flash
    flashEl.classList.add('active');
    window.setTimeout(() => {
      flashEl.classList.remove('active');
    }, 150);

    setStatus('FRAME CAPTURED // TAP THUMBNAIL TO DOWNLOAD');
  });

  // 5. Gallery Thumbnail Click: Download Last Photo Locally
  galleryBtn.addEventListener('click', () => {
    if (!lastCapturedDataUrl) return;
    const link = document.createElement('a');
    link.href = lastCapturedDataUrl;
    link.download = `safewatch-photo-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setStatus('PHOTO DOWNLOADED TO DEVICE');
  });

  // Initialize on startup
  updateInstallButtonVisibility();
  startCamera(currentFacingMode);
})();
