import type {Taxi} from './taxi';

/** A restored RETURNING journey is valid as long as it has remaining route
 * legs. The worker must not throw that mission away after Safari refresh.
 * Old saves occasionally contain RETURNING with no usable route; only those
 * orphaned, non-operational journeys can be reset for fresh planning.
 */
export function isObsoleteExplorerReturn(t:Taxi,now:number):boolean{
 if(t.kind!=='explorer'||t.status!=='RETURNING'||!t.pauseAtHome)return false;
 if(t.path?.length>=2&&t.edgeIds?.length>0&&t.leg<t.edgeIds.length)return false;
 return !t.serviceDestination&&!t.refillDestination&&!t.restStopId&&
  !t.recoveryPending&&!t.refillRequested&&
  !(t.deliveryUntil&&t.deliveryUntil>now);
}
