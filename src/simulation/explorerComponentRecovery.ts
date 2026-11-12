import type {Point,RoadGraph} from './taxi';

/** Return an idle scout from a directed island to the HQ-reachable purple
 * graph. Transit can use loaded red roads but does NOT discover them.
 * Every edge is a real directed OSM graph edge; no snapping to a nearby
 * component and no reverse movement on one-way streets.
 *
 * Keep the search bounded, and prefer already-discovered transit to red.
 * The caller supplies the HQ-reachable node index, not nearby geography.
 */
export function routeIsolatedExplorerToMainNetwork(
 graph:RoadGraph,start:string,headquartersNodes:ReadonlySet<string>,
 discovered:ReadonlySet<string>,maxVisits=12000,
):{path:Point[];edgeIds:string[];transitRoads:string[];targetNode:string}|null{
 if(!graph.nodes.has(start)||!headquartersNodes.size||headquartersNodes.has(start))return null;
 type Entry={node:string;cost:number};
 const heap:Entry[]=[];
 const push=(entry:Entry)=>{
  let i=heap.length;heap.push(entry);
  while(i>0){const p=(i-1)>>1;if(heap[p].cost<=entry.cost)break;heap[i]=heap[p];i=p;}
  heap[i]=entry;
 };
 const pop=():Entry|undefined=>{
  if(!heap.length)return undefined;
  const first=heap[0],last=heap.pop()!;
  if(heap.length){let i=0;while(i*2+1<heap.length){
   let c=i*2+1;
   if(c+1<heap.length&&heap[c+1].cost<heap[c].cost)c++;
   if(last.cost<=heap[c].cost)break;
   heap[i]=heap[c];i=c;
  }heap[i]=last;}
  return first;
 };
 const dist=new Map<string,number>([[start,0]]);
 const parents=new Map<string,{from:string;id:string}>();
 push({node:start,cost:0});
 let goal:string|undefined,visited=0;
 while(heap.length&&visited++<maxVisits){
  const item=pop()!;
  if(item.cost!==(dist.get(item.node)??Infinity))continue;
  if(headquartersNodes.has(item.node)){goal=item.node;break;}
  for(const edge of graph.edges.get(item.node)??[]){
   if(edge.meters<=0||!graph.nodes.has(edge.to))continue;
   // A newly loaded red road is permitted strictly as directed recovery
   // transit, with a penalty to prefer existing purple connections.
   const next=item.cost+edge.meters+(discovered.has(edge.id)?0:350);
   if(next>=(dist.get(edge.to)??Infinity))continue;
   dist.set(edge.to,next);
   parents.set(edge.to,{from:item.node,id:edge.id});
   push({node:edge.to,cost:next});
  }
 }
 if(!goal)return null;
 const nodes=[goal],ids:string[]=[];
 let current=goal;
 while(current!==start){
  const parent=parents.get(current);if(!parent)return null;
  nodes.push(parent.from);ids.push(parent.id);current=parent.from;
  if(nodes.length>maxVisits+1)return null;
 }
 nodes.reverse();ids.reverse();
 if(!ids.length)return null;
 const path=nodes.map(id=>graph.nodes.get(id)!);
 return {path,edgeIds:ids,
  transitRoads:[...new Set(ids.filter(id=>!discovered.has(id)))],
  targetNode:goal};
}
