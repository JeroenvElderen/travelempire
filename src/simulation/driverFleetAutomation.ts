/**
 * Taxi Autopilot Phase 3 — zero-teleport depot staffing.
 *
 * An opt-in roster may reassign a FREE on-duty employee to an IDLE taxi whose
 * driver is off duty. The taxi must already be physically at its own depot,
 * and the replacement must be registered at that same depot. Never replace
 * someone during a fare, empty repositioning, fuel/service, recovery or rest.
 */
import type {DriverRecord,Point,Taxi} from './taxi';
import {meters} from './taxi';
import {canAcceptPassengerJob,driverSchedule} from './driverSchedule';

export type DriverDepotLocation={id:string;position:Point};
export const DRIVER_HANDOVER_MAX_DISTANCE_M=220;
export const DRIVER_HANDOVER_COOLDOWN_GAME_MS=30*60*1000;

export function taxiAvailableForDriverHandover(
 taxi:Taxi,depots:readonly DriverDepotLocation[],gameEpochMs:number,
):boolean{
 if((taxi.kind&&taxi.kind!=='taxi')||taxi.status!=='IDLE'||
  taxi.shiftParked||taxi.scheduledShiftParked||taxi.pauseAtHome||
  taxi.recoveryPending||taxi.refillRequested||taxi.refillDestination||
  taxi.serviceDestination||taxi.restStopId||taxi.ferryTrip||
  taxi.repositionTarget||taxi.deliveryUntil||
  taxi.activeJobId||taxi.pickup||taxi.dropoff)return false;
 if(!Number.isFinite(gameEpochMs)||
  gameEpochMs-(taxi.lastDriverHandoverGameMs??-Infinity)<
   DRIVER_HANDOVER_COOLDOWN_GAME_MS)return false;
 const depot=depots.find(d=>d.id===(taxi.depotId??'main'));
 return !!depot&&meters(taxi.position,depot.position)<=
  DRIVER_HANDOVER_MAX_DISTANCE_M;
}

/** Only the vehicles array changes. Existing employee IDs/statistics,
 * passenger requests and vehicle locations are never modified.
 */
export function automaticallyStaffIdleTaxis(
 taxis:readonly Taxi[],drivers:readonly DriverRecord[],
 depots:readonly DriverDepotLocation[],gameEpochMs:number,
 enabled:boolean,
):Taxi[]{
 if(!enabled||taxis.length===0||drivers.length===0)return [...taxis];
 const assigned=new Set(taxis.map(t=>t.driver.toLowerCase()));
 const allDrivers=[...drivers];
 const free=allDrivers.filter(d=>!assigned.has(d.name.toLowerCase()))
  .sort((a,b)=>a.hiredAt-b.hiredAt||a.id.localeCompare(b.id));
 if(!free.length)return [...taxis];
 return taxis.map(taxi=>{
  if(!taxiAvailableForDriverHandover(taxi,depots,gameEpochMs)||
     driverSchedule(taxi,allDrivers,gameEpochMs).onDuty)return taxi;
  const depotId=taxi.depotId??'main';
  const candidateIndex=free.findIndex(driver=>
   (driver.homeDepotId??'main')===depotId&&
   canAcceptPassengerJob({...taxi,driver:driver.name},allDrivers,gameEpochMs));
  if(candidateIndex<0)return taxi;
  const replacement=free.splice(candidateIndex,1)[0];
  assigned.add(replacement.name.toLowerCase());
  return {...taxi,driver:replacement.name,
   lastDriverHandoverGameMs:gameEpochMs};
 });
}
