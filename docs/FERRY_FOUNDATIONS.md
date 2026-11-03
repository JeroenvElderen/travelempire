# TravelEmpire v2.2.0 — ferry network foundations

This phase introduces a **validated, separate ferry graph**, not automatic ferry travel yet.

- All ferry routes can carry player vehicles, including passenger-only routes in the real world. This is an intentional gameplay rule.
- Missing crossing durations are excluded, rather than invented.
- Endpoint coordinates are **provisional**: the OSM ferry route may not join a drivable road. Before routing vehicles, verify terminal entrances and snap them to a valid road node.
- The ferry marker is the user-provided passenger ferry SVG at /assets/passenger_ferry_professional.svg.\n- No synthetic route geometry, invented ferry schedule, or fares are added.
- Default dataset is deliberately empty until verified OSM-derived data is supplied. The application will not offer ferry travel yet.
- Build from a GeoJSON FeatureCollection of OpenStreetMap ferry ways: `python3 scripts/build_ferry_network.py input.geojson public/data/ferries/GRC.json`.
- The resulting dataset requires attribution to OpenStreetMap contributors under ODbL.
- Next phase: validate terminal-to-road connectivity, connect the ferry graph to road routing, then add boarding/transit/disembarking states and save/load.

This separation avoids disrupting existing taxi and Explorer movement before the transport graph has been validated.

## v2.2.1 — road terminal integration

`src/maritime/roadConnections.ts` now resolves each ferry port to the nearest **loaded** road node within 250 metres (configurable). Terminals without nearby loaded roads remain explicitly unconnected. Both ends must be connected before `roadAccessibleFerryTransfers` exposes a crossing.

`RoadNetworkManager.considerFerryTerminals(network)` requests tiles near terminal entrances, and `ferryConnections(network)` resolves them as tiles arrive. These APIs deliberately do not insert ferry edges into the road graph or move taxis; ferry boarding and vehicle state handling will be implemented separately.

**Data limitation:** The Greece ferry dataset is still empty. Before crossings can be activated, import ferry route geometry and verify port road-access coordinates. Ferry routes are allowed to carry all player vehicles as a gameplay rule, regardless of real-world ferry restrictions.

**Safety:** A port within 250 m of a road node is a candidate connection, not proof that the road reaches a boarding ramp. Actual ramp connectivity must be verified before enabling vehicle movement.

## v2.2.2 — route purchase and multimodal journey planning

- Ferry routes are purchased individually for a starting price of **€2,000**, once per company; both directions unlock together.
- Purchases are saved in the existing company record as `purchasedFerryRouteIds` and deducted from cash, with a transaction recorded in fleet finance history.
- Operations shows available ferry routes and their purchase state.
- `planFerryJourney` combines existing road-router results with ferry transfer links only for purchased routes and road-connected terminals. This returns an itinerary; it does **not** yet assign it to vehicles or implement ferry boarding.
- Greece's bundled ferry dataset is empty. Routes must be imported before players can purchase one.
- The planner uses a simple all-pairs road-segment search between connected terminals, appropriate for small initial networks; benchmark or replace before importing a large network.
- Do not confuse itinerary planning with live taxi navigation. Boarding, movement, save/recovery and ferry markers are separate milestones.
