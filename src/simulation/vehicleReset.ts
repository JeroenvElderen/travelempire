import type {Point,Taxi} from './taxi';

/** Instant user-requested reset, preserving the vehicle/driver while clearing
 * all movement and operational commitments bound to its old location.
 * The caller is responsible for finding an already-discovered depot road
 * and invalidating asynchronous worker responses.
 */
export function resetVehicleAtDepot(vehicle:Taxi,destination:Point):Taxi{
 return {...vehicle,
  position:[...destination] as Point,status:'IDLE',
  path:[],edgeIds:[],discoveryEdgeIds:[],escapeTransitEdgeIds:[],
  leg:0,distanceIntoLeg:0,speedKph:0,
  pickup:undefined,dropoff:undefined,fare:0,journeyEdges:[],
  pauseAtHome:false,shiftParked:false,scheduledShiftParked:false,routeInvalid:false,
  recoveryPending:false,restStopId:undefined,restStopName:undefined,
  restStopPosition:undefined,restUntilGameMs:undefined,
  scheduledBreakUntil:undefined,scheduledBreakPending:false,scheduledRestPending:false,
  refillDestination:undefined,refillRequested:false,refillAtDepot:undefined,
  serviceDestination:undefined,lastRoadFrom:undefined,lastRoadTo:undefined
 };
}
