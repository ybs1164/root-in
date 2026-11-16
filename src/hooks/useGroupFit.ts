import { useEffect, useRef, type RefObject } from 'react';
import type { AtlasHandle } from '../components/GroupAtlas';
import type { GroupPlace } from '../components/GroupMapView';
import { focusPoints, type Group } from '../domain/groups';
import { STEP_GLIDE_MS } from '../lib/mapPadding';
import { markKey } from './useAtlas';

/** The top of a group's map held by ‹, the name and ⚙: a tapped ping is centred below it (or below its photo panel). */
const GROUP_TITLE_PX = 120;

interface GroupFit {
  openGroup: Group | null;
  picked: string | null;
  ping: GroupPlace | null;
  day: string | null;
  atlasRef: RefObject<AtlasHandle | null>;
  atlasEl: RefObject<HTMLElement | null>;
}

/** Opening a group fits all of it; picking someone brings the map in close on their day. */
export function useGroupFit({ openGroup, picked, ping: tapped, day, atlasRef, atlasEl }: GroupFit): void {
  const fitted = useRef<{ group: string; picked: string | null } | null>(null);
  const fitKey = openGroup ? `${openGroup.id}|${day ?? ''}|${picked ?? ''}|${focusPoints(openGroup, picked).length}|${tapped ? `${tapped.member}:${tapped.seq}` : ''}` : '';
  useEffect(() => {
    if (!openGroup || !atlasRef.current) return;
    const shown = picked ? openGroup.members.filter((m) => m.userId === picked) : openGroup.members;
    const keys = shown.flatMap((m) => m.pings.map((_, i) => markKey(m.userId, i)));
    if (keys.length === 0) return;
    const el = atlasEl.current;
    const width = el?.clientWidth ?? window.innerWidth;
    // Under the title, over the member row along the bottom (and the picked
    // member's pass over it), clear of the < > at the sides.
    const side = width < 520 ? 76 : 96;
    // (The row sits over the 대화 button, 64px higher than it did.)
    const padding = { top: 150, right: side, bottom: picked ? 344 : 204, left: side };
    // Like a route: the first move onto someone (from ALL, or opening the
    // group) glides at the usual pace; going on from one member to the next
    // is as quick as stepping between routes with < >.
    const last = fitted.current;
    const memberToMember = !!last && last.group === openGroup.id && !!last.picked && !!picked;
    fitted.current = { group: openGroup.id, picked };
    const id = requestAnimationFrame(() => {
      // A tapped ping: it (with its photo head or face, measured off the
      // marker) in the middle of the room between the photo panel under the
      // title and the member's pass, not the member's whole day.
      const ping = tapped && openGroup.members.find((m) => m.userId === tapped.member)?.pings[tapped.seq];
      const marker = ping && document.querySelector<HTMLElement>('.group-ping.is-selected');
      const box = el?.getBoundingClientRect();
      if (ping && marker && box) {
        const at = marker.getBoundingClientRect().top;
        const head = Math.min(at, ...[...marker.children].map((c) => c.getBoundingClientRect().top));
        const above = document.querySelector('.group-photo-panel')?.getBoundingClientRect().bottom ?? box.top + GROUP_TITLE_PX;
        const below = document.querySelector('.member-pass, .group-rail')?.getBoundingClientRect().top ?? box.bottom;
        return atlasRef.current?.focus(markKey(tapped.member, tapped.seq), { top: above - box.top + (at - head) + 12, right: 0, bottom: Math.max(0, box.bottom - below), left: 0 });
      }
      atlasRef.current?.fit(keys, padding, memberToMember ? STEP_GLIDE_MS : undefined);
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);
  useEffect(() => {
    if (!openGroup) fitted.current = null;
  }, [openGroup]);
}
