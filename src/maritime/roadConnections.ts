import type {Point,RoadGraph} from '../simulation/taxi';
import {meters} from '../simulation/taxi';
import type {FerryNetwork,FerryPort,FerryTransfer} from './ferries';
import {ferryTransfers} from './ferries';

/** A verified boarding connector must terminate on an actual loaded road node. */
export type FerryRoadConnection={portId:string;roadNodeId:string;roadPoint:Point;distanceMeters:number};
export type FerryConnectionResult={connected:FerryRoadConnection[];unconnected:{portId:string;reason:string}[]};
export const DEFAULT_MAX_BOARDING_DISTANCE_METERS=250;

/** 
 * Index ferry terminals against loaded road nodes. Never create fictional roads
 * or silently connect terminals over long distances / across water.
 * Call again as new road tiles are loaded.
 */
export function connectFerryTerminals(
 network:FerryNetwork,graph:RoadGraph,maxDistanceMeters=DEFAULT_MAX_BOARDING_DISTANCE_METERS,
):FerryConnectionResult{
 const connected:FerryRoadConnection[]=[];
 const unconnected:{portId:string;reason:string}[]=[];
 if(!Number.isFinite(maxDistanceMeters)||maxDistanceMeters<=0)throw new Error('Invalid boarding distance');
 for(const port of network.ports){
  const access=port.roadAccess??port.position;
  let bestId:string|undefined;let bestDistance=Infinity;
  for(const nodeId of graph.nodeKeys){
   const point=graph.nodes.get(nodeId);
   if(!point)continue;
   const distance=meters(access,point);
   if(distance<bestDistance){bestDistance=distance;bestId=nodeId;}
  }
  if(bestId!==undefined&&bestDistance<=maxDistanceMeters){
   connected.push({portId:port.id,roadNodeId:bestId,roadPoint:graph.nodes.get(bestId)!,distanceMeters:bestDistance});
  }else{
   unconnected.push({portId:port.id,reason:bestId===undefined?'Road network not loaded':'No drivable road node within boarding radius'});
  }
 }
 return {connected,unconnected};
}
export type FerryRoadTransfer=FerryTransfer&{fromRoadNodeId:string;toRoadNodeId:string};
/** Return usable ferry links only when both endpoints have road access. */
export function roadAccessibleFerryTransfers(
 network:FerryNetwork,connections:FerryConnectionResult,fromRoadNodeId:string,
):FerryRoadTransfer[]{
 const byPort=new Map(connections.connected.map(c=>[c.portId,c.roadNodeId]));
 return connections.connected.filter(c=>c.roadNodeId===fromRoadNodeId).flatMap(c=>
  ferryTransfers(network,c.portId).flatMap(transfer=>{
   const destination=byPort.get(transfer.toPortId);
   return destination===undefined?[]:[{...transfer,fromRoadNodeId,toRoadNodeId:destination}];
  })
 );
}
export function ferryPortById(network:FerryNetwork,id:string):FerryPort|undefined{
 return network.ports.find(p=>p.id===id);
}
