import { ChevronLeft, MapPin, Pencil, Share } from 'lucide-react';
import type { PatternId, ThemeId } from './domain/decor';
import DayPattern from './components/DayPattern';
import ShareStudio from './components/ShareStudio';
import { analytics, type PinSource, type ShareKind } from './services/analytics';
import ConfirmDialog from './components/ConfirmDialog';
import { routeSubject, type ShareSubject } from './domain/shareSubject';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { useBackButton } from './hooks/useBackButton';
import { closeTopDialog } from './lib/native';
import BottomBar from './components/BottomBar';
import SettingsScreen from './components/SettingsScreen';
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
import SharedRouteDialog from './components/SharedRouteDialog';
import { visibleRange } from './domain/adminAreas';
import { calendarAgain, pageSwipes, PAGE_TITLES, showsPage, tabForIncoming, type AppTab } from './domain/appTabs';
import { COURSE_LIMITS } from './domain/course';
import type { MapViewport } from './domain/districtMap';
import { filterPinsByCategories, isUncategorized, pinStyle, UNCATEGORIZED } from './domain/pin';
import { placeKindService } from './services/placeKindService';
import { pinRailNext, tapAll, togglePicked, type PinRailEntry, type PinRailMode } from './domain/pinRail';
import { pingsForDate, PRESS } from './domain/dayPings';
import { buildRouteLook, EMPTY_BUILD_LOOK, nextRouteName, ROUTE_NOTE_MAX, toggleBuildStop, withBuildEdge, withBuildShape, type BuildLook } from './domain/routeBuild';
import { addEditStop, moveStop, toggleEditStop, withEditStops, type RouteEdit } from './domain/routeEdit';
import { cleanRouteLook, withEdgeStyle, withStopShape } from './domain/routeStyle';
import { folderOf, moveRoute, neighborRoute, type RouteTab } from './domain/routeFolders';
import { useCourses } from './hooks/useCourses';
import { useAreaMap } from './hooks/useAreaMap';
import { useIncomingCourse } from './hooks/useIncomingCourse';
import { useMyLocation } from './hooks/useMyLocation';
import { removePingsOfPin } from './services/pingRepository';
import { useAccount } from './hooks/useAccount';
import { getDisplayName } from './lib/currentUser';
import { copyToClipboard } from './lib/clipboard';
import { useGroups } from './hooks/useGroups';
import { groupsNeedLogin, inviteUrl } from './services/groupService';
import { focusPoints, groupPingKey, groupPingKeys, memberColor, myGroupPings, newMemberPings, newPingCount, type GroupMember } from './domain/groups';
import WeNowPage from './components/WeNowPage';
import { loadGroupSeen, loadMemberSeen, memberSeenKey, saveGroupSeen, saveMemberSeen, type GroupSeen, type MemberSeen } from './services/groupSeenRepository';
import { useStoredPings } from './hooks/useStoredPings';
import { dateKey } from './domain/diary';
import GroupMapView from './components/GroupMapView';
import GroupFormDialog from './components/GroupFormDialog';
import GroupSettingsDialog from './components/GroupSettingsDialog';
import GroupLines, { type GroupLine } from './components/GroupLines';
import { shareLinkService } from './services/shareLinkService';
import { planShare } from './services/shareTargets';
import { usePageSwipe } from './hooks/usePageSwipe';
import { usePins } from './hooks/usePins';
import { useRouteFolders } from './hooks/useRouteFolders';
import { usePlaceSearch } from './hooks/usePlaceSearch';
import { useSettings } from './hooks/useSettings';
import { SEOUL_CENTER, type CourseMap, type MapPadding, type PinMarker } from './map/courseMap';
import { createMapStack } from './map/createCourseMap';
import { haversineMeters as distanceMeters } from './domain/geo';
import { pointPlace, type PlaceSearchService } from './services/placeSearch/placeSearchService';
import { withRecentCategory } from './services/settingsRepository';
import { loadProfile, saveProfile, type Profile } from './services/profileRepository';
import { usePrivacy } from './hooks/usePrivacy';
import { hasHome } from './domain/privacy';
import type { CourseStop, PlaceRef, Course, SharedCourse } from './types/course';
import type { Pin } from './types/pin';

type Toast = { text: string; undo?: () => void };

const DESKTOP_QUERY = '(min-width: 900px)';
// Dragging the map: how often the crosshair's place name is looked up while
// it moves, and how far it must have moved to be worth asking again.
const AIM_LOOKUP_MS = 300;
const AIM_MIN_MOVE_M = 8;
/** Shown on a shared route's popup until share counts are tracked somewhere. */

/** Matches `tray-down` in styles.css: the 경로 폴더 sheet stays mounted while it slides away. */
const ROUTE_TRAY_OUT_MS = 170;
/** How much of the folder sheet stays up while a route is on show (matches .route-folders.is-lowered). */
/** The top of a group's map held by ‹, the name and ⚙: a ping's card is centred below it. */
const GROUP_TITLE_PX = 120;
const FOLDER_LOWERED_PX = 324;
/** Once the map has glided over to a route, the pins fade off (matches .app--pins-away), and only then do its stops drop in. */
const PINS_FADE_MS = 250;
/** A route stepped to with < > glides over as fast as its name slides in (RouteTitle SLIDE_MS). */
const STEP_GLIDE_MS = 260;


