import { useCallback, useMemo, useState } from 'react';
import { orderGroups, photoPlaces, withCoverOverrides, withoutPhotos, type Group, type GroupCoverOverride } from '../domain/groups';
import { getDisplayName } from '../lib/currentUser';
import { loadGroupCoverOverrides, saveGroupCoverOverride } from '../services/groupCoverOverrideRepository';
import { loadGroupOrder, saveGroupOrder } from '../services/groupOrderRepository';

/**
 * My groups as every screen lists them: in the order I dragged them into,
 * each under my own cover for it, and my own place in each wearing this
 * phone's photo and nickname (the server's copy lags behind).
 * Only the photos sent to a group make places (a TODAY ping alone never
 * does); photo after photo at one place in a row is one place, stacked.
 */
export function useGroupList(groups: Group[], myId: string | null, myPhoto: string | null | undefined) {
  // Photos I just deleted from a group (until the next read drops them).
  const [goneShots, setGoneShots] = useState<ReadonlySet<string>>(() => new Set());
  // The order I dragged the groups into on We Now (this phone only): everywhere they're listed.
  const [groupOrder, setGroupOrder] = useState<string[]>(loadGroupOrder);
  // My own look for a group's cover (shape + colour swatch), this phone only — never the maker's.
  const [coverOverrides, setCoverOverrides] = useState(loadGroupCoverOverrides);
  const groupList = useMemo(
    () =>
      withCoverOverrides(
        orderGroups(groups, groupOrder).map((g) => ({
          ...g,
          members: g.members.map((m) =>
            m.userId === myId
              ? {
                  ...m,
                  // 통합 프로필: this phone's photo and nickname (fresher than the server's); 개별: the group's own.
                  ...(m.ownProfile ? {} : { photo: myPhoto ?? m.photo, nickname: m.alias ?? (getDisplayName().trim() || m.nickname) }),
                  pings: photoPlaces(withoutPhotos(m.pings, goneShots)),
                }
              : { ...m, pings: photoPlaces(m.pings) },
          ),
        })),
        coverOverrides,
      ),
    [groups, groupOrder, myId, myPhoto, goneShots, coverOverrides],
  );
  return {
    groupList,
    goneShots,
    markGone: useCallback((paths: string[]) => setGoneShots((before) => new Set([...before, ...paths])), []),
    reorderGroups: (ids: string[]) => {
      setGroupOrder(ids);
      saveGroupOrder(ids);
    },
    setMyCover: (groupId: string, override: GroupCoverOverride | null) => {
      setCoverOverrides((all) => saveGroupCoverOverride(all, groupId, override));
    },
  };
}
