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
   const last=t.restStopId.split(':').at(-1);
   if(last)restTargets.add(last);
  }
 }
 // A target is never a license to show all facilities on the same tile.
 // A small tolerance handles differences between OSM POI and road-access
 // coordinates without making an unrelated nearby POI visible.
 const nearby=(a:Point,b:Point,radius=120)=>{
  const scale=Math.cos((a[1]+b[1])*Math.PI/360);
  return Math.hypot((a[0]-b[0])*111320*scale,(a[1]-b[1])*111320)<=radius;
 };
 const selectedStations=stations.filter(s=>stationTargets.some(target=>
  target.kind===s.kind&&nearby([s.lng,s.lat],target.point)));
 const selectedStops=[...owned.values()];
 for(const stop of restStops){
  if(owned.has(stop.id))continue;
  if(restTargets.has(stop.id)||restPoints.some(point=>nearby(point,stop.position))){
   selectedStops.push(stop);
  }
 }
 return {stations:selectedStations,restStops:selectedStops};
}
