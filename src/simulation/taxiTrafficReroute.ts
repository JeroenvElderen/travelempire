/** Traffic detours for moving passenger taxis.
 * A route starts at the original current directed road, with progress retained.
 * No teleport, shortcut, road discovery, new passenger, or fare settlement.
 */
import {
 meters,routeTraffic,routeDiscovered,trafficTravelSeconds,
 type RoadGraph,type Point,type Taxi,
} from './taxi';

export type MovingTrafficSnapshot={
 status:'TO_PICKUP'|'TO_DROPOFF';
 jobId?:string;
 roadId:string;
 fromNode:string;
 toNode:string;
 segmentStart:Point;
 segmentEnd:Point;
 position:Point;
 distanceIntoLeg:number;
 remainingPath:Point[];
 remainingEdgeIds:string[];
 destination:Point;
 gameAt:number;
};
export type TaxiTrafficDetour={
 path:Point[];
 edgeIds:string[];
 previousSeconds:number;
 proposedSeconds:number;
 savedSeconds:number;
};
export type TrafficDetourOutcome={
 plan:TaxiTrafficDetour|null;
 reason:'ok'|'invalid-anchor'|'invalid-route'|'unloaded-target'|
 'no-legal-alternative'|'same-route'|'insufficient-savings';
};
const failed=(reason:Exclude<TrafficDetourOutcome['reason'],'ok'>):TrafficDetourOutcome=>
 ({plan:null,reason});
const near=(a:Point,b:Point,limit=3)=>meters(a,b)<=limit;

/** Compare a current committed route against the best legal timed alternative.
 * Every current edge is validated on the directed OSM graph first.
 * Pickup repositioning follows its existing rules; with passengers on board,
 * EVERY edge must remain previously discovered (and no taxi-only shortcuts).
 */
export function planTaxiTrafficDetour(
 graph:RoadGraph,s:MovingTrafficSnapshot,discovered:Set<string>,
):TrafficDetourOutcome{
 const {remainingPath:path,remainingEdgeIds:ids}=s;
 if(!path||!ids||ids.length<2||ids.length!==path.length-1||ids.length>4000||
  !Number.isFinite(s.distanceIntoLeg)||s.distanceIntoLeg<0||
  !Number.isFinite(s.gameAt)||!s.position.every(Number.isFinite))
  return failed('invalid-route');
 const first=graph.nodes.get(s.fromNode),next=graph.nodes.get(s.toNode);
 if(!first||!next||!near(first,s.segmentStart)||!near(next,s.segmentEnd)||
  !near(path[0],first)||!near(path[1],next)||ids[0]!==s.roadId)
  return failed('invalid-anchor');
 const current=graph.edges.get(s.fromNode)?.find(e=>e.to===s.toNode&&e.id===s.roadId);
 if(!current)return failed('invalid-anchor');
 const legLength=meters(first,next);
 if(!(legLength>0)||s.distanceIntoLeg>legLength+2||
  Math.abs(meters(first,s.position)-s.distanceIntoLeg)>12||
  Math.abs(meters(s.position,next)-(legLength-s.distanceIntoLeg))>12)
  return failed('invalid-anchor');
 if(s.status==='TO_DROPOFF'&&!discovered.has(s.roadId))
  return failed('invalid-route');
 let oldSeconds=trafficTravelSeconds(
  Math.max(0,legLength-s.distanceIntoLeg),current.speedKph,s.gameAt,first,current.id,
 );
 let cursor=s.toNode;
 for(let i=1;i<ids.length;i++){
  const found=graph.edges.get(cursor)?.find(e=>
   e.id===ids[i]&&!!graph.nodes.get(e.to)&&near(graph.nodes.get(e.to)!,path[i+1]));
  if(!found||(s.status==='TO_DROPOFF'&&(!discovered.has(found.id)||found.taxiOnly)))
   return failed('invalid-route');
  oldSeconds+=trafficTravelSeconds(found.meters,found.speedKph,s.gameAt,
   graph.nodes.get(cursor),found.id);
  cursor=found.to;
 }
 const target=graph.nodes.get(cursor);
 if(!target||!near(target,s.destination,35))return failed('unloaded-target');
 // Work starts at the NEXT real junction, not the current interpolation point.
 // Incoming fromNode preserves turn-aware one-way and U-turn restrictions.
 const alternative=s.status==='TO_DROPOFF'
  ?routeDiscovered(graph,s.toNode,cursor,discovered,s.fromNode,false,65000)
  :routeTraffic(graph,s.toNode,cursor,s.fromNode,true,45000);
 if(!alternative||alternative.edgeIds.length===0)return failed('no-legal-alternative');
 const proposedPath=[first,...alternative.path];
 const proposedEdgeIds=[s.roadId,...alternative.edgeIds];
 if(proposedPath.length!==proposedEdgeIds.length+1)
  return failed('invalid-route');
 if(proposedEdgeIds.length===ids.length&&
  proposedEdgeIds.every((id,i)=>id===ids[i]))return failed('same-route');
 const firstSeconds=trafficTravelSeconds(
  Math.max(0,legLength-s.distanceIntoLeg),current.speedKph,s.gameAt,first,current.id,
 );
 const proposedSeconds=firstSeconds+alternative.length;
 const savedSeconds=oldSeconds-proposedSeconds;
 // Hysteresis prevents ping-pong rerouting when simulated rush levels change.
 if(!Number.isFinite(savedSeconds)||savedSeconds<Math.max(35,oldSeconds*.12))
  return failed('insufficient-savings');
 return {reason:'ok',plan:{
  path:proposedPath,edgeIds:proposedEdgeIds,
  previousSeconds:oldSeconds,proposedSeconds,savedSeconds,
 }};
}

/** Apply an async plan only while the SAME passenger is on the SAME road.
 * Preserve exact progress, location, driver, job identity, and fares.
 */
export function adoptTaxiTrafficDetour(
 taxi:Taxi,plan:TaxiTrafficDetour,
 expected:Pick<MovingTrafficSnapshot,'jobId'|'status'|'roadId'|
  'segmentStart'|'segmentEnd'|'distanceIntoLeg'|'destination'>,
):Taxi|null{
 if((taxi.kind&&taxi.kind!=='taxi')||taxi.status!==expected.status||
  taxi.activeJobId!==expected.jobId||taxi.ferryTrip||
  taxi.edgeIds[taxi.leg]!==expected.roadId||
  taxi.distanceIntoLeg+2<expected.distanceIntoLeg||
  !taxi.path[taxi.leg]||!taxi.path[taxi.leg+1]||
  !near(taxi.path[taxi.leg],expected.segmentStart)||
  !near(taxi.path[taxi.leg+1],expected.segmentEnd)||
  !plan.path||plan.edgeIds.length!==plan.path.length-1||
  plan.edgeIds[0]!==expected.roadId||
  !near(plan.path[0],expected.segmentStart)||
  !near(plan.path[1],expected.segmentEnd))
  return null;
 const target=taxi.status==='TO_PICKUP'?taxi.pickup:taxi.dropoff;
 if(!target||!near(target,expected.destination,35)||
  !near(plan.path[plan.path.length-1],target,35))return null;
 return {...taxi,path:plan.path,edgeIds:plan.edgeIds,leg:0,
  distanceIntoLeg:taxi.distanceIntoLeg,routeInvalid:false};
}
