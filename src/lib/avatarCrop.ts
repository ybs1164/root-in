export interface AvatarEdit {
  /** Centre of the crop, as fractions of the oriented image dimensions. */
  x: number;
  y: number;
  zoom: number;
}

export const DEFAULT_AVATAR_EDIT: AvatarEdit = { x: 0.5, y: 0.5, zoom: 1 };
export const MAX_AVATAR_ZOOM = 3;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Keep the square inside the source image, including after zooming out. */
export function constrainAvatarEdit(width: number, height: number, edit: AvatarEdit): AvatarEdit {
  const zoom = clamp(edit.zoom, 1, MAX_AVATAR_ZOOM);
  const half = Math.min(width, height) / zoom / 2;
  return {
    zoom,
    x: clamp(edit.x, half / width, 1 - half / width),
    y: clamp(edit.y, half / height, 1 - half / height),
  };
}

/** Source pixels shared by the preview and the saved JPEG. */
export function avatarCrop(width: number, height: number, edit: AvatarEdit) {
  const bounded = constrainAvatarEdit(width, height, edit);
  const side = Math.min(width, height) / bounded.zoom;
  return { x: bounded.x * width - side / 2, y: bounded.y * height - side / 2, side };
}
