/** Fetch ADM3 road packages from a public Supabase Storage bucket.
 * Manifest stays local; package files live in Supabase.
 * Requires a public read-only bucket and VITE_SUPABASE_URL (not a secret key).
 */
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
type Manifest = { format: string; regions: Record<string, { file: string; edges: number }> };
const LOCAL_ROOT = '/data/roads/';
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
const BUCKET = 'travelempire-roads';
let manifestPromise: Promise<Manifest> | undefined;
const loaded = new Map<string, RegionalRoad[]>();
const pending = new Map<string, Promise<RegionalRoad[]>>();

async function manifest(): Promise<Manifest> {
  manifestPromise ??= fetch(LOCAL_ROOT + 'manifest.json').then(async response => {
    if (!response.ok) throw new Error(`Road manifest HTTP ${response.status}`);
    return response.json() as Promise<Manifest>;
  }).catch(error => { manifestPromise = undefined; throw error; });
  return manifestPromise;
}

export function regionalRoadUrl(filename: string): string {
  // File names come from the local manifest, not from untrusted user input.
  const encoded = encodeURIComponent(filename);
  return SUPABASE_URL
    ? `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encoded}`
    : `${LOCAL_ROOT}regions/${encoded}`;
}

let packageWorker:Worker|undefined;
let nextId=0;
const requests=new Map<number,{resolve:(roads:RegionalRoad[])=>void;reject:(error:Error)=>void}>();
function getPackageWorker():Worker{
 if(packageWorker)return packageWorker;
 const worker=new Worker(new URL('./roadPackage.worker.ts',import.meta.url),{type:'module'});
 worker.onmessage=(event:MessageEvent<{id:number;roads?:RegionalRoad[];error?:string}>)=>{
  const {id,roads,error}=event.data;const pending=requests.get(id);
  if(!pending)return;requests.delete(id);
  if(error)pending.reject(new Error(error));else pending.resolve(roads??[]);
 };
 worker.onerror=(event)=>{
  for(const pending of requests.values())pending.reject(new Error(event.message));
  requests.clear();worker.terminate();packageWorker=undefined;
 };
 packageWorker=worker;return worker;
}
async function fetchRoads(regionId:string):Promise<RegionalRoad[]>{
 const meta=(await manifest()).regions[regionId];
 if(!meta)throw new Error(`No road package for ${regionId}`);
 const id=++nextId;
 const promise=new Promise<RegionalRoad[]>((resolve,reject)=>requests.set(id,{resolve,reject}));
 getPackageWorker().postMessage({id,regionId,url:regionalRoadUrl(meta.file)});
 const roads=await promise;
 loaded.set(regionId,roads);
 return roads;
}

export function loadOwnedRegionRoads(regionId: string): Promise<RegionalRoad[]> {
  const cached = loaded.get(regionId);
  if (cached) return Promise.resolve(cached);
  const existing = pending.get(regionId);
  if (existing) return existing;
  const promise = fetchRoads(regionId).finally(() => pending.delete(regionId));
  pending.set(regionId, promise);
  return promise;
}

export function unloadRegionRoads(regionId: string): void {
  loaded.delete(regionId);
}

export function getLoadedRoads(): RegionalRoad[] {
  const unique = new Map<string, RegionalRoad>();
  for (const roads of loaded.values()) {
    for (const road of roads) unique.set(road.id, road);
  }
  return [...unique.values()];
}
