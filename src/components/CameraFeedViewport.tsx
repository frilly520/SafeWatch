import React, { useEffect, useRef, useState } from 'react';
import type { CameraNode } from '../types/camera';

interface CameraFeedViewportProps {
  camera: CameraNode;
  remoteFrameUrl?: string;
  onCaptureRef?: (id: string, captureFn: () => string | undefined) => void;
}

export const CameraFeedViewport: React.FC<CameraFeedViewportProps> = ({
  camera,
  remoteFrameUrl,
  onCaptureRef,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const noiseNodeRef = useRef<AudioNode | null>(null);
  const [webcamError, setWebcamError] = useState<string>('');

  // Register frame capture callback so Watchman pipeline can grab the exact visual frame
  useEffect(() => {
    if (!onCaptureRef) return;
    onCaptureRef(camera.id, () => {
      if (camera.sourceType === 'local_webcam' && videoRef.current) {
        const v = videoRef.current;
        if (v.videoWidth > 0 && v.videoHeight > 0) {
          const off = document.createElement('canvas');
          off.width = 640;
          off.height = 360;
          const ctx = off.getContext('2d');
          if (ctx) {
            ctx.drawImage(v, 0, 0, off.width, off.height);
            return off.toDataURL('image/jpeg', 0.85);
          }
        }
      }
      if (canvasRef.current) {
        return canvasRef.current.toDataURL('image/jpeg', 0.85);
      }
      return remoteFrameUrl;
    });
  }, [camera.id, camera.sourceType, onCaptureRef, remoteFrameUrl]);

  // Handle local webcam if sourceType === 'local_webcam'
  useEffect(() => {
    if (camera.sourceType !== 'local_webcam') return;
    let activeStream: MediaStream | null = null;
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({
        video: camera.deviceId
          ? { deviceId: { exact: camera.deviceId } }
          : { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        activeStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setWebcamError(
            err instanceof Error ? err.message : 'Camera permission required'
          );
        }
      });

    return () => {
      cancelled = true;
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [camera.sourceType, camera.deviceId]);

  // Handle ambient audio synthesis when unmuted on simulated/IP/X5 streams
  useEffect(() => {
    if (camera.sourceType === 'local_webcam') {
      if (videoRef.current) {
        videoRef.current.muted = camera.muted;
      }
      return;
    }

    if (camera.muted) {
      if (noiseNodeRef.current) {
        try {
          noiseNodeRef.current.disconnect();
        } catch {
          // ignore
        }
        noiseNodeRef.current = null;
      }
      return;
    }

    // Create subtle ambient outdoor microphone noise when unmuted
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = audioCtxRef.current || new AudioContextClass();
      audioCtxRef.current = ctx;
      void ctx.resume();

      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.015;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 600;

      const gain = ctx.createGain();
      gain.gain.value = 0.08;

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
      noiseNodeRef.current = gain;
    } catch {
      // Audio blocked by browser autoplay policy until interaction
    }

    return () => {
      if (noiseNodeRef.current) {
        try {
          noiseNodeRef.current.disconnect();
        } catch {
          // ignore
        }
        noiseNodeRef.current = null;
      }
    };
  }, [camera.muted, camera.sourceType]);

  // Render simulated live security camera canvas for X5 / IP / Phone feeds
  useEffect(() => {
    if (camera.sourceType === 'local_webcam' && !webcamError) return;
    if (remoteFrameUrl) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let tick = Math.floor(Math.random() * 500);

    const render = () => {
      tick += 1;
      const w = canvas.width;
      const h = canvas.height;
      const isNight = camera.nightMode;
      const scenario = camera.activeScenario;

      // Background NYC alley / stoop concrete scene
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      if (isNight) {
        grad.addColorStop(0, '#07140d');
        grad.addColorStop(0.5, '#0b2416');
        grad.addColorStop(1, '#05120a');
      } else {
        grad.addColorStop(0, '#0c0d12');
        grad.addColorStop(0.5, '#171922');
        grad.addColorStop(1, '#0e1017');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Perspective ground / sidewalk grid
      ctx.strokeStyle = isNight
        ? 'rgba(0, 210, 255, 0.14)'
        : 'rgba(244, 241, 234, 0.09)';
      ctx.lineWidth = 1;

      const horizonY = Math.floor(h * 0.44);
      ctx.beginPath();
      ctx.moveTo(0, horizonY);
      ctx.lineTo(w, horizonY);
      ctx.stroke();

      // NYC Brownstone / Roll-down Bodega Gate structure on left
      ctx.fillStyle = isNight ? 'rgba(12, 42, 26, 0.75)' : 'rgba(26, 29, 39, 0.85)';
      ctx.fillRect(w * 0.1, h * 0.1, w * 0.28, horizonY - h * 0.1);
      ctx.strokeRect(w * 0.1, h * 0.1, w * 0.28, horizonY - h * 0.1);

      // Corrugated steel gate lines
      for (let gy = h * 0.14; gy < horizonY; gy += 9) {
        ctx.beginPath();
        ctx.moveTo(w * 0.12, gy);
        ctx.lineTo(w * 0.36, gy);
        ctx.stroke();
      }

      // Subtle stencil wall tag on background brick (non-obstructive)
      ctx.save();
      ctx.font = 'bold 18px "Permanent Marker", monospace';
      ctx.fillStyle = isNight
        ? 'rgba(0, 210, 255, 0.12)'
        : 'rgba(255, 214, 0, 0.09)';
      ctx.fillText('BX-94 // X5', w * 0.68, horizonY - 18);
      ctx.restore();

      // Sidewalk perspective lines
      for (let i = 0; i <= 6; i++) {
        const topX = w * 0.2 + i * (w * 0.1);
        const botX = -w * 0.2 + i * (w * 0.24);
        ctx.beginPath();
        ctx.moveTo(topX, horizonY);
        ctx.lineTo(botX, h);
        ctx.stroke();
      }

      // Scenario-specific animated elements
      if (scenario === 'AMBIENT_SHADOWS') {
        // Swaying streetlight shadows + stray alley cat
        const sway = Math.sin(tick * 0.04) * 18;
        ctx.fillStyle = isNight
          ? 'rgba(4, 16, 10, 0.55)'
          : 'rgba(10, 10, 14, 0.5)';
        for (let b = 0; b < 4; b++) {
          ctx.beginPath();
          ctx.ellipse(
            w * 0.72 + sway + b * 18,
            h * 0.28 + b * 14,
            48,
            12,
            0.3 + Math.sin(tick * 0.02 + b) * 0.1,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
        // Stray alley cat crossing bottom right
        const petX = ((tick * 1.4) % (w * 0.7)) + w * 0.15;
        const petY = h * 0.76;
        ctx.fillStyle = isNight ? '#00d2ff' : '#a0a6b8';
        ctx.beginPath();
        ctx.ellipse(petX, petY, 14, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.fillStyle = isNight ? '#00d2ff' : '#f4f1ea';
        ctx.fillText('AMBIENT: ALLEY CAT / SHADOWS', petX - 48, petY - 14);
      } else if (scenario === 'INTRUDER_PROWL') {
        // Human figure approaching perimeter doorway with high-contrast target box
        const t = (tick % 240) / 240;
        const personX = w * 0.68 - t * (w * 0.36);
        const personY = h * 0.56 + Math.sin(tick * 0.15) * 2;

        // Silhouette
        ctx.fillStyle = isNight ? '#ffd600' : '#f4f1ea';
        ctx.beginPath();
        ctx.arc(personX, personY - 42, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(personX - 13, personY - 29, 26, 40);
        const stride = Math.sin(tick * 0.18) * 7;
        ctx.fillRect(personX - 11 + stride, personY + 11, 8, 26);
        ctx.fillRect(personX + 3 - stride, personY + 11, 8, 26);

        // Motion tracking box (Graffiti Red #FF2A3B)
        ctx.strokeStyle = '#ff2a3b';
        ctx.lineWidth = 2;
        ctx.strokeRect(personX - 28, personY - 62, 56, 108);
        ctx.fillStyle = '#ff2a3b';
        ctx.fillRect(personX - 28, personY - 79, 142, 17);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.fillText('INTRUDER LOCK // 96%', personX - 24, personY - 67);
      } else if (scenario === 'DELIVERY_VEHICLE') {
        // Vehicle pulling into curb / driveway
        const t = (tick % 260) / 260;
        const carX = w * 0.15 + t * (w * 0.45);
        const carY = h * 0.58;

        const beamGrad = ctx.createLinearGradient(carX + 80, carY, carX + 210, carY + 30);
        beamGrad.addColorStop(
          0,
          isNight ? 'rgba(0, 210, 255, 0.45)' : 'rgba(255, 214, 0, 0.42)'
        );
        beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(carX + 82, carY - 6);
        ctx.lineTo(carX + 215, carY - 35);
        ctx.lineTo(carX + 215, carY + 45);
        ctx.lineTo(carX + 82, carY + 18);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = isNight ? '#00d2ff' : '#d6d9e0';
        ctx.fillRect(carX - 48, carY - 24, 126, 38);
        ctx.fillRect(carX - 24, carY - 44, 74, 22);

        ctx.fillStyle = '#090a0f';
        ctx.beginPath();
        ctx.arc(carX - 22, carY + 16, 11, 0, Math.PI * 2);
        ctx.arc(carX + 52, carY + 16, 11, 0, Math.PI * 2);
        ctx.fill();

        // Bounding box (Spray Yellow #FFD600)
        ctx.strokeStyle = '#ffd600';
        ctx.lineWidth = 2;
        ctx.strokeRect(carX - 56, carY - 52, 144, 78);
        ctx.fillStyle = '#ffd600';
        ctx.fillRect(carX - 56, carY - 69, 144, 17);
        ctx.fillStyle = '#0a0a0d';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.fillText('VEHICLE MOTION // 94%', carX - 52, carY - 57);
      } else if (scenario === 'SAFETY_SMOKE') {
        for (let p = 0; p < 7; p++) {
          const cycle = ((tick * 1.2 + p * 28) % 140) / 140;
          const sx = w * 0.48 + Math.sin(tick * 0.05 + p) * (12 + cycle * 26);
          const sy = h * 0.72 - cycle * (h * 0.5);
          const radius = 14 + cycle * 34;
          ctx.fillStyle = isNight
            ? `rgba(157, 78, 221, ${0.42 * (1 - cycle)})`
            : `rgba(244, 241, 234, ${0.45 * (1 - cycle)})`;
          ctx.beginPath();
          ctx.arc(sx, sy, radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = '#ff2a3b';
        ctx.lineWidth = 2;
        ctx.strokeRect(w * 0.36, h * 0.22, w * 0.26, h * 0.54);
        ctx.fillStyle = '#ff2a3b';
        ctx.fillRect(w * 0.36, h * 0.22 - 17, 158, 17);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.fillText('HAZARD // SMOKE PLUME', w * 0.36 + 6, h * 0.22 - 5);
      }

      // IR Night Vision scanlines & vignette if nightMode enabled
      if (isNight) {
        ctx.fillStyle = 'rgba(0, 210, 255, 0.04)';
        for (let y = 0; y < h; y += 4) {
          ctx.fillRect(0, y, w, 1);
        }
        const rad = ctx.createRadialGradient(
          w / 2,
          h / 2,
          w * 0.2,
          w / 2,
          h / 2,
          w * 0.65
        );
        rad.addColorStop(0, 'rgba(0, 210, 255, 0.06)');
        rad.addColorStop(1, 'rgba(0, 0, 0, 0.58)');
        ctx.fillStyle = rad;
        ctx.fillRect(0, 0, w, h);
      }

      // OSD Timestamp & Hardware Watermark in top-left of video stream
      const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
      ctx.fillStyle = 'rgba(10, 10, 13, 0.82)';
      ctx.fillRect(8, 8, 304, 22);
      ctx.strokeStyle = isNight ? '#9d4edd' : '#ffd600';
      ctx.lineWidth = 1;
      ctx.strokeRect(8, 8, 304, 22);
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillStyle = isNight ? '#00d2ff' : '#ffd600';
      ctx.fillText(
        `REC // ${nowStr} · ${camera.ssid || camera.localIp}`,
        14,
        23
      );

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    camera.sourceType,
    camera.nightMode,
    camera.activeScenario,
    camera.ssid,
    camera.localIp,
    remoteFrameUrl,
    webcamError,
  ]);

  const nightFilterClass = camera.nightMode
    ? 'brightness-125 contrast-125 saturate-50 hue-rotate-[75deg]'
    : '';

  if (remoteFrameUrl) {
    return (
      <img
        src={remoteFrameUrl}
        alt={`${camera.name} live stream`}
        referrerPolicy="no-referrer"
        className={`h-full w-full object-cover transition-all duration-200 ${nightFilterClass}`}
      />
    );
  }

  if (camera.sourceType === 'local_webcam' && !webcamError) {
    return (
      <video
        ref={videoRef}
        playsInline
        muted={camera.muted}
        className={`h-full w-full object-cover transition-all duration-200 ${nightFilterClass}`}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={360}
      className="h-full w-full object-cover"
    />
  );
};
