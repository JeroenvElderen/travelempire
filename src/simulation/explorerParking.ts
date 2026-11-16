/** Decide whether an old PAUSED/shiftParked explorer is waiting on roads
 * rather than taking an actual scheduled rest or completing an operation.
 *
 * Legacy saves did not persist the worker's autoParkedExplorers map. Older
 * App versions also mistakenly assigned a 30-minute restUntilGameMs timer
 * to these road-wait states. A timer *without a real rest-stop identity*
 * must never lock an explorer indefinitely.
 */
import type {Taxi} from './taxi';

export type ExplorerParkingState=Pick<Taxi,
 'kind'|'status'|'shiftParked'|'scheduledShiftParked'|'restStopId'|
 'restUntilGameMs'|'pauseAtHome'|'ferryTrip'|'recoveryPending'|
 'refillRequested'|'refillDestination'|'serviceDestination'|'deliveryUntil'
>;

export function explorerWaitingForRoads(vehicle:ExplorerParkingState):boolean{
 return vehicle.kind==='explorer'&&vehicle.status==='PAUSED'&&
  !!vehicle.shiftParked&&!vehicle.scheduledShiftParked&&
  !vehicle.restStopId&&!vehicle.pauseAtHome&&!vehicle.ferryTrip&&
  !vehicle.recoveryPending&&!vehicle.refillRequested&&
  !vehicle.refillDestination&&!vehicle.serviceDestination;
}

/** Preserve scheduled/manual rest even when worker road data changes.
 * A historical timer by itself is not proof of an actual rest location.
 */
export function explorerOnActualRest(vehicle:ExplorerParkingState):boolean{
 return vehicle.kind==='explorer'&&vehicle.status==='PAUSED'&&
  !!vehicle.shiftParked&&!explorerWaitingForRoads(vehicle);
}
