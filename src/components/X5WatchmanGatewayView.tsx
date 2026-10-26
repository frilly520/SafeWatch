import React, { useState } from 'react';
import {
  Wifi,
  Film,
  UploadCloud,
  ShieldCheck,
  BellRing,
  Trash2,
  Play,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import type {
  CameraNode,
  DiscoveredX5Device,
  PipelineStepLog,
  SimulationScenario,
  WatchmanIncident,
  WebhookConfig,
  WebhookLogEntry,
} from '../types/camera';

interface X5WatchmanGatewayViewProps {
  cameras: CameraNode[];
  incidents: WatchmanIncident[];
  webhookConfig: WebhookConfig;
  webhookLogs: WebhookLogEntry[];
  activePipelineSteps: PipelineStepLog[];
  isRunningPipeline: boolean;
  autoPatrolEnabled: boolean;
  onToggleAutoPatrol: () => void;
  onUpdateWebhookConfig: (next: Partial<WebhookConfig>) => void;
  onTriggerX5Scenario: (
    camera: CameraNode,
    scenario: SimulationScenario
  ) => void;
  onAddDiscoveredCamera: (cam: CameraNode) => void;
}

export const X5WatchmanGatewayView: React.FC<X5WatchmanGatewayViewProps> = ({
  cameras,
  incidents,
  webhookConfig,
  webhookLogs,
  activePipelineSteps,
  isRunningPipeline,
  autoPatrolEnabled,
  onToggleAutoPatrol,
  onUpdateWebhookConfig,
  onTriggerX5Scenario,
  onAddDiscoveredCamera,
}) => {
  const [selectedCameraId, setSelectedCameraId] = useState<string>(
    cameras[0]?.id || 'cam-x5-porch'
  );
  const [selectedScenario, setSelectedScenario] =
    useState<SimulationScenario>('INTRUDER_PROWL');
  const [scanningLan, setScanningLan] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<
    DiscoveredX5Device[]
  >([
    {
      id: 'x5-ziot-primary-2bclc',
      ssid: 'Z-IOT-8A4F',
      model: 'X5 Mini Camera Series (Model: X5)',
      fccId: '2BCLC-A9',
      localIp: '192.168.4.1',
      port: 8080,
      protocol: 'HTTP_MJPEG',
      streamUrl: 'http://192.168.4.1:8080/stream.mjpg',
      signalDbm: -38,
      encrypted: false,
      firmware: 'V4.3.1-ZIOT-A9',
      discoveredVia: 'ZIOT_BEACON',
      lastSeen: Date.now(),
    },
    {
      id: 'x5-ziot-secondary-2bclc',
      ssid: 'ZIOT-X5-C912',
      model: 'X5 Mini Wide-Angle IR (Model: X5)',
      fccId: '2BCLC-A9',
      localIp: '192.168.10.1',
      port: 554,
      protocol: 'RTSP_P2P',
      streamUrl: 'rtsp://192.168.10.1:554/live/ch0',
      signalDbm: -51,
      encrypted: false,
      firmware: 'V4.3.1-ZIOT-A9',
      discoveredVia: 'ARP_CACHE',
      lastSeen: Date.now(),
    },
  ]);

  const handleScanX5 = async () => {
    setScanningLan(true);
    try {
      const res = await fetch('/api/x5/discover');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.devices)) {
          setDiscoveredDevices(data.devices);
        }
      }
    } catch {
      // ignore
    } finally {
      setScanningLan(false);
    }
  };

  const selectedCamera =
    cameras.find((c) => c.id === selectedCameraId) || cameras[0];

  const STAGE_CARDS = [
    {
      num: '1',
      bulletBg: 'bg-[#ffd600] text-[#0a0a0d]',
      title: 'X5 P2P Wi-Fi Discovery',
      spec: 'Z-IOT / ZIOT AP · FCC 2BCLC-A9',
      desc: 'Probes local ARP & P2P subnets (192.168.4.1 / 192.168.10.1) to intercept unencrypted X5 streams.',
      icon: Wifi,
    },
    {
      num: '2',
      bulletBg: 'bg-[#00d2ff] text-[#0a0a0d]',
      title: '15s H.264 Recording Gateway',
      spec: 'FFmpeg libx264 · .mp4 · yuv420p',
      desc: 'Cuts a clean 15-second motion segment and compresses it into a lightweight H.264 .mp4.',
      icon: Film,
    },
    {
      num: '3',
      bulletBg: 'bg-[#9d4edd] text-white',
      title: 'AI Studio File API Pipeline',
      spec: 'ai.files.upload + State Polling',
      desc: 'Uploads .mp4 asset via Google GenAI File API and monitors state transitions until ACTIVE.',
      icon: UploadCloud,
    },
    {
      num: '4',
      bulletBg: 'bg-[#ff2a3b] text-white',
      title: 'Gemini 2.5 Flash Watchman',
      spec: 'Ambient Ignored vs Verified Threat',
      desc: 'Ignores shadows, wind, and stray pets; strictly flags humans, vehicles, or safety hazards.',
      icon: ShieldCheck,
    },
    {
      num: '5',
      bulletBg: 'bg-[#ffd600] text-[#0a0a0d]',
      title: 'No-Code Endpoint & Push',
      spec: 'Structured JSON Webhook + Alert',
      desc: 'Automatically fires instant push notifications and webhook payloads when a threat is verified.',
      icon: BellRing,
    },
    {
      num: '6',
      bulletBg: 'bg-[#00d2ff] text-[#0a0a0d]',
      title: 'Automatic Privacy Cleanup',
      spec: 'ai.files.delete Zero-Retention',
      desc: 'Immediately wipes the video asset from the Google AI Studio cloud repository after analysis.',
      icon: Trash2,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Architecture Control Header */}
      <div className="nyc-panel concrete-surface p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b-2 border-[#2e3344]">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#ffd600] tabular-nums">
              <span className="mta-bullet bg-[#ff2a3b] text-white">X5</span>
              <span>NATIVE HARDWARE ENGINE</span>
              <span>·</span>
              <span className="text-[#00d2ff]">MODEL: X5 MINI CAMERA</span>
              <span>·</span>
              <span>FCC ID: 2BCLC-A9</span>
            </div>
            <h2 className="font-graffiti text-2xl sm:text-3xl text-[#f4f1ea] mt-1.5">
              X5 P2P Stream Gateway &amp; Watchman AI Loop
            </h2>
            <p className="text-xs text-[#a0a6b8] mt-1 max-w-3xl">
              Self-deploying 6-stage subway line: discovers <code className="text-[#ffd600]">Z-IOT</code> / <code className="text-[#ffd600]">ZIOT</code> P2P transmitters, cuts 15-second H.264 <code className="text-[#00d2ff]">.mp4</code> reels via FFmpeg on motion, uploads to the Google AI Studio File API, runs <code className="text-[#ffd600]">gemini-2.5-flash</code> street watchman analysis, fires mobile webhooks, and executes immediate cloud file deletion.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onToggleAutoPatrol}
              className={`nyc-btn px-4 py-2.5 min-h-[42px] text-xs whitespace-nowrap shrink-0 ${
                autoPatrolEnabled ? 'nyc-btn-yellow' : 'nyc-btn-dark'
              }`}
            >
              <RefreshCw
                className={`w-4 h-4 ${autoPatrolEnabled ? 'animate-spin' : ''}`}
              />
              <span>
                {autoPatrolEnabled
                  ? 'Auto-Patrol Daemon: ON'
                  : 'Arm Auto-Patrol Daemon'}
              </span>
            </button>
          </div>
        </div>

        {/* 6 Technical Specification Subway Stops */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-5">
          {STAGE_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.num}
                className="nyc-panel bg-[#0a0a0d] p-4 flex flex-col justify-between hover:border-[#ffd600]"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`mta-bullet ${card.bulletBg}`}>
                        {card.num}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-[#a0a6b8] uppercase">
                        STOP 0{card.num}
                      </span>
                    </div>
                    <Icon className="w-4 h-4 text-[#ffd600]" />
                  </div>
                  <h3 className="font-stencil text-sm font-bold uppercase text-[#f4f1ea] mt-2.5">
                    {card.title}
                  </h3>
                  <p className="text-[11px] font-mono font-semibold text-[#00d2ff] mt-0.5">
                    {card.spec}
                  </p>
                  <p className="text-xs text-[#a0a6b8] mt-2 leading-relaxed">
                    {card.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live End-to-End Pipeline Execution & Hardware Scanner */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Interactive End-to-End Pipeline Runner & Live Telemetry */}
        <div className="lg:col-span-7 space-y-6">
          <div className="nyc-panel concrete-surface p-5 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-[#2e3344] pb-3">
              <div>
                <span className="font-mono text-[11px] font-bold uppercase text-[#ffd600]">
                  LIVE ENGINE TEST DECK
                </span>
                <h3 className="font-graffiti text-2xl text-[#f4f1ea] mt-0.5">
                  Fire 6-Stage Watchman Loop
                </h3>
                <p className="text-xs text-[#a0a6b8]">
                  Cut a live 15-second H.264 <code className="text-[#00d2ff]">.mp4</code> clip, upload to Gemini File API, run Watchman AI, and verify cloud wipe.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-stencil text-xs font-bold uppercase text-[#f4f1ea] mb-1">
                  Target Camera Rig
                </label>
                <select
                  value={selectedCameraId}
                  onChange={(e) => setSelectedCameraId(e.target.value)}
                  className="w-full nyc-input font-semibold"
                >
                  {cameras.map((cam) => (
                    <option key={cam.id} value={cam.id}>
                      {cam.name} ({cam.ssid || cam.localIp})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-stencil text-xs font-bold uppercase text-[#f4f1ea] mb-1">
                  Street Scenario Injection
                </label>
                <select
                  value={selectedScenario}
                  onChange={(e) =>
                    setSelectedScenario(e.target.value as SimulationScenario)
                  }
                  className="w-full nyc-input font-semibold"
                >
                  <option value="INTRUDER_PROWL">
                    Human Presence: Nighttime Prowler at Gate (Flags Threat)
                  </option>
                  <option value="DELIVERY_VEHICLE">
                    Vehicle Movement: Van Pulling Into Curb (Flags Threat)
                  </option>
                  <option value="SAFETY_SMOKE">
                    Safety Hazard: Smoke Plume in Workshop (Flags Critical)
                  </option>
                  <option value="AMBIENT_SHADOWS">
                    Routine Ambient: Wind Shadows &amp; Alley Cat (Ignored by AI)
                  </option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="text-xs font-mono text-[#a0a6b8]">
                FFmpeg H.264 ({webhookConfig.clipDurationSec}s .mp4) → File API → gemini-2.5-flash → Auto-Wipe
              </div>
              <button
                type="button"
                disabled={isRunningPipeline || !selectedCamera}
                onClick={() => {
                  if (selectedCamera) {
                    onTriggerX5Scenario(selectedCamera, selectedScenario);
                  }
                }}
                className="nyc-btn nyc-btn-yellow px-4 py-2.5 min-h-[42px] text-xs whitespace-nowrap shrink-0"
              >
                {isRunningPipeline ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Running 6-Stage Loop...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Run 15s Capture &amp; Watchman</span>
                  </>
                )}
              </button>
            </div>

            {/* Real-Time Pipeline Execution Steps */}
            <div className="nyc-panel bg-[#0a0a0d] p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-[#ffd600] pb-2 border-b border-[#2e3344]">
                <span>LIVE PIPELINE TELEMETRY</span>
                <span className="text-[#00d2ff]">
                  {isRunningPipeline ? '● ACTIVE STREAM' : 'READY'}
                </span>
              </div>
              {activePipelineSteps.length === 0 ? (
                <p className="text-xs font-mono text-[#a0a6b8] py-4 text-center">
                  Hit &ldquo;Run 15s Capture &amp; Watchman&rdquo; above (or &ldquo;15s Watchman&rdquo; on any camera tile) to watch live File API upload, state polling, and cloud privacy wipe steps.
                </p>
              ) : (
                <div className="space-y-2">
                  {activePipelineSteps.map((step, idx) => (
                    <div
                      key={`${step.step}-${idx}`}
                      className="flex items-start justify-between gap-3 text-xs font-mono py-1.5 border-b border-[#1c1f2b] last:border-0"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        {step.status === 'active' ? (
                          <Loader2 className="w-3.5 h-3.5 text-[#ffd600] animate-spin shrink-0 mt-0.5" />
                        ) : step.status === 'completed' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#00d2ff] shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-[#ff2a3b] shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <span className="text-[#f4f1ea] font-bold">
                            {step.step}:
                          </span>{' '}
                          <span className="text-[#a0a6b8]">{step.detail}</span>
                        </div>
                      </div>
                      <span className="text-[11px] text-[#ffd600] tabular-nums shrink-0">
                        {new Date(step.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stage 1: X5 Z-IOT Hardware Network Scanner Table */}
          <div className="nyc-panel concrete-surface p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-graffiti text-xl text-[#f4f1ea]">
                  X5 P2P Transmitter Scanner (Z-IOT / ZIOT)
                </h3>
                <p className="text-xs text-[#a0a6b8]">
                  Model: X5 · FCC ID: 2BCLC-A9 · Unencrypted Local Stream Interceptor
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleScanX5()}
                disabled={scanningLan}
                className="nyc-btn nyc-btn-dark px-3.5 py-2 min-h-[40px] text-xs whitespace-nowrap shrink-0"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-[#ffd600] ${
                    scanningLan ? 'animate-spin' : ''
                  }`}
                />
                <span>{scanningLan ? 'Probing Subnets...' : 'Probe Network'}</span>
              </button>
            </div>

            <div className="overflow-x-auto bg-[#0a0a0d] border-2 border-[#2e3344]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b-2 border-[#2e3344] bg-[#13151c] text-[#ffd600] font-mono">
                    <th className="py-2.5 px-3">AP SSID</th>
                    <th className="py-2.5 px-3">FCC ID</th>
                    <th className="py-2.5 px-3">LOCAL IP &amp; STREAM</th>
                    <th className="py-2.5 px-3">SIGNAL</th>
                    <th className="py-2.5 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#252936] font-mono tabular-nums">
                  {discoveredDevices.map((dev) => (
                    <tr key={dev.id} className="hover:bg-[#161922]">
                      <td className="py-2.5 px-3 font-bold text-[#00d2ff]">
                        {dev.ssid}
                      </td>
                      <td className="py-2.5 px-3 text-[#f4f1ea]">{dev.fccId}</td>
                      <td className="py-2.5 px-3 text-[#a0a6b8]">
                        {dev.streamUrl}
                      </td>
                      <td className="py-2.5 px-3 text-[#ffd600]">
                        {dev.signalDbm} dBm
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            onAddDiscoveredCamera({
                              id: `cam-x5-${Date.now()}`,
                              name: `X5 Mini (${dev.ssid})`,
                              location: 'Intercepted P2P Feed',
                              sourceType: 'x5_ziot',
                              model: dev.model,
                              fccId: dev.fccId,
                              ssid: dev.ssid,
                              localIp: `${dev.localIp}:${dev.port}`,
                              streamUrl: dev.streamUrl,
                              muted: true,
                              nightMode: false,
                              motionAutoRecord: true,
                              online: true,
                              fps: 15,
                              bitrateKbps: 1400,
                              resolution: '1080p H.264',
                              activeScenario: 'INTRUDER_PROWL',
                            })
                          }
                          className="nyc-btn nyc-btn-yellow px-2.5 py-1 text-xs"
                        >
                          Hook Up Feed
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 5 Cols: No-Code Endpoint Configuration, Webhook Payload Inspector & Privacy Audit */}
        <div className="lg:col-span-5 space-y-6">
          <div className="nyc-panel concrete-surface p-5 space-y-4">
            <div className="border-b-2 border-[#2e3344] pb-3">
              <span className="font-mono text-[11px] font-bold uppercase text-[#00d2ff]">
                SETTINGS &amp; PRIVACY LOCKDOWN
              </span>
              <h3 className="font-graffiti text-xl text-[#f4f1ea] mt-0.5">
                No-Code Endpoint &amp; Cloud Wipe
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-stencil text-xs font-bold uppercase text-[#f4f1ea] mb-1">
                  Webhook / Mobile Dashboard Alert Endpoint URL
                </label>
                <input
                  type="text"
                  value={webhookConfig.endpointUrl}
                  onChange={(e) =>
                    onUpdateWebhookConfig({ endpointUrl: e.target.value })
                  }
                  className="w-full nyc-input font-mono"
                />
              </div>

              <label className="flex items-center justify-between text-xs font-medium text-[#f4f1ea] cursor-pointer pt-1">
                <span>Instant Push Alert &amp; Webhook on Verified Threat</span>
                <input
                  type="checkbox"
                  checked={webhookConfig.enabled}
                  onChange={(e) =>
                    onUpdateWebhookConfig({ enabled: e.target.checked })
                  }
                  className="accent-[#ffd600] w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between text-xs font-medium text-[#f4f1ea] cursor-pointer">
                <span>
                  Ignore Routine Ambient Motion (Shadows / Alley Cats / Wind)
                </span>
                <input
                  type="checkbox"
                  checked={webhookConfig.ignoreAmbient}
                  onChange={(e) =>
                    onUpdateWebhookConfig({ ignoreAmbient: e.target.checked })
                  }
                  className="accent-[#ffd600] w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between text-xs font-medium text-[#f4f1ea] cursor-pointer">
                <span>
                  Auto Privacy Wipe (ai.files.delete right after Watchman scan)
                </span>
                <input
                  type="checkbox"
                  checked={webhookConfig.autoPrivacyDelete}
                  onChange={(e) =>
                    onUpdateWebhookConfig({
                      autoPrivacyDelete: e.target.checked,
                    })
                  }
                  className="accent-[#ffd600] w-4 h-4"
                />
              </label>
            </div>
          </div>

          {/* Recent Structured Webhook Payloads & Cloud Wipe Audit */}
          <div className="nyc-panel concrete-surface p-5 space-y-3">
            <div className="flex items-center justify-between border-b-2 border-[#2e3344] pb-3">
              <div>
                <h3 className="font-graffiti text-xl text-[#f4f1ea]">
                  Endpoint Payloads &amp; Wipe Receipts
                </h3>
                <p className="text-xs text-[#a0a6b8]">
                  Zero-retention proof from Google AI Studio File API
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-[#ffd600] tabular-nums">
                {incidents.filter((i) => i.cloudDeleteVerified).length}/
                {incidents.length} WIPED
              </span>
            </div>

            {webhookLogs.length === 0 && incidents.length === 0 ? (
              <p className="text-xs text-[#a0a6b8] py-6 text-center border-2 border-dashed border-[#2e3344] bg-[#0a0a0d] p-4">
                No webhook payloads fired yet. Run an AI Watchman check to inspect the structured threat JSON and cloud deletion receipt.
              </p>
            ) : (
              <div className="space-y-3 max-h-[380px] overflow-y-auto">
                {incidents.slice(0, 5).map((inc) => (
                  <div
                    key={inc.id}
                    className={`p-3 space-y-2 text-xs font-mono ${
                      inc.threatVerified ? 'nyc-panel-red' : 'nyc-panel'
                    } bg-[#0a0a0d]`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={
                          inc.threatVerified
                            ? 'text-[#ff2a3b] font-bold'
                            : 'text-[#00d2ff] font-bold'
                        }
                      >
                        {inc.threatVerified
                          ? `● THREAT: ${inc.category} (${inc.threatLevel})`
                          : `✓ IGNORED: ${inc.category}`}
                      </span>
                      <span className="text-[#a0a6b8] tabular-nums">
                        {new Date(inc.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-[#f4f1ea] font-sans">{inc.summary}</p>
                    <div className="text-[11px] text-[#a0a6b8] pt-1 border-t border-[#2e3344] flex flex-wrap items-center justify-between gap-2">
                      <span>
                        Cloud File: {inc.geminiFileName || 'inline-video'}
                      </span>
                      <span className="text-[#ffd600] font-bold">
                        {inc.cloudDeleteVerified
                          ? 'CLOUD WIPED (ai.files.delete OK)'
                          : 'LOCAL ONLY'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
