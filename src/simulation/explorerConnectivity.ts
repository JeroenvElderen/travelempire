import type {RoadGraph,Taxi} from './taxi';

/** Directed reachability from the explorer's actual road node.
 * Scans ONLY already-discovered roads. Never treats geometrically crossing
 * roads, nearby vertices, tunnels or bridges as graph connections.
 * The caller caps visits on mobile; incomplete results are explicit.
 */
export type DirectedComponentReport={
 origin:string;visited:number;complete:boolean;discoveredEdges:number;
 eligibleFrontiers:number;reservedFrontiers:number;oneWayDeadEnds:number;
 hqReachable:boolean;boundaryNodes:number;
};
export function inspectExplorerComponent(
 graph:RoadGraph,start:string,discovered:ReadonlySet<string>,
 eligible:ReadonlySet<string>,reserved:ReadonlySet<string>,
 hqNode:string|null,maxNodes=14000
):DirectedComponentReport{
 const report:DirectedComponentReport={origin:start,visited:0,complete:true,
  discoveredEdges:0,eligibleFrontiers:0,reservedFrontiers:0,
  oneWayDeadEnds:0,hqReachable:false,boundaryNodes:0};
 if(!graph.nodes.has(start))return report;
 const queue=[start],seen=new Set([start]);
 const frontierIds=new Set<string>(),reservedIds=new Set<string>();
 const purpleIds=new Set<string>();
 for(let i=0;i<queue.length;i++){
  if(i>=maxNodes){report.complete=false;break;}
  const node=queue[i];report.visited++;
  if(node===hqNode)report.hqReachable=true;
  const links=graph.edges.get(node)??[];
  if(links.length===0)report.boundaryNodes++;
  let directedDiscovered=0;
  for(const edge of links){
   if(edge.meters<=0)continue;
   if(discovered.has(edge.id)){
    directedDiscovered++;purpleIds.add(edge.id);
    if(!seen.has(edge.to)&&graph.nodes.has(edge.to)){
     seen.add(edge.to);queue.push(edge.to);
    }
   }else if(eligible.has(edge.id)){
    if(reserved.has(edge.id))reservedIds.add(edge.id);
    else frontierIds.add(edge.id);
   }
  }
  if(directedDiscovered===0)report.oneWayDeadEnds++;
 }
 report.discoveredEdges=purpleIds.size;
 report.eligibleFrontiers=frontierIds.size;
 report.reservedFrontiers=reservedIds.size;
 return report;
}

/** Retry a failed scan when the road graph, explored edges, or vehicle's
 * directed starting node changes. The time window is a safeguard rather
 * than a permanent lock; reservations may change without graph growth.
 */
export function componentFailureSignature(
 origin:string,loadedRoads:number,discoveredRoads:number,role:Taxi['explorerRole']
):string{
 return [origin,loadedRoads,discoveredRoads,role??'balanced'].join('|');
}
