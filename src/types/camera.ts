export type CameraSourceType = 'x5_ziot' | 'phone_node' | 'local_webcam' | 'ip_stream';

export type GridLayoutMode = 1 | 4 | 8;

export type SimulationScenario =
  | 'NORMAL_PATROL'
  | 'INTRUDER_PROWL'
  | 'DELIVERY_VEHICLE'
  | 'AMBIENT_SHADOWS'
  | 'SAFETY_SMOKE';

export interface CameraNode {
  id: string;
  name: string;
  location: string;
  sourceType: CameraSourceType;
  model: string;
  fccId?: string;
  ssid?: string;
  localIp: string;
  streamUrl: string;
  muted: boolean;
  nightMode: boolean;
  motionAutoRecord: boolean;
  online: boolean;
  fps: number;
  bitrateKbps: number;
  resolution: string;
  activeScenario: SimulationScenario;
  remotePhoneNodeId?: string;
  deviceId?: string;
  lastMotionAt?: number;
}

export interface PipelineStepLog {
  step: string;
  status: 'completed' | 'active' | 'error';
  detail: string;
  timestamp: number;
}

export interface WatchmanIncident {
  id: string;
  cameraId: string;
  cameraName: string;
  cameraModel: string;
  createdAt: number;
  durationSec: number;
  codec: string;
  fileSizeBytes: number;
  geminiFileName: string;
  geminiFileUri: string;
  cloudDeletedAt: number | null;
  cloudDeleteVerified: boolean;
  threatVerified: boolean;
  threatLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: 'AMBIENT_IGNORED' | 'HUMAN_PRESENCE' | 'VEHICLE_MOVEMENT' | 'SAFETY_HAZARD';
  confidence: number;
  summary: string;
  detectedObjects: string[];
  watchmanReasoning: string;
  recommendedAction: string;
  webhookDispatched: boolean;
  webhookEndpoint: string;
  webhookStatus: number | null;
  pipelineSteps: PipelineStepLog[];
}

export interface DiscoveredX5Device {
  id: string;
  ssid: string;
  model: string;
  fccId: string;
  localIp: string;
  port: number;
  protocol: 'HTTP_MJPEG' | 'RTSP_P2P' | 'UDP_P2P';
  streamUrl: string;
  signalDbm: number;
  encrypted: boolean;
  firmware: string;
  discoveredVia: 'LAN_PROBE' | 'ARP_CACHE' | 'ZIOT_BEACON';
  lastSeen: number;
}

export interface WebhookConfig {
  enabled: boolean;
  endpointUrl: string;
  pushNotificationsEnabled: boolean;
  ignoreAmbient: boolean;
  clipDurationSec: number;
  autoPrivacyDelete: boolean;
}

export interface WebhookLogEntry {
  id: string;
  timestamp: number;
  endpoint: string;
  statusCode: number;
  payload: Record<string, unknown>;
}

export interface RemotePhoneCamera {
  nodeId: string;
  name: string;
  pairingCode: string;
  connectedAt: number;
  lastHeartbeat: number;
  batteryLevel?: number;
  facingMode: 'environment' | 'user';
  nightMode: boolean;
  muted: boolean;
  motionActive: boolean;
  latestFrameDataUrl?: string;
}

