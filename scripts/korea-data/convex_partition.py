"""Lossless convex partition with greedy shared-edge merging (GEOS 3.10+)."""
import heapq

import shapely
from shapely.geometry import Polygon


def convex_parts(polygon):
    if polygon.is_empty or polygon.area == 0:
        return []
    if not polygon.interiors and polygon.equals(polygon.convex_hull):
        return [polygon]
    pieces = {i: p for i, p in enumerate(shapely.constrained_delaunay_triangles(polygon).geoms)}
    edges = {}
    neighbors = {i: {} for i in pieces}
    queue = []
    next_id = len(pieces)
    for index in pieces:
        coords = list(pieces[index].exterior.coords)
        for a, b in zip(coords, coords[1:]):
            key = tuple(sorted((a, b)))
            other = edges.pop(key, None)
            if other is None:
                edges[key] = index
            else:
                length = ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** .5
                neighbors[index][other] = neighbors[other][index] = length
                heapq.heappush(queue, (-length, other, index))
    while queue:
        _, a, b = heapq.heappop(queue)
        if a not in pieces or b not in pieces:
            continue
        merged = pieces[a].union(pieces[b])
        if not isinstance(merged, Polygon) or merged.interiors or not merged.equals(merged.convex_hull):
            continue
        # Track adjacency independently of boundary coordinates: removing
        # collinear vertices cannot hide a partially shared edge.
        adjacent = {}
        for source in (a, b):
            for other, length in neighbors.pop(source).items():
                if other in (a, b):
                    continue
                neighbors[other].pop(source)
                adjacent[other] = adjacent.get(other, 0) + length
        del pieces[a], pieces[b]
        pieces[next_id] = merged.simplify(0, preserve_topology=True)
        neighbors[next_id] = adjacent
        for other, length in adjacent.items():
            neighbors[other][next_id] = length
            heapq.heappush(queue, (-length, other, next_id))
        next_id += 1
    return list(pieces.values())
