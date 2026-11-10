import {meters,nearest,type Point,type RoadGraph} from './taxi';
import {resolvePurpleExplorerStart} from './explorerStart';

export type ExplorerRecovery={
 path:Point[];
 edgeIds:string[];
 startRoadId:string;
 targetNode:string;
};

/** A stranded explorer may drive along loaded red roads, without revealing
 * them, to rejoin a real directed purple road. No teleport or fake graph edge.
 * Capped to limit iPhone worker CPU and memory use.
 */
export function routeStrandedExplorerToPurple(
 graph:RoadGraph,position:Point,discovered:Set<string>,
 roadEndpoints:Map<string,[string,string]>,
 nearbyRoads:Set<string>,maxNodes=6500,
):ExplorerRecovery|null{
 if(!discovered.size||!nearbyRoads.size)return null;
 // Identify the actual road beneath the vehicle even if its nearest OSM
 // junction is not purple. All candidate roads come from the local grid.
 const origin=resolvePurpleExplorerStart(graph,position,nearbyRoads,roadEndpoints,24,nearbyRoads);
 if(!origin)return null;
 const start=origin.node;
 const starts=graph.nodes.get(start);
 if(!starts)return null;
 const hasPurpleExit=(node:string)=>(graph.edges.get(node)??[]).some(edge=>
  edge.meters>0&&discovered.has(edge.id));
 if(hasPurpleExit(start))return null; // Already at a viable purple departure.
 const parent=new Map<string,{from:string;id:string}>();
 const queue:string[]=[start];
 const visited=new Set<string>([start]);
 let target:string|undefined;
 for(let i=0;i<queue.length&&i<maxNodes;i++){
  const node=queue[i];
  if(node!==start&&hasPurpleExit(node)){target=node;break;}
  for(const edge of graph.edges.get(node)??[]){
   if(edge.meters<=0||visited.has(edge.to))continue;
   const point=graph.nodes.get(edge.to);
   if(!point||meters(starts,point)>14000)continue;
   visited.add(edge.to);
   parent.set(edge.to,{from:node,id:edge.id});
   queue.push(edge.to);
   if(queue.length>=maxNodes*2)break;
  }
 }
 if(!target)return null;
 const keys:string[]=[target],ids:string[]=[];
 let at=target;
 while(at!==start){
  const step=parent.get(at);if(!step)return null;
  ids.push(step.id);keys.push(step.from);at=step.from;
 }
 keys.reverse();ids.reverse();
 const path=keys.map(k=>graph.nodes.get(k)!);
 if(origin.connector){
  path.unshift(position);ids.unshift(origin.connector.edgeId);
 }
 if(ids.length<1||ids.length!==path.length-1)return null;
 return {path,edgeIds:ids,startRoadId:origin.roadId,targetNode:target};
}
