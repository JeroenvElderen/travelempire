import type {MobilityMode,MobilityPoint,MobilitySegment} from '../data/mobilityTiles';

export type MobilityEdge={
 id:string;from:string;to:string;a:MobilityPoint;b:MobilityPoint;length:number;
 highway:string;bridge?:boolean;tunnel?:boolean;layer?:number;
};
export type MobilityGraph={
 nodes:Map<string,MobilityPoint>;
 outgoing:Map<string,MobilityEdge[]>;
 ids:Set<string>;
};
export type MobilitySession={
 mode:MobilityMode;portId:string;node:string;position:MobilityPoint;
 path:MobilityEdge[];leg:number;distanceIntoLeg:number;status:'exploring'|'waiting'|'complete';
};
export const mobilityMetres=(a:MobilityPoint,b:MobilityPoint):number=>{
 const latitude=(a[1]+b[1])*Math.PI/360;
 return Math.hypot((a[0]-b[0])*111320*Math.cos(latitude),(a[1]-b[1])*111320);
};
export function emptyMobilityGraph():MobilityGraph{
 return{nodes:new Map(),outgoing:new Map(),ids:new Set()};
}
export function appendMobilityRoads(graph:MobilityGraph,roads:readonly MobilitySegment[],mode:MobilityMode):number{
 let added=0;
 const add=(from:string,to:string,a:MobilityPoint,b:MobilityPoint,road:MobilitySegment)=>{
  let links=graph.outgoing.get(from);
  if(!links){links=[];graph.outgoing.set(from,links)}
  links.push({id:road.id,from,to,a,b,length:road.length,highway:road.highway,
   layer:road.layer,bridge:road.bridge,tunnel:road.tunnel});
 };
 for(const road of roads){
  if(graph.ids.has(road.id))continue;
  const direction=mode==='walk'?road.walk:road.cycle;
  if(!direction)continue;
  const a=String(road.a),b=String(road.b);
  if(a===b||!Number.isFinite(road.length)||road.length<=0)continue;
  graph.nodes.set(a,road.coordinates[0]);
  graph.nodes.set(b,road.coordinates[1]);
  if(direction&1)add(a,b,road.coordinates[0],road.coordinates[1],road);
  if(direction&2)add(b,a,road.coordinates[1],road.coordinates[0],road);
  graph.ids.add(road.id);
  added++;
 }
 return added;
}

export function closestMobilityNode(graph:MobilityGraph,near:MobilityPoint,maxMeters=250):string|null{
 let selected:string|null=null,best=maxMeters;
 for(const [node,position] of graph.nodes){
  if(!(graph.outgoing.get(node)?.length))continue;
  const distance=mobilityMetres(near,position);
  if(distance<best){selected=node;best=distance}
 }
 return selected;
}

type NodeState={node:string;cost:number};
class MinHeap{
 private entries:NodeState[]=[];
 add(entry:NodeState){
  const values=this.entries;let index=values.length;values.push(entry);
  while(index>0){const parent=(index-1)>>1;if(values[parent].cost<=entry.cost)break;values[index]=values[parent];index=parent}
  values[index]=entry;
 }
 pop():NodeState|undefined{
  const values=this.entries;
  if(!values.length)return undefined;
  const first=values[0],last=values.pop()!;
  if(values.length){
   let i=0;
   while(i*2+1<values.length){
    let child=i*2+1;
    if(child+1<values.length&&values[child+1].cost<values[child].cost)child++;
    if(last.cost<=values[child].cost)break;
    values[i]=values[child];i=child;
   }
   values[i]=last;
  }
  return first;
 }
 get length(){return this.entries.length}
}

/** Find the nearest undiscovered legal edge from a real current OSM node.
 * Traversal to the frontier uses directed links only. No XY crossing creates
 * a synthetic road connection, and cycle contraflow uses explicit OSM tags.
 */
export function planMobilityRoute(
 graph:MobilityGraph,from:string,discovered:ReadonlySet<string>,maxVisits=14000,
):MobilityEdge[]|null{
 if(!graph.nodes.has(from))return null;
 const distances=new Map<string,number>([[from,0]]);
 const parent=new Map<string,{previous:string;edge:MobilityEdge}>();
 const heap=new MinHeap();heap.add({node:from,cost:0});
 let best:MobilityEdge|null=null,bestCost=Infinity,visited=0;
 while(heap.length&&visited<maxVisits){
  const current=heap.pop()!;
  if(current.cost!==distances.get(current.node))continue;
  if(current.cost>bestCost)break;
  visited++;
  for(const edge of graph.outgoing.get(current.node)??[]){
   if(!discovered.has(edge.id)){
    // Prefer nearby unexplored branches; deterministic for a given graph.
    const score=current.cost+Math.min(edge.length,100);
    if(score<bestCost||(score===bestCost&&edge.id<(best?.id??''))){
     best=edge;bestCost=score;
    }
    continue;
   }
   const candidate=current.cost+edge.length;
   if(candidate>bestCost||candidate>= (distances.get(edge.to)??Infinity))continue;
   distances.set(edge.to,candidate);
   parent.set(edge.to,{previous:current.node,edge});
   heap.add({node:edge.to,cost:candidate});
  }
 }
 if(!best)return null;
 const route=[best];
 let current=best.from;
 const seen=new Set<string>();
 while(current!==from){
  if(seen.has(current))return null;
  seen.add(current);
  const step=parent.get(current);
  if(!step)return null;
  route.push(step.edge);current=step.previous;
 }
 route.reverse();
 return route;
}

export function newMobilitySession(
 graph:MobilityGraph,mode:MobilityMode,portId:string,portPosition:MobilityPoint,
):MobilitySession|null{
 const node=closestMobilityNode(graph,portPosition,250);
 if(!node)return null;
 return{mode,portId,node,position:graph.nodes.get(node)!,path:[],leg:0,distanceIntoLeg:0,status:'waiting'};
}

/** Advance along real graph segments; report IDs only after a full legal edge. */
export function advanceMobilitySession(
 session:MobilitySession,elapsedSeconds:number,speedKph:number,
):{session:MobilitySession;crossed:string[]}{
 const crossed:string[]=[];
 let remaining=Math.max(0,Math.min(elapsedSeconds,5))*speedKph/3.6;
 let {leg,distanceIntoLeg,node,position}=session;
 const path=session.path;
 while(remaining>0&&leg<path.length){
  const edge=path[leg];
  const distance=Math.max(0,edge.length-distanceIntoLeg);
  const advance=Math.min(distance,remaining);
  remaining-=advance;
  distanceIntoLeg+=advance;
  const t=Math.min(1,distanceIntoLeg/edge.length);
  position=[edge.a[0]+(edge.b[0]-edge.a[0])*t,edge.a[1]+(edge.b[1]-edge.a[1])*t];
  if(distanceIntoLeg>=edge.length-0.00001){
   node=edge.to;position=edge.b;crossed.push(edge.id);
   leg++;distanceIntoLeg=0;
  }
  if(advance<=0&&distance>0)break;
 }
 return{session:{...session,node,position,leg,distanceIntoLeg,
  status:leg>=path.length?'waiting':session.status},crossed};
}
