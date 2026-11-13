import type {Taxi} from './taxi';

export type PassengerRouteIssue='missing-path'|'edge-count-mismatch'|'invalid-leg'|'invalid-coordinate'|null;

/** Verify the moving passenger's saved geometry before advancing it.
 * Geometry is never used to infer road connections: a replacement itinerary
 * must come from the directed OSM graph's actual route edges.
 */
export function passengerRouteIssue(taxi:Taxi):PassengerRouteIssue{
 if(taxi.status!=='TO_PICKUP'&&taxi.status!=='TO_DROPOFF')return null;
 if(taxi.path.length<2)return 'missing-path';
 if(taxi.edgeIds.length!==taxi.path.length-1)return 'edge-count-mismatch';
 if(!Number.isInteger(taxi.leg)||taxi.leg<0||taxi.leg>=taxi.path.length-1)return 'invalid-leg';
 const start=taxi.path[taxi.leg],end=taxi.path[taxi.leg+1];
 if(!start||!end||![...start,...end].every(Number.isFinite))return 'invalid-coordinate';
 return null;
}

/** Progress is measured on the directed route, not from map marker positions. */
export function passengerRouteAdvanced(
 before:Pick<Taxi,'leg'|'distanceIntoLeg'>,
 after:Pick<Taxi,'leg'|'distanceIntoLeg'>
):boolean{
 return after.leg>before.leg||
  (after.leg===before.leg&&after.distanceIntoLeg>before.distanceIntoLeg+0.2);
}
