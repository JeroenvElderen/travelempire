import {meters,nearest,type RoadGraph,type Point} from './taxi';

/**
 * Resolve an explorer's true starting road, rather than assuming that the
 * geographically nearest OSM node belongs to the discovered (purple) network.
 * The position must lie on a discovered segment (within snap tolerance).
 *
 * The connector always follows that segment's allowed driving direction.
 * A one-way road can only join the graph at its permitted downstream node.
 */
export type PurpleStart={
 node:string;
 roadId:string;
 distanceFromRoadMeters:number;
 connector?:{from:Point;to:Point;edgeId:string};
};

export function resolvePurpleExplorerStart(
 graph:RoadGraph,position:Point,discovered:Set<string>,
 endpoints?:Map<string,[string,string]>,
 maxOffsetMeters=20,
 nearbyIds?:Iterable<string>,
):PurpleStart|null{
 if(!discovered.size)return null;
 const closestNode=nearest(graph,position);
 // Prefer the actual junction beneath the vehicle when it has a legal
 // outgoing discovered edge. A segment-projection-only snap can otherwise
 // select a downstream node of an adjacent one-way edge and strand the scout
 // in a tiny disconnected component. This never transfers across a gap:
 // require the stored vertex coordinates to match the vehicle within 2 m.
 if(closestNode){
  const actual=graph.nodes.get(closestNode);
  if(actual&&meters(actual,position)<=2){
   const departing=(graph.edges.get(closestNode)??[]).find(e=>
    discovered.has(e.id)&&e.meters>0&&graph.nodes.has(e.to));
   if(departing)return {node:closestNode,roadId:departing.id,
    distanceFromRoadMeters:meters(actual,position)};
  }
 }
 let best:PurpleStart|null=null;
 let bestScore=Infinity;
 const seen=new Set<string>();
 const cos=Math.max(0.1,Math.cos(position[1]*Math.PI/180));
 const projected=(a:Point,b:Point)=>{
  const ax=(a[0]-position[0])*111320*cos,ay=(a[1]-position[1])*111320;
  const bx=(b[0]-position[0])*111320*cos,by=(b[1]-position[1])*111320;
  const dx=bx-ax,dy=by-ay;
  const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(ax+t*dx,ay+t*dy);
 };
 const inspect=(from:string,to:string,id:string)=>{
  const a=graph.nodes.get(from),b=graph.nodes.get(to);
  if(!a||!b)return;
  const legal=(graph.edges.get(from)??[]).some(e=>e.id===id&&e.to===to&&e.meters>0);
  if(!legal)return;
  const offset=projected(a,b);
  if(offset>maxOffsetMeters)return;
  // Do not prefer a faraway endpoint just because it is on a nominally
  // closer parallel road. Use perpendicular match first, then travel length.
  const travel=meters(position,b);
  // At the physical source junction of a directed purple edge, start at
  // that junction. The old implementation always snapped downstream to B,
  // sometimes jumping the entire edge and leaving visitedPurpleNodes=1.
  const nearSource=meters(position,a)<=5;
  const depart=nearSource?from:to;
  const connector=!nearSource&&travel>12?{from:position,to:b,edgeId:id}:undefined;
  // Prefer a vertex with an actual outgoing discovered road, but never
  // manufacture a reverse turn on a one-way segment.
  const hasPurpleExit=(graph.edges.get(depart)??[]).some(e=>discovered.has(e.id)&&e.meters>0);
  const score=offset*1000+(nearSource?0:travel)+(hasPurpleExit?0:200);
  if(score>=bestScore)return;
  best={node:depart,roadId:id,distanceFromRoadMeters:offset,connector};
  bestScore=score;
 };
 if(endpoints){
  const inspectIds=(ids:Iterable<string>)=>{
   for(const id of ids){
    if(!discovered.has(id))continue;
    const pair=endpoints.get(id);if(!pair)continue;
    const [a,b]=pair;
    inspect(a,b,id);inspect(b,a,id);
   }
  };
  // Most roads are close to the vehicle; reserve the global fallback for
  // rare long segments whose endpoints lie outside the nearby grid.
  if(nearbyIds)inspectIds(nearbyIds);
  if(!best)inspectIds(discovered);
 }else{
  for(const [from,edges] of graph.edges)for(const e of edges){
   if(!discovered.has(e.id))continue;
   const key=from+'|'+e.to+'|'+e.id;
   if(seen.has(key))continue;
   seen.add(key);inspect(from,e.to,e.id);
  }
 }
 // No virtual access from a nearby, unrelated red road. A closest node
 // counts only when there really is a discovered graph edge at that node.
 if(!best&&closestNode){
  for(const e of graph.edges.get(closestNode)??[]){
   if(!discovered.has(e.id))continue;
   const p=graph.nodes.get(closestNode);
   if(p&&meters(p,position)<=maxOffsetMeters){
    return {node:closestNode,roadId:e.id,
     distanceFromRoadMeters:meters(p,position)};
   }
  }
 }
 return best;
}

export function prependPurpleStart(
 route:{path:Point[];edgeIds:string[];discoveryEdgeIds?:string[]},
 start:PurpleStart,
):{path:Point[];edgeIds:string[];discoveryEdgeIds?:string[]}{
 if(!start.connector)return route;
 return {...route,path:[start.connector.from,...route.path],
  edgeIds:[start.connector.edgeId,...route.edgeIds]};
}
