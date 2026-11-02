/**
 * The group atlas on its own (dev only, tools/group-atlas/index.html on the
 * dev server): an example group's day across nine regions of Korea — or a
 * 수도권 day with `?day=metro` — drawn by the app's own `GroupAtlas`, with the
 * member row reduced to buttons. For trying the drag, pinch, wheel zoom and
 * the fits without signing in to a group (docs/plan-group-atlas.md).
 */

import { useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import GroupAtlas, { type AtlasHandle } from '../components/GroupAtlas';
import type { GroupLine } from '../components/GroupLines';
import { memberColor } from '../domain/groups';
import { markKey } from '../hooks/useAtlas';
import type { GroupPingMark } from '../map/courseMap';
import '../styles.css';

type Walk = { name: string; places: [string, number, number][] };

const NATION: Walk[] = [
  { name: '민수', places: [['어니언 성수', 127.0582, 37.5447], ['대림창고', 127.0539, 37.5418], ['서울숲', 127.0374, 37.5444], ['해운대 해수욕장', 129.1604, 35.1587], ['해리단길', 129.164, 35.162]] },
  { name: '지은', places: [['성심당', 127.4273, 36.3277], ['대전역', 127.4344, 36.3323], ['엑스포 다리', 127.3874, 36.3755], ['전주 한옥마을', 127.153, 35.815], ['전주역', 127.161, 35.8495]] },
  { name: '하준', places: [['양림동', 126.914, 35.1395], ['동명동 카페', 126.9255, 35.1475], ['동성로', 128.596, 35.869], ['김광석길', 128.606, 35.8605]] },
  { name: '서연', places: [['동문시장', 126.527, 33.512], ['이호테우 해변', 126.453, 33.498], ['제주공항', 126.493, 33.507]] },
  { name: '도윤', places: [['센트럴파크', 126.639, 37.3925], ['트라이볼', 126.6345, 37.3935]] },
  { name: '유나', places: [['중앙시장', 128.899, 37.7545], ['경포대', 128.908, 37.7955], ['안목해변', 128.9475, 37.7725]] },
];

const METRO: Walk[] = [
  { name: '민수', places: [['어니언 성수', 127.0582, 37.5447], ['서울숲', 127.0374, 37.5444], ['판교역', 127.1112, 37.3925], ['판교 카페거리', 127.103, 37.396]] },
  { name: '지은', places: [['홍대입구', 126.9237, 37.5572], ['연남동', 126.9245, 37.562], ['일산 호수공원', 126.77, 37.658]] },
  { name: '하준', places: [['행궁동', 127.013, 37.282], ['수원 화성', 127.018, 37.287]] },
  { name: '서연', places: [['송도 센트럴파크', 126.639, 37.3925], ['부천역', 126.783, 37.484]] },
  { name: '도윤', places: [['부대찌개 거리', 127.047, 37.738], ['대림창고', 127.0539, 37.5418]] },
  { name: '유나', places: [['연남 철길', 126.922, 37.56], ['상동 호수공원', 126.753, 37.505]] },
];

const PAD = { top: 150, right: 76, bottom: 197, left: 76 };

function Preview() {
  const walks = new URLSearchParams(location.search).get('day') === 'metro' ? METRO : NATION;
  const [picked, setPicked] = useState<number | null>(null);
  const atlas = useRef<AtlasHandle | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  const marks = useMemo<GroupPingMark[]>(
    () =>
      walks.flatMap((w, m) =>
        w.places.map(([name, lng, lat], seq) => ({
          member: `m${m}`,
          seq,
          center: [lng, lat] as [number, number],
          color: memberColor(m),
          face: seq === w.places.length - 1 ? { photo: null } : undefined,
          faded: picked !== null && picked !== m,
          label: picked === m ? name : undefined,
        })),
      ),
    [walks, picked],
  );
  const lines = useMemo<GroupLine[]>(
    () => walks.map((w, m) => ({ member: `m${m}`, color: memberColor(m), count: w.places.length, faded: picked !== null && picked !== m })),
    [walks, picked],
  );
  const pick = (m: number | null) => {
    setPicked(m);
    const shown = m === null ? walks.map((_, i) => i) : [m];
    atlas.current?.fit(shown.flatMap((i) => walks[i].places.map((_, seq) => markKey(`m${i}`, seq))), { ...PAD, bottom: m === null ? 197 : 337 });
  };
  return (
    <>
      <GroupAtlas marks={marks} lines={lines} handle={atlas} rootRef={root} />
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 'calc(28px + env(safe-area-inset-bottom))', display: 'flex', gap: 8, justifyContent: 'center', zIndex: 5 }}>
        <button className="group-view__btn" style={{ position: 'static' }} onClick={() => pick(null)} aria-pressed={picked === null}>
          ALL
        </button>
        {walks.map((w, m) => (
          <button key={w.name} className="group-view__btn" style={{ position: 'static', boxShadow: `0 0 0 3px ${memberColor(m)}` }} onClick={() => pick(picked === m ? null : m)} aria-pressed={picked === m}>
            {w.name}
          </button>
        ))}
      </div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Preview />);
