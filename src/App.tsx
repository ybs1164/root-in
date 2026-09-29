import { ChevronLeft, NotebookPen, Share, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CourseEditor from './components/CourseEditor';
import CourseList from './components/CourseList';
import DiaryEditor from './components/DiaryEditor';
import DiaryList, { type DiaryListTab } from './components/DiaryList';
import DiaryShareSheet from './components/DiaryShareSheet';
import DiaryView from './components/DiaryView';
import { WishStar } from './components/icons';
import SearchBar from './components/SearchBar';
import SharedCourseView from './components/SharedCourseView';
import ShareSheet from './components/ShareSheet';
import { addStop, COURSE_LIMITS, emptyDraft } from './domain/course';
import { addDiaryStop, dateKey, DIARY_LIMITS, emptyDiaryDraft, timeKey, toDiaryDraft } from './domain/diary';
import { useCourses } from './hooks/useCourses';
import { useDiary } from './hooks/useDiary';
import { useIncomingCourse } from './hooks/useIncomingCourse';
import { useIncomingDiary } from './hooks/useIncomingDiary';
import { usePlaceSearch } from './hooks/usePlaceSearch';
import { kakaoPlaceUrl } from './lib/directionsLink';
import { getCurrentPlace } from './lib/geolocation';
import { SEOUL_CENTER, type CourseMap, type MapPadding } from './map/courseMap';
import { createMapStack } from './map/createCourseMap';
import type { PlaceSearchService } from './services/placeSearch/placeSearchService';
import type { Course, CourseDraft, PlaceRef } from './types/course';
import type { DiaryDraft, DiaryEntry, DiarySnapshot, WishItem } from './types/diary';

type Tab = 'edit' | 'list';
type Mode = 'course' | 'diary';
type DiaryScreen = { kind: 'list' } | { kind: 'edit' } | { kind: 'wish'; item: WishItem };
type SheetSize = 'peek' | 'full';

const DESKTOP_QUERY = '(min-width: 900px)';

const toDraft = (course: Course): CourseDraft => ({
  id: course.id,
  title: course.title,
  theme: course.theme,
  travelMode: course.travelMode,
  stops: course.stops,
  note: course.note,
  sharedBy: course.sharedBy,
});

const draftKey = (draft: CourseDraft) =>
  JSON.stringify([draft.title.trim(), draft.theme, draft.travelMode, draft.stops, draft.note ?? '']);

const diaryKey = (draft: DiaryDraft) =>
  JSON.stringify([draft.date, draft.title.trim(), draft.mood ?? '', draft.travelMode, draft.stops, draft.text?.trim() ?? '']);

const snapshotToDraft = ({ date, title, mood, travelMode, stops, text }: DiarySnapshot): DiaryDraft => ({
  date,
  title,
  mood,
  travelMode,
  stops,
  text,
});

export default function App() {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const sheetEl = useRef<HTMLElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<CourseMap | null>(null);
  const [searchService, setSearchService] = useState<PlaceSearchService | null>(null);
  const [mapProvider, setMapProvider] = useState<'kakao' | 'maplibre' | null>(null);

  const { courses, save, remove } = useCourses();
  const { incoming, dismiss: dismissIncoming } = useIncomingCourse();
  const diary = useDiary();
  const { incoming: incomingDiary, dismiss: dismissIncomingDiary } = useIncomingDiary();

  const [tab, setTab] = useState<Tab>('edit');
  const [sheet, setSheet] = useState<SheetSize>('peek');
  const [draft, setDraft] = useState<CourseDraft>(emptyDraft);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [sharedSaved, setSharedSaved] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>('course');
  const [diaryTab, setDiaryTab] = useState<DiaryListTab>('entries');
  const [diaryScreen, setDiaryScreen] = useState<DiaryScreen>({ kind: 'list' });
  const [diaryDraft, setDiaryDraft] = useState<DiaryDraft>(emptyDiaryDraft);
  const [diarySavedKey, setDiarySavedKey] = useState<string | null>(null);
  const diaryOpened = useRef(false);
  const [diarySharing, setDiarySharing] = useState<DiaryDraft | null>(null);
  const [sharedDiarySaved, setSharedDiarySaved] = useState(false);
  const [locating, setLocating] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<PlaceRef | null>(null);

  const sharedCourse = incoming.status === 'ready' ? incoming.course : null;
  const sharedDiary = incomingDiary.status === 'ready' ? incomingDiary.diary : null;
  const dirty = savedKey !== draftKey(draft);
  const diaryDirty = diarySavedKey !== diaryKey(diaryDraft);
  const inDiary = !sharedCourse && mode === 'diary';
  const shownStops = useMemo(() => {
    if (sharedCourse) return sharedCourse.stops.map((s) => s.place);
    if (mode === 'diary') {
      if (sharedDiary) return sharedDiary.stops.map((s) => s.place);
      if (diaryScreen.kind === 'edit') return diaryDraft.stops.map((s) => s.place);
      if (diaryScreen.kind === 'wish') return diaryScreen.item.stops.map((s) => s.place);
      return [];
    }
    return draft.stops.map((s) => s.place);
  }, [sharedCourse, sharedDiary, mode, diaryScreen, diaryDraft.stops, draft.stops]);

  const search = usePlaceSearch(searchService, query, () => mapRef.current?.getCenter());

  // The sheet/panel covers part of the map; fit and focus around it.
  // offsetHeight/offsetWidth ignore the slide-away transform used while
  // searching, and the cap keeps a fully expanded sheet from squeezing the map.
  const mapPadding = useCallback((extraBottom = 0): MapPadding => {
    const sheetBox = sheetEl.current;
    const desktop = window.matchMedia(DESKTOP_QUERY).matches;
    const sheetHeight = Math.min(sheetBox?.offsetHeight ?? 0, window.innerHeight * 0.45);
    return {
      top: 90,
      right: 40,
      bottom: desktop ? 40 + extraBottom : sheetHeight + 30 + extraBottom,
      left: desktop && sheetBox ? sheetBox.offsetWidth + 42 : 40,
    };
  }, []);

  const focusStopRef = useRef<(index: number) => void>(() => {});

  useEffect(() => {
    if (!mapEl.current) return;
    let disposed = false;
    let created: CourseMap | null = null;
    createMapStack(mapEl.current, {
      center: SEOUL_CENTER,
      onStopClick: (index) => focusStopRef.current(index),
    }).then(({ map, search }) => {
      if (disposed) return map.destroy();
      created = map;
      mapRef.current = map;
      // Handy for poking at the map from devtools / the preview browser.
      if (import.meta.env.DEV) (window as unknown as { __courseMap?: CourseMap }).__courseMap = map;
      setSearchService(search);
      setMapProvider(map.provider);
    });
    return () => {
      disposed = true;
      created?.destroy();
      mapRef.current = null;
    };
  }, []);

  // Redraw markers whenever the visible course changes; refit only when the
  // set of places changes (not on memo edits).
  const stopsKey = shownStops.map((p) => p.id).join('|');
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setCourse(shownStops);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownStops, mapProvider]);
  useEffect(() => {
    if (!mapRef.current || shownStops.length === 0) return;
    const id = requestAnimationFrame(() => mapRef.current?.fitCourse(mapPadding()));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopsKey, mapProvider]);

  useEffect(() => {
    mapRef.current?.setPreview(preview);
  }, [preview, mapProvider]);

  useEffect(() => {
    const onResize = () => mapRef.current?.resize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (incoming.status === 'invalid') {
      setToast('공유 링크를 열 수 없어요. 링크가 잘렸는지 확인해 주세요.');
      dismissIncoming();
    }
    if (incoming.status === 'ready') {
      setSharedSaved(false);
      // Recipients should see the route on the map first; the list is one tap away.
      setSheet('peek');
    }
  }, [incoming, dismissIncoming]);

  useEffect(() => {
    if (incomingDiary.status === 'invalid') {
      setToast('공유받은 하루 기록을 열 수 없어요. 링크가 잘렸는지 확인해 주세요.');
      dismissIncomingDiary();
    }
    if (incomingDiary.status === 'ready') {
      setSharedDiarySaved(false);
      setMode('diary');
      setSheet('peek');
    }
  }, [incomingDiary, dismissIncomingDiary]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  focusStopRef.current = (index: number) => {
    const place = shownStops[index];
    if (!place) return;
    mapRef.current?.focus(place.center, mapPadding());
    document.querySelectorAll('.stop-list__item')[index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const startSearch = () => {
    setSearchOpen(true);
    searchInput.current?.focus();
  };

  const pickPlace = (place: PlaceRef) => {
    setSearchOpen(false);
    searchInput.current?.blur();
    setPreview(place);
    setSheet('peek');
    // Leave room for the place card that sits above the sheet.
    requestAnimationFrame(() => mapRef.current?.focus(place.center, mapPadding(150)));
  };

  const addPreviewToDiary = (place: PlaceRef) => {
    if (sharedDiary) dismissIncomingDiary();
    // Recording today: stamp the visit with the current time; past days are left for the user to fill.
    const time = diaryDraft.date === dateKey() ? timeKey() : undefined;
    if (diaryScreen.kind !== 'edit') setDiaryScreen({ kind: 'edit' });
    setDiaryDraft((d) => ({ ...d, stops: addDiaryStop(d.stops, place, time) }));
  };

  const addPreviewToCourse = () => {
    if (!preview) return;
    if (inDiary) {
      addPreviewToDiary(preview);
      setPreview(null);
      setQuery('');
      return;
    }
    if (sharedCourse) dismissIncoming();
    setDraft((d) => ({ ...d, stops: addStop(d.stops, preview) }));
    setPreview(null);
    setQuery('');
    setTab('edit');
    setToast(`${preview.name}을(를) ${draft.stops.length + 1}번째로 추가했어요.`);
  };

  const handleSave = async () => {
    const saved = await save(draft);
    const next = toDraft(saved);
    setDraft(next);
    setSavedKey(draftKey(next));
    setToast('코스를 저장했어요.');
  };

  const handleReset = () => {
    if (dirty && draft.stops.length > 0 && !window.confirm('저장하지 않은 변경이 있어요. 새 코스를 시작할까요?')) return;
    setDraft(emptyDraft());
    setSavedKey(null);
    setPreview(null);
  };

  const openCourse = (course: Course) => {
    if (dirty && draft.stops.length > 0 && draft.id !== course.id && !window.confirm('저장하지 않은 변경이 있어요. 이 코스를 열까요?')) return;
    const next = toDraft(course);
    setDraft(next);
    setSavedKey(draftKey(next));
    setTab('edit');
    setPreview(null);
  };

  const saveShared = async () => {
    if (!sharedCourse) return;
    await save({ ...sharedCourse, sharedBy: sharedCourse.sharedBy ?? '익명' });
    setSharedSaved(true);
    setToast('내 코스에 저장했어요.');
  };

  const editSharedCopy = () => {
    if (!sharedCourse) return;
    const { title, theme, travelMode, stops, note } = sharedCourse;
    setDraft({ title, theme, travelMode, stops, note });
    setSavedKey(null);
    dismissIncoming();
    setTab('edit');
  };

  // ----- Daily route diary -----

  const { saveEntry, removeEntry } = diary;

  // The diary saves itself shortly after each change: no save button, no
  // "unsaved changes" prompts. Emptying a saved day deletes it.
  useEffect(() => {
    if (!diaryDirty || diaryScreen.kind !== 'edit') return;
    const snapshot = diaryDraft;
    const id = setTimeout(async () => {
      if (snapshot.stops.length === 0) {
        if (snapshot.id) {
          await removeEntry(snapshot.id);
          setDiaryDraft((d) => ({ ...d, id: undefined }));
        }
      } else {
        const saved = await saveEntry(snapshot);
        setDiaryDraft((d) => (d.id ? d : { ...d, id: saved.id }));
      }
      setDiarySavedKey(diaryKey(snapshot));
    }, 400);
    return () => clearTimeout(id);
  }, [diaryDraft, diaryDirty, diaryScreen.kind, saveEntry, removeEntry]);

  const startDiaryEntry = () => {
    // Continue today's page if one exists, instead of creating a second one.
    const today = diary.entries.find((e) => e.date === dateKey());
    const next = today ? toDiaryDraft(today) : emptyDiaryDraft();
    setDiaryDraft(next);
    setDiarySavedKey(diaryKey(next));
    setDiaryScreen({ kind: 'edit' });
  };

  const openDiary = () => {
    setMode('diary');
    setPreview(null);
    // First tap goes straight to today's page; after that, resume where the user was.
    if (!diaryOpened.current && !sharedDiary && diaryScreen.kind === 'list') startDiaryEntry();
    diaryOpened.current = true;
  };

  const closeDiary = () => {
    if (sharedDiary) dismissIncomingDiary();
    setMode('course');
    setPreview(null);
  };

  const openDiaryEntry = (entry: DiaryEntry) => {
    const next = toDiaryDraft(entry);
    setDiaryDraft(next);
    setDiarySavedKey(diaryKey(next));
    setDiaryScreen({ kind: 'edit' });
    setPreview(null);
  };

  const backToDiaryList = async () => {
    // Flush a pending autosave; leaving the editor cancels its timer.
    if (diaryDirty && diaryDraft.stops.length > 0) await saveEntry(diaryDraft);
    setDiaryDraft(emptyDiaryDraft());
    setDiarySavedKey(null);
    setDiaryScreen({ kind: 'list' });
    setPreview(null);
  };

  const deleteDiaryEntry = async () => {
    if (!diaryDraft.id || !window.confirm('이 기록을 삭제할까요?')) return;
    await removeEntry(diaryDraft.id);
    const next = emptyDiaryDraft();
    setDiaryDraft(next);
    setDiarySavedKey(diaryKey(next));
    setDiaryScreen({ kind: 'list' });
  };

  const toggleWish = async (entry: DiaryEntry) => {
    const wished = diary.wishByDiaryId.get(entry.id);
    if (wished) await diary.removeWish(wished.id);
    else await diary.addWish(entry, entry.id);
  };

  const addCurrentLocation = async () => {
    setLocating(true);
    const place = await getCurrentPlace('내 위치');
    setLocating(false);
    if (!place) {
      setToast('위치를 가져오지 못했어요.');
      return;
    }
    setDiaryDraft((d) => ({ ...d, stops: addDiaryStop(d.stops, place, d.date === dateKey() ? timeKey() : undefined) }));
  };

  const saveSharedDiaryToWishlist = async () => {
    if (!sharedDiary) return;
    await diary.addWish({ ...sharedDiary, sharedBy: sharedDiary.sharedBy ?? '익명' });
    setSharedDiarySaved(true);
  };

  const renderDiary = () => {
    const focus = (i: number) => focusStopRef.current(i);
    if (sharedDiary) {
      return (
        <DiaryView
          diary={sharedDiary}
          onFocusStop={focus}
          lead={
            <button className="icon-btn" aria-label="닫기" onClick={dismissIncomingDiary}>
              <X size={22} aria-hidden />
            </button>
          }
          footer={
            <button className="btn btn--primary btn--block" onClick={saveSharedDiaryToWishlist} disabled={sharedDiarySaved}>
              <WishStar on={sharedDiarySaved} size={18} />
              {sharedDiarySaved ? '저장됨' : '위시리스트에 저장'}
            </button>
          }
        />
      );
    }
    if (diaryScreen.kind === 'wish') {
      const item = diaryScreen.item;
      return (
        <DiaryView
          diary={item}
          onFocusStop={focus}
          lead={
            <button className="icon-btn" aria-label="목록" onClick={() => setDiaryScreen({ kind: 'list' })}>
              <ChevronLeft size={24} aria-hidden />
            </button>
          }
          tools={
            <>
              <button
                className="icon-btn star-btn star-btn--on"
                aria-label="위시리스트에서 빼기"
                onClick={async () => {
                  if (!window.confirm('위시리스트에서 뺄까요?')) return;
                  await diary.removeWish(item.id);
                  setDiaryScreen({ kind: 'list' });
                }}
              >
                <WishStar on />
              </button>
              <button className="icon-btn" aria-label="공유" onClick={() => setDiarySharing(snapshotToDraft(item))}>
                <Share size={21} aria-hidden />
              </button>
            </>
          }
        />
      );
    }
    if (diaryScreen.kind === 'edit') {
      return (
        <DiaryEditor
          draft={diaryDraft}
          wished={Boolean(diaryDraft.id && diary.wishByDiaryId.has(diaryDraft.id))}
          locating={locating}
          onChange={setDiaryDraft}
          onBack={backToDiaryList}
          onShare={() => setDiarySharing(diaryDraft)}
          onDelete={deleteDiaryEntry}
          onToggleWish={() => {
            const entry = diary.entries.find((e) => e.id === diaryDraft.id);
            if (entry) toggleWish(entry);
          }}
          onFocusStop={focus}
          onStartSearch={startSearch}
          onAddCurrentLocation={addCurrentLocation}
        />
      );
    }
    return (
      <DiaryList
        tab={diaryTab}
        onTab={setDiaryTab}
        entries={diary.entries}
        wishes={diary.wishes}
        wishByDiaryId={diary.wishByDiaryId}
        onNewEntry={startDiaryEntry}
        onOpenEntry={openDiaryEntry}
        onToggleWish={toggleWish}
        onOpenWish={(item) => setDiaryScreen({ kind: 'wish', item })}
      />
    );
  };

  const providerLabel = mapProvider === 'kakao' ? '카카오' : mapProvider === 'maplibre' ? 'OpenStreetMap (카카오 키 없음)' : '준비 중';
  const courseFull = draft.stops.length >= COURSE_LIMITS.maxStops;
  const diaryFull = diaryDraft.stops.length >= DIARY_LIMITS.maxStops;
  const previewTargetFull = inDiary ? diaryFull : courseFull;
  const previewLabel = inDiary
    ? diaryFull
      ? `최대 ${DIARY_LIMITS.maxStops}곳`
      : '기록에 추가'
    : courseFull
      ? '최대 10곳'
      : `${draft.stops.length + 1}번째로 추가`;

  return (
    <div className={`app ${searchOpen ? 'app--searching' : ''}`}>
      <div ref={mapEl} className="map" aria-label="지도" />

      <SearchBar
        ref={searchInput}
        query={query}
        onQuery={setQuery}
        open={searchOpen}
        onOpenChange={(open) => {
          setSearchOpen(open);
          if (!open) searchInput.current?.blur();
        }}
        status={search.status}
        results={search.results}
        onPick={pickPlace}
        providerLabel={providerLabel}
      />

      <button
        className={`diary-fab ${inDiary ? 'diary-fab--on' : ''}`}
        aria-label={inDiary ? '하루 기록 닫기' : '하루 경로 기록 열기'}
        aria-pressed={inDiary}
        onClick={() => (inDiary ? closeDiary() : openDiary())}
      >
        <NotebookPen size={24} aria-hidden />
      </button>

      {preview && !searchOpen && (
        <div className="place-card" role="dialog" aria-label="선택한 장소">
          <div className="place-card__info">
            <strong>{preview.name}</strong>
            <span>{[preview.category, preview.address].filter(Boolean).join(' · ')}</span>
          </div>
          <div className="place-card__actions">
            <a className="btn btn--ghost" href={kakaoPlaceUrl(preview)} target="_blank" rel="noreferrer">
              상세
            </a>
            <button className="btn btn--primary" onClick={addPreviewToCourse} disabled={previewTargetFull}>
              {previewLabel}
            </button>
          </div>
          <button className="place-card__close icon-btn" aria-label="닫기" onClick={() => setPreview(null)}>
            ✕
          </button>
        </div>
      )}

      <section ref={sheetEl} className={`sheet sheet--${sheet}`} aria-label="코스 패널">
        <button
          className="sheet__grip"
          aria-label={sheet === 'full' ? '패널 줄이기' : '패널 펼치기'}
          aria-expanded={sheet === 'full'}
          onClick={() => setSheet((s) => (s === 'full' ? 'peek' : 'full'))}
        >
          <span aria-hidden />
        </button>

        {sharedCourse ? (
          <div className="sheet__content">
            <SharedCourseView
              course={sharedCourse}
              saved={sharedSaved}
              onSave={saveShared}
              onEditCopy={editSharedCopy}
              onClose={dismissIncoming}
              onFocusStop={(i) => focusStopRef.current(i)}
            />
          </div>
        ) : inDiary ? (
          <div className="sheet__content">{renderDiary()}</div>
        ) : (
          <>
            <div className="tabs" role="tablist">
              <button role="tab" aria-selected={tab === 'edit'} className={tab === 'edit' ? 'is-on' : ''} onClick={() => setTab('edit')}>
                {draft.id ? '코스 편집' : '코스 만들기'}
                {draft.stops.length > 0 && <span className="tabs__count">{draft.stops.length}</span>}
              </button>
              <button
                role="tab"
                aria-selected={tab === 'list'}
                className={tab === 'list' ? 'is-on' : ''}
                onClick={() => {
                  setTab('list');
                  setSheet('full');
                }}
              >
                내 코스
                {courses.length > 0 && <span className="tabs__count">{courses.length}</span>}
              </button>
            </div>
            <div className="sheet__content">
              {tab === 'edit' ? (
                <CourseEditor
                  draft={draft}
                  dirty={dirty}
                  onChange={setDraft}
                  onSave={handleSave}
                  onShare={() => setSharing(true)}
                  onReset={handleReset}
                  onFocusStop={(i) => focusStopRef.current(i)}
                  onStartSearch={startSearch}
                />
              ) : (
                <CourseList
                  courses={courses}
                  activeId={draft.id}
                  onOpen={openCourse}
                  onRemove={async (course) => {
                    await remove(course.id);
                    if (draft.id === course.id) setSavedKey(null);
                    setToast('코스를 삭제했어요.');
                  }}
                  onCreate={() => {
                    setTab('edit');
                    startSearch();
                  }}
                />
              )}
            </div>
          </>
        )}
      </section>

      {sharing && <ShareSheet draft={draft} onClose={() => setSharing(false)} />}
      {diarySharing && <DiaryShareSheet draft={diarySharing} onClose={() => setDiarySharing(null)} />}

      <div className={`toast ${toast ? 'toast--on' : ''}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}
