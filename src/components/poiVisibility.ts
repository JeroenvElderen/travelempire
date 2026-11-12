import type {Station} from '../data/stations';
import type {RestStop} from '../simulation/driverRest';
import type {Taxi,Point} from '../simulation/taxi';
import type {PropertyHolding} from '../investments';

type VisiblePoi={stations:Station[];restStops:RestStop[]};

/** Presentation only. All POIs remain available to the vehicle planners.
 * Owned hotels/parking are persistently visible; other POIs are shown only
 * while a vehicle is travelling to that particular destination.
 * Filtering occurs BEFORE any MapLibre DOM markers are instantiated.
 */
export function visibleOperationalPois(
 stations:readonly Station[],restStops:readonly RestStop[],
 holdings:readonly PropertyHolding[],vehicles:readonly Taxi[],
):VisiblePoi{
 const owned=new Map<string,RestStop>();
 for(const h of holdings){
  if(h.investedCents<=0||!Number.isFinite(h.position[0])||
   !Number.isFinite(h.position[1]))continue;
  owned.set(h.id,{id:h.id,kind:h.kind,name:h.name,position:h.position});
 }
 const stationTargets:Array<{point:Point;kind:'fuel'|'charging'|'workshop'}>=[];
 const restTargets=new Set<string>();
 const restPoints:Point[]=[];
 for(const t of vehicles){
  if(t.status!=='RETURNING'&&t.status!=='REFUELLING'&&t.status!=='SERVICING')continue;
  if(t.refillDestination)stationTargets.push({
   point:t.refillDestination,kind:t.vehicleFuel==='Electric'?'charging':'fuel'
  });
  if(t.serviceDestination)stationTargets.push({point:t.serviceDestination,kind:'workshop'});
  if(t.restStopPosition)restPoints.push(t.restStopPosition);
  if(t.restStopId){
   restTargets.add(t.restStopId);
   // Rest mission IDs are stored with a purpose prefix, e.g. hotel:123.
   // Some older saves use a parking/overnight prefix as well.
   const originalId=t.restStopId.replace(/^(?:overnight:parking:|hotel:|parking:)/,'');
   if(originalId)restTargets.add(originalId);
  }
 }
 // A target is never a license to show all facilities on the same tile.
 // A small tolerance handles differences between OSM POI and road-access
 // coordinates without making an unrelated nearby POI visible.
 const distance=(a:Point,b:Point)=>{
  const scale=Math.cos((a[1]+b[1])*Math.PI/360);
  return Math.hypot((a[0]-b[0])*111320*scale,(a[1]-b[1])*111320);
 };
 const stationById=new Map<string,Station>();
 for(const target of stationTargets){
  let closest:Station|undefined,best=120;
  for(const candidate of stations){
   if(candidate.kind!==target.kind)continue;
   const d=distance([candidate.lng,candidate.lat],target.point);
   if(d<best){best=d;closest=candidate;}
  }
  if(closest)stationById.set(closest.id,closest);
 }
 const selectedStops=new Map(owned);
 for(const stop of restStops){
  if(restTargets.has(stop.id))selectedStops.set(stop.id,stop);
 }
 for(const point of restPoints){
  let closest:RestStop|undefined,best=120;
  for(const candidate of restStops){
   const d=distance(candidate.position,point);
   if(d<best){best=d;closest=candidate;}
  }
  if(closest)selectedStops.set(closest.id,closest);
 }
 return {stations:[...stationById.values()],restStops:[...selectedStops.values()]};
}
