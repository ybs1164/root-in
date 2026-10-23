import { useEffect, useState } from 'react';
import { loadPingPhotos, onPingPhotosChanged } from '../services/pingPhotoRepository';

/** TODAY's photos by ping id, re-read when one is taken. */
export function usePingPhotos(): Record<string, string> {
  const [photos, setPhotos] = useState(loadPingPhotos);
  useEffect(() => onPingPhotosChanged(() => setPhotos(loadPingPhotos())), []);
  return photos;
}
