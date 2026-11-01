/** Offline OSM POI tiles served from Supabase Storage (or local public/ fallback). */
export type StationKind='fuel'|'charging'|'workshop';
export type Station={id:string;kind:StationKind;lng:number;lat:number;name:string;operator?:string;access?:string};
const cache=new Map<string,Station[]>();
const inflight=new Map<string,Promise<Station[]>>();
const toRad=(n:number)=>n*Math.PI/180;
export function stationDistanceKm(a:{lng:number;lat:number},b:{lng:number;lat:number}){const dlat=toRad(b.lat-a.lat),dlng=toRad(b.lng-a.lng);const h=Math.sin(dlat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dlng/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(h)));}
export function nearestStation(stations:Station[],point:{lng:number;lat:number},kind:StationKind){return stations.filter(s=>s.kind===kind).sort((a,b)=>stationDistanceKm(a,point)-stationDistanceKm(b,point))[0]??null;}
export function stationTileKey(lng:number,lat:number){return `${Math.floor(lng*10)}_${Math.floor(lat*10)}`;}
const root=`${import.meta.env.BASE_URL}data/stations/`;
const storage=(import.meta.env.VITE_SUPABASE_URL??'').trim().replace(/\/+$/,'');
const bucket='travelempire-stations';
const base=storage?`${storage}/storage/v1/object/public/${bucket}/`:root;
let manifestPromise:Promise<{version:number;tiles:string[]}>|undefined;
function stationManifest(){
 manifestPromise??=fetch(`${root}manifest.json`).then(async response=>{
  if(!response.ok)throw Error(`Station manifest unavailable (HTTP ${response.status})`);
  const value=await response.json() as {version:number;tiles:string[]};
  if(!Array.isArray(value.tiles))throw Error('Invalid station manifest');
  return value;
 }).catch(error=>{manifestPromise=undefined;throw error});
 return manifestPromise;
}
export async function loadStationTile(lng:number,lat:number,signal?:AbortSignal):Promise<Station[]>{
 const key=stationTileKey(lng,lat);const cached=cache.get(key);if(cached)return cached;
 const existing=inflight.get(key);if(existing)return existing;
 const task=(async()=>{
  const manifest=await stationManifest();
  if(!manifest.tiles.includes(key)){cache.set(key,[]);return [];}
  const response=await fetch(`${base}tiles/${encodeURIComponent(key)}.json`,{signal});
  if(!response.ok)throw Error(`Station tile ${key} unavailable (HTTP ${response.status}); verify Supabase bucket is public and upload completed`);
  const raw=await response.json() as Station[];
  if(!Array.isArray(raw))throw Error(`Invalid station tile ${key}`);
  const stations=raw.filter(s=>['fuel','charging','workshop'].includes(s.kind)&&Number.isFinite(s.lng)&&Number.isFinite(s.lat));
  cache.set(key,stations);return stations;
 })();inflight.set(key,task);try{return await task;}finally{inflight.delete(key);}
}
