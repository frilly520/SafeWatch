import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Grid,
  LayoutGrid,
  Square,
  Plus,
  ShieldAlert,
  Moon,
  VolumeX,
  CheckCircle2,
  AlertTriangle,
  Bell,
  X,
  Search,
} from 'lucide-react';
import {
  type CameraNode,
  type GridLayoutMode,
  type PipelineStepLog,
  type RemotePhoneCamera,
  type SimulationScenario,
  type WatchmanIncident,
  type WebhookConfig,
  type WebhookLogEntry,
  INITIAL_CAMERAS,
} from './types/camera';
import { CameraTile } from './components/CameraTile';
import { AddCameraModal } from './components/AddCameraModal';
import { OldPhoneTransmitterView } from './components/OldPhoneTransmitterView';
import { X5WatchmanGatewayView } from './components/X5WatchmanGatewayView';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';

type ActiveSection = 'matrix' | 'phone' | 'x5_gateway' | 'incidents';

export function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'phone_transmitter' ? 'phone' : 'matrix';
  });

  // Camera state (persisted in localStorage)
  const [cameras, setCameras] = useState<CameraNode[]>(() => {
    try {
      const saved = localStorage.getItem('safewatch_x5_cameras_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_CAMERAS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('safewatch_x5_cameras_v1', JSON.stringify(cameras));
    } catch {
      // ignore
    }
  }, [cameras]);

  // Viewing layout: 1 camera, up to 4 cameras, or up to 8 cameras
  const [layoutMode, setLayoutMode] = useState<GridLayoutMode>(4);
  const [selectedSoloId, setSelectedSoloId] = useState<string>(
    cameras[0]?.id || 'cam-x5-porch'
  );
  const [quadPage, setQuadPage] = useState<0 | 1>(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Watchman AI & Backend state
  const [incidents, setIncidents] = useState<WatchmanIncident[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLogEntry[]>([]);
  const [webhookConfig, setWebhookConfig] = useState<WebhookConfig>({
    enabled: true,
    endpointUrl: '/api/webhooks/local-dashboard',
    pushNotificationsEnabled: true,
    ignoreAmbient: true,
    clipDurationSec: 15,
    autoPrivacyDelete: true,
  });
  const [remotePhoneNodes, setRemotePhoneNodes] = useState<RemotePhoneCamera[]>(
    []
  );
  const [remoteFrames, setRemoteFrames] = useState<Record<string, string>>({});
  const [analyzingCameraIds, setAnalyzingCameraIds] = useState<
    Record<string, boolean>
  >({});
  const [activePipelineSteps, setActivePipelineSteps] = useState<
    PipelineStepLog[]
  >([]);
  const [livePushAlert, setLivePushAlert] = useState<WatchmanIncident | null>(
    null
  );
  const [autoPatrolEnabled, setAutoPatrolEnabled] = useState(false);
  const [incidentFilter, setIncidentFilter] = useState<
    'ALL' | 'THREATS_ONLY' | 'AMBIENT_IGNORED'
  >('ALL');
  const [incidentSearch, setIncidentSearch] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const captureRefs = useRef<Record<string, () => string | undefined>>({});

  const registerCaptureRef = useCallback(
    (id: string, fn: () => string | undefined) => {
      captureRefs.current[id] = fn;
    },
    []
  );

  // Play brief alert tone when verified threat push notification arrives
  const playThreatAlertChime = useCallback(() => {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(784, ctx.currentTime);
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.14);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.48);
    } catch {
      // ignore audio block
    }
  }, []);

  // Connect WebSocket for real-time Watchman pipeline telemetry, push alerts, and Old Phone frames
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | undefined;

    const connect = () => {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'init') {
            if (Array.isArray(msg.payload.incidents)) {
              setIncidents(msg.payload.incidents);
            }
            if (Array.isArray(msg.payload.webhookLogs)) {
              setWebhookLogs(msg.payload.webhookLogs);
            }
            if (msg.payload.webhookConfig) {
              setWebhookConfig(msg.payload.webhookConfig);
            }
            if (Array.isArray(msg.payload.remotePhoneNodes)) {
              setRemotePhoneNodes(msg.payload.remotePhoneNodes);
            }
          } else if (msg.type === 'watchman:pipeline_progress') {
            if (Array.isArray(msg.payload.pipelineSteps)) {
              setActivePipelineSteps(msg.payload.pipelineSteps);
            }
          } else if (msg.type === 'watchman:incident_created') {
            const inc = msg.payload as WatchmanIncident;
            setIncidents((prev) => {
              if (prev.some((item) => item.id === inc.id)) return prev;
              return [inc, ...prev];
            });
            if (inc.threatVerified) {
              setLivePushAlert(inc);
              playThreatAlertChime();
            }
          } else if (msg.type === 'watchman:webhook_received') {
            const entry = msg.payload as WebhookLogEntry;
            setWebhookLogs((prev) => [entry, ...prev.slice(0, 49)]);
          } else if (msg.type === 'phone_node:updated') {
            setRemotePhoneNodes(msg.payload || []);
          } else if (msg.type === 'phone_node:frame') {
            const { nodeId, frameDataUrl } = msg.payload || {};
            if (nodeId && frameDataUrl) {
              setRemoteFrames((prev) => ({ ...prev, [nodeId]: frameDataUrl }));
            }
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        reconnectTimer = window.setTimeout(connect, 2500);
      };
    };

    connect();
    return () => {
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [playThreatAlertChime]);

  // Camera Control Handlers (Mute, Night Mode, Solo Focus, Scenario, Add, Remove)
  const handleToggleMute = useCallback((id: string) => {
    setCameras((prev) =>
      prev.map((cam) => (cam.id === id ? { ...cam, muted: !cam.muted } : cam))
    );
  }, []);

  const handleToggleNightMode = useCallback((id: string) => {
    setCameras((prev) =>
      prev.map((cam) =>
        cam.id === id ? { ...cam, nightMode: !cam.nightMode } : cam
      )
    );
  }, []);

  const handleSelectSolo = useCallback(
    (id: string) => {
      if (layoutMode === 1 && selectedSoloId === id) {
        setLayoutMode(4);
      } else {
        setSelectedSoloId(id);
        setLayoutMode(1);
      }
    },
    [layoutMode, selectedSoloId]
  );

  const handleChangeScenario = useCallback(
    (id: string, scenario: SimulationScenario) => {
      setCameras((prev) =>
        prev.map((cam) =>
          cam.id === id ? { ...cam, activeScenario: scenario } : cam
        )
      );
    },
    []
  );

  const handleBindLocalWebcam = useCallback((id: string) => {
    setCameras((prev) =>
      prev.map((cam) =>
        cam.id === id
          ? {
              ...cam,
              sourceType: 'local_webcam',
              model: 'Local Device Camera (AlfredCam Node)',
              localIp: '127.0.0.1 (Live Camera)',
              resolution: '1080p WebRTC',
            }
          : cam
      )
    );
  }, []);

  const handleAddCamera = useCallback((newCam: CameraNode) => {
    setCameras((prev) => [newCam, ...prev]);
    setSelectedSoloId(newCam.id);
  }, []);

  const handleRemoveCamera = useCallback((id: string) => {
    setCameras((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      return filtered.length > 0 ? filtered : INITIAL_CAMERAS.slice(0, 1);
    });
  }, []);

  // Trigger 15-second H.264 .mp4 capture + Gemini File API + Watchman Analysis + Automatic Cloud Privacy Wipe
  const handleTriggerWatchman = useCallback(
    async (camera: CameraNode, overrideScenario?: SimulationScenario) => {
      setAnalyzingCameraIds((prev) => ({ ...prev, [camera.id]: true }));
      setActivePipelineSteps([]);

      try {
        const frameFn = captureRefs.current[camera.id];
        const frameDataUrl = frameFn ? frameFn() : undefined;
        const scenarioType = overrideScenario || camera.activeScenario;

        const res = await fetch('/api/watchman/trigger-x5-capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cameraId: camera.id,
            cameraName: camera.name,
            cameraModel: `${camera.model}${
              camera.fccId ? ` (FCC: ${camera.fccId})` : ''
            }`,
            frameDataUrl,
            scenarioType,
          }),
        });

        if (res.ok) {
          const incident: WatchmanIncident = await res.json();
          setIncidents((prev) => {
            if (prev.some((item) => item.id === incident.id)) return prev;
            return [incident, ...prev];
          });
          if (incident.threatVerified) {
            setLivePushAlert(incident);
          }
        }
      } catch (err) {
        console.error('Watchman trigger error:', err);
      } finally {
        setAnalyzingCameraIds((prev) => ({ ...prev, [camera.id]: false }));
      }
    },
    []
  );

  // Auto-Patrol Daemon: Periodically monitors X5 cameras when enabled
  useEffect(() => {
    if (!autoPatrolEnabled) return;
    let index = 0;
    const timer = window.setInterval(() => {
      const target = cameras[index % cameras.length];
      index++;
      if (target) {
        void handleTriggerWatchman(target);
      }
    }, 28000);
    return () => window.clearInterval(timer);
  }, [autoPatrolEnabled, cameras, handleTriggerWatchman]);

  const handleUpdateWebhookConfig = async (next: Partial<WebhookConfig>) => {
    const merged = { ...webhookConfig, ...next };
    setWebhookConfig(merged);
    try {
      await fetch('/api/watchman/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      });
    } catch {
      // ignore
    }
  };

  // Compute visible cameras for 1, 4, or 8 layout
  const visibleCameras = (() => {
    if (layoutMode === 1) {
      const found = cameras.find((c) => c.id === selectedSoloId) || cameras[0];
      return found ? [found] : [];
    }
    if (layoutMode === 4) {
      const start = quadPage * 4;
      const slice = cameras.slice(start, start + 4);
      return slice.length > 0 ? slice : cameras.slice(0, 4);
    }
    return cameras.slice(0, 8);
  })();

  const isAnyAnalyzing = Object.values(analyzingCameraIds).some(Boolean);

  const filteredIncidents = incidents.filter((inc) => {
    if (incidentFilter === 'THREATS_ONLY' && !inc.threatVerified) return false;
    if (incidentFilter === 'AMBIENT_IGNORED' && inc.threatVerified)
      return false;
    if (incidentSearch.trim()) {
      const q = incidentSearch.toLowerCase();
      return (
        inc.cameraName.toLowerCase().includes(q) ||
        inc.summary.toLowerCase().includes(q) ||
        inc.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const x5Count = cameras.filter((c) => c.sourceType === 'x5_ziot').length;
  const phoneCount = cameras.filter(
    (c) => c.sourceType === 'phone_node' || c.sourceType === 'local_webcam'
  ).length;
  const wipedCount = incidents.filter((i) => i.cloudDeleteVerified).length;

  return (
    <div className="min-h-screen nyc-wall-bg text-[#f4f1ea] flex flex-col">
      {/* Top Bar Contract: 3 Zones separated by gap-8 */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b-2 border-[#2e3344] bg-[#0a0a0d]">
        {/* Zone 1: Single text element wordmark in 90s NYC Graffiti Display Font */}
        <a
          href="#matrix"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('matrix');
          }}
          className="font-graffiti text-2xl tracking-wide text-[#ffd600] whitespace-nowrap shrink-0"
        >
          safeWatch
        </a>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav className="flex items-center gap-6 text-sm font-stencil font-bold uppercase tracking-wider text-[#a0a6b8] overflow-x-auto">
          <a
            href="#matrix"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('matrix');
            }}
            className={`hover:text-[#f4f1ea] transition-colors whitespace-nowrap shrink-0 py-1 ${
              activeSection === 'matrix'
                ? 'text-[#ffd600] underline underline-offset-8 decoration-[#ffd600] decoration-2'
                : ''
            }`}
          >
            Multi-Cam Matrix
          </a>
          <a
            href="#phone"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('phone');
            }}
            className={`hover:text-[#f4f1ea] transition-colors whitespace-nowrap shrink-0 py-1 ${
              activeSection === 'phone'
                ? 'text-[#00d2ff] underline underline-offset-8 decoration-[#00d2ff] decoration-2'
                : ''
            }`}
          >
            Burner Phone Cam
          </a>
          <a
            href="#x5-gateway"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('x5_gateway');
            }}
            className={`hover:text-[#f4f1ea] transition-colors whitespace-nowrap shrink-0 py-1 ${
              activeSection === 'x5_gateway'
                ? 'text-[#ff2a3b] underline underline-offset-8 decoration-[#ff2a3b] decoration-2'
                : ''
            }`}
          >
            X5 &amp; Watchman AI
          </a>
          <a
            href="#incidents"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('incidents');
            }}
            className={`hover:text-[#f4f1ea] transition-colors whitespace-nowrap shrink-0 py-1 ${
              activeSection === 'incidents'
                ? 'text-[#9d4edd] underline underline-offset-8 decoration-[#9d4edd] decoration-2'
                : ''
            }`}
          >
            Tape Vault ({incidents.length})
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="nyc-btn nyc-btn-yellow px-4 py-2 min-h-[40px] text-xs whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Camera</span>
          </button>
        </div>
      </header>

      {/* Instant Verified Threat Push Notification Banner */}
      {livePushAlert && (
        <div className="bg-[#180c10] border-b-2 border-[#ff2a3b]">
          <div className="h-2 w-full hazard-stripe-red" />
          <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 bg-[#ff2a3b] text-white flex items-center justify-center shrink-0 border-2 border-white">
                <Bell className="w-5 h-5" />
              </div>
              <div className="text-xs min-w-0">
                <div className="flex flex-wrap items-center gap-2 font-mono font-bold text-[#ffd600]">
                  <span className="text-[#ff2a3b]">
                    ALL POINTS BULLETIN // VERIFIED THREAT
                  </span>
                  <span>·</span>
                  <span>{livePushAlert.cameraName}</span>
                  <span>·</span>
                  <span>
                    {livePushAlert.category} ({livePushAlert.threatLevel})
                  </span>
                  <span>·</span>
                  <span className="text-[#00d2ff]">
                    Cloud File Wiped ({livePushAlert.geminiFileName || 'OK'})
                  </span>
                </div>
                <p className="text-sm font-bold text-[#f4f1ea] mt-0.5">
                  {livePushAlert.summary}{' '}
                  <span className="text-[#ffd600] font-normal">
                    — Action: {livePushAlert.recommendedAction}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveSection('incidents')}
                className="nyc-btn nyc-btn-red px-3.5 py-1.5 text-xs whitespace-nowrap shrink-0"
              >
                Open Tape Vault
              </button>
              <button
                type="button"
                onClick={() => setLivePushAlert(null)}
                className="nyc-btn nyc-btn-dark p-1.5 text-[#f4f1ea]"
                aria-label="Dismiss alert"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-5 space-y-5">
        {activeSection === 'matrix' && (
          <>
            {/* 1990s NYC Street-Art Surveillance Banner & System Overview */}
            <section className="nyc-panel concrete-surface p-5 relative overflow-hidden">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b-2 border-[#2e3344]">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-bold text-[#ffd600] tabular-nums">
                    <span>BOROUGH SURVEILLANCE DECK</span>
                    <span>·</span>
                    <span className="text-[#00d2ff]">
                      X5 MINI P2P (FCC 2BCLC-A9)
                    </span>
                    <span>·</span>
                    <span>ALFREDCAM BURNER NODES</span>
                    <span>·</span>
                    <span className="text-[#ff2a3b]">ZERO-CLOUD RETENTION</span>
                  </div>
                  <h1 className="font-graffiti text-2xl sm:text-4xl text-[#f4f1ea] tracking-wide">
                    Don&apos;t Blink, Don&apos;t sleep
                  </h1>
                </div>

                {/* Unboxed Concrete Metric Readout + In-App PWA Install Shortcut */}
                <div className="flex flex-wrap items-center gap-3">
                  <PWAInstallPrompt />
                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums bg-[#0a0a0d] border-2 border-[#2e3344] px-4 py-2.5">
                  <div>
                    <span className="text-[#a0a6b8]">ACTIVE CAMS:</span>{' '}
                    <span className="text-[#ffd600] font-bold">
                      {cameras.length}
                    </span>
                  </div>
                  <span className="text-[#2e3344]">/</span>
                  <div>
                    <span className="text-[#a0a6b8]">X5 Z-IOT NODES:</span>{' '}
                    <span className="text-[#00d2ff] font-bold">{x5Count}</span>
                  </div>
                  <span className="text-[#2e3344]">/</span>
                  <div>
                    <span className="text-[#a0a6b8]">PHONE CAMS:</span>{' '}
                    <span className="text-[#9d4edd] font-bold">
                      {phoneCount}
                    </span>
                  </div>
                  <span className="text-[#2e3344]">/</span>
                  <div>
                    <span className="text-[#a0a6b8]">CLOUD WIPES:</span>{' '}
                    <span className="text-[#ff2a3b] font-bold">
                      {wipedCount}
                    </span>
                  </div>
                  </div>
                </div>
              </div>

              {/* Viewing Layout Switcher (1, 4, or 8 Cameras) & Global Deck Controls */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-stencil text-xs font-bold uppercase tracking-wider text-[#a0a6b8]">
                    WALL LAYOUT:
                  </span>

                  {/* Segmented Street Buttons with MTA Subway Route Bullets for 1, 4, and 8 Cameras */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setLayoutMode(1)}
                      className={`nyc-btn px-3.5 py-2 min-h-[40px] text-xs whitespace-nowrap shrink-0 ${
                        layoutMode === 1 ? 'nyc-btn-yellow' : 'nyc-btn-dark'
                      }`}
                    >
                      <span className="mta-bullet bg-[#ffd600] text-[#0a0a0d]">
                        1
                      </span>
                      <Square className="w-3.5 h-3.5" />
                      <span>1 Camera</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLayoutMode(4)}
                      className={`nyc-btn px-3.5 py-2 min-h-[40px] text-xs whitespace-nowrap shrink-0 ${
                        layoutMode === 4 ? 'nyc-btn-yellow' : 'nyc-btn-dark'
                      }`}
                    >
                      <span className="mta-bullet bg-[#00d2ff] text-[#0a0a0d]">
                        4
                      </span>
                      <Grid className="w-3.5 h-3.5" />
                      <span>Up to 4 Cameras</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLayoutMode(8)}
                      className={`nyc-btn px-3.5 py-2 min-h-[40px] text-xs whitespace-nowrap shrink-0 ${
                        layoutMode === 8 ? 'nyc-btn-yellow' : 'nyc-btn-dark'
                      }`}
                    >
                      <span className="mta-bullet bg-[#ff2a3b] text-white">
                        8
                      </span>
                      <LayoutGrid className="w-3.5 h-3.5" />
                      <span>Up to 8 Cameras</span>
                    </button>
                  </div>

                  {/* Camera Selector when in 1-Camera View */}
                  {layoutMode === 1 && (
                    <select
                      aria-label="Select camera for 1-camera view"
                      value={selectedSoloId}
                      onChange={(e) => setSelectedSoloId(e.target.value)}
                      className="nyc-input font-semibold"
                    >
                      {cameras.map((cam) => (
                        <option key={cam.id} value={cam.id}>
                          {cam.name} — {cam.location} ({cam.ssid || cam.localIp}
                          )
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Bank Switcher when in 4-Camera View and >4 cameras exist */}
                  {layoutMode === 4 && cameras.length > 4 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setQuadPage(0)}
                        className={`nyc-btn px-3 py-1.5 min-h-[38px] text-xs font-mono whitespace-nowrap shrink-0 ${
                          quadPage === 0 ? 'nyc-btn-blue' : 'nyc-btn-dark'
                        }`}
                      >
                        BANK A (1–4)
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuadPage(1)}
                        className={`nyc-btn px-3 py-1.5 min-h-[38px] text-xs font-mono whitespace-nowrap shrink-0 ${
                          quadPage === 1 ? 'nyc-btn-blue' : 'nyc-btn-dark'
                        }`}
                      >
                        BANK B (5–8)
                      </button>
                    </div>
                  )}
                </div>

                {/* Global Matrix Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const allNight = cameras.every((c) => c.nightMode);
                      setCameras((prev) =>
                        prev.map((c) => ({ ...c, nightMode: !allNight }))
                      );
                    }}
                    className="nyc-btn nyc-btn-dark px-3.5 py-2 min-h-[40px] text-xs whitespace-nowrap shrink-0"
                  >
                    <Moon className="w-3.5 h-3.5 text-[#9d4edd]" />
                    <span>All Night IR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setCameras((prev) =>
                        prev.map((c) => ({ ...c, muted: true }))
                      )
                    }
                    className="nyc-btn nyc-btn-dark px-3.5 py-2 min-h-[40px] text-xs whitespace-nowrap shrink-0"
                  >
                    <VolumeX className="w-3.5 h-3.5 text-[#00d2ff]" />
                    <span>Mute All</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const target = visibleCameras[0] || cameras[0];
                      if (target) void handleTriggerWatchman(target);
                    }}
                    disabled={isAnyAnalyzing}
                    className="nyc-btn nyc-btn-red px-4 py-2 min-h-[40px] text-xs whitespace-nowrap shrink-0"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>
                      {isAnyAnalyzing
                        ? 'Watchman Scanning...'
                        : 'Sweep Primary X5'}
                    </span>
                  </button>
                </div>
              </div>
            </section>

            {/* Multi-Camera Grid Viewport (1, 4, or 8 Cameras) */}
            <div
              className={
                layoutMode === 1
                  ? 'grid grid-cols-1 max-w-5xl mx-auto gap-5'
                  : layoutMode === 4
                    ? 'grid grid-cols-1 md:grid-cols-2 gap-5'
                    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'
              }
            >
              {visibleCameras.map((cam, idx) => (
                <CameraTile
                  key={cam.id}
                  camera={cam}
                  index={
                    layoutMode === 4 ? quadPage * 4 + idx : idx
                  }
                  isSolo={layoutMode === 1}
                  isAnalyzing={Boolean(analyzingCameraIds[cam.id])}
                  compact={layoutMode === 8}
                  remoteFrameUrl={
                    cam.remotePhoneNodeId
                      ? remoteFrames[cam.remotePhoneNodeId]
                      : undefined
                  }
                  onToggleMute={handleToggleMute}
                  onToggleNightMode={handleToggleNightMode}
                  onSelectSolo={handleSelectSolo}
                  onTriggerWatchman={handleTriggerWatchman}
                  onChangeScenario={handleChangeScenario}
                  onBindLocalWebcam={handleBindLocalWebcam}
                  onRemoveCamera={handleRemoveCamera}
                  onCaptureRef={registerCaptureRef}
                />
              ))}
            </div>

            {/* Live Pipeline & Latest Watchman Intelligence Strip */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Live 6-Stage Pipeline Status */}
              <div className="lg:col-span-5 nyc-panel concrete-surface p-4 space-y-3">
                <div className="flex items-center justify-between border-b-2 border-[#2e3344] pb-2">
                  <span className="text-xs font-mono font-bold text-[#ffd600]">
                    X5 GATEWAY &amp; GEMINI 2.5 FLASH WIRE
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveSection('x5_gateway')}
                    className="font-stencil text-xs font-bold uppercase text-[#00d2ff] hover:underline"
                  >
                    Open Gateway Deck →
                  </button>
                </div>

                {activePipelineSteps.length === 0 ? (
                  <p className="text-xs text-[#a0a6b8] py-3 leading-relaxed">
                    Hit <strong className="text-[#ffd600]">15s Watchman</strong> on any camera tile above to cut a 15-second H.264 <code className="text-[#00d2ff]">.mp4</code> segment, upload via the Google AI Studio File API, run <code className="text-[#ffd600]">gemini-2.5-flash</code> threat analysis, and verify automatic cloud file deletion.
                  </p>
                ) : (
                  <div className="space-y-1.5 text-xs font-mono bg-[#0a0a0d] border border-[#2e3344] p-3">
                    {activePipelineSteps.map((step, i) => (
                      <div
                        key={`${step.step}-${i}`}
                        className="flex items-center justify-between gap-2 text-[#f4f1ea]"
                      >
                        <span className="truncate">
                          <span className="text-[#ffd600] font-bold">
                            {step.status === 'completed' ? '[OK] ' : '[>>] '}
                          </span>
                          {step.step}:{' '}
                          <span className="text-[#a0a6b8]">{step.detail}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Watchman Threat & Ambient Dismissal Feed */}
              <div className="lg:col-span-7 nyc-panel concrete-surface p-4 space-y-3">
                <div className="flex items-center justify-between border-b-2 border-[#2e3344] pb-2">
                  <span className="text-xs font-mono font-bold text-[#00d2ff]">
                    LATEST WATCHMAN VERDICTS // ZERO-RETENTION CLOUD WIPE
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveSection('incidents')}
                    className="font-stencil text-xs font-bold uppercase text-[#ffd600] hover:underline"
                  >
                    Tape Vault ({incidents.length}) →
                  </button>
                </div>

                {incidents.length === 0 ? (
                  <p className="text-xs text-[#a0a6b8] py-3">
                    No motion evaluations logged yet. Hit <strong className="text-[#ffd600]">15s Watchman</strong> on any camera tile to test human/vehicle detection vs. ambient shadow filtering.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {incidents.slice(0, 2).map((inc) => (
                      <div
                        key={inc.id}
                        className={`px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#0a0a0d] ${
                          inc.threatVerified ? 'nyc-panel-red' : 'nyc-panel'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums">
                            {inc.threatVerified ? (
                              <span className="text-[#ff2a3b] font-bold flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                THREAT: {inc.category} ({inc.threatLevel})
                              </span>
                            ) : (
                              <span className="text-[#00d2ff] font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                AMBIENT DISMISSED
                              </span>
                            )}
                            <span className="text-[#59607a]">·</span>
                            <span className="text-[#f4f1ea] font-bold">
                              {inc.cameraName}
                            </span>
                            <span className="text-[#59607a]">·</span>
                            <span className="text-[#a0a6b8]">
                              {new Date(inc.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-xs text-[#f4f1ea] mt-1 truncate">
                            {inc.summary}
                          </p>
                        </div>

                        <div className="text-[11px] font-mono font-bold text-[#ffd600] shrink-0">
                          {inc.cloudDeleteVerified
                            ? 'CLOUD MP4 WIPED ✓'
                            : 'LOCAL ONLY'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeSection === 'phone' && (
          <OldPhoneTransmitterView
            wsRef={wsRef}
            onIncidentCreated={(inc) => {
              setIncidents((prev) =>
                prev.some((i) => i.id === inc.id) ? prev : [inc, ...prev]
              );
              if (inc.threatVerified) setLivePushAlert(inc);
            }}
          />
        )}

        {activeSection === 'x5_gateway' && (
          <X5WatchmanGatewayView
            cameras={cameras}
            incidents={incidents}
            webhookConfig={webhookConfig}
            webhookLogs={webhookLogs}
            activePipelineSteps={activePipelineSteps}
            isRunningPipeline={isAnyAnalyzing}
            autoPatrolEnabled={autoPatrolEnabled}
            onToggleAutoPatrol={() => setAutoPatrolEnabled((p) => !p)}
            onUpdateWebhookConfig={handleUpdateWebhookConfig}
            onTriggerX5Scenario={(cam, scenario) =>
              void handleTriggerWatchman(cam, scenario)
            }
            onAddDiscoveredCamera={(cam) => {
              handleAddCamera(cam);
              setActiveSection('matrix');
            }}
          />
        )}

        {activeSection === 'incidents' && (
          <div className="nyc-panel concrete-surface p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-[#2e3344]">
              <div>
                <span className="font-mono text-xs font-bold uppercase text-[#ffd600]">
                  EVIDENCE ARCHIVE // ZERO-RETENTION CLOUD LOGS
                </span>
                <h2 className="font-graffiti text-3xl text-[#f4f1ea] mt-1">
                  Watchman Tape Vault &amp; Wipe Receipts
                </h2>
                <p className="text-xs text-[#a0a6b8] mt-0.5">
                  Every 15-second H.264 <code className="text-[#00d2ff]">.mp4</code> reel evaluated by <code className="text-[#ffd600]">gemini-2.5-flash</code> with timestamped proof of automatic Google AI Studio File API deletion.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#a0a6b8] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search camera or event..."
                    value={incidentSearch}
                    onChange={(e) => setIncidentSearch(e.target.value)}
                    className="nyc-input pl-8"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  {(
                    [
                      ['ALL', 'All Reels'],
                      ['THREATS_ONLY', 'Verified Threats'],
                      ['AMBIENT_IGNORED', 'Ambient Ignored'],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setIncidentFilter(val)}
                      className={`nyc-btn px-3 py-1.5 min-h-[38px] text-xs whitespace-nowrap shrink-0 ${
                        incidentFilter === val
                          ? 'nyc-btn-yellow'
                          : 'nyc-btn-dark'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {filteredIncidents.length === 0 ? (
              <div className="py-12 text-center space-y-3 border-2 border-dashed border-[#2e3344] bg-[#0a0a0d] p-6">
                <ShieldAlert className="w-10 h-10 text-[#ffd600] mx-auto" />
                <p className="font-graffiti text-2xl text-[#f4f1ea]">
                  No Evidence Reels Logged Yet
                </p>
                <p className="text-xs text-[#a0a6b8] max-w-md mx-auto">
                  Trigger a 15-second H.264 capture from any camera in the Multi-Cam Matrix to populate the intelligence vault.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const cam = cameras[0];
                    if (cam) void handleTriggerWatchman(cam);
                  }}
                  className="nyc-btn nyc-btn-yellow px-4 py-2.5 min-h-[42px] text-xs"
                >
                  Run Sample X5 Watchman Check Now
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredIncidents.map((inc, index) => (
                  <div
                    key={inc.id}
                    className={`bg-[#0a0a0d] overflow-hidden ${
                      inc.threatVerified ? 'nyc-panel-red' : 'nyc-panel'
                    }`}
                  >
                    {/* Mixtape J-Card Top Spine */}
                    <div className="mixtape-strip px-4 py-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-bold tabular-nums">
                        <span className="bg-[#0a0a0d] text-[#ffd600] px-2 py-0.5">
                          REEL #{(filteredIncidents.length - index).toString().padStart(2, '0')}
                        </span>
                        <span>
                          {inc.threatVerified
                            ? `THREAT FLAGGED · ${inc.threatLevel} · ${inc.category}`
                            : `AMBIENT IGNORED · ${inc.category}`}
                        </span>
                        <span>/</span>
                        <span className="font-marker text-sm">
                          {inc.cameraName}
                        </span>
                      </div>

                      <div className="text-xs font-mono font-bold tabular-nums">
                        {new Date(inc.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
                      <div className="lg:col-span-8 space-y-2">
                        <p className="text-base font-bold text-[#f4f1ea]">
                          {inc.summary}
                        </p>
                        <p className="text-xs text-[#a0a6b8] leading-relaxed">
                          <strong className="text-[#00d2ff] uppercase font-stencil">
                            Watchman Breakdown:
                          </strong>{' '}
                          {inc.watchmanReasoning}
                        </p>
                        <p className="text-xs text-[#ffd600] font-semibold">
                          <strong className="uppercase font-stencil">
                            Street Protocol:
                          </strong>{' '}
                          {inc.recommendedAction}
                        </p>
                        {inc.detectedObjects.length > 0 && (
                          <p className="text-xs font-mono text-[#a0a6b8]">
                            Tagged Objects: {inc.detectedObjects.join(' · ')}
                          </p>
                        )}
                      </div>

                      <div className="lg:col-span-4 border-t-2 lg:border-t-0 lg:border-l-2 border-[#2e3344] pt-3 lg:pt-0 lg:pl-4 space-y-1.5 text-xs font-mono text-[#a0a6b8] tabular-nums">
                        <div>
                          Codec:{' '}
                          <span className="text-[#f4f1ea]">{inc.codec}</span>
                        </div>
                        <div>
                          Reel Length:{' '}
                          <span className="text-[#f4f1ea]">
                            {inc.durationSec}s (
                            {(inc.fileSizeBytes / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <div>
                          Gemini File ID:{' '}
                          <span className="text-[#00d2ff]">
                            {inc.geminiFileName || 'inline'}
                          </span>
                        </div>
                        <div>
                          Cloud Privacy Wipe:{' '}
                          <span className="text-[#ffd600] font-bold">
                            {inc.cloudDeleteVerified
                              ? `WIPED (${
                                  inc.cloudDeletedAt
                                    ? new Date(
                                        inc.cloudDeletedAt
                                      ).toLocaleTimeString()
                                    : 'OK'
                                })`
                              : 'N/A'}
                          </span>
                        </div>
                        <div>
                          Webhook Alert:{' '}
                          <span className="text-[#f4f1ea]">
                            {inc.webhookDispatched
                              ? `Dispatched (HTTP ${inc.webhookStatus})`
                              : 'Suppressed (No Threat)'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Subtle 90s NYC Street Footer */}
      <footer className="border-t-2 border-[#2e3344] bg-[#0a0a0d] px-6 py-4 mt-8">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-[#a0a6b8]">
          <div>
            <span className="font-graffiti text-base text-[#ffd600] mr-2">
              safeWatch
            </span>
            <span>
              NYC FIVE BOROUGHS SURVEILLANCE DECK · X5 MINI (FCC 2BCLC-A9) &amp; ALFREDCAM BURNER NODES
            </span>
          </div>
          <div className="text-[#00d2ff]">
            15S H.264 MP4 GATEWAY · GEMINI 2.5 FLASH WATCHMAN · AUTOMATIC CLOUD WIPE
          </div>
        </div>
      </footer>

      {/* Add Camera Wizard Modal */}
      <AddCameraModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddCamera={handleAddCamera}
        onSwitchToPhoneTransmitter={() => setActiveSection('phone')}
        remotePhoneNodes={remotePhoneNodes}
      />
    </div>
  );
}

export default App;
