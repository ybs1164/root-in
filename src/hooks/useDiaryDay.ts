import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addDiaryStop,
  dateKey,
  diaryKind,
  emptyDiaryDraft,
  routeIn,
  timeKey,
  toDiaryDraft,
} from '../domain/diary';
import { getCurrentPlace } from '../lib/geolocation';
import type { PlaceSearchService } from '../services/placeSearch/placeSearchService';
import type { PlaceRef } from '../types/course';
import type { DiaryDraft, DiaryEntry, WishItem } from '../types/diary';
import { useDiary } from './useDiary';

export type DiaryScreen = { kind: 'calendar' } | { kind: 'edit' } | { kind: 'wish'; item: WishItem };

export interface RouteInChoice {
  here: PlaceRef;
  nearby: PlaceRef[];
}

const diaryKey = (draft: DiaryDraft) =>
  JSON.stringify([draft.date, draft.kind ?? '', draft.title.trim(), draft.mood ?? '', draft.travelMode, draft.stops, draft.text?.trim() ?? '']);

/**
 * The calendar tab: one day open at a time, saved automatically (no save
 * button, no "unsaved changes" prompts; emptying a saved day deletes it).
 */
export function useDiaryDay(notify: (message: string) => void) {
  const diary = useDiary();
  const { saveEntry, removeEntry } = diary;
  const [screen, setScreen] = useState<DiaryScreen>({ kind: 'calendar' });
  const [draft, setDraft] = useState<DiaryDraft>(emptyDiaryDraft);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [routeInChoice, setRouteInChoice] = useState<RouteInChoice | null>(null);
  const dirty = savedKey !== diaryKey(draft);
  const entriesRef = useRef(diary.entries);
  entriesRef.current = diary.entries;

  useEffect(() => {
    if (!dirty || screen.kind !== 'edit') return;
    const snapshot = draft;
    const id = setTimeout(async () => {
      if (snapshot.stops.length === 0) {
        if (snapshot.id) {
          await removeEntry(snapshot.id);
          setDraft((d) => ({ ...d, id: undefined }));
        }
      } else {
        const saved = await saveEntry(snapshot);
        setDraft((d) => (d.id ? d : { ...d, id: saved.id }));
      }
      setSavedKey(diaryKey(snapshot));
    }, 400);
    return () => clearTimeout(id);
  }, [draft, dirty, screen.kind, saveEntry, removeEntry]);

  /** Flushes a pending autosave; leaving the editor cancels its timer. */
  const flush = useCallback(async () => {
    if (screen.kind === 'edit' && dirty && draft.stops.length > 0) await saveEntry(draft);
  }, [screen.kind, dirty, draft, saveEntry]);

  const load = (next: DiaryDraft) => {
    setDraft(next);
    setSavedKey(diaryKey(next));
    setScreen({ kind: 'edit' });
    setRouteInChoice(null);
  };

  /** Opens a day from the calendar: its page if there is one, a new one otherwise. */
  const openDate = useCallback(
    async (key: string) => {
      await flush();
      const existing = entriesRef.current.find((e) => e.date === key);
      load(existing ? toDiaryDraft(existing) : emptyDiaryDraft(key));
    },
    [flush],
  );

  const openEntry = useCallback(
    async (entry: DiaryEntry) => {
      await flush();
      load(toDiaryDraft(entry));
    },
    [flush],
  );

  const backToCalendar = useCallback(async () => {
    await flush();
    const next = emptyDiaryDraft();
    setDraft(next);
    setSavedKey(null);
    setScreen({ kind: 'calendar' });
    setRouteInChoice(null);
  }, [flush]);

  const deleteDay = useCallback(async () => {
    if (!draft.id || !window.confirm('이 날의 루트를 삭제할까요?')) return;
    await removeEntry(draft.id);
    const next = emptyDiaryDraft();
    setDraft(next);
    setSavedKey(diaryKey(next));
    setScreen({ kind: 'calendar' });
  }, [draft.id, removeEntry]);

  /** Adds a searched/picked place: today's visits get the current time. */
  const addPlace = useCallback(
    (place: PlaceRef) => {
      if (screen.kind !== 'edit') setScreen({ kind: 'edit' });
      setDraft((d) => {
        const time = d.date === dateKey() && diaryKind(d) === 'log' ? timeKey() : undefined;
        return { ...d, stops: addDiaryStop(d.stops, place, time) };
      });
    },
    [screen.kind],
  );

  /**
   * "지금 여기 루트-인": locate, then offer the named places around; the
   * user picks one (or the bare location) in the editor.
   */
  const startRouteIn = useCallback(
    async (search: PlaceSearchService | null) => {
      if (screen.kind !== 'edit' || draft.date !== dateKey()) await openDate(dateKey());
      setLocating(true);
      const here = await getCurrentPlace('내 위치');
      if (!here) {
        setLocating(false);
        notify('위치를 가져오지 못했어요. 검색으로 추가해 주세요.');
        return;
      }
      const nearby = search ? await search.nearby(here.center) : [];
      setLocating(false);
      setRouteInChoice({ here, nearby });
    },
    [screen.kind, draft.date, openDate, notify],
  );

  const confirmRouteIn = useCallback(
    (place: PlaceRef) => {
      setRouteInChoice(null);
      setDraft((d) => {
        const result = routeIn(d, place, timeKey());
        if (result.matched !== null) notify(`계획한 ${d.stops[result.matched].place.name} 방문 완료!`);
        return { ...d, stops: result.stops };
      });
    },
    [notify],
  );

  return {
    diary,
    screen,
    setScreen,
    draft,
    setDraft,
    locating,
    routeInChoice,
    cancelRouteIn: () => setRouteInChoice(null),
    openDate,
    openEntry,
    backToCalendar,
    deleteDay,
    addPlace,
    startRouteIn,
    confirmRouteIn,
  };
}
