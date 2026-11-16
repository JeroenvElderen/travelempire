/** Explorer Autopilot 2.0 Phase 3.
 * Pure recovery decisions. No automatic teleporting, new road discovery,
 * heavy tow trucks, or cancellation of real operational/ferry travel.
 */
import {meters,type Point,type RoadGraph,type Taxi} from './taxi';

type ActiveExplorer=Pick<Taxi,'kind'|'status'|'position'|'path'|'edgeIds'|'leg'|
 'distanceIntoLeg'|'scoutingRuns'|'deliveryUntil'|'refillRequested'|
 'refillDestination'|'serviceDestination'|'serviceUntil'|'refillUntil'|
 'recoveryPending'|'ferryTrip'|'shiftParked'|'restStopId'|
 'explorerRole'|'discoveryEdgeIds'|'escapeTransitEdgeIds'>;
export type ExplorerRouteHealth=
 {state:'valid';reason:'connected-directed-route'}|
 {state:'waiting-for-tiles';reason:'saved-route-tiles-loading'|'discovery-state-loading';edgeId:string}|
 {state:'invalid';reason:'route-shape'|'invalid-road-permission'|
  'one-way-or-layer-disconnected';edgeId?:string;leg?:number};

export type ExplorerProgressWatch={
 position:Point;leg:number;distanceIntoLeg:number;scoutingRuns:number;
 remainingRoadId:string|null;lastProgressAt:number;
};

/** An unchanged vehicle is not necessarily stuck: exclude every valid
 * game-clock rest, ferry booking, refuel, service and recovery operation.
 * The caller only observes while the tab and dispatcher are active.
 */
export function explorerMovementEligible(
 vehicle:ActiveExplorer,now:number,energyPercent:number,
):boolean{
 return vehicle.kind==='explorer'&&vehicle.status==='EXPLORING'&&
  !vehicle.ferryTrip&&!vehicle.recoveryPending&&!vehicle.refillRequested&&
  !vehicle.refillDestination&&!vehicle.serviceDestination&&!vehicle.shiftParked&&
  !vehicle.restStopId&&!(vehicle.deliveryUntil&&vehicle.deliveryUntil>now)&&
  !(vehicle.refillUntil&&vehicle.refillUntil>now)&&
  !(vehicle.serviceUntil&&vehicle.serviceUntil>now)&&energyPercent>10&&
  vehicle.leg<vehicle.edgeIds.length&&vehicle.path.length>1;
}

/** Persist in the worker between dispatch ticks. A Safari reload resets the
 * watchdog (no false 60s stall from time spent with road data unloaded).
 */
export function watchExplorerProgress(
 previous:ExplorerProgressWatch|undefined,vehicle:ActiveExplorer,now:number,
):{watch:ExplorerProgressWatch;stalledMs:number}{
 const current:ExplorerProgressWatch={
  position:[...vehicle.position],leg:vehicle.leg,
  distanceIntoLeg:vehicle.distanceIntoLeg,scoutingRuns:vehicle.scoutingRuns??0,
  remainingRoadId:vehicle.edgeIds[vehicle.leg]??null,lastProgressAt:now,
 };
 if(!previous||now<previous.lastProgressAt)return {watch:current,stalledMs:0};
 const advanced=meters(previous.position,vehicle.position)>=2||
  previous.leg!==current.leg||
  Math.abs(previous.distanceIntoLeg-vehicle.distanceIntoLeg)>=2||
  previous.scoutingRuns!==current.scoutingRuns||
  previous.remainingRoadId!==current.remainingRoadId;
 if(advanced)return {watch:current,stalledMs:0};
 current.lastProgressAt=previous.lastProgressAt;
 return {watch:current,stalledMs:Math.max(0,now-previous.lastProgressAt)};
}

/** Validate the still-to-be-driven part of an active *saved* mission.
 * Road endpoints are actual OSM node IDs, not nearest map coordinates:
 * a bridge visually crossing a tunnel must never count as a connection.
 * If a saved road tile is not present, HOLD the mission until it loads;
 * never erase it just because the graph was streaming during Safari resume.
 */
