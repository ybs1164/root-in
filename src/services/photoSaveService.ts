import { registerPlugin } from '@capacitor/core';
import { isNativeApp } from '../lib/native';

/**
 * The app's own plugin (SceneDelegate.swift / PhotoSavePlugin.java): writes
 * an image into the phone's photo album and resolves only once it's there.
 */
const PhotoSave = registerPlugin<{ save(options: { data: string; name: string }): Promise<void> }>('PhotoSave');

const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

/** `root-in-20261123-142305.jpg`: the app, when, and the type's extension (jpg when unknown). */
export function photoFileName(type: string, at: Date = new Date()): string {
  const two = (n: number) => String(n).padStart(2, '0');
  const stamp = `${at.getFullYear()}${two(at.getMonth() + 1)}${two(at.getDate())}-${two(at.getHours())}${two(at.getMinutes())}${two(at.getSeconds())}`;
  return `root-in-${stamp}.${EXTENSIONS[type] ?? 'jpg'}`;
}

/**
 * How a save went. Only `saved` is known to be on the phone or computer:
 * `started` is a browser download nobody can watch finish, `cancelled` the
 * person closing the save dialog.
 */
export type PhotoSaveResult = 'saved' | 'started' | 'cancelled' | 'failed';

/** The pill a result earns: none until the photo is known to be saved (or known not to be). */
export function photoSaveNotice(result: PhotoSaveResult): string | null {
  if (result === 'saved') return '사진을 저장했어요';
  if (result === 'failed') return '사진을 저장하지 못했어요';
  return null;
}

const base64Of = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/** The computer's own save dialog (Chrome, Edge on a desktop); not in the DOM types yet. */
type SavePicker = (options: { suggestedName: string; types?: { description: string; accept: Record<string, string[]> }[] }) => Promise<{
  createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
}>;

const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

/**
 * Saves a photo (a data URL or a storage URL) as the person has it: in the
 * apps, into the phone's photo album; on a computer with a save dialog, to
 * the file they pick — both `saved` only once written. Elsewhere on the web
 * it's an ordinary download (`started`: the browser shows its progress).
 * Never rejects.
 */
export async function savePhoto(src: string): Promise<PhotoSaveResult> {
  try {
    const blob = await (await fetch(src)).blob();
    if (!blob.size) return 'failed';
    const name = photoFileName(blob.type);
    if (isNativeApp()) {
      await PhotoSave.save({ data: await base64Of(blob), name });
      return 'saved';
    }
    const picker = (window as Window & { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
    if (picker) {
      try {
        const type = blob.type || 'image/jpeg';
        const file = await picker({ suggestedName: name, types: [{ description: '사진', accept: { [type]: [`.${name.split('.').pop()}`] } }] });
        const out = await file.createWritable();
        await out.write(blob);
        await out.close();
        return 'saved';
      } catch (error) {
        if (isAbort(error)) return 'cancelled';
        // The dialog refused (no tap left to open it on, a locked-down browser): download instead.
      }
    }
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    // The download has its own copy by now; a moment's grace for slow browsers.
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return 'started';
  } catch (error) {
    return isAbort(error) ? 'cancelled' : 'failed';
  }
}
