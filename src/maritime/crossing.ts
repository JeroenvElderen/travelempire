import type {Point,Taxi} from '../simulation/taxi';
import {meters} from '../simulation/taxi';
import type {FerryJourneyLeg} from './routePlanning';
import type {FerryNetwork} from './ferries';
export type FerryCrossing={vehicleId:string;routeId:string;fromPortId:string;toPortId:string;elapsedSeconds:number;durationSeconds:number;geometry:Point[];previousStatus:Taxi['status']};
export type FerryCrossingUpdate={crossing:FerryCrossing|null;position:Point;arrived:boolean};
/** Refuse boarding without ownership and a matching imported route. */
export function boardFerry(vehicle:Taxi,leg:Extract<FerryJourneyLeg,{kind:'ferry'}>,network:FerryNetwork,owned:ReadonlySet<string>):FerryCrossing|null{
 const route=network.routes.find(r=>r.id===leg.routeId);
 if(!route||!owned.has(route.id)||!Number.isFinite(route.durationMinutes)||route.durationMinutes<=0)return null;
 if(!((route.from===leg.fromPortId&&route.to===leg.toPortId)||(route.to===leg.fromPortId&&route.from===leg.toPortId)))return null;
 if(leg.geometry.length<2||!leg.geometry.every(p=>p.length===2&&p.every(Number.isFinite)))return null;
 return {vehicleId:vehicle.id,routeId:route.id,fromPortId:leg.fromPortId,toPortId:leg.toPortId,elapsedSeconds:0,durationSeconds:route.durationMinutes*60,geometry:leg.geometry.map(p=>[...p] as Point),previousStatus:vehicle.status};
}
/** Interpolate along the imported ferry geometry, not a straight-line shortcut. */
export function crossingPosition(geometry:Point[],progress:number):Point{
 if(!geometry.length)throw new Error('Ferry crossing has no geometry');
 if(geometry.length===1)return geometry[0];
 const lengths=geometry.slice(1).map((p,i)=>meters(geometry[i],p));
 const total=lengths.reduce((a,b)=>a+b,0);
 if(total<=0)return geometry[0];
 let remaining=Math.max(0,Math.min(1,progress))*total;
 for(let i=0;i<lengths.length;i++){
  if(remaining<=lengths[i]||i===lengths.length-1){
   const t=lengths[i]>0?Math.min(1,remaining/lengths[i]):0;
   return [geometry[i][0]+(geometry[i+1][0]-geometry[i][0])*t,geometry[i][1]+(geometry[i+1][1]-geometry[i][1])*t];
  }
  remaining-=lengths[i];
 }
 return geometry[geometry.length-1];
}
/** Advance with game seconds; does not add road mileage, fuel usage or discovery. */
export function advanceFerryCrossing(crossing:FerryCrossing,gameSeconds:number):FerryCrossingUpdate{
 if(!Number.isFinite(gameSeconds)||gameSeconds<0)throw new Error('Invalid ferry time step');
 const elapsedSeconds=Math.min(crossing.durationSeconds,crossing.elapsedSeconds+gameSeconds);
 const arrived=elapsedSeconds>=crossing.durationSeconds;
 return {crossing:arrived?null:{...crossing,elapsedSeconds},position:crossingPosition(crossing.geometry,elapsedSeconds/crossing.durationSeconds),arrived};
}
