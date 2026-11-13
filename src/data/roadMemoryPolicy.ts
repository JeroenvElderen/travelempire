/** Mobile Safari cannot hold a nation-scale, duplicated mutable OSM graph.
 * The main-thread road graph, dispatcher worker, graph worker and UI all
 * otherwise retain overlapping graph structures. This is a safety brake,
 * not a replacement for region eviction / rehydration.
 */
export const IOS_MAX_ROAD_EDGES = 360_000;
export const IOS_MAX_ROAD_NODES = 340_000;
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

/** Heavy explorer planning runs on a slower cadence than simulation ticks.
 * Low-battery/hidden tabs do not benefit from repeated background plans.
 */
export function dispatchAllowed(visible:boolean,ready:boolean,busy:boolean):boolean{
 return visible&&ready&&!busy;
}
