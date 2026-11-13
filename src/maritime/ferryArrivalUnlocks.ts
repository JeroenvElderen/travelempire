import type {FerryArrival} from './ferryService';

/** The timetable route orientation matches the visible boat orientation.
 * A harbour unlocks ONLY after an actual completed outward/return sailing.
 * This does not unlock other harbours on the route or nearby map features.
 */
export function arrivedHarbourIds(
 arrivals:readonly Pick<FerryArrival,'routeId'|'direction'>[],
 orientedRoutes:ReadonlyMap<string,{from:string;to:string}>,
 knownPortIds:ReadonlySet<string>,
):string[]{
 const reached=new Set<string>();
 for(const arrival of arrivals){
  const route=orientedRoutes.get(arrival.routeId);
  if(!route)continue;
  const destination=arrival.direction==='outbound'?route.to:route.from;
  if(knownPortIds.has(destination))reached.add(destination);
 }
 return [...reached];
}
/** Merge permanent harbour achievements; safe for replayed/duplicate arrivals. */
export function mergeUnlockedHarbours(existing:readonly string[],arrivals:readonly string[]):string[]{
 return [...new Set([...existing,...arrivals])];
}
