const SIZE = 256;

/**
 * A picked photo cut to a centred square and shrunk, as a JPEG data URL small
 * enough for localStorage. Null when the file can't be decoded as an image.
 */
export async function avatarFromFile(file: Blob, size = SIZE, quality = 0.85): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return null;
  }
}

/** The same, from a photo already held as a data URL (a camera shot). */
export async function avatarFromDataUrl(dataUrl: string, size = SIZE, quality = 0.85): Promise<string | null> {
  const match = /^data:([^;,]+);base64,(.*)$/.exec(dataUrl);
  if (!match) return null;
  try {
    const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
    return await avatarFromFile(new Blob([bytes], { type: match[1] }), size, quality);
  } catch {
    return null;
  }
}
