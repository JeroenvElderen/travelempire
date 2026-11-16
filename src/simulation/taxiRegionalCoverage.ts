/** Establishing new taxi service areas from discovered connected roads.
 * Demand potential is a game heuristic; actual customers are generated
 * separately and road/shift/fuel safety is verified by the dispatcher.
 */
import {energyRangeKm} from './energy';
import {meters,type Taxi} from './taxi';
import type {DiscoveredServiceRegion} from './passengerDepotDemand';

export const COVERAGE_MIN_METRES=6500;
export const COVERAGE_MAX_ROAD_METRES=65000;
export const COVERAGE_MAX_STRAIGHT_METRES=65000;
export const COVERAGE_SUPPLY_RADIUS_METRES=4000;
export const COVERAGE_MAX_ROUTE_VISITS=28000;
export const COVERAGE_MIN_DISCOVERED_STOPS=8;

/** True only when the region does not already have an active taxi,
 * including taxis travelling there on a coverage mission. A manually
 * parked/off-shift vehicle does not count as deployed service.
 */
export function isCoverageUnderserved(
 region:Pick<DiscoveredServiceRegion,'position'>,
 fleet:readonly Taxi[],
):boolean{
 return !fleet.some(t=>
  (!t.kind||t.kind==='taxi')&&t.status!=='PAUSED'&&
  (meters(t.position,region.position)<COVERAGE_SUPPLY_RADIUS_METRES||
   t.status==='REPOSITIONING'&&!!t.repositionTarget&&
   meters(t.repositionTarget,region.position)<COVERAGE_SUPPLY_RADIUS_METRES));
}

/** Sort distant uncovered markets with a moderate empty-mileage penalty.
 * Does not infer a road connection from geographic proximity.
 */
export function rankUnservedCoverage(
 regions:readonly DiscoveredServiceRegion[],
 vehicle:Taxi,fleet:readonly Taxi[],limit=6,
):DiscoveredServiceRegion[]{
 return regions.filter(region=>{
  const km=meters(vehicle.position,region.position);
  return region.discoveredStops>=COVERAGE_MIN_DISCOVERED_STOPS&&
   km>=COVERAGE_MIN_METRES&&km<=COVERAGE_MAX_STRAIGHT_METRES&&
   isCoverageUnderserved(region,fleet);
 }).sort((a,b)=>coveragePotential(b,vehicle)-coveragePotential(a,vehicle))
  .slice(0,Math.max(0,limit));
}

function coveragePotential(region:DiscoveredServiceRegion,vehicle:Taxi):number{
 const km=meters(vehicle.position,region.position)/1000;
 return Math.log1p(region.discoveredStops)*10-km*.42;
}

/** A discovered road of any category is eligible for repositioning only
 * after its entire actual route is proven. Preserve at least 20 km fuel
 * range at arrival, not merely enough energy to reach the last OSM node.
 */
export function taxiCanCoverRegion(taxi:Taxi,roadMetres:number):boolean{
 if(!Number.isFinite(roadMetres)||roadMetres<COVERAGE_MIN_METRES||
  roadMetres>COVERAGE_MAX_ROAD_METRES)return false;
 const availableKm=energyRangeKm(taxi);
 return Number.isFinite(availableKm)&&
  availableKm-roadMetres/1000>=Math.max(20,availableKm*.25);
}

/** Prevent a new-service repositioning from monopolising almost the entire
 * remaining duty window. A long EMPTY move may span multiple shifts:
 * at off-duty time, the simulator stops safely at the next actual road
 * junction. New shifts can continue coverage. Driving speed is unchanged.
 */
export function taxiHasDutyForCoverage(
 routeRealSeconds:number,remainingDutyGameSeconds:number,
 gameSpeed=24,
):boolean{
 return Number.isFinite(routeRealSeconds)&&routeRealSeconds>0&&
  Number.isFinite(remainingDutyGameSeconds)&&remainingDutyGameSeconds>0&&
  Math.min(routeRealSeconds*gameSpeed+1800,1.5*3600)<=remainingDutyGameSeconds;
}
