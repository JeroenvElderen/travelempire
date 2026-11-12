import {meters,type Point,type RoadGraph,type Taxi} from './taxi';
import type {ExplorerRoutePlan,ExplorerRouteDiagnostic} from './explorerRoadPlanner';

/** Shared, directed frontier search. All specialists TRANSIT on discovered
 * roads, but only their eligible class is ever added to discoveryEdgeIds.
 * Graph nodes, not visual line crossings, establish connectivity.
 *
 * This planner is independent of the geographic tile containing the scout:
 * it searches as far as the loaded, connected discovered graph permits.
 * The search budget protects iOS from full-country graph scans.
 */
export function planConnectedFrontier(
 graph:RoadGraph,start:string,explored:ReadonlySet<string>,eligible:ReadonlySet<string>,
 reservedEdges:ReadonlySet<string>,reservedNodes:ReadonlySet<string>,
 role:Taxi['explorerRole'],maxVisits=90000,goal?:Point,
):{route:ExplorerRoutePlan|null;diagnostic:ExplorerRouteDiagnostic}{
 const diagnostic:ExplorerRouteDiagnostic={visitedPurpleNodes:0,reachableClassEdges:0,
  eligibleClassRoads:eligible.size,unsafeOneWaySkipped:0,reason:'no-connected-class-road'};
 if(!graph.nodes.has(start))return {route:null,diagnostic:{...diagnostic,reason:'no-start-node'}};
 // Harbour routing also runs its dedicated shortest-port search, so keep its
 // frontier fallback smaller to protect Safari's worker memory.
 const nodeBudget=role==='poi'?Math.min(maxVisits,70000):maxVisits;
 // Heap of directed road distances; no Euclidean shortcuts.
 const dist=new Map<string,number>([[start,0]]);
 const parents=new Map<string,{from:string;id:string}>();
 type Entry={node:string;cost:number};
 const heap:Entry[]=[];
 const push=(item:Entry)=>{let i=heap.length;heap.push(item);while(i>0){
  const p=(i-1)>>1;if(heap[p].cost<=item.cost)break;heap[i]=heap[p];i=p;
 }heap[i]=item;};
 const pop=():Entry|undefined=>{
  if(!heap.length)return undefined;
  const first=heap[0],last=heap.pop()!;
  if(heap.length){let i=0;while(2*i+1<heap.length){
   let c=2*i+1;
   if(c+1<heap.length&&heap[c+1].cost<heap[c].cost)c++;
   if(last.cost<=heap[c].cost)break;
   heap[i]=heap[c];i=c;
  }heap[i]=last;}
  return first;
 };
 push({node:start,cost:0});
 const canReturn=(from:string,to:string,id:string)=>{
  if((graph.edges.get(to)??[]).some(e=>e.id===id&&e.to===from&&e.meters>0))return true;
  if((graph.edges.get(to)??[]).some(e=>explored.has(e.id)&&e.meters>0))return true;
  // One-way corridors may only be entered when a legal exit reaches a
  // discovered road. The escape path is handled by the specialist planner.
  return false;
 };
 let candidate:{from:string;to:string;id:string}|null=null;
 let bestScore=Infinity;
 while(heap.length&&diagnostic.visitedPurpleNodes<nodeBudget){
  const item=pop()!;
  if(item.cost!==(dist.get(item.node)??Infinity))continue;
  // For harbour scouts, choose the frontier that best progresses toward
  // the saved port. This is a ranking heuristic only; all route edges still
  // come from the legally directed, connected road network.
  if(goal&&item.cost>bestScore)break;
  diagnostic.visitedPurpleNodes++;
  const links=graph.edges.get(item.node)??[];
  for(const edge of links){
   if(edge.meters<=0||explored.has(edge.id)||!eligible.has(edge.id)||
     reservedEdges.has(edge.id)||reservedNodes.has(edge.to))continue;
   diagnostic.reachableClassEdges++;
   if(!canReturn(item.node,edge.to,edge.id)){
    diagnostic.unsafeOneWaySkipped++;continue;
   }
   const point=graph.nodes.get(edge.to);
   const score=item.cost+(goal&&point?1.25*meters(point,goal):0);
   if(score<bestScore){
    bestScore=score;candidate={from:item.node,to:edge.to,id:edge.id};
   }
   if(!goal)break;
  }
  if(candidate&&!goal)break;
  for(const edge of links){
   if(edge.meters<=0||!explored.has(edge.id))continue;
   const next=item.cost+edge.meters;
   if(next>=(dist.get(edge.to)??Infinity))continue;
   dist.set(edge.to,next);
   parents.set(edge.to,{from:item.node,id:edge.id});
   push({node:edge.to,cost:next});
  }
 }
 if(!candidate){
  diagnostic.reason=heap.length?'search-node-budget':
   diagnostic.unsafeOneWaySkipped?'one-way-no-legal-exit':'no-connected-class-road';
  return {route:null,diagnostic};
 }
 const selected=candidate as {from:string;to:string;id:string};
 const keys=[selected.from],ids:string[]=[];
 let cursor=selected.from;
 while(cursor!==start){
  const parent=parents.get(cursor);
  if(!parent)return{route:null,diagnostic:{...diagnostic,reason:'broken-parent-route'}};
  keys.push(parent.from);ids.push(parent.id);cursor=parent.from;
  if(keys.length>nodeBudget)return{route:null,diagnostic:{...diagnostic,reason:'route-too-long'}};
 }
 keys.reverse();ids.reverse();
 keys.push(selected.to);ids.push(selected.id);
 const discovery=[selected.id];
 const used=new Set<string>(discovery);
 // Drive straight through adjacent eligible segments, instead of repeatedly
 // stopping at every OSM micro-edge. Never chain into an unsafe one-way spur.
 const direction=(from:string,via:string,to:string)=>{
  const a=graph.nodes.get(from),b=graph.nodes.get(via),c=graph.nodes.get(to);
  if(!a||!b||!c)return -1;
  const scale=Math.cos(b[1]*Math.PI/180);
  const x1=(b[0]-a[0])*scale,y1=b[1]-a[1];
  const x2=(c[0]-b[0])*scale,y2=c[1]-b[1];
  return (x1*x2+y1*y2)/Math.max(1e-12,Math.hypot(x1,y1)*Math.hypot(x2,y2));
 };
 let current=selected.to,previous=selected.from,extraMeters=0;
 for(let n=0;n<24&&extraMeters<1800;n++){
  const next=(graph.edges.get(current)??[]).filter(e=>e.meters>0&&
   eligible.has(e.id)&&!explored.has(e.id)&&!used.has(e.id)&&
   !reservedEdges.has(e.id)&&!reservedNodes.has(e.to)&&e.to!==previous)
   .map(e=>({e,angle:direction(previous,current,e.to)}))
   .filter(({e,angle})=>angle>=.72&&canReturn(current,e.to,e.id))
   .sort((a,b)=>b.angle-a.angle)[0]?.e;
  if(!next)break;
  keys.push(next.to);ids.push(next.id);discovery.push(next.id);
  used.add(next.id);extraMeters+=next.meters;
  previous=current;current=next.to;
 }
 const path:Point[]=keys.map(k=>graph.nodes.get(k)!).filter(Boolean);
 diagnostic.reason='planned-connected-frontier';
 return {route:{path,edgeIds:ids,discoveryEdgeIds:discovery,
   escapeTransitEdgeIds:[],diagnostic},diagnostic};
}
