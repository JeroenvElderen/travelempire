import type {RoadGraph,Taxi} from './taxi';
import {explorerClassEligible} from './explorerRoles';

export type RestrictedExplorerRole='highway'|'primary'|'secondary'|'residential'|'poi';
const restricted:readonly RestrictedExplorerRole[]=['highway','primary','secondary','residential','poi'];

/** A specialist can leave only once a road of its class is directly
 * reachable at a junction on the HQ-connected purple network.
 *
 * Purple roads allow long-distance *transit*, but a red road of some
 * other class cannot be the initial bridge to a distant specialist target.
 * Already explored specialist edges also qualify, even after all local
 * frontier edges of that class have been finished.
 *
 * Iterate only the connected purple node index, not the whole OSM graph.
 */
export function unlockedSpecialistRoles(
 graph:RoadGraph,
 connectedPurpleNodes:ReadonlySet<string>,
 explored:ReadonlySet<string>,
 poiRoadIds:ReadonlySet<string>
):Set<RestrictedExplorerRole>{
 const unlocked=new Set<RestrictedExplorerRole>();
 if(!explored.size||!connectedPurpleNodes.size)return unlocked;
 for(const node of connectedPurpleNodes){
  for(const edge of graph.edges.get(node)??[]){
   if(edge.meters<=0)continue;
   if(poiRoadIds.has(edge.id))unlocked.add('poi');
   for(const role of restricted){
    if(role==='poi'||unlocked.has(role))continue;
    if(explorerClassEligible(role,edge.highway))unlocked.add(role);
   }
  }
  if(unlocked.size===restricted.length)break;
 }
 return unlocked;
}

export function specialistCanDepart(
 vehicle:Pick<Taxi,'kind'|'explorerRole'>,
 unlocked:ReadonlySet<RestrictedExplorerRole>
):boolean{
 if(vehicle.kind!=='explorer')return true;
 const role=vehicle.explorerRole;
 if(role==='highway'||role==='primary'||role==='secondary'||
    role==='residential'||role==='poi')return unlocked.has(role);
 return true;
}
