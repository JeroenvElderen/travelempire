import type {Company} from '../company';
import type {Taxi,Point} from './taxi';
import {meters} from './taxi';
import type {RestStop} from './driverRest';

export type ShiftRestTarget={id:string;name:string;kind:'hotel'|'parking'|'depot';position:Point};

/** Sorted candidates for an off-duty driver. Roads are checked separately
 * by the routing worker: a visually nearby hotel may not be reachable.
 */
export function shiftRestTargets(taxi:Taxi,stops:readonly RestStop[],
 company:Company,overnight:boolean):ShiftRestTarget[]{
 // Depot is headquarters/delivery/storage only; an off-duty taxi stays
 // in its current operating region instead of driving back to headquarters.
 void company;
 // Overnight hotel first when reasonably close; otherwise local parking
 // and the assigned depot are valid. All candidates must be road-accessible.
 const hotels:ShiftRestTarget[]=[];
 const parking:ShiftRestTarget[]=[];
 for(const stop of stops){
  const kind=stop.kind==='hotel'?'hotel' as const:
   ['parking','rest_area','services'].includes(stop.kind)?'parking' as const:null;
  if(!kind)continue;
  const option:ShiftRestTarget={id:stop.id,name:stop.name,kind,position:stop.position};
  if(kind==='hotel')hotels.push(option);else parking.push(option);
 }
 const nearby=(a:ShiftRestTarget,b:ShiftRestTarget)=>
  meters(taxi.position,a.position)-meters(taxi.position,b.position);
 hotels.sort(nearby);parking.sort(nearby);
 // Use local hotels or parking only; never automatically send an
 // off-duty taxi across the island to a depot. If none is reachable,
 // it remains off duty and retries finding a legal local rest stop.
 const preferred=overnight?[
  ...hotels.filter(s=>meters(taxi.position,s.position)<=5000),
  ...parking.filter(s=>meters(taxi.position,s.position)<=3000),
  ...hotels,...parking
 ]:parking;
 const seen=new Set<string>();
 return preferred.filter(s=>{if(seen.has(s.id))return false;seen.add(s.id);return true;}).slice(0,12);
}

/** A taxi may show Zzz only when physically at the requested rest facility. */
export function isAtShiftRestStop(vehicle:Taxi,stop:ShiftRestTarget,maxDistance=90):boolean{
 return meters(vehicle.position,stop.position)<=maxDistance;
}
