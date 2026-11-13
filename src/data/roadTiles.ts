/** Geographic road tiles. No administrative regions are used at runtime. */
import {isIOSWebKit} from './roadMemoryPolicy';
const IOS_REDUCED_MEMORY=typeof navigator!=='undefined'&&isIOSWebKit(navigator.userAgent);
export interface RoadSegment {id:string;a:number;b:number;coordinates:[[number,number],[number,number]];length:number;highway:string;speed:number;oneway:number;
 /** Optional OSM vertical metadata; absent on existing v1 tiles. */
 layer?:number;bridge?:boolean;tunnel?:boolean;level?:number;taxiOnly?:boolean;
}
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
   // A v1 supplemental manifest must not override v2 files after a staged
   // tunnel/bridge metadata upgrade. The new bundled manifest already
   // contains all tiles merged at download/enrichment time.
   if(supplemental.tileSize!==bundled.tileSize||
      supplemental.format!==bundled.format||!supplemental.tiles)return bundled;
   // Bundled patches must win for existing tile keys; supplemental adds only new regions.
   return {...bundled,tiles:{...supplemental.tiles,...bundled.tiles}};
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
  // Structured-cloning a decoded 30k-edge tile in and out of IndexedDB
  // briefly doubles the entire JSON object graph on mobile Safari.
  // On iOS, parse the compressed response in the worker instead.
  const persisted=IOS_REDUCED_MEMORY?undefined:await cachedTile(key).catch(()=>undefined);
  if(persisted){cache.set(id,persisted);return persisted;}
  const request=++serial;const result=new Promise<RoadSegment[]>((resolve,reject)=>callbacks.set(request,{resolve,reject}));
  parser().postMessage({id:request,regionId:id,url});const roads=await result;cache.set(id,roads);
  // Persist asynchronously; gameplay never waits for a storage transaction.
  if(!IOS_REDUCED_MEMORY)void saveTile(key,roads).catch(()=>{});
  return roads;
 })().finally(()=>pending.delete(id));pending.set(id,task);return task;
}

/** Free the parsed tile array after its roads have been ingested into the graph. */
export function releaseRoadTile(id:string):void{cache.delete(id)}

/** Download the entire compressed nationwide dataset before gameplay.
 * Cached packages are decoded only when a region is actually needed. */
export const ROAD_PACKAGE_CACHE='travelempire-road-packages-v1';
export type RoadDownloadProgress={completed:number;total:number;failed:number;active:boolean;current?:string};
const pause=(ms:number,signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{
 if(signal.aborted){reject(Error('Download cancelled'));return;}
 const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve()},ms);
 const cancel=()=>{clearTimeout(timer);reject(Error('Download cancelled'))};
 signal.addEventListener('abort',cancel,{once:true});
});
export async function cacheAllRoadPackages(
 signal:AbortSignal,onProgress:(progress:RoadDownloadProgress)=>void,
):Promise<void>{
 const manifest=await roadTileManifest();
 const entries=Object.values(manifest.tiles);
 const total=entries.length;
 if(!('caches' in globalThis))throw Error('Browser Cache Storage is unavailable.');
 const store=await caches.open(ROAD_PACKAGE_CACHE);
 let completed=0,next=0,concurrency=2,successStreak=0,cooldownUntil=0;
 let fatal:Error|null=null;
 const report=(current?:string)=>onProgress({completed,total,failed:0,active:completed<total,current});
 const urlFor=(file:string)=>storage?`${storage}/storage/v1/object/public/${bucket}/${encodeURIComponent(file)}`:`${root}tiles/${encodeURIComponent(file)}`;
 // Cache lookups happen first: no network calls for packages retained by Safari.
 const missing:string[]=[];
 for(const info of entries){
  if(signal.aborted)throw Error('Download cancelled');
  const url=urlFor(info.file);
  if(await store.match(url))completed++;
  else missing.push(info.file);
  if(completed%50===0)report();
 }
 report();
 const waitForCooldown=async()=>{
  const remaining=cooldownUntil-Date.now();
  if(remaining>0)await pause(remaining,signal);
 };
 const fetchPackage=async(file:string)=>{
  const url=urlFor(file);
  for(let attempt=0;attempt<12;attempt++){
   if(signal.aborted)throw Error('Download cancelled');
   await waitForCooldown();
   try{
    const response=await fetch(url,{signal});
    if(response.status===429||response.status===503){
     concurrency=1;successStreak=0;
     const header=response.headers.get('Retry-After');
     const seconds=header?Number(header):NaN;
     const dateMs=header&&!Number.isFinite(seconds)?Date.parse(header)-Date.now():NaN;
     const retryMs=Number.isFinite(seconds)?seconds*1000:Number.isFinite(dateMs)?dateMs:Math.min(120000,4000*2**Math.min(attempt,5));
     cooldownUntil=Math.max(cooldownUntil,Date.now()+Math.max(4000,Math.min(180000,retryMs)));
     console.warn('[TravelEmpire] Road server throttled; pausing downloads',file,'attempt',attempt+1);
     continue;
    }
    if(!response.ok)throw Error(`HTTP ${response.status}`);
    await store.put(url,response);
    successStreak++;
    if(successStreak>=40&&concurrency<3){concurrency++;successStreak=0;}
    completed++;report(file);
    return;
   }catch(error){
    if(signal.aborted)throw Error('Download cancelled');
    if(attempt===11)throw Error(`Cannot cache ${file}: ${String(error)}`);
    await pause(Math.min(60000,1500*2**Math.min(attempt,5)),signal);
   }
  }
  throw Error(`Road server repeatedly throttled download of ${file}. Retry to resume cached progress.`);
 };
 const worker=async(index:number)=>{
  while(!signal.aborted&&!fatal){
   if(index>=concurrency){await pause(500,signal);continue;}
   const item=next++;
   if(item>=missing.length)return;
   try{await fetchPackage(missing[item]);}
   catch(error){if(!signal.aborted)fatal=error instanceof Error?error:Error(String(error));return;}
   await pause(120,signal);
  }
 };
 await Promise.allSettled([worker(0),worker(1),worker(2)]);
 if(signal.aborted)throw Error('Download cancelled');
 if(fatal)throw fatal;
 if(completed!==total)throw Error(`Only ${completed} of ${total} road packages cached.`);
 onProgress({completed,total,failed:0,active:false});
}
