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

/** These current specialists must never fall through to the legacy regional
 * route generator, which does not enforce every directed-return condition.
 * Legacy role aliases remain available for migrated saves.
 */
export function usesAutopilotRoutePlanner(role:Taxi['explorerRole']):boolean{
 return role!==undefined&&(EXPLORER_ROLE_ORDER as readonly string[]).includes(role);
}

/** Treat the vehicle's specialisation as a preference, never a hard lock.
 * Search its preferred class FIRST, with the same directed safety rules.
 * If no mission is available in this bounded pass, search all drivable
 * types locally instead of endlessly idling for a specialist road.
 *
 * A timed-out preferred-class search is NOT proof of exhaustion. Fallback
 * assignments are opportunistic: the next mission prioritises own class
 * again. True exhaustion (for paid ferries) requires conclusive results
 * from both preferred and all-road searches.
 */
export function planSpecialistMission(
 graph:RoadGraph,startNode:string,discovered:ReadonlySet<string>,
 role:Taxi['explorerRole'],
 eligible:(tier:Taxi['explorerRole'])=>Set<string>,
 reservedEdges:ReadonlySet<string>,reservedTargets:ReadonlySet<string>,
 options:{fallbackAllowed?:boolean;maxVisits?:number}={},
):ExplorerSearchDecision{
 const tiers=specialistFallbackRoles(role);
 const preferred=tiers[0]??role;
 const allTier=tiers.length>1?'balanced' as const:preferred;
 const maxVisits=options.maxVisits??(preferred==='poi'?65000:75000);
 const fallbackAllowed=options.fallbackAllowed??true;
 const firstAllowed=eligible(preferred);
 const primary=planConnectedFrontier(graph,startNode,discovered,firstAllowed,
  reservedEdges,reservedTargets,preferred,maxVisits);
 if(primary.route)return {...primary,tier:preferred,state:'planned',reason:'planned-priority-class'};

 // A directed escape search is expensive on iPhone, so only run it when
 // the existing scheduler has allowed this attempt.
 let unresolved:ExplorerSearchDecision|null=
  !explorerSearchConclusive(primary.diagnostic.reason)?
   {...primary,tier:preferred,state:'incomplete',reason:primary.diagnostic.reason}:null;
 if(fallbackAllowed&&explorerSearchConclusive(primary.diagnostic.reason)){
  const directed=planReachableExplorerRoad(graph,startNode,new Set(discovered),
   firstAllowed,new Set(reservedEdges),new Set(reservedTargets),preferred);
  if(directed.route)return {...directed,tier:preferred,state:'planned',reason:'planned-priority-directed'};
  if(!explorerSearchConclusive(directed.diagnostic.reason)&&!unresolved)
   unresolved={...directed,tier:preferred,state:'incomplete',reason:directed.diagnostic.reason};
 }else if(!unresolved){
  unresolved={...primary,tier:preferred,state:'incomplete',reason:'directed-fallback-pending'};
 }
 if(allTier===preferred)return unresolved??{
  route:null,tier:preferred,state:'exhausted',reason:'no-reachable-specialist-frontier',
  diagnostic:primary.diagnostic,
 };

 // One smaller, connected search considers ALL other road types in one
 // pass, instead of five large, class-by-class searches on iPhone.
 const allEligible=eligible(allTier);
 const nearbyBudget=Math.max(1,Math.min(maxVisits,5000));
 const opportunistic=planConnectedFrontier(graph,startNode,discovered,
  allEligible,reservedEdges,reservedTargets,allTier,nearbyBudget);
 if(opportunistic.route)return {
  ...opportunistic,tier:allTier,state:'planned',reason:'planned-other-class',
 };
 if(!explorerSearchConclusive(opportunistic.diagnostic.reason)&&!unresolved)
  unresolved={...opportunistic,tier:allTier,state:'incomplete',reason:opportunistic.diagnostic.reason};

 // Directed one-way fallback remains available, but only after the cheap
 // all-road frontier scan completes without a route.
 if(fallbackAllowed&&explorerSearchConclusive(opportunistic.diagnostic.reason)){
  const directed=planReachableExplorerRoad(graph,startNode,new Set(discovered),
   allEligible,new Set(reservedEdges),new Set(reservedTargets),allTier);
  if(directed.route)return {...directed,tier:allTier,state:'planned',reason:'planned-other-class-directed'};
  if(!explorerSearchConclusive(directed.diagnostic.reason)&&!unresolved)
   unresolved={...directed,tier:allTier,state:'incomplete',reason:directed.diagnostic.reason};
 }else if(!fallbackAllowed&&!unresolved){
  unresolved={...opportunistic,tier:allTier,state:'incomplete',reason:'directed-fallback-pending'};
 }
 // Never grant a ferry ticket if any preceding search hit a node budget.
 if(unresolved)return unresolved;
 return {route:null,tier:allTier,state:'exhausted',
  reason:'no-reachable-specialist-frontier',diagnostic:opportunistic.diagnostic};
}
