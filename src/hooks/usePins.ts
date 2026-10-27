import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addCategory,
  addPlacesAsPins,
  moveCategory,
  placeCategory,
  removeCategory,
  updateCategory,
  upsertPin,
  type NewCategoryInput,
} from '../domain/pin';
import { getCurrentUserId } from '../lib/currentUser';
import {
  pinCategoryRepository,
  pinRepository,
  type PinCategoryRepository,
  type PinRepository,
} from '../services/pinRepository';
import { onPulled } from '../services/syncBus';
import type { PlaceRef } from '../types/course';
import type { Pin, PinCategory } from '../types/pin';

const generateId = (prefix: string) =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

/** Pins and their categories; every change is written through immediately. */
export function usePins(pinsRepo: PinRepository = pinRepository, categoriesRepo: PinCategoryRepository = pinCategoryRepository) {
  const userId = useMemo(getCurrentUserId, []);
  const [pins, setPins] = useState<Pin[]>([]);
  const [categories, setCategories] = useState<PinCategory[]>([]);
  // Latest values for callbacks that chain several edits (import, undo).
  const latest = useRef({ pins, categories });
  latest.current = { pins, categories };
  // Until the stored pins are read, a transform would work on empty lists.
  const loaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      Promise.all([pinsRepo.listByUser(userId), categoriesRepo.list()]).then(([p, c]) => {
        if (cancelled) return;
        latest.current = { pins: p, categories: c };
        loaded.current = true;
        setPins(p);
        setCategories(c);
      });
    void load();
    // Signed in, the account's pins may have replaced or joined these.
    const stop = onPulled((changed) => {
      if (changed.has('pins') || changed.has('categories')) void load();
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [pinsRepo, categoriesRepo, userId]);

  const commitPins = useCallback(
    (next: Pin[]) => {
      latest.current.pins = next;
      setPins(next);
      pinsRepo.saveAll(userId, next);
    },
    [pinsRepo, userId],
  );

  const commitCategories = useCallback(
    (next: PinCategory[]) => {
      latest.current.categories = next;
      setCategories(next);
      categoriesRepo.saveAll(next);
    },
    [categoriesRepo],
  );

  const makePin = useCallback(() => ({ id: generateId('pin'), userId, createdAt: new Date().toISOString() }), [userId]);

  /** Returns the saved pin and an undo that restores the list as it was. */
  const savePin = useCallback(
    (place: PlaceRef, categoryId: string, memo?: string) => {
      const before = latest.current.pins;
      const result = upsertPin(before, { place, categoryId, memo }, makePin);
      if ('problem' in result) return null;
      commitPins(result.pins);
      return { pin: result.pin, existed: result.existed, undo: () => commitPins(before) };
    },
    [commitPins, makePin],
  );

  const updatePin = useCallback(
    (id: string, patch: Partial<Pick<Pin, 'categoryId' | 'memo' | 'place'>>) =>
      commitPins(latest.current.pins.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p))),
    [commitPins],
  );

  const removePin = useCallback(
    (id: string) => {
      const before = latest.current.pins;
      commitPins(before.filter((p) => p.id !== id));
      return () => commitPins(before);
    },
    [commitPins],
  );

  const createCategory = useCallback(
    (input: NewCategoryInput) => {
      const result = addCategory(latest.current.categories, input, () => generateId('cat'));
      if ('problem' in result) return result.problem;
      commitCategories(result.categories);
      return null;
    },
    [commitCategories],
  );

  const editCategory = useCallback(
    (id: string, patch: Partial<Pick<PinCategory, 'name' | 'icon' | 'color'>>) =>
      commitCategories(updateCategory(latest.current.categories, id, patch)),
    [commitCategories],
  );

  const reorderCategory = useCallback(
    (id: string, direction: -1 | 1) => commitCategories(moveCategory(latest.current.categories, id, direction)),
    [commitCategories],
  );

  const dropCategory = useCallback(
    (id: string, to: number) => commitCategories(placeCategory(latest.current.categories, id, to)),
    [commitCategories],
  );

  const deleteCategory = useCallback(
    (id: string) => {
      const result = removeCategory(latest.current.categories, latest.current.pins, id);
      commitCategories(result.categories);
      commitPins(result.pins);
    },
    [commitCategories, commitPins],
  );

  /** A received route's places as pins (미분류 unless already pinned); returns how many were new. */
  const addPlaces = useCallback(
    (places: PlaceRef[]) => {
      const result = addPlacesAsPins(latest.current.pins, places, makePin);
      if (result.added > 0) commitPins(result.pins);
      return result.added;
    },
    [commitPins, makePin],
  );

  /**
   * Several edits to pins and categories as one (카테고리 구독): `fn` gets the
   * latest of both and the id makers, and returns the new state (null: no change).
   * False when the stored pins aren't read yet (`fn` isn't called).
   */
  const transform = useCallback(
    (
      fn: (
        state: { pins: Pin[]; categories: PinCategory[] },
        make: { pin: typeof makePin; categoryId: () => string },
      ) => { pins: Pin[]; categories: PinCategory[] } | null,
    ) => {
      if (!loaded.current) return false;
      const before = { ...latest.current };
      const next = fn(before, { pin: makePin, categoryId: () => generateId('cat') });
      if (!next) return true;
      if (next.categories !== before.categories) commitCategories(next.categories);
      if (next.pins !== before.pins) commitPins(next.pins);
      return true;
    },
    [commitCategories, commitPins, makePin],
  );

  return {
    pins,
    categories,
    transform,
    savePin,
    updatePin,
    removePin,
    createCategory,
    editCategory,
    reorderCategory,
    dropCategory,
    deleteCategory,
    addPlaces,
  };
}
