import type {RoadGraph,Point} from '../simulation/taxi';
import {nearest,route} from '../simulation/taxi';
import type {FerryNetwork} from './ferries';
import type {FerryConnectionResult} from './roadConnections';

/** Each ferry route requires one permanent company purchase (both directions). */
export const FERRY_ROUTE_BASE_PRICE=250000;
export function ferryRoutePrice(_routeId:string):number{return FERRY_ROUTE_BASE_PRICE;}
export type FerryJourneyLeg=
 |{kind:'road';from:Point;to:Point;path:Point[];edgeIds:string[];distanceMeters:number}
 |{kind:'ferry';routeId:string;fromPortId:string;toPortId:string;geometry:Point[];durationMinutes:number};
export type FerryJourneyPlan={legs:FerryJourneyLeg[];distanceMeters:number;ferryMinutes:number;routeIds:string[]};

/** Plans across disconnected road components. Does not mutate taxi movement. */
export function planFerryJourney(
 graph:RoadGraph,network:FerryNetwork,connections:FerryConnectionResult,
 purchasedRouteIds:ReadonlySet<string>,origin:Point,destination:Point,
):FerryJourneyPlan|null{
 const start=nearest(graph,origin),finish=nearest(graph,destination);
 if(!start||!finish)return null;
 const portNodes=new Map(connections.connected.map(c=>[c.portId,c.roadNodeId]));
 const stops=[start,finish,...new Set(connections.connected.map(c=>c.roadNodeId))];
 const unique=[...new Set(stops)];
 type Link={to:string;weight:number;leg:FerryJourneyLeg};
 const links=new Map<string,Link[]>(unique.map(n=>[n,[]]));
 // Road links exist only if the road router actually finds a route.
 for(let i=0;i<unique.length;i++)for(let j=0;j<unique.length;j++){
  if(i===j)continue;
  const a=unique[i],b=unique[j],r=route(graph,a,b);
  if(!r)continue;
  links.get(a)!.push({to:b,weight:r.length/12,leg:{kind:'road',from:graph.nodes.get(a)!,to:graph.nodes.get(b)!,path:r.path,edgeIds:r.edgeIds,distanceMeters:r.length}});
 }
 for(const ferry of network.routes){
  if(!purchasedRouteIds.has(ferry.id))continue;
  const a=portNodes.get(ferry.from),b=portNodes.get(ferry.to);
  if(!a||!b)continue;
  links.get(a)?.push({to:b,weight:ferry.durationMinutes*60,leg:{kind:'ferry',routeId:ferry.id,fromPortId:ferry.from,toPortId:ferry.to,geometry:ferry.geometry,durationMinutes:ferry.durationMinutes}});
  links.get(b)?.push({to:a,weight:ferry.durationMinutes*60,leg:{kind:'ferry',routeId:ferry.id,fromPortId:ferry.to,toPortId:ferry.from,geometry:[...ferry.geometry].reverse(),durationMinutes:ferry.durationMinutes}});
 }
 const distance=new Map<string,number>([[start,0]]);
 const previous=new Map<string,{from:string;leg:FerryJourneyLeg}>();
 const pending=new Set(unique);
 while(pending.size){
  let current:string|undefined,minimum=Infinity;
  for(const node of pending){const d=distance.get(node)??Infinity;if(d<minimum){minimum=d;current=node;}}
  if(current===undefined||minimum===Infinity)break;
  pending.delete(current);if(current===finish)break;
  for(const edge of links.get(current)??[]){
   const candidate=minimum+edge.weight;
   if(candidate<(distance.get(edge.to)??Infinity)){distance.set(edge.to,candidate);previous.set(edge.to,{from:current,leg:edge.leg});}
  }
 }
 if(!distance.has(finish))return null;
 const legs:FerryJourneyLeg[]=[];let node=finish;
 while(node!==start){const entry=previous.get(node);if(!entry)return null;legs.unshift(entry.leg);node=entry.from;}
 return {legs,distanceMeters:legs.reduce((sum,l)=>sum+(l.kind==='road'?l.distanceMeters:0),0),ferryMinutes:legs.reduce((sum,l)=>sum+(l.kind==='ferry'?l.durationMinutes:0),0),routeIds:[...new Set(legs.filter((l):l is Extract<FerryJourneyLeg,{kind:'ferry'}>=>l.kind==='ferry').map(l=>l.routeId))]};
}
