"""Omit lower-tier roads that leave the land between roads non-convex.

The map should read as convex blocks between roads. A dead end notches a
block, a side road can cut an L-shaped piece, and a strongly bent lane leaves
a crescent. Such roads are omitted; arterials never are.

Tiers are added one at a time (3, then 4, then 5) and only the tier being
added can be removed. Every zoom level that hides the narrower tiers then
still shows convex blocks, and a street is never dropped because of a
footpath. Blocks touching the coast, water or the analysis frame are exempt:
their shape comes from the terrain or the tile cut, not from the roads.
"""
import numpy as np
import shapely
from shapely.geometry import LineString
from shapely.ops import polygonize, unary_union
from shapely.strtree import STRtree

NEAR = 0.05  # meters; how close a noded edge must be to its source line


def _lines(geometry):
    if geometry.is_empty:
        return
    if geometry.geom_type == "LineString":
        yield geometry
    elif hasattr(geometry, "geoms"):
        for part in geometry.geoms:
            yield from _lines(part)


def _merge_through(group, through):
    """Chain pieces end to end, joining only at the given keys."""
    by_end = {}
    for i, piece in enumerate(group):
        for k in (_key(piece.coords[0]), _key(piece.coords[-1])):
            by_end.setdefault(k, []).append(i)
    used = [False] * len(group)
    out = []

    def extend(coords, i):
        while True:
            k = _key(coords[-1])
            if k not in through:
                return coords
            nxt = [j for j in by_end[k] if not used[j]]
            if not nxt:
                return coords
            j = nxt[0]
            used[j] = True
            c = list(group[j].coords)
            if _key(c[0]) != k:
                c.reverse()
            coords = coords + c[1:]

    for i, piece in enumerate(group):
        if used[i]:
            continue
        used[i] = True
        coords = extend(list(piece.coords), i)
        coords = list(reversed(extend(list(reversed(coords)), i)))
        out.append(LineString(coords))
    return out


def convexity(polygon, tolerance):
    simple = polygon.simplify(tolerance)
    hull = simple.convex_hull.area
    return simple.area / hull if hull > 0 else 1.0


def _key(point):
    return (round(point[0], 2), round(point[1], 2))


def filter_convex(roads, region, protected_tier=2, min_convexity=0.88, tolerance=5.0, max_rounds=60):
    """roads: [(tier, LineString)] in meters. region: land inside the analysis
    frame. Returns the kept roads as [(tier, LineString)] edges plus the
    untouched parts outside the region (bridges)."""
    if not roads or region.is_empty:
        return list(roads)
    source = [line for _, line in roads]
    source_tiers = np.array([tier for tier, _ in roads])
    outside = [(tier, part) for tier, line in roads for part in _lines(line.difference(region))]
    inside = [line.intersection(region) for line in source]
    boundary = region.boundary
    # Node roads with each other and with the coast/frame once; removing
    # edges later never needs re-noding.
    pieces = list(_lines(unary_union([*inside, boundary])))
    if not pieces:
        return list(roads)
    mids = shapely.line_interpolate_point(pieces, 0.5, normalized=True)
    piece_index, line_index = STRtree(source).query(mids, predicate="dwithin", distance=NEAR)
    best = np.full(len(pieces), 99)
    np.minimum.at(best, piece_index, source_tiers[line_index])
    on_boundary = shapely.dwithin(mids, boundary, NEAR)
    piece_tiers = np.where(on_boundary | (best == 99), 0, best)
    # Join pieces into junction-to-junction edges, only through points where
    # exactly two pieces of one tier meet; any real junction stays a node.
    degree = {}
    for piece in pieces:
        for k in (_key(piece.coords[0]), _key(piece.coords[-1])):
            degree[k] = degree.get(k, 0) + 1
    edges, tiers = [], []
    for tier in np.unique(piece_tiers):
        group = [pieces[i] for i in np.flatnonzero(piece_tiers == tier)]
        local = {}
        for piece in group:
            for k in (_key(piece.coords[0]), _key(piece.coords[-1])):
                local[k] = local.get(k, 0) + 1
        through = {k for k, n in local.items() if n == 2 and degree[k] == 2}
        for edge in _merge_through(group, through):
            edges.append(edge)
            tiers.append(int(tier))
    tiers = np.array(tiers)
    mids = shapely.line_interpolate_point(edges, 0.5, normalized=True)
    alive = np.ones(len(edges), dtype=bool)
    starts = [_key(e.coords[0]) for e in edges]
    ends = [_key(e.coords[-1]) for e in edges]
    anchored_points = {k for i in np.flatnonzero(tiers == 0) for k in (starts[i], ends[i])}

    for tier in sorted({int(t) for t in tiers if t > protected_tier}):
        stage = (tiers > 0) & (tiers <= tier)
        removable = tiers == tier
        _prune_stage(edges, tiers, alive, stage | (tiers == 0), removable, starts, ends, anchored_points,
                     mids, min_convexity, tolerance, max_rounds)

    kept = [(int(tiers[i]), edges[i]) for i in range(len(edges)) if alive[i] and tiers[i] > 0]
    return kept + outside


