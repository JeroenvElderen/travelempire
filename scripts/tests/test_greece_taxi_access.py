"""Unit + offline end-to-end checks of Greece-wide taxi road repair."""
from __future__ import annotations

import gzip
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPTS = Path(__file__).resolve().parents[1]
ROOT = SCRIPTS.parent
sys.path.insert(0, str(SCRIPTS))
from osm_taxi_access import taxi_access_exception, taxi_oneway, vertical_metadata


class AccessHierarchyTests(unittest.TestCase):
    def test_taxi_overrides_general_access_no(self):
        self.assertTrue(taxi_access_exception({
            "highway": "service", "access": "no", "taxi": "yes", "bus": "yes"}))

    def test_psv_includes_taxis(self):
        self.assertTrue(taxi_access_exception({
            "highway": "service", "vehicle": "private", "psv": "designated"}))

    def test_explicit_taxi_no_overrides_psv_yes(self):
        self.assertFalse(taxi_access_exception({
            "highway": "service", "access": "no", "psv": "yes", "taxi": "no"}))

    def test_bus_only_does_not_grant_taxi_access(self):
        self.assertFalse(taxi_access_exception({
            "highway": "service", "access": "no", "bus": "yes"}))

    def test_private_without_override_is_excluded(self):
        self.assertFalse(taxi_access_exception({
            "highway": "service", "access": "private"}))

    def test_no_unnecessary_public_road_rebuild(self):
        self.assertFalse(taxi_access_exception({
            "highway": "service", "taxi": "yes"}))

    def test_conditional_exception_must_be_reviewed(self):
        self.assertFalse(taxi_access_exception({
            "highway": "service", "access": "no", "taxi": "yes",
            "taxi:conditional": "no @ (22:00-06:00)"}))

    def test_obey_taxi_specific_oneway(self):
        self.assertEqual(taxi_oneway({"oneway": "yes", "oneway:taxi": "no"}), 0)
        self.assertEqual(taxi_oneway({"oneway": "yes", "oneway:psv": "-1"}), -1)
        self.assertEqual(taxi_oneway({"junction": "roundabout"}), 1)

    def test_keep_tunnel_bridge_and_layer(self):
        result = vertical_metadata({"layer": "-1", "tunnel": "yes", "level": "-2"})
        self.assertEqual(result, {"layer": -1, "level": -2.0, "tunnel": True})


class OfflineStagingTests(unittest.TestCase):
    def test_stages_only_taxi_permitted_missing_roads(self):
        try:
            import osmium  # noqa: F401
        except ImportError:
            self.skipTest("osmium not installed")
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            pbf = root / "mini-greece.osm"
            # Node IDs are preserved exactly in the completed road network.
            nodes = {
                1: (23.9448, 37.9363),
                3343921312: (23.9434, 37.9350),
                3: (23.9430, 37.9348),
                4: (23.9425, 37.9340),
                5: (23.9410, 37.9320),
                6: (23.9415, 37.9330),
                7: (23.9411, 37.9324),
            }
            def attrs(data):
                return " ".join(f'{k}="{v}"' for k, v in data.items())
            xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<osm version="0.6" generator="travelempire-test">']
            for node, (lon, lat) in nodes.items():
                xml.append(f'<node id="{node}" lon="{lon}" lat="{lat}" version="1" />')
            def way(wid, refs, tags):
                xml.append(f'<way id="{wid}" version="1">')
                for ref in refs:
                    xml.append(f'<nd ref="{ref}"/>')
                for key, val in tags.items():
                    xml.append(f'<tag k="{key}" v="{val}"/>')
                xml.append('</way>')
            way(157768344, [1, 3343921312], {"highway": "service", "oneway": "yes"})
            way(157772015, [3343921312, 3, 4], {
                "highway": "service", "oneway": "yes", "access": "no", "taxi": "yes"})
            way(307919252, [3343921312, 5], {
                "highway": "service", "oneway": "yes", "access": "private"})
            way(307919251, [4, 5], {"highway": "service", "oneway": "yes"})
            way(6000, [4, 6], {"highway": "service", "access": "no", "psv": "yes"})
            way(7000, [6, 7], {"highway": "service", "access": "no", "bus": "yes"})
            xml.append("</osm>")
            pbf.write_text("\n".join(xml) + "\n")
            source = root / "v2"
            source.mkdir()
            initial = [
                {"id": "osm-157768344-0", "a": 1, "b": 3343921312,
                 "coordinates": [list(nodes[1]), list(nodes[3343921312])],
                 "length": 180, "highway": "service", "speed": 20, "oneway": 1},
                {"id": "osm-307919251-0", "a": 4, "b": 5,
                 "coordinates": [list(nodes[4]), list(nodes[5])],
                 "length": 200, "highway": "service", "speed": 20, "oneway": 1},
            ]
            (source / "239_379.v2.jsonl.gz").write_bytes(gzip.compress(
                b"".join(json.dumps(r).encode() + b"\n" for r in initial)))
            manifest = root / "tiles-manifest.json"
            manifest.write_text(json.dumps({
                "format": "travelempire-road-tiles-v2-levels", "tileSize": 0.1,
                "tiles": {"239_379": {"file": "239_379.v2.jsonl.gz", "edges": 2}},
            }))
            out = root / "stage"
            subprocess.run([sys.executable, str(SCRIPTS / "repair_greece_taxi_access.py"),
                            "--pbf", str(pbf), "--manifest", str(manifest),
                            "--source-dir", str(source), "--output", str(out)],
                           check=True, text=True, capture_output=True)
            report = json.loads((out / "validation.json").read_text())
            self.assertTrue(report["readyForActivation"], report)
            self.assertEqual(report["affectedTiles"], 1)
            self.assertEqual(report["addedSegments"], 3)
            changed = json.loads((out / "tiles-manifest.json").read_text())["tiles"]
            self.assertEqual(list(changed), ["239_379"])
            packed = (out / changed["239_379"]["file"]).read_bytes()
            roads = [json.loads(line) for line in gzip.decompress(packed).splitlines()]
            self.assertEqual([r["id"] for r in roads[:2]],
                             [r["id"] for r in initial])
            restored = [r for r in roads if r["id"] not in {item["id"] for item in initial}]
            self.assertTrue(all(r["taxiOnly"] for r in restored))
            self.assertEqual({r["id"] for r in restored},
                             {"osm-157772015-0", "osm-157772015-1", "osm-6000-0"})
            self.assertFalse(any("307919252" in r["id"] for r in roads))
            self.assertFalse(any("7000" in r["id"] for r in roads))
            self.assertFalse((out / ".sources").exists())
            self.assertEqual(json.loads(manifest.read_text())["tiles"]["239_379"]["edges"], 2)


if __name__ == "__main__":
    unittest.main()
