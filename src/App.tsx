import { ChevronLeft, Pencil, Share } from 'lucide-react';
import { dayPatternAccent, type PatternId, type ThemeId } from './domain/decor';
import DayPattern from './components/DayPattern';
import { analytics, type PinSource, type ShareKind } from './services/analytics';
import ConfirmDialog from './components/ConfirmDialog';
import { routeSubject, type ShareSubject } from './domain/shareSubject';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBackButton } from './hooks/useBackButton';
import { closeTopDialog } from './lib/native';
import { LOCATION_MESSAGES } from './lib/geolocation';
import BottomBar from './components/BottomBar';
import CalendarZoom, { type CalendarCommand, type TodayPhotoPick } from './components/CalendarZoom';
import NewPinCard, { type NewPinInput } from './components/NewPinCard';
import PinCard from './components/PinCard';
import PinRail from './components/PinRail';
import RouteBuildLayer from './components/RouteBuildLayer';
import RouteEditTray from './components/RouteEditTray';
import RouteFolderTray from './components/RouteFolderTray';
import RouteStyleLayer from './components/RouteStyleLayer';
import RouteTitle from './components/RouteTitle';
import StopLines from './components/StopLines';
import SearchBar from './components/SearchBar';
import ProfileSheet, { ProfileAvatar } from './components/ProfileSheet';
import { calendarAgain, pageSwipes, PAGE_TITLES, showsPage, tabForIncoming, type AppTab } from './domain/appTabs';
import { COURSE_LIMITS } from './domain/course';
import type { MapViewport } from './domain/districtMap';
import { filterPinsByCategories, isUncategorized, kindCategoryId, pinStyle, UNCATEGORIZED } from './domain/pin';
import { placePhotos } from './domain/visitedPlaces';
import { placeKindService } from './services/placeKindService';
import { isAllPicked, pinRailNext, tapAll, togglePicked, type PinRailEntry, type PinRailMode } from './domain/pinRail';
import { pingsForDate } from './domain/dayPings';
import { buildRouteLook, EMPTY_BUILD_LOOK, nextRouteName, ROUTE_NOTE_MAX, toggleBuildStop, withBuildEdge, withBuildShape, type BuildLook } from './domain/routeBuild';
import { addEditStop, moveStop, toggleEditStop, withEditStops, type RouteEdit } from './domain/routeEdit';
import { cleanRouteLook, withEdgeStyle, withStopShape } from './domain/routeStyle';
import { folderOf, moveRoute, neighborRoute, type RouteTab } from './domain/routeFolders';
import { useCourses } from './hooks/useCourses';
import { useAreaMap } from './hooks/useAreaMap';
import { useNearbyPlaces } from './hooks/useNearbyPlaces';
import { nearbyPlaceAt } from './domain/nearbyPlaces';
import { buildPlaceProfile } from './domain/poiScene';
import { pinPlaceLook } from './domain/poiAppearance';
import { useIncomingCourse } from './hooks/useIncomingCourse';
import { useMyLocation } from './hooks/useMyLocation';
import { onPingRemoved, removePingsOfPin } from './services/pingRepository';
import { useAccount } from './hooks/useAccount';
import { getDisplayName } from './lib/currentUser';
import { copyToClipboard } from './lib/clipboard';
import { useGroups, useGroupsOnDay } from './hooks/useGroups';
import { groupService, groupsNeedLogin } from './services/groupService';
import { dayDecorKey, GROUP_LIMITS as GROUP_SIZE, memberInk, pingPhotos as groupPingPhotos, newMemberPings, photoKey, withoutPhotos, newPingCount, photoPlaces, type GroupMember } from './domain/groups';
import WeNowPage from './components/WeNowPage';
import { useUnreadTalk } from './hooks/useUnreadTalk';
import { memberSeenKey } from './services/groupSeenRepository';
import { useStoredPings } from './hooks/useStoredPings';
import { dateKey, timeKey } from './domain/diary';
import GroupMapView, { type GroupPlace } from './components/GroupMapView';
import { useHeartNews } from './hooks/useHeartNews';
import { useGroupNews } from './hooks/useGroupNews';
import { useGalleryPhotos } from './hooks/useGalleryPhotos';
import { usePingPhotos } from './hooks/usePingPhotos';
import { galleryDayLabel, localGalleryPhotos, type GalleryTab } from './domain/gallery';
import PhotoViewer, { OpenPhotoMarks } from './components/PhotoViewer';
import type { CalendarPhotos } from './components/WeekCalendar';
import GroupAtlas, { type AtlasHandle } from './components/GroupAtlas';
import GroupLookLayer from './components/GroupLookLayer';
import { usePhotoDoodle } from './components/PhotoDoodle';
import { shareLinkService } from './services/shareLinkService';
import { planShare } from './services/shareTargets';
import { usePageSwipe } from './hooks/usePageSwipe';
import { usePlaceAddress } from './hooks/usePlaceAddress';
import { usePins } from './hooks/usePins';
import { usePinKinds } from './hooks/usePinKinds';
import { isSamePoi, kindsFromPlaces, withPinKinds } from './domain/pinKinds';
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
import type { CourseStop, PlaceRef, Course, SharedCourse } from './types/course';
import type { Pin } from './types/pin';
import AimCross from './components/AimCross';
import ToastBar from './components/ToastBar';
import { useAppTheme } from './hooks/useAppTheme';
import { useCameraShot } from './hooks/useCameraShot';
import { useCategorySharing } from './hooks/useCategorySharing';
import { useGroupMapTaps } from './hooks/useGroupMapTaps';
import { useGroupSeen } from './hooks/useGroupSeen';
import { useHomeHistory } from './hooks/useHomeHistory';
import { usePanAim } from './hooks/usePanAim';
import { useBareMapTap, useRouteStrokes } from './hooks/useRouteStrokes';
import { useToast } from './hooks/useToast';
import { measureMapPadding, STEP_GLIDE_MS } from './lib/mapPadding';
import { useGroupFit } from './hooks/useGroupFit';
import { useGroupList } from './hooks/useGroupList';
import { useGroupLooks } from './hooks/useGroupLooks';
import { PINS_FADE_MS, useLingering, useRouteArrival } from './hooks/useRouteArrival';
import { useVisitedPins } from './hooks/useVisitedPins';
import { buildGroupLines, buildGroupMarks } from './map/groupMarks';

import { lazyScreen, preloadScreens } from './lib/lazyScreen';

