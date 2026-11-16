import type { GroupLine } from '../components/GroupLines';
import { edgeLookKey, memberColor, photoPings, pingLookKey, pingPhotos, sharedPlaces, type Group, type GroupLooks, type GroupMember, type SharedPlace } from '../domain/groups';
import type { GroupPingMark } from './courseMap';

/** The ping tapped on a group's map (and, on a stack of photos, which photo). */
type TappedPing = { member: string; seq: number; photo?: number } | null;

/**
 * An open group's map: every member's pings (their latest as their face), the
 * picked member's over the rest, everyone else stepping back; every photo as
 * its ping's head (`photoPings`), the tapped ping marked for the panel.
 * A place two or more members pinged is one aurora ping at one spot
 * (`sharedPlaces`): whoever is there now in a row over it, and over them
 * every photo sent from there by anyone, in the order they were taken.
 * Each member's own ping there stays as an invisible point under it, where
 * their lines meet.
 */
export function buildGroupMarks(
  group: Group,
  picked: string | null,
  tapped: TappedPing,
  looksOf: (member: GroupMember) => GroupLooks | undefined,
): GroupPingMark[] {
  const isTapped = (member: string, seq: number) => tapped?.member === member && tapped.seq === seq;
  const shared = new Map<string, { place: SharedPlace; lead: boolean }>();
  for (const place of sharedPlaces(group.members)) {
    place.pings.forEach(({ member, seq }, k) => shared.set(`${member.userId}|${seq}`, { place, lead: k === 0 }));
  }
  const placeMark = (place: SharedPlace): GroupPingMark => {
    const first = place.pings[0];
    const inIt = place.pings.find((p) => p.member.userId === picked);
    const photos = place.pings
      .flatMap(({ member, seq }) => {
        const ping = member.pings[seq];
        const urls = pingPhotos(ping);
        const ats = ping.photoAts ?? urls.map(() => ping.at);
        return urls.map((url, photo) => ({ url, at: ats[photo] ?? ping.at, of: { member: member.userId, seq, photo } }));
      })
      .sort((a, b) => a.at.localeCompare(b.at));
    const hit = place.pings.find((p) => isTapped(p.member.userId, p.seq));
    // The tapped photo, or (from the pin or a face) that ping's newest.
    const hitPhoto = hit && (tapped?.photo ?? pingPhotos(hit.member.pings[hit.seq]).length - 1);
    const selectedPhoto = hit ? photos.findIndex((p) => p.of.member === hit.member.userId && p.of.seq === hit.seq && p.of.photo === hitPhoto) : -1;
    return {
      member: first.member.userId,
      seq: first.seq,
      center: place.center,
      color: memberColor(first.member.color),
      together: true,
      faded: !!picked && !inIt,
      label: inIt ? inIt.member.pings[inIt.seq].name : undefined,
      faces: place.pings
        .filter(({ member, seq }) => seq === member.pings.length - 1)
        .map(({ member, seq }) => ({ member: member.userId, seq, color: memberColor(member.color), photo: member.photo })),
      photos: photos.length ? photos.map((p) => p.url) : undefined,
      photoOf: photos.length ? photos.map((p) => p.of) : undefined,
      selected: !!hit,
      selectedPhoto: selectedPhoto >= 0 ? selectedPhoto : undefined,
    };
  };
  return group.members.flatMap((m) => {
    const photos = photoPings(m);
    return m.pings.map((p, i): GroupPingMark => {
      const at = shared.get(`${m.userId}|${i}`);
      if (at?.lead) return placeMark(at.place);
      if (at) return { member: m.userId, seq: i, center: at.place.center, color: memberColor(m.color), ghost: true };
      return {
        member: m.userId,
        seq: i,
        center: p.center,
        color: memberColor(m.color),
        face: i === m.pings.length - 1 ? { photo: m.photo } : undefined,
        faded: !!picked && picked !== m.userId,
        // The picked member's places by name; nobody's while ALL.
        label: picked === m.userId ? p.name : undefined,
        photos: photos.has(i) ? pingPhotos(p) : undefined,
        // Not on a face: their latest stays their face.
        shape: i === m.pings.length - 1 ? undefined : looksOf(m)?.pings[pingLookKey(p)],
        selected: isTapped(m.userId, i),
        selectedPhoto: isTapped(m.userId, i) ? tapped?.photo : undefined,
      };
    });
  });
}

/** The line through each member's day, in their colour and the styles they gave its stretches. */
export function buildGroupLines(
  group: Group | null,
  picked: string | null,
  looksOf: (member: GroupMember) => GroupLooks | undefined,
): GroupLine[] {
  return (group?.members ?? [])
    .filter((m) => m.pings.length > 1)
    .map((m) => {
      const edges = looksOf(m)?.edges;
      return {
        member: m.userId,
        color: memberColor(m.color),
        count: m.pings.length,
        faded: !!picked && picked !== m.userId,
        styles: edges ? m.pings.slice(1).map((p, k) => edges[edgeLookKey(m.pings[k], p)]) : undefined,
      };
    });
}
