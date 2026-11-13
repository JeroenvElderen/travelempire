/** Independent pedestrian/cycling OSM tiles. Nothing here mutates the taxi graph. */
export type MobilityPoint=[number,number];
export type MobilityMode='walk'|'cycle';
export type MobilitySegment={
 id:string;a:string;b:string;coordinates:[MobilityPoint,MobilityPoint];
 length:number;highway:string;
 /** Per-direction bitmask: 1 = a to b, 2 = b to a, 3 = both. */
 walk:number;cycle:number;layer?:number;bridge?:boolean;tunnel?:boolean;
};
export type MobilityManifest={
 format:'travelempire-mobility-v1';tileSize:number;tiles:Record<string,{file:string;edges:number}>;
};
const ROOT=`${import.meta.env.BASE_URL}data/mobility/`;
const STORAGE=(import.meta.env.VITE_SUPABASE_URL??'').trim().replace(/\/+$/,'');
const BUCKET='travelempire-road-tiles';
let manifestTask:Promise<MobilityManifest>|undefined;
const pending=new Map<string,Promise<MobilitySegment[]>>();
const cache=new Map<string,MobilitySegment[]>();
const MAX_CACHED=9;
let worker:Worker|undefined;
let serial=0;
const callbacks=new Map<number,{resolve:(data:MobilitySegment[])=>void;reject:(e:Error)=>void}>();

export function mobilityTileId(position:MobilityPoint,tileSize=0.1):string{
 return `${Math.floor(position[0]/tileSize)}_${Math.floor(position[1]/tileSize)}`;
}

export function mobilityTileIdsNear(position:MobilityPoint,tileSize=0.1,radius=1):string[]{
 const x=Math.floor(position[0]/tileSize),y=Math.floor(position[1]/tileSize);
 const result:string[]=[];
 for(let dx=-radius;dx<=radius;dx++)for(let dy=-radius;dy<=radius;dy++)
  result.push(`${x+dx}_${y+dy}`);
 return result.sort((a,b)=>{
  const [ax,ay]=a.split('_').map(Number),[bx,by]=b.split('_').map(Number);
  const da=(ax-x)**2+(ay-y)**2,db=(bx-x)**2+(by-y)**2;
  return da-db;
 });
}

export async function mobilityManifest():Promise<MobilityManifest>{
 manifestTask??=(async()=>{
  const response=await fetch(`${ROOT}tiles-manifest.json`);
  if(!response.ok)throw Error(`Mobility manifest HTTP ${response.status}`);
  const value=await response.json() as MobilityManifest;
  if(value.format!=='travelempire-mobility-v1'||value.tileSize!==0.1||!value.tiles)
   throw Error('Unsupported mobility manifest; rebuild walking/cycling tiles');
  return value;
 })().catch(error=>{manifestTask=undefined;throw error});
 return manifestTask;
}

function tileWorker():Worker{
 if(worker)return worker;
 worker=new Worker(new URL('./mobilityPackage.worker.ts',import.meta.url),{type:'module'});
 worker.onmessage=(event:MessageEvent<{id:number;roads?:MobilitySegment[];error?:string}>)=>{
  const callback=callbacks.get(event.data.id);
  if(!callback)return;
  callbacks.delete(event.data.id);
  if(event.data.error)callback.reject(Error(event.data.error));
  else callback.resolve(event.data.roads??[]);
 };
 worker.onerror=(error)=>{
  for(const callback of callbacks.values())callback.reject(Error(error.message));
  callbacks.clear();
  worker?.terminate();worker=undefined;
 };
 return worker;
}

/** No speculative downloads; called only for explicit active exploration. */
export function loadMobilityTile(id:string):Promise<MobilitySegment[]>{
 const cached=cache.get(id);
 if(cached){cache.delete(id);cache.set(id,cached);return Promise.resolve(cached)}
 const existing=pending.get(id);
 if(existing)return existing;
 const task=(async()=>{
  const manifest=await mobilityManifest();
  const entry=manifest.tiles[id];
  if(!entry)return [];
  const url=STORAGE
   ?`${STORAGE}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(entry.file)}`
   :`${ROOT}tiles/${encodeURIComponent(entry.file)}`;
  const requestId=++serial;
  const value=new Promise<MobilitySegment[]>((resolve,reject)=>{
   callbacks.set(requestId,{resolve,reject});
  });
  tileWorker().postMessage({id:requestId,url});
  const roads=await value;
  if(roads.length!==entry.edges)
   throw Error(`Mobility tile ${id} expected ${entry.edges} edges; parsed ${roads.length}`);
  cache.set(id,roads);
  while(cache.size>MAX_CACHED)cache.delete(cache.keys().next().value!);
  return roads;
 })().finally(()=>pending.delete(id));
 pending.set(id,task);
 return task;
}
