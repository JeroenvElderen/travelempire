/** Fetch only owned ADM3 road packages. Requires browser DecompressionStream('gzip'). */
export interface RegionalRoad {
  id: string;
  a: number;
  b: number;
  coordinates: [[number, number], [number, number]];
  length: number;
  highway: string;
  speed: number;
  oneway: number;
}
type Manifest = { format: string; regions: Record<string, {file: string; edges: number}> };
const ROOT = "/data/roads/";
let manifestPromise: Promise<Manifest> | undefined;
const loaded = new Map<string, RegionalRoad[]>();

async function manifest(): Promise<Manifest> {
  manifestPromise ??= fetch(ROOT + "manifest.json").then(async r => {
    if (!r.ok) throw new Error(`Road manifest HTTP ${r.status}`);
    return r.json() as Promise<Manifest>;
  }).catch(e => { manifestPromise = undefined; throw e; });
  return manifestPromise;
}

export async function loadOwnedRegionRoads(regionId: string): Promise<RegionalRoad[]> {
  if (loaded.has(regionId)) return loaded.get(regionId)!;
  const meta = (await manifest()).regions[regionId];
  if (!meta) throw new Error(`No road package for ${regionId}`);
  const response = await fetch(ROOT + "regions/" + encodeURIComponent(meta.file));
  if (!response.ok || !response.body) throw new Error(`Road package HTTP ${response.status}`);
  if (!("DecompressionStream" in globalThis)) throw new Error("Browser does not support gzip streams");
  const text = await new Response(response.body.pipeThrough(new DecompressionStream("gzip"))).text();
  const roads = text.split("\n").filter(Boolean).map(line => JSON.parse(line) as RegionalRoad);
  loaded.set(regionId, roads);
  return roads;
}

export function unloadRegionRoads(regionId: string): void {
  loaded.delete(regionId);
}

export function getLoadedRoads(): RegionalRoad[] {
  const unique = new Map<string, RegionalRoad>();
  for (const roads of loaded.values()) for (const road of roads) unique.set(road.id, road);
  return [...unique.values()];
}
