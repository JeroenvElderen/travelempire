/** Shared class-by-class exploration policy for desktop planner workers and
 * iPhone's memory-saving inline dispatcher. Search budgets are never evidence
 * that a preferred road class is exhausted.
 */
import {planConnectedFrontier} from './connectedFrontier';
import {planReachableExplorerRoad,type ExplorerRoutePlan,type ExplorerRouteDiagnostic} from './explorerRoadPlanner';
import {specialistFallbackRoles,type SpecialistExplorerRole} from './explorerRoles';
import type {RoadGraph,Taxi} from './taxi';

export type ExplorerSearchState='planned'|'incomplete'|'exhausted';
export type ExplorerSearchDecision={
 route:ExplorerRoutePlan|null;
 diagnostic:ExplorerRouteDiagnostic;
 tier:Taxi['explorerRole'];
 state:ExplorerSearchState;
 reason:string;
};

/** "No target found within this budget" is not "no target exists". */
export function explorerSearchConclusive(reason:string):boolean{
 return reason==='no-connected-class-road'||reason==='one-way-no-legal-exit';
}

export const EXPLORER_ROLE_ORDER:readonly SpecialistExplorerRole[]=[
 'highway','primary','secondary','residential','poi',
];

/** Always resolve preferred class first. Lower-class fallback is allowed only
 * after BOTH connected-frontier and directed-exit search report a conclusive
 * failure. iOS may delay the more expensive fallback, but must not downgrade
 * a specialist while that check is pending.
 */
export function planSpecialistMission(
 graph:RoadGraph,startNode:string,discovered:ReadonlySet<string>,
 role:Taxi['explorerRole'],
 eligible:(tier:Taxi['explorerRole'])=>Set<string>,
 reservedEdges:ReadonlySet<string>,reservedTargets:ReadonlySet<string>,
 options:{fallbackAllowed?:boolean;maxVisits?:number}={},
):ExplorerSearchDecision{
 const tiers=specialistFallbackRoles(role);
 const searchTiers:Taxi['explorerRole'][]=tiers.length?tiers:[role];
 const fallbackAllowed=options.fallbackAllowed??true;
 for(const tier of searchTiers){
  const allowed=eligible(tier);
  const connected=planConnectedFrontier(graph,startNode,discovered,allowed,
   reservedEdges,reservedTargets,tier,options.maxVisits??(tier==='poi'?65000:75000));
  if(connected.route)return {...connected,tier,state:'planned',reason:'planned-connected'};
  // A bounded graph scan can have undiscovered frontiers beyond its cap.
  // Neither this result nor a low-priority class may override the preference.
  if(!explorerSearchConclusive(connected.diagnostic.reason))
   return {...connected,tier,state:'incomplete',reason:connected.diagnostic.reason};
  if(!fallbackAllowed)return {...connected,tier,state:'incomplete',reason:'directed-fallback-pending'};
  // Handles legal one-way exits and verified roundabouts not accepted by the
  // cheaper connected-frontier precheck.
  const directed=planReachableExplorerRoad(graph,startNode,new Set(discovered),allowed,
   new Set(reservedEdges),new Set(reservedTargets),tier);
  if(directed.route)return {...directed,tier,state:'planned',reason:'planned-directed'};
  if(!explorerSearchConclusive(directed.diagnostic.reason))
   return {...directed,tier,state:'incomplete',reason:directed.diagnostic.reason};
 }
 return {route:null,tier:searchTiers.at(-1)??role,state:'exhausted',
  reason:'no-reachable-specialist-frontier',
  diagnostic:{visitedPurpleNodes:0,reachableClassEdges:0,
   eligibleClassRoads:0,unsafeOneWaySkipped:0,reason:'no-reachable-specialist-frontier'}};
}
