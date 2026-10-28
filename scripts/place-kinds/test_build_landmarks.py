"""Check that area assembly preserves a campus and its building names."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from build_landmarks import classify


class LandmarkBuildTest(unittest.TestCase):
    def test_orientation_categories(self):
        self.assertEqual(classify({"amenity": "university"}), ("school", "대학교", 0))
        self.assertEqual(classify({"railway": "station"}), ("station", "역·터미널", 0))
        self.assertEqual(classify({"building": "apartments"}), ("building", "건물", 2))
        self.assertIsNone(classify({"railway": "subway_entrance"}))
        self.assertIsNone(classify({"building": "garage"}))

    def test_extracts_relation_campus_and_building_but_skips_unnamed_geometry(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            source = root / "sample.osm"
            source.write_text('''<osm version="0.6">
              <node id="1" lon="126.956" lat="37.496"/>
              <node id="2" lon="126.960" lat="37.496"/>
              <node id="3" lon="126.960" lat="37.500"/>
              <node id="4" lon="126.956" lat="37.500"/>
              <node id="5" lon="126.958" lat="37.498">
                <tag k="name" v="도서관 건물"/><tag k="building" v="yes"/>
              </node>
              <way id="10"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="1"/></way>
              <relation id="20"><member type="way" ref="10" role="outer"/>
                <tag k="type" v="multipolygon"/><tag k="amenity" v="university"/>
                <tag k="name" v="University"/><tag k="name:ko" v="숭실대학교"/>
              </relation>
            </osm>''', encoding="utf-8")
            subprocess.run([sys.executable, "-X", "utf8", str(Path(__file__).with_name("build_landmarks.py")),
                            "--source", str(source), "--out", str(root / "tiles")], check=True, capture_output=True)
            index = json.loads((root / "tiles/index.json").read_text(encoding="utf-8"))
            rows = [row for tile in index["levels"][1]["tiles"] for row in json.loads((root / f"tiles/detail/{tile}.json").read_text(encoding="utf-8"))["r"]]
            self.assertEqual({row[1] for row in rows}, {"숭실대학교", "도서관 건물"})
            campus = next(row for row in rows if row[1] == "숭실대학교")
            self.assertEqual(campus[0], "r20")
            self.assertEqual(campus[4:], ["school", "대학교", 0])
            self.assertTrue(12695600 <= campus[2] <= 12696000)
            self.assertTrue(3749600 <= campus[3] <= 3750000)
