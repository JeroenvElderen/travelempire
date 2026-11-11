import type {RoadGraph,Point,Taxi} from './taxi';

export type ExplorerRouteDiagnostic={
 visitedPurpleNodes:number;reachableClassEdges:number;
 eligibleClassRoads:number;unsafeOneWaySkipped:number;reason:string;
};
export type ExplorerRoutePlan={
 path:Point[];edgeIds:string[];discoveryEdgeIds:string[];
 /** Undiscovered cross-class roads used only for a legally directed escape. */
 escapeTransitEdgeIds:string[];
 diagnostic:ExplorerRouteDiagnostic;
};

/** Find the nearest eligible undiscovered road by driving along real directed
 * graph connections. Cross-class red roads are allowed only as transit: they
 * never become discoveries for the wrong specialist. No off-network jumps. */
export function planReachableExplorerRoad(
 graph:RoadGraph,start:string,explored:Set<string>,eligible:Set<string>,
 reservedRoads:Set<string>,reservedTargets:Set<string>,
 role:Taxi['explorerRole'],
):{route:ExplorerRoutePlan|null;diagnostic:ExplorerRouteDiagnostic}{
 const diag:ExplorerRouteDiagnostic={visitedPurpleNodes:0,reachableClassEdges:0,
  eligibleClassRoads:eligible.size,unsafeOneWaySkipped:0,reason:'no-connected-class-road'};
 if(!graph.nodes.has(start))return {route:null,diagnostic:{...diag,reason:'no-start-node'}};
 const distances=new Map<string,number>([[start,0]]);
 const redDistances=new Map<string,number>([[start,0]]);
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
 // A one-way entrance is allowed only if there is a directed escape to
 // the existing purple network. Reversing a bidirectional edge is always
 // legal; a true one-way cul-de-sac is never an automatic exploration target.
 // Escape traversal may cross other road classes, but only eligible roads
 // become purple. A safe escape must terminate back on a purple road.
 type EscapeStep={from:string;to:string;id:string};
 const escapes=new Map<string,EscapeStep[]|null>();
 const safeExit=(from:string,to:string,id:string,requirePurple=false):EscapeStep[]|null=>{
  const cacheKey=from+'|'+to+'|'+id+'|'+requirePurple;
  if(escapes.has(cacheKey))return escapes.get(cacheKey)!;
  const reverse=(graph.edges.get(to)??[]).some(e=>e.to===from&&e.id===id&&e.meters>0);
  if(reverse&&!requirePurple){escapes.set(cacheKey,[]);return [];}
  // Already at a purple road junction, hence an existing connected exit.
  if((graph.edges.get(to)??[]).some(e=>explored.has(e.id)&&e.meters>0)){
   escapes.set(cacheKey,[]);return [];
  }
  const visited=new Set([to]),parents=new Map<string,EscapeStep>();
  const queue=[to];let finish:string|undefined;
  // Bounded directed BFS: checks actual available exits, not visual map
  // intersections. On incomplete tiles, defer and retry when roads load.
  for(let i=0;i<queue.length&&i<7000;i++){
   const node=queue[i];
   for(const edge of graph.edges.get(node)??[]){
    if(edge.meters<=0)continue;
    const purple=explored.has(edge.id);
    // Discovery class restrictions do not apply to a *legal escape*.
    // Do not traverse another explorer's reserved discovery target.
    if(!purple&&(reservedRoads.has(edge.id)||reservedTargets.has(edge.to)))continue;
    if(visited.has(edge.to))continue;
    visited.add(edge.to);
    parents.set(edge.to,{from:node,to:edge.to,id:edge.id});
    if(purple||(graph.edges.get(edge.to)??[]).some(e=>explored.has(e.id)&&e.meters>0)){
     finish=edge.to;break;
    }
    queue.push(edge.to);
   }
   if(finish)break;
  }
  if(!finish){escapes.set(cacheKey,null);return null;}
  const result:EscapeStep[]=[];
  let at=finish;
  while(at!==to){
   const step=parents.get(at);if(!step){escapes.set(cacheKey,null);return null;}
   result.push(step);at=step.from;
  }
  result.reverse();
  escapes.set(cacheKey,result);
  return result;
 };
 const safeRoad=(from:string,to:string,id:string):boolean=>{
  if(safeExit(from,to,id)!==null)return true;
  diag.unsafeOneWaySkipped++;
  return false;
 };
 const maxVisits=role==='highway'||role==='poi'?30000:12000;
 const maxTravel=role==='highway'||role==='poi'?85000:26000;
 // Prefer known purple roads; cross-class red roads are legal to drive on
 // but expensive for search scoring, so they are used only when useful.
 const crossClassPenalty=7;
 const maxRedTransitMeters=role==='highway'||role==='poi'?18000:6500;
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
   if(!safeRoad(current.node,edge.to,edge.id))continue;
   winner={from:current.node,to:edge.to,id:edge.id};break;
  }
  if(winner)break;
  for(const edge of links){
   if(edge.meters<=0)continue;
   const purple=explored.has(edge.id);
   // Never transit through undiscovered roads this specialist should reveal.
   // Those roads are discovery targets, not ordinary red connectors.
   if(!purple&&(eligible.has(edge.id)||reservedRoads.has(edge.id)||
      reservedTargets.has(edge.to)))continue;
   const redDistance=(redDistances.get(current.node)??0)+(purple?0:edge.meters);
   if(redDistance>maxRedTransitMeters)continue;
   const next=current.distance+edge.meters*(purple?1:crossClassPenalty);
   if(next>maxTravel||next>=(distances.get(edge.to)??Infinity))continue;
   distances.set(edge.to,next);redDistances.set(edge.to,redDistance);
   parent.set(edge.to,{from:current.node,id:edge.id});
   push({node:edge.to,distance:next});
  }
 }
 if(!winner){
  if(diag.unsafeOneWaySkipped>0&&diag.reason==='no-connected-class-road')diag.reason='one-way-no-legal-exit';
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
 // Red access roads used to reach our target are transit-only and remain
 // undiscovered. Bound these crossings so a specialist cannot traverse
 // arbitrary distances through the network before doing useful exploration.
 const preDiscoveryTransit:string[]=[];
 for(const id of ids)
  if(!explored.has(id)&&!preDiscoveryTransit.includes(id))preDiscoveryTransit.push(id);
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
  const next=forwards.find(item=>safeRoad(cursor,item.e.to,item.e.id))?.e;
  if(!next)break;
  ids.push(next.id);keys.push(next.to);discovery.push(next.id);
  used.add(next.id);meters+=next.meters;previous=cursor;cursor=next.to;
 }
 // If the last segment is one-way and cannot reverse, commit its
 // known legal escape in the SAME assignment so the vehicle never idles in
 // the middle of an unsafe one-way corridor.
 const lastFrom=keys[keys.length-2],lastTo=keys[keys.length-1],
  lastId=ids[ids.length-1];
 // Reversing the final two-way segment is insufficient if a one-way edge
 // earlier in the corridor prevents returning to purple.
 const irreversibleDiscovery=ids.some((id,i)=>!explored.has(id)&&
  !(graph.edges.get(keys[i+1])??[]).some(e=>e.id===id&&e.to===keys[i]&&e.meters>0));
 const exit=lastFrom&&lastTo&&lastId?
  safeExit(lastFrom,lastTo,lastId,irreversibleDiscovery):[];
 if(exit===null)return {route:null,diagnostic:{...diag,reason:'one-way-no-legal-exit'}};
 const escapeTransitEdgeIds:string[]=[...preDiscoveryTransit];
 for(const step of exit??[]){
  keys.push(step.to);ids.push(step.id);
  // Cross-class escape roads remain red, even though the explorer drives on them.
  if(!explored.has(step.id)){
   if(eligible.has(step.id)){if(!discovery.includes(step.id))discovery.push(step.id);}
   else if(!escapeTransitEdgeIds.includes(step.id))escapeTransitEdgeIds.push(step.id);
  }
 }
 const path=keys.map(id=>graph.nodes.get(id)!).filter(Boolean);
 diag.reason='planned';
 return {route:{path,edgeIds:ids,discoveryEdgeIds:discovery,
  escapeTransitEdgeIds,diagnostic:diag},diagnostic:diag};
}
