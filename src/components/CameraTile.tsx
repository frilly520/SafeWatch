import React from 'react';
import {
  Volume2,
  VolumeX,
  Moon,
  Sun,
  ShieldAlert,
  Maximize2,
  Minimize2,
  Camera,
  Loader2,
  Trash2,
} from 'lucide-react';
import type { CameraNode, SimulationScenario } from '../types/camera';
import { CameraFeedViewport } from './CameraFeedViewport';

interface CameraTileProps {
  camera: CameraNode;
  index?: number;
  isSolo: boolean;
  isAnalyzing: boolean;
  compact: boolean;
  remoteFrameUrl?: string;
  onToggleMute: (id: string) => void;
  onToggleNightMode: (id: string) => void;
  onSelectSolo: (id: string) => void;
  onTriggerWatchman: (camera: CameraNode) => void;
  onChangeScenario: (id: string, scenario: SimulationScenario) => void;
  onBindLocalWebcam: (id: string) => void;
  onRemoveCamera: (id: string) => void;
  onCaptureRef: (id: string, fn: () => string | undefined) => void;
}

const SCENARIO_LABELS: Record<SimulationScenario, string> = {
  INTRUDER_PROWL: 'SCENE: STOOP INTRUDER',
  DELIVERY_VEHICLE: 'SCENE: CURB VEHICLE',
  AMBIENT_SHADOWS: 'SCENE: ALLEY CAT / WIND',
  SAFETY_SMOKE: 'SCENE: SMOKE HAZARD',
  NORMAL_PATROL: 'SCENE: CLEAR BLOCK',
};

const BULLET_COLORS = [
  'bg-[#ffd600] text-[#0a0a0d]',
  'bg-[#00d2ff] text-[#0a0a0d]',
  'bg-[#ff2a3b] text-white',
  'bg-[#9d4edd] text-white',
];

