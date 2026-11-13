"""Run with python -m unittest discover -s scripts/tests -p 'test_greece_mobility.py' -v."""
from __future__ import annotations
import gzip
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(SCRIPTS))
from osm_mobility_access import classify,allowed_direction


class AccessTests(unittest.TestCase):
    def test_car_free_footway_and_stairs(self):
        self.assertTrue(classify({"highway":"footway"}).walk)
        self.assertFalse(classify({"highway":"footway"}).cycle)
        self.assertFalse(classify({"highway":"steps","bicycle":"yes"}).cycle)

    def test_bicycle_allowed_on_cycleways_without_default_foot(self):
        self.assertFalse(classify({"highway":"cycleway"}).walk)
        self.assertTrue(classify({"highway":"cycleway"}).cycle)
        self.assertTrue(classify({"highway":"cycleway","foot":"yes"}).walk)

    def test_shared_paths_and_on_road_sidewalk(self):
        self.assertTrue(classify({"highway":"path"}).walk)
        self.assertFalse(classify({"highway":"path"}).cycle)
        self.assertTrue(classify({"highway":"path","bicycle":"designated"}).cycle)
        self.assertTrue(classify({"highway":"residential","sidewalk":"both"}).walk)
        self.assertTrue(classify({"highway":"residential","sidewalk":"both"}).cycle)

    def test_restricted_and_private_access_not_opened(self):
        self.assertFalse(classify({"highway":"path","access":"private"}).walk)
        self.assertFalse(classify({"highway":"path","access":"no"}).cycle)
        self.assertTrue(classify({"highway":"path","access":"no","foot":"yes"}).walk)
        self.assertFalse(classify({"highway":"footway","foot":"no"}).walk)
        self.assertFalse(classify({"highway":"cycleway","bicycle":"no"}).cycle)

    def test_no_motorways_or_riding_on_dismount_or_steps(self):
        self.assertFalse(classify({"highway":"motorway","bicycle":"yes"}).cycle)
        self.assertFalse(classify({"highway":"cycleway","bicycle":"dismount"}).cycle)
        self.assertFalse(classify({"highway":"steps","bicycle":"designated"}).cycle)

    def test_mode_specific_oneways(self):
        x=classify({"highway":"residential","oneway":"yes","oneway:bicycle":"no"})
        self.assertEqual(x.walk_direction,0)
        self.assertEqual(x.cycle_direction,0)
        y=classify({"highway":"cycleway","oneway":"yes"})
        self.assertEqual(y.cycle_direction,1)
        z=classify({"highway":"footway","oneway:foot":"-1"})
        self.assertEqual(z.walk_direction,-1)
        self.assertEqual(allowed_direction({"oneway":"yes","cycleway":"opposite_lane"},"cycling"),0)

    def test_no_fabricated_roads_from_sidewalk_only_tags(self):
        self.assertFalse(classify({"sidewalk":"both"}).walk)
        self.assertFalse(classify({"highway":"proposed","foot":"yes"}).walk)


class BuildTilesTests(unittest.TestCase):
    def test_streamed_tiles_keep_osm_intersection_nodes_and_direction(self):
        try:import osmium  # noqa: F401
        except ImportError:self.skipTest("pip install osmium")
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            pbf=root/"micro.osm"
            lines=['<?xml version="1.0" encoding="UTF-8"?>',
                   '<osm version="0.6" generator="travelempire-test">']
            points={
                3343921312:(23.943,37.935),
                100:(23.9435,37.935),101:(23.944,37.935),
                102:(23.944,37.9355),103:(23.9445,37.9355),104:(23.945,37.9355),
            }
            for node,(lng,lat) in points.items():
                lines.append(f'<node id="{node}" lon="{lng}" lat="{lat}" version="1"/>')
            def way(identifier,nodes,tags):
                lines.append(f'<way id="{identifier}" version="1">')
                for node in nodes:lines.append(f'<nd ref="{node}"/>')
                for k,v in tags.items():lines.append(f'<tag k="{k}" v="{v}"/>')
                lines.append('</way>')
            way(200,[3343921312,100,101],{"highway":"footway"})
            way(201,[101,102],{"highway":"cycleway","foot":"yes","oneway":"yes"})
            way(202,[102,103],{"highway":"steps","bicycle":"yes"})
            way(203,[103,104],{"highway":"service","access":"private"})
            way(204,[103,104],{"highway":"path","access":"private"})
            way(205,[103,104],{"highway":"residential","oneway":"yes","oneway:bicycle":"no"})
            lines.append('</osm>')
            pbf.write_text("\n".join(lines))
            out=root/"tiles"
            result=subprocess.run([sys.executable,str(SCRIPTS/"build_greece_mobility_tiles.py"),
                "--pbf",str(pbf),"--output",str(out)],capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stdout+result.stderr)
            manifest=json.loads((out/"tiles-manifest.json").read_text())
            self.assertEqual(manifest["format"],"travelempire-mobility-v1")
            self.assertEqual(set(manifest["tiles"]),{"239_379"})
            filename=manifest["tiles"]["239_379"]["file"]
            roads=[json.loads(l) for l in gzip.decompress((out/filename).read_bytes()).splitlines()]
            byid={r["id"]:r for r in roads}
            self.assertEqual(len(roads),5)
            self.assertEqual(byid["mob-200-0"]["a"],"3343921312")
            self.assertEqual(byid["mob-200-0"]["walk"],3)
            self.assertEqual(byid["mob-200-0"]["cycle"],0)
            self.assertEqual(byid["mob-201-0"]["cycle"],1)
            self.assertEqual(byid["mob-201-0"]["walk"],3)
            self.assertEqual(byid["mob-202-0"]["cycle"],0)
            self.assertEqual(byid["mob-205-0"]["cycle"],3)
            self.assertNotIn("mob-203-0",byid)
            self.assertNotIn("mob-204-0",byid)
            self.assertTrue(json.loads((out/"validation.json").read_text())["readyToUpload"])


if __name__=="__main__":
    unittest.main()