export function evaluateExplorerRoute(
 graph:RoadGraph,vehicle:ActiveExplorer,
 knownRoadIds:ReadonlySet<string>,
 roadEndpoints:ReadonlyMap<string,readonly [string,string]>,
 discovered:ReadonlySet<string>,
):ExplorerRouteHealth{
 if(vehicle.path.length!==vehicle.edgeIds.length+1||
  !Number.isInteger(vehicle.leg)||vehicle.leg<0||
  vehicle.leg>=vehicle.edgeIds.length)
  return {state:'invalid',reason:'route-shape',leg:vehicle.leg};
 // Safari restores purple discoveries from IndexedDB asynchronously after
 // restoring the fleet. Do not invalidate an otherwise saved active mission
 // while the historical discovery snapshot has not arrived yet.
 if(discovered.size===0)
  return {state:'waiting-for-tiles',reason:'discovery-state-loading',
   edgeId:vehicle.edgeIds[vehicle.leg]};
 const assigned=new Set(vehicle.discoveryEdgeIds??[]);
 const escape=new Set(vehicle.escapeTransitEdgeIds??[]);
 let previousTarget:string|null=null;
 for(let i=vehicle.leg;i<vehicle.edgeIds.length;i++){
  const id=vehicle.edgeIds[i];
  if(!knownRoadIds.has(id)||!roadEndpoints.has(id))
   return {state:'waiting-for-tiles',reason:'saved-route-tiles-loading',edgeId:id};
  if(!discovered.has(id)&&!assigned.has(id)&&!escape.has(id))
   return {state:'invalid',reason:'invalid-road-permission',edgeId:id,leg:i};
  const endpoints=roadEndpoints.get(id)!;
  const a=graph.nodes.get(endpoints[0]),b=graph.nodes.get(endpoints[1]);
  if(!a||!b)return {state:'waiting-for-tiles',reason:'saved-route-tiles-loading',edgeId:id};
  const forward=meters(vehicle.path[i],a)<=3&&meters(vehicle.path[i+1],b)<=3&&
   (graph.edges.get(endpoints[0])??[]).some(e=>e.id===id&&e.to===endpoints[1]&&e.meters>0);
  const backward=meters(vehicle.path[i],b)<=3&&meters(vehicle.path[i+1],a)<=3&&
   (graph.edges.get(endpoints[1])??[]).some(e=>e.id===id&&e.to===endpoints[0]&&e.meters>0);
  // An explorer can start midway along its first saved road segment.
  // Its legal downstream endpoint still must match a real directed edge.
  const midsegment=i===0&&vehicle.leg===0&&(
   meters(vehicle.path[i+1],b)<=3&&forwardAlongSegment(vehicle.path[i],a,b)&&
    (graph.edges.get(endpoints[0])??[]).some(e=>e.id===id&&e.to===endpoints[1]&&e.meters>0)||
   meters(vehicle.path[i+1],a)<=3&&forwardAlongSegment(vehicle.path[i],b,a)&&
    (graph.edges.get(endpoints[1])??[]).some(e=>e.id===id&&e.to===endpoints[0]&&e.meters>0));
  if(!forward&&!backward&&!midsegment)
   return {state:'invalid',reason:'one-way-or-layer-disconnected',edgeId:id,leg:i};
  const fromNode=forward?endpoints[0]:backward?endpoints[1]:
   meters(vehicle.path[i+1],b)<=3?endpoints[0]:endpoints[1];
  const toNode=forward?endpoints[1]:backward?endpoints[0]:
   meters(vehicle.path[i+1],b)<=3?endpoints[1]:endpoints[0];
  if(previousTarget!==null&&previousTarget!==fromNode)
   return {state:'invalid',reason:'one-way-or-layer-disconnected',edgeId:id};
  previousTarget=toNode;
 }
 return {state:'valid',reason:'connected-directed-route'};
}
/**
 * A corrupt *future* edge must not abruptly erase a valid current mission.
 * Finish only the already verified directed prefix, and stop at a junction
 * with a real outgoing purple edge so the normal planner can safely resume.
 * Never truncate to an arbitrary nearby node or to a red one-way dead end.
 */
