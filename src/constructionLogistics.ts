/** Contracted construction freight, driven by the game's existing ferry sea
 * corridors and directed, loaded OSM road graph. Not a player-owned ferry or taxi.
 * It never creates roads, ferries, or free straight-line road shortcuts.
 */
import type {FerryNetwork,FerryPort,FerryRoute} from './maritime/ferries';
import {englishFerryName} from './maritime/ferries';
import type {Point,RoadGraph} from './simulation/taxi';
import {nearest,route,meters} from './simulation/taxi';

export type CargoLeg='preparing'|'at-sea'|'unloading'|'trucking'|'delivered';
export type ConstructionFreight={
 originPortId:string;originPortName:string;
 destinationPortId:string;destinationPortName:string;seaRouteId:string;
 seaPath:Point[];roadPath:Point[];
 shippingHour:number;seaArrivalHour:number;truckDepartureHour:number;deliveryHour:number;
 roadDistanceMeters:number;siteRoadDistanceMeters:number;
};

/** Status is derived, not ticked: saved shipments survive Safari backgrounding. */
export function freightStage(freight:ConstructionFreight,hour:number):CargoLeg{
 if(hour>=freight.deliveryHour)return 'delivered';
 if(hour>=freight.truckDepartureHour)return 'trucking';
 if(hour>=freight.seaArrivalHour)return 'unloading';
 if(hour>=freight.shippingHour)return 'at-sea';
 return 'preparing';
}
export const freightStatusLabel:Record<CargoLeg,string>={
 preparing:'Packing and loading cargo ship',
 'at-sea':'Cargo ship en route',
 unloading:'Unloading at harbour',
 trucking:'Truck delivering to site',
 delivered:'Construction materials delivered',
};
export function freightProgress(freight:ConstructionFreight,hour:number):number{
 if(hour<=freight.shippingHour)return 0;
 return Math.max(0,Math.min(100,(hour-freight.shippingHour)/
  Math.max(1,freight.deliveryHour-freight.shippingHour)*100));
}
function connectedPortNode(port:FerryPort,graph:RoadGraph):string|null{
 const position=port.roadAccess??port.position;
 const node=nearest(graph,position);
 if(!node)return null;
 const coord=graph.nodes.get(node);
 return coord&&meters(position,coord)<=250?node:null;
}
function incomingSeaLeg(route:FerryRoute,portId:string):{
 originId:string;path:Point[];durationMinutes:number;routeId:string
}|null{
 if(route.to===portId)return {originId:route.from,path:route.geometry,durationMinutes:route.durationMinutes,routeId:route.id};
 if(route.from===portId)return {originId:route.to,path:[...route.geometry].reverse(),durationMinutes:route.durationMinutes,routeId:route.id};
 return null;
}

/** Choose an existing sea corridor into a harbour with a legal truck path to this property.
 * No custom straight-line voyage or cross-island road teleport is permitted.
 */
export function planConstructionFreight(
 site:Point,network:FerryNetwork,graph:RoadGraph,nowHour:number,baselineDeliveryHours:number,
):ConstructionFreight{
 if(!graph.nodeKeys.length)throw Error('Wait for the road network near the hotel and harbour to load.');
 if(!network.ports.length||!network.routes.length)
  throw Error('Harbour and shipping data are not ready. Open the map and try again.');
 const siteNode=nearest(graph,site);
 const siteRoad=siteNode?graph.nodes.get(siteNode):undefined;
 if(!siteRoad||meters(siteRoad,site)>500)
  throw Error('The hotel needs a drivable road within 500 metres for construction-truck access.');
 const ports=network.ports
  .map(port=>({port,meters:meters(port.roadAccess??port.position,site)}))
  .filter(item=>item.meters<=140000&&network.routes.some(r=>r.from===item.port.id||r.to===item.port.id))
  .sort((a,b)=>a.meters-b.meters).slice(0,10);
 if(!ports.length)throw Error('No sea-connected cargo harbour is within reach of this construction site.');
 for(const {port} of ports){
  const harbourNode=connectedPortNode(port,graph);
  if(!harbourNode)continue;
  // The real graph applies direction/turn restrictions and prohibits taxi-only edges.
  const drive=route(graph,harbourNode,siteNode,'',false);
  if(!drive||!drive.path.length||drive.path.length>4500)continue;
  const roadPath=drive.path as Point[];
  const distance=roadPath.slice(1).reduce((n,p,i)=>n+meters(roadPath[i],p),0);
  if(distance>190000)continue;
  const choices=network.routes.map(r=>incomingSeaLeg(r,port.id)).filter(
   (leg):leg is NonNullable<typeof leg>=>!!leg&&leg.path.length>=2
  ).sort((a,b)=>a.durationMinutes-b.durationMinutes);
  const leg=choices[0];if(!leg)continue;
  const origin=network.ports.find(p=>p.id===leg.originId);
  if(!origin)continue;
  const shipHours=Math.max(1,Math.ceil(leg.durationMinutes/60));
  const truckHours=Math.max(1,Math.ceil(distance/32000));
  const unloadHours=2;
  // Include the prior construction-quote lead time (procurement and packing).
  const loadingHours=Math.max(2,baselineDeliveryHours-shipHours-unloadHours-truckHours);
  const shippingHour=nowHour+loadingHours;
  const seaArrivalHour=shippingHour+shipHours;
  const truckDepartureHour=seaArrivalHour+unloadHours;
  return {
   originPortId:origin.id,originPortName:englishFerryName(origin.name),
   destinationPortId:port.id,destinationPortName:englishFerryName(port.name),
   seaRouteId:leg.routeId,seaPath:leg.path,roadPath,
   shippingHour,seaArrivalHour,truckDepartureHour,
   deliveryHour:truckDepartureHour+truckHours,
   roadDistanceMeters:Math.round(distance),
   siteRoadDistanceMeters:Math.round(meters(siteRoad,site)),
  };
 }
 throw Error('No road-connected harbour can deliver to this hotel. Load the roads around the site and nearest port, then try again.');
}

/** Follow existing sea or road geometry for a real map vehicle, never a straight-line teleport. */
export function freightPosition(freight:ConstructionFreight,hour:number):
 {kind:'ship'|'truck';point:Point;bearing:number}|null{
 const stage=freightStage(freight,hour);
 if(stage!=='at-sea'&&stage!=='unloading'&&stage!=='trucking')return null;
 const ship=stage==='at-sea'||stage==='unloading';
 const path=ship?freight.seaPath:freight.roadPath;
 const start=ship?freight.shippingHour:freight.truckDepartureHour;
 const finish=ship?freight.seaArrivalHour:freight.deliveryHour;
 const total=Math.max(1,finish-start);
 const p=stage==='unloading'?1:Math.max(0,Math.min(1,(hour-start)/total));
 const lengths=path.slice(1).map((point,i)=>meters(point,path[i]));
 const sum=lengths.reduce((a,b)=>a+b,0);
 if(sum<1)return null;
 let left=p*sum;
 for(let i=0;i<lengths.length;i++){
  const n=lengths[i];
  if(left<=n||i===lengths.length-1){
   const a=path[i],b=path[i+1];
   const f=n>0?Math.min(1,left/n):1;
   const x=(b[0]-a[0])*Math.cos((a[1]+b[1])*Math.PI/360),y=b[1]-a[1];
   return {kind:ship?'ship':'truck',point:[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f],
    bearing:Math.atan2(x,y)*180/Math.PI};
  }
  left-=n;
 }
 return null;
}
