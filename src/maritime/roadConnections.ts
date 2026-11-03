import type {Point,RoadGraph} from '../simulation/taxi';
import {meters,nearest} from '../simulation/taxi';
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
  // Indexed nearest-node lookup scales with Greece's tiled road network.
  // A road node is usable only if at least one traversable edge is loaded.
  const nearestId=nearest(graph,access);
  let bestId=nearestId&&graph.edges.get(nearestId)?.length?nearestId:undefined;
  let bestDistance=bestId?meters(access,graph.nodes.get(bestId)!):Infinity;
  if(!bestId||bestDistance>maxDistanceMeters){
   // The absolute nearest node can be a disconnected dead-end or have no
   // outgoing edges. Search only nearby candidates in that case.
   const latRadius=maxDistanceMeters/111320;
   const lngRadius=maxDistanceMeters/(111320*Math.max(0.15,Math.cos(access[1]*Math.PI/180)));
   for(const nodeId of graph.nodeKeys){
    const point=graph.nodes.get(nodeId);
    if(!point||Math.abs(point[0]-access[0])>lngRadius||Math.abs(point[1]-access[1])>latRadius)continue;
    if(!graph.edges.get(nodeId)?.length)continue;
    const distance=meters(access,point);
    if(distance<bestDistance){bestDistance=distance;bestId=nodeId;}
   }
  }
  if(bestId!==undefined&&bestDistance<=maxDistanceMeters){
   connected.push({portId:port.id,roadNodeId:bestId,roadPoint:graph.nodes.get(bestId)!,distanceMeters:bestDistance});
  }else{
   unconnected.push({portId:port.id,reason:graph.nodeKeys.length===0?'Road network not loaded':'No routable road node within boarding radius'});
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
