import { Pencil } from 'lucide-react';
import type { PatternId, ThemeId } from './domain/decor';
import DayPattern from './components/DayPattern';
import ShareStudio from './components/ShareStudio';
import ConfirmDialog from './components/ConfirmDialog';
import ShareTagButton from './components/ShareTagButton';
import { routeSubject, type ShareSubject } from './domain/shareSubject';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BottomBar from './components/BottomBar';
import CalendarZoom, { type CalendarCommand } from './components/CalendarZoom';
import NewPinCard, { type NewPinInput } from './components/NewPinCard';
import PinCard from './components/PinCard';
import PinRail from './components/PinRail';
import RouteBuildLayer, { pinAt } from './components/RouteBuildLayer';
import RouteEditTray from './components/RouteEditTray';
import RouteFolderTray from './components/RouteFolderTray';
import RouteStyleLayer from './components/RouteStyleLayer';
import RouteTitle from './components/RouteTitle';
import StopLines from './components/StopLines';
import SearchBar from './components/SearchBar';
import ProfileSheet, { ProfileAvatar } from './components/ProfileSheet';
import CategorySheet from './components/CategorySheet';
import SharedCourseView from './components/SharedCourseView';
import SharedPinsView from './components/SharedPinsView';
import { visibleCenter } from './domain/adminAreas';
import { calendarAgain, homeSwipeDirection, PAGE_TITLES, showsPage, tabForIncoming, type AppTab } from './domain/appTabs';
import { COURSE_LIMITS } from './domain/course';
import type { MapViewport } from './domain/districtMap';
import { categoryStyle, filterPinsByCategories, isUncategorized, UNCATEGORIZED } from './domain/pin';
import { pinRailNext, togglePicked, type PinRailEntry, type PinRailMode } from './domain/pinRail';
import { PRESS } from './domain/dayPings';
import { buildRouteLook, EMPTY_BUILD_LOOK, nextRouteName, ROUTE_NOTE_MAX, toggleBuildStop, withBuildEdge, withBuildShape, type BuildLook } from './domain/routeBuild';
import { addEditStop, moveStop, toggleEditStop, withEditStops, type RouteEdit } from './domain/routeEdit';
import { cleanRouteLook, withEdgeStyle, withStopShape } from './domain/routeStyle';
import { folderOf, moveRoute, neighborRoute, type RouteTab } from './domain/routeFolders';
import { useCourses } from './hooks/useCourses';
import { useAreaMap } from './hooks/useAreaMap';
import { useIncomingCourse } from './hooks/useIncomingCourse';
import { useIncomingPins } from './hooks/useIncomingPins';
import { usePageSwipe } from './hooks/usePageSwipe';
import { usePins } from './hooks/usePins';
import { useRouteFolders } from './hooks/useRouteFolders';
import { usePlaceSearch } from './hooks/usePlaceSearch';
import { useSettings } from './hooks/useSettings';
import { SEOUL_CENTER, type CourseMap, type MapPadding, type PinMarker } from './map/courseMap';
import { createMapStack } from './map/createCourseMap';
import { pointPlace, type PlaceSearchService } from './services/placeSearch/placeSearchService';
import { withRecentCategory } from './services/settingsRepository';
import { loadProfile, saveProfile, type Profile } from './services/profileRepository';
import { usePrivacy } from './hooks/usePrivacy';
import { hasHome } from './domain/privacy';
import type { CourseStop, PlaceRef, Course } from './types/course';
import type { Pin } from './types/pin';

type SheetSize = 'peek' | 'full';
type Toast = { text: string; undo?: () => void };

const DESKTOP_QUERY = '(min-width: 900px)';

/** Matches `tray-down` in styles.css: the 경로 폴더 sheet stays mounted while it slides away. */
const ROUTE_TRAY_OUT_MS = 170;
/** How much of the folder sheet stays up while a route is on show (matches .route-folders.is-lowered). */
const FOLDER_LOWERED_PX = 314;
/** Once the map has glided over to a route, the pins fade off (matches .app--pins-away), and only then do its stops drop in. */
const PINS_FADE_MS = 250;
/** A route stepped to with < > glides over as fast as its name slides in (RouteTitle SLIDE_MS). */
const STEP_GLIDE_MS = 260;

