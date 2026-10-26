import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Eye,
  Film,
  Moon,
  Sun,
  Play,
  RefreshCw,
  ShieldAlert,
  Siren,
  StopCircle,
  Trash2,
  Volume2,
  VolumeX,
  Download,
  Loader2,
} from 'lucide-react';
import {
  type LocalClip,
  readLocalClips,
  saveLocalClip,
  removeLocalClip,
} from '../lib/localClipDb';
import type { WatchmanIncident } from '../types/camera';

interface OldPhoneTransmitterViewProps {
  wsRef: React.MutableRefObject<WebSocket | null>;
  onIncidentCreated: (incident: WatchmanIncident) => void;
}

export const OldPhoneTransmitterView: React.FC<OldPhoneTransmitterViewProps> = ({
  wsRef,
  onIncidentCreated,
}) => {
  const [nodeId] = useState(
    () => `phone_${Math.random().toString(36).slice(2, 7)}`
  );
  const [pairingCode] = useState(
    () => `${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [nodeName] = useState('Old Phone Sentry #1');
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>(
    'environment'
  );
  const [nightMode, setNightMode] = useState(false);
  const [muted, setMuted] = useState(true);
  const [dimScreen, setDimScreen] = useState(false);
  const [sensitivity, setSensitivity] = useState(62);
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [autoAiWatchman, setAutoAiWatchman] = useState(true);
  const [audioTripwire, setAudioTripwire] = useState(false);
  const [audioPayload, setAudioPayload] = useState<'siren' | 'bark' | 'chime'>(
    'siren'
  );
  const [recording, setRecording] = useState(false);
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [motionScore, setMotionScore] = useState(0);
  const [statusMessage, setStatusMessage] = useState(
    'STANDBY // Hit Dispatch Sentry to start streaming & pixel motion watch.'
  );
  const [error, setError] = useState('');
  const [localClips, setLocalClips] = useState<LocalClip[]>([]);
  const [playingClipId, setPlayingClipId] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastPixelsRef = useRef<Uint8ClampedArray | null>(null);
  const recordingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const clipUrls = useMemo(
    () =>
      new Map(
        localClips.map((clip) => [clip.id, URL.createObjectURL(clip.blob)])
      ),
    [localClips]
  );

  useEffect(() => {
    return () => {
      clipUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [clipUrls]);

  const refreshClips = useCallback(async () => {
    try {
      const saved = await readLocalClips();
      setLocalClips(saved);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void refreshClips();
  }, [refreshClips]);

  // Play deterrent sound on breach or test
  const playDeterrentSound = useCallback(
    (type: 'siren' | 'bark' | 'chime') => {
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = audioCtxRef.current || new AudioContextClass();
        audioCtxRef.current = ctx;
        void ctx.resume().then(() => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const duration = type === 'siren' ? 1.8 : type === 'bark' ? 0.9 : 0.6;
          osc.type = type === 'siren' ? 'sawtooth' : 'triangle';

          if (type === 'siren') {
            for (let i = 0; i < 6; i++) {
              osc.frequency.setValueAtTime(
                i % 2 === 0 ? 540 : 820,
                ctx.currentTime + i * 0.3
              );
            }
          } else if (type === 'bark') {
            osc.frequency.setValueAtTime(220, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(
              110,
              ctx.currentTime + 0.35
            );
          } else {
            osc.frequency.setValueAtTime(660, ctx.currentTime);
            osc.frequency.setValueAtTime(990, ctx.currentTime + 0.2);
          }

          gain.gain.setValueAtTime(0.001, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.03);
          gain.gain.exponentialRampToValueAtTime(
            0.0001,
            ctx.currentTime + duration
          );

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + duration + 0.02);
        });
      } catch {
        // ignore audio block
      }
    },
    []
  );

  // Record clip & upload to 15s H.264 AI Watchman Gateway
  const triggerMotionRecording = useCallback(
    (frameDataUrl?: string) => {
      const activeStream = streamRef.current;
      if (!activeStream || recordingRef.current) return;
      if (typeof MediaRecorder === 'undefined') return;

      recordingRef.current = true;
      setRecording(true);
      setStatusMessage(
        'MOTION TRIPPED // Cutting reel & feeding 15s H.264 AI Watchman Gateway...'
      );

      if (audioTripwire) {
        playDeterrentSound(audioPayload);
      }

      const mimeCandidates = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4',
      ];
      const mimeType =
        mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const chunks: BlobPart[] = [];

      try {
        const recorder = mimeType
          ? new MediaRecorder(activeStream, { mimeType })
          : new MediaRecorder(activeStream);

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = async () => {
          recordingRef.current = false;
          setRecording(false);
          if (!chunks.length) return;

          const blob = new Blob(chunks, {
            type: recorder.mimeType || mimeType || 'video/webm',
          });

          try {
            await saveLocalClip({
              id: Date.now(),
              cameraName: nodeName,
              createdAt: Date.now(),
              blob,
              type: blob.type,
            });
            await refreshClips();
          } catch {
            // ignore storage limit
          }

          if (autoAiWatchman) {
            setAnalyzingAi(true);
            try {
              const formData = new FormData();
              formData.append('video', blob, 'phone_motion_segment.webm');
              formData.append('cameraId', nodeId);
              formData.append('cameraName', nodeName);
              formData.append(
                'cameraModel',
                'AlfredCam Old Phone Sensor + X5 Gateway'
              );
              if (frameDataUrl) {
                formData.append('frameDataUrl', frameDataUrl);
              }
              formData.append(
                'sceneContext',
                'Live motion-triggered capture from repurposed mobile phone camera sensor.'
              );

              const res = await fetch('/api/watchman/analyze-clip', {
                method: 'POST',
                body: formData,
              });
              if (res.ok) {
                const incident: WatchmanIncident = await res.json();
                onIncidentCreated(incident);
                setStatusMessage(
                  incident.threatVerified
                    ? `THREAT FLAGGED (${incident.threatLevel}): ${incident.summary} · Cloud MP4 wiped.`
                    : `AMBIENT DISMISSED: ${incident.summary} · Cloud MP4 wiped.`
                );
              }
            } catch {
              setStatusMessage('Tape saved to local browser deck.');
            } finally {
              setAnalyzingAi(false);
            }
          } else {
            setStatusMessage('Tape saved to local browser deck.');
          }
        };

        recorder.start();
        window.setTimeout(() => {
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
        }, 6000);
      } catch {
        recordingRef.current = false;
        setRecording(false);
      }
    },
    [
      audioPayload,
      audioTripwire,
      autoAiWatchman,
      nodeId,
      nodeName,
      onIncidentCreated,
      playDeterrentSound,
      refreshClips,
    ]
  );

  // Start or stop camera stream
  const startPhoneCamera = useCallback(
    async (facing = cameraFacing) => {
      setStarting(true);
      setError('');
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }
        const media = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: true,
        });
        streamRef.current = media;
        if (videoRef.current) {
          videoRef.current.srcObject = media;
          await videoRef.current.play().catch(() => undefined);
        }
        lastPixelsRef.current = null;
        setRunning(true);
        setStatusMessage(
          `BROADCASTING LIVE AS "${nodeName}" (PAIR #${pairingCode}) // SENTRY ARMED.`
        );

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'phone_node:register',
              payload: {
                nodeId,
                name: nodeName,
                pairingCode,
                facingMode: facing,
                nightMode,
                muted,
              },
            })
          );
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Camera access was denied or no camera found.'
        );
        setRunning(false);
      } finally {
        setStarting(false);
      }
    },
    [cameraFacing, muted, nightMode, nodeId, nodeName, pairingCode, wsRef]
  );

  const stopPhoneCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setRunning(false);
    setRecording(false);
    setDimScreen(false);
    setMotionScore(0);
    setStatusMessage('SENTRY IDLE // Transmitter stopped.');
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Pixel-delta motion detection + live WebSocket frame broadcast to Viewer
  useEffect(() => {
    if (!running) return;
    let lastTrigger = 0;

    const interval = window.setInterval(() => {
      const video = videoRef.current;
      const canvas = sampleCanvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      canvas.width = 320;
      canvas.height = 180;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const current = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const prev = lastPixelsRef.current;
      let changedPixels = 0;

      if (prev && prev.length === current.length) {
        for (let i = 0; i < current.length; i += 16) {
          const delta =
            Math.abs(current[i] - prev[i]) +
            Math.abs(current[i + 1] - prev[i + 1]) +
            Math.abs(current[i + 2] - prev[i + 2]);
          if (delta > 70) changedPixels++;
        }
      }
      lastPixelsRef.current = new Uint8ClampedArray(current);

      const totalSampled = current.length / 16;
      const ratio = (changedPixels / totalSampled) * 100;
      setMotionScore(Math.min(100, Math.round(ratio * 4)));

      const threshold = Math.max(1.2, (105 - sensitivity) / 14);
      const isMotion = motionEnabled && ratio > threshold;

      const frameDataUrl = canvas.toDataURL('image/jpeg', 0.65);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'phone_node:frame',
            payload: {
              nodeId,
              frameDataUrl,
              motionActive: isMotion,
              nightMode,
              muted,
            },
          })
        );
      }

      if (isMotion && Date.now() - lastTrigger > 12000) {
        lastTrigger = Date.now();
        triggerMotionRecording(frameDataUrl);
      }
    }, 650);

    return () => window.clearInterval(interval);
  }, [
    motionEnabled,
    muted,
    nightMode,
    nodeId,
    running,
    sensitivity,
    triggerMotionRecording,
    wsRef,
  ]);

  const flipCamera = () => {
    const next = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(next);
    if (running) {
      void startPhoneCamera(next);
    }
  };

  const downloadClip = (clip: LocalClip) => {
    const url = clipUrls.get(clip.id);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `safewatch-tape-${clip.id}.webm`;
    a.click();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left 8 Cols: Live Old Phone Camera Transmitter & Controls */}
      <div className="lg:col-span-8 space-y-5">
        <div className="nyc-panel concrete-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b-2 border-[#2e3344]">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#00d2ff] tabular-nums">
                <span className="mta-bullet bg-[#00d2ff] text-[#0a0a0d]">
                  B
                </span>
                <span>ALFREDCAM BURNER PHONE TRANSMITTER</span>
                <span>·</span>
                <span className="text-[#ffd600]">PAIR CODE #{pairingCode}</span>
              </div>
              <h2 className="font-graffiti text-2xl sm:text-3xl text-[#f4f1ea] mt-1.5">
                Burner Phone Sentry Deck
              </h2>
              <p className="text-xs text-[#a0a6b8] mt-1">
                Repurpose your spare phone into a sleepless street sensor. Broadcasts live to the Multi-Cam Matrix while cutting local motion reels and running 15s H.264 Gemini Watchman checks.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {!running ? (
                <button
                  type="button"
                  disabled={starting}
                  onClick={() => void startPhoneCamera()}
                  className="nyc-btn nyc-btn-yellow px-5 py-3 min-h-[44px] text-xs whitespace-nowrap shrink-0"
                >
                  <Camera className="w-4 h-4" />
                  <span>
                    {starting ? 'Starting Sensor...' : 'Dispatch Sentry'}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopPhoneCamera}
                  className="nyc-btn nyc-btn-red px-5 py-3 min-h-[44px] text-xs whitespace-nowrap shrink-0"
                >
                  <StopCircle className="w-4 h-4" />
                  <span>Cut Transmitter</span>
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-4 nyc-panel-red px-4 py-3 text-xs text-white font-mono">
              ERROR // {error}
            </div>
          )}

          {/* Unobstructed Camera Preview Stage */}
          <div className="relative mt-4 aspect-video w-full bg-black border-2 border-[#383e52] overflow-hidden">
            <video
              ref={videoRef}
              playsInline
              muted={muted}
              className={`h-full w-full object-cover transition-all duration-200 ${
                running ? 'opacity-100' : 'opacity-20'
              } ${
                nightMode
                  ? 'brightness-125 contrast-125 saturate-50 hue-rotate-[75deg]'
                  : ''
              }`}
            />
            <canvas ref={sampleCanvasRef} className="hidden" />

            {!running && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 border-2 border-[#ffd600] bg-[#13151c] flex items-center justify-center mb-3 shadow-[4px_4px_0px_#000]">
                  <Camera className="w-8 h-8 text-[#ffd600]" />
                </div>
                <p className="font-graffiti text-xl text-[#f4f1ea]">
                  Sentry Idle — Ready To Roll
                </p>
                <p className="text-xs text-[#a0a6b8] max-w-md mt-1">
                  Hit &ldquo;Dispatch Sentry&rdquo; above to lock onto this device&apos;s camera and microphone.
                </p>
              </div>
            )}

            {/* Top HUD Overlay */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
              <div className="bg-[#0a0a0d]/90 border border-[#ffd600] px-2.5 py-1 text-xs font-mono font-bold tabular-nums text-[#f4f1ea]">
                <span className={running ? 'text-[#ffd600]' : 'text-[#a0a6b8]'}>
                  {running ? '● ON AIR' : 'STANDBY'}
                </span>
                <span className="mx-1.5">·</span>
                <span>JITTER {motionScore}%</span>
                {recording && (
                  <>
                    <span className="mx-1.5">·</span>
                    <span className="text-[#ff2a3b]">REC REEL</span>
                  </>
                )}
              </div>

              {analyzingAi && (
                <div className="bg-[#ffd600] text-[#0a0a0d] border-2 border-[#0a0a0d] px-3 py-1 text-xs font-stencil font-bold uppercase flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Watchman AI Scanning...</span>
                </div>
              )}
            </div>
          </div>

          {/* Dedicated AlfredCam-Style Per-Camera Controls */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                className={`nyc-btn px-3.5 py-2 min-h-[42px] text-xs whitespace-nowrap shrink-0 ${
                  muted ? 'nyc-btn-dark' : 'nyc-btn-blue'
                }`}
              >
                {muted ? (
                  <>
                    <VolumeX className="w-4 h-4 text-[#a0a6b8]" />
                    <span>Unmute Mic</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4" />
                    <span>Mic Live</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setNightMode((n) => !n)}
                className={`nyc-btn px-3.5 py-2 min-h-[42px] text-xs whitespace-nowrap shrink-0 ${
                  nightMode ? 'nyc-btn-purple' : 'nyc-btn-dark'
                }`}
              >
                {nightMode ? (
                  <>
                    <Moon className="w-4 h-4" />
                    <span>Night IR On</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-4 h-4 text-[#ffd600]" />
                    <span>Night Mode</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={flipCamera}
                className="nyc-btn nyc-btn-dark px-3.5 py-2 min-h-[42px] text-xs whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-4 h-4 text-[#00d2ff]" />
                <span>
                  Lens: {cameraFacing === 'environment' ? 'Rear' : 'Front'}
                </span>
              </button>

              <button
                type="button"
                disabled={!running}
                onClick={() => setDimScreen(true)}
                className="nyc-btn nyc-btn-dark px-3.5 py-2 min-h-[42px] text-xs whitespace-nowrap shrink-0"
              >
                <Eye className="w-4 h-4 text-[#ffd600]" />
                <span>Ghost Mode (Blackout)</span>
              </button>
            </div>

            <button
              type="button"
              disabled={!running || recording}
              onClick={() => {
                const snap = sampleCanvasRef.current?.toDataURL(
                  'image/jpeg',
                  0.8
                );
                triggerMotionRecording(snap);
              }}
              className="nyc-btn nyc-btn-yellow px-4 py-2 min-h-[42px] text-xs whitespace-nowrap shrink-0"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Cut 15s AI Watchman Reel</span>
            </button>
          </div>

          <div className="mt-4 bg-[#0a0a0d] border-2 border-[#2e3344] px-3.5 py-2.5 text-xs font-mono text-[#ffd600]">
            &gt; {statusMessage}
          </div>
        </div>

        {/* Calibration & Audio Deterrent Panel */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="nyc-panel concrete-surface p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#2e3344] pb-2">
              <span className="font-stencil text-sm font-bold uppercase text-[#f4f1ea]">
                Jitter-Sense Motion Calibration
              </span>
              <span className="text-xs font-mono font-bold text-[#ffd600] tabular-nums">
                {sensitivity}%
              </span>
            </div>
            <input
              type="range"
              min={15}
              max={95}
              value={sensitivity}
              onChange={(e) => setSensitivity(Number(e.target.value))}
              className="w-full nyc-slider"
            />
            <p className="text-[11px] text-[#a0a6b8]">
              Higher sensitivity catches pacing and tool-shed lurking. Lower filters out stray alley cats.
            </p>
            <div className="space-y-2 pt-1">
              <label className="flex items-center justify-between text-xs font-medium text-[#f4f1ea] cursor-pointer">
                <span>Auto-Cut Reel on Pixel Motion</span>
                <input
                  type="checkbox"
                  checked={motionEnabled}
                  onChange={(e) => setMotionEnabled(e.target.checked)}
                  className="accent-[#ffd600] w-4 h-4"
                />
              </label>
              <label className="flex items-center justify-between text-xs font-medium text-[#f4f1ea] cursor-pointer">
                <span>
                  Pipe Reels to Gemini 2.5 Flash + Cloud Auto-Wipe
                </span>
                <input
                  type="checkbox"
                  checked={autoAiWatchman}
                  onChange={(e) => setAutoAiWatchman(e.target.checked)}
                  className="accent-[#ffd600] w-4 h-4"
                />
              </label>
            </div>
          </div>

          <div className="nyc-panel concrete-surface p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#2e3344] pb-2">
              <span className="font-stencil text-sm font-bold uppercase text-[#f4f1ea]">
                Automated Audio Tripwire Matrix
              </span>
              <button
                type="button"
                onClick={() => playDeterrentSound(audioPayload)}
                className="nyc-btn nyc-btn-red px-2.5 py-1 text-xs"
              >
                <Siren className="w-3.5 h-3.5" />
                <span>Blast Test</span>
              </button>
            </div>
            <div>
              <label className="block font-stencil text-xs font-bold uppercase text-[#a0a6b8] mb-1">
                Speaker Deterrent Payload
              </label>
              <select
                value={audioPayload}
                onChange={(e) =>
                  setAudioPayload(e.target.value as 'siren' | 'bark' | 'chime')
                }
                className="w-full nyc-input font-semibold"
              >
                <option value="siren">Megaphone Siren Blasts</option>
                <option value="bark">Angry Junkyard Dog Barking Loop</option>
                <option value="chime">High-Decibel Bodega Door Chime</option>
              </select>
            </div>
            <label className="flex items-center justify-between text-xs font-medium text-[#f4f1ea] cursor-pointer pt-1">
              <span>Auto-Blast Speaker on Motion Breach</span>
              <input
                type="checkbox"
                checked={audioTripwire}
                onChange={(e) => setAudioTripwire(e.target.checked)}
                className="accent-[#ffd600] w-4 h-4"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Right 4 Cols: 1990s Mixtape Local Browser Clip Bin (IndexedDB) */}
      <div className="lg:col-span-4 space-y-4">
        <div className="nyc-panel concrete-surface p-5">
          <div className="flex items-center justify-between pb-3 border-b-2 border-[#2e3344]">
            <div>
              <span className="text-[11px] font-mono font-bold text-[#ffd600] uppercase">
                SIDE A // LOCAL BROWSER CACHE
              </span>
              <h3 className="font-graffiti text-xl text-[#f4f1ea] mt-0.5">
                Evidence Tape Bin ({localClips.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => void refreshClips()}
              className="nyc-btn nyc-btn-dark p-2 text-[#f4f1ea]"
              title="Rescan local cache"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {localClips.length === 0 ? (
            <div className="py-10 text-center space-y-2 border-2 border-dashed border-[#2e3344] bg-[#0a0a0d] mt-4 p-4">
              <Film className="w-8 h-8 text-[#ffd600] mx-auto" />
              <p className="font-stencil text-xs font-bold uppercase text-[#f4f1ea]">
                No Tapes Cut Yet
              </p>
              <p className="text-xs text-[#a0a6b8] max-w-xs mx-auto">
                Dispatch the sentry and trigger motion (or hit Cut 15s AI Watchman Reel) to commit a playback reel to browser storage.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3 max-h-[480px] overflow-y-auto">
              {localClips.map((clip, idx) => {
                const url = clipUrls.get(clip.id) || '';
                return (
                  <div
                    key={clip.id}
                    className="nyc-panel bg-[#0a0a0d] overflow-hidden"
                  >
                    {playingClipId === clip.id ? (
                      <video
                        src={url}
                        controls
                        autoPlay
                        onEnded={() => setPlayingClipId(null)}
                        className="aspect-video w-full bg-black"
                      />
                    ) : (
                      <div className="aspect-video w-full bg-[#12141c] flex items-center justify-center relative border-b-2 border-[#2e3344]">
                        <span className="absolute top-2 left-2 bg-[#0a0a0d] border border-[#ffd600] px-2 py-0.5 text-[10px] font-mono text-[#ffd600]">
                          TRACK {(idx + 1).toString().padStart(2, '0')}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPlayingClipId(clip.id)}
                          className="nyc-btn nyc-btn-yellow p-3"
                          aria-label="Play recording"
                        >
                          <Play className="w-4 h-4 fill-current" />
                        </button>
                      </div>
                    )}
                    {/* Cassette J-Card Label Strip */}
                    <div className="mixtape-strip flex items-center justify-between px-3 py-2">
                      <div className="font-marker text-xs truncate">
                        {new Date(clip.createdAt).toLocaleTimeString()} //{' '}
                        {clip.cameraName}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => downloadClip(clip)}
                          className="p-1.5 text-[#0a0a0d] hover:text-[#0055ff]"
                          title="Download clip"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await removeLocalClip(clip.id);
                            await refreshClips();
                          }}
                          className="p-1.5 text-[#0a0a0d] hover:text-[#ff2a3b]"
                          title="Delete clip"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Ghost Mode Fullscreen Dim Overlay */}
      {dimScreen && running && (
        <button
          type="button"
          onClick={() => setDimScreen(false)}
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center gap-3 text-[#ffd600]"
        >
          <Eye className="w-7 h-7" />
          <span className="font-stencil text-xs font-bold uppercase tracking-widest">
            GHOST MODE ACTIVE (LURK IN SHADOWS) · TAP ANYWHERE TO REVEAL DECK
          </span>
        </button>
      )}
    </div>
  );
};
