# TravelEmpire v2.2.0 — ferry network foundations

This phase introduces a **validated, separate ferry graph**, not automatic ferry travel yet.

- Only routes explicitly tagged as allowing cars/motor vehicles are imported.
- Missing crossing durations are excluded, rather than invented.
- Endpoint coordinates are **provisional**: the OSM ferry route may not join a drivable road. Before routing vehicles, verify terminal entrances and snap them to a valid road node.
- No synthetic route geometry, invented ferry schedule, or fares are added.
- Default dataset is deliberately empty until verified OSM-derived data is supplied. The application will not offer ferry travel yet.
- Build from a GeoJSON FeatureCollection of OpenStreetMap ferry ways: `python3 scripts/build_ferry_network.py input.geojson public/data/ferries/GRC.json`.
- The resulting dataset requires attribution to OpenStreetMap contributors under ODbL.
- Next phase: validate terminal-to-road connectivity, connect the ferry graph to road routing, then add boarding/transit/disembarking states and save/load.

This separation avoids disrupting existing taxi and Explorer movement before the transport graph has been validated.