export default function App() {
  const mapEl = useRef<HTMLDivElement | null>(null);
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
  // 공유 funnel: which card the 꾸미기 screen is on, and whether anything left it.
  const studioFunnel = useRef<{ kind: ShareKind; completed: boolean }>({ kind: 'route', completed: false });
  const openStudio = (kind: ShareKind) => {
    studioFunnel.current = { kind, completed: false };
    analytics.track('share_studio_opened', { kind });
  };
  // The route behind the 꾸미기 screen, when it's a route's card: its link is what 링크 복사 copies.
  const [studioCourse, setStudioCourse] = useState<Course | null>(null);
  const [studioTheme, setStudioTheme] = useState<ThemeId>('default');
  const dayTheme = studio ? studioTheme : calendarTheme;
  useEffect(() => {
    const root = document.documentElement;
    if (dayTheme === 'default') delete root.dataset.theme;
    else root.dataset.theme = dayTheme;
  }, [dayTheme]);
  const pinStore = usePins();
  const routeFolders = useRouteFolders();
  const { pins, categories } = pinStore;
  const course = useCourses();
  const { incoming: incomingCourse, dismiss: dismissCourse } = useIncomingCourse();

  const [tab, setTab] = useState<AppTab>('pins');
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profile, setProfile] = useState(loadProfile);
  // 로그인: the account's profile replaces this one on sign-in, and changes go up after.
  const account = useAccount(profile, (next) => {
    setProfile(next);
    saveProfile(next);
  });
  const changeProfile = (next: Profile) => {
    setProfile(next);
    account.push(next);
    return saveProfile(next);
  };
  // 디스플레이 및 언어 → 디스플레이: 기본 or 다크 on <html data-scheme>; not picked, the phone's setting decides.
  const scheme = profile.scheme;
  useEffect(() => {
    const root = document.documentElement;
    if (scheme) root.dataset.scheme = scheme;
    else delete root.dataset.scheme;
    // Phone browsers tint their own bars (and the strip under the page at the
    // bottom edge) from theme-color; left alone it keeps the default theme's
    // (and the phone's light/dark) colour, a pale band under a themed or dark page.
    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    metas.forEach((m) => {
      m.dataset.base ??= m.content;
      const token = dayTheme !== 'default' ? '--surface' : scheme ? '--bg' : null;
      m.content = token ? getComputedStyle(root).getPropertyValue(token).trim() : m.dataset.base;
    });
    // The map painted its areas from the old tokens.
    mapRef.current?.refreshColors();
  }, [dayTheme, scheme]);
  // 공유 before 집 is set opens the profile on 개인 정보 with this line.
  const [privacyNotice, setPrivacyNotice] = useState<string | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<PlaceRef | null>(null);
  // 핀 꽂기 funnel: where the new pin's card came from, and whether it was pinned.
  // A card that goes any other way (outside tap, Esc, another tab, a new search) counts as dismissed.
  const pinSource = useRef<PinSource>('search');
  const pinFunnel = useRef<{ id: string; source: PinSource; saved: boolean } | null>(null);
  useEffect(() => {
    const was = pinFunnel.current;
    // A reverse-geocoded name keeps the id: still the same card.
    if (was?.id === preview?.id) return;
    if (was && !was.saved) analytics.track('pin_card_dismissed', { source: was.source });
    pinFunnel.current = preview ? { id: preview.id, source: pinSource.current, saved: false } : null;
    if (preview) analytics.track('pin_card_opened', { source: pinSource.current });
  }, [preview?.id]);

  // The calendar page reports its zoom level (day or month); nothing reads it now.
  const [calendarMode, setCalendarMode] = useState<'day' | 'month'>('day');
  // A 꾸미기 tool is out on the calendar: the tab buttons step aside for its tray.
  const [decorating, setDecorating] = useState(false);
  // TODAY / DAY n: a picked ping turns the calendar button into ✕ (tap it, or
  // drop the ping on it, to delete the ping); hot while a ping is dragged over it.
  const [pingRemove, setPingRemove] = useState<(() => void) | null>(null);
  const [pingDropHot, setPingDropHot] = useState(false);
  // Commands for the calendar page (there's no calendar button to send them now).
  const [calendarCommand, setCalendarCommand] = useState<CalendarCommand | null>(null);
  // The calendar hands up how to share the day on screen (its 공유 sits in the bottom row).
  const shareDay = useRef<(() => void) | null>(null);
  const [activePinId, setActivePinId] = useState<string | null>(null);
  // The round buttons under ⚙, and the categories picked in its 핀 list.
  const [railMode, setRailMode] = useState<PinRailMode>('menu');
  // 조준: a crosshair in the middle of the map (with the name of the place
  // under it) and only the pin button, to aim where a new pin goes.
  // The crosshair and the place under it, up while the map is dragged.
  const [panAim, setPanAim] = useState(false);
  const [aimName, setAimName] = useState<string | null>(null);
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
  // 루트 만들기 funnel: started (from + or a drag off a pin) → 2 stops (the create
  // sheet is up) → created, or cancelled with however many stops it got to.
  const buildMethod = useRef<'plus' | 'drag'>('plus');
  const buildFunnel = useRef<{ most: number; ready: boolean; saved: boolean } | null>(null);
  useEffect(() => {
    const f = buildFunnel.current;
    if (!building) {
      if (f && !f.saved) analytics.track('route_build_cancelled', { stops: f.most });
      buildFunnel.current = null;
      return;
    }
    if (!f) {
      buildFunnel.current = { most: building.length, ready: false, saved: false };
      analytics.track('route_build_started', { method: buildMethod.current });
    }
    const g = buildFunnel.current!;
    g.most = Math.max(g.most, building.length);
    if (!g.ready && building.length >= COURSE_LIMITS.minStops) {
      g.ready = true;
      analytics.track('route_build_ready', { stops: building.length });
    }
  }, [building]);
  // Editing the route on show (the pen by its name): its stops, look, icon and description as they stand.
  const [editing, setEditing] = useState<RouteEdit | null>(null);
  const editStops = (change: (stops: CourseStop[]) => CourseStop[]) =>
    setEditing((e) => (e ? withEditStops(e, change(e.stops)) : e));
  // Bumped to send the map back over to the route on show (after editing it).
  const [refit, setRefit] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // ALL tapped while on: every pin hidden until ALL (or a category) is tapped again.
  const [pinsHidden, setPinsHidden] = useState(false);

  const sharedCourse = incomingCourse.status === 'ready' ? incomingCourse.course : null;
  const incomingMeta = incomingCourse.status === 'ready' ? incomingCourse.meta : undefined;
  const activePin = pins.find((p) => p.id === activePinId) ?? null;
  // We Now: the groups (signed in), and the one opened from its grid — the map shows for it.
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  // Test build: We Now's TODAY tile opens TODAY itself, full screen, without the bottom row.
  const [todayOpen, setTodayOpen] = useState(false);
  const storedPings = useStoredPings();
  const todayPings = useMemo(() => pingsForDate(dateKey(), storedPings), [storedPings]);
  const [groupPicked, setGroupPicked] = useState<string | null>(null);
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
  const [groupLeaving, setGroupLeaving] = useState(false);
  const [groupDeleting, setGroupDeleting] = useState(false);
  // We Now needs no Kakao (unless VITE_GROUPS_NEED_LOGIN): with no one signed in, a guest account is made for this device.
  const needLogin = groupsNeedLogin();
  const [guest, setGuest] = useState<'idle' | 'trying' | 'done' | 'failed'>('idle');
  const startGuest = useCallback(() => {
    setGuest('trying');
    void account.signInAsGuest().then((ok) => setGuest(ok ? 'done' : 'failed'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.signInAsGuest]);
  const groups = useGroups(account.user, tab === 'people', {
    onJoined: (id) => {
      changeTab('people');
      setOpenGroupId(id);
      notify('그룹에 들어왔어요.');
    },
    // An invite opened with no one signed in: as a guest, then it's joined.
    onNeedLogin: () => {
      if (!needLogin) return startGuest();
      notify('그룹에 들어가려면 먼저 로그인하세요.');
      setProfileOpen(true);
    },
    onJoinFailed: () => notify('그룹 초대 링크를 열 수 없어요.'),
  });
  // My own place in each group wears this phone's photo, nickname and today's
  // pings (the server's copy lags behind: a ping taken out of TODAY would
  // linger there until the next push and the next read).
  const myId = account.user?.id ?? null;
  const myPings = useMemo(() => myGroupPings(storedPings, dateKey()), [storedPings]);
  const groupList = useMemo(
    () =>
      groups.groups.map((g) => ({
        ...g,
        members: g.members.map((m) =>
          m.userId === myId ? { ...m, photo: profile.photo ?? m.photo, nickname: m.alias ?? (getDisplayName().trim() || m.nickname), pings: myPings } : m,
        ),
      })),
    [groups.groups, myId, profile.photo, myPings],
  );
  // Back from TODAY to the group list: read the groups again rather than wait
  // for the minute's refresh (the others' pings may have moved on meanwhile).
  const wasTodayOpen = useRef(todayOpen);
  useEffect(() => {
    if (wasTodayOpen.current && !todayOpen && tab === 'people') groups.refresh();
    wasTodayOpen.current = todayOpen;
  }, [todayOpen]);
  const [kicking, setKicking] = useState<GroupMember | null>(null);
  const openGroup = tab === 'people' && openGroupId ? (groupList.find((g) => g.id === openGroupId) ?? null) : null;
  // A group I've left (or that's gone) closes; a member who left can't stay picked.
  useEffect(() => {
    if (openGroupId && groups.status === 'ready' && !groups.groups.some((g) => g.id === openGroupId)) setOpenGroupId(null);
  }, [openGroupId, groups.status, groups.groups]);
  useEffect(() => {
    if (tab !== 'people') {
      setOpenGroupId(null);
      setTodayOpen(false);
    }
  }, [tab]);
  useEffect(() => setGroupPicked(null), [openGroupId]);
  // The ping tapped on a group's map (its card is open over it); it goes with its member's focus.
  const [groupPing, setGroupPing] = useState<{ member: string; seq: number } | null>(null);
  useEffect(() => {
    if (groupPing && groupPing.member !== groupPicked) setGroupPing(null);
  }, [groupPicked, groupPing]);
  // Read by the map's tap listener, which is set up once per open group.
  const groupPingNow = useRef(groupPing);
  groupPingNow.current = groupPing;
  // A group's 새 핑 badge: pings that weren't on its map when I last had it
  // open. Whatever is on the open group's map counts as seen, new arrivals too.
  const [groupSeen, setGroupSeen] = useState<GroupSeen>(loadGroupSeen);
  const openGroupKeys = openGroup ? groupPingKeys(openGroup).join(',') : null;
  useEffect(() => {
    if (!openGroup) return;
    setGroupSeen((seen) => {
      const next = { ...seen, [openGroup.id]: groupPingKeys(openGroup) };
      saveGroupSeen(next);
      return next;
    });
  }, [openGroup?.id, openGroupKeys]);
  // Each face's badge on a group's map: that member's pings since I last had
  // them picked. Picking someone sees all of theirs, and so do new ones while picked.
  const [memberSeen, setMemberSeen] = useState<MemberSeen>(loadMemberSeen);
  const pickedMember = openGroup && groupPicked ? (openGroup.members.find((m) => m.userId === groupPicked) ?? null) : null;
  const pickedKeys = pickedMember ? pickedMember.pings.map((p) => groupPingKey(pickedMember, p)).join(',') : null;
  useEffect(() => {
    if (!openGroup || !pickedMember) return;
    setMemberSeen((seen) => {
      const next = { ...seen, [memberSeenKey(openGroup.id, pickedMember.userId)]: pickedMember.pings.map((p) => groupPingKey(pickedMember, p)) };
      saveMemberSeen(next);
      return next;
    });
  }, [openGroup?.id, pickedMember?.userId, pickedKeys]);
  useEffect(() => {
    if (!needLogin && tab === 'people' && account.available && !account.user && guest === 'idle') startGuest();
  }, [needLogin, tab, account.available, account.user, guest, startGuest]);
  const onPage = showsPage(tab, Boolean(searchOpen || preview || openGroup));
  // Swiping a page sideways slides it off toward another screen: 달력 ← 핀,
  // → We Now; We Now ← 달력, → 핀 (pageSwipes).
  const swipeTo = onPage && !decorating && !studio && !todayOpen ? pageSwipes(tab) : { left: null, right: null };
  const swipe = usePageSwipe(
    swipeTo.left ? () => changeTab(swipeTo.left!) : null,
    swipeTo.right ? () => changeTab(swipeTo.right!) : null,
  );
  // While the page is swiped off, the map screen under it stays whole.
  const pageMoving = swipe.moving;
  // The screen the moving page is heading for (the bottom row turns to it meanwhile).
  const swipeTarget = swipe.heading ? (swipe.heading < 0 ? swipeTo.left : swipeTo.right) : null;
  const onPinHome = tab === 'pins';
  // The map's own things (pins, rail, row) show on the map, and under a page sliding off to it.
  const mapUi = onPinHome || (pageMoving && swipeTarget === 'pins');
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
  // route's own stops drop in. Stepping to another route (< >) keeps the
  // pins hidden until the route view is closed.
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
    if (pinsGone || !routeLanded) return;
    setPinsAway('fading');
    const fade = window.setTimeout(() => setPinsAway('gone'), PINS_FADE_MS);
    return () => window.clearTimeout(fade);
  }, [shownRouteKey, routeLanded, pinsGone]);
  const shownPins = useMemo(() => (pinsHidden ? [] : filterPinsByCategories(pins, categories, picked)), [pins, categories, picked, pinsHidden]);

  // Numbered course markers + solid route line.
  const shownStops = useMemo(() => {
    if (buildPins) return buildPins.map((p) => p.place);
    if (editRoute) return editRoute.stops.map((s) => s.place);
    if (shownRoute) return shownRoute.stops.map((s) => s.place);
    return [];
  }, [buildPins, editRoute, shownRoute]);

  // Only whether a route is being edited changes the markers, not each edit
  // (re-making them would drop every pin in again).
  const isEditing = !!editRoute;
  // Pin markers: a received set as its sender styled it, or my pins on the home tab.
  const pinMarkers = useMemo<PinMarker[]>(() => {
    if (!mapUi) return [];
    // A saved route on show has the map to itself: every pin steps aside
    // (its stops, shaped or numbered, stand in for the places).
    // Editing it, they come back to be picked.
    if (shownRoute && !isEditing && pinsGone) return [];
    return shownPins.map((pin) => {
      const style = pinStyle(categories, pin.categoryId, pin.place);
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
  }, [mapUi, shownPins, categories, activePinId, shownRoute, isEditing, pinsGone]);

  const search = usePlaceSearch(searchService, query, () => mapRef.current?.getCenter());
  // 제외 주소 are located with the same place search (search failing just leaves the address text to match).
  const privacy = usePrivacy(async (address) => (await searchService?.search(address))?.[0]?.center ?? null);
  // 제외 주소 설정 as the profile and 설정 both show it.
  const privacyProps = {
    places: privacy.excluded,
    resolving: privacy.resolving,
    onAddress: privacy.setAddress,
    onName: privacy.setName,
    onAdd: privacy.add,
    onRemove: privacy.remove,
  };

  // The trays and the bottom bar cover part of the map; fit and focus around them.
  const mapPadding = useCallback((extraBottom = 0): MapPadding => {
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
    return {
      top: 90,
      right: 40,
      bottom: desktop ? 40 + extraBottom : cap(barHeight) + 30 + extraBottom,
      left: 40,
    };
  }, []);

  const mapEvents = useRef({
    stop: (_i: number) => {},
    pin: (_id: string) => {},
    longPress: (_c: [number, number]) => {},
    move: (_c: [number, number]) => {},
  });

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
      onMove: (center) => mapEvents.current.move(center),
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
  // The same uncovered part keeps the area names clear of the bars and buttons.
  const areaView = useMemo(() => {
    const el = mapEl.current;
    if (!viewport || !el) return null;
    const cover = mapPadding();
    // On desktop the padding leaves the bottom bar out (nothing is fitted
    // under it); a name there would still be hidden.
    const bar = barEl.current?.getBoundingClientRect();
    const underBar = bar && bar.height > 0 ? el.getBoundingClientRect().bottom - bar.top + 8 : 0;
    return {
      range: visibleRange(viewport.bounds, { width: el.clientWidth, height: el.clientHeight }, cover),
      cover: { ...cover, bottom: Math.max(cover.bottom, underBar) },
    };
  }, [viewport, mapPadding]);
  const areaMap = useAreaMap(viewport, areaView?.range, areaView?.cover);
  useEffect(() => {
    mapRef.current?.setAreaMap(areaMap);
  }, [areaMap, mapProvider]);
  // A route on show: the 동 tint steps back with the area names (.app--pins-away).
  const areaTint = !(shownRoute && !editRoute && pinsAway !== 'no');
  useEffect(() => {
    mapRef.current?.setAreaTint(areaTint);
  }, [areaTint, mapProvider]);
  // 내 위치: a dot on the map, and the first fix after opening centers the
  // map there. TODAY offers the pins within 50m of it (CalendarZoom).
  const me = useMyLocation();
  const centeredOnMe = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    map?.setMyLocation(me?.center ?? null);
    if (!map || !me || centeredOnMe.current) return;
    centeredOnMe.current = true;
    // Not over something already on screen (a received route, a search result).
    // No padding: the pin button pins at the map's true center, so pressing it
    // right away lands on the dot.
    if (!shownRoute && !preview) map.focus(me.center);
  }, [me, mapProvider]);

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

  // An open group: every member's pings (their latest as their face), the
  // picked member's over the rest, everyone else stepping back.
  const groupMarks = useMemo(() => {
    if (!openGroup) return [];
    return openGroup.members.flatMap((m) =>
      m.pings.map((p, i) => ({
        member: m.userId,
        seq: i,
        center: p.center,
        color: memberColor(m.slot),
        face: i === m.pings.length - 1 ? { photo: m.photo } : undefined,
        faded: !!groupPicked && groupPicked !== m.userId,
        // The picked member's places by name; nobody's while ALL.
        label: groupPicked === m.userId ? p.name : undefined,
        card:
          groupPing?.member === m.userId && groupPing.seq === i
            ? { name: p.name || '이름 없는 곳', who: m.nickname, photo: p.photo ?? null }
            : undefined,
      })),
    );
  }, [openGroup, groupPicked, groupPing]);
  const groupLines = useMemo<GroupLine[]>(
    () =>
      (openGroup?.members ?? [])
        .filter((m) => m.pings.length > 1)
        .map((m) => ({ member: m.userId, color: memberColor(m.slot), count: m.pings.length, faded: !!groupPicked && groupPicked !== m.userId })),
    [openGroup, groupPicked],
  );
  useEffect(() => {
    mapRef.current?.setGroupPings(groupMarks);
  }, [groupMarks, mapProvider]);
  // Opening a group fits all of it; picking someone brings the map in close on their day.
  const groupFitted = useRef<{ group: string; picked: string | null } | null>(null);
  const groupFitKey = openGroup ? `${openGroup.id}|${groupPicked ?? ''}|${focusPoints(openGroup, groupPicked).length}|${groupPing ? `${groupPing.member}:${groupPing.seq}` : ''}` : '';
  useEffect(() => {
    if (!openGroup || !mapRef.current) return;
    const points = focusPoints(openGroup, groupPicked);
    if (points.length === 0) return;
    const el = mapEl.current;
    const width = el?.clientWidth ?? window.innerWidth;
    // Under the title, over the member row along the bottom (and the picked
    // member's pass over it), clear of the < > at the sides.
    const side = width < 520 ? 76 : 96;
    const padding = { top: 150, right: side, bottom: groupPicked ? 270 : 130, left: side };
    // Like a route: the first move onto someone (from ALL, or opening the
    // group) glides at the usual pace; going on from one member to the next
    // is as quick as stepping between routes with < >.
    const last = groupFitted.current;
    const memberToMember = !!last && last.group === openGroup.id && !!last.picked && !!groupPicked;
    groupFitted.current = { group: openGroup.id, picked: groupPicked };
    const id = requestAnimationFrame(() => {
      // A tapped ping: it and its card together in the middle of the room
      // between the title and the member's pass (from the card's top down to
      // the ping, measured off the marker), not the member's whole day.
      const ping = groupPing && openGroup.members.find((m) => m.userId === groupPing.member)?.pings[groupPing.seq];
      const marker = ping && document.querySelector<HTMLElement>('.group-ping.has-card');
      const card = marker?.querySelector('.group-card');
      if (ping && marker && card) {
        const span = marker.getBoundingClientRect().top - card.getBoundingClientRect().top;
        const box = el?.getBoundingClientRect();
        const below = document.querySelector('.member-pass, .group-rail')?.getBoundingClientRect().top;
        const bottom = box && below ? Math.max(0, box.bottom - below) : 0;
        return mapRef.current?.focus(ping.center, { top: GROUP_TITLE_PX + Math.max(0, span), right: 0, bottom, left: 0 });
      }
      void mapRef.current?.fitPoints(points, padding, memberToMember ? STEP_GLIDE_MS : undefined);
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupFitKey, mapProvider]);
  useEffect(() => {
    if (!openGroup) groupFitted.current = null;
  }, [openGroup]);

  // On a group's map, a quick tap (not a pan or a long press) on someone's
  // ping or face (faded or not) puts the focus on them and opens that
  // place's card; on bare map it closes an open card, else goes back to ALL.
  // The pings let taps through to the map, so they're found by where they are on screen.
  const groupOnMap = !!openGroup;
  useEffect(() => {
    const el = mapEl.current;
    if (!groupOnMap || !el) return;
    let tap: { x: number; y: number; at: number } | null = null;
    const hit = (x: number, y: number): { member: string; seq: number } | null => {
      let found: { member: string; seq: number } | null = null;
      for (const p of document.querySelectorAll<HTMLElement>('.group-ping')) {
        const r = p.querySelector('.group-ping__face, .group-ping__pin')?.getBoundingClientRect();
        if (!r || !p.dataset.member || x < r.left - 6 || x > r.right + 6 || y < r.top - 6 || y > r.bottom + 6) continue;
        found = { member: p.dataset.member, seq: Number(p.dataset.seq) };
        // A face is over the pins around it.
        if (p.classList.contains('group-ping--face')) break;
      }
      return found;
    };
    const down = (e: PointerEvent) => {
      tap = e.isPrimary && el.contains(e.target as Node) ? { x: e.clientX, y: e.clientY, at: performance.now() } : null;
    };
    const up = (e: PointerEvent) => {
      const t = tap;
      tap = null;
      if (!t || !e.isPrimary || !el.contains(e.target as Node)) return;
      if (Math.hypot(e.clientX - t.x, e.clientY - t.y) > PRESS.slopPx || performance.now() - t.at >= PRESS.longMs) return;
      const on = hit(e.clientX, e.clientY);
      if (on) {
        setGroupPicked(on.member);
        setGroupPing(on);
      } else {
        // Bare map: an open card closes first, then the focus goes.
        if (groupPingNow.current) setGroupPing(null);
        else setGroupPicked(null);
      }
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointerup', up, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointerup', up, true);
    };
  }, [groupOnMap]);

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
  }, [incomingCourse, dismissCourse, notify]);

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
    if ((building && routeMode) || shownRoute) return;
    await openNewPinAt(center, 'long_press');
  };

  // A new pin's card on a spot: centred, named by its address once that's known.
  const openNewPinAt = async (center: [number, number], source: PinSource) => {
    const place = pointPlace(center);
    setActivePinId(null);
    pinSource.current = source;
    setPreview(place);
    // Into the middle at the current zoom; the new pin's card stands above it.
    mapRef.current?.centerOn(center);
    const named = await searchService?.reverse(center);
    // Only if the user is still looking at that spot.
    if (named) setPreview((p) => (p?.id === place.id ? { ...named, id: place.id } : p));
  };

  // A new pin's place with no kind yet (a picked spot, an untagged search
  // result): look it up in 상가정보 so the card and pin get an icon. A spot
  // named a moment later is looked up again, by that name.
  useEffect(() => {
    if (!preview || preview.kind) return;
    const controller = new AbortController();
    const { id, name } = preview;
    void placeKindService.lookup(preview, controller.signal).then((kind) => {
      if (kind && !controller.signal.aborted) setPreview((p) => (p?.id === id && p.name === name && !p.kind ? { ...p, kind } : p));
    });
    return () => controller.abort();
  }, [preview]);

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
    pinSource.current = 'search';
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
    if (pin && (pinsHidden || filterPinsByCategories([pin], categories, picked).length === 0)) {
      setPicked(new Set());
      setPinsHidden(false);
    }
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
          buildMethod.current = 'drag';
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
    buildMethod.current = 'plus';
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

  // Deleting a pin also removes every route that contains its place.
  const [pinDeleting, setPinDeleting] = useState<Pin | null>(null);
  const routesWithPin = (pin: Pin) => course.courses.filter((c) => c.stops.some((s) => s.place.id === pin.place.id));
  // A pin deleted on the map leaves the days too (its TODAY pings); a ping
  // taken out of a day leaves the pin alone (CalendarZoom).
  const deletePin = (pin: Pin) => {
    pinStore.removePin(pin.id);
    removePingsOfPin(pin.id);
    if (activePinId === pin.id) setActivePinId(null);
  };
  const deletePinWithRoutes = async (pin: Pin) => {
    await deleteRoutes(routesWithPin(pin));
    deletePin(pin);
  };

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
    if (buildFunnel.current) buildFunnel.current.saved = true;
    analytics.track('route_created', { stops: stops.length, has_note: !!note, in_folder: !!folder });
    setBuilding(null);
    setShownRouteId(saved.id);
    notify(`${saved.title} 경로를 저장했어요.`);
  };

  // 루트 추가 on a shared link's popup: the route joins mine (no folder, so
  // 미분류), its places join my pins in 미분류, and it opens straight into editing.
  // 링크 복사 on a route's card: a short link (#s=, counts its opens) when signed in,
  // else the long #share= link. Either way 제외 주소 stops are taken out first.
  const copyRouteLink = async (route: Course): Promise<boolean> => {
    const plan = planShare({ kind: 'course', draft: route }, getDisplayName(), undefined, privacy.excluded);
    let url: string | null = null;
    if (account.user && shareLinkService.available && plan.token) url = await shareLinkService.create(account.user.id, route.id, plan.token);
    url ??= await plan.createUrl();
    return copyToClipboard(url);
  };

  const addSharedRoute = async (shared: SharedCourse) => {
    const saved = await course.save({
      title: shared.title,
      theme: shared.theme,
      travelMode: shared.travelMode,
      stops: shared.stops,
      note: shared.note,
      sharedBy: shared.sharedBy,
    });
    pinStore.addPlaces(shared.stops.map((s) => s.place));
    changeTab(tabForIncoming('course'));
    editRouteNow(saved);
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
    if (pinFunnel.current) pinFunnel.current.saved = true;
    analytics.track('pin_saved', { source: pinSource.current, uncategorized: categoryId === UNCATEGORIZED.id, has_memo: !!memo });
    setPreview(null);
    setQuery('');
  };
  // Stable, so the card's outside-touch listener isn't re-attached every render.
  const closeNewPin = useCallback(() => setPreview(null), []);

  // Android's back button closes one layer at a time, innermost first.
  useBackButton(() => {
    if (closeTopDialog()) return true;
    if (studio) return setStudio(null), true;
    if (openGroupId) return setOpenGroupId(null), true;
    if (todayOpen) return setTodayOpen(false), true;
    if (searchOpen) return setSearchOpen(false), setQuery(''), searchInput.current?.blur(), true;
    if (preview) return setPreview(null), true;
    if (activePinId) return setActivePinId(null), true;
    if (sharedCourse) return dismissCourse(), true;
    if (editing) return setEditing(null), true;
    if (building) return setBuilding(null), true;
    if (shownRouteId) return setShownRouteId(null), true;
    if (railMode !== 'menu') return railAction(railMode), true;
    if (tab !== 'pins') return changeTab('pins'), true;
    return false;
  });

  // 📍 again on the pin screen: a new pin right where the map is looking —
  // the same card a search pick or a long press opens (name, memo, group,
  // ✓ to pin). With a card already up, the press first closes it (a touch
  // outside the card), then opens a fresh one on the map's current centre.
  const startPinning = () => {
    const source: PinSource = 'pin_button';
    changeTab('pins');
    // 경로 owns the map's taps while it's open; a new pin closes it.
    if (railMode === 'route') railAction('route');
    const center = mapRef.current?.getCenter();
    if (center) void openNewPinAt(center, source);
  };

  // Dragging the map on the pin screen (nothing else open): a crosshair at
  // its middle with the name of the place under it, kept up to date as it
  // moves. Up the moment a press on the map starts moving it (a tap on a pin
  // that centres the map doesn't), gone the moment the finger lifts. Names:
  // one lookup at a time (overlapping ones get Photon to refuse some), at most
  // every AIM_LOOKUP_MS; when an answer comes back it shows at once, and if
  // the map has moved on the next lookup asks about where it is now.
  const aimable = tab === 'pins' && !onPage && !routeMode && !searchOpen && !preview && !activePinId;
  useEffect(() => {
    if (!aimable || !searchService) return;
    const el = mapEl.current;
    let alive = true;
    let pressed = false;
    let dragging = false;
    let asked: [number, number] | null = null;
    let wanted: [number, number] | null = null;
    let lastAt = 0;
    let busy = false;
    let timer: number | undefined;
    const next = () => {
      if (!alive || !dragging || busy || timer !== undefined || !wanted) return;
      if (asked && distanceMeters(asked, wanted) < AIM_MIN_MOVE_M) return;
      const wait = AIM_LOOKUP_MS - (performance.now() - lastAt);
      if (wait > 0) {
        timer = window.setTimeout(() => {
          timer = undefined;
          next();
        }, wait);
        return;
      }
      const center = wanted;
      asked = center;
      lastAt = performance.now();
      busy = true;
      void searchService.reverse(center).then((named) => {
        busy = false;
        if (!alive || !dragging) return;
        // Nothing found nearby: still say what the crosshair is on.
        setAimName(named?.name ?? '이름 없는 곳');
        next();
      });
    };
    const down = (e: Event) => {
      const target = e.target as Element;
      if (!el?.contains(target)) return;
      // A tap on a pin or stop moves the map itself (centring it): not a drag.
      if (target.closest('button, .map-marker, [data-pin-id]')) return;
      pressed = true;
    };
    const up = (e?: Event) => {
      if (e && 'touches' in e && (e as TouchEvent).touches.length > 0) return;
      pressed = false;
      if (!dragging) return;
      dragging = false;
      window.clearTimeout(timer);
      timer = undefined;
      setPanAim(false);
    };
    mapEvents.current.move = (center) => {
      if (pressed && !dragging) {
        dragging = true;
        asked = null;
        lastAt = 0;
        setAimName(null);
        setPanAim(true);
      }
      if (!dragging) return;
      wanted = center;
      next();
    };
    // Touch and mouse ends too: a map SDK that swallows the pointer events
    // (or a lost pointer capture) must still never leave the crosshair up.
    const starts = ['pointerdown', 'touchstart', 'mousedown'];
    const ends = ['pointerup', 'pointercancel', 'touchend', 'touchcancel', 'mouseup'];
    starts.forEach((t) => document.addEventListener(t, down, true));
    ends.forEach((t) => document.addEventListener(t, up, true));
    window.addEventListener('blur', up);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      setPanAim(false);
      mapEvents.current.move = () => {};
      starts.forEach((t) => document.removeEventListener(t, down, true));
      ends.forEach((t) => document.removeEventListener(t, up, true));
      window.removeEventListener('blur', up);
    };
  }, [aimable, searchService]);

  // We Now is a page on top of the map: the phone's back button goes back to
  // the map. Opening it pushes a history entry; leaving some other way takes
  // that entry back off, so back on the map leaves the app as before.
  const pageEntry = useRef(false);
  useEffect(() => {
    if (tab !== 'pins' && !pageEntry.current) {
      pageEntry.current = true;
      history.pushState({ rootIn: tab }, '');
    } else if (tab === 'pins' && pageEntry.current) {
      pageEntry.current = false;
      history.back();
    }
  }, [tab]);
  useEffect(() => {
    const pop = () => {
      if (!pageEntry.current) return;
      if (openGroup || todayOpen) {
        setOpenGroupId(null);
        setTodayOpen(false);
        history.pushState({ rootIn: tab }, '');
        return;
      }
      pageEntry.current = false;
      // Back goes to the map, the page sliding off toward the side the map is on.
      if (onPage && (swipeTo.left === 'pins' || swipeTo.right === 'pins')) swipe.leave(swipeTo.left === 'pins' ? -1 : 1);
      else changeTab('pins');
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  });

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

  // TODAY (and its month) now only opens from We Now's TODAY tile.
  const calendarZoom = tab === 'people' && todayOpen;

  // The big calendar button on TODAY goes to the month, and from the month back to TODAY.
  const calendarButton = () => {
    const type = calendarAgain(calendarMode);
    setCalendarCommand((c) => ({ type, seq: (c?.seq ?? 0) + 1 }));
  };

  // The tab buttons step aside for a 꾸미기 tool's tray, for the 경로 폴더, and under the 꾸미기 screen.
  const barAway = (decorating && calendarZoom && onPage) || routeMode;
  // Under the 꾸미기 screen the row is simply gone, so coming back it is just
  // there again rather than sliding up.
  const barGone = !!studio || !!openGroup;
  // 공유 before 집 is set (it's required) opens the profile on 개인 정보 instead.
  const needHome = (kind: ShareKind) => {
    analytics.track('share_blocked_need_home', { kind });
    setPrivacyNotice('공유하려면 집 주소를 먼저 입력하세요.');
    setProfileOpen(true);
  };

  return (
    <div className={`app ${searchOpen ? 'app--searching' : ''} ${sheetTop ? 'app--sheet-top' : ''} ${onPage ? 'app--page' : ''} ${shownRoute && !editRoute && pinsAway !== 'no' ? 'app--pins-away' : ''} ${shownRoute && !editRoute && (!routeLanded || !pinsGone) ? 'app--route-arriving' : ''} ${editRoute ? 'app--route-editing' : ''} ${pageMoving ? 'app--page-moving' : ''} ${openGroup ? 'app--group' : ''}`}>
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

      {/* Kept mounted while searching: it slides off with the profile button
          (same move, same speed) instead of vanishing and replaying its entrance. */}
      {mapUi && (
        <PinRail
          mode={railMode}
          onAction={railAction}
          categories={categories}
          counts={pinCounts}
          picked={picked}
          hidden={pinsHidden}
          onToggle={(id) => {
            setPinsHidden(false);
            setPicked((prev) => togglePicked(prev, id));
          }}
          onAll={() => {
            const next = tapAll(pinsHidden, picked, [UNCATEGORIZED.id, ...categories.map((c) => c.id)]);
            setPicked(next.picked);
            setPinsHidden(next.hidden);
          }}
          onCategories={() => setCategoriesOpen(true)}
        />
      )}

      {/* 경로 open with nothing on show: dragging from a pin starts a new route (as + does). */}
      {routeOpen && !shownRoute && (
        <p className="route-build__hint" role="status">
          드래그로 루트 추가
        </p>
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
          pinStyles={shownStops.map((place) => {
            const pin = pins.find((p) => p.place.id === place.id);
            return pinStyle(categories, pin?.categoryId ?? UNCATEGORIZED.id, place);
          })}
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
                  // Even a step during the initial fade must keep individual pins off.
                  setPinsAway('gone');
                  setRouteStep({ id: next.id, from: step });
                  setShownRouteId(next.id);
                }
              : undefined
          }
        />
      )}

      {/* 공유 for the route on show: makes its card and opens the 꾸미기 screen on it. */}
      {shownRoute && !buildPins && !editRoute && routeTrayShown && onPinHome && (
        <button className="route-action route-action--edit" aria-label="루트 수정" onClick={startEditing}>
          <Pencil size={20} strokeWidth={2.2} aria-hidden />
        </button>
      )}
      {shownRoute && !buildPins && !editRoute && routeTrayShown && onPinHome && (
        <button
          className="route-action route-action--share"
          aria-label={`${shownRoute.title} 공유`}
          onClick={() => {
            analytics.track('share_started', { kind: 'route' });
            if (!hasHome(privacy.excluded)) return needHome('route');
            openStudio('route');
            setStudioCourse(shownRoute);
            setStudio(routeSubject(shownRoute, privacy.excluded, shownRoute.stops.map((s) => {
              const pin = pins.find((p) => p.place.id === s.place.id);
              return pinStyle(categories, pin?.categoryId ?? UNCATEGORIZED.id, s.place).icon;
            })));
          }}
        >
          <Share size={26} strokeWidth={2.2} aria-hidden />
        </button>
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
        <section
          className="page"
          aria-label={PAGE_TITLES[tab]}
          style={swipe.style}
          {...swipe.handlers}
        >
          {calendarZoom && <DayPattern pattern={dayPattern} />}
          {/* No head bar: TODAY's own heading takes the stage, and We Now shows
              no title (named for screen readers only). */}
          <h1 className="sr-only">{PAGE_TITLES[tab]}</h1>
          {calendarZoom ? (
            <CalendarZoom
              command={calendarCommand}
              shareRef={shareDay}
              excluded={privacy.excluded}
              here={me?.center ?? null}
              pins={pinStore.pins}
              categories={pinStore.categories}
              onNeedHome={() => needHome('day')}
              onShare={(subject) => {
                openStudio('day');
                setStudioCourse(null); // a day's card: no link to copy yet
                setStudio(subject);
              }}
              onDecorating={setDecorating}
              onPingPicked={(remove) => setPingRemove(() => remove)}
              pingDropZone={() => barEl.current?.querySelector('.bar-cal') ?? null}
              onPingDropHover={setPingDropHot}
              onDayTheme={setDayTheme}
              onDayPattern={setDayPattern}
              onMode={setCalendarMode}
            />
          ) : null}
          {calendarZoom && tab === 'people' && (
            <button className="today-back" aria-label="그룹 목록으로" onClick={() => setTodayOpen(false)}>
              <ChevronLeft size={24} strokeWidth={2.2} />
            </button>
          )}
          {tab === 'people' && !todayOpen && (
            <WeNowPage
              todayPings={todayPings}
              // The same look TODAY gives a ping (CalendarZoom's pinLookOf).
              pinLookOf={(ping) => {
                const pin = pins.find((p) => p.id === ping.pinId);
                return pinStyle(categories, pin?.categoryId ?? UNCATEGORIZED.id, pin?.place);
              }}
              onToday={() => setTodayOpen(true)}
              status={groups.status === 'signed-out' && !needLogin ? (guest === 'idle' || guest === 'trying' ? 'loading' : 'error') : groups.status}
              groups={groupList}
              newPings={(g) => newPingCount(g, myId, groupSeen[g.id])}
              photo={profile.photo}
              onProfile={() => setProfileOpen(true)}
              onOpen={setOpenGroupId}
              onCreate={() => setGroupFormOpen(true)}
              onSignIn={account.signIn}
              onRetry={() => (account.user || needLogin ? groups.refresh() : startGuest())}
            />
          )}
        </section>
      ) : null}

      {openGroup && (
        <>
          <GroupLines lines={groupLines} />
          <GroupMapView
            group={openGroup}
            picked={groupPicked}
            me={myId}
            // Mine never: my own pings aren't news to me.
            newPings={(m) => (m.userId === myId ? 0 : newMemberPings(m, memberSeen[memberSeenKey(openGroup.id, m.userId)]))}
            onPick={setGroupPicked}
            onBack={() => setOpenGroupId(null)}
            onSettings={() => setGroupSettingsOpen(true)}
          />
        </>
      )}

      {groupFormOpen && (
        <GroupFormDialog
          onSubmit={async (name, cover, slug) => {
            const made = await groups.create(name, cover, slug);
            if (!made) return false;
            notify(made.inviteSlug === slug ? '그룹을 만들었어요.' : '그룹을 만들었어요. 초대 링크가 바뀌었으니 ⚙에서 다시 복사하세요.');
            return true;
          }}
          onClose={() => setGroupFormOpen(false)}
        />
      )}

      {groupSettingsOpen && openGroup && (
        <GroupSettingsDialog
          group={openGroup}
          onRename={(name) => groups.rename(openGroup.id, name)}
          me={myId}
          onKick={setKicking}
          onAlias={(alias) => groups.setAlias(openGroup.id, alias)}
          onDelete={() => setGroupDeleting(true)}
          onLeave={() => setGroupLeaving(true)}
          onClose={() => setGroupSettingsOpen(false)}
        />
      )}

      {kicking && openGroup && (
        <ConfirmDialog
          label="그룹원 추방"
          message={`'${kicking.nickname}'님을 그룹에서 내보냅니다.`}
          detail="초대 링크로 다시 들어올 수 있어요."
          confirmLabel="추방"
          onConfirm={() => {
            const member = kicking;
            void groups.kick(openGroup.id, member.userId).then((ok) => {
              if (!ok) notify('내보내지 못했어요.');
              else if (groupPicked === member.userId) setGroupPicked(null);
            });
          }}
          onClose={() => setKicking(null)}
        />
      )}

      {groupDeleting && openGroup && (
        <ConfirmDialog
          label="그룹 삭제"
          message={`'${openGroup.name}' 그룹을 삭제합니다.`}
          detail="모든 그룹원이 이 그룹을 더는 볼 수 없어요. 되돌릴 수 없어요."
          confirmLabel="삭제"
          onConfirm={() => {
            void groups.remove(openGroup.id).then((ok) => {
              if (!ok) return notify('그룹을 삭제하지 못했어요.');
              setGroupSettingsOpen(false);
              setOpenGroupId(null);
            });
          }}
          onClose={() => setGroupDeleting(false)}
        />
      )}

      {groupLeaving && openGroup && (
        <ConfirmDialog
          label="그룹 나가기"
          message={`'${openGroup.name}' 그룹에서 나갑니다.`}
          detail="내 오늘 핑도 이 그룹에서 더는 안 보여요."
          confirmLabel="나가기"
          onConfirm={() => {
            const id = openGroup.id;
            void groups.leave(id).then((ok) => {
              if (!ok) return notify('그룹에서 나가지 못했어요.');
              setGroupSettingsOpen(false);
              setOpenGroupId(null);
            });
          }}
          onClose={() => setGroupLeaving(false)}
        />
      )}

      {aimable && (
        <div className={`aim ${panAim ? 'is-on' : ''}`} aria-hidden>
          <div className="aim__mark">
            {aimName && (
              <span className="aim__name">
                <span>{aimName}</span>
              </span>
            )}
            <svg className="aim__cross" viewBox="0 0 48 48" aria-hidden>
              <circle cx="24" cy="24" r="13" />
              <path d="M24 2v12M24 34v12M2 24h12M34 24h12" />
              <circle className="aim__dot" cx="24" cy="24" r="2.6" />
            </svg>
          </div>
        </div>
      )}

      <div
        ref={barEl}
        className={`bottom-bar-wrap ${onPage ? 'bottom-bar-wrap--over' : ''} ${barAway ? 'is-away' : ''} ${barGone ? 'is-gone' : ''}`}
        inert={barAway || barGone}
      >
        <BottomBar
          tab={pageMoving && swipeTarget ? swipeTarget : tab}
          calendarMode={calendarMode}
          today={calendarZoom}
          onCalendar={calendarButton}
          onDeletePing={onPage && calendarZoom && calendarMode === 'day' && pingRemove ? pingRemove : undefined}
          deleteHot={pingDropHot}
          onMap={() => changeTab('pins')}
          onShare={onPage && calendarZoom && calendarMode === 'day' ? () => {
            analytics.track('share_started', { kind: 'day' });
            shareDay.current?.();
          } : undefined}
          onPin={startPinning}
          onPeople={() => changeTab('people')}
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
            label="장소와 루트 삭제"
            message="이 장소는 루트에 포함되어 있는 장소예요."
            detail={
              <>
                포함된 루트:{' '}
                {routesWithPin(pinDeleting).map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && '  '}
                    <b className="confirm-dialog__em">'{c.title}'</b>
                  </span>
                ))}
                {'\n'}루트도 같이 삭제돼요.
              </>
            }
            confirmLabel="삭제"
            onConfirm={() => void deletePinWithRoutes(pinDeleting)}
            onClose={() => setPinDeleting(null)}
          />
        ) : (
          <ConfirmDialog
            label="장소 삭제"
            message={`'${pinDeleting.place.name}' 장소를 삭제합니다.`}
            detail="삭제한 장소는 복구할 수 없어요."
            onConfirm={() => deletePin(pinDeleting)}
            onClose={() => setPinDeleting(null)}
          />
        ))}

      {sharedCourse && (
        <SharedRouteDialog
          // A short link brings the sharer's profile and the open count; a long one only the name in it.
          sender={incomingMeta?.sender.nickname || sharedCourse.sharedBy || '익명'}
          photo={incomingMeta?.sender.photo ?? null}
          shareCount={incomingMeta?.openCount}
          onAdd={() => {
            if (incomingMeta) void shareLinkService.countAdd(incomingMeta.slug);
            void addSharedRoute(sharedCourse);
          }}
          onClose={dismissCourse}
        />
      )}

      {studio && (
        <ShareStudio
          subject={studio}
          onTheme={setStudioTheme}
          onCopyLink={studioCourse ? () => copyRouteLink(studioCourse) : undefined}
          onShared={(method, ok) => {
            if (ok) studioFunnel.current.completed = true;
            analytics.track('share_completed', { kind: studioFunnel.current.kind, method, ok });
          }}
          onClose={() => {
            analytics.track('share_studio_closed', { ...studioFunnel.current });
            setStudio(null);
            setStudioCourse(null);
          }}
        />
      )}

      {profileOpen && (
        <ProfileSheet
          profile={profile}
          onChange={changeProfile}
          onNickname={(nickname) => account.push(profile, nickname)}
          account={account}
          privacy={privacyProps}
          privacyNotice={hasHome(privacy.excluded) ? null : privacyNotice}
          // 설정 slides in over the profile; the profile (and its grey) goes once it's covered.
          onSettings={() => setSettingsOpen(true)}
          onClose={() => {
            setProfileOpen(false);
            setPrivacyNotice(null);
          }}
        />
      )}
      {/* 설정, opened from the profile's ⚙: the profile closes once 설정 covers the screen,
          so leaving 설정 goes back to the screen under it, with no grey left over. */}
      {settingsOpen && (
        <SettingsScreen
          profile={profile}
          onChange={changeProfile}
          account={account}
          privacy={privacyProps}
          onCovered={() => {
            setProfileOpen(false);
            setPrivacyNotice(null);
          }}
          onClose={() => setSettingsOpen(false)}
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
