import { useEffect, useRef, useState } from 'react';
import type { RouteFolders } from '../domain/routeFolders';
import { loadRouteFolders, saveRouteFolders } from '../services/routeFolderRepository';
import { onPulled } from '../services/syncBus';

/** The 경로 폴더, kept in storage as they change. */
export function useRouteFolders() {
  const [folders, setFolders] = useState<RouteFolders>(loadRouteFolders);
  const first = useRef(true);
  // Folders, and which route sits where, can come from the account.
  useEffect(
    () =>
      onPulled((changed) => {
        if (!changed.has('folders') && !changed.has('routes')) return;
        first.current = true; // just loaded: nothing to write back
        setFolders(loadRouteFolders());
      }),
    [],
  );
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
