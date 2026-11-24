import {parseSupplierTile,type CollectorSupplier} from '../collectorSuppliers';
import {stationTileKey} from './stations';
const local=import.meta.env.BASE_URL+'data/collector-suppliers/';
const storage=(import.meta.env.VITE_SUPABASE_URL??'').trim().replace(/\/+$/,'');
const remote=storage?storage+'/storage/v1/object/public/travelempire-collector-suppliers/':local;
let index:Promise<{base:string;tiles:Set<string>}>|undefined;
const cache=new Map<string,Promise<CollectorSupplier[]>>();
async function getIndex(){
 if(!index)index=(async()=>{
  for(const base of new Set([remote,local])){
   try{const response=await fetch(base+'manifest.json');if(!response.ok)continue;
    const data=await response.json();if(Array.isArray(data.tiles))return {base,tiles:new Set<string>(data.tiles)};
   }catch{/* optional dataset; use existing stations and district suppliers */}
  }
  return {base:local,tiles:new Set<string>()};
 })();
 return index;
}
export function loadCollectorSupplierTile(lng:number,lat:number):Promise<CollectorSupplier[]>{
 const key=stationTileKey(lng,lat);const existing=cache.get(key);if(existing)return existing;
 const task=(async()=>{
  const manifest=await getIndex();if(!manifest.tiles.has(key))return [];
  const response=await fetch(manifest.base+'tiles/'+encodeURIComponent(key)+'.json');
  if(!response.ok)throw Error('Supplier tile unavailable: '+key);
  return parseSupplierTile(await response.json());
 })().catch(error=>{cache.delete(key);throw error});
 cache.set(key,task);return task;
}
