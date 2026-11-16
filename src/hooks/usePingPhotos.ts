import { useEffect, useState } from 'react';
import { loadPingPhotos, onPingPhotosChanged, type PingPhotos } from '../services/pingPhotoRepository';

/** TODAY's photos by ping id (each its stack, oldest first), re-read when one is taken or deleted. */
export function usePingPhotos(): PingPhotos {
  const [photos, setPhotos] = useState(loadPingPhotos);
  useEffect(() => onPingPhotosChanged(() => setPhotos(loadPingPhotos())), []);
  return photos;
}
