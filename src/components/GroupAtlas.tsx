import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, type Ref, type RefObject } from 'react';
import { clampView, fitView, zoomAbout, type AtlasView, type Room } from '../domain/atlas';
import { createGroupPingElement, type GroupPingMark } from '../map/courseMap';
import { markKey, useAtlas } from '../hooks/useAtlas';
import MiniMap from './MiniMap';
import GroupLines, { type GroupLine } from './GroupLines';

export interface AtlasHandle {
  /** Glide to these marks (`member|seq`), clear of `pad` (title over them, the member row under). */
  fit(keys: string[], pad: Room, glideMs?: number): void;
  /** Glide one mark into the middle of the screen less `pad`, at least a little zoomed in. */
  focus(key: string, pad: Room): void;
}

/** Under the title, over the member row: what dragging keeps the canvas around. */
const ROOM_TOP = 100;
const ROOM_BOTTOM = 120;
const GLIDE_MS = 500;
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

/**
 * We Now's group map as an atlas (docs/plan-group-atlas.md): a faint Korea,
 * one TODAY-style island per region, the members' pings over them. One
 * finger drags, two pinch (a wheel or a trackpad zooms on a computer), a
 * flick glides on. The ground (Korea and the islands) is one layer moved and
 * scaled by a transform alone; the pings are the same markers the real map
 * draws, kept their own size and moved to their spots every change, so the
 * lines (`GroupLines`), the photo panel's thread and the taps that find them
 * on screen work as they did. Taps are App's (it hears them on `rootRef`).
 */
