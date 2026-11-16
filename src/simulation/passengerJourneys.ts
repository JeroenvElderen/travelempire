/** Phase 0: geographically varied passenger demand on the REAL directed
 * discovered road network. Long-distance searches run rarely and with
 * strict visit/attempt caps, especially on iPhone Safari.
 */
import {
 meters,passengerPairKey,passengerRouteMetres,pricedPassengerFare,
 routeDiscovered,type PassengerRequest,type Point,type RoadGraph,
} from './taxi';

export type PassengerTripType='local'|'regional'|'intercity';
export type TripBand={minMetres:number;maxMetres:number;minStraightMetres:number;maxVisits:number};
export const PASSENGER_TRIP_BANDS:Record<PassengerTripType,TripBand>={
 local:{minMetres:500,maxMetres:10000,minStraightMetres:200,maxVisits:150000},
 regional:{minMetres:10000,maxMetres:50000,minStraightMetres:6500,maxVisits:30000},
 intercity:{minMetres:50000,maxMetres:300000,minStraightMetres:38000,maxVisits:75000},
};
/** 75% local, 20% regional, 5% intercity. Failures use a local
 * fallback, not a fake route or a perpetual queue of impossible jobs. */
export function passengerTripTypeForAttempt(attempt:number):PassengerTripType{
 const slot=((Math.floor(attempt)%20)+20)%20;
 return slot<15?'local':slot<19?'regional':'intercity';
}

/** A request's quoted route is already validated. The destination isn't
 * confined to the pickup's depot region; both stops must be on genuinely
 * discovered roads, connected by a legal turn-aware route.
 */
export function createLongPassengerRequest(
 graph:RoadGraph,discovered:Set<string>,pickupStops:readonly string[],
 sampleDestinations:(origin:Point,minMetres:number,maxMetres:number,limit:number)=>readonly string[],
 tripType:'regional'|'intercity',now:number,surge=1,
 recentPairs:ReadonlySet<string>=new Set(),
 maxRoutingAttempts=2,
):PassengerRequest|null{
 if(pickupStops.length===0)return null;
 const band=PASSENGER_TRIP_BANDS[tripType];
 // A bounded number of origin and candidate routes, even with millions
 // of OSM nodes and a large discovered mainland component.
 const origins=Math.min(2,pickupStops.length);
 let routeAttempts=0;
 for(let i=0;i<origins;i++){
  const from=pickupStops[Math.floor(Math.random()*pickupStops.length)];
  const point=graph.nodes.get(from);
  if(!point)continue;
  const destinations=sampleDestinations(point,band.minStraightMetres,band.maxMetres,12);
  for(const to of destinations){
   if(from===to||routeAttempts>=maxRoutingAttempts)break;
   const end=graph.nodes.get(to);
   if(!end||!discovered.size)continue;
   const straight=meters(point,end);
   if(straight<band.minStraightMetres||straight>band.maxMetres)continue;
   if(recentPairs.has(passengerPairKey(point,end)))continue;
   routeAttempts++;
   // A direct line does not prove a road connection (islands, tunnels,
   // overpasses). Only real OSM-directed discovered roads are allowed.
   const candidate=routeDiscovered(graph,from,to,discovered,'',false,band.maxVisits);
   if(!candidate)continue;
   const actualDistance=passengerRouteMetres(candidate.path);
   if(actualDistance<band.minMetres||actualDistance>band.maxMetres)continue;
   return{
    id:crypto.randomUUID(),pickup:point,dropoff:end,
    fare:pricedPassengerFare(actualDistance,surge),fareMultiplier:surge,
    tripType,tripDistanceMeters:actualDistance,tripTravelSeconds:candidate.length,
    createdAt:now,expiresAt:now+120000,
   };
  }
  if(routeAttempts>=maxRoutingAttempts)break;
 }
 return null;
}

/** Prevent a large route from depleting the fuel tank mid-passenger trip.
 * Fuel also covers the empty legal pickup journey plus a 15% reserve.
 * Shift availability is verified by the existing Drivers roster on
 * assignment; the game's existing policy finishes an accepted booking.
 */
export function sufficientPassengerRange(
 availableRangeKm:number,pickupMetres:number,tripMetres:number,
):boolean{
 return Number.isFinite(availableRangeKm)&&Number.isFinite(pickupMetres)&&
  Number.isFinite(tripMetres)&&availableRangeKm>0&&pickupMetres>=0&&tripMetres>=0&&
  (pickupMetres+tripMetres)/1000<=availableRangeKm*0.85;
}

export function passengerTripTypeForMetres(distanceMetres:number):PassengerTripType{
 return distanceMetres>=50000?'intercity':distanceMetres>=10000?'regional':'local';
}