export default function App() {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const sheetEl = useRef<HTMLElement | null>(null);
  const barEl = useRef<HTMLDivElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<CourseMap | null>(null);
  const [searchService, setSearchService] = useState<PlaceSearchService | null>(null);
  const [mapProvider, setMapProvider] = useState<'kakao' | 'maplibre' | null>(null);
  const [viewport, setViewport] = useState<MapViewport | null>(null);

  const [toast, setToast] = useState<Toast | null>(null);
  const notify = useCallback((text: string, undo?: () => void) => setToast({ text, undo }), []);

  const { settings, update: updateSettings } = useSettings();

  // Themes belong to calendar days (the day on screen reports its own) and
  // to share cards (the 꾸미기 screen reports its card's, over the day's while
  // it's up); the one showing lives on <html data-theme>, where styles.css
  // swaps the tokens.
  const [calendarTheme, setDayTheme] = useState<ThemeId>('default');
  // …and so do background patterns, drawn across the calendar page.
  const [dayPattern, setDayPattern] = useState<PatternId>('none');
  // The card on the 꾸미기 screen (a calendar day's or a route's), while it's up.
  const [studio, setStudio] = useState<ShareSubject | null>(null);
  const [studioTheme, setStudioTheme] = useState<ThemeId>('default');
  const dayTheme = studio ? studioTheme : calendarTheme;
  useEffect(() => {
    const root = document.documentElement;
    if (dayTheme === 'default') delete root.dataset.theme;
    else root.dataset.theme = dayTheme;
    // Phone browsers tint their own bars (and the strip under the page at the
    // bottom edge) from theme-color; left alone it keeps the default theme's
    // colour, a pale band under a themed page.
    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    metas.forEach((m) => {
      m.dataset.base ??= m.content;
      m.content = dayTheme === 'default' ? m.dataset.base : getComputedStyle(root).getPropertyValue('--surface').trim();
    });
  }, [dayTheme]);
  const pinStore = usePins();
  const routeFolders = useRouteFolders();
  const { pins, categories } = pinStore;
  const course = useCourses();
  const { incoming: incomingCourse, dismiss: dismissCourse } = useIncomingCourse();
  const { incoming: incomingPins, dismiss: dismissPins } = useIncomingPins();

  const [tab, setTab] = useState<AppTab>('pins');
  const [sheet, setSheet] = useState<SheetSize>('peek');
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState(loadProfile);
  const changeProfile = (next: Profile) => {
    setProfile(next);
    return saveProfile(next);
  };
  // 공유 before 집 is set opens the profile on 개인 정보 with this line.
  const [privacyNotice, setPrivacyNotice] = useState<string | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [sharedSaved, setSharedSaved] = useState(false);
  const [sharedPinsSaved, setSharedPinsSaved] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<PlaceRef | null>(null);

  // The calendar page: its zoom level (reported by CalendarZoom), and the
  // calendar button's commands sent down to it.
  const [calendarMode, setCalendarMode] = useState<'day' | 'month'>('day');
  // A 꾸미기 tool is out on the calendar: the tab buttons step aside for its tray.
  const [decorating, setDecorating] = useState(false);
  const [calendarCommand, setCalendarCommand] = useState<CalendarCommand | null>(null);
  const sendCalendar = (type: CalendarCommand['type']) => {
    setCalendarCommand((prev) => ({ type, seq: (prev?.seq ?? 0) + 1 }));
  };
  const [activePinId, setActivePinId] = useState<string | null>(null);
  // The round buttons under ⚙, and the categories picked in its 핀 list.
  const [railMode, setRailMode] = useState<PinRailMode>('menu');
  // The saved route drawn on the map from the 경로 폴더.
  const [shownRouteId, setShownRouteId] = useState<string | null>(null);
  // The 경로 폴더's open tab (kept here: the sheet unmounts while it is down).
  const [routeTab, setRouteTab] = useState<RouteTab>('all');
  // The route the < > arrows last stepped to and the side its name slides in from.
  const [routeStep, setRouteStep] = useState<{ id: string; from: -1 | 1 } | null>(null);
  // Making a new route from pins (the folder's +): the pins tapped so far, in order.
  const [building, setBuilding] = useState<string[] | null>(null);
  // Shapes and line styles long-pressed onto the route being made, by pin.
  const [buildLook, setBuildLook] = useState<BuildLook>(EMPTY_BUILD_LOOK);
  // Making a route: once it has had a stop, taking the last one out drops
  // the making altogether (the folder sheet comes back). A fresh start from
  // + has none yet and stays.
  const buildHadStops = useRef(false);
  useEffect(() => {
    if (!building) {
      buildHadStops.current = false;
      return setBuildLook(EMPTY_BUILD_LOOK);
    }
    if (building.length > 0) buildHadStops.current = true;
    else if (buildHadStops.current) setBuilding(null);
  }, [building]);
  // Editing the route on show (the pen by its name): its stops, look, icon and description as they stand.
  const [editing, setEditing] = useState<RouteEdit | null>(null);
  const editStops = (change: (stops: CourseStop[]) => CourseStop[]) =>
    setEditing((e) => (e ? withEditStops(e, change(e.stops)) : e));
  // Bumped to send the map back over to the route on show (after editing it).
  const [refit, setRefit] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const sharedCourse = incomingCourse.status === 'ready' ? incomingCourse.course : null;
  const sharedPins = incomingPins.status === 'ready' ? incomingPins.set : null;
  const activePin = pins.find((p) => p.id === activePinId) ?? null;
  const onPinHome = tab === 'pins' && !sharedCourse && !sharedPins;
  // On phones the pin screen's sheet drops down from the top, leaving the map's lower half clear.
  const sheetTop = tab === 'pins';
  // 경로 open on the pin map: the folder sheet takes the tab buttons' place.
  const routeMode = onPinHome && railMode === 'route' && !searchOpen;
  // A saved route can be on show (and being edited) while 경로 is open and no new one is being made.
  const routeShowing = routeMode && building === null;
  // While a route is being made or edited, the folder sheet steps down out of the way.
  const routeOpen = routeShowing && !editing;
  const buildPins = building && routeMode ? building.map((id) => pins.find((p) => p.id === id)).filter((p): p is Pin => !!p) : null;
  // Kept mounted a moment after closing so it can slide down. Up in the
  // same render it opens, so a fit right after (leaving editing) measures it.
  const [routeTrayLingers, setRouteTrayLingers] = useState(routeOpen);
  useEffect(() => {
    if (routeOpen) return setRouteTrayLingers(true);
    const t = window.setTimeout(() => setRouteTrayLingers(false), ROUTE_TRAY_OUT_MS);
    return () => window.clearTimeout(t);
  }, [routeOpen]);
  const routeTrayShown = routeOpen || routeTrayLingers;
  const shownRoute = routeShowing ? (course.courses.find((c) => c.id === shownRouteId) ?? null) : null;
  // The route being edited: the one on show, with the edits so far.
  const editRoute = editing && shownRoute?.id === editing.id ? editing : null;
  // Leaving the route (경로 closed, another tab) drops an edit not saved with ✓.
  useEffect(() => {
    if (!routeShowing) setEditing(null);
  }, [routeShowing]);
  // A route put on show takes the map in turns: it glides over with the pins
  // still there, and the moment the glide ends the pins fade away and the
  // route's own stops drop in. Stepping to another route (< >) plays the
  // same again: the pins come back while the map glides over, then go.
  const [pinsAway, setPinsAway] = useState<'no' | 'fading' | 'gone'>('no');
  // Only 'gone' changes the markers: re-making them mid-fade would cut the fade short.
  const pinsGone = pinsAway === 'gone';
  const shownRouteKey = shownRoute?.id ?? null;
  // The route the map has finished gliding to (set by the fit below).
  const [landedRoute, setLandedRoute] = useState<string | null>(null);
  const routeLanded = !!shownRouteKey && landedRoute === shownRouteKey;
  useEffect(() => {
    if (!shownRouteKey) {
      setLandedRoute(null);
      return setPinsAway('no');
    }
    if (!routeLanded) return setPinsAway('no');
    setPinsAway('fading');
    const fade = window.setTimeout(() => setPinsAway('gone'), PINS_FADE_MS);
    return () => window.clearTimeout(fade);
  }, [shownRouteKey, routeLanded]);
  const shownPins = useMemo(() => filterPinsByCategories(pins, categories, picked), [pins, categories, picked]);

  // Numbered course markers + solid route line.
  const shownStops = useMemo(() => {
    if (sharedCourse) return sharedCourse.stops.map((s) => s.place);
    if (sharedPins) return [];
    if (buildPins) return buildPins.map((p) => p.place);
    if (editRoute) return editRoute.stops.map((s) => s.place);
    if (shownRoute) return shownRoute.stops.map((s) => s.place);
    return [];
  }, [sharedCourse, sharedPins, buildPins, editRoute, shownRoute]);

  // Only whether a route is being edited changes the markers, not each edit
  // (re-making them would drop every pin in again).
  const isEditing = !!editRoute;
  // Pin markers: a received set as its sender styled it, or my pins on the home tab.
  const pinMarkers = useMemo<PinMarker[]>(() => {
    if (sharedPins) {
      return sharedPins.pins.map((pin, i) => {
        const category = sharedPins.categories[pin.category];
        return {
          id: `shared:${i}`,
          center: pin.place.center,
          name: pin.place.name,
          icon: category?.icon ?? 'pin',
          color: category?.color ?? 8,
        };
      });
    }
    if (sharedCourse || !onPinHome) return [];
    // A saved route on show has the map to itself: every pin steps aside
    // (its stops, shaped or numbered, stand in for the places).
    // Editing it, they come back to be picked.
    if (shownRoute && !isEditing && pinsGone) return [];
    return shownPins.map((pin) => {
      const style = categoryStyle(categories, pin.categoryId);
      return {
        id: pin.id,
        center: pin.place.center,
        name: pin.place.name,
        icon: style.icon,
        color: style.color,
        // While making a route, chosen pins show their order as numbered stops instead.
        selected: pin.id === activePinId,
      };
    });
  }, [sharedPins, sharedCourse, onPinHome, shownPins, categories, activePinId, shownRoute, isEditing, pinsGone]);

  const search = usePlaceSearch(searchService, query, () => mapRef.current?.getCenter());
  // 제외 주소 are located with the same place search (search failing just leaves the address text to match).
  const privacy = usePrivacy(async (address) => (await searchService?.search(address))?.[0]?.center ?? null);

  // The sheet (and the bottom bar under it) cover part of the map; fit and
  // focus around them. The cap keeps a full sheet from squeezing the map.
  const mapPadding = useCallback((extraBottom = 0): MapPadding => {
    const sheetBox = sheetEl.current;
    const desktop = window.matchMedia(DESKTOP_QUERY).matches;
    const barHeight = barEl.current?.offsetHeight ?? 0;
    const cap = (px: number) => Math.min(px, window.innerHeight * 0.5);
    // Editing a route: its sheet covers the lower part, and the route is
    // fitted with more room around it (the map steps back a little).
    const editTray = document.querySelector<HTMLElement>('.route-edit');
    if (editTray) {
      const title = document.querySelector<HTMLElement>('.route-title:not(.route-title--out)');
      const top = title ? title.getBoundingClientRect().bottom + 60 : 120;
      return { top, right: 90, bottom: editTray.offsetHeight + 60 + extraBottom, left: 90 };
    }
    // The 경로 폴더 sheet stands in for the tab buttons while it is up.
    const folderTray = document.querySelector<HTMLElement>('.route-folders:not(.is-leaving)');
    if (folderTray) {
      // Lowered (a route on show) only its top strip covers the map.
      const lowered = folderTray.classList.contains('is-lowered');
      const covered = lowered ? FOLDER_LOWERED_PX : folderTray.offsetHeight;
      // A route on show has its name under the rail; the route sits below it.
      const title = document.querySelector<HTMLElement>('.route-title:not(.route-title--out)');
      const top = lowered && title ? title.getBoundingClientRect().bottom + 30 : 90;
      // …and clear of the < > strips at its sides (.route-step, 64px wide).
      const side = lowered ? 80 : 40;
      return { top, right: side, bottom: covered + 30 + extraBottom, left: side };
    }
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
      onViewportChange: setViewport,
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

  // Focus the area in the middle of the uncovered map, not under the sheet.
  const areaFocus = useMemo(() => {
    const el = mapEl.current;
    if (!viewport || !el) return null;
    return visibleCenter(viewport.bounds, { width: el.clientWidth, height: el.clientHeight }, mapPadding());
  }, [viewport, mapPadding]);
  const areaMap = useAreaMap(viewport, areaFocus);
  useEffect(() => {
    mapRef.current?.setAreaMap(areaMap);
  }, [areaMap, mapProvider]);
  // Entering an area turns the map so the area looks most like a rectangle.
  // Turning moves the screen center, which can pick a neighbor whose own
  // angle would turn the map back; focus changes right after our own turn
  // are taken as that and not followed.
  const turnedFor = useRef({ code: '', until: 0 });
  useEffect(() => {
    const focus = areaMap?.focus;
    const last = turnedFor.current;
    if (!focus || focus.code === last.code) return;
    last.code = focus.code;
    const now = Date.now();
    if (now < last.until) return;
    last.until = now + 1500;
    mapRef.current?.setBearing(focus.bearing);
  }, [areaMap]);

  const stopsKey = shownStops.map((p) => p.id).join('|');
  useEffect(() => {
    mapRef.current?.setCourse(shownStops);
  }, [shownStops, mapProvider]);
  useEffect(() => {
    // While a route is being made from pins the map stays put: re-fitting on
    // every added stop would move the next pin out from under the finger.
    if (!mapRef.current || shownStops.length === 0 || buildPins || editRoute) return;
    const route = shownRouteKey;
    // Stepped to with < >: the map keeps pace with the title sliding over
    // (STEP_GLIDE_MS), so the stops drop in as soon as the new name is in.
    const stepped = !!shownRoute && routeStep?.id === shownRoute.id;
    let live = true;
    const id = requestAnimationFrame(() => {
      void mapRef.current?.fitCourse(mapPadding(), stepped ? STEP_GLIDE_MS : undefined).then(() => {
        if (live && route) setLandedRoute(route);
      });
    });
    return () => {
      live = false;
      cancelAnimationFrame(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopsKey, shownRouteKey, mapProvider, refit]);

  // Into editing: once its sheet is up, the map steps back a little around the route.
  const editKey = editRoute?.id ?? null;
  useEffect(() => {
    if (!editKey) return;
    const id = requestAnimationFrame(() => void mapRef.current?.fitCourse(mapPadding()));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editKey]);

  useEffect(() => {
    mapRef.current?.setPins(pinMarkers);
  }, [pinMarkers, mapProvider]);

  // Making or editing a route: a pin already in it steps aside (its numbered stop
  // stands in), and so does one the moment it's added; taken out, it's back.
  // Marked on the markers rather than left out of them: re-making the
  // markers would drop every pin in again.
  const editPlaces = editRoute
    ? editRoute.stops.map((st) => st.place.id).join('\n')
    : buildPins
      ? buildPins.map((p) => p.place.id).join('\n')
      : '';
  useEffect(() => {
    const inRoute = new Set(editPlaces ? editPlaces.split('\n') : []);
    const placeOf = new Map(pins.map((p) => [p.id, p.place.id]));
    document.querySelectorAll<HTMLElement>('.map-marker--pin[data-pin-id]').forEach((el) => {
      if (inRoute.has(placeOf.get(el.dataset.pinId ?? '') ?? '')) el.dataset.inRoute = '';
      else delete el.dataset.inRoute;
    });
  }, [editPlaces, pinMarkers, pins, mapProvider]);

  const sharedPinsKey = sharedPins?.sharedAt ?? '';
  useEffect(() => {
    if (!sharedPins || !mapRef.current) return;
    const points = sharedPins.pins.map((p) => p.place.center);
    const id = requestAnimationFrame(() => mapRef.current?.fitPoints(points, mapPadding()));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedPinsKey, mapProvider]);

  // Keyed by the spot, not the object: the address name landing a moment
  // later mustn't re-make the marker (and drop it in a second time).
  const previewSpot = preview ? `${preview.id}|${preview.center.join(',')}` : '';
  useEffect(() => {
    mapRef.current?.setPreview(preview);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewSpot, mapProvider]);

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
      setTab(tabForIncoming('course'));
      // Recipients should see the route on the map first; the list is one tap away.
      setSheet('peek');
    }
  }, [incomingCourse, dismissCourse, notify]);

  useEffect(() => {
    if (incomingPins.status === 'invalid') {
      notify('공유받은 핀셋을 열 수 없어요. 링크가 잘렸는지 확인해 주세요.');
      dismissPins();
    }
    if (incomingPins.status === 'ready') {
      setSharedPinsSaved(false);
      setTab(tabForIncoming('pins'));
      setSheet('peek');
    }
  }, [incomingPins, dismissPins, notify]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), toast.undo ? 4000 : 2600);
    return () => clearTimeout(id);
  }, [toast]);

  // ----- Map events -----

  mapEvents.current.stop = (index: number) => {
    // Making a route: a chosen pin is covered by its numbered stop, so a tap
    // there takes it back out.
    if (building && routeMode) return setBuilding((b) => (b ? b.filter((_, i) => i !== index) : b));
    if (editRoute) return editStops((stops) => stops.filter((_, i) => i !== index));
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
    // Making a route: a tap adds the pin as the next stop (or takes it back out).
    if (building && routeMode) return setBuilding((b) => (b ? toggleBuildStop(b, id) : b));
    if (editRoute) {
      const pin = pins.find((p) => p.id === id);
      if (pin) editStops((stops) => toggleEditStop(stops, pin.place));
      return;
    }
    openPin(id);
  };

  mapEvents.current.longPress = async (center: [number, number]) => {
    // Making a route, or a saved one on show (its long presses restyle it): no place card.
    if (sharedCourse || sharedPins || (building && routeMode) || shownRoute) return;
    await openNewPinAt(center);
  };

  // A new pin's card on a spot: centred, named by its address once that's known.
  const openNewPinAt = async (center: [number, number]) => {
    const place = pointPlace(center);
    setActivePinId(null);
    setPreview(place);
    // Into the middle at the current zoom; the new pin's card stands above it.
    mapRef.current?.centerOn(center);
    const named = await searchService?.reverse(center);
    // Only if the user is still looking at that spot.
    if (named) setPreview((p) => (p?.id === place.id ? { ...named, id: place.id } : p));
  };

  // ----- Navigation -----

  const changeTab = (next: AppTab) => {
    setTab(next);
    setPreview(null);
    setActivePinId(null);
    // An open search belongs to the map: leaving for another tab cancels it
    // (it would otherwise keep the map, and the old panel, showing under 달력).
    setSearchOpen(false);
    setQuery('');
    searchInput.current?.blur();
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
    // Into the middle at the current zoom; the new pin's card stands above it.
    mapRef.current?.centerOn(place.center);
  };

  // Stable, so the card's outside-touch listener isn't re-attached every render.
  const closePinCard = useCallback(() => setActivePinId(null), []);

  const openPin = (id: string) => {
    const pin = pins.find((p) => p.id === id);
    if (!pin) return;
    setPreview(null);
    setActivePinId(id);
    // Into the middle of the map at the current zoom; its card opens just above it.
    mapRef.current?.centerOn(pin.place.center);
  };

  // A pin picked from a 핀 카테고리 list: as if tapped on the map. If the
  // rail's filter hides it, back to ALL so its marker is there under the card.
  const pickListedPin = (id: string) => {
    const pin = pins.find((p) => p.id === id);
    if (pin && filterPinsByCategories([pin], categories, picked).length === 0) setPicked(new Set());
    openPin(id);
  };

  // The picked categories outlast the 핀 list: closing it keeps the map
  // filtered, and reopening shows what is picked.
  const railAction = (entry: PinRailEntry) => {
    const next = pinRailNext(railMode, entry);
    // Closing 경로 takes its route off the map, and drops a route half made.
    if (next !== 'route') {
      setShownRouteId(null);
      setBuilding(null);
      setEditing(null);
    }
    setRailMode(next);
  };

  // With the 경로 sheet up (and no route being made): a quick tap on bare map
  // closes 경로 altogether; pressing a pin and dragging goes straight into
  // making a route, that pin first, then every pin the finger crosses.
  // Listened for on the document in the capture phase, ahead of the map; the
  // listener stays for all of 경로 so a stroke that started it keeps going
  // after the build layer mounts (that layer only takes strokes it began).
  const buildingRef = useRef(building);
  buildingRef.current = building;
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const shownRouteRef = useRef(shownRouteId);
  shownRouteRef.current = shownRouteId;
  // That stroke's finger, for the build layer's dashed preview line.
  const handoffStroke = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const el = mapEl.current;
    if (!routeMode || !el) return;
    let stroke: { x: number; y: number; at: number; pin: string | null; drawing: boolean; moved: boolean } | null = null;
    const down = (e: PointerEvent) => {
      stroke = null;
      // Making or editing a route: the build layer takes the strokes.
      if (!e.isPrimary || buildingRef.current || editingRef.current || !el.contains(e.target as Node)) return;
      stroke = { x: e.clientX, y: e.clientY, at: performance.now(), pin: pinAt(e.clientX, e.clientY), drawing: false, moved: false };
      if (stroke.pin) mapRef.current?.setPanEnabled(false);
    };
    const move = (e: PointerEvent) => {
      const s = stroke;
      if (!s || !e.isPrimary) return;
      if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) > PRESS.slopPx) {
        s.moved = true;
        if (s.pin) {
          s.drawing = true;
          setShownRouteId(null);
          setActivePinId(null);
          setBuilding([s.pin]);
        }
      }
      if (!s.drawing) return;
      e.preventDefault();
      handoffStroke.current = { x: e.clientX, y: e.clientY };
      const id = pinAt(e.clientX, e.clientY);
      if (id) setBuilding((b) => (b && !b.includes(id) && b.length < COURSE_LIMITS.maxStops ? [...b, id] : b));
    };
    const up = (e: PointerEvent) => {
      const s = stroke;
      stroke = null;
      handoffStroke.current = null;
      if (!s || !e.isPrimary) return;
      if (s.pin) mapRef.current?.setPanEnabled(true);
      if (s.drawing) {
        // The stroke may end on a pin; its click shouldn't open the pin card.
        const swallow = (c: MouseEvent) => {
          c.stopPropagation();
          c.preventDefault();
        };
        document.addEventListener('click', swallow, { capture: true, once: true });
        window.setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 300);
        return;
      }
      // A quick tap on bare map (not a pan, not a long press, not on a marker):
      // with a route on show it just lets go of it (the sheet comes back up);
      // otherwise it closes 경로.
      const onMarker = (e.target as Element | null)?.closest('.map-marker');
      if (!s.moved && !s.pin && !onMarker && performance.now() - s.at < PRESS.longMs && el.contains(e.target as Node)) {
        if (shownRouteRef.current) return setShownRouteId(null);
        setRailMode('menu');
      }
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointermove', move, { capture: true, passive: false });
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', up, true);
    };
  }, [routeMode]);

  // With 핀's category list out, a quick tap on bare map (not a pan, a long
  // press or a marker) closes it back to just 핀 · 경로; the categories
  // picked stay picked. A tap that closes a pin card or place card does only that.
  const pinsListOpen = onPinHome && railMode === 'pins' && !searchOpen;
  const cardOpenRef = useRef(false);
  cardOpenRef.current = !!activePinId || !!preview;
  useEffect(() => {
    const el = mapEl.current;
    if (!pinsListOpen || !el) return;
    let tap: { x: number; y: number; at: number; card: boolean } | null = null;
    const down = (e: PointerEvent) => {
      tap = e.isPrimary && el.contains(e.target as Node) ? { x: e.clientX, y: e.clientY, at: performance.now(), card: cardOpenRef.current } : null;
    };
    const up = (e: PointerEvent) => {
      const t = tap;
      tap = null;
      if (!t || !e.isPrimary || t.card || !el.contains(e.target as Node)) return;
      if ((e.target as Element | null)?.closest('.map-marker')) return;
      if (Math.hypot(e.clientX - t.x, e.clientY - t.y) > PRESS.slopPx || performance.now() - t.at >= PRESS.longMs) return;
      setRailMode('menu');
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointerup', up, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointerup', up, true);
    };
  }, [pinsListOpen]);

  const startBuilding = () => {
    setShownRouteId(null);
    setActivePinId(null);
    setBuilding([]);
  };

  /** Straight into editing a route, from wherever: 경로 opens on it, put on show. */
  const editRouteNow = (c: Course) => {
    setActivePinId(null);
    setBuilding(null);
    setRailMode('route');
    setRouteStep(null);
    setShownRouteId(c.id);
    setEditing({
      id: c.id,
      stops: c.stops,
      note: c.note ?? '',
      folder: folderOf(routeFolders.folders, c.id),
      look: { stopShapes: c.stopShapes, edgeStyles: c.edgeStyles },
    });
  };
  const startEditing = () => {
    if (shownRoute) editRouteNow(shownRoute);
  };

  // 루트 수정's trash asks first, then the route goes (and editing with it).
  const [routeDeleting, setRouteDeleting] = useState<string | null>(null);
  const deleteRoutes = async (cs: Course[]) => {
    if (cs.some((c) => c.id === shownRouteId)) {
      setEditing(null);
      setShownRouteId(null);
    }
    routeFolders.setFolders((f) => cs.reduce((acc, c) => moveRoute(acc, c.id, null), f));
    for (const c of cs) await course.remove(c.id);
  };

  // 핀 삭제 asks first; a pin some route stops at can't go until it's taken out of them.
  const [pinDeleting, setPinDeleting] = useState<Pin | null>(null);
  const routesWithPin = (pin: Pin) => course.courses.filter((c) => c.stops.some((s) => s.place.id === pin.place.id));

  // ✓ on the edit sheet: keep the stops with their look, the description and the folder.
  const saveEdit = async () => {
    if (!editRoute || !shownRoute || editRoute.stops.length < COURSE_LIMITS.minStops) return;
    await course.save({
      ...shownRoute,
      stops: editRoute.stops,
      note: editRoute.note.trim().slice(0, ROUTE_NOTE_MAX) || undefined,
      ...cleanRouteLook(editRoute.look, editRoute.stops.length),
    });
    if (editRoute.folder !== folderOf(routeFolders.folders, shownRoute.id)) {
      const { folder } = editRoute;
      routeFolders.setFolders((f) => moveRoute(f, shownRoute.id, folder));
    }
    setEditing(null);
    // Back to showing it: the map glides over, the pins fade off, the stops drop in again.
    setLandedRoute(null);
    setPinsAway('no');
    setRefit((n) => n + 1);
  };

  const saveBuilt = async (title: string, note: string, folder: string | null) => {
    if (!buildPins || buildPins.length < COURSE_LIMITS.minStops) return;
    const stops = buildPins.map((p) => ({ place: p.place }));
    const look = buildRouteLook(buildPins.map((p) => p.id), buildLook);
    const saved = await course.save({ title, note: note || undefined, theme: 'etc', travelMode: 'walk', stops, ...look });
    // Into the folder picked on the create sheet (none = 미분류).
    if (folder) routeFolders.setFolders((f) => moveRoute(f, saved.id, folder));
    setBuilding(null);
    setShownRouteId(saved.id);
    notify(`${saved.title} 경로를 저장했어요.`);
  };

  // ----- Pins -----

  const savePinAt = (place: PlaceRef, categoryId: string, memo?: string) => {
    const result = pinStore.savePin(place, categoryId, memo);
    if (!result) return notify('핀은 500개까지 저장할 수 있어요.');
    if (categoryId !== UNCATEGORIZED.id) updateSettings((s) => withRecentCategory(s, categoryId));
    notify(result.existed ? `${place.name}의 카테고리를 바꿨어요.` : `${place.name} 핀을 꽂았어요.`, result.undo);
  };

  // ✓ on a new pin's card: pinned with the name, memo and group it shows.
  const confirmNewPin = ({ name, memo, categoryId }: NewPinInput) => {
    if (!preview) return;
    savePinAt({ ...preview, name }, categoryId, memo || undefined);
    setPreview(null);
    setQuery('');
  };
  // Stable, so the card's outside-touch listener isn't re-attached every render.
  const closeNewPin = useCallback(() => setPreview(null), []);

  // 📍 again on the pin screen: a new pin right where the map is looking —
  // the same card a search pick or a long press opens (name, memo, group,
  // ✓ to pin). With a card already up, the press first closes it (a touch
  // outside the card), then opens a fresh one on the map's current centre.
  const startPinning = () => {
    if (sharedCourse) dismissCourse();
    if (sharedPins) dismissPins();
    changeTab('pins');
    // 경로 owns the map's taps while it's open; a new pin closes it.
    if (railMode === 'route') railAction('route');
    const center = mapRef.current?.getCenter();
    if (center) void openNewPinAt(center);
  };

  // ----- Render -----

  const providerLabel =
    mapProvider === 'kakao' ? '카카오' : mapProvider === 'maplibre' ? 'OpenStreetMap (카카오 키 없음)' : '준비 중';
  const pinCounts = useMemo(() => {
    const counts = new Map<string, number>();
    // Pins under a category that's gone count as 미분류, where they show.
    pins.forEach((p) => {
      const id = isUncategorized(categories, p.categoryId) ? UNCATEGORIZED.id : p.categoryId;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    });
    return counts;
  }, [pins, categories]);

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
    return null;
  };

  const calendarZoom = tab === 'calendar';
  const onPage = showsPage(tab, Boolean(sharedCourse || sharedPins || searchOpen || preview));
  // Swiping 달력 left slides the page off and uncovers the map (핀).
  const swipe = usePageSwipe(onPage && !decorating && !studio ? homeSwipeDirection(tab) : 0, () => changeTab('pins'));

  // The tab buttons step aside for a 꾸미기 tool's tray, for the 경로 폴더, and under the 꾸미기 screen.
  const barAway = (decorating && calendarZoom && onPage) || routeMode || !!studio;
  // 공유 before 집 is set (it's required) opens the profile on 개인 정보 instead.
  const needHome = () => {
    setPrivacyNotice('공유하려면 집 주소를 먼저 입력하세요.');
    setProfileOpen(true);
  };

  return (
    <div className={`app ${searchOpen ? 'app--searching' : ''} ${sheetTop ? 'app--sheet-top' : ''} ${onPage ? 'app--page' : ''} ${shownRoute && !editRoute && pinsAway !== 'no' ? 'app--pins-away' : ''} ${shownRoute && !editRoute && (!routeLanded || !pinsGone) ? 'app--route-arriving' : ''} ${editRoute ? 'app--route-editing' : ''}`}>
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

      <button className="corner-btn corner-btn--profile" aria-label="프로필" onClick={() => setProfileOpen(true)}>
        <ProfileAvatar photo={profile.photo} size={52} />
      </button>

      {onPinHome && !searchOpen && (
        <PinRail
          mode={railMode}
          onAction={railAction}
          categories={categories}
          counts={pinCounts}
          picked={picked}
          onToggle={(id) => setPicked((prev) => togglePicked(prev, id))}
          onAll={() => setPicked(new Set())}
          onCategories={() => setCategoriesOpen(true)}
        />
      )}

      {routeTrayShown && onPinHome && (
        <RouteFolderTray
          open={routeOpen}
          lowered={!!shownRoute}
          courses={course.courses}
          folders={routeFolders.folders}
          onFolders={routeFolders.setFolders}
          shownId={shownRoute?.id ?? null}
          onShow={(c) => {
            setRouteStep(null); // picked from the list: the name just appears
            setShownRouteId(c?.id ?? null);
          }}
          tab={routeTab}
          onTab={setRouteTab}
          onNewRoute={startBuilding}
          onDeleteRoutes={deleteRoutes}
        />
      )}

      {/* Lines between the numbered stops of whatever route is on the map. */}
      {shownStops.length > 1 && (
        <StopLines
          count={shownStops.length}
          edgeStyles={buildPins ? buildRouteLook(buildPins.map((p) => p.id), buildLook).edgeStyles : editRoute ? editRoute.look.edgeStyles : shownRoute?.edgeStyles}
          stopShapes={buildPins ? buildRouteLook(buildPins.map((p) => p.id), buildLook).stopShapes : editRoute ? editRoute.look.stopShapes : shownRoute?.stopShapes}
          // A route on show names its stops, as a calendar day names its pings.
          names={shownRoute && !buildPins && !editRoute ? shownRoute.stops.map((s) => s.place.name) : undefined}
          // A route put on show plays in once the map has glided over to it and the pins have gone
          // (until then app--route-arriving keeps its stops out of sight).
          play={
            shownRoute && !buildPins && !editRoute
              ? routeLanded
                ? // Straight after another route the pins are already gone: no fade to wait for.
                  { key: shownRoute.id, delayMs: pinsGone ? 0 : PINS_FADE_MS }
                : // Held back, every stop hidden, until the glide ends.
                  { key: `${shownRoute.id}:gliding`, delayMs: Infinity }
              : undefined
          }
        />
      )}

      {/* The route on show, named at the top of the map like a calendar day's TODAY. */}
      {shownRoute && !buildPins && (
        <RouteTitle
          routeId={shownRoute.id}
          title={shownRoute.title}
          onRename={(title) => course.save({ ...shownRoute, title })}
          slideFrom={routeStep?.id === shownRoute.id ? routeStep.from : 0}
          note={shownRoute.note}
          editMode={!!editRoute}
          // Each arrow puts the neighbour on show the usual way, so the map
          // glides over and its stops drop in afresh.
          onStep={
            neighborRoute(course.courses, routeFolders.folders, routeTab, shownRoute.id, 1)
              ? (step) => {
                  const next = neighborRoute(course.courses, routeFolders.folders, routeTab, shownRoute.id, step);
                  if (!next) return;
                  setRouteStep({ id: next.id, from: step });
                  setShownRouteId(next.id);
                }
              : undefined
          }
        />
      )}

      {/* 공유 for the route on show: makes its card and opens the 꾸미기 screen on it. */}
      {shownRoute && !buildPins && !editRoute && routeTrayShown && onPinHome && (
        <ShareTagButton
          light
          className="share-tag--edit"
          label="루트 수정"
          icon={<Pencil size={18} strokeWidth={2.2} />}
          onClick={startEditing}
        />
      )}
      {shownRoute && !buildPins && !editRoute && routeTrayShown && onPinHome && (
        <ShareTagButton
          className="share-tag--route"
          label={`${shownRoute.title} 공유`}
          onClick={() => {
            if (!hasHome(privacy.excluded)) return needHome();
            setStudio(routeSubject(shownRoute, privacy.excluded));
          }}
        />
      )}

      {/* A saved route on the map: long-press its stops or lines to restyle it (kept with the route). */}
      {shownRoute && !buildPins && !editRoute && (
        <RouteStyleLayer
          mapEl={mapEl.current}
          stopCount={shownRoute.stops.length}
          stopShapes={shownRoute.stopShapes}
          edgeStyles={shownRoute.edgeStyles}
          onStopShape={(i, shape) => course.save({ ...shownRoute, ...withStopShape(shownRoute, shownRoute.stops.length, i, shape) })}
          onEdgeStyle={(i, style) => course.save({ ...shownRoute, ...withEdgeStyle(shownRoute, shownRoute.stops.length, i, style) })}
        />
      )}

      {buildPins && building && (
        <RouteBuildLayer
          mapEl={mapEl.current}
          chosen={building}
          onAdd={(id) =>
            setBuilding((b) => (b && !b.includes(id) && b.length < COURSE_LIMITS.maxStops ? [...b, id] : b))
          }
          onCancel={() => setBuilding(null)}
          onPanEnabled={(on) => mapRef.current?.setPanEnabled(on)}
          handoff={handoffStroke}
          defaultTitle={nextRouteName(course.courses.map((c) => c.title))}
          onCreate={saveBuilt}
          folders={routeFolders.folders.folders}
        />
      )}
      {buildPins && building && (
        // Long-press a stop or a line of the route being made to restyle it.
        <RouteStyleLayer
          mapEl={mapEl.current}
          stopCount={buildPins.length}
          stopShapes={buildRouteLook(buildPins.map((p) => p.id), buildLook).stopShapes}
          edgeStyles={buildRouteLook(buildPins.map((p) => p.id), buildLook).edgeStyles}
          onStopShape={(i, shape) => setBuildLook((l) => withBuildShape(l, buildPins.map((p) => p.id), i, shape))}
          onEdgeStyle={(i, style) => setBuildLook((l) => withBuildEdge(l, buildPins.map((p) => p.id), i, style))}
        />
      )}

      {/* Editing the route on show: stops picked on the map as when making one; the sheet has the rest. */}
      {editRoute && (
        <>
          <RouteBuildLayer
            editing
            mapEl={mapEl.current}
            chosen={editRoute.stops.map((s) => s.place.id)}
            onAdd={(id) => {
              const pin = pins.find((p) => p.id === id);
              if (pin) editStops((stops) => addEditStop(stops, pin.place));
            }}
            // A tap on bare map finishes the edit, as ✓ does (not while it's too short to keep).
            onCancel={() => void saveEdit()}
            onPanEnabled={(on) => mapRef.current?.setPanEnabled(on)}
            defaultTitle=""
            onCreate={() => {}}
          />
          {/* Long-press a stop or a line to restyle it, as when it's on show. */}
          <RouteStyleLayer
            mapEl={mapEl.current}
            stopCount={editRoute.stops.length}
            stopShapes={editRoute.look.stopShapes}
            edgeStyles={editRoute.look.edgeStyles}
            onStopShape={(i, shape) => setEditing((e) => (e ? { ...e, look: withStopShape(e.look, e.stops.length, i, shape) } : e))}
            onEdgeStyle={(i, style) => setEditing((e) => (e ? { ...e, look: withEdgeStyle(e.look, e.stops.length, i, style) } : e))}
          />
          <RouteEditTray
            stops={editRoute.stops}
            note={editRoute.note}
            onNote={(note) => setEditing((e) => (e ? { ...e, note } : e))}
            onMove={(from, to) => editStops((stops) => moveStop(stops, from, to))}
            onRemove={(index) => editStops((stops) => stops.filter((_, i) => i !== index))}
            folders={routeFolders.folders.folders}
            folder={editRoute.folder}
            onFolder={(folder) => setEditing((e) => (e ? { ...e, folder } : e))}
            onDone={saveEdit}
            onDelete={() => setRouteDeleting(editRoute.id)}
          />
        </>
      )}

      {preview && !searchOpen && (
        <NewPinCard
          key={preview.id}
          place={preview}
          categories={categories}
          onSave={confirmNewPin}
          onClose={closeNewPin}
        />
      )}

      {activePin && !preview && !searchOpen && onPinHome && (
        <PinCard
          pin={activePin}
          categories={categories}
          onRecategorize={(id) => {
            pinStore.updatePin(activePin.id, { categoryId: id });
            updateSettings((s) => withRecentCategory(s, id));
          }}
          onRename={(name) => pinStore.updatePin(activePin.id, { place: { ...activePin.place, name } })}
          onMemo={(memo) => pinStore.updatePin(activePin.id, { memo: memo || undefined })}
          onDelete={() => setPinDeleting(activePin)}
          onClose={closePinCard}
        />
      )}

      {onPage ? (
        <section className="page" aria-label={PAGE_TITLES[tab]} style={swipe.style} {...swipe.handlers}>
          {calendarZoom && <DayPattern pattern={dayPattern} />}
          <header className="page__head">
            {/* The calendar's own TODAY / DAY n heading takes the stage. */}
            <h1 className={calendarZoom ? 'sr-only' : ''}>{PAGE_TITLES[tab]}</h1>
            <button className="icon-btn page__profile" aria-label="프로필" onClick={() => setProfileOpen(true)}>
              <ProfileAvatar photo={profile.photo} size={40} />
            </button>
          </header>
          {calendarZoom ? (
            <CalendarZoom
              command={calendarCommand}
              excluded={privacy.excluded}
              onNeedHome={needHome}
              onShare={setStudio}
              onDecorating={setDecorating}
              onDayTheme={setDayTheme}
              onDayPattern={setDayPattern}
              onMode={setCalendarMode}
            />
          ) : (
            renderSheet()
          )}
        </section>
      ) : onPinHome ? null : (
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

      <div ref={barEl} className={`bottom-bar-wrap ${barAway ? 'is-away' : ''}`} inert={barAway}>
        <BottomBar
          tab={swipe.leaving ? 'pins' : tab}
          pinning={!!preview}
          onTab={changeTab}
          onPin={startPinning}
          onCalendarAgain={() => sendCalendar(calendarAgain(calendarMode))}
          calendarIcon={tab === 'calendar' && calendarZoom && calendarMode === 'day' ? 'month' : 'today'}
        />
      </div>

      {routeDeleting && course.courses.some((c) => c.id === routeDeleting) && (
        <ConfirmDialog
          label="루트 삭제"
          message={`'${course.courses.find((c) => c.id === routeDeleting)?.title || '이름 없는 경로'}' 루트를 삭제합니다.`}
          detail="삭제한 루트는 복구할 수 없어요."
          onConfirm={() => void deleteRoutes(course.courses.filter((c) => c.id === routeDeleting))}
          onClose={() => setRouteDeleting(null)}
        />
      )}

      {pinDeleting &&
        (routesWithPin(pinDeleting).length > 0 ? (
          <ConfirmDialog
            label="장소 삭제 불가"
            message="이 장소는 루트에 들어 있는 장소예요."
            detail={
              <>
                소속 루트:{' '}
                {routesWithPin(pinDeleting).map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && '  '}
                    <b className="confirm-dialog__em">'{c.title}'</b>
                  </span>
                ))}
                {'\n'}먼저 해당하는 루트에서 장소를 제거해 주세요.
              </>
            }
            confirmLabel="루트 편집"
            tone="action"
            // The first route named: straight into editing it.
            onConfirm={() => editRouteNow(routesWithPin(pinDeleting)[0])}
            onClose={() => setPinDeleting(null)}
          />
        ) : (
          <ConfirmDialog
            label="장소 삭제"
            message={`'${pinDeleting.place.name}' 장소를 삭제합니다.`}
            detail="삭제한 장소는 복구할 수 없어요."
            onConfirm={() => {
              pinStore.removePin(pinDeleting.id);
              if (activePinId === pinDeleting.id) setActivePinId(null);
            }}
            onClose={() => setPinDeleting(null)}
          />
        ))}

      {studio && <ShareStudio key={studio.key} subject={studio} onTheme={setStudioTheme} onClose={() => setStudio(null)} />}

      {profileOpen && (
        <ProfileSheet
          profile={profile}
          onChange={changeProfile}
          privacy={{
            places: privacy.excluded,
            resolving: privacy.resolving,
            onAddress: privacy.setAddress,
            onName: privacy.setName,
            onAdd: privacy.add,
            onRemove: privacy.remove,
          }}
          privacyNotice={hasHome(privacy.excluded) ? null : privacyNotice}
          onClose={() => {
            setProfileOpen(false);
            setPrivacyNotice(null);
          }}
        />
      )}
      {categoriesOpen && (
        <CategorySheet
          onClose={() => setCategoriesOpen(false)}
          categories={categories}
          pins={pins}
          pinCounts={pinCounts}
          onCreate={pinStore.createCategory}
          onEdit={pinStore.editCategory}
          onMove={pinStore.reorderCategory}
          onDrop={pinStore.dropCategory}
          onDelete={pinStore.deleteCategory}
          onPickPin={pickListedPin}
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
