"""python scripts/korea-data/test_convex_roads.py"""
from shapely.geometry import LineString, box

from convex_roads import filter_convex

REGION = box(0, 0, 400, 400)


def kept_length(kept, tier):
    return round(sum(line.length for t, line in kept if t == tier))


def test_dead_end_is_omitted():
    roads = [(3, LineString([(0, 200), (400, 200)])), (4, LineString([(200, 200), (200, 300)]))]
    kept = filter_convex(roads, REGION)
    assert kept_length(kept, 4) == 0
    assert kept_length(kept, 3) == 400


def test_grid_blocks_are_kept():
    roads = [(4, LineString([(0, y), (400, y)])) for y in (100, 200, 300)]
    roads += [(4, LineString([(x, 0), (x, 400)])) for x in (100, 200, 300)]
    kept = filter_convex(roads, REGION)
    assert kept_length(kept, 4) == 2400


def test_road_cutting_an_l_shape_is_omitted():
    # A tertiary ring; one street splits the block into a square and an L.
    ring = LineString([(50, 50), (350, 50), (350, 350), (50, 350), (50, 50)])
    stem = LineString([(200, 50), (200, 200), (350, 200)])
    kept = filter_convex([(3, ring), (4, stem)], REGION)
    assert kept_length(kept, 4) == 0
    assert kept_length(kept, 3) == 1200


def test_arterials_are_never_omitted():
    roads = [(2, LineString([(0, 200), (400, 200)])), (2, LineString([(200, 200), (200, 300)]))]
    kept = filter_convex(roads, REGION)
    assert kept_length(kept, 2) == 500


if __name__ == "__main__":
    for name, test in list(globals().items()):
        if name.startswith("test_"):
            test()
            print("ok", name)
