export type Facing = 'environment' | 'user';

/** Digital zoom works on both cameras, including devices without track zoom controls. */
export const CAMERA_ZOOM = { min: 1, max: 4, step: 0.1 } as const;

/**
 * How far the camera zooms: out to `min` (below 1× only where the camera
 * itself can — a phone's ultra-wide lens) and in to `max`. `lens` is the
 * camera's own zoom where the browser lets the page drive it (sharper than
 * cropping); past it, and on cameras without, the frame is cropped (digital).
 */
export interface CameraZoomRange {
  min: number;
  max: number;
  lens: { min: number; max: number } | null;
}

export const DIGITAL_ZOOM: CameraZoomRange = { min: CAMERA_ZOOM.min, max: CAMERA_ZOOM.max, lens: null };
/** However far a camera's own zoom goes, the screen's slider stops here. */
const MAX_ZOOM = 10;

export function clampCameraZoom(zoom: number, range: CameraZoomRange = DIGITAL_ZOOM): number {
  if (!Number.isFinite(zoom)) return Math.max(range.min, Math.min(range.max, 1));
  return Math.round(Math.min(range.max, Math.max(range.min, zoom)) * 10) / 10;
}

/** The zoom a camera track allows (its `zoom` capability), else digital only. */
export function cameraZoomRange(track: MediaStreamTrack | null | undefined): CameraZoomRange {
  const caps = (track?.getCapabilities?.() ?? {}) as { zoom?: { min?: number; max?: number } };
  const min = caps.zoom?.min;
  const max = caps.zoom?.max;
  if (typeof min !== 'number' || typeof max !== 'number' || !(min > 0) || !(max >= min)) return DIGITAL_ZOOM;
  const lens = { min, max };
  return { min: Math.min(1, Math.ceil(min * 10) / 10), max: Math.min(MAX_ZOOM, Math.max(max, CAMERA_ZOOM.max)), lens };
}

/** A zoom as the camera's own (`lens`) and the crop on top of it (`digital`, at least 1). */
export function splitCameraZoom(zoom: number, range: CameraZoomRange): { lens: number | null; digital: number } {
  if (!range.lens) return { lens: null, digital: Math.max(1, zoom) };
  const lens = Math.min(range.lens.max, Math.max(range.lens.min, zoom));
  return { lens, digital: Math.max(1, zoom / lens) };
}

/** Sets the camera's own zoom; false when the browser said no (the crop still works). */
export async function setLensZoom(track: MediaStreamTrack, zoom: number): Promise<boolean> {
  try {
    await track.applyConstraints({ advanced: [{ zoom } as MediaTrackConstraintSet] });
    return true;
  } catch {
    return false;
  }
}

/**
 * The phone's camera as a live stream, or null when there is none or the
 * person said no — never rejects, like the network services.
 */
export async function openCamera(facing: Facing): Promise<MediaStream | null> {
  if (!navigator.mediaDevices?.getUserMedia) return null;
  const video = { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1920 } };
  try {
    // `zoom: true` asks for the camera's own zoom where the browser offers it (Chrome); others ignore it.
    return await navigator.mediaDevices.getUserMedia({ audio: false, video: { ...video, zoom: true } as MediaTrackConstraints });
  } catch {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: false, video });
    } catch {
      return null;
    }
  }
}

export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}

/** The longest side of a photo: enough for a phone screen, small enough to send. */
const MAX_PX = 1080;

/**
 * The frame on screen as a JPEG data URL, cropped the way the screen shows it
 * (`object-fit: cover` into `box`), zoomed and mirrored for the front camera, so the
 * photo is exactly what was in the viewfinder (at most MAX_PX).
 */
export function captureFrame(video: HTMLVideoElement, box: { width: number; height: number }, mirror: boolean, zoom = 1): string | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh || !box.width || !box.height) return null;
  const scale = Math.max(box.width / vw, box.height / vh) * clampCameraZoom(zoom);
  const sw = box.width / scale;
  const sh = box.height / scale;
  const canvas = document.createElement('canvas');
  const fit = Math.min(1, MAX_PX / Math.max(sw, sh));
  canvas.width = Math.round(sw * fit);
  canvas.height = Math.round(sh * fit);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}
