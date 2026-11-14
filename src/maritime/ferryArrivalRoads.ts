import type {RoadGraph,Point} from '../simulation/taxi';

// Discovery is stored by whole OSM edge ID. Never mark an edge that extends
// beyond the requested 50 m circle; doing so would reveal its entire length.
export const FERRY_ARRIVAL_ROAD_RADIUS_METERS=50;
const distance=(a:Point,b:Point)=>{
 const lat=(a[1]+b[1])*Math.PI/360;
 return Math.hypot((a[0]-b[0])*111320*Math.cos(lat),(a[1]-b[1])*111320);
};

/** Small connected component of complete drivable road edges near the port. */
export function ferryArrivalRoadIds(graph:RoadGraph,access:Point,radius=FERRY_ARRIVAL_ROAD_RADIUS_METERS):string[]{
 const local=new Map<string,Array<{to:string;id:string}>>();
 const seedCandidates:Array<{node:string;distance:number}>=[];
 // Only inspect the small spatial neighbourhood; this is called on arrivals,
 // not on simulation ticks. The graph may still be streaming nearby tiles.
 for(const [node,edges] of graph.edges){
  const a=graph.nodes.get(node);
  if(!a||distance(a,access)>radius)continue;
  let usable=false;
  for(const edge of edges){
   if(edge.taxiOnly)continue;
   const b=graph.nodes.get(edge.to);
   if(!b||distance(b,access)>radius)continue;
   // Straight OSM graph segments are wholly inside a convex circular radius
   // when both endpoints are inside.
   const list=local.get(node)??[];
   list.push({to:edge.to,id:edge.id});local.set(node,list);
   usable=true;
  }
  if(usable)seedCandidates.push({node,distance:distance(a,access)});
 }
 if(!seedCandidates.length)return [];
 seedCandidates.sort((a,b)=>a.distance-b.distance);
 const queue=[seedCandidates[0].node],visited=new Set(queue),discovered=new Set<string>();
 for(let index=0;index<queue.length&&index<200;index++){
  for(const edge of local.get(queue[index])??[]){
   discovered.add(edge.id);
   if(!visited.has(edge.to)){visited.add(edge.to);queue.push(edge.to);}
  }
 }
 return [...discovered];
}
export const ferryArrivalRoadsKey=(companyId:string)=>'travelempire.ferryArrivalRoads.'+companyId;
export const ferryArrivalRoadsPendingKey=(companyId:string)=>'travelempire.ferryArrivalRoadsPending.'+companyId;