// Screens that aren't part of the first one stay out of the first bundle (lib/lazyScreen).
const ShareStudio = lazyScreen(() => import('./components/ShareStudio'));
const SettingsScreen = lazyScreen(() => import('./components/SettingsScreen'));
const GroupCalendar = lazyScreen(() => import('./components/GroupCalendar'));
const CategorySheet = lazyScreen(() => import('./components/CategorySheet'));
const SharedRouteDialog = lazyScreen(() => import('./components/SharedRouteDialog'));
const SharedCategoryDialog = lazyScreen(() => import('./components/SharedCategoryDialog'));
const ChatList = lazyScreen(() => import('./components/ChatList'));
const GroupChat = lazyScreen(() => import('./components/GroupChat'));
const PhotoGallery = lazyScreen(() => import('./components/PhotoGallery'));
const CameraScreen = lazyScreen(() => import('./components/CameraScreen'));
const GroupSendDialog = lazyScreen(() => import('./components/GroupSendDialog'));
const GroupFormDialog = lazyScreen(() => import('./components/GroupFormDialog'));
const GroupSettingsDialog = lazyScreen(() => import('./components/GroupSettingsDialog'));

// A pin's card opens with the pin this far below the map's middle, leaving
// room above the card for the photos taken there (.place-card--pin's bottom).
const PIN_CARD_DROP_PX = 96;
/** Matches `tray-down` in styles.css: the 경로 폴더 sheet stays mounted while it slides away. */
const ROUTE_TRAY_OUT_MS = 170;

