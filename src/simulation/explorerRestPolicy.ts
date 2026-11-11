import type {Point} from './taxi';
import {meters} from './taxi';
import type {RestStop} from './driverRest';

/** Exploration must not be dominated by cross-city trips to a hotel.
 * Only route to facilities in the explorer's immediate working area.
 * A nearby parking/rest area is a safe overnight fallback when there is
 * no nearby hotel. If nothing is nearby, keep exploring until a stop loads.
 */
export function nearbyExplorerRestStops(
 position:Point,stops:readonly RestStop[],overnight:boolean
):RestStop[]{
 const maxDistance=overnight?3500:1800;
 const nearby=stops.filter(stop=>meters(position,stop.position)<=maxDistance);
 const hotels=overnight?nearby.filter(stop=>stop.kind==='hotel'):[];
 const parking=nearby.filter(stop=>stop.kind==='parking'||
  stop.kind==='services'||stop.kind==='rest_area');
 const pool=hotels.length?hotels:parking;
 return [...pool].sort((a,b)=>meters(position,a.position)-meters(position,b.position)).slice(0,8);
}
export function reasonableExplorerRestRoute(
 path:readonly Point[],overnight:boolean
):boolean{
 if(path.length===0)return false;
 let distance=0;
 for(let i=1;i<path.length;i++)distance+=meters(path[i-1],path[i]);
 return distance<=(overnight?6500:3500);
}
