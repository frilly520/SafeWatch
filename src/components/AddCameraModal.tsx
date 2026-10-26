import React, { useEffect, useState } from 'react';
import {
  X,
  Wifi,
  Smartphone,
  Globe,
  RefreshCw,
  Check,
  Camera,
  Plus,
  Copy,
} from 'lucide-react';
import type {
  CameraNode,
  DiscoveredX5Device,
  RemotePhoneCamera,
} from '../types/camera';

interface AddCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCamera: (camera: CameraNode) => void;
  onSwitchToPhoneTransmitter: () => void;
  remotePhoneNodes: RemotePhoneCamera[];
}

export const AddCameraModal: React.FC<AddCameraModalProps> = ({
  isOpen,
  onClose,
  onAddCamera,
  onSwitchToPhoneTransmitter,
  remotePhoneNodes,
}) => {
  const [activeTab, setActiveTab] = useState<'x5' | 'phone' | 'ip'>('x5');
  const [scanningX5, setScanningX5] = useState(false);
  const [discoveredX5, setDiscoveredX5] = useState<DiscoveredX5Device[]>([]);
  const [scannedSubnets, setScannedSubnets] = useState<string[]>([]);
  const [scanDurationMs, setScanDurationMs] = useState<number>(0);

  const [customName, setCustomName] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [customIpOrUrl, setCustomIpOrUrl] = useState(
    'http://192.168.4.1:8080/video.mjpg'
  );
  const [customSsid, setCustomSsid] = useState('Z-IOT-9B10');
  const [copiedLink, setCopiedLink] = useState(false);

  const runX5Discovery = async () => {
    setScanningX5(true);
    try {
      const res = await fetch('/api/x5/discover');
      if (res.ok) {
        const data = await res.json();
        setDiscoveredX5(data.devices || []);
        setScannedSubnets(data.scannedSubnets || []);
        setScanDurationMs(data.scanDurationMs || 0);
      }
    } catch {
      // ignore error
    } finally {
      setScanningX5(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'x5') {
      void runX5Discovery();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleAddDiscoveredX5 = (dev: DiscoveredX5Device) => {
    const newCam: CameraNode = {
      id: `cam-x5-${Date.now()}`,
      name: `X5 Mini (${dev.ssid})`,
      location: 'Borough P2P Zone',
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
      bitrateKbps: 1380,
      resolution: '1080p H.264',
      activeScenario: 'INTRUDER_PROWL',
    };
    onAddCamera(newCam);
    onClose();
  };

  const handleAddLocalWebcam = () => {
    const newCam: CameraNode = {
      id: `cam-webcam-${Date.now()}`,
      name: customName.trim() || 'This Device Camera',
      location: customLocation.trim() || 'Local Browser Rig',
      sourceType: 'local_webcam',
      model: 'WebRTC Hardware Camera',
      localIp: '127.0.0.1 (Direct)',
      streamUrl: 'mediadevices://webcam',
      muted: true,
      nightMode: false,
      motionAutoRecord: true,
      online: true,
      fps: 30,
      bitrateKbps: 2200,
      resolution: '1080p Live',
      activeScenario: 'NORMAL_PATROL',
    };
    onAddCamera(newCam);
    onClose();
  };

  const handleAddRemotePhone = (node: RemotePhoneCamera) => {
    const newCam: CameraNode = {
      id: `cam-phone-${node.nodeId}`,
      name: node.name,
      location: 'Burner Phone Node',
      sourceType: 'phone_node',
      model: 'AlfredCam Spare Phone Node',
      localIp: `WS Pair #${node.pairingCode}`,
      streamUrl: `wss://relay/${node.nodeId}`,
      muted: node.muted,
      nightMode: node.nightMode,
      motionAutoRecord: true,
      online: true,
      fps: 24,
      bitrateKbps: 1650,
      resolution: '720p Live Phone',
      activeScenario: 'NORMAL_PATROL',
      remotePhoneNodeId: node.nodeId,
    };
    onAddCamera(newCam);
    onClose();
  };

  const handleAddIpStream = (e: React.FormEvent) => {
    e.preventDefault();
    const isX5 = activeTab === 'x5';
    const newCam: CameraNode = {
      id: `cam-${isX5 ? 'x5' : 'ip'}-${Date.now()}`,
      name:
        customName.trim() ||
        (isX5 ? `X5 Cam (${customSsid})` : 'Custom IP Camera'),
      location: customLocation.trim() || 'Custom Block Zone',
      sourceType: isX5 ? 'x5_ziot' : 'ip_stream',
      model: isX5 ? 'X5 Mini Camera (Model: X5)' : 'RTSP / MJPEG IP Camera',
      fccId: isX5 ? '2BCLC-A9' : undefined,
      ssid: isX5 ? customSsid : undefined,
      localIp:
        customIpOrUrl.replace(/^https?:\/\/|^rtsp:\/\//, '').split('/')[0] ||
        '192.168.1.150:8080',
      streamUrl: customIpOrUrl,
      muted: true,
      nightMode: false,
      motionAutoRecord: true,
      online: true,
      fps: 15,
      bitrateKbps: 1400,
      resolution: '1080p H.264',
      activeScenario: 'INTRUDER_PROWL',
    };
    onAddCamera(newCam);
    onClose();
  };

  const phonePairUrl = `${window.location.origin}/?mode=phone_transmitter`;

  const copyPairLink = () => {
    void navigator.clipboard.writeText(phonePairUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="w-full max-w-2xl nyc-panel-yellow bg-[#12141a] text-[#f4f1ea]">
        {/* Top Caution Bar */}
        <div className="h-2.5 w-full hazard-stripe-yellow" />

        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[#2e3344] px-6 py-4 bg-[#0a0a0d]">
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#ffd600]">
              HOOK UP NEW EYES // ZERO-CONFIG RIGGING
            </p>
            <h2 className="font-graffiti text-2xl text-[#f4f1ea] mt-0.5">
              Drop A Camera On The Block
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="nyc-btn nyc-btn-dark p-2 text-[#f4f1ea]"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3-Mode Subway Line Selector Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 border-b-2 border-[#2e3344] bg-[#0a0a0d] p-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('x5')}
            className={`nyc-btn py-2.5 px-3 text-xs whitespace-nowrap shrink-0 ${
              activeTab === 'x5' ? 'nyc-btn-yellow' : 'nyc-btn-dark'
            }`}
          >
            <span className="mta-bullet bg-[#ff2a3b] text-white">X5</span>
            <Wifi className="w-3.5 h-3.5" />
            <span>X5 Mini (Z-IOT Scan)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('phone')}
            className={`nyc-btn py-2.5 px-3 text-xs whitespace-nowrap shrink-0 ${
              activeTab === 'phone' ? 'nyc-btn-blue' : 'nyc-btn-dark'
            }`}
          >
            <span className="mta-bullet bg-[#00d2ff] text-[#0a0a0d]">B</span>
            <Smartphone className="w-3.5 h-3.5" />
            <span>Old Phone Cam</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ip')}
            className={`nyc-btn py-2.5 px-3 text-xs whitespace-nowrap shrink-0 ${
              activeTab === 'ip' ? 'nyc-btn-purple' : 'nyc-btn-dark'
            }`}
          >
            <span className="mta-bullet bg-[#9d4edd] text-white">IP</span>
            <Globe className="w-3.5 h-3.5" />
            <span>Free IP / RTSP</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto concrete-surface">
          {activeTab === 'x5' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 nyc-panel p-4 bg-[#0a0a0d]">
                <div>
                  <h3 className="font-stencil text-sm font-bold uppercase text-[#ffd600]">
                    X5 Mini P2P Scanner · Model: X5 · FCC ID: 2BCLC-A9
                  </h3>
                  <p className="text-xs text-[#a0a6b8] mt-1">
                    Intercepts unencrypted local Wi-Fi feeds broadcasting under{' '}
                    <code className="text-[#00d2ff] font-bold">Z-IOT*</code> or{' '}
                    <code className="text-[#00d2ff] font-bold">ZIOT*</code> access points.
                  </p>
                  {scannedSubnets.length > 0 && (
                    <p className="text-[11px] font-mono text-[#a0a6b8] mt-1.5 tabular-nums">
                      Swept: {scannedSubnets.join(' · ')} ({scanDurationMs}ms)
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void runX5Discovery()}
                  disabled={scanningX5}
                  className="nyc-btn nyc-btn-dark px-3.5 py-2 min-h-[40px] text-xs whitespace-nowrap shrink-0"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 text-[#ffd600] ${
                      scanningX5 ? 'animate-spin' : ''
                    }`}
                  />
                  <span>{scanningX5 ? 'Scanning LAN...' : 'Rescan Z-IOT'}</span>
                </button>
              </div>

              <div className="space-y-2.5">
                <p className="font-stencil text-xs font-bold uppercase tracking-wider text-[#f4f1ea]">
                  Discovered X5 Transmitters (1-Click Hookup)
                </p>
                {discoveredX5.map((dev) => (
                  <div
                    key={dev.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 nyc-panel px-4 py-3 bg-[#0e1016] hover:border-[#ffd600]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-bold text-[#f4f1ea]">
                        <span className="text-[#ffd600] font-mono">
                          {dev.ssid}
                        </span>
                        <span className="text-[#59607a]">/</span>
                        <span className="text-xs font-medium text-[#a0a6b8]">
                          {dev.model}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#a0a6b8] tabular-nums mt-1">
                        <span>
                          IP {dev.localIp}:{dev.port}
                        </span>
                        <span>·</span>
                        <span className="text-[#00d2ff]">FCC {dev.fccId}</span>
                        <span>·</span>
                        <span>{dev.protocol}</span>
                        <span>·</span>
                        <span className="text-[#ffd600]">UNENCRYPTED FEED</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddDiscoveredX5(dev)}
                      className="nyc-btn nyc-btn-yellow px-3.5 py-2 min-h-[40px] text-xs whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Lock In X5</span>
                    </button>
                  </div>
                ))}
              </div>

              {/* Manual Z-IOT IP Override */}
              <form
                onSubmit={handleAddIpStream}
                className="border-t-2 border-[#2e3344] pt-4 space-y-3"
              >
                <p className="font-stencil text-xs font-bold uppercase tracking-wider text-[#f4f1ea]">
                  Or Punch In Manual Z-IOT IP Address
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Cam Name (e.g. Stoop X5)"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="nyc-input"
                  />
                  <input
                    type="text"
                    placeholder="SSID (e.g. Z-IOT-8A4F)"
                    value={customSsid}
                    onChange={(e) => setCustomSsid(e.target.value)}
                    className="nyc-input font-mono"
                  />
                  <input
                    type="text"
                    placeholder="http://192.168.4.1:8080/video.mjpg"
                    value={customIpOrUrl}
                    onChange={(e) => setCustomIpOrUrl(e.target.value)}
                    className="nyc-input font-mono"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="nyc-btn nyc-btn-dark px-4 py-2 min-h-[40px] text-xs whitespace-nowrap shrink-0"
                  >
                    Add Custom X5 Node
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'phone' && (
            <div className="space-y-4">
              {/* Instant 1-Click Local Device Camera */}
              <div className="nyc-panel-blue p-4 bg-[#0a0a0d] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-stencil text-sm font-bold uppercase text-[#00d2ff]">
                    Option A: Use This Device&apos;s Camera Right Now
                  </h3>
                  <p className="text-xs text-[#a0a6b8] mt-1">
                    Drop your current phone, tablet, or laptop lens straight into the surveillance wall with Night Vision IR and 15-second AI Watchman recording.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddLocalWebcam}
                  className="nyc-btn nyc-btn-blue px-4 py-2.5 min-h-[42px] text-xs whitespace-nowrap shrink-0"
                >
                  <Camera className="w-4 h-4" />
                  <span>Add My Camera Now</span>
                </button>
              </div>

              {/* Spare Phone AlfredCam Pairing */}
              <div className="nyc-panel p-4 bg-[#0a0a0d] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-stencil text-sm font-bold uppercase text-[#ffd600]">
                      Option B: Turn an Old Cracked Phone Into a Street Cam (AlfredCam Style)
                    </h3>
                    <p className="text-xs text-[#a0a6b8] mt-1">
                      Open safeWatch on any spare phone and hit{' '}
                      <strong className="text-[#f4f1ea]">
                        Burner Phone Cam Mode
                      </strong>
                      . It streams live video, motion alerts, and Night Vision to this deck.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSwitchToPhoneTransmitter();
                    }}
                    className="nyc-btn nyc-btn-yellow px-3.5 py-2 min-h-[40px] text-xs whitespace-nowrap shrink-0"
                  >
                    Launch Burner Mode Here
                  </button>
                </div>

                <div className="flex items-center gap-2 bg-[#13151c] border-2 border-[#2e3344] p-2.5">
                  <code className="text-xs font-mono text-[#00d2ff] truncate flex-1">
                    {phonePairUrl}
                  </code>
                  <button
                    type="button"
                    onClick={copyPairLink}
                    className="nyc-btn nyc-btn-dark px-3 py-1.5 text-xs whitespace-nowrap shrink-0"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#ffd600]" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>

                {remotePhoneNodes.length > 0 && (
                  <div className="pt-2 space-y-2">
                    <p className="font-stencil text-xs font-bold uppercase text-[#00d2ff]">
                      Live Spare Phones Broadcasting ({remotePhoneNodes.length})
                    </p>
                    {remotePhoneNodes.map((node) => (
                      <div
                        key={node.nodeId}
                        className="flex items-center justify-between nyc-panel px-3 py-2 bg-[#13151c]"
                      >
                        <div className="text-xs">
                          <span className="font-bold text-[#f4f1ea]">
                            {node.name}
                          </span>
                          <span className="text-[#59607a] mx-1.5">·</span>
                          <span className="font-mono text-[#ffd600]">
                            PAIR #{node.pairingCode}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddRemotePhone(node)}
                          className="nyc-btn nyc-btn-yellow px-3 py-1 text-xs"
                        >
                          Add to Matrix
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'ip' && (
            <form onSubmit={handleAddIpStream} className="space-y-4">
              <div className="nyc-panel p-4 bg-[#0a0a0d] space-y-3">
                <h3 className="font-stencil text-sm font-bold uppercase text-[#9d4edd]">
                  Connect Any Free IP Camera (RTSP / MJPEG / HTTP / ONVIF)
                </h3>
                <p className="text-xs text-[#a0a6b8]">
                  Drop in any local IP stream URL. Supports IP Webcam, DroidCam, OpenIPC, RTSP, and MJPEG endpoints.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block font-stencil text-xs font-bold uppercase text-[#f4f1ea] mb-1">
                      Camera Tag / Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Bodega Gate Cam"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="w-full nyc-input"
                    />
                  </div>
                  <div>
                    <label className="block font-stencil text-xs font-bold uppercase text-[#f4f1ea] mb-1">
                      Spot / Zone
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Fire Escape / Alley"
                      value={customLocation}
                      onChange={(e) => setCustomLocation(e.target.value)}
                      className="w-full nyc-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-stencil text-xs font-bold uppercase text-[#f4f1ea] mb-1">
                    Stream URL (RTSP / HTTP MJPEG / HLS)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="rtsp://192.168.1.120:554/live/ch0 or http://192.168.1.120:8080/video"
                    value={customIpOrUrl}
                    onChange={(e) => setCustomIpOrUrl(e.target.value)}
                    className="w-full nyc-input font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="nyc-btn nyc-btn-dark px-4 py-2 min-h-[40px] text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="nyc-btn nyc-btn-yellow px-4 py-2 min-h-[40px] text-xs"
                >
                  Add IP Camera to Matrix
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