def _prune_stage(edges, tiers, alive, stage, removable, starts, ends, anchored, mids,
                 min_convexity, tolerance, max_rounds):
    for _ in range(max_rounds):
        changed = _remove_dead_ends(alive, stage, removable, starts, ends, anchored)
        active = np.flatnonzero(alive & stage)
        # Overpasses crossing at nearly the same spot can yield invalid faces.
        faces = [shapely.make_valid(face) for face in polygonize([edges[i] for i in active])]
        if not faces:
            return
        face_tree = STRtree([face.boundary for face in faces])
        pair_edge, pair_face = face_tree.query(mids[active], predicate="dwithin", distance=NEAR)
        pair_edge = active[pair_edge]
        faces_of = {}
        edges_of = {}
        for e, f in zip(pair_edge.tolist(), pair_face.tolist()):
            faces_of.setdefault(e, []).append(f)
            edges_of.setdefault(f, []).append(e)
        exempt = {f for f, es in edges_of.items() if any(tiers[e] == 0 for e in es)}
        touched = set()
        for f, face in enumerate(faces):
            if f in exempt or f in touched:
                continue
            score = convexity(face, tolerance)
            if score >= min_convexity:
                continue
            best_edge, best_score, best_other = None, score + 0.02, None
            for e in edges_of.get(f, []):
                if not removable[e] or not alive[e]:
                    continue
                others = [g for g in faces_of.get(e, []) if g != f]
                if any(g in touched for g in others):
                    continue
                try:
                    merged = unary_union([face, *(faces[g] for g in others)])
                except shapely.errors.GEOSException:
                    continue
                candidate = convexity(merged, tolerance) if merged.geom_type == "Polygon" else 0
                if candidate > best_score:
                    best_edge, best_score, best_other = e, candidate, others
            # Only merge when it actually helps: inside a concave arterial
            # block, removing every street would just recreate that block.
            if best_edge is not None:
                alive[best_edge] = False
                touched.add(f)
                touched.update(best_other)
                changed = True
        if not changed:
            return
    # Out of rounds: still never leave a stub behind.
    _remove_dead_ends(alive, stage, removable, starts, ends, anchored)


def _remove_dead_ends(alive, stage, removable, starts, ends, anchored):
    changed = False
    while True:
        degree = {}
        for i in np.flatnonzero(alive & stage):
            for k in (starts[i], ends[i]):
                degree[k] = degree.get(k, 0) + 1
        dead = [i for i in np.flatnonzero(alive & stage & removable)
                if starts[i] != ends[i] and any(degree[k] == 1 and k not in anchored for k in (starts[i], ends[i]))]
        if not dead:
            return changed
        alive[dead] = False
        changed = True
