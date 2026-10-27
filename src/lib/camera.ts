export type Facing = 'environment' | 'user';

/**
 * The phone's camera as a live stream, or null when there is none or the
 * person said no — never rejects, like the network services.
 */
export async function openCamera(facing: Facing): Promise<MediaStream | null> {
  if (!navigator.mediaDevices?.getUserMedia) return null;
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1920 } },
    });
  } catch {
    return null;
  }
}

export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}

/** The longest side of a photo: enough for a phone screen, small enough to send. */
const MAX_PX = 1080;

/**
 * The frame on screen as a JPEG data URL, cropped the way the screen shows it
 * (`object-fit: cover` into `box`) and mirrored for the front camera, so the
 * photo is exactly what was in the viewfinder (at most MAX_PX).
 */
export function captureFrame(video: HTMLVideoElement, box: { width: number; height: number }, mirror: boolean): string | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh || !box.width || !box.height) return null;
  const scale = Math.max(box.width / vw, box.height / vh);
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
