import { useCallback, useEffect, useRef, useState } from 'react';
import { EMPTY_DECOR, type DayDecor } from '../domain/decor';
import type { PhotoDecorLayer } from '../domain/gallery';
import { groupService } from '../services/groupService';

/** How long after the last touch my doodles are saved. */
const SAVE_MS = 700;

export interface PhotoDecor {
  /** The other members' layers, drawn under mine (null while reading). */
  others: PhotoDecorLayer[] | null;
  /** My own layer: what the tools edit. */
  mine: DayDecor;
  /** The colour my layer was saved with (where I can't doodle, e.g. the gallery, its stickers' edge). */
  mineInk: string | null;
  setMine(decor: DayDecor): void;
}

/**
 * A group photo's doodles, by its path: every member's layer read from the
 * server, mine kept here as it's edited and saved a moment after the last
 * change (and right away when the photo changes or closes), with my colour
 * (`ink`) for my stickers' edge.
 */
export function usePhotoDecor(path: string | null, ink?: string | null): PhotoDecor {
  const [others, setOthers] = useState<PhotoDecorLayer[] | null>(null);
  const [mine, setMineState] = useState<DayDecor>(EMPTY_DECOR);
  const [mineInk, setMineInk] = useState<string | null>(null);
  const pending = useRef<{ path: string; decor: DayDecor; ink?: string } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    const save = pending.current;
    pending.current = null;
    if (save) void groupService.setDecor(save.path, save.decor, save.ink);
  }, []);

  useEffect(() => {
    setOthers(null);
    setMineState(EMPTY_DECOR);
    setMineInk(null);
    if (!path) return;
    let live = true;
    void groupService.decors(path).then((layers) => {
      if (!live) return;
      const list = layers === 'error' ? [] : layers;
      setOthers(list.filter((l) => !l.mine));
      // Unless I've started on it meanwhile.
      const saved = list.find((l) => l.mine);
      setMineInk(saved?.ink ?? null);
      if (!pending.current) setMineState(saved?.decor ?? EMPTY_DECOR);
    });
    return () => {
      live = false;
      flush();
    };
  }, [path, flush]);

  const setMine = (decor: DayDecor) => {
    setMineState(decor);
    if (!path) return;
    pending.current = { path, decor, ...(ink ? { ink } : {}) };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, SAVE_MS);
  };
  return { others, mine, mineInk, setMine };
}
