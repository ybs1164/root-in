const SIZE = 256;

/**
 * A picked photo cut to a centred square and shrunk, as a JPEG data URL small
 * enough for localStorage. Null when the file can't be decoded as an image.
 */
export async function avatarFromFile(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return null;
  }
}
