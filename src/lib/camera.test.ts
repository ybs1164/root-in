import { afterEach, describe, expect, it, vi } from 'vitest';
import { CAMERA_ZOOM, captureFrame, clampCameraZoom } from './camera';

afterEach(() => vi.unstubAllGlobals());

describe('camera zoom', () => {
  it('keeps button, slider and pinch values within 1–4× in tenths', () => {
    expect(clampCameraZoom(0.2)).toBe(CAMERA_ZOOM.min);
    expect(clampCameraZoom(8)).toBe(CAMERA_ZOOM.max);
    expect(clampCameraZoom(1.1 + 0.1)).toBe(1.2);
    expect(clampCameraZoom(2.73)).toBe(2.7);
    expect(clampCameraZoom(NaN)).toBe(1);
  });

  it.each([
    [1920, 1080, 1, false, [420, 0, 1080, 1080]],
    [1920, 1080, 2, false, [690, 270, 540, 540]],
    [1080, 1920, 2, true, [270, 690, 540, 540]],
    [1920, 1080, 4, true, [825, 405, 270, 270]],
  ])('captures the centred %i × %i preview at %s× (mirrored: %s)', (width, height, zoom, mirror, crop) => {
    const ctx = { drawImage: vi.fn(), translate: vi.fn(), scale: vi.fn() };
    const canvas = { width: 0, height: 0, getContext: () => ctx, toDataURL: vi.fn(() => 'data:photo') };
    vi.stubGlobal('document', { createElement: () => canvas });
    const video = { videoWidth: width, videoHeight: height } as HTMLVideoElement;
    expect(captureFrame(video, { width: 360, height: 360 }, mirror, zoom)).toBe('data:photo');
    expect(ctx.drawImage).toHaveBeenCalledWith(video, ...crop, 0, 0, crop[2], crop[3]);
    expect(canvas.width).toBe(crop[2]);
    expect(canvas.height).toBe(crop[3]);
    if (mirror) {
      expect(ctx.translate).toHaveBeenCalledWith(canvas.width, 0);
      expect(ctx.scale).toHaveBeenCalledWith(-1, 1);
    } else expect(ctx.scale).not.toHaveBeenCalled();
  });

  it('waits for the video to have a frame before capturing', () => {
    expect(captureFrame({ videoWidth: 0, videoHeight: 0 } as HTMLVideoElement, { width: 360, height: 360 }, false, 2)).toBeNull();
  });
});
