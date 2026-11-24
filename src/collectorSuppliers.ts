import {COLLECTOR_PARTS,type CollectorPart} from './resourceCollectors';
import type {Station} from './data/stations';
import type {PassengerDemandPlace} from './simulation/passengerPlaces';
import type {Point} from './simulation/taxi';

export type CollectorSupplier={id:string;name:string;position:Point;parts:readonly CollectorPart[];source:'osm'|'district'|'harbour'|'station'};
export function stationSupplier(station:Station):CollectorSupplier|null{
 if(station.access==='private'||station.access==='no')return null;
 return {id:'station:'+station.id,name:station.name||station.kind,position:[station.lng,station.lat],parts:station.kind==='workshop'?['mechanical']:['energy'],source:'station'};
}
export function placeSupplier(place:PassengerDemandPlace):CollectorSupplier|null{
 if(place.kind==='harbour')return {id:place.id,name:place.name,position:place.position,parts:['marine'],source:'harbour'};
 if(place.kind==='business')return {id:place.id,name:place.name,position:place.position,parts:['business','research'],source:'district'};
 if(place.kind==='airport')return {id:place.id,name:place.name,position:place.position,parts:['electronics','rare'],source:'district'};
 return null;
}
export function parseSupplierTile(input:unknown):CollectorSupplier[]{
 if(!Array.isArray(input))throw Error('Invalid supplier tile');
 return input.flatMap(row=>{
  if(!row||typeof row.id!=='string'||typeof row.name!=='string'||!Number.isFinite(row.lng)||!Number.isFinite(row.lat)||Math.abs(row.lng)>180||Math.abs(row.lat)>90||!Array.isArray(row.parts))return [];
  const parts=COLLECTOR_PARTS.filter(p=>row.parts.includes(p));
  return parts.length?[{id:'osm:'+row.id,name:row.name,position:[row.lng,row.lat] as Point,parts,source:'osm' as const}]:[];
 });
}
