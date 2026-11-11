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
 const depot=company.depots?.find(d=>d.id===taxi.depotId);
 const home:ShiftRestTarget=depot?
  {id:'depot:'+depot.id,name:depot.name,kind:'depot',position:[depot.lng,depot.lat]}:
  {id:'depot:main',name:'Headquarters',kind:'depot',
   position:[company.headquarters.lng,company.headquarters.lat]};
 const options:ShiftRestTarget[]=[home];
 for(const stop of stops){
  if(overnight?stop.kind!=='hotel':
    !['parking','rest_area','services'].includes(stop.kind))continue;
  options.push({id:stop.id,name:stop.name,
   kind:stop.kind==='hotel'?'hotel':'parking',position:stop.position});
 }
 // Drivers should use nearby hotels for long rest, with their own depot as
 // fallback. Short breaks use parking where possible, not roadside pauses.
 options.sort((a,b)=>{
  const da=meters(taxi.position,a.position),db=meters(taxi.position,b.position);
  if(Math.abs(da-db)>30)return da-db;
  return a.kind==='depot'?-1:b.kind==='depot'?1:0;
 });
 return options.slice(0,12);
}

/** A taxi may show Zzz only when physically at the requested rest facility. */
export function isAtShiftRestStop(vehicle:Taxi,stop:ShiftRestTarget,maxDistance=90):boolean{
 return meters(vehicle.position,stop.position)<=maxDistance;
}
