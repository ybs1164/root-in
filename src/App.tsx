import type { ThemeId } from './domain/decor';
import { Settings as SettingsIcon, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BottomBar from './components/BottomBar';
import CalendarSheet from './components/CalendarSheet';
import CalendarZoom, { type CalendarCommand } from './components/CalendarZoom';
import CategoryChips from './components/CategoryChips';
import InfluencerPanel from './components/InfluencerPanel';
import PinCard from './components/PinCard';
import PinDropTray from './components/PinDropTray';
import PinsSheet, { type PinsSub } from './components/PinsSheet';
import SearchBar from './components/SearchBar';
import SettingsSheet from './components/SettingsSheet';
import SharedCourseView from './components/SharedCourseView';
import SharedPinsView from './components/SharedPinsView';
import ShareSheet from './components/ShareSheet';
import { calendarAgain, homeSwipeDirection, PAGE_TITLES, showsPage, tabForIncoming, type AppTab } from './domain/appTabs';
import { addStop, COURSE_LIMITS, emptyDraft } from './domain/course';
import { DIARY_LIMITS, diaryKind } from './domain/diary';
import { buildPinSet, categoryStyle, filterPins } from './domain/pin';
import { orderByNearest } from './domain/routeOrder';
import { useCourseDraft } from './hooks/useCourseDraft';
import { useDiaryDay } from './hooks/useDiaryDay';
import { useIncomingCourse } from './hooks/useIncomingCourse';
import { useIncomingDiary } from './hooks/useIncomingDiary';
import { useIncomingPins } from './hooks/useIncomingPins';
import { usePageSwipe } from './hooks/usePageSwipe';
import { usePins } from './hooks/usePins';
import { usePlaceSearch } from './hooks/usePlaceSearch';
import { useSettings } from './hooks/useSettings';
import { kakaoPlaceUrl } from './lib/directionsLink';
import { getDisplayName } from './lib/currentUser';
import { SEOUL_CENTER, type CourseMap, type MapPadding, type PinMarker } from './map/courseMap';
import { createMapStack } from './map/createCourseMap';
import { encodeSharedCourse } from './services/courseShareService';
import type { CuratorItem } from './services/curatorFeedService';
import { encodeSharedPinSet } from './services/pinShareService';
import { pointPlace, type PlaceSearchService } from './services/placeSearch/placeSearchService';
import { withRecentCategory } from './services/settingsRepository';
import type { ShareTarget } from './services/shareTargets';
import type { PlaceRef } from './types/course';
import { PIN_ICONS, type Pin } from './types/pin';

type SheetSize = 'peek' | 'full';
type Toast = { text: string; undo?: () => void };

const DESKTOP_QUERY = '(min-width: 900px)';

export default function App() {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const sheetEl = useRef<HTMLElement | null>(null);
  const barEl = useRef<HTMLDivElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<CourseMap | null>(null);
  const [searchService, setSearchService] = useState<PlaceSearchService | null>(null);
  const [mapProvider, setMapProvider] = useState<'kakao' | 'maplibre' | null>(null);

  const [toast, setToast] = useState<Toast | null>(null);
  const notify = useCallback((text: string, undo?: () => void) => setToast({ text, undo }), []);

  const { settings, update: updateSettings } = useSettings();

  // Themes belong to calendar days: the day on screen reports its own, and
  // it lives on <html data-theme>, where styles.css swaps the tokens.
  const [dayTheme, setDayTheme] = useState<ThemeId>('default');
  useEffect(() => {
    const root = document.documentElement;
    if (dayTheme === 'default') delete root.dataset.theme;
    else root.dataset.theme = dayTheme;
  }, [dayTheme]);
  const pinStore = usePins();
  const { pins, categories } = pinStore;
  const course = useCourseDraft();
  const day = useDiaryDay(notify);
  const { incoming: incomingCourse, dismiss: dismissCourse } = useIncomingCourse();
  const { incoming: incomingDiary, dismiss: dismissDiary } = useIncomingDiary();
  const { incoming: incomingPins, dismiss: dismissPins } = useIncomingPins();

  const [tab, setTab] = useState<AppTab>('pins');
  const [sub, setSub] = useState<PinsSub>('pins');
  const [sheet, setSheet] = useState<SheetSize>('peek');
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sharedSaved, setSharedSaved] = useState(false);
  const [sharedPinsSaved, setSharedPinsSaved] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<PlaceRef | null>(null);
  const [previewPinning, setPreviewPinning] = useState(false);

  const [pinning, setPinning] = useState(false);
  // The calendar page: its zoom level (reported by CalendarZoom), the menu
  // above the calendar button, and commands sent down from that menu.
  const [calendarMode, setCalendarMode] = useState<'day' | 'month'>('day');
  const [calendarMenu, setCalendarMenu] = useState(false);
  // A 꾸미기 tool is out on the calendar: the tab buttons step aside for its tray.
  const [decorating, setDecorating] = useState(false);
  const [calendarCommand, setCalendarCommand] = useState<CalendarCommand | null>(null);
  const sendCalendar = (type: CalendarCommand['type']) => {
    setCalendarMenu(false);
    setCalendarCommand((prev) => ({ type, seq: (prev?.seq ?? 0) + 1 }));
  };
  const [dropBusy, setDropBusy] = useState(false);
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [pinFilter, setPinFilter] = useState<string | null>(null);
  const [guide, setGuide] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const sharedCourse = incomingCourse.status === 'ready' ? incomingCourse.course : null;
  const sharedDiary = incomingDiary.status === 'ready' ? incomingDiary.diary : null;
  const sharedPins = incomingPins.status === 'ready' ? incomingPins.set : null;
  const activePin = pins.find((p) => p.id === activePinId) ?? null;
  const onPinHome = tab === 'pins' && !sharedCourse && !sharedPins;
  // On phones the pin screen's sheet drops down from the top, leaving the map's lower half clear.
  const sheetTop = tab === 'pins';
  const shownPins = useMemo(() => filterPins(pins, categories, pinFilter), [pins, categories, pinFilter]);

  // Numbered course markers + solid route line.
  const shownStops = useMemo(() => {
    if (sharedCourse) return sharedCourse.stops.map((s) => s.place);
    if (sharedPins) return [];
    if (tab === 'calendar') {
      if (sharedDiary) return sharedDiary.stops.map((s) => s.place);
      if (day.screen.kind === 'edit') return day.draft.stops.map((s) => s.place);
      if (day.screen.kind === 'wish') return day.screen.item.stops.map((s) => s.place);
      return [];
    }
    if (tab === 'pins' && sub !== 'pins') return course.draft.stops.map((s) => s.place);
    return [];
  }, [sharedCourse, sharedPins, sharedDiary, tab, sub, day.screen, day.draft.stops, course.draft.stops]);

  // Pin markers: a received set as its sender styled it, or my pins on the home tab.
  const pinMarkers = useMemo<PinMarker[]>(() => {
    if (sharedPins) {
      return sharedPins.pins.map((pin, i) => {
        const category = sharedPins.categories[pin.category];
        const parent = category?.parent !== undefined ? sharedPins.categories[category.parent] : undefined;
        return {
          id: `shared:${i}`,
          center: pin.place.center,
          name: pin.place.name,
          emoji: PIN_ICONS[parent?.icon ?? category?.icon ?? 'pin'],
          color: category?.color ?? 8,
        };
      });
    }
    if (sharedCourse || !(onPinHome || pinning)) return [];
    return (pinning ? pins : shownPins).map((pin) => {
      const style = categoryStyle(categories, pin.categoryId);
      return {
        id: pin.id,
        center: pin.place.center,
        name: pin.place.name,
        emoji: style.emoji,
        color: style.color,
        selected: pin.id === activePinId || (selecting && selected.has(pin.id)),
      };
    });
  }, [sharedPins, sharedCourse, onPinHome, pinning, pins, shownPins, categories, activePinId, selecting, selected]);

  const guidePoints = useMemo(() => {
    if (!onPinHome || sub !== 'pins' || !guide || !pinFilter || shownPins.length < 2) return null;
    const points = shownPins.map((p) => p.place.center);
    return orderByNearest(points).map((i) => points[i]);
  }, [onPinHome, sub, guide, pinFilter, shownPins]);

  const search = usePlaceSearch(searchService, query, () => mapRef.current?.getCenter());

  // The sheet (and the bottom bar under it) cover part of the map; fit and
  // focus around them. The cap keeps a full sheet from squeezing the map.
  const mapPadding = useCallback((extraBottom = 0): MapPadding => {
    const sheetBox = sheetEl.current;
    const desktop = window.matchMedia(DESKTOP_QUERY).matches;
    const barHeight = barEl.current?.offsetHeight ?? 0;
    const cap = (px: number) => Math.min(px, window.innerHeight * 0.5);
    if (!desktop && sheetBox?.classList.contains('sheet--top')) {
      // The pin screen's sheet hangs from the top instead (it includes the search bar area).
      return { top: cap(sheetBox.offsetHeight) + 30, right: 40, bottom: barHeight + 30 + extraBottom, left: 40 };
    }
    const covered = cap((sheetBox?.offsetHeight ?? 0) + barHeight);
    return {
      top: 90,
      right: 40,
      bottom: desktop ? 40 + extraBottom : covered + 30 + extraBottom,
      left: desktop && sheetBox ? sheetBox.offsetWidth + 42 : 40,
    };
  }, []);

  const mapEvents = useRef({ stop: (_i: number) => {}, pin: (_id: string) => {}, longPress: (_c: [number, number]) => {} });

  useEffect(() => {
    if (!mapEl.current) return;
    let disposed = false;
    let created: CourseMap | null = null;
    createMapStack(mapEl.current, {
      center: SEOUL_CENTER,
      onStopClick: (index) => mapEvents.current.stop(index),
      onPinClick: (id) => mapEvents.current.pin(id),
      onLongPress: (center) => mapEvents.current.longPress(center),
    }).then(({ map, search: service }) => {
      if (disposed) return map.destroy();
      created = map;
      mapRef.current = map;
      // Handy for poking at the map from devtools / the preview browser.
      if (import.meta.env.DEV) (window as unknown as { __courseMap?: CourseMap }).__courseMap = map;
      setSearchService(service);
      setMapProvider(map.provider);
    });
    return () => {
      disposed = true;
      created?.destroy();
      mapRef.current = null;
    };
  }, []);

  const stopsKey = shownStops.map((p) => p.id).join('|');
  useEffect(() => {
    mapRef.current?.setCourse(shownStops);
  }, [shownStops, mapProvider]);
  useEffect(() => {
    if (!mapRef.current || shownStops.length === 0) return;
    const id = requestAnimationFrame(() => mapRef.current?.fitCourse(mapPadding()));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopsKey, mapProvider]);

  useEffect(() => {
    mapRef.current?.setPins(pinMarkers);
  }, [pinMarkers, mapProvider]);

  useEffect(() => {
    mapRef.current?.setGuideLine(guidePoints);
    if (guidePoints) mapRef.current?.fitPoints(guidePoints, mapPadding());
  }, [guidePoints, mapProvider, mapPadding]);

  const sharedPinsKey = sharedPins?.sharedAt ?? '';
  useEffect(() => {
    if (!sharedPins || !mapRef.current) return;
    const points = sharedPins.pins.map((p) => p.place.center);
    const id = requestAnimationFrame(() => mapRef.current?.fitPoints(points, mapPadding()));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedPinsKey, mapProvider]);

  useEffect(() => {
    mapRef.current?.setPreview(preview);
  }, [preview, mapProvider]);

  useEffect(() => {
    const onResize = () => mapRef.current?.resize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ----- Incoming links -----

  useEffect(() => {
    if (incomingCourse.status === 'invalid') {
      notify('공유 링크를 열 수 없어요. 링크가 잘렸는지 확인해 주세요.');
      dismissCourse();
    }
    if (incomingCourse.status === 'ready') {
      setSharedSaved(false);
      setTab((t) => tabForIncoming('course', t));
      // Recipients should see the route on the map first; the list is one tap away.
      setSheet('peek');
    }
  }, [incomingCourse, dismissCourse, notify]);

  useEffect(() => {
    if (incomingDiary.status === 'invalid') {
      notify('공유받은 하루 루트를 열 수 없어요. 링크가 잘렸는지 확인해 주세요.');
      dismissDiary();
    }
    if (incomingDiary.status === 'ready') {
      setTab((t) => tabForIncoming('day', t));
      setSheet('peek');
    }
  }, [incomingDiary, dismissDiary, notify]);

  useEffect(() => {
    if (incomingPins.status === 'invalid') {
      notify('공유받은 핀셋을 열 수 없어요. 링크가 잘렸는지 확인해 주세요.');
      dismissPins();
    }
    if (incomingPins.status === 'ready') {
      setSharedPinsSaved(false);
      setTab((t) => tabForIncoming('pins', t));
      setSheet('peek');
    }
  }, [incomingPins, dismissPins, notify]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), toast.undo ? 4000 : 2600);
    return () => clearTimeout(id);
  }, [toast]);

  // ----- Map events -----

  const focusPoint = (center: [number, number], extra = 0) =>
    requestAnimationFrame(() => mapRef.current?.focus(center, mapPadding(extra)));

  mapEvents.current.stop = (index: number) => {
    const place = shownStops[index];
    if (!place) return;
    mapRef.current?.focus(place.center, mapPadding());
    document.querySelectorAll('.stop-list__item')[index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  mapEvents.current.pin = (id: string) => {
    if (id.startsWith('shared:')) {
      const pin = sharedPins?.pins[Number(id.slice(7))];
      if (pin) mapRef.current?.focus(pin.place.center, mapPadding());
      return;
    }
    if (pinning) return;
    if (selecting) return toggleSelect(id);
    openPin(id);
  };

  mapEvents.current.longPress = async (center: [number, number]) => {
    if (pinning || sharedCourse || sharedPins) return;
    const place = pointPlace(center);
    setActivePinId(null);
    setPreview(place);
    setPreviewPinning(false);
    const named = await searchService?.reverse(center);
    // Only if the user is still looking at that spot.
    if (named) setPreview((p) => (p?.id === place.id ? { ...named, id: place.id } : p));
  };

  // ----- Navigation -----

  const changeTab = (next: AppTab) => {
    setTab(next);
    setCalendarMenu(false);
    setPinning(false);
    setPreview(null);
    setActivePinId(null);
    setSelecting(false);
    if (next !== 'calendar' && sharedDiary) dismissDiary();
  };

  const startSearch = () => {
    setSearchOpen(true);
    searchInput.current?.focus();
  };

  const pickPlace = (place: PlaceRef) => {
    setSearchOpen(false);
    searchInput.current?.blur();
    setActivePinId(null);
    setPreview(place);
    setPreviewPinning(false);
    setSheet('peek');
    // Leave room for the place card that sits above the sheet.
    focusPoint(place.center, 150);
  };

  const openPin = (id: string) => {
    const pin = pins.find((p) => p.id === id);
    if (!pin) return;
    setPreview(null);
    setActivePinId(id);
    setSub('pins');
    focusPoint(pin.place.center, 150);
  };

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // ----- Adding places -----

  const inCalendar = tab === 'calendar' && !sharedCourse;
  const courseFull = course.draft.stops.length >= COURSE_LIMITS.maxStops;
  const dayFull = day.draft.stops.length >= DIARY_LIMITS.maxStops;
  const addLabel = inCalendar
    ? dayFull
      ? `최대 ${DIARY_LIMITS.maxStops}곳`
      : diaryKind(day.draft) === 'plan'
        ? '계획에 추가'
        : '기록에 추가'
    : courseFull
      ? `최대 ${COURSE_LIMITS.maxStops}곳`
      : `${course.draft.stops.length + 1}번째로 추가`;

  const addPlace = (place: PlaceRef) => {
    if (inCalendar) {
      if (sharedDiary) dismissDiary();
      day.addPlace(place);
    } else {
      if (sharedCourse) dismissCourse();
      course.setDraft((d) => ({ ...d, stops: addStop(d.stops, place) }));
      setTab('pins');
      setSub('edit');
      notify(`${place.name}을(를) ${course.draft.stops.length + 1}번째로 추가했어요.`);
    }
    setPreview(null);
    setActivePinId(null);
    setQuery('');
  };

  // ----- Pins -----

  const savePinAt = (place: PlaceRef, categoryId: string) => {
    const result = pinStore.savePin(place, categoryId);
    if (!result) return notify('핀은 500개까지 저장할 수 있어요.');
    updateSettings((s) => withRecentCategory(s, categoryId));
    notify(result.existed ? `${place.name}의 카테고리를 바꿨어요.` : `${place.name} 핀을 꽂았어요.`, result.undo);
  };

  const dropPin = async (categoryId: string) => {
    const map = mapRef.current;
    if (!map) return;
    const center = map.getCenter();
    setDropBusy(true);
    const named = await searchService?.reverse(center);
    setDropBusy(false);
    savePinAt(named ?? pointPlace(center), categoryId);
  };

  const startPinning = () => {
    if (pinning) return setPinning(false);
    if (sharedCourse) dismissCourse();
    if (sharedPins) dismissPins();
    changeTab('pins');
    setSub('pins');
    setPinning(true);
  };

  const connectPins = (chosen: Pin[]) => {
    const order = orderByNearest(chosen.map((p) => p.place.center));
    const next = { ...emptyDraft(), stops: order.map((i) => ({ place: chosen[i].place })) };
    if (!course.replaceDraft(next, { question: '만들던 코스가 있어요. 선택한 핀으로 새 코스를 만들까요?' })) return;
    setSelecting(false);
    setSelected(new Set());
    setSub('edit');
    notify(`${chosen.length}곳을 가까운 순서로 이었어요. 순서를 바꿔도 돼요.`);
  };

  const sharePins = (chosen: Pin[], title: string) => {
    const { set, dropped } = buildPinSet(title || `핀 ${chosen.length}곳`, chosen, categories, getDisplayName());
    setShareTarget({ kind: 'pins', set, dropped });
  };

  const openCuratorItem = (item: CuratorItem) => {
    // Reuse the link flow: the same views, validation and "save" buttons as a received link.
    window.location.hash =
      item.kind === 'course' ? `share=${encodeSharedCourse(item.course).token}` : `pins=${encodeSharedPinSet(item.pins).token}`;
  };

  // ----- Render -----

  const providerLabel =
    mapProvider === 'kakao' ? '카카오' : mapProvider === 'maplibre' ? 'OpenStreetMap (카카오 키 없음)' : '준비 중';
  const pinCounts = useMemo(() => {
    const counts = new Map<string, number>();
    pins.forEach((p) => counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1));
    return counts;
  }, [pins]);

  const renderSheet = () => {
    if (sharedCourse) {
      return (
        <div className="sheet__content">
          <SharedCourseView
            course={sharedCourse}
            saved={sharedSaved}
            onSave={async () => {
              await course.save({ ...sharedCourse, sharedBy: sharedCourse.sharedBy ?? '익명' });
              setSharedSaved(true);
              notify('내 코스에 저장했어요.');
            }}
            onEditCopy={() => {
              const { title, theme, travelMode, stops, note } = sharedCourse;
              if (!course.replaceDraft({ title, theme, travelMode, stops, note })) return;
              dismissCourse();
              setTab('pins');
              setSub('edit');
            }}
            onClose={dismissCourse}
            onFocusStop={(i) => mapEvents.current.stop(i)}
          />
        </div>
      );
    }
    if (sharedPins) {
      return (
        <div className="sheet__content">
          <SharedPinsView
            set={sharedPins}
            saved={sharedPinsSaved}
            onSave={() => {
              const added = pinStore.importSet(sharedPins);
              setSharedPinsSaved(true);
              notify(added > 0 ? `${added}곳을 내 핀에 저장했어요.` : '이미 모두 저장된 핀이에요.');
            }}
            onFocus={(i) => mapEvents.current.pin(`shared:${i}`)}
            onClose={dismissPins}
          />
        </div>
      );
    }
    if (tab === 'calendar') {
      return (
        <div className="sheet__content">
          <CalendarSheet
            key={sharedDiary?.sharedAt ?? 'mine'}
            day={day}
            sharedDiary={sharedDiary}
            onDismissShared={dismissDiary}
            search={searchService}
            pins={pins}
            categories={categories}
            onFocusStop={(i) => mapEvents.current.stop(i)}
            onStartSearch={startSearch}
            onShare={(draft) => setShareTarget({ kind: 'day', draft })}
          />
        </div>
      );
    }
    if (tab === 'influencer') {
      return (
        <div className="sheet__content">
          <InfluencerPanel onOpen={openCuratorItem} />
        </div>
      );
    }
    return (
      <PinsSheet
        sub={sub}
        onSub={(next) => {
          setSub(next);
          setActivePinId(null);
          if (next === 'list') setSheet('full');
        }}
        pinCount={pins.length}
        course={course}
        panel={{
          pins,
          categories,
          filter: pinFilter,
          onFilter: (id) => {
            setPinFilter(id);
            setGuide(false);
          },
          guide,
          onGuide: setGuide,
          selecting,
          onSelecting: (on) => {
            setSelecting(on);
            setSelected(new Set());
            setActivePinId(null);
          },
          selected,
          onToggleSelect: toggleSelect,
          onOpenPin: (pin) => openPin(pin.id),
          onConnect: connectPins,
          onShare: sharePins,
        }}
        onSaveCourse={async () => {
          await course.saveDraft();
          notify('코스를 저장했어요.');
        }}
        onShareCourse={() => setShareTarget({ kind: 'course', draft: course.draft })}
        onRemoveCourse={async (c) => {
          await course.removeCourse(c);
          notify('코스를 삭제했어요.');
        }}
        onFocusStop={(i) => mapEvents.current.stop(i)}
        onStartSearch={startSearch}
      />
    );
  };

  const cardTargetFull = inCalendar ? dayFull : courseFull;
  // A received day (#diary=) still opens in the old timeline view.
  const calendarZoom = tab === 'calendar' && !sharedDiary;
  const onPage = showsPage(tab, Boolean(sharedCourse || sharedPins || searchOpen || preview));
  // Swiping 달력 left / 추천 right slides the page off and uncovers the map (핀).
  const swipe = usePageSwipe(onPage && !decorating ? homeSwipeDirection(tab) : 0, () => changeTab('pins'));

  return (
    <div className={`app ${searchOpen ? 'app--searching' : ''} ${pinning ? 'app--pinning' : ''} ${sheetTop ? 'app--sheet-top' : ''} ${onPage ? 'app--page' : ''}`}>
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

      <button className="corner-btn" aria-label="설정" onClick={() => setSettingsOpen(true)}>
        <SettingsIcon size={22} aria-hidden />
      </button>

      {pinning && (
        <PinDropTray
          categories={categories}
          recent={settings.recentCategoryIds}
          busy={dropBusy}
          onPick={dropPin}
          onCancel={() => setPinning(false)}
        />
      )}

      {preview && !searchOpen && !pinning && (
        <div className="place-card" role="dialog" aria-label="선택한 장소">
          <div className="place-card__info">
            <strong>{preview.name}</strong>
            <span>{[preview.category, preview.address].filter(Boolean).join(' · ')}</span>
          </div>
          {previewPinning && (
            <CategoryChips
              categories={categories}
              recent={settings.recentCategoryIds}
              label="핀 카테고리"
              onPick={(id) => {
                savePinAt(preview, id);
                setPreview(null);
              }}
            />
          )}
          <div className="place-card__actions">
            <a className="btn btn--ghost" href={kakaoPlaceUrl(preview)} target="_blank" rel="noreferrer">
              상세
            </a>
            <button
              className={`btn ${previewPinning ? 'btn--secondary' : 'btn--ghost'}`}
              aria-pressed={previewPinning}
              onClick={() => setPreviewPinning((v) => !v)}
            >
              📍 핀
            </button>
            <button className="btn btn--primary" onClick={() => addPlace(preview)} disabled={cardTargetFull}>
              {addLabel}
            </button>
          </div>
          <button className="place-card__close icon-btn" aria-label="닫기" onClick={() => setPreview(null)}>
            <X size={20} aria-hidden />
          </button>
        </div>
      )}

      {activePin && !preview && !searchOpen && !pinning && onPinHome && (
        <PinCard
          pin={activePin}
          categories={categories}
          addLabel={courseFull ? `최대 ${COURSE_LIMITS.maxStops}곳` : '코스에 추가'}
          addDisabled={courseFull}
          onAdd={() => addPlace(activePin.place)}
          onRecategorize={(id) => {
            pinStore.updatePin(activePin.id, { categoryId: id });
            updateSettings((s) => withRecentCategory(s, id));
          }}
          onMemo={(memo) => pinStore.updatePin(activePin.id, { memo: memo || undefined })}
          onDelete={() => {
            const undo = pinStore.removePin(activePin.id);
            setActivePinId(null);
            notify(`${activePin.place.name} 핀을 지웠어요.`, undo);
          }}
          onClose={() => setActivePinId(null)}
        />
      )}

      {onPage ? (
        <section className="page" aria-label={PAGE_TITLES[tab]} style={swipe.style} {...swipe.handlers}>
          <header className="page__head">
            {/* The calendar's own TODAY / DAY n heading takes the stage. */}
            <h1 className={calendarZoom ? 'sr-only' : ''}>{PAGE_TITLES[tab]}</h1>
            <button className="icon-btn" aria-label="설정" onClick={() => setSettingsOpen(true)}>
              <SettingsIcon size={22} aria-hidden />
            </button>
          </header>
          {calendarZoom ? (
            <CalendarZoom
              command={calendarCommand}
              onDecorating={setDecorating}
              onDayTheme={setDayTheme}
              onMode={(mode) => {
                setCalendarMode(mode);
                setCalendarMenu(false);
              }}
            />
          ) : (
            renderSheet()
          )}
        </section>
      ) : (
        <section ref={sheetEl} className={`sheet sheet--${sheet} ${sheetTop ? 'sheet--top' : ''}`} aria-label="패널">
          <button
            className="sheet__grip"
            aria-label={sheet === 'full' ? '패널 줄이기' : '패널 펼치기'}
            aria-expanded={sheet === 'full'}
            onClick={() => setSheet((s) => (s === 'full' ? 'peek' : 'full'))}
          >
            <span aria-hidden />
          </button>
          {renderSheet()}
        </section>
      )}

      <div ref={barEl} className={`bottom-bar-wrap ${decorating && calendarZoom && onPage ? 'is-away' : ''}`} inert={decorating && calendarZoom && onPage}>
        <BottomBar
          tab={swipe.leaving ? 'pins' : tab}
          pinning={pinning}
          onTab={changeTab}
          onPin={startPinning}
          onCalendarAgain={() => {
            const next = calendarAgain(calendarMode, calendarMenu);
            if (next === 'today') sendCalendar('today');
            else setCalendarMenu(next === 'open-menu');
          }}
          calendarMenu={calendarMenu && tab === 'calendar' && calendarZoom}
          onCloseCalendarMenu={() => setCalendarMenu(false)}
          onShareDay={() => sendCalendar('share')}
          onShowMonth={() => sendCalendar('month')}
        />
      </div>

      {shareTarget && <ShareSheet target={shareTarget} onClose={() => setShareTarget(null)} />}
      {settingsOpen && (
        <SettingsSheet
          providerLabel={providerLabel}
          onClose={() => setSettingsOpen(false)}
          categories={categories}
          pinCounts={pinCounts}
          onCreate={pinStore.createCategory}
          onEdit={pinStore.editCategory}
          onMove={pinStore.reorderCategory}
          onDelete={pinStore.deleteCategory}
        />
      )}

      <div className={`toast ${toast ? 'toast--on' : ''} ${toast?.undo ? 'toast--action' : ''}`} role="status" aria-live="polite">
        {toast?.text}
        {toast?.undo && (
          <button
            className="toast__undo"
            onClick={() => {
              toast.undo?.();
              setToast(null);
            }}
          >
            되돌리기
          </button>
        )}
      </div>
    </div>
  );
}
