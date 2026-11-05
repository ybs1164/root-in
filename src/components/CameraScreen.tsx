import { Minus, Plus, RefreshCw, RotateCcw, Send, X } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { CAMERA_ZOOM, captureFrame, clampCameraZoom, openCamera, stopCamera, type Facing } from '../lib/camera';

/**
 * The camera, from the camera button: a square (1:1) live view, a big
 * shutter, ✕ to leave and ⟳ to switch to the front camera. A shot stays up
 * over the view with 다시 찍기 and 전송, which hands it to `onSend` (App asks
 * which groups, then sends it with a ping of where I am).
 */
export default function CameraScreen({ onSend, onClose }: { onSend: (photo: string, takenAt: Date) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [facing, setFacing] = useState<Facing>('environment');
  const [state, setState] = useState<'starting' | 'live' | 'failed'>('starting');
  const [shot, setShot] = useState<string | null>(null);
  // When the shutter went: the photo's time wherever it's shown, however long 전송 takes.
  const takenAt = useRef(new Date());
  const [flash, setFlash] = useState(0);
  const [zoom, setZoom] = useState<number>(1);
  const zoomRef = useRef(1);
  const fingers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const changeZoom = (value: number) => {
    zoomRef.current = clampCameraZoom(value);
    setZoom(zoomRef.current);
  };
  const distance = () => {
    const [a, b] = [...fingers.current.values()];
    return a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0;
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (shot || state !== 'live' || fingers.current.size >= 2) return;
    fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);
    if (fingers.current.size === 2) pinch.current = { distance: distance(), zoom: zoomRef.current };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!fingers.current.has(e.pointerId)) return;
    fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const start = pinch.current;
    if (start && start.distance > 0) changeZoom(start.zoom * distance() / start.distance);
  };
  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    if (fingers.current.delete(e.pointerId)) pinch.current = null;
  };

  useEffect(() => {
    fingers.current.clear();
    pinch.current = null;
  }, [shot, facing, state]);

  // A new stream for each camera; the old one is stopped so the light goes off.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let gone = false;
    setState('starting');
    zoomRef.current = 1;
    setZoom(1);
    void openCamera(facing).then((s) => {
      if (gone) return stopCamera(s);
      stream = s;
      const el = video.current;
      if (!s || !el) return setState('failed');
      el.srcObject = s;
      void el.play().catch(() => {});
      setState('live');
    });
    return () => {
      gone = true;
      stopCamera(stream);
    };
  }, [facing]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      // An open popup (the groups to send to) takes its own Esc.
      if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
      if (shot) setShot(null);
      else onClose();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [shot, onClose]);

  const shoot = () => {
    const el = video.current;
    if (!el || state !== 'live') return;
    // Always a square, whatever shape the view ended up on screen: its middle.
    const { width, height } = el.getBoundingClientRect();
    const side = Math.min(width, height);
    const url = captureFrame(el, { width: side, height: side }, facing === 'user', zoomRef.current);
    if (!url) return;
    setFlash((n) => n + 1);
    takenAt.current = new Date();
    setShot(url);
  };

  return (
    <div className="camera" role="dialog" aria-modal="true" aria-label="카메라">
      {/* Square: the photo is cropped to exactly this box (captureFrame reads its size). */}
      <div
        className="camera__frame"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onLostPointerCapture={onPointerEnd}
      >
        <video ref={video} className={`camera__view ${facing === 'user' ? 'is-mirrored' : ''}`} style={{ transform: `scale(${zoom})` }} playsInline muted autoPlay />
        {flash > 0 && <div key={flash} className="camera__flash" aria-hidden />}
        {shot && <img className="camera__shot" src={shot} alt="찍은 사진" />}
      </div>
      {state === 'failed' && (
        <p className="camera__message">
          카메라를 쓸 수 없어요.
          <br />
          카메라 권한을 허용했는지 확인해 주세요.
        </p>
      )}

      <button type="button" className="camera__btn camera__close" aria-label="카메라 닫기" onClick={onClose}>
        <X size={24} strokeWidth={2.2} />
      </button>

      <div className="camera__bar">
        {shot ? (
          <>
            <button type="button" className="camera__btn" aria-label="다시 찍기" onClick={() => setShot(null)}>
              <RotateCcw size={22} strokeWidth={2.2} />
            </button>
            <button type="button" className="camera__send" onClick={() => onSend(shot, takenAt.current)}>
              <Send size={20} strokeWidth={2.4} aria-hidden />
              전송
            </button>
            <span className="camera__spacer" aria-hidden />
          </>
        ) : (
          <>
            <div className="camera__zoom" role="group" aria-label="카메라 줌">
              <button type="button" className="camera__btn" aria-label="줌 아웃" disabled={state !== 'live' || zoom <= CAMERA_ZOOM.min} onClick={() => changeZoom(zoomRef.current - CAMERA_ZOOM.step)}>
                <Minus size={20} strokeWidth={2.2} />
              </button>
              <input
                type="range"
                min={CAMERA_ZOOM.min}
                max={CAMERA_ZOOM.max}
                step={CAMERA_ZOOM.step}
                value={zoom}
                disabled={state !== 'live'}
                aria-label="카메라 줌 배율"
                aria-valuetext={`${zoom.toFixed(1)}배`}
                onChange={(e) => changeZoom(Number(e.target.value))}
              />
              <output className="camera__zoom-value" aria-label="현재 줌 배율">{zoom.toFixed(1)}×</output>
              <button type="button" className="camera__btn" aria-label="줌 인" disabled={state !== 'live' || zoom >= CAMERA_ZOOM.max} onClick={() => changeZoom(zoomRef.current + CAMERA_ZOOM.step)}>
                <Plus size={20} strokeWidth={2.2} />
              </button>
            </div>
            <span className="camera__spacer" aria-hidden />
            <button type="button" className="camera__shutter" aria-label="사진 찍기" disabled={state !== 'live'} onClick={shoot} />
            <button
              type="button"
              className="camera__btn"
              aria-label={facing === 'user' ? '후면 카메라로' : '전면 카메라로'}
              onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
            >
              <RefreshCw size={22} strokeWidth={2.2} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