export default function App() {
  const mapEl = useRef<HTMLDivElement | null>(null);
  // An open group's map: the atlas (its islands over a faint Korea), not the real map.
  const atlasRef = useRef<AtlasHandle | null>(null);
  const atlasEl = useRef<HTMLDivElement | null>(null);
  const barEl = useRef<HTMLDivElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<CourseMap | null>(null);
  const [searchService, setSearchService] = useState<PlaceSearchService | null>(null);
  const [mapProvider, setMapProvider] = useState<'kakao' | 'maplibre' | null>(null);
  const [viewport, setViewport] = useState<MapViewport | null>(null);

  const { toast, notify, dismissToast } = useToast();

  const { update: updateSettings } = useSettings();

  // Themes belong to calendar days (the day on screen reports its own) and
  // to share cards (the 꾸미기 screen reports its card's, over the day's while
  // it's up); the one showing lives on <html data-theme>, where styles.css
  // swaps the tokens.
  // …and so do background patterns, drawn across the calendar page — in the
  // live day's own colour (the one its land and pings tint to), not the app's.
  const [dayPattern, setDayPattern] = useState<PatternId>('none');
  const [livePageTheme, setLivePageTheme] = useState<ThemeId>('default');
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
  // A calendar day's theme only tints its own land and pings (CalendarZoom, the We Now
  // TODAY tile; 2026-11-11), so the page keeps the app's theme; the 꾸미기 screen's card
  // still dresses the whole screen while it's up.
  const dayTheme = studio ? studioTheme : 'default';
  const pinStore = usePins();
  const routeFolders = useRouteFolders();
  const { pins, categories } = pinStore;
  usePinKinds(pins, pinStore.transform);
  const course = useCourses();
  const { incoming: incomingCourse, dismiss: dismissCourse } = useIncomingCourse();

  // The app opens on We Now (the groups); the map is one step to its right.
  const [tab, setTab] = useState<AppTab>('people');
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profile, setProfile] = useState(loadProfile);
  // 로그인: the account's profile replaces this one on sign-in, and changes go up after.
  const account = useAccount(profile, (next) => {
    setProfile(next);
    saveProfile(next);
  });
  const changeProfile = (next: Profile) => {
    if (!saveProfile(next)) return false;
    setProfile(next);
    account.push(next);
    return true;
  };
  // 디스플레이 및 언어 → 디스플레이: the app's own theme (and icon), under whatever a share card picks.
  useAppTheme(profile.appTheme, dayTheme, mapRef);
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
  // TODAY opened from a group's calendar (its MY): it starts on the month, not the day.
  const [todayStart, setTodayStart] = useState<'day' | 'month'>('day');
  useEffect(() => {
    if (!todayOpen) setTodayStart('day');
  }, [todayOpen]);
  // A photo tapped on a calendar's card (TODAY's month, a group's calendar), open big.
  const [calendarPhoto, setCalendarPhoto] = useState<CalendarPhotos | null>(null);
  // TODAY's photo open big (its place among the day's photos); closed with TODAY.
  // TODAY: the photo picked on a ping's stack (its panel up top), and whether it's open big.
  const [todayPhoto, setTodayPhoto] = useState<TodayPhotoPick | null>(null);
  const [todayPhotoBig, setTodayPhotoBig] = useState(false);
  useEffect(() => {
    if (!todayOpen) setTodayPhoto(null);
  }, [todayOpen]);
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
  // The gallery's open tab (the map, We Now and TODAY open on MY, a group on its own),
  // null = closed; the photo open big in it. Every group's photos are read at once,
  // for every tab — so the groups are read while it (or 설정, for 그룹 알림) is open, off We Now too.
  const [galleryTab, setGalleryTab] = useState<GalleryTab | null>(null);
  // Someone hearted a photo of mine in the gallery: say so (in-app; no push yet).
  useHeartNews(account.user, notify);
  // A member of a group of mine pinged a new place (그룹 알림 · 새로운 루트):
  // a notice in the app, a push on the phone apps; a tapped push opens the group.
  useGroupNews(account.user, {
    onNotice: notify,
    onOpenGroup: (id) => {
      changeTab('people');
      setOpenGroupId(id);
    },
  });
  const groups = useGroups(account.user, tab === 'people' || galleryTab !== null || settingsOpen, {
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
  // My groups as every screen lists them (my order, my covers, my own row from this phone).
  const { groupList, goneShots, markGone, reorderGroups, setMyCover } = useGroupList(groups.groups, myId, profile.photo);
  // 사진 삭제 / 핀 삭제 from the photo panel's … menu (asked first): only in the open group.
  const [placeDeleting, setPlaceDeleting] = useState<'photo' | 'place' | null>(null);
  const deleteFromGroup = async (kind: 'photo' | 'place') => {
    const group = openGroup;
    const place = groupPing;
    const ping = group && place?.member === myId ? group.members.find((m) => m.userId === myId)?.pings[place.seq] : undefined;
    if (!group || !place || !ping) return;
    const stack = groupPingPhotos(ping);
    const index = place.photo !== undefined && stack[place.photo] ? place.photo : stack.length - 1;
    const paths = (kind === 'photo' ? stack.slice(index, index + 1) : stack)
      .map((url) => photoKey(url))
      .filter((key): key is string => !!key && !key.startsWith('demo/'));
    // A place is only its photos, so 핀 삭제 is all of mine there.
    if (!(await groupService.deletePhotos(group.id, paths))) return notify('삭제하지 못했어요. 잠시 뒤에 다시 시도해 주세요.');
    if (paths.length) markGone(paths);
    // A place is its photos: it stays only while another photo is left there.
    const stays = kind === 'photo' && stack.length > 1;
    setGroupPhotoBig(false);
    setGroupPing(stays ? { member: place.member, seq: place.seq } : null);
    notify(kind === 'photo' ? '사진을 삭제했어요.' : `'${ping.name || '이름 없는 곳'}' 핀을 이 그룹에서 삭제했어요.`);
    groups.refresh();
  };
  // A ping taken out of TODAY by hand leaves every group: the ping itself
  // goes with the next push (and from this phone's rows at once), the photos
  // I sent from that place that day are deleted from all of them here.
  const groupsRef = useRef({ refresh: groups.refresh, any: false, myId });
  groupsRef.current = { refresh: groups.refresh, any: groupList.length > 0, myId };
  useEffect(
    () =>
      onPingRemoved((ping) => {
        const now = groupsRef.current;
        if (ping.local || !now.myId || !now.any) return;
        void groupService.deletePlacePhotos({ day: ping.day, at: ping.at, center: ping.center, name: ping.name }).then((ok) => {
          if (!ok) notify('그룹에 보낸 사진은 삭제하지 못했어요.');
          groupsRef.current.refresh();
        });
      }),
    [notify],
  );
  // Back from TODAY to the group list: read the groups again rather than wait
  // for the minute's refresh (the others' pings may have moved on meanwhile).
  const wasTodayOpen = useRef(todayOpen);
  useEffect(() => {
    if (wasTodayOpen.current && !todayOpen && tab === 'people') groups.refresh();
    wasTodayOpen.current = todayOpen;
  }, [todayOpen]);
  const [kicking, setKicking] = useState<GroupMember | null>(null);
  // The day an open group's map shows, paged with its `<` `>`; null = today (the live list).
  const [groupDay, setGroupDay] = useState<string | null>(null);
  // The group's calendar over its map (from the button under ⚙).
  const [groupCalendar, setGroupCalendar] = useState(false);
  // Switched to from another calendar: the group opens on its calendar, not its map.
  const calendarOnOpen = useRef(false);
  useEffect(() => {
    setGroupDay(null);
    setGroupCalendar(calendarOnOpen.current);
    calendarOnOpen.current = false;
  }, [openGroupId]);
  // The group calendar's days of mine the server may not have yet: today, once I've sent this group a photo.
  const myPingDays = useMemo(() => {
    const live = groupList.find((g) => g.id === openGroupId);
    const mine = live?.members.find((m) => m.userId === myId);
    return new Set(mine?.pings.length ? [dateKey()] : []);
  }, [groupList, openGroupId, myId]);
  const pastGroups = useGroupsOnDay(account.user, openGroupId ? groupDay : null);
  useEffect(() => {
    if (groupDay && pastGroups.status === 'error') notify('그날 핑을 불러오지 못했어요.');
  }, [groupDay, pastGroups.status, notify]);
  // Another day keeps today's members (names, faces as they are now) with that
  // day's pings — mine from this phone's TODAY, as on today.
  const openGroup = useMemo(() => {
    const live = tab === 'people' && openGroupId ? (groupList.find((g) => g.id === openGroupId) ?? null) : null;
    if (!live || !groupDay) return live;
    const then = pastGroups.groups.find((g) => g.id === live.id);
    return {
      ...live,
      members: live.members.map((m) => {
        const pings = then?.members.find((t) => t.userId === m.userId)?.pings ?? [];
        return { ...m, pings: photoPlaces(m.userId === myId ? withoutPhotos(pings, goneShots) : pings) };
      }),
    };
  }, [tab, openGroupId, groupList, groupDay, pastGroups.groups, myId, goneShots]);
  const groupOpen = !!openGroup;
  const [gallerySeq, setGallerySeq] = useState<number | null>(null);
  const galleryIds = useMemo(() => (galleryTab ? groupList.map((g) => g.id) : null), [galleryTab, groupList]);
  const gallery = useGalleryPhotos(galleryIds);
  const pingPhotos = usePingPhotos();
  // The photos I took at the place a card is open on (above the card).
  const activePinPhotos = useMemo(
    () => (activePin ? placePhotos(activePin.place, activePin.id, storedPings, pingPhotos) : []),
    [activePin, storedPings, pingPhotos],
  );
  const previewPhotos = useMemo(() => (preview ? placePhotos(preview, null, storedPings, pingPhotos) : []), [preview, storedPings, pingPhotos]);
  // Every card shows its FROM → TO line: a place saved without an address
  // borrows the one nearest its spot.
  const reverseAddress = useMemo(() => (searchService ? (center: [number, number]) => searchService.reverse(center) : null), [searchService]);
  // The card waits for it (briefly), so its name and that line come up together.
  const activePinAddress = usePlaceAddress(activePin?.place ?? null, reverseAddress);
  const previewAddress = usePlaceAddress(preview, reverseAddress);
  // One of them open big (its index, newest first); another card closes it.
  const [placePhoto, setPlacePhoto] = useState<number | null>(null);
  const cardPhotos = preview ? previewPhotos : activePinPhotos;
  const cardPlace = preview ?? activePin?.place ?? null;
  useEffect(() => setPlacePhoto(null), [preview?.id, activePinId]);
  useVisitedPins(storedPings, pins, pinStore.transform);
  const myMember = useMemo<GroupMember>(
    () =>
      groupList.flatMap((g) => g.members).find((m) => m.userId === myId) ?? {
        userId: myId ?? 'me', slot: 0, color: 0, nickname: getDisplayName().trim() || '나', alias: null, photo: profile.photo ?? null, pings: [],
      },
    [groupList, myId, profile.photo],
  );
  const galleryLocal = useMemo(
    () => (galleryTab ? localGalleryPhotos(storedPings, pingPhotos, myMember.userId) : []),
    [galleryTab, storedPings, pingPhotos, myMember.userId],
  );
  // A place card's gallery button opens MY searched for that place.
  const [galleryPlace, setGalleryPlace] = useState<string | null>(null);
  const openGallery = (to: GalleryTab, place: string | null = null) => {
    setGallerySeq(null);
    setGalleryTab(to);
    setGalleryPlace(place);
  };
  const closeGallery = useCallback(() => {
    setGallerySeq(null);
    setGalleryTab(null);
    setGalleryPlace(null);
  }, []);
  // The gallery search's suggestions: every place I've pinged.
  const visitedNames = useMemo(() => [...new Set(storedPings.map((p) => p.name))], [storedPings]);
  // A group's tab that's gone (left, deleted) falls back to MY.
  useEffect(() => {
    if (galleryTab && galleryTab !== 'my' && !groupList.some((g) => g.id === galleryTab)) openGallery('my');
  }, [galleryTab, groupList]);
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
  // The ping tapped on a group's map (its place is in the photo panel under the title); it goes with its member's focus.
  const [groupPing, setGroupPing] = useState<GroupPlace | null>(null);
  useEffect(() => {
    if (groupPing && groupPing.member !== groupPicked) setGroupPing(null);
  }, [groupPicked, groupPing]);
  // Another day: the panel's ping was that day's.
  useEffect(() => setGroupPing(null), [groupDay]);
  // The panel's photo opened big over everything; it goes when the panel does.
  const [groupPhotoBig, setGroupPhotoBig] = useState(false);
  // The open group's 대화, and the photo open big in it.
  const [groupChat, setGroupChat] = useState(false);
  const [chatPhoto, setChatPhoto] = useState<number | null>(null);
  // Lines of each group's 대화 I haven't read: the 대화 buttons' badges (We Now only, signed in).
  const unreadTalk = useUnreadTalk(tab === 'people' && !!account.user && groups.status === 'ready');
  // We Now's 대화 목록 (every group's thread), and the group whose 대화 is open from it.
  const [chatsOpen, setChatsOpen] = useState(false);
  const [chatsGroupId, setChatsGroupId] = useState<string | null>(null);
  const chatsGroup = chatsOpen && chatsGroupId ? (groupList.find((g) => g.id === chatsGroupId) ?? null) : null;
  useEffect(() => {
    if (!chatsOpen) setChatsGroupId(null);
  }, [chatsOpen]);
  useEffect(() => {
    if (tab !== 'people') setChatsOpen(false);
  }, [tab]);
  useEffect(() => {
    setGroupChat(false);
    setChatPhoto(null);
  }, [openGroupId]);
  useEffect(() => {
    if (!groupPing) setGroupPhotoBig(false);
  }, [groupPing]);
  // What I've seen of my groups: their 새 핑 badges, and each face's on an open group's map.
  const { groupSeen, memberSeen } = useGroupSeen(openGroup, groupPicked, groupDay);
  useEffect(() => {
    if (!needLogin && tab === 'people' && account.available && !account.user && guest === 'idle') startGuest();
  }, [needLogin, tab, account.available, account.user, guest, startGuest]);
  const onPage = showsPage(tab, Boolean(searchOpen || preview || openGroup));
  // Swiping We Now right-to-left slides it off to the map on its right (pageSwipes).
  const swipeTo = onPage && !decorating && !studio && !todayOpen ? pageSwipes(tab) : { left: null, right: null };
  const swipe = usePageSwipe(
    swipeTo.left ? () => changeTab(swipeTo.left!) : null,
    swipeTo.right ? () => changeTab(swipeTo.right!) : null,
  );
  // Left to right on TODAY takes it back to We Now, which shows under it meanwhile
  // (not while drawing, a ping is picked or a photo is big: those fingers are theirs).
  // The panel closing puts its big photo away too (leaving TODAY closes the panel, above).
  useEffect(() => {
    if (todayPhoto === null) setTodayPhotoBig(false);
  }, [todayPhoto]);
  const todaySwipe = usePageSwipe(null, todayOpen && !decorating && todayPhoto === null && !pingRemove ? () => setTodayOpen(false) : null);
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
  const routeTrayShown = useLingering(routeOpen, ROUTE_TRAY_OUT_MS);
  const shownRoute = routeShowing ? (course.courses.find((c) => c.id === shownRouteId) ?? null) : null;
  // The route being edited: the one on show, with the edits so far.
  const editRoute = editing && shownRoute?.id === editing.id ? editing : null;
  // Leaving the route (경로 closed, another tab) drops an edit not saved with ✓.
  useEffect(() => {
    if (!routeShowing) setEditing(null);
  }, [routeShowing]);
  const shownRouteKey = shownRoute?.id ?? null;
  // The glide over to it, then the pins fading off, then its stops dropping in.
  const arrival = useRouteArrival(shownRouteKey);
  const { pinsAway, pinsGone, routeLanded, setLandedRoute } = arrival;
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
    // A group's map is its members' pings only: none of my pins under them.
    if (!mapUi || openGroup) return [];
    // A saved route on show has the map to itself: every pin steps aside
    // (its stops, shaped or numbered, stand in for the places).
    // Editing it, they come back to be picked.
    if (shownRoute && !isEditing && pinsGone) return [];
    return shownPins.map((pin) => ({
      id: pin.id,
      center: pin.place.center,
      name: pin.place.name,
      // The map draws the place as its POI; its group shows nowhere on the map.
      place: pin.place,
      // While making a route, chosen pins show their order as numbered stops instead.
      selected: pin.id === activePinId,
    }));
  }, [mapUi, shownPins, activePinId, shownRoute, isEditing, pinsGone, openGroup]);

  const search = usePlaceSearch(searchService, query, () => mapRef.current?.getCenter());
  // 제외 주소 are located with the same place search (search failing just leaves the address text to match).
  const privacy = usePrivacy(async (address) => (await searchService?.search(address))?.[0]?.center ?? null);
  // 카테고리 공유: sharing mine, following others', and a `#c=` link waiting for its popup.
  const { categorySharing, incomingCategory, incomingFollowed, followCategory, dismissCategory, unfollowCategory } = useCategorySharing({
    account,
    pins,
    categories,
    excluded: privacy.excluded,
    transform: pinStore.transform,
    notify,
    onNeedHome: () => {
      setCategoriesOpen(false);
      needHome('category');
    },
    onFollowed: () => changeTab('pins'),
  });
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
  const mapPadding = useCallback((extraBottom = 0): MapPadding => measureMapPadding(barEl.current, extraBottom), []);

  const mapEvents = useRef({
    stop: (_i: number) => {},
    pin: (_id: string) => {},
    nearby: (_place: PlaceRef) => {},
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
      onNearbyPlaceClick: (place) => mapEvents.current.nearby(place),
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

  // Draw the whole viewport; only the labels avoid sheets and controls.
  const areaView = useMemo(() => {
    const el = mapEl.current;
    if (!viewport || !el) return null;
    const cover = mapPadding();
    // On desktop the padding leaves the bottom bar out (nothing is fitted
    // under it); a name there would still be hidden.
    const bar = barEl.current?.getBoundingClientRect();
    const underBar = bar && bar.height > 0 ? el.getBoundingClientRect().bottom - bar.top + 8 : 0;
    return {
      cover: { ...cover, bottom: Math.max(cover.bottom, underBar) },
    };
  }, [viewport, mapPadding]);
  const areaMap = useAreaMap(viewport, areaView?.cover);
  // On this device only: what the user saved and visited ranks same-kind places.
  const placeProfile = useMemo(() => buildPlaceProfile({ pins, pings: storedPings, courses: course.courses }),
    [pins, storedPings, course.courses]);
  // Pins on the map always win: no place sticker or name is drawn over one,
  // and a kind a pin shows is not shown again (they look like the places).
  const nearbyAvoid = useMemo(() => pinMarkers.map((pin) => ({ ...pinPlaceLook(pin.place), center: pin.center })), [pinMarkers]);
  const nearbyPlaces = useNearbyPlaces(viewport, placeProfile, nearbyAvoid);
  // Drag handlers stay attached while place data and the camera update.
  const nearbyContext = useRef({ places: nearbyPlaces, viewport });
  nearbyContext.current = { places: nearbyPlaces, viewport };
  // A pinned place is drawn by its pin, which looks just like its POI: the POI
  // steps aside so the two don't stack.
  // A category picked (not ALL): only that category's places — the places
  // that aren't pins stay only when they're of that category's kind (a kind
  // category, `kindCategoryId`: 카페·디저트 shows every café around too).
  const categoryPicked = !isAllPicked(picked, [UNCATEGORIZED.id, ...categories.map((c) => c.id)]);
  const unpinnedNearby = useMemo(() => {
    const ofPicked = categoryPicked
      ? nearbyPlaces.filter((place) => {
          const id = kindCategoryId(place.kind);
          return !!id && picked.has(id);
        })
      : nearbyPlaces;
    if (pinMarkers.length === 0) return ofPicked;
    return ofPicked.filter((place) => !pinMarkers.some((pin) => isSamePoi(pin.place, place)));
  }, [nearbyPlaces, pinMarkers, categoryPicked, picked]);
  // A pin with no kind (made from a ping, a long press) hides the POI it stands
  // for and would show no sticker: it takes that POI's kind, kept on the pin.
  useEffect(() => {
    const matches = kindsFromPlaces(pins, nearbyPlaces);
    if (!matches.length) return;
    pinStore.transform((current) => {
      const next = withPinKinds(current.pins, matches);
      return next === current.pins ? null : { ...current, pins: next };
    });
  }, [pins, nearbyPlaces, pinStore.transform]);
  useEffect(() => {
    // Nor nearby places or landmarks on a group's map.
    mapRef.current?.setNearbyPlaces(groupOpen ? [] : unpinnedNearby);
  }, [unpinnedNearby, mapProvider, groupOpen]);
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
  const location = useMyLocation();
  const { me } = location;
  useEffect(() => {
    if (location.error) notify(LOCATION_MESSAGES[location.error]);
  }, [location.error, notify]);
  const locateMe = async () => {
    const fix = await location.enable();
    if (fix) mapRef.current?.focus(fix.center);
  };
  const centeredOnMe = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    // My own dot stays off a group's map too: only the members' pings are on it.
    map?.setMyLocation(groupOpen ? null : (me?.center ?? null));
    // Nor does the first fix pull a group's map over to me (it's centred later, off the group).
    if (!map || !me || centeredOnMe.current || groupOpen) return;
    centeredOnMe.current = true;
    // Not over something already on screen (a received route, a search result).
    // No padding: the pin button pins at the map's true center, so pressing it
    // right away lands on the dot.
    if (!shownRoute && !preview) map.focus(me.center);
  }, [me, mapProvider, groupOpen]);

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

  // My looks in the open group (pressed pings and lines), and my own row in it.
  const { looksOf, myGroupRow, setGroupLook } = useGroupLooks(openGroup, myId);
  // The day's whiteboard on the group's map: everyone's doodles always
  // shown; mine edited while 꾸미기 is on, in my colour in the group.
  const [boardOn, setBoardOn] = useState(false);
  const boardInkOf = useCallback((userId: string) => (openGroup ? memberInk([openGroup], userId) : null), [openGroup]);
  const groupBoard = usePhotoDoodle(
    openGroup ? dayDecorKey(openGroup.id, groupDay ?? dateKey()) : null,
    boardOn && myGroupRow ? `member-${myGroupRow.color % GROUP_SIZE.members}` : null,
    boardInkOf,
    { board: true },
  );
  useEffect(() => setBoardOn(false), [openGroupId]);
  const myLookRow = useRef<{ me: string; count: number } | null>(null);
  myLookRow.current = myGroupRow ? { me: myGroupRow.userId, count: myGroupRow.pings.length } : null;
  const groupMarks = useMemo(
    () => (openGroup ? buildGroupMarks(openGroup, groupPicked, groupPing, looksOf) : []),
    [openGroup, groupPicked, groupPing, looksOf],
  );
  const groupLines = useMemo(() => buildGroupLines(openGroup, groupPicked, looksOf), [openGroup, groupPicked, looksOf]);
  useGroupFit({ openGroup, picked: groupPicked, ping: groupPing, day: groupDay, atlasRef, atlasEl });

  // On a group's map a quick tap picks the member (and the place) under it; bare map goes back to ALL.
  useGroupMapTaps(groupOpen, atlasEl, myLookRow, setGroupPicked, setGroupPing);

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

  // Once the first screen is up and quiet, the other screens' code is fetched ahead of their first opening.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((run: () => void) => window.setTimeout(run, 1500));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const id = idle(() => preloadScreens(), { timeout: 4000 });
    return () => cancel(id);
  }, []);

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

  // ----- Map events -----

  mapEvents.current.stop = (index: number) => {
    // Making a route: a chosen pin is covered by its numbered stop, so a tap
    // there takes it back out.
    if (building && routeMode) return setBuilding((b) => (b ? b.filter((_, i) => i !== index) : b));
    if (editRoute) return editStops((stops) => stops.filter((_, i) => i !== index));
    const place = shownStops[index];
    if (!place) return;
    mapRef.current?.focus(place.center, mapPadding());
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
    // A group's map shows its members' pings only: no new pin of mine from it.
    if (groupOpen) return;
    await openNewPinAt(center, 'long_press');
  };

  // Use the same place as the map bubble; address lookup fills only empty spots.
  const openNewPinAt = async (center: [number, number], source: PinSource) => {
    const context = nearbyContext.current;
    const nearby = nearbyPlaceAt(context.places, center, context.viewport);
    const place = nearby ?? pointPlace(center);
    setActivePinId(null);
    pinSource.current = source;
    setPreview(place);
    // Into the middle at the current zoom; the new pin's card stands above it.
    mapRef.current?.centerOn(place.center, PIN_CARD_DROP_PX);
    if (nearby) return;
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

  const pickPlace = (place: PlaceRef) => {
    setSearchOpen(false);
    searchInput.current?.blur();
    setActivePinId(null);
    pinSource.current = 'search';
    setPreview(place);
    // Into the middle at the current zoom; the new pin's card stands above it.
    mapRef.current?.centerOn(place.center, PIN_CARD_DROP_PX);
  };
  mapEvents.current.nearby = (place) => {
    if ((building && routeMode) || shownRoute) return;
    pickPlace(place);
  };

  // Stable, so the card's outside-touch listener isn't re-attached every render.
  const closePinCard = useCallback(() => setActivePinId(null), []);

  const openPin = (id: string) => {
    const pin = pins.find((p) => p.id === id);
    if (!pin) return;
    setPreview(null);
    setActivePinId(id);
    // Into the middle of the map at the current zoom; its card opens just above it.
    mapRef.current?.centerOn(pin.place.center, PIN_CARD_DROP_PX);
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
  const handoffStroke = useRouteStrokes({
    on: routeMode,
    mapEl,
    mapRef,
    busy: !!building || !!editing,
    showing: !!shownRouteId,
    onStart: (pin) => {
      setShownRouteId(null);
      setActivePinId(null);
      buildMethod.current = 'drag';
      setBuilding([pin]);
    },
    onCross: (id) => setBuilding((b) => (b && !b.includes(id) && b.length < COURSE_LIMITS.maxStops ? [...b, id] : b)),
    onLetGo: () => setShownRouteId(null),
    onClose: () => setRailMode('menu'),
  });

  // With 핀's category list out, a quick tap on bare map (not a pan, a long
  // press or a marker) closes it back to just 핀 · 경로; the categories
  // picked stay picked. A tap that closes a pin card or place card does only that.
  const pinsListOpen = onPinHome && railMode === 'pins' && !searchOpen;
  useBareMapTap(pinsListOpen, mapEl, !!activePinId || !!preview, () => setRailMode('menu'));

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
    arrival.replay();
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

  // The camera screen, and the shot it sends to TODAY and the groups picked.
  const camera = useCameraShot({
    here: me?.center ?? null,
    excluded: privacy.excluded,
    searchService,
    pins: pinStore.pins,
    sendPhoto: groups.sendPhoto,
    notify,
  });

  // Android's back button closes one layer at a time, innermost first.
  useBackButton(() => {
    if (closeTopDialog()) return true;
    if (camera.open) return camera.close(), true;
    if (gallerySeq !== null) return setGallerySeq(null), true;
    if (galleryTab) return closeGallery(), true;
    if (calendarPhoto) return setCalendarPhoto(null), true;
    if (groupCalendar) return setGroupCalendar(false), true;
    if (studio) return setStudio(null), true;
    if (chatPhoto !== null) return setChatPhoto(null), true;
    if (chatsGroupId) return setChatsGroupId(null), true;
    if (chatsOpen) return setChatsOpen(false), true;
    if (groupChat) return setGroupChat(false), true;
    if (groupPhotoBig) return setGroupPhotoBig(false), true;
    if (groupBoard.active) return groupBoard.putAway(), true;
    if (boardOn) return setBoardOn(false), true;
    if (openGroupId) return setOpenGroupId(null), true;
    if (todayPhotoBig) return setTodayPhotoBig(false), true;
    if (todayPhoto !== null) return setTodayPhoto(null), true;
    if (placePhoto !== null) return setPlacePhoto(null), true;
    // TODAY's month goes back to TODAY; TODAY itself back to the list.
    if (todayOpen && calendarMode === 'month') return calendarTo('today'), true;
    if (todayOpen) return setTodayOpen(false), true;
    if (searchOpen) return setSearchOpen(false), setQuery(''), searchInput.current?.blur(), true;
    if (preview) return setPreview(null), true;
    if (activePinId) return setActivePinId(null), true;
    if (sharedCourse) return dismissCourse(), true;
    if (editing) return setEditing(null), true;
    if (building) return setBuilding(null), true;
    if (shownRouteId) return setShownRouteId(null), true;
    if (railMode !== 'menu') return railAction(railMode), true;
    if (tab !== 'people') return changeTab('people'), true;
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
  // nearby icons name the point immediately. Address lookups fill empty spots,
  // one at a time, without ever showing a reply for an earlier camera position.
  const aimable = tab === 'pins' && !onPage && !routeMode && !searchOpen && !preview && !activePinId;
  const aim = usePanAim({ on: aimable, searchService, mapEl, mapEvents, nearby: nearbyContext });
  useEffect(() => {
    aim.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearbyPlaces, viewport]);

  // We Now's list is home. The map, or a group or TODAY open on We Now, pushes
  // a history entry so the browser's back comes home first; leaving some
  // other way takes that entry back off, so back at home leaves the app.
  const awayFromHome = tab === 'pins' || Boolean(openGroup) || todayOpen;
  useHomeHistory(awayFromHome, tab, {
    // A photo open big on TODAY goes first, then its panel; TODAY stays.
    inner: () => {
      if (todayPhotoBig) return setTodayPhotoBig(false), true;
      if (todayPhoto !== null) return setTodayPhoto(null), true;
      return false;
    },
    home: () => {
      if (openGroup || todayOpen) {
        setOpenGroupId(null);
        setTodayOpen(false);
        return;
      }
      changeTab('people');
    },
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
  const calendarTo = (type: CalendarCommand['type']) => setCalendarCommand((c) => ({ type, seq: (c?.seq ?? 0) + 1 }));
  const calendarButton = () => calendarTo(calendarAgain(calendarMode));
  // The calendars a calendar's name switches between: MY (TODAY's month), then my groups.
  const calendars = useMemo(() => [{ id: 'my', name: 'MY' }, ...groupList.map((g) => ({ id: g.id, name: g.name }))], [groupList]);
  const switchCalendar = (id: string) => {
    if (id === 'my') {
      setGroupCalendar(false);
      setOpenGroupId(null);
      setTodayStart('month');
      setTodayOpen(true);
      return;
    }
    setTodayOpen(false);
    if (id === openGroupId) return setGroupCalendar(true);
    calendarOnOpen.current = true;
    setOpenGroupId(id);
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

  // The route being made, as it's drawn: the shapes and line styles picked so far.
  const builtLook = buildPins ? buildRouteLook(buildPins.map((p) => p.id), buildLook) : null;

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
          onLocate={() => void locateMe()}
          locating={location.busy}
          locationOn={location.enabled && !location.error}
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
          edgeStyles={builtLook ? builtLook.edgeStyles : editRoute ? editRoute.look.edgeStyles : shownRoute?.edgeStyles}
          stopShapes={builtLook ? builtLook.stopShapes : editRoute ? editRoute.look.stopShapes : shownRoute?.stopShapes}
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
                  arrival.keepPinsOff();
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
          stopShapes={builtLook?.stopShapes}
          edgeStyles={builtLook?.edgeStyles}
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

      {preview && !searchOpen && previewAddress.ready && (
        <NewPinCard
          key={preview.id}
          place={preview}
          address={previewAddress.address}
          categories={categories}
          photos={previewPhotos}
          onOpenPhoto={setPlacePhoto}
          onOpenGallery={() => openGallery('my', preview.name)}
          onSave={confirmNewPin}
          onClose={closeNewPin}
        />
      )}

      {activePin && !preview && !searchOpen && onPinHome && activePinAddress.ready && (
        <PinCard
          pin={activePin}
          address={activePinAddress.address}
          categories={categories}
          photos={activePinPhotos}
          onOpenPhoto={setPlacePhoto}
          onOpenGallery={() => openGallery('my', activePin.place.name)}
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

      {/* A card's photo big: oldest to newest, the newest on the right as in the gallery. */}
      {placePhoto !== null && cardPlace && cardPhotos[placePhoto] && (
        <PhotoViewer
          items={[...cardPhotos].reverse().map((p) => ({
            photo: p.url,
            name: cardPlace.name,
            who: timeKey(new Date(p.at)),
            face: null,
            date: galleryDayLabel(dateKey(new Date(p.at)), dateKey()),
          }))}
          seq={cardPhotos.length - 1 - placePhoto}
          onSeq={(seq) => setPlacePhoto(cardPhotos.length - 1 - seq)}
          onClose={() => setPlacePhoto(null)}
          prevLabel="이전 사진"
          nextLabel="다음 사진"
          counted={false}
          // Just the photo: no 💬 or ★ here, and no ‹ › either (paging is by drag and the arrow keys).
          side={false}
        />
      )}

      {onPage ? (
        <section
          className="page"
          aria-label={PAGE_TITLES[tab]}
          style={swipe.style}
          {...swipe.handlers}
        >
          {/* No head bar: TODAY's own heading takes the stage, and We Now shows
              no title (named for screen readers only). */}
          <h1 className="sr-only">{PAGE_TITLES[tab]}</h1>
          {tab === 'people' && (!todayOpen || todaySwipe.moving) && (
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
              onReorder={reorderGroups}
              onCreate={() => setGroupFormOpen(true)}
              onSignIn={account.signIn}
              onRetry={() => (account.user || needLogin ? groups.refresh() : startGuest())}
            />
          )}
        </section>
      ) : null}

      {onPage && calendarZoom && (
        <section
          className="page"
          aria-label="TODAY"
          style={todaySwipe.style}
          {...todaySwipe.handlers}
        >
          <DayPattern pattern={dayPattern} accent={dayPatternAccent(livePageTheme)} />
          <CalendarZoom
            command={calendarCommand}
            nameAt={async (center) => (await searchService?.reverse(center)) ?? null}
            onToast={notify}
            excluded={privacy.excluded}
            here={me?.center ?? null}
            pins={pinStore.pins}
            categories={pinStore.categories}
            onDecorating={setDecorating}
            onPingPicked={(remove) => setPingRemove(() => remove)}
            pingDropZone={() => barEl.current?.querySelector('.bar-cal') ?? null}
            onPingDropHover={setPingDropHot}
            onDayPattern={setDayPattern}
            onDayTheme={setLivePageTheme}
            onMode={setCalendarMode}
            photoPick={todayPhoto}
            onPhotoPick={setTodayPhoto}
            photoBig={todayPhotoBig}
            onPhotoBig={setTodayPhotoBig}
            startMode={todayStart}
            calendars={calendars}
            onCalendar={switchCalendar}
            onPhotos={setCalendarPhoto}
          />
          {/* On the month it goes back to TODAY; on TODAY, to the list. */}
          <button
            className="today-back"
            aria-label={calendarMode === 'month' ? 'TODAY로' : '그룹 목록으로'}
            onClick={() => (calendarMode === 'month' ? calendarTo('today') : setTodayOpen(false))}
          >
            <ChevronLeft size={24} strokeWidth={2.2} />
          </button>
        </section>
      )}

      {openGroup && (
        <div className="theme-scope" data-theme={openGroup.coverOverride?.swatch}>
          <GroupAtlas
            marks={groupMarks}
            lines={groupLines}
            handle={atlasRef}
            rootRef={atlasEl}
            board={groupBoard.layers}
            lock={groupBoard.tool ? (groupBoard.tool === 'pen' ? 'pen' : 'pieces') : null}
          />
          {myGroupRow && (
            <GroupLookLayer rootRef={atlasEl} me={myGroupRow.userId} pings={myGroupRow.pings} looks={looksOf(myGroupRow)} onLook={setGroupLook} />
          )}
          <GroupMapView
            group={openGroup}
            picked={groupPicked}
            me={myId}
            // Mine never: my own pings aren't news to me.
            day={groupDay}
            onDay={(day) => setGroupDay(day >= dateKey() ? null : day)}
            newPings={(m) => (m.userId === myId || groupDay ? 0 : newMemberPings(m, memberSeen[memberSeenKey(openGroup.id, m.userId)]))}
            onPick={setGroupPicked}
            place={groupPing}
            onPlace={setGroupPing}
            photoBig={groupPhotoBig}
            onPhotoBig={setGroupPhotoBig}
            onBack={() => setOpenGroupId(null)}
            onSettings={() => setGroupSettingsOpen(true)}
            onCalendar={() => setGroupCalendar(true)}
            onGallery={() => openGallery(openGroup.id)}
            onChat={() => setGroupChat(true)}
            chatUnread={unreadTalk.counts[openGroup.id] ?? 0}
            onCamera={() => camera.openFrom(openGroup.id)}
            onDelete={setPlaceDeleting}
            decorOn={boardOn}
            onDecor={() => setBoardOn((on) => !on)}
            decorTools={boardOn ? groupBoard.tools : null}
          />
          {groupBoard.tray}
        </div>
      )}

      {groupChat && openGroup && (
        <GroupChat group={openGroup} me={myId} photoSeq={chatPhoto} onPhotoSeq={setChatPhoto} onClose={() => setGroupChat(false)} onRead={unreadTalk.refresh} />
      )}

      {chatsOpen && (
        <ChatList
          groups={groupList}
          unread={unreadTalk.counts}
          covered={!!chatsGroup}
          onOpen={(id) => {
            setChatPhoto(null);
            setChatsGroupId(id);
          }}
          onClose={() => setChatsOpen(false)}
        />
      )}
      {chatsGroup && (
        <GroupChat
          group={chatsGroup}
          me={myId}
          photoSeq={chatPhoto}
          onPhotoSeq={setChatPhoto}
          onRead={unreadTalk.refresh}
          onClose={() => {
            setChatPhoto(null);
            setChatsGroupId(null);
          }}
        />
      )}

      {groupCalendar && openGroup && (
        <GroupCalendar
          key={openGroup.id}
          group={openGroup}
          user={account.user}
          me={myId}
          myDays={myPingDays}
          day={groupDay ?? dateKey()}
          onPick={(day) => {
            setGroupDay(day >= dateKey() ? null : day);
            setGroupCalendar(false);
          }}
          onClose={() => setGroupCalendar(false)}
          calendars={calendars}
          onCalendar={switchCalendar}
          onPhotos={setCalendarPhoto}
        />
      )}

      {calendarPhoto && calendarPhoto.photos[calendarPhoto.seq] && (
        // As the big photo where it came from: 💬 and ★ everywhere; a group's also ♥ (not on mine) and doodles in my colour there.
        <PhotoViewer
          items={calendarPhoto.photos}
          seq={calendarPhoto.seq}
          onSeq={(seq) => setCalendarPhoto((p) => (p ? { ...p, seq } : p))}
          onClose={() => setCalendarPhoto(null)}
          prevLabel="이전 사진"
          nextLabel="다음 사진"
          counted={false}
          commentPath={calendarPhoto.photos[calendarPhoto.seq].path}
          decorPath={calendarPhoto.group ? calendarPhoto.photos[calendarPhoto.seq].path : undefined}
          decorColor={calendarPhoto.group?.decorColor}
          inkOf={calendarPhoto.group?.inkOf}
          side={
            <OpenPhotoMarks
              path={calendarPhoto.photos[calendarPhoto.seq].path}
              heart={calendarPhoto.photos[calendarPhoto.seq].heart}
              hearts={!!calendarPhoto.group}
            />
          }
        />
      )}

      {galleryTab && (
        <PhotoGallery
          groups={groupList}
          me={myId}
          meMember={myMember}
          tab={galleryTab}
          onTab={(to) => openGallery(to)}
          state={gallery.state}
          onRetry={gallery.retry}
          local={galleryLocal}
          visited={visitedNames}
          place={galleryPlace}
          seq={gallerySeq}
          onSeq={setGallerySeq}
          onClose={closeGallery}
        />
      )}

      {groupFormOpen && (
        <GroupFormDialog
          onSubmit={async (name, cover, slug, photo, swatch) => {
            const made = await groups.create(name, cover, slug, swatch);
            if (!made) return false;
            // The cover photo goes up once the group is there; the group stands even if it doesn't.
            if (photo && !(await groups.setCover(made.id, cover, photo, swatch))) return notify('그룹을 만들었어요. 표지 사진은 올리지 못했어요.'), true;
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
          onCover={(cover, photo, swatch) => groups.setCover(openGroup.id, cover, photo, swatch)}
          coverOverride={openGroup.coverOverride ?? null}
          onMyCover={(override) => setMyCover(openGroup.id, override)}
          onResetMyCover={() => setMyCover(openGroup.id, null)}
          me={myId}
          onKick={setKicking}
          onColor={(color) => groups.setColor(openGroup.id, color)}
          onProfile={(own, alias, photo) => groups.setProfile(openGroup.id, own, alias, photo)}
          profileNickname={getDisplayName().trim()}
          profilePhoto={profile.photo ?? null}
          onDelete={() => setGroupDeleting(true)}
          onLeave={() => setGroupLeaving(true)}
          onClose={() => setGroupSettingsOpen(false)}
        />
      )}

      {placeDeleting && openGroup && groupPing && (
        <ConfirmDialog
          label={placeDeleting === 'photo' ? '사진 삭제' : '핀 삭제'}
          message={placeDeleting === 'photo' ? '이 사진을 삭제합니다.' : '이 핀을 삭제합니다.'}
          detail={
            placeDeleting === 'photo'
              ? `'${openGroup.name}' 그룹에서만 삭제돼요.\n삭제한 사진은 복구할 수 없어요.`
              : `이 장소의 사진도 모두 '${openGroup.name}' 그룹에서 삭제돼요.\nTODAY와 다른 그룹에는 남아요.`
          }
          confirmLabel="삭제"
          onConfirm={() => void deleteFromGroup(placeDeleting)}
          onClose={() => setPlaceDeleting(null)}
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

      {aimable && <AimCross on={aim.aiming} name={aim.name} />}

      <div
        ref={barEl}
        className={`bottom-bar-wrap ${onPage ? 'bottom-bar-wrap--over' : ''} ${barAway ? 'is-away' : ''} ${barGone ? 'is-gone' : ''}`}
        inert={barAway || barGone}
      >
        <BottomBar
          tab={pageMoving && swipeTarget ? swipeTarget : tab}
          calendarMode={calendarMode}
          today={calendarZoom && !todaySwipe.leaving}
          onCalendar={calendarButton}
          onDeletePing={onPage && calendarZoom && calendarMode === 'day' && pingRemove ? pingRemove : undefined}
          deleteHot={pingDropHot}
          onMap={() => changeTab('pins')}
          onPin={startPinning}
          onPeople={() => changeTab('people')}
          onCamera={() => camera.openFrom(null)}
          onGallery={() => openGallery('my')}
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

      {incomingCategory.status === 'ready' && !incomingCategory.opened.mine && (
        <SharedCategoryDialog
          sender={incomingCategory.opened.owner.nickname || '익명'}
          photo={incomingCategory.opened.owner.photo}
          category={incomingCategory.opened.snapshot.category}
          places={incomingCategory.opened.snapshot.places.length}
          already={incomingFollowed}
          onSubscribe={followCategory}
          onClose={dismissCategory}
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
      {camera.open && (
        <CameraScreen
          onSend={(photo, takenAt) => {
            groups.refresh();
            camera.take(photo, takenAt);
          }}
          onClose={camera.close}
        />
      )}
      {camera.open && camera.shot && (
        <GroupSendDialog
          groups={groupList}
          status={groups.status}
          places={camera.spots.places}
          placeProblem={camera.spots.problem}
          startGroupId={camera.groupId}
          onSend={camera.send}
          onClose={camera.dropShot}
        />
      )}
      {settingsOpen && (
        <SettingsScreen
          location={location}
          profile={profile}
          onChange={changeProfile}
          account={account}
          privacy={privacyProps}
          groups={groupList}
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
          onDelete={(id) => {
            pinStore.deleteCategory(id);
            unfollowCategory(id);
          }}
          onPickPin={pickListedPin}
          sharing={categorySharing}
        />
      )}

      <ToastBar toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
