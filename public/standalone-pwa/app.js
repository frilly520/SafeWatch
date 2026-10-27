(() => {
  // ============================================================================
  // DOM ELEMENT REFERENCES (With resilient selector fallbacks for existing UI)
  // ============================================================================
  const videoEl = document.getElementById('camera-stream') || document.querySelector('video');
  const ipImgEl = document.getElementById('ip-stream-view') || createDynamicStreamImage();
  const canvasEl = document.getElementById('capture-canvas') || document.querySelector('canvas');
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

  // Dynamic UI Field & Connect Button selectors
  const ipInputEl =
    document.getElementById('camera-ip-input') ||
    document.getElementById('ip-input') ||
    document.querySelector('input[type="text"]');
  const connectIpBtn =
    document.getElementById('connect-ip-btn') ||
    document.getElementById('connect-btn');

  // ============================================================================
  // STATE & MEMORY POINTERS
  // ============================================================================
  const STORAGE_KEY = 'safewatch_zion_camera_ip';
  const DEFAULT_ZION_IP = '192.168.43.244';

  let currentStream = null;             // Active WebRTC MediaStream (when in local camera mode)
  let currentFacingMode = 'environment'; // 'environment' (rear) or 'user' (front)
  let activeMode = 'local';             // 'local' (WebRTC) or 'ip' (Z-Ion binary fetch loop)

  let isIpStreaming = false;            // Controls the async fetch() binary frame loop
  let ipAbortController = null;         // Cancels in-flight fetch requests cleanly on disconnect
  let activeObjectUrl = null;           // Holds current blob: URL pointer so we can revoke it
  let lastCapturedDataUrl = null;       // Holds the latest PNG Data URL for gallery downloads
  let deferredInstallPrompt = null;     // Stores Android/Chrome beforeinstallprompt event

  /**
   * Dynamically creates the <img> viewport element if the existing HTML
   * only has a <video> tag, ensuring zero-config compatibility.
   */
  function createDynamicStreamImage() {
    const img = document.createElement('img');
    img.id = 'ip-stream-view';
    img.alt = 'Z-Ion IP Camera Stream';
    img.crossOrigin = 'anonymous';
    img.hidden = true;
    img.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1;background:#07080c;';
    if (videoEl && videoEl.parentElement) {
      videoEl.parentElement.insertBefore(img, videoEl.nextSibling);
    } else {
      document.body.appendChild(img);
    }
    return img;
  }

  function setStatus(message) {
    if (statusToast) {
      statusToast.textContent = message;
    }
  }

  // ============================================================================
  // 1. AUTO-SAVE FALLBACK (window.localStorage) & DYNAMIC UI FIELD CONNECTION
  // ============================================================================
  function initIpPersistence() {
    const savedIp = window.localStorage.getItem(STORAGE_KEY) || DEFAULT_ZION_IP;
    if (ipInputEl) {
      ipInputEl.value = savedIp;

      // Auto-save whenever the user types or edits the IP input box
      ipInputEl.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (val) {
          window.localStorage.setItem(STORAGE_KEY, val);
        }
      });

      // Allow pressing "Enter" inside the IP input field to trigger Connect
      ipInputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleConnectClick();
        }
      });
    }

    if (connectIpBtn) {
      connectIpBtn.addEventListener('click', handleConnectClick);
    }
  }

  /**
   * Normalizes user input (e.g., "192.168.43.244", "192.168.43.244:8080", or full URL)
   * into candidate Z-Ion / MJPEG / snapshot HTTP endpoints.
   */
  function buildZionStreamEndpoints(rawInput) {
    const cleaned = (rawInput || DEFAULT_ZION_IP).trim();
    window.localStorage.setItem(STORAGE_KEY, cleaned);

    // If the user typed a complete path (e.g., http://192.168.43.244/shot.jpg), respect it
    if (/^https?:\/\/.+\/.+/i.test(cleaned)) {
      return [cleaned];
    }

    // Strip protocol and trailing slashes to isolate host[:port]
    const hostPort = cleaned.replace(/^https?:\/\//i, '').replace(/\/+$/, '');

    // Standard Z-Ion / X5 / IP Webcam snapshot & stream endpoints in priority order
    return [
      `http://${hostPort}/shot.jpg`,
      `http://${hostPort}:8080/shot.jpg`,
      `http://${hostPort}/capture`,
      `http://${hostPort}/stream`,
      `http://${hostPort}:81/stream`,
      `http://${hostPort}/video`,
    ];
  }

  function handleConnectClick() {
    const rawIp = ipInputEl ? ipInputEl.value.trim() : DEFAULT_ZION_IP;
    if (!rawIp) {
      setStatus('ENTER VALID Z-ION CAMERA IP (E.G. 192.168.43.244)');
      return;
    }

    // Persist to localStorage immediately
    window.localStorage.setItem(STORAGE_KEY, rawIp);
    startZionIpBinaryLoop(rawIp);
  }

  // ============================================================================
  // 2 & 3. DEFEATING MIXED CONTENT BLOCKS + OBJECT URL MEMORY MANAGEMENT
  // ============================================================================
  /**
   * Releases the previous `blob:` Object URL from browser memory to prevent
   * RAM exhaustion and mobile browser crashes on Samsung S21 / iPhone.
   */
  function revokePreviousFrameUrl() {
    if (activeObjectUrl) {
      URL.revokeObjectURL(activeObjectUrl);
      activeObjectUrl = null;
    }
  }

  function stopZionIpBinaryLoop() {
    isIpStreaming = false;
    if (ipAbortController) {
      ipAbortController.abort();
      ipAbortController = null;
    }
    revokePreviousFrameUrl();
  }

  /**
   * Connects to the Z-Ion camera IP using an asynchronous `fetch()` binary loop
   * (with Multipart MJPEG stream reader + single-frame Blob fallback).
   *
   * HOW SECURE BINARY CONVERSION WORKS:
   * 1. Instead of assigning `http://192.168.43.244/...` directly to `<video src>`
   *    or `<img src>` (which triggers passive/active Mixed Content blocking in DOM tags),
   *    we pull raw bytes using `fetch()` with `cache: 'no-store'`.
   * 2. If the Z-Ion camera responds with `multipart/x-mixed-replace` (MJPEG stream),
   *    we read the raw `Uint8Array` chunks from `response.body.getReader()`, extract each
   *    JPEG frame between SOI (`0xFF 0xD8`) and EOI (`0xFF 0xD9`) markers, wrap the binary
   *    slice in `new Blob([jpegBytes], { type: 'image/jpeg' })`, and generate a local
   *    `blob:https://...` URL via `URL.createObjectURL(blob)`.
   * 3. If the camera responds with a single JPEG frame (`image/jpeg`), we convert the
   *    response directly via `await response.blob()`, create an Object URL, paint it to
   *    the viewport, and immediately revoke the previous frame's Object URL.
   */
  async function startZionIpBinaryLoop(rawIp) {
    // Stop any running WebRTC camera tracks or previous IP fetch loop
    stopCurrentStream();
    stopZionIpBinaryLoop();

    activeMode = 'ip';
    isIpStreaming = true;

    if (videoEl) videoEl.hidden = true;
    if (ipImgEl) ipImgEl.hidden = false;
    if (lensLabel) lensLabel.textContent = 'Z-ION';

    const endpoints = buildZionStreamEndpoints(rawIp);
    let endpointIndex = 0;

    setStatus(`CONNECTING TO Z-ION IP // ${rawIp}...`);

    while (isIpStreaming) {
      const targetEndpoint = endpoints[endpointIndex % endpoints.length];
      ipAbortController = new AbortController();

      try {
        // Append cache-busting timestamp so mobile browsers never serve stale frames
        const separator = targetEndpoint.includes('?') ? '&' : '?';
        const fetchUrl = `${targetEndpoint}${separator}_t=${Date.now()}`;

        const response = await fetch(fetchUrl, {
          method: 'GET',
          cache: 'no-store',
          mode: 'cors',
          signal: ipAbortController.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const contentType = (response.headers.get('content-type') || '').toLowerCase();

        // CASE A: Continuous Multipart MJPEG Stream (`multipart/x-mixed-replace`)
        if (contentType.includes('multipart') && response.body) {
          setStatus(`LIVE // Z-ION STREAM (${rawIp})`);
          await consumeMultipartMjpegReader(response.body.getReader());
        } else {
          // CASE B: Single-Frame Binary Snapshot (`image/jpeg` / `application/octet-stream`)
          const frameBlob = await response.blob();
          if (frameBlob && frameBlob.size > 0) {
            renderBlobFrameWithCleanup(frameBlob);
            setStatus(`LIVE // Z-ION BINARY LOOP (${rawIp})`);
          }
          // Pace next frame request (~25 FPS max) to avoid flooding local Wi-Fi AP
          await new Promise((resolve) => setTimeout(resolve, 40));
        }
      } catch (err) {
        if (!isIpStreaming) break; // Intentional disconnect

        // Rotate through candidate Z-Ion endpoints if one port/path fails
        endpointIndex++;
        setStatus(`RETRYING Z-ION (${rawIp}) // CHECK P2P WI-FI & CORS...`);
        await new Promise((resolve) => setTimeout(resolve, 900));
      }
    }
  }

  /**
   * Converts a raw binary Blob into a secure `blob:` Object URL, assigns it to the
   * viewport display element, and immediately revokes the previous Object URL pointer.
   */
  function renderBlobFrameWithCleanup(frameBlob) {
    // 1. Create a new local in-memory Object URL (`blob:https://...`) from the binary chunk
    const nextObjectUrl = URL.createObjectURL(frameBlob);

    // 2. Keep a reference to the old Object URL so we can free its memory
    const previousObjectUrl = activeObjectUrl;
    activeObjectUrl = nextObjectUrl;

    // 3. Update the viewport display element's src
    if (ipImgEl) {
      ipImgEl.onload = () => {
        // 4. Revoke the previous Object URL pointer right after the new frame decodes
        if (previousObjectUrl) {
          URL.revokeObjectURL(previousObjectUrl);
        }
      };
      ipImgEl.src = nextObjectUrl;
    } else if (previousObjectUrl) {
      URL.revokeObjectURL(previousObjectUrl);
    }
  }

  /**
   * Reads a continuous MJPEG stream (`multipart/x-mixed-replace`) chunk-by-chunk,
   * isolates each raw JPEG binary frame (`0xFF 0xD8` ... `0xFF 0xD9`), converts it
   * to a `Blob`, and updates the viewport with strict `URL.revokeObjectURL()` cleanup.
   */
  async function consumeMultipartMjpegReader(reader) {
    let buffer = new Uint8Array(0);

    try {
      while (isIpStreaming) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value || value.length === 0) continue;

        // Append incoming binary chunk to rolling buffer
        const combined = new Uint8Array(buffer.length + value.length);
        combined.set(buffer, 0);
        combined.set(value, buffer.length);
        buffer = combined;

        // Locate JPEG Start-Of-Image (0xFF 0xD8) and End-Of-Image (0xFF 0xD9)
        let soiIndex = -1;
        let eoiIndex = -1;

        for (let i = 0; i < buffer.length - 1; i++) {
          if (buffer[i] === 0xff && buffer[i + 1] === 0xd8) {
            soiIndex = i;
            break;
          }
        }

        if (soiIndex !== -1) {
          for (let j = soiIndex + 2; j < buffer.length - 1; j++) {
            if (buffer[j] === 0xff && buffer[j + 1] === 0xd9) {
              eoiIndex = j + 2;
              break;
            }
          }
        }

        // If a complete JPEG frame is in the buffer, slice it into a Blob and render
        if (soiIndex !== -1 && eoiIndex !== -1) {
          const jpegBytes = buffer.slice(soiIndex, eoiIndex);
          buffer = buffer.slice(eoiIndex); // Keep remaining bytes for next frame

          const frameBlob = new Blob([jpegBytes], { type: 'image/jpeg' });
          renderBlobFrameWithCleanup(frameBlob);
        } else if (buffer.length > 2 * 1024 * 1024) {
          // Safety cap: flush buffer if malformed stream exceeds 2MB without EOI
          buffer = new Uint8Array(0);
        }
      }
    } finally {
      try {
        reader.releaseLock();
      } catch (_) {
        // Ignore reader lock release errors
      }
    }
  }

  // ============================================================================
  // 4. WEBRTC DEVICE CAMERA STREAMING (Front / Rear Lens Toggle)
  // ============================================================================
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

  async function startCamera(facingMode) {
    // Stop Z-Ion IP fetch loop if switching back to local hardware camera
    stopZionIpBinaryLoop();
    stopCurrentStream();

    activeMode = 'local';
    if (ipImgEl) ipImgEl.hidden = true;
    if (videoEl) videoEl.hidden = false;

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
      if (videoEl) {
        videoEl.srcObject = stream;
        videoEl.classList.toggle('mirrored', facingMode === 'user');
        await videoEl.play();
      }
      if (lensLabel) {
        lensLabel.textContent = facingMode === 'user' ? 'FRONT' : 'REAR';
      }
      setStatus(`LIVE // ${facingMode === 'user' ? 'FRONT' : 'REAR'} LENS ACTIVE`);
    } catch (err) {
      console.error('Camera access error:', err);
      setStatus('CAMERA PERMISSION REQUIRED OR ENTER Z-ION IP ABOVE');
    }
  }

  if (flipBtn) {
    flipBtn.addEventListener('click', () => {
      // If currently viewing Z-Ion IP stream, clicking Flip returns to device camera;
      // otherwise it alternates between Front ('user') and Rear ('environment').
      if (activeMode === 'ip') {
        startCamera(currentFacingMode);
        return;
      }
      currentFacingMode =
        currentFacingMode === 'environment' ? 'user' : 'environment';
      startCamera(currentFacingMode);
    });
  }

  // ============================================================================
  // 5. SHUTTER / CAPTURE PIPELINE (Freezes active IP Blob or WebRTC Video Frame)
  // ============================================================================
  if (shutterBtn) {
    shutterBtn.addEventListener('click', () => {
      if (!canvasEl) return;
      const ctx = canvasEl.getContext('2d');
      if (!ctx) return;

      // Branch 1: Capture active Z-Ion IP Blob Frame from <img> viewport
      if (activeMode === 'ip' && ipImgEl && !ipImgEl.hidden && ipImgEl.naturalWidth > 0) {
        const width = ipImgEl.naturalWidth;
        const height = ipImgEl.naturalHeight;
        canvasEl.width = width;
        canvasEl.height = height;
        ctx.drawImage(ipImgEl, 0, 0, width, height);
      }
      // Branch 2: Capture active WebRTC Camera Frame from <video> viewport
      else if (currentStream && videoEl && videoEl.videoWidth > 0) {
        const width = videoEl.videoWidth;
        const height = videoEl.videoHeight;
        canvasEl.width = width;
        canvasEl.height = height;

        if (currentFacingMode === 'user') {
          ctx.save();
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(videoEl, 0, 0, width, height);
          ctx.restore();
        } else {
          ctx.drawImage(videoEl, 0, 0, width, height);
        }
      } else {
        setStatus('WAIT FOR ACTIVE CAMERA OR Z-ION STREAM...');
        return;
      }

      // Freeze frame buffer into PNG Data URL & update Gallery Preview
      lastCapturedDataUrl = canvasEl.toDataURL('image/png');

      if (galleryImg) {
        galleryImg.src = lastCapturedDataUrl;
        galleryImg.hidden = false;
      }
      if (galleryPlaceholder) {
        galleryPlaceholder.hidden = true;
      }
      if (galleryBtn) {
        galleryBtn.disabled = false;
      }

      // Trigger visual shutter flash
      if (flashEl) {
        flashEl.classList.add('active');
        window.setTimeout(() => {
          flashEl.classList.remove('active');
        }, 150);
      }

      setStatus('FRAME CAPTURED // TAP THUMBNAIL TO DOWNLOAD');
    });
  }

  // Gallery Thumbnail Click: Physical Device Download
  if (galleryBtn) {
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
  }

  // ============================================================================
  // 6. PWA SERVICE WORKER & SMART INSTALL SHORTCUT LOGIC (Android & iOS)
  // ============================================================================
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service Worker registration warning:', err);
      });
    });
  }

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
    if (!installBtn) return;
    if (isRunningStandalone()) {
      installBtn.hidden = true;
      if (iosModal) iosModal.hidden = true;
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

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallButtonVisibility();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    if (installBtn) installBtn.hidden = true;
    if (iosModal) iosModal.hidden = true;
    setStatus('APP INSTALLED // RUNNING STANDALONE');
  });

  const standaloneQuery = window.matchMedia('(display-mode: standalone)');
  if (standaloneQuery.addEventListener) {
    standaloneQuery.addEventListener('change', updateInstallButtonVisibility);
  }

  if (installBtn) {
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
      if (isIOSDevice() && iosModal) {
        iosModal.hidden = false;
      }
    });
  }

  if (iosModalClose && iosModal) {
    iosModalClose.addEventListener('click', () => {
      iosModal.hidden = true;
    });
    iosModal.addEventListener('click', (event) => {
      if (event.target === iosModal) {
        iosModal.hidden = true;
      }
    });
  }

  // Clean up any allocated Object URLs when the page unloads
  window.addEventListener('beforeunload', () => {
    stopZionIpBinaryLoop();
    stopCurrentStream();
  });

  // ============================================================================
  // INITIALIZE ON STARTUP
  // ============================================================================
  initIpPersistence();
  updateInstallButtonVisibility();
  startCamera(currentFacingMode);
})();