export default function GroupAtlas({ marks, lines, handle, rootRef }: { marks: GroupPingMark[]; lines: GroupLine[]; handle: Ref<AtlasHandle>; rootRef: RefObject<HTMLDivElement | null> }) {
  const atlas = useAtlas(marks);
  const root = useRef<HTMLDivElement | null>(null);
  const ground = useRef<HTMLDivElement>(null);
  const pins = useRef<HTMLDivElement>(null);
  const names = useRef<HTMLDivElement>(null);
  const view = useRef<AtlasView | null>(null);
  const glide = useRef(0);
  const { width, height } = atlas.plan;
  // A leg from one island to another crosses the country, not a street: dotted.
  const legs = useMemo(
    () =>
      lines.map((line) => ({
        ...line,
        jumps: Array.from({ length: Math.max(0, line.count - 1) }, (_, k) => atlas.islandOf.get(markKey(line.member, k)) !== atlas.islandOf.get(markKey(line.member, k + 1))),
      })),
    [lines, atlas.islandOf],
  );

  const room = useCallback((): Room => {
    const el = root.current;
    return { left: 0, top: ROOM_TOP, right: el?.clientWidth ?? window.innerWidth, bottom: (el?.clientHeight ?? window.innerHeight) - ROOM_BOTTOM };
  }, []);

  /** Moves the ground and every pin and name to the view (no React render: this runs every frame of a drag). */
  const paint = useCallback(() => {
    const v = view.current;
    if (!v) return;
    if (ground.current) ground.current.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.zoom})`;
    for (const layer of [pins.current, names.current]) {
      for (const el of layer?.children ?? []) {
        const node = el as HTMLElement;
        const x = Number(node.dataset.x) * v.zoom + v.x;
        const y = Number(node.dataset.y) * v.zoom + v.y;
        node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      }
    }
  }, []);

  const show = useCallback(
    (next: AtlasView) => {
      view.current = clampView(next, width, height, room());
      paint();
    },
    [width, height, room, paint],
  );

  const stop = () => cancelAnimationFrame(glide.current);
  const glideTo = useCallback(
    (target: AtlasView, ms = GLIDE_MS) => {
      stop();
      const to = clampView(target, width, height, room());
      const from = view.current ?? to;
      // The canvas point in the middle of the screen moves evenly; the zoom eases in log space (an even push in or out).
      const r = room();
      const mid = { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 };
      const [a, b] = [from, to].map((v) => ({ x: (mid.x - v.x) / v.zoom, y: (mid.y - v.y) / v.zoom }));
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / Math.max(1, ms));
        const k = easeInOutSine(t);
        const zoom = Math.exp(Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * k);
        const c = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
        view.current = { zoom, x: mid.x - c.x * zoom, y: mid.y - c.y * zoom };
        paint();
        if (t < 1) glide.current = requestAnimationFrame(step);
      };
      glide.current = requestAnimationFrame(step);
    },
    [width, height, room, paint],
  );

  useImperativeHandle(
    handle,
    () => ({
      fit(keys, pad, glideMs) {
        const el = root.current;
        const points = keys.map((k) => atlas.spots.get(k)).filter((p) => !!p);
        const now = view.current ?? { zoom: 1, x: 0, y: 0 };
        const target = el && fitView(points, { width: el.clientWidth, height: el.clientHeight }, pad, now);
        if (target) glideTo(target, glideMs);
      },
      focus(key, pad) {
        const el = root.current;
        const p = atlas.spots.get(key);
        if (!el || !p) return;
        const now = view.current ?? { zoom: 1, x: 0, y: 0 };
        const zoom = Math.max(now.zoom, 1.2);
        const mid = { x: pad.left + (el.clientWidth - pad.left - pad.right) / 2, y: pad.top + (el.clientHeight - pad.top - pad.bottom) / 2 };
        glideTo({ zoom, x: mid.x - p.x * zoom, y: mid.y - p.y * zoom }, 420);
      },
    }),
    [atlas.spots, glideTo],
  );

  // The pins: the real map's markers, rebuilt when the marks change (picking someone fades the rest, a tap marks one).
  useLayoutEffect(() => {
    const layer = pins.current;
    if (!layer) return;
    layer.replaceChildren(
      ...marks.flatMap((mark) => {
        const at = atlas.spots.get(markKey(mark.member, mark.seq));
        if (!at) return [];
        const wrap = document.createElement('div');
        wrap.className = 'group-atlas__mark';
        wrap.dataset.x = String(at.x);
        wrap.dataset.y = String(at.y);
        // As on the real map: faces over pins, photos over those, the picked member's over the rest, the tapped one over all.
        wrap.style.zIndex = String((mark.face || mark.faces?.length ? 3 : 2) + (mark.photos?.length ? 2 : 0) + (mark.faded ? 0 : 4) + (mark.selected ? 8 : 0));
        wrap.append(createGroupPingElement(mark));
        return [wrap];
      }),
    );
    paint();
  }, [marks, atlas.spots, paint]);

  // The first view: everything in, readable (App glides from here when it fits the group).
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    if (!view.current) {
      const all = [...atlas.spots.values()];
      const start = fitView(all, { width: el.clientWidth, height: el.clientHeight }, { left: 76, right: 76, top: 150, bottom: 197 }, { zoom: 1, x: 0, y: 0 });
      view.current = start ?? { zoom: 1, x: 0, y: 0 };
    }
    show(view.current);
  });

  // Gestures: drag, pinch, wheel; a flick glides on.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const fingers = new Map<number, { x: number; y: number }>();
    let pinch: { d: number; mid: { x: number; y: number }; view: AtlasView } | null = null;
    let fling = { vx: 0, vy: 0, at: 0 };
    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const twoOf = () => {
      const [a, b] = [...fingers.values()];
      return { d: Math.hypot(b.x - a.x, b.y - a.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      stop();
      fingers.set(e.pointerId, local(e));
      fling = { vx: 0, vy: 0, at: performance.now() };
      if (fingers.size === 2 && view.current) pinch = { ...twoOf(), view: view.current };
      // Moves past the edge still reach here; a pointer that's already gone can't be captured (and needn't be).
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };
    const move = (e: PointerEvent) => {
      const last = fingers.get(e.pointerId);
      const v = view.current;
      if (!last || !v) return;
      const p = local(e);
      fingers.set(e.pointerId, p);
      if (fingers.size >= 2 && pinch) {
        const now = twoOf();
        const zoomed = zoomAbout(pinch.view, pinch.view.zoom * (now.d / pinch.d), pinch.mid);
        show({ zoom: zoomed.zoom, x: zoomed.x + now.mid.x - pinch.mid.x, y: zoomed.y + now.mid.y - pinch.mid.y });
        return;
      }
      const [dx, dy] = [p.x - last.x, p.y - last.y];
      const t = performance.now();
      const dt = Math.max(1, t - fling.at);
      // Smoothed speed (px/ms) of the last moves, for the glide after a flick.
      fling = { vx: fling.vx * 0.6 + (dx / dt) * 0.4, vy: fling.vy * 0.6 + (dy / dt) * 0.4, at: t };
      show({ ...v, x: v.x + dx, y: v.y + dy });
    };
    const up = (e: PointerEvent) => {
      if (!fingers.delete(e.pointerId)) return;
      if (fingers.size < 2) pinch = null;
      if (fingers.size || pinch) return;
      // A flick: glide on, slowing, unless the finger stopped before it lifted.
      if (performance.now() - fling.at > 80) return;
      let { vx, vy } = fling;
      const step = () => {
        const v = view.current;
        if (!v || Math.hypot(vx, vy) < 0.02) return;
        show({ ...v, x: v.x + vx * 16, y: v.y + vy * 16 });
        vx *= 0.92;
        vy *= 0.92;
        glide.current = requestAnimationFrame(step);
      };
      glide.current = requestAnimationFrame(step);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = view.current;
      if (!v) return;
      stop();
      const r = el.getBoundingClientRect();
      // A trackpad pinch comes as a ctrl+wheel in small steps; a mouse wheel in big ones.
      const k = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      show(zoomAbout(v, v.zoom * k, { x: e.clientX - r.left, y: e.clientY - r.top }));
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    const resized = new ResizeObserver(() => view.current && show(view.current));
    resized.observe(el);
    return () => {
      stop();
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
      resized.disconnect();
    };
  }, [show]);

  return (
    <div
      ref={(el) => {
        root.current = el;
        rootRef.current = el;
      }}
      className="group-atlas"
      aria-label="그룹 지도"
    >
      <div ref={ground} className="group-atlas__ground" style={{ width, height }}>
        <svg className="group-atlas__korea" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
          <path d={atlas.outline} />
        </svg>
        {atlas.islands.map((island) => (
          <div
            key={island.key}
            className="group-atlas__island"
            style={{ left: island.at.x - island.size / 2, top: island.at.y - island.size / 2, width: island.size, height: island.size }}
          >
            {island.parts.length ? <MiniMap parts={island.parts} /> : <span className="group-atlas__blob" />}
          </div>
        ))}
      </div>
      <GroupLines lines={legs} />
      <div ref={names} className="group-atlas__names" aria-hidden>
        {atlas.islands.map(
          (island) =>
            island.name && (
              <span key={island.key} className="group-atlas__name" data-x={island.at.x} data-y={island.at.y + island.size * 0.27}>
                {island.name}
              </span>
            ),
        )}
      </div>
      <div ref={pins} className="group-atlas__pins" />
    </div>
  );
}
