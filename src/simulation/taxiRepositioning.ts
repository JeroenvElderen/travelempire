/**
 * Taxi Autopilot Phase 2 — demand-aware empty-vehicle repositioning.
 *
 * Only decides whether a move is useful. The dispatcher must still prove a
 * legal discovered-road route and the main game advances it with tickTaxi,
 * exactly as for a local/regional/intercity passenger journey.
 */
import {energyRangeKm} from './energy';
import {meters,type Point,type Taxi} from './taxi';

export const TAXI_REPOSITION_MIN_IDLE_MS=60000;
export const TAXI_REPOSITION_MIN_METRES=1400;
export const TAXI_REPOSITION_MAX_METRES=8000;
export const TAXI_REPOSITION_COOLDOWN_MS=120000;
export const TAXI_REPOSITION_GLOBAL_INTERVAL_MS=25000;

export type TaxiDemandSignal={
 localStops:number;
 pendingPickups:number;
 competingIdleTaxis:number;
};

/** Effective supply at a destination: idle and committed empty arrivals
 * count fully, paid drop-offs count partially. A vehicle cannot count in
 * two markets at once. Resting or operationally unavailable vehicles do
 * not provide passenger supply. */
export function projectedTaxiSupply(point:Point,fleet:readonly Taxi[],excludeId:string,availableIds?:ReadonlySet<string>,radius=2500):number{
 let supply=0;
 for(const t of fleet){
  if(t.id===excludeId||(t.kind&&t.kind!=='taxi')||t.shiftParked||t.scheduledShiftParked||
   t.scheduledBreakPending||t.scheduledRestPending||t.restStopId||t.ferryTrip||
   t.recoveryPending||t.refillRequested||t.refillDestination||t.serviceDestination||t.deliveryUntil)continue;
  if(t.status==='IDLE'&&(!availableIds||availableIds.has(t.id))&&meters(t.position,point)<=radius)supply++;
  else if(t.status==='REPOSITIONING'&&!t.repositionStopPending&&t.repositionTarget&&meters(t.repositionTarget,point)<=radius)supply++;
  else if((t.status==='TO_PICKUP'||t.status==='TO_DROPOFF')&&t.dropoff&&meters(t.dropoff,point)<=radius)supply+=.5;
 }
 return supply;
}

/** Do not remove the last idle taxi from a market with a waiting customer.
 * A taxi can still expand from a market with no queue or spare capacity. */
export function taxiCanLeaveMarket(waiting:number,otherIdle:number):boolean{
 return waiting<=otherIdle;
}

/** A transparent demand proxy, not an invented promise of passengers.
 * Actual waiting passengers count strongly; road-stop density provides
 * smaller coverage potential, reduced by competing idle vehicles.
 */
export function taxiDemandScore(signal:TaxiDemandSignal):number{
 const stopScore=Math.log1p(Math.max(0,signal.localStops))*8;
 return stopScore+Math.min(5,Math.max(0,signal.pendingPickups))*28-
  Math.min(10,Math.max(0,signal.competingIdleTaxis))*13;
}

/** Require a clear expected improvement to avoid endlessly moving between
 * similarly busy streets and burning fuel/driver time.
 */
export function taxiRepositionWorthwhile(
 current:TaxiDemandSignal,destination:TaxiDemandSignal,
 straightMetres:number,
):boolean{
 if(!Number.isFinite(straightMetres)||
  straightMetres<TAXI_REPOSITION_MIN_METRES||
  straightMetres>TAXI_REPOSITION_MAX_METRES*1.2)return false;
 // Do not move into a market whose waiting demand is already covered
 // when there is no meaningful discovered-road density advantage.
 if(destination.competingIdleTaxis>=Math.max(1,destination.pendingPickups)&&
    destination.localStops<=current.localStops)return false;
 const advantage=taxiDemandScore(destination)-taxiDemandScore(current);
 const travelPenalty=straightMetres/1000*1.4;
 return advantage>10+travelPenalty;
}

export function taxiCanStartRepositioning(
 taxi:Taxi,now:number,available:boolean,idleSince:number,
):boolean{
 if((taxi.kind&&taxi.kind!=='taxi')||taxi.status!=='IDLE'||
  !available||taxi.shiftParked||taxi.scheduledShiftParked||
  !!taxi.restStopId||!!taxi.pauseAtHome||
  !!taxi.refillRequested||!!taxi.refillDestination||
  !!taxi.serviceDestination||!!taxi.recoveryPending||
  !!taxi.ferryTrip||!!taxi.deliveryUntil)return false;
 if(!Number.isFinite(now)||!Number.isFinite(idleSince)||
  now-idleSince<TAXI_REPOSITION_MIN_IDLE_MS||
  now-(taxi.lastRepositionAt??-Infinity)<TAXI_REPOSITION_COOLDOWN_MS)return false;
 // Keep substantial range for reaching fuel, pickup and a later paid trip.
 return energyRangeKm(taxi)>=24;
}

export function taxiCanCompleteRepositioning(
 taxi:Taxi,routeMetres:number,
):boolean{
 return Number.isFinite(routeMetres)&&
  routeMetres>=TAXI_REPOSITION_MIN_METRES&&
  routeMetres<=TAXI_REPOSITION_MAX_METRES&&
  routeMetres/1000<=energyRangeKm(taxi)*.6;
}
