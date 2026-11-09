import type {FerryNetwork} from './ferries';
import type {Point,RoadGraph,Taxi} from '../simulation/taxi';
import {meters,nearest} from '../simulation/taxi';

export type PassengerFerryOffer={
 routeId:string;fromPortId:string;toPortId:string;
 boarding:Point;destination:Point;geometry:Point[];
 durationMinutes:number;ticketEuros:number;seedRoadId?:string;
};

/** A vehicle ticket is not a route ownership purchase. Charged once at departure. */
export function passengerFerryTicketEuros(durationMinutes:number):number{
 return Math.round(Math.max(10,Math.min(100,10+durationMinutes*0.18))*100)/100;
}
const hierarchy=['motorway','trunk','primary','secondary','tertiary','residential','rural','service'] as const;
function classOf(highway:string|undefined):string{
 const raw=(highway??'').replace(/_link$/,'');
 return raw==='living_street'?'residential':raw==='unclassified'?'rural':raw;
}
function candidateRoadRole(role:Taxi['explorerRole'],highway:string|undefined):boolean{
 const type=classOf(highway);
 if(role==='balanced'||!role||role==='completion'||role==='poi')return hierarchy.includes(type as typeof hierarchy[number]);
 if(role==='highway')return ['motorway','trunk','primary','secondary'].includes(type);
 if(role==='urban')return ['tertiary','residential','rural','service'].includes(type);
 return role==='rural'?type==='rural':role===type;
}
/** Examine only the local road area near the destination, with strict work limits. */
function hasDestinationWork(graph:RoadGraph,start:string,role:Taxi['explorerRole'],discovered:ReadonlySet<string>):boolean{
 const anchor=graph.nodes.get(start);if(!anchor)return false;
 const queue=[start],visited=new Set([start]);
 for(let cursor=0;cursor<queue.length&&cursor<850;cursor++){
  const node=queue[cursor],point=graph.nodes.get(node);
  if(!point||meters(point,anchor)>2200)continue;
  for(const edge of graph.edges.get(node)??[]){
   if(!discovered.has(edge.id)&&candidateRoadRole(role,edge.highway))return true;
   if((discovered.has(edge.id)||node===start)&&visited.size<950&&!visited.has(edge.to)){
    visited.add(edge.to);queue.push(edge.to);
   }
  }
 }
 return false;
}
function accessibleNode(graph:RoadGraph,p:Point):{id:string;point:Point}|null{
 const id=nearest(graph,p),point=id?graph.nodes.get(id):undefined;
 return point&&meters(point,p)<=300?{id,point}:null;
}
/** Road-class priority for ferry exploration. Completion and POI run after
 * ordinary road hierarchy has opened the destination's network. */
