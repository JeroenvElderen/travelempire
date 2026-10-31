import { loadOwnedRegionRoads, type RegionalRoad } from './regionalRoads';
import type { Point, RoadGraph } from '../simulation/taxi';

// The OSM node IDs remain stable across regional packages. This is essential
// for connecting roads at administrative borders (coordinate rounding is not).
export function buildRegionGraph(roads: RegionalRoad[]): RoadGraph {
  const nodes = new Map<string, Point>();
  const edges: RoadGraph['edges'] = new Map();
  const add = (from: string, to: string, road: RegionalRoad) => {
    let list = edges.get(from);
    if (!list) { list = []; edges.set(from, list); }
    list.push({ to, meters: road.length, id: road.id, speedKph: road.speed });
  };
  for (const road of roads) {
    if (!road.coordinates || road.coordinates.length !== 2) continue;
    const a = String(road.a), b = String(road.b);
    if (!Number.isFinite(road.length) || road.length <= 0) continue;
    nodes.set(a, road.coordinates[0]);
    nodes.set(b, road.coordinates[1]);
    if (road.oneway !== -1) add(a, b, road);
    if (road.oneway !== 1) add(b, a, road);
  }
  if (!nodes.size) throw new Error('Selected territory has no usable roads');
  return { nodes, edges, nodeKeys: [...nodes.keys()] };
}

export async function loadTerritoryGraph(regionIds: string[]): Promise<RoadGraph> {
  if (!regionIds.length) throw new Error('No owned territory selected');
  // Sequential loading avoids downloading all Greek road data at startup.
  const unique = new Map<string, RegionalRoad>();
  for (const id of new Set(regionIds)) {
    const roads = await loadOwnedRegionRoads(id);
    for (const road of roads) unique.set(road.id, road);
  }
  return buildRegionGraph([...unique.values()]);
}
