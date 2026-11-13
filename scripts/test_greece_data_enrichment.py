"""Small offline safety tests; no OSM dataset or Supabase connection needed.

Run: python -m unittest discover -s scripts -p "test_greece_data_enrichment.py"
"""
import importlib
import os
import sys
import types
import unittest
from unittest.mock import patch

# The validation helpers can be tested on CI without installing PyOsmium.
class FakeSimpleHandler:
    pass

with patch.dict(sys.modules, {"osmium": types.SimpleNamespace(SimpleHandler=FakeSimpleHandler)}):
    import enrich_ferry_names_from_pbf as names
    import enrich_geographic_road_tiles as roads

class FerryNameTests(unittest.TestCase):
    def setUp(self):
        self.port={"id":"piraeus-port","name":"Ferry terminal (road access unverified)",
                   "position":[23.642,37.948]}
        self.handler=names.NearbyNames([self.port])
    def test_does_not_invent_names_from_unnamed_features(self):
        self.handler.consider([23.642,37.948],"", "ferry_terminal","node/10")
        self.handler.consider([23.642,37.948],
                              "Ferry terminal (road access unverified)",
                              "ferry_terminal","node/11")
        self.assertEqual(len(self.handler.candidates),0)
    def test_named_terminal_preferred_over_nearby_town(self):
        self.handler.consider([23.642,37.948],"Piraeus","locality","node/12")
        self.handler.consider([23.6421,37.948],"Piraeus Ferry Terminal",
                              "ferry_terminal","node/13")
        candidates=self.handler.candidates[self.port["id"]]
        self.assertLess(candidates["Piraeus Ferry Terminal"]["score"],
                        candidates["Piraeus"]["score"])
    def test_distant_name_is_not_assigned(self):
        self.handler.consider([23.7,37.97],"Other Island Harbour",
                              "ferry_terminal","node/15")
        self.assertFalse(self.handler.candidates)
    def test_correct_osm_id_and_coordinates_remain_independent(self):
        self.handler.consider(self.port["position"],"Port of Piraeus",
                              "ferry_terminal","node/16")
        self.assertEqual(self.handler.candidates[self.port["id"]]["Port of Piraeus"]["osm"],
                         "node/16")
        self.assertEqual(self.port["id"],"piraeus-port")

class VerticalRoadTests(unittest.TestCase):
    def test_parse_bridge_and_layer(self):
        tags=roads.parse_vertical_tags({"bridge":"yes","layer":"1"})
        self.assertEqual(tags,{"layer":1,"bridge":True})
    def test_parse_tunnel_and_negative_layer(self):
        tags=roads.parse_vertical_tags({"tunnel":"yes","layer":"-1"})
        self.assertEqual(tags,{"layer":-1,"tunnel":True})
    def test_level_is_not_osm_layer(self):
        tags=roads.parse_vertical_tags({"level":"-2"})
        self.assertEqual(tags,{"level":-2})
    def test_saved_segment_id_resolves_to_osm_way_id(self):
        import re
        pattern=re.compile(r"^(?:[^:]+:)?(\d+):\d+:\d+(?::\d+)?$")
        self.assertEqual(roads.way_id({"id":"12345:11:12"},pattern),12345)
        self.assertEqual(roads.way_id({"id":"osm-12345-0"},pattern),12345)
        self.assertEqual(roads.way_id({"id":"unknown"},pattern),None)

if __name__=="__main__":
    unittest.main()