export const CameraTile: React.FC<CameraTileProps> = ({
  camera,
  index = 0,
  isSolo,
  isAnalyzing,
  compact,
  remoteFrameUrl,
  onToggleMute,
  onToggleNightMode,
  onSelectSolo,
  onTriggerWatchman,
  onChangeScenario,
  onBindLocalWebcam,
  onRemoveCamera,
  onCaptureRef,
}) => {
  const sourceLabel =
    camera.sourceType === 'x5_ziot'
      ? `X5 P2P · ${camera.ssid || 'Z-IOT'}`
      : camera.sourceType === 'phone_node'
        ? 'BURNER PHONE NODE'
        : camera.sourceType === 'local_webcam'
          ? 'LOCAL RIG CAM'
          : 'FREE IP STREAM';

  const bulletColor = BULLET_COLORS[index % BULLET_COLORS.length];

  return (
    <article
      className={`flex flex-col overflow-hidden transition-all ${
        isAnalyzing
          ? 'nyc-panel-red'
          : isSolo
            ? 'nyc-panel-yellow'
            : 'nyc-panel hover:border-[#ffd600]/80'
      }`}
    >
      {/* Top Subway-Sign Header Bar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b-2 border-[#2e3344] bg-[#0c0e14]">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className={`mta-bullet ${bulletColor}`}>
            {(index + 1).toString()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-stencil font-bold text-sm uppercase tracking-wider text-[#f4f1ea] truncate">
                {camera.name}
              </h3>
              <span className="text-[#59607a]" aria-hidden="true">
                /
              </span>
              <span className="text-xs font-medium text-[#a0a6b8] truncate">
                {camera.location}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#a0a6b8] tabular-nums truncate mt-0.5">
              <span className="text-[#00d2ff] font-semibold">{sourceLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{camera.localIp}</span>
              {camera.fccId && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#ffd600]">FCC {camera.fccId}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>{camera.fps} FPS</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {camera.sourceType !== 'local_webcam' && (
            <button
              type="button"
              onClick={() => onBindLocalWebcam(camera.id)}
              title="Bind this slot to your device's real camera"
              className="nyc-btn nyc-btn-dark px-2.5 py-1 text-[11px] whitespace-nowrap shrink-0"
            >
              <Camera className="w-3.5 h-3.5 text-[#ffd600]" />
              <span className="hidden sm:inline">Use My Cam</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onSelectSolo(camera.id)}
            title={isSolo ? 'Return to multi-camera grid' : 'Solo 1-camera focus'}
            className="nyc-btn nyc-btn-dark p-1.5 text-[#f4f1ea]"
          >
            {isSolo ? (
              <Minimize2 className="w-3.5 h-3.5 text-[#ffd600]" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onRemoveCamera(camera.id)}
            title="Remove camera"
            className="nyc-btn nyc-btn-dark p-1.5 text-[#a0a6b8] hover:text-[#ff2a3b]"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Unobstructed Video / Canvas Feed Container */}
      <div className="relative aspect-video w-full bg-black overflow-hidden">
        <CameraFeedViewport
          camera={camera}
          remoteFrameUrl={remoteFrameUrl}
          onCaptureRef={onCaptureRef}
        />

        {/* Top-Right Stencil Status Tag */}
        <div className="absolute top-2 right-2 bg-[#0a0a0d]/90 border border-[#383e52] px-2 py-0.5 text-[11px] font-mono tabular-nums text-[#f4f1ea] flex items-center gap-1.5 pointer-events-none">
          <span className="text-[#ff2a3b] font-bold">● LIVE</span>
          <span aria-hidden="true">·</span>
          <span>{camera.resolution}</span>
          {camera.nightMode && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[#9d4edd] font-bold">IR BOOST</span>
            </>
          )}
        </div>

        {/* Bottom-Left Scenario Tape Selector */}
        {camera.sourceType !== 'local_webcam' && !remoteFrameUrl && (
          <div className="absolute bottom-2 left-2 z-10">
            <select
              aria-label={`Simulation feed scenario for ${camera.name}`}
              value={camera.activeScenario}
              onChange={(e) =>
                onChangeScenario(
                  camera.id,
                  e.target.value as SimulationScenario
                )
              }
              className="bg-[#0a0a0d]/90 border-2 border-[#383e52] hover:border-[#ffd600] text-[#f4f1ea] text-[11px] font-mono font-semibold px-2 py-1 focus:outline-none focus:border-[#ffd600] cursor-pointer"
            >
              {(Object.keys(SCENARIO_LABELS) as SimulationScenario[]).map(
                (key) => (
                  <option key={key} value={key}>
                    {SCENARIO_LABELS[key]}
                  </option>
                )
              )}
            </select>
          </div>
        )}
      </div>

      {/* Per-Camera AlfredCam Street Deck Control Bar */}
      <div
        className={`flex flex-wrap items-center justify-between gap-2 px-3 ${
          compact ? 'py-2' : 'py-2.5'
        } bg-[#13151c] border-t-2 border-[#2e3344]`}
      >
        <div className="flex items-center gap-2">
          {/* Dedicated Per-Camera Mute / Audio Button */}
          <button
            type="button"
            onClick={() => onToggleMute(camera.id)}
            className={`nyc-btn px-3 py-1.5 min-h-[38px] text-xs whitespace-nowrap shrink-0 ${
              camera.muted ? 'nyc-btn-dark' : 'nyc-btn-blue'
            }`}
          >
            {camera.muted ? (
              <>
                <VolumeX className="w-3.5 h-3.5 text-[#a0a6b8]" />
                <span>Muted</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                <span>Audio Live</span>
              </>
            )}
          </button>

          {/* Dedicated Per-Camera Night Mode Button */}
          <button
            type="button"
            onClick={() => onToggleNightMode(camera.id)}
            className={`nyc-btn px-3 py-1.5 min-h-[38px] text-xs whitespace-nowrap shrink-0 ${
              camera.nightMode ? 'nyc-btn-purple' : 'nyc-btn-dark'
            }`}
          >
            {camera.nightMode ? (
              <>
                <Moon className="w-3.5 h-3.5" />
                <span>Night IR On</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-[#ffd600]" />
                <span>Night Mode</span>
              </>
            )}
          </button>
        </div>

        {/* Automated 15s H.264 Capture -> Gemini 2.5 Flash Watchman Trigger */}
        <button
          type="button"
          disabled={isAnalyzing}
          onClick={() => onTriggerWatchman(camera)}
          className={`nyc-btn px-3.5 py-1.5 min-h-[38px] text-xs whitespace-nowrap shrink-0 ${
            isAnalyzing ? 'nyc-btn-red' : 'nyc-btn-yellow'
          }`}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>15s H.264 + AI...</span>
            </>
          ) : (
            <>
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>15s Watchman</span>
            </>
          )}
        </button>
      </div>
    </article>
  );
};
