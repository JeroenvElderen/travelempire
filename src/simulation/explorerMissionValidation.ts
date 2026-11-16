/** Validate an explorer mission at the point it is committed.
 * Both desktop planning results and iPhone's in-worker plans use this exact
 * policy. A geometric intersection is not a legal OSM junction.
 */
import {hasInvalidRedApproach} from './roundaboutTransit';
import {meters,type RoadGraph,type Point} from './taxi';
import type {PurpleStart} from './explorerStart';

export type ExplorerMissionCandidate={
 path:readonly Point[];
 edgeIds:readonly string[];
 discoveryEdgeIds:readonly string[];
 escapeTransitEdgeIds?:readonly string[];
};
export type ExplorerMissionValidation={ok:true;endNode:string}|{ok:false;reason:string};

export function validateExplorerMission(
 graph:RoadGraph,mission:ExplorerMissionCandidate,origin:Point,start:PurpleStart,
 discovered:ReadonlySet<string>,eligible:ReadonlySet<string>,
 reservedEdges:ReadonlySet<string>,reservedNodes:ReadonlySet<string>,
 allowReservedEndNode?:string,
):ExplorerMissionValidation{
 const fail=(reason:string):ExplorerMissionValidation=>({ok:false,reason});
 if(mission.path.length<2||mission.path.length!==mission.edgeIds.length+1)
  return fail('route-start-or-shape');
 if(meters(origin,mission.path[0])>20)return fail('route-start-or-shape');
 const selected=new Set(mission.discoveryEdgeIds);
 const escape=new Set(mission.escapeTransitEdgeIds??[]);
 if(!selected.size)return fail('missing-discovery-edge');
 const first=mission.edgeIds.findIndex(id=>selected.has(id));
 if(first<0||hasInvalidRedApproach(graph,mission.path,mission.edgeIds,discovered,selected))
  return fail('cross-class-red-before-first-discovery');
 for(const id of selected){
  if(discovered.has(id)||reservedEdges.has(id)||!eligible.has(id)||
   !mission.edgeIds.includes(id))return fail('reserved-or-wrong-class-discovery');
 }
 for(const id of escape){
  if(discovered.has(id)||selected.has(id)||reservedEdges.has(id)||
   !mission.edgeIds.includes(id))return fail('invalid-escape-transit');
 }
 // Validate every step in the same directed graph with explicit node
 // continuity. Avoid nearest() on each step: that can jump from a tunnel
 // node onto a nearby bridge node where their coordinates overlap.
 let cursor=start.node;
 const offset=start.connector;
 for(let i=0;i<mission.edgeIds.length;i++){
  const id=mission.edgeIds[i];
  if(!discovered.has(id)&&!selected.has(id)&&!escape.has(id))
   return fail('undiscovered-unassigned-road');
  if(i===0&&offset){
   if(id!==offset.edgeId||meters(offset.from,mission.path[0])>2||
    meters(offset.to,mission.path[1])>2)
    return fail('invalid-purple-start-connector');
   // The connector is the remaining directed purple edge from the
   // actual mid-segment position, ending at its legal downstream node.
   const endpoint=graph.nodes.get(cursor);
   // resolvePurpleExplorerStart already verified the upstream directed
   // road; never scan the nationwide graph to re-find that incoming edge.
   if(!endpoint||meters(endpoint,offset.to)>2||!discovered.has(id)||
    start.roadId!==id)return fail('invalid-purple-start-connector');
   continue;
  }
  const at=graph.nodes.get(cursor);
  if(!at||meters(at,mission.path[i])>2)return fail('route-node-disconnected');
  const directed=(graph.edges.get(cursor)??[]).find(e=>e.id===id&&e.meters>0&&
   !!graph.nodes.get(e.to)&&meters(graph.nodes.get(e.to)!,mission.path[i+1])<=2);
  if(!directed)return fail('road-direction-or-layer-disconnected');
  cursor=directed.to;
 }
 if(reservedNodes.has(cursor)&&cursor!==allowReservedEndNode)
  return fail('reserved-destination');
 return {ok:true,endNode:cursor};
}
