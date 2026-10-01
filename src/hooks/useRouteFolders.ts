import { useEffect, useRef, useState } from 'react';
import type { RouteFolders } from '../domain/routeFolders';
import { loadRouteFolders, saveRouteFolders } from '../services/routeFolderRepository';

/** The 경로 폴더, kept in storage as they change. */
export function useRouteFolders() {
  const [folders, setFolders] = useState<RouteFolders>(loadRouteFolders);
  const first = useRef(true);
  useEffect(() => {
    // The first render is what was just loaded; nothing to write back.
    if (first.current) {
      first.current = false;
      return;
    }
    saveRouteFolders(folders);
  }, [folders]);
  return { folders, setFolders };
}
