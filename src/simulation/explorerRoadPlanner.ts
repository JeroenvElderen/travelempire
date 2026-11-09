import type {RoadGraph,Point,Taxi} from './taxi';

export type ExplorerRouteDiagnostic={
 visitedPurpleNodes:number;reachableClassEdges:number;
 eligibleClassRoads:number;reason:string;
};
export type ExplorerRoutePlan={
 path:Point[];edgeIds:string[];discoveryEdgeIds:string[];
 diagnostic:ExplorerRouteDiagnostic;
};

/** Find the nearest unclaimed class road by traveling exclusively over
 * physically discovered, legally directed roads. No off-network jumps. */
export function planReachableExplorerRoad(
 graph:RoadGraph,start:string,explored:Set<string>,eligible:Set<string>,
 reservedRoads:Set<string>,reservedTargets:Set<string>,
 role:Taxi['explorerRole'],
):{route:ExplorerRoutePlan|null;diagnostic:ExplorerRouteDiagnostic}{
 const diag:ExplorerRouteDiagnostic={visitedPurpleNodes:0,reachableClassEdges:0,
  eligibleClassRoads:eligible.size,reason:'no-connected-class-road'};
 if(!graph.nodes.has(start))return {route:null,diagnostic:{...diag,reason:'no-start-node'}};
 const distances=new Map<string,number>([[start,0]]);
 const parent=new Map<string,{from:string;id:string}>();
 const heap:Array<{node:string;distance:number}>=[{node:start,distance:0}];
 const push=(item:{node:string;distance:number})=>{
  let i=heap.length;heap.push(item);
  while(i>0){const p=(i-1)>>1;if(heap[p].distance<=item.distance)break;heap[i]=heap[p];i=p;}
  heap[i]=item;
 };
 const pop=()=>{
  const first=heap[0],last=heap.pop()!;
  if(heap.length){let i=0;while(i*2+1<heap.length){
   let child=i*2+1;
   if(child+1<heap.length&&heap[child+1].distance<heap[child].distance)child++;
   if(last.distance<=heap[child].distance)break;
   heap[i]=heap[child];i=child;
  }heap[i]=last;}
  return first;
 };
 const maxVisits=role==='highway'||role==='poi'?30000:12000;
 const maxTravel=role==='highway'||role==='poi'?85000:26000;
 let winner:{from:string;to:string;id:string}|null=null;
 while(heap.length&&diag.visitedPurpleNodes<maxVisits){
  const current=pop();
  if(current.distance!==(distances.get(current.node)??Infinity))continue;
  if(current.distance>maxTravel){diag.reason='outside-search-distance';break;}
  diag.visitedPurpleNodes++;
  const links=graph.edges.get(current.node)??[];
  // An undiscovered road can be entered ONLY at a junction reached by
  // driving a discovered road. Class filtering applies to discovery, not transit.
  for(const edge of links){
   if(edge.meters<=0||!eligible.has(edge.id)||explored.has(edge.id)||
      reservedRoads.has(edge.id)||reservedTargets.has(edge.to))continue;
   diag.reachableClassEdges++;
   winner={from:current.node,to:edge.to,id:edge.id};break;
  }
  if(winner)break;
  for(const edge of links){
   if(edge.meters<=0||!explored.has(edge.id))continue;
   const next=current.distance+edge.meters;
   if(next>maxTravel||next>=(distances.get(edge.to)??Infinity))continue;
   distances.set(edge.to,next);parent.set(edge.to,{from:current.node,id:edge.id});
   push({node:edge.to,distance:next});
  }
 }
 if(!winner){
  if(diag.reason==='no-connected-class-road'&&diag.visitedPurpleNodes>=maxVisits)
   diag.reason='search-node-budget';
  return {route:null,diagnostic:diag};
 }
 const selected=winner as {from:string;to:string;id:string};
 const keys:string[]=[selected.from],ids:string[]=[];
 let at=selected.from;
 while(at!==start){
  const step=parent.get(at);if(!step)return {route:null,diagnostic:{...diag,reason:'broken-parent-route'}};
  ids.push(step.id);keys.push(step.from);at=step.from;
  if(keys.length>maxVisits)return {route:null,diagnostic:{...diag,reason:'route-too-long'}};
 }
 keys.reverse();ids.reverse();
 keys.push(selected.to);ids.push(selected.id);
 // Follow connected straight road segments, rather than stop at every OSM
 // micro-edge. A turn is postponed to the next physical junction.
 const discovery=[selected.id];
 let cursor=selected.to,previous=selected.from,meters=0;
 const used=new Set<string>([selected.id]);
 const angle=(a:string,b:string,c:string)=>{
  const p=graph.nodes.get(a),q=graph.nodes.get(b),r=graph.nodes.get(c);
  if(!p||!q||!r)return -1;
  const scale=Math.cos(q[1]*Math.PI/180);
  const ax=(q[0]-p[0])*scale,ay=q[1]-p[1],bx=(r[0]-q[0])*scale,by=r[1]-q[1];
  return (ax*bx+ay*by)/Math.max(1e-12,Math.hypot(ax,ay)*Math.hypot(bx,by));
 };
 for(let i=0;i<30&&meters<2200;i++){
  const forwards=(graph.edges.get(cursor)??[]).filter(e=>
   e.meters>0&&eligible.has(e.id)&&!explored.has(e.id)&&
   !used.has(e.id)&&!reservedRoads.has(e.id)&&
   !reservedTargets.has(e.to)&&e.to!==previous)
    .map(e=>({e,cos:angle(previous,cursor,e.to)}))
    .filter(item=>item.cos>=0.70).sort((a,b)=>b.cos-a.cos);
  if(!forwards.length)break;
  const next=forwards[0].e;
  ids.push(next.id);keys.push(next.to);discovery.push(next.id);
  used.add(next.id);meters+=next.meters;previous=cursor;cursor=next.to;
 }
 const path=keys.map(id=>graph.nodes.get(id)!).filter(Boolean);
 diag.reason='planned';
 return {route:{path,edgeIds:ids,discoveryEdgeIds:discovery,diagnostic:diag},diagnostic:diag};
}
