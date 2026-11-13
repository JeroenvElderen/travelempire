/** Mobile Safari cannot hold a nation-scale, duplicated mutable OSM graph.
 * The main-thread road graph, dispatcher worker, graph worker and UI all
 * otherwise retain overlapping graph structures. This is a safety brake,
 * not a replacement for region eviction / rehydration.
 */
export const IOS_MAX_ROAD_EDGES = 360_000;
export const IOS_MAX_ROAD_NODES = 340_000;
// Reserve several more tiles for actual depot/vehicle locations. Background
// exploration must never exhaust these slots before remote depots are loaded.
export const IOS_ESSENTIAL_ROAD_EDGE_LIMIT = 445_000;
export const IOS_ESSENTIAL_ROAD_NODE_LIMIT = 420_000;
export const IOS_BACKGROUND_TILE_DELAY_MS = 4_000;
export const IOS_DISPATCH_INTERVAL_MS = 3_000;
export const DESKTOP_DISPATCH_INTERVAL_MS = 1_000;

export function isIOSWebKit(userAgent:string):boolean{
 return /iPhone|iPad|iPod/i.test(userAgent);
}

export function graphMemoryLimitReached(
 isMobile:boolean,roadEdges:number,roadNodes:number,
):boolean{
 return isMobile&&(roadEdges>=IOS_MAX_ROAD_EDGES||roadNodes>=IOS_MAX_ROAD_NODES);
}

/** Soft limit stops speculative expansion. Essential loads keep a bounded
 * reserve for island depots and the actual positions of active vehicles.
 * Beyond the hard limit even essential requests must wait until region
 * eviction/swap support is implemented, to avoid a Safari reload.
 */
export function roadTileBudgetAvailable(
 isMobile:boolean,roadEdges:number,roadNodes:number,essential=false,
):boolean{
 if(!isMobile)return true;
 return essential
  ? roadEdges<IOS_ESSENTIAL_ROAD_EDGE_LIMIT&&roadNodes<IOS_ESSENTIAL_ROAD_NODE_LIMIT
  : !graphMemoryLimitReached(true,roadEdges,roadNodes);
}

/** Heavy explorer planning runs on a slower cadence than simulation ticks.
 * Low-battery/hidden tabs do not benefit from repeated background plans.
 */
export function dispatchAllowed(visible:boolean,ready:boolean,busy:boolean):boolean{
 return visible&&ready&&!busy;
}