export const INITIAL_CAMERAS: CameraNode[] = [
  {
    id: 'cam-x5-porch',
    name: 'Front Porch X5',
    location: 'Main Entryway',
    sourceType: 'x5_ziot',
    model: 'X5 Mini Camera (Model: X5)',
    fccId: '2BCLC-A9',
    ssid: 'Z-IOT-8A4F',
    localIp: '192.168.4.1:8080',
    streamUrl: 'http://192.168.4.1:8080/stream.mjpg',
    muted: true,
    nightMode: false,
    motionAutoRecord: true,
    online: true,
    fps: 15,
    bitrateKbps: 1420,
    resolution: '1080p H.264',
    activeScenario: 'INTRUDER_PROWL',
  },
  {
    id: 'cam-x5-driveway',
    name: 'Driveway Gate X5',
    location: 'North Driveway',
    sourceType: 'x5_ziot',
    model: 'X5 Mini Wide-Angle (Model: X5)',
    fccId: '2BCLC-A9',
    ssid: 'ZIOT-X5-C912',
    localIp: '192.168.10.1:554',
    streamUrl: 'rtsp://192.168.10.1:554/live/ch0',
    muted: true,
    nightMode: true,
    motionAutoRecord: true,
    online: true,
    fps: 15,
    bitrateKbps: 1280,
    resolution: '1080p H.264',
    activeScenario: 'DELIVERY_VEHICLE',
  },
  {
    id: 'cam-phone-nursery',
    name: 'Old Pixel 4a (AlfredCam)',
    location: 'Hallway / Side Door',
    sourceType: 'phone_node',
    model: 'Spare Android Phone Node',
    localIp: '192.168.1.44:3000',
    streamUrl: 'wss://local-relay/phone-node-1',
    muted: true,
    nightMode: false,
    motionAutoRecord: true,
    online: true,
    fps: 24,
    bitrateKbps: 1850,
    resolution: '720p WebRTC',
    activeScenario: 'AMBIENT_SHADOWS',
  },
  {
    id: 'cam-ip-backyard',
    name: 'Backyard Patio IP',
    location: 'Rear Garden',
    sourceType: 'ip_stream',
    model: 'OpenIPC / RTSP Stream',
    localIp: '192.168.1.112:8554',
    streamUrl: 'rtsp://192.168.1.112:8554/main',
    muted: true,
    nightMode: true,
    motionAutoRecord: true,
    online: true,
    fps: 20,
    bitrateKbps: 1640,
    resolution: '1080p RTSP',
    activeScenario: 'AMBIENT_SHADOWS',
  },
  {
    id: 'cam-x5-garage',
    name: 'Garage Workshop X5',
    location: 'Detached Garage',
    sourceType: 'x5_ziot',
    model: 'X5 Mini Camera (Model: X5)',
    fccId: '2BCLC-A9',
    ssid: 'Z-IOT-3F19',
    localIp: '192.168.4.2:8080',
    streamUrl: 'http://192.168.4.2:8080/video.mjpg',
    muted: true,
    nightMode: false,
    motionAutoRecord: true,
    online: true,
    fps: 15,
    bitrateKbps: 1190,
    resolution: '1080p H.264',
    activeScenario: 'SAFETY_SMOKE',
  },
  {
    id: 'cam-phone-kitchen',
    name: 'Spare iPhone SE (AlfredCam)',
    location: 'Kitchen & Patio Glass',
    sourceType: 'phone_node',
    model: 'Spare iOS Phone Node',
    localIp: '192.168.1.61:3000',
    streamUrl: 'wss://local-relay/phone-node-2',
    muted: true,
    nightMode: false,
    motionAutoRecord: false,
    online: true,
    fps: 24,
    bitrateKbps: 1520,
    resolution: '720p WebRTC',
    activeScenario: 'NORMAL_PATROL',
  },
  {
    id: 'cam-ip-alley',
    name: 'Side Alleyway IP',
    location: 'East Perimeter Fence',
    sourceType: 'ip_stream',
    model: 'ONVIF Free IP Cam',
    localIp: '192.168.1.118:8080',
    streamUrl: 'http://192.168.1.118:8080/mjpeg',
    muted: true,
    nightMode: true,
    motionAutoRecord: true,
    online: true,
    fps: 15,
    bitrateKbps: 1310,
    resolution: '1080p MJPEG',
    activeScenario: 'INTRUDER_PROWL',
  },
  {
    id: 'cam-ip-shed',
    name: 'Tool Shed & Gate IP',
    location: 'South Storage',
    sourceType: 'ip_stream',
    model: 'RTSP Generic Camera',
    localIp: '192.168.1.124:554',
    streamUrl: 'rtsp://192.168.1.124:554/stream1',
    muted: true,
    nightMode: false,
    motionAutoRecord: true,
    online: true,
    fps: 15,
    bitrateKbps: 1150,
    resolution: '720p RTSP',
    activeScenario: 'NORMAL_PATROL',
  },
];
