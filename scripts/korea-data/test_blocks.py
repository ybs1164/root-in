"""Regression cases for the region-first illustrated map."""
import unittest

from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union
from build import build_blocks, dividing_roads, encode_blocks, polygons, simplify_road_network
from convex_partition import convex_parts


class RegionBlocksTest(unittest.TestCase):
    def setUp(self):
        self.land = box(0, 0, 100, 100)

    def test_branch_does_not_notch_a_block(self):
        through = LineString([(0, 50), (100, 50)])
        branch = LineString([(50, 50), (50, 70), (80, 70)])
        actual = build_blocks(self.land, [through, branch], 4, 0)
        expected = build_blocks(self.land, [through], 4, 0)
        self.assertTrue(actual.equals(expected))
        self.assertEqual(len(list(polygons(actual))), 2)

    def test_isolated_road_and_branching_tree_are_omitted(self):
        roads = [LineString([(0, 50), (50, 50)]), LineString([(50, 50), (60, 80)]), LineString([(50, 50), (70, 20)])]
        self.assertTrue(build_blocks(self.land, roads, 4, 0).equals(self.land))
        self.assertTrue(dividing_roads(self.land, [LineString([(20, 20), (80, 80)])]).is_empty)

    def test_closed_region_survives_but_its_entry_stem_is_omitted(self):
        loop = LineString([(30, 30), (70, 30), (70, 70), (30, 70), (30, 30)])
        stem = LineString([(0, 50), (30, 50)])
        actual = build_blocks(self.land, [loop, stem], 4, 0)
        self.assertTrue(actual.equals(build_blocks(self.land, [loop], 4, 0)))
        self.assertEqual(len(list(polygons(actual))), 2)

    def test_crossing_roads_split_four_regions(self):
        roads = [LineString([(0, 50), (100, 50)]), LineString([(50, 0), (50, 100)])]
        self.assertEqual(len(list(polygons(build_blocks(self.land, roads, 4, 0)))), 4)

    def test_water_holes_are_preserved(self):
        land = Polygon(self.land.exterior.coords, [box(40, 40, 60, 60).exterior.coords])
        blocks = build_blocks(land, [LineString([(0, 20), (100, 20)])], 4, 0)
        self.assertFalse(blocks.covers(Point(50, 50)))

    def test_padded_grid_edge_creates_no_road_gap(self):
        padded_land = box(-10, -10, 110, 110)
        blocks = build_blocks(padded_land, [LineString([(-10, 50), (110, 50)])], 4, 0).intersection(self.land)
        self.assertTrue(blocks.covers(Point(0, 10)))
        self.assertTrue(blocks.covers(Point(100, 90)))

    def test_wide_scale_simplification_preserves_an_interior_junction(self):
        roads = [LineString([(0, 50), (20, 51), (40, 50), (80, 51), (100, 50)]), LineString([(40, 0), (40, 50), (40, 100)])]
        simplified = simplify_road_network(roads, 10)
        self.assertIn((40, 50), simplified[0].coords)
        self.assertIn((40, 50), simplified[1].coords)
        self.assertEqual(len(list(polygons(build_blocks(self.land, simplified, 4, 0)))), 4)

    def test_wide_scale_simplification_preserves_a_closed_region(self):
        loop = LineString([(20, 20), (50, 21), (80, 20), (80, 80), (20, 80), (20, 20)])
        simplified = simplify_road_network([loop], 10)
        self.assertTrue(simplified[0].is_ring)
        self.assertEqual(len(list(polygons(build_blocks(self.land, simplified, 4, 0)))), 2)


class ConvexPartitionTest(unittest.TestCase):
    def assert_partition(self, land):
        parts = convex_parts(land)
        self.assertTrue(unary_union(parts).equals(land))
        self.assertAlmostEqual(sum(p.area for p in parts), land.area)
        for p in parts:
            self.assertTrue(p.is_valid and not p.interiors and p.equals(p.convex_hull))
        for i, a in enumerate(parts):
            for b in parts[i + 1:]:
                if a.boundary.intersection(b.boundary).length > 0:
                    union = a.union(b)
                    self.assertFalse(union.equals(union.convex_hull))
        return parts

    def test_convex_region_remains_one_block(self):
        self.assertEqual(len(self.assert_partition(box(0, 0, 100, 100))), 1)

    def test_concave_region_is_fully_covered_and_maximally_merged(self):
        self.assert_partition(Polygon([(0, 0), (100, 0), (100, 30), (30, 30), (30, 100), (0, 100)]))

    def test_hole_is_partitioned_without_filling_water(self):
        land = Polygon(box(0, 0, 100, 100).exterior.coords, [box(40, 40, 60, 60).exterior.coords])
        self.assert_partition(land)

    def test_tiny_land_is_not_filtered_during_encoding(self):
        encoded = encode_blocks(box(0, 0, 1, 1), 1500)
        self.assertGreater(len(encoded), 0)
        for block in encoded:
            p = Polygon(block['outer'])
            self.assertFalse(block['holes'])
            self.assertTrue(p.equals(p.convex_hull))


if __name__ == '__main__':
    unittest.main()