export function safeExplorerRoutePrefix(
 graph:RoadGraph,vehicle:ActiveExplorer,health:ExplorerRouteHealth,
 roadEndpoints:ReadonlyMap<string,readonly [string,string]>,
 discovered:ReadonlySet<string>,
):{path:Point[];edgeIds:string[];discoveryEdgeIds:string[];escapeTransitEdgeIds:string[]}|null{
 if(health.state!=='invalid'||health.leg===undefined||health.leg<=vehicle.leg||
  health.leg>=vehicle.edgeIds.length)return null;
 const stop=health.leg;
 const previousId=vehicle.edgeIds[stop-1],pair=roadEndpoints.get(previousId);
 if(!pair)return null;
 const a=graph.nodes.get(pair[0]),b=graph.nodes.get(pair[1]);
 const from=vehicle.path[stop-1],to=vehicle.path[stop];
 if(!a||!b||!from||!to)return null;
 const forward=meters(from,a)<=3&&meters(to,b)<=3&&
  (graph.edges.get(pair[0])??[]).some(e=>e.id===previousId&&e.to===pair[1]&&e.meters>0);
 const backward=meters(from,b)<=3&&meters(to,a)<=3&&
  (graph.edges.get(pair[1])??[]).some(e=>e.id===previousId&&e.to===pair[0]&&e.meters>0);
 // The previous leg is known legal; match its *actual* OSM destination ID
 // instead of snapping a nearby motorway bridge to an underpass.
 const node=forward?pair[1]:backward?pair[0]:null;
 if(!node||(graph.edges.get(node)??[]).some(e=>discovered.has(e.id)&&e.meters>0)===false)return null;
 const edgeIds=vehicle.edgeIds.slice(0,stop);
 const planned=new Set(edgeIds);
 return {path:vehicle.path.slice(0,stop+1),edgeIds,
  discoveryEdgeIds:(vehicle.discoveryEdgeIds??[]).filter(id=>planned.has(id)),
  escapeTransitEdgeIds:(vehicle.escapeTransitEdgeIds??[]).filter(id=>planned.has(id))};
}

function forwardAlongSegment(position:Point,from:Point,to:Point):boolean{
 const length=meters(from,to);
 if(length<1)return false;
 return meters(from,position)<=length+3&&meters(position,to)<=length+3&&
  Math.abs(meters(from,position)+meters(position,to)-length)<=4;
}

export type ExplorerExhaustionProof={
 origin:string;role:Taxi['explorerRole'];at:number;
 roadCount:number;discoveredCount:number;
};
/** A ferry eligibility hint is only emitted after a completed class search.
 * An incomplete node budget, an operational rest, or reserved candidates
 * cannot count as exhaustion. Fresh searches are necessary after road changes.
 */
export function explorerFerryEligible(
 vehicle:ActiveExplorer,
 proof:ExplorerExhaustionProof|undefined,
 now:number,energy:number,
 origin:string|null,
 roadCount:number,discoveredCount:number,
):boolean{
 return !!proof&&(vehicle.status==='IDLE'||vehicle.status==='PAUSED'&&!!vehicle.shiftParked)&&
  !vehicle.ferryTrip&&!vehicle.recoveryPending&&
  !vehicle.refillRequested&&!vehicle.refillDestination&&!vehicle.serviceDestination&&
  !(vehicle.deliveryUntil&&vehicle.deliveryUntil>now)&&
  energy>15&&!!origin&&origin===proof.origin&&
  proof.role===vehicle.explorerRole&&
  proof.roadCount===roadCount&&proof.discoveredCount===discoveredCount&&
  now-proof.at>=0&&now-proof.at<=120000;
}

/** At most two automatic replan attempts per explorer in any five-minute
 * window. A stable valid route is retained when an explorer is still midway
 * through an undiscovered segment: dropping it would risk an illegal restart.
 */
export function canRetryStalledExplorer(
 previous:{attempts:number;firstAt:number;lastAt:number}|undefined,now:number,
):{allowed:boolean;next:{attempts:number;firstAt:number;lastAt:number}}{
 const reset=!previous||now<previous.firstAt||now-previous.firstAt>300000;
 const attempts=reset?0:previous.attempts;
 const firstAt=reset?now:previous.firstAt;
 const lastAt=reset?0:previous.lastAt;
 const allowed=attempts<2&&(reset||now-lastAt>=60000);
 return {allowed,next:{attempts:attempts+(allowed?1:0),firstAt,
  lastAt:allowed?now:lastAt}};
}
