/** Offline OpenStreetMap rest POI tiles, using the same 0.1° grid as stations. */
import {stationTileKey} from './stations';
import type {RestStop,RestStopKind} from '../simulation/driverRest';
const root=`${import.meta.env.BASE_URL}data/rest-stops/`;
const storage=(import.meta.env.VITE_SUPABASE_URL??'').trim().replace(/\\/+$/,'');
const base=storage?`${storage}/storage/v1/object/public/travelempire-rest-stops/`:root;
const cache=new Map<string,RestStop[]>();
const inflight=new Map<string,Promise<RestStop[]>>();
let manifestPromise:Promise<Set<string>>|undefined;
async function manifest():Promise<Set<string>>{
 manifestPromise??=fetch(base+'manifest.json').then(async response=>{
  if(response.status===404)return new Set<string>();
  if(!response.ok)throw Error('Rest POI manifest HTTP '+response.status);
  const data=await response.json() as {tiles?:string[]};
  return new Set(data.tiles??[]);
 }).catch(error=>{manifestPromise=undefined;throw error});
 return manifestPromise;
}
const kinds=new Set<RestStopKind>(['parking','rest_area','services','hotel']);
export async function loadRestStopTile(lng:number,lat:number):Promise<RestStop[]>{
 const key=stationTileKey(lng,lat);
 if(cache.has(key))return cache.get(key)!;
 const pending=inflight.get(key);if(pending)return pending;
 const task=(async()=>{
  const tiles=await manifest();
  if(!tiles.has(key)){cache.set(key,[]);return [];}
  const response=await fetch(base+'tiles/'+encodeURIComponent(key)+'.json');
  if(!response.ok)throw Error('Rest POI tile '+key+' HTTP '+response.status);
  const raw=await response.json() as Array<{id:string;kind:RestStopKind;name:string;lng:number;lat:number;roadEdgeId?:string}>;
  if(!Array.isArray(raw))throw Error('Invalid rest POI tile '+key);
  const result:RestStop[]=raw.filter(p=>p.id&&kinds.has(p.kind)&&Number.isFinite(p.lng)&&Number.isFinite(p.lat)).map(p=>({id:p.id,kind:p.kind,name:p.name||p.kind,position:[p.lng,p.lat],roadEdgeId:p.roadEdgeId}));
  cache.set(key,result);return result;
 })();
 inflight.set(key,task);
 try{return await task;}finally{inflight.delete(key);}
}
