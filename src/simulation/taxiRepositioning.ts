/**
 * Taxi Autopilot Phase 2 — demand-aware empty-vehicle repositioning.
 *
 * Only decides whether a move is useful. The dispatcher must still prove a
 * legal discovered-road route and the main game advances it with tickTaxi,
 * exactly as for a local/regional/intercity passenger journey.
 */
import {energyRangeKm} from './energy';
import type {Taxi} from './taxi';

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
