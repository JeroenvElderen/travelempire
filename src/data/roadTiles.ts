/** Geographic road tiles. No administrative regions are used at runtime. */
export interface RoadSegment {id:string;a:number;b:number;coordinates:[[number,number],[number,number]];length:number;highway:string;speed:number;oneway:number}
type Manifest={format:string;tileSize:number;tiles:Record<string,{file:string;edges:number}>};
let manifestPromise:Promise<Manifest>|undefined;
const cache=new Map<string,RoadSegment[]>();
const pending=new Map<string,Promise<RoadSegment[]>>();
const root=`${import.meta.env.BASE_URL}data/roads/`;
const storage=(import.meta.env.VITE_SUPABASE_URL??'').trim().replace(/\/+$/,'');
const bucket='travelempire-road-tiles';
export function tileId(lng:number,lat:number,size=0.1):string{return `${Math.floor(lng/size)}_${Math.floor(lat/size)}`;}
export async function roadTileManifest():Promise<Manifest>{
 manifestPromise??=(async()=>{
  const bundledResponse=await fetch(`${root}tiles-manifest.json`);
  if(!bundledResponse.ok)throw Error(`Tile manifest HTTP ${bundledResponse.status}`);
  const bundled=await bundledResponse.json() as Manifest;
  if(!storage)return bundled;
  try{
   const url=`${storage}/storage/v1/object/public/${bucket}/supplemental-manifest.json`;
   const response=await fetch(url,{cache:'no-store'});
   if(!response.ok)return bundled;
   const supplemental=await response.json() as Manifest;
   if(supplemental.tileSize!==bundled.tileSize||!supplemental.tiles)return bundled;
   return {...bundled,tiles:{...bundled.tiles,...supplemental.tiles}};
  }catch{return bundled;}
 })().catch(e=>{manifestPromise=undefined;throw e});
 return manifestPromise;
}

// Parsed road tiles persist independently of the browser's raw-response cache.
// IndexedDB failures (private mode, quota, eviction) are non-fatal.
const DB_NAME='travelempire-parsed-roads', STORE='tiles', DB_VERSION=1;
let dbPromise:Promise<IDBDatabase>|undefined;
function tileDB():Promise<IDBDatabase>{
 return dbPromise??=new Promise<IDBDatabase>((resolve,reject)=>{
  if(!('indexedDB' in globalThis)){reject(Error('IndexedDB unavailable'));return;}
  const request=indexedDB.open(DB_NAME,DB_VERSION);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE)};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
 }).catch(error=>{dbPromise=undefined;throw error});
}
async function cachedTile(key:string):Promise<RoadSegment[]|undefined>{
 const db=await tileDB();return new Promise((resolve,reject)=>{
  const request=db.transaction(STORE,'readonly').objectStore(STORE).get(key);
  request.onsuccess=()=>resolve(Array.isArray(request.result)?request.result:undefined);
  request.onerror=()=>reject(request.error);
 });
}
async function saveTile(key:string,roads:RoadSegment[]):Promise<void>{
 const db=await tileDB();return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readwrite');
  tx.objectStore(STORE).put(roads,key);
  tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
 });
}

let worker:Worker|undefined;let serial=0;
const callbacks=new Map<number,{resolve:(v:RoadSegment[])=>void;reject:(e:Error)=>void}>();
function parser(){if(worker)return worker;worker=new Worker(new URL('./roadPackage.worker.ts',import.meta.url),{type:'module'});
 worker.onmessage=(e:MessageEvent<{id:number;roads?:RoadSegment[];error?:string}>)=>{const c=callbacks.get(e.data.id);if(!c)return;callbacks.delete(e.data.id);if(e.data.error)c.reject(Error(e.data.error));else c.resolve(e.data.roads??[])};
 worker.onerror=e=>{for(const c of callbacks.values())c.reject(Error(e.message));callbacks.clear();worker?.terminate();worker=undefined};return worker;}
export function loadRoadTile(id:string):Promise<RoadSegment[]>{
 const saved=cache.get(id);if(saved)return Promise.resolve(saved);
 const inflight=pending.get(id);if(inflight)return inflight;
 const task=(async()=>{const manifest=await roadTileManifest();const info=manifest.tiles[id];if(!info)return [];
  const url=storage?`${storage}/storage/v1/object/public/${bucket}/${encodeURIComponent(info.file)}`:`${root}tiles/${encodeURIComponent(info.file)}`;
  const key=`v2:${manifest.format}:${manifest.tileSize}:${id}:${info.file}:${info.edges}`;
  const persisted=await cachedTile(key).catch(()=>undefined);
  if(persisted){cache.set(id,persisted);return persisted;}
  const request=++serial;const result=new Promise<RoadSegment[]>((resolve,reject)=>callbacks.set(request,{resolve,reject}));
  parser().postMessage({id:request,regionId:id,url});const roads=await result;cache.set(id,roads);
  // Persist asynchronously; gameplay never waits for a storage transaction.
  void saveTile(key,roads).catch(()=>{});
  return roads;
 })().finally(()=>pending.delete(id));pending.set(id,task);return task;
}

/** Free the parsed tile array after its roads have been ingested into the graph. */
export function releaseRoadTile(id:string):void{cache.delete(id)}