const roadPriority:readonly string[]=hierarchy;
function priorityOf(highway:string|undefined):number{
 const index=roadPriority.indexOf(classOf(highway));
 return index<0?roadPriority.length:index;
}
function destinationPriority(graph:RoadGraph,anchor:string,discovered:ReadonlySet<string>):{
 highest:number;highestDiscovered:boolean;seedRoadId:string|undefined;
}{
 const origin=graph.nodes.get(anchor);
 let highest=roadPriority.length,highestDiscovered=false;
 let seedRoadId:string|undefined;
 let seedLength=Infinity,seedRank=roadPriority.length;
 if(!origin)return {highest,highestDiscovered,seedRoadId};
 const visited=new Set([anchor]),queue=[anchor];
 for(let cursor=0;cursor<queue.length&&cursor<500;cursor++){
  const node=queue[cursor],at=graph.nodes.get(node);
  if(!at||meters(at,origin)>1800)continue;
  for(const edge of graph.edges.get(node)??[]){
   if(node===anchor&&(priorityOf(edge.highway)<seedRank||(priorityOf(edge.highway)===seedRank&&edge.meters<seedLength))){
    seedRoadId=edge.id;seedLength=edge.meters;seedRank=priorityOf(edge.highway);
   }
   const rank=priorityOf(edge.highway);
   if(rank<highest){highest=rank;highestDiscovered=discovered.has(edge.id);}
   else if(rank===highest&&discovered.has(edge.id))highestDiscovered=true;
   if(visited.size<600&&!visited.has(edge.to)){
    visited.add(edge.to);queue.push(edge.to);
   }
  }
 }
 return {highest,highestDiscovered,seedRoadId};
}
/** Limited topological checks; missing destination data must be loaded first. */
export function choosePassengerFerry(
 explorer:Taxi,network:FerryNetwork,graph:RoadGraph,discovered:ReadonlySet<string>,
):PassengerFerryOffer|null{
 if(explorer.kind!=='explorer'||explorer.status!=='IDLE'||explorer.ferryTrip)return null;
 const portsById=new Map(network.ports.map(p=>[p.id,p]));
 const starts=network.ports.map(p=>({p,distance:meters(explorer.position,p.roadAccess??p.position)}))
  .filter(item=>item.distance<=7500)
  .sort((a,b)=>a.distance-b.distance).slice(0,3);
 if(!starts.length)return null;
 const visited=new Set(explorer.ferryVisitedPorts??[]);
 let best:PassengerFerryOffer|null=null,bestScore=Infinity;
 for(const {p:source,distance} of starts){
  const options=network.routes.filter(r=>r.from===source.id||r.to===source.id).slice(0,12);
  if(!options.length)continue;
  const boarding=accessibleNode(graph,source.roadAccess??source.position);
  if(!boarding)continue;
  // Ferry departures must be reachable on an already discovered road.
  if(!(graph.edges.get(boarding.id)??[]).some(e=>discovered.has(e.id)))continue;
  for(const ferry of options){
   const reverse=ferry.to===source.id;
   const destinationPortId=reverse?ferry.from:ferry.to;
   if(visited.has(destinationPortId))continue;
   const dest=portsById.get(destinationPortId);
   if(!dest||meters(source.position,dest.position)<800)continue;
   const destination=accessibleNode(graph,dest.roadAccess??dest.position);
   if(!destination||!hasDestinationWork(graph,destination.id,explorer.explorerRole,discovered))continue;
    const gate=destinationPriority(graph,destination.id,discovered);
    if(!gate.seedRoadId||gate.highest>=roadPriority.length)continue;
    const role=explorer.explorerRole;
    const rank=role==='balanced'||!role?gate.highest:role==='highway'?0:role==='urban'?5:role==='rural'?roadPriority.indexOf('rural'):role==='completion'||role==='poi'?roadPriority.length:roadPriority.indexOf(role??'');
    // A fresh island opens with its highest available road class. All other
    // vehicle classes wait until a highest-class edge has been discovered.
    if(!gate.highestDiscovered&&rank!==gate.highest)continue;
   const score=distance+ferry.durationMinutes*20;
   if(score>=bestScore)continue;
   bestScore=score;
   best={routeId:ferry.id,fromPortId:source.id,toPortId:dest.id,
    boarding:boarding.point,destination:destination.point,
    geometry:reverse?[...ferry.geometry].reverse():ferry.geometry,
    durationMinutes:ferry.durationMinutes,ticketEuros:passengerFerryTicketEuros(ferry.durationMinutes),
     seedRoadId:gate.highestDiscovered?undefined:gate.seedRoadId};
  }
 }
 return best;
}
export function ferryPosition(geometry:Point[],fraction:number):Point{
 if(!geometry.length)return [0,0];
 if(geometry.length===1)return geometry[0];
 const progress=Math.max(0,Math.min(1,fraction));
 const lengths:number[]=[];let total=0;
 for(let i=1;i<geometry.length;i++){const length=meters(geometry[i-1],geometry[i]);lengths.push(length);total+=length;}
 if(total<=0)return geometry[0];
 let distance=total*progress;
 for(let i=0;i<lengths.length;i++){
  if(distance>lengths[i]&&i<lengths.length-1){distance-=lengths[i];continue;}
  const a=geometry[i],b=geometry[i+1],t=lengths[i]?Math.min(1,distance/lengths[i]):0;
  return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
 }
 return geometry[geometry.length-1];
}
