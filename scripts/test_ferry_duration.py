#!/usr/bin/env python3
"""Regression tests for ferry routes with and without OSM duration tags."""
import unittest
from build_ferry_network import build, estimate_duration

class FerryDurationTests(unittest.TestCase):
    def test_estimate_positive(self):
        self.assertGreaterEqual(estimate_duration([[24.0, 37.0], [24.1, 37.0]]), 5)

    def test_missing_duration_is_imported(self):
        feature = {"type":"Feature","properties":{"route":"ferry","@id":"way/123"},
                   "geometry":{"type":"LineString","coordinates":[[24.0,37.0],[24.1,37.0]]}}
        network = build({"type":"FeatureCollection","features":[feature]})
        self.assertEqual(len(network["routes"]), 1)
        self.assertTrue(network["routes"][0]["durationEstimated"])
        self.assertGreater(network["routes"][0]["durationMinutes"], 0)

    def test_tagged_duration_preserved(self):
        feature = {"type":"Feature","properties":{"route":"ferry","duration":"1:30"},
                   "geometry":{"type":"LineString","coordinates":[[24.0,37.0],[24.1,37.0]]}}
        route = build({"type":"FeatureCollection","features":[feature]})["routes"][0]
        self.assertEqual(route["durationMinutes"], 90)
        self.assertFalse(route["durationEstimated"])

if __name__ == "__main__":
    unittest.main()
