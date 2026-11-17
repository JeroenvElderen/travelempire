import {specialistFallbackRoles} from './explorerRoles';
import {energyPercent,energyRangeKm} from './energy';
import {createLongPassengerRequest,passengerTripTypeForAttempt,sufficientPassengerRange} from './passengerJourneys';
import {normalDriverTripPreference,driverTripMatchBonus,driverCoveragePriority,
 type DriverTripPreference} from './driverTripPreferences';
import {rankUnservedCoverage,taxiCanCoverRegion,taxiHasDutyForCoverage,
 COVERAGE_MAX_ROUTE_VISITS} from './taxiRegionalCoverage';
import {taxiCanStartRepositioning,taxiCanCompleteRepositioning,
 taxiRepositionWorthwhile,taxiDemandScore,TAXI_REPOSITION_GLOBAL_INTERVAL_MS,
 TAXI_REPOSITION_MIN_METRES,TAXI_REPOSITION_MAX_METRES
} from './taxiRepositioning';
import {estimateTaxiJob,taxiDispatchScore,taxiJobAcceptable,isTaxiDispatchMode,type TaxiDispatchMode} from './taxiDispatchStrategy';
import {resolvePurpleExplorerStart,prependPurpleStart} from './explorerStart';
import {planSpecialistMission,usesAutopilotRoutePlanner} from './explorerPlanCore';
import {explorerWaitingForRoads} from './explorerParking';
import {validateExplorerMission} from './explorerMissionValidation';
import {canRetryStalledExplorer,evaluateExplorerRoute,safeExplorerRoutePrefix,explorerFerryEligible,explorerMovementEligible,watchExplorerProgress,
 type ExplorerExhaustionProof,type ExplorerProgressWatch,type ExplorerRouteHealth} from './explorerRecoveryController';
import {explorerPlannerIdleQuota,explorerPlannerResultCurrent,explorerRemainingEdges,explorerSuccessorDue,explorerSuccessorUrgent,reserveExplorerDiscoveries} from './explorerAutopilot';
import type {ExplorerRecoveryEvent} from './explorerOperations';
import {inspectExplorerComponent,componentFailureSignature,type DirectedComponentReport} from './explorerConnectivity';
import {routeStrandedExplorerToPurple} from './explorerRecovery';
import {routeIsolatedExplorerToMainNetwork} from './explorerComponentRecovery';
import {isObsoleteExplorerReturn} from './savedReturnJourney';
import {unlockedSpecialistRoles,specialistCanDepart,type RestrictedExplorerRole} from './specialistAccess';
import {hasInvalidRedApproach} from './roundaboutTransit';
import {demandAt} from './demand';
import {setTrafficGameTime,setTrafficIncidents,type TrafficIncident} from './trafficConditions';
import {passengerProfileFor,passengerCompatible} from './passengerProfiles';
import {PassengerStopSpatialIndex,regionalPassengerDemand,type PassengerDepotRegion} from './passengerDepotDemand';
import {HARBOUR_ACCESS_RADIUS_METERS,HARBOUR_ACCESS_EXTRA_METERS} from '../maritime/harbourUnlocks';
import {createPassengerRequest,passengerPairKey,passengerRouteMetres,assignPassenger,dispatchScout,route,routeDiscovered,routeFromDirectedRoad,routeToNearestTarget,nearest,nearbyRoadNodes,meters,trafficTravelSeconds,type RoadGraph,type Taxi,type PassengerRequest,type Point} from './taxi';
let graph:RoadGraph|null=null;
// Two independent exploration planners run outside passenger dispatch.
// Their results are committed by this coordinator only after validating the
// shared discovered network and current route reservations.
type PoolResult={type:'planResult';revision:number;requestId:number;vehicleId:string;
 outcome:string;taxi?:Taxi;roadCount:number;ms:number;error?:string;
 mode?:'idle'|'successor';baseEdgeIds?:string[];discoveryTier?:Taxi['explorerRole'];searchState?:string;requestedRole?:Taxi['explorerRole'];expectedScoutingRuns?:number;originNode?:string;};
type PoolMessage=PoolResult|{type:'ready'|'roadsAdded';revision:number;roadCount?:number};
type PoolSlot={worker:Worker;busy:boolean;requestId:number;ready:boolean;roads:number};
const planningPool:PoolSlot[]=[];
const planningRequests=new Map<number,{id:string;at:number;position:Point;exploredCount:number;
 mode:'idle'|'successor';baseEdgeIds?:string[];requestedRole?:Taxi['explorerRole'];expectedScoutingRuns?:number;originNode?:string}>();
const planningResults=new Map<string,PoolResult>();
const planningLastSent=new Map<string,number>();
const planningBackoff=new Map<string,{until:number;roads:number;explored:number}>();
const planningStats=new Map<string,{result:string;ms:number;queueMs:number;at:number}>();
let nextPlanningRequest=0;

let plannerPoolRevision=0;
let plannerPoolStartedAt=0;
function stopPlanningPool():void{
 for(const slot of planningPool)slot.worker.terminate();
 planningPool.length=0;planningRequests.clear();planningResults.clear();
 planningLastSent.clear();planningStats.clear();planningBackoff.clear();nextPlanningRequest=0;
}
function startPlanningPool(revision:number):void{
 stopPlanningPool();plannerPoolRevision=revision;plannerPoolStartedAt=performance.now();
 try{
  for(let i=0;i<2;i++){
   const worker=new Worker(new URL('./explorationPlanner.worker.ts',import.meta.url),{type:'module'});
   const slot:PoolSlot={worker,busy:false,requestId:0,ready:false,roads:0};
   worker.onmessage=(event:MessageEvent<PoolMessage>)=>{
    const msg=event.data;
    if(msg.revision!==plannerPoolRevision)return;
    if(msg.type==='ready'){slot.ready=true;return;}
    if(msg.type==='roadsAdded'){slot.roads=msg.roadCount??slot.roads;return;}
    if(msg.type!=='planResult'||msg.requestId!==slot.requestId)return;
    slot.busy=false;
    const request=planningRequests.get(msg.requestId);
    if(!request)return;
    planningRequests.delete(msg.requestId);
    planningResults.set(request.id,{...msg,mode:request.mode,baseEdgeIds:request.baseEdgeIds,requestedRole:request.requestedRole,expectedScoutingRuns:request.expectedScoutingRuns,originNode:request.originNode} as PoolResult);
    planningStats.set(request.id,{result:msg.outcome??'unknown',ms:msg.ms??0,
     queueMs:performance.now()-request.at,at:performance.now()});
    if(msg.outcome==='planned')planningBackoff.delete(request.id);
    else planningBackoff.set(request.id,{until:performance.now()+
     (msg.outcome==='no-purple-start'?6000:msg.outcome==='error'?8000:5000),
     roads:msg.roadCount??0,explored:request.exploredCount});
   };
   worker.onerror=()=>{
    // Disable the pool and let the existing dispatcher take over rather
    // than silently leaving specialists idle after a worker crash.
    stopPlanningPool();
   };
   planningPool.push(slot);
   worker.postMessage({type:'init',revision});
  }
 }catch{stopPlanningPool();}
}
const idleSince=new Map<string,number>();
// Worker-only watchdogs never alter a saved vehicle until a legal restart is
// confirmed. Recreated cleanly after Safari reload; no offline stall catch-up.
const explorerProgressWatch=new Map<string,ExplorerProgressWatch>();
const explorerRecoveryAttempts=new Map<string,{attempts:number;firstAt:number;lastAt:number}>();
const explorerRecoveryReason=new Map<string,string>();
// A known bad frontier is skipped briefly instead of being proposed each
// dispatch. Keep one edge per vehicle; no road data or save mutation.
const explorerRejectedCandidate=new Map<string,{edgeId:string;until:number}>();
function rejectExplorerCandidate(id:string,edgeId:string|undefined):void{
 if(edgeId)explorerRejectedCandidate.set(id,{edgeId,until:performance.now()+90000});
}
function explorerPendingReservations(id:string,reserved:ReadonlySet<string>):Set<string>{
 const available=new Set(reserved),blocked=explorerRejectedCandidate.get(id);
 if(blocked){
  if(blocked.until>performance.now())available.add(blocked.edgeId);
  else explorerRejectedCandidate.delete(id);
 }
 return available;
}
const explorerRecoveryEvents:ExplorerRecoveryEvent[]=[];
let explorerRecoveryEventSeq=0;
function recordExplorerRecoveryEvent(vehicleId:string,kind:ExplorerRecoveryEvent['kind'],description:string){
 const at=Date.now();
 explorerRecoveryEvents.push({id:String(at)+'-'+String(++explorerRecoveryEventSeq),
  vehicleId,kind,description,at});
 if(explorerRecoveryEvents.length>30)explorerRecoveryEvents.shift();
}
const explorerExhaustionProof=new Map<string,ExplorerExhaustionProof>();
const parkedProofChecks=new Map<string,number>();
let parkedExhaustionChecks=0;
let stalledExplorerReplans=0,loadedMissionPreservations=0,invalidMissionRecoveries=0;
let passengerRequestsCreated=0,passengerRequestsRejected=0,passengerAssignments=0,passengerRouteFailures=0;
let passengerGenerationAttempts=0,regionalTripsCreated=0,intercityTripsCreated=0,longTripRouteChecks=0;
let taxiRepositionAttempts=0,taxiRepositionSuccesses=0,taxiRepositionRouteFailures=0,lastTaxiRepositionAt=-Infinity;
let coverageAttempts=0,coverageStarts=0,coverageRoadFailures=0,coverageWaitingJobs=0,
 driverPreferenceAssignments=0;
const coverageFailedAt=new Map<string,number>();
const taxiRepositionRetryAt=new Map<string,number>();
let taxiUnprofitableSkips=0,taxiProfitableAssignments=0,taxiEstimatedContribution=0;
const passengerCompletedByTaxi=new Map<string,number>();
let passengerTripsCompleted=0;
let activeRevision=0;
const seenRoadIds=new Set<string>();
// Classification is stable for each road tile; build it once as roads arrive.
const byClass=new Map<string,Set<string>>();
const allRoads=new Set<string>();
const classifiedRoads=new Set<string>();
const roadEndpoints=new Map<string,[string,string]>();
const roadInsertionOrder:string[]=[];
const roadClassCache=new Map<string,Set<string>>();
// Once a road class has actually been discovered, keep its specialists
// unlocked even when the HQ frontier advances or moves to another tile.
const discoveredRoleHistory=new Set<RestrictedExplorerRole>();
function rememberDiscoveredRole(kind:string|undefined){
 switch(roadRole(kind??'')){
 case 'motorway':case 'trunk':discoveredRoleHistory.add('highway');break;
 case 'primary':discoveredRoleHistory.add('primary');break;
 case 'secondary':case 'tertiary':discoveredRoleHistory.add('secondary');break;
 case 'residential':case 'rural':case 'service':discoveredRoleHistory.add('residential');break;
 }
}
const REGION_DEGREES=0.02;
function purpleStartNear(position:Point,explored:Set<string>){
 const lat=Math.floor(position[1]/REGION_DEGREES);
 const lon=Math.floor(position[0]/REGION_DEGREES);
 const nearby=new Set<string>();
 for(let y=lat-1;y<=lat+1;y++)for(let x=lon-1;x<=lon+1;x++)
  for(const id of regionalRoads.get(regionKey(y,x))??[])nearby.add(id);
 return resolvePurpleExplorerStart(graph!,position,explored,roadEndpoints,20,nearby);
}
const regionalRoads=new Map<string,Set<string>>();
const explorerSearchTier=new Map<string,number>();
// Cache negative planning outcomes while the relevant regional frontier remains stable.
// A bounded TTL also recovers from connectivity changes outside the local index.
const negativeScoutCache=new Map<string,{signature:string;until:number}>();
let negativeScoutCacheHits=0;
let negativeScoutEmptySkips=0;
const NEGATIVE_SCOUT_TTL_MS=30000;
function scoutSignature(position:Point,tier:number,roadCount:number,role:string):string{
 // Exploration elsewhere changes on almost every tick. Including global
 // explored/frontier counts invalidated negative results before reuse.
 // Bound stale results with a short TTL; new road tiles invalidate immediately.
 return [role,position[0].toFixed(4),position[1].toFixed(4),tier,roadCount].join('|');
}
const SEARCH_RADII_KM=[3,8,20,60,180,Infinity];
let regionalLookups=0;
let regionalCandidatesExamined=0;
const regionalMissionQueues=new Map<string,{ids:Set<string>}>();
const regionalCellVersions=new Map<string,number>();
const MAX_REGIONAL_MISSION_QUEUES=3200;
let regionalMissionQueueHits=0,regionalMissionQueueBuilds=0;
let candidateSelectionMs=0,scoutRoutingMs=0,reachabilityChecks=0,reachabilitySkips=0;
let reachabilityMs=0,reachabilityRejected=0,prioritizedCandidates=0;
const MAX_REACHABILITY_NODES=12000;
const MAX_PRIORITY_CANDIDATES=512;
const regionalQueueVersions=new Map<string,number>();
const reachabilityCache=new Map<string,{visited:Set<string>;complete:boolean}>();
const MAX_REACHABILITY_CACHE=12;
let reachabilityCacheHits=0,reachabilityCacheMisses=0;
const successorNegativeCache=new Map<string,{signature:string;until:number}>();
const failedRouteCache=new Map<string,{signature:string;until:number}>();
const FAILED_ROUTE_RETRY_MS=8000;
let failedRouteCacheHits=0,failedRouteSearches=0;
const majorRoadSearchDiagnostics=new Map<string,{role:string;outcome:string;eligible:number;candidates:number;entries:number;visits:number;attempts:number;at:number}>();
const explorerPlanningAttempts=new Map<string,number>();
const failedRouteSignature=(id:string,role:string,position:Point,tier:number,roadCount:number,_exploredCount:number,poiSignature:string)=>[id,role,position[0].toFixed(5),position[1].toFixed(5),tier,roadCount,role==='poi'?poiSignature:''].join('|');
let successorNegativeCacheHits=0;
const poiRetryWallClock=new Map<string,{until:number;roadCount:number;poiSignature:string}>();
let poiCooldownSkips=0;
const regionKey=(lat:number,lon:number)=>lat+':'+lon;
function indexRegionalRoad(id:string,a:Point,b:Point):void{
 const keys=new Set([a,b].map(p=>regionKey(Math.floor(p[1]/REGION_DEGREES),Math.floor(p[0]/REGION_DEGREES))));
 for(const key of keys){let bucket=regionalRoads.get(key);if(!bucket){bucket=new Set();regionalRoads.set(key,bucket);}bucket.add(id);regionalCellVersions.set(key,(regionalCellVersions.get(key)??0)+1);}
}
function regionalCandidates(position:Point,eligible:Set<string>,explored:Set<string>,reserved:Set<string>,radiusKm:number,_role='balanced'):Set<string>{
 regionalLookups++;
 // A broad fallback should scan the eligible class once rather than iterating
 // tens of thousands of empty geographic cells.
 if(!Number.isFinite(radiusKm)||radiusKm>25)return new Set([...eligible].filter(id=>!explored.has(id)&&!reserved.has(id)));
 const latRadius=radiusKm/111;
 const lonRadius=radiusKm/(111*Math.max(0.25,Math.cos(position[1]*Math.PI/180)));
 const minLat=Math.floor((position[1]-latRadius)/REGION_DEGREES),maxLat=Math.floor((position[1]+latRadius)/REGION_DEGREES);
 const minLon=Math.floor((position[0]-lonRadius)/REGION_DEGREES),maxLon=Math.floor((position[0]+lonRadius)/REGION_DEGREES);
 const result=new Set<string>();
 for(let lat=minLat;lat<=maxLat;lat++)for(let lon=minLon;lon<=maxLon;lon++){
  const cell=regionKey(lat,lon),key=cell; // Cell data is role-independent; reuse the same indexed queue for every explorer class.
  let queue=regionalMissionQueues.get(key);
  if(!queue||regionalQueueVersions.get(key)!==(regionalCellVersions.get(cell)??0)){
   const ids=new Set<string>();
   for(const id of regionalRoads.get(cell)??[])ids.add(id);
   queue={ids};regionalQueueVersions.set(key,regionalCellVersions.get(cell)??0);
   regionalMissionQueues.delete(key);regionalMissionQueues.set(key,queue);regionalMissionQueueBuilds++;
    if(regionalMissionQueues.size>MAX_REGIONAL_MISSION_QUEUES){const oldest=regionalMissionQueues.keys().next().value;if(oldest!==undefined){regionalMissionQueues.delete(oldest);regionalQueueVersions.delete(oldest);}}
  }else regionalMissionQueueHits++;
  for(const id of queue.ids)if(eligible.has(id)&&!explored.has(id)&&!reserved.has(id))result.add(id);
 }
 regionalCandidatesExamined+=result.size;
 return result;
}

// Safe reachability precheck: only discard unreachable candidates if the
// entire directed component has been traversed. A bounded/incomplete scan
// leaves candidates untouched to preserve exploration correctness.
function prioritizeScoutCandidates(g:RoadGraph,position:Point,candidates:Set<string>):Set<string>{
 if(candidates.size<=1)return candidates;
 const started=performance.now();
 const source=nearest(g,position);
 if(!source)return candidates;
 reachabilityChecks++;
 const cacheKey=seenRoadIds.size+'|'+source;
 let cached=reachabilityCache.get(cacheKey);
 if(cached){reachabilityCacheHits++;reachabilityCache.delete(cacheKey);reachabilityCache.set(cacheKey,cached);}
 else{
  reachabilityCacheMisses++;
  const visited=new Set<string>([source]),queue=[source];
  for(let i=0;i<queue.length&&queue.length<=MAX_REACHABILITY_NODES;i++){
   for(const edge of g.edges.get(queue[i])??[])if(!visited.has(edge.to)){
    visited.add(edge.to);queue.push(edge.to);
    if(queue.length>MAX_REACHABILITY_NODES)break;
   }
  }
  cached={visited,complete:queue.length<=MAX_REACHABILITY_NODES};
  reachabilityCache.set(cacheKey,cached);
  if(reachabilityCache.size>MAX_REACHABILITY_CACHE){const oldest=reachabilityCache.keys().next().value;if(oldest!==undefined)reachabilityCache.delete(oldest);}
 }
 const {visited,complete}=cached;
 const ranked:{id:string;distance:number}[]=[];
 for(const id of candidates){
  const ends=roadEndpoints.get(id);
  if(!ends)continue;
  if(complete&&!visited.has(ends[0])&&!visited.has(ends[1])){reachabilityRejected++;continue;}
  const a=g.nodes.get(ends[0]),b=g.nodes.get(ends[1]);
  const d=Math.min(a?meters(position,a):Infinity,b?meters(position,b):Infinity);
  ranked.push({id,distance:d});
 }
 reachabilityMs+=performance.now()-started;
 if(complete&&ranked.length===0){reachabilitySkips++;return new Set();}
 // Rank the closest candidates first, but retain all reachable candidates
 // so dispatchScout can still find a more distant valid route.
 ranked.sort((a,b)=>a.distance-b.distance);
 prioritizedCandidates+=Math.min(ranked.length,MAX_PRIORITY_CANDIDATES);
 return new Set(ranked.map(v=>v.id));
}
// Prefer the current road block before distant discovery targets. Only
// narrow candidates when a nearby eligible class road is available.
function preferConnectedCandidates(g:RoadGraph,position:Point,candidates:Set<string>,role:string):Set<string>{
 if(role==='poi'||!candidates.size)return candidates;
 const start=nearest(g,position);
 if(!start)return candidates;
 const touching=new Set<string>(),nearby=new Set<string>();
 for(const id of candidates){
  const ends=roadEndpoints.get(id);if(!ends)continue;
  if((ends[0]===start||ends[1]===start)&&(g.edges.get(start)??[]).some(e=>e.id===id)){touching.add(id);continue;}
  if(!revealedNodesIndex.has(ends[0])&&!revealedNodesIndex.has(ends[1]))continue;
  const a=g.nodes.get(ends[0]),b=g.nodes.get(ends[1]);
  if((a&&meters(a,position)<1800)||(b&&meters(b,position)<1800))nearby.add(id);
 }
 return touching.size?touching:nearby.size?nearby:candidates;
}


// Incremental targeted routing: preserve the Dijkstra frontier between worker
// dispatches instead of restarting a nationwide 24k-visit search each time.
type MajorEntry={from:string;to:string;id:string;distance:number};
type MajorState={node:string;incoming:string;cost:number;parent:number;edgeId:string};
type MajorSearch={start:string;role:string;born:number;entries:MajorEntry[];targets:Map<string,number[]>;
 states:MajorState[];best:Map<string,number>;heap:number[];visits:number;roadCount:number;complete:boolean};
const majorSearches=new Map<string,MajorSearch>();
const MAJOR_ROUTE_SLICE=1800;
const MAJOR_ROUTE_MAX_VISITS=100000;
function majorSearchPush(search:MajorSearch,id:number):void{
 const {heap,states}=search;heap.push(id);let i=heap.length-1;
 while(i>0){const p=(i-1)>>1;if(states[heap[p]].cost<=states[id].cost)break;heap[i]=heap[p];i=p;}
 heap[i]=id;
}
function majorSearchPop(search:MajorSearch):number|undefined{
 const {heap,states}=search;if(!heap.length)return undefined;
 const first=heap[0],last=heap.pop()!;
 if(heap.length){let i=0;while(2*i+1<heap.length){let c=2*i+1;
  if(c+1<heap.length&&states[heap[c+1]].cost<states[heap[c]].cost)c++;
  if(states[heap[c]].cost>=states[last].cost)break;heap[i]=heap[c];i=c;
 }heap[i]=last;}
 return first;
}
function resumeMajorSearch(search:MajorSearch,g:RoadGraph,explored:Set<string>,reservedEdges:Set<string>,reservedTargets:Set<string>):{path:Point[];edgeIds:string[];target:MajorEntry}|null{
 let slice=0;
 const sliceStarted=performance.now();
 while(search.heap.length&&slice++<MAJOR_ROUTE_SLICE&&search.visits<MAJOR_ROUTE_MAX_VISITS&&performance.now()-sliceStarted<12){
  const id=majorSearchPop(search)!;
  const state=search.states[id];
  const key=state.node+'|'+state.incoming;
  if(state.cost!==(search.best.get(key)??Infinity))continue;
  search.visits++;
  for(const targetIndex of search.targets.get(state.node)??[]){
   const entry=search.entries[targetIndex];
   if(explored.has(entry.id)||reservedEdges.has(entry.id)||reservedTargets.has(entry.to))continue;
   if(!(g.edges.get(entry.from)??[]).some(e=>e.id===entry.id&&e.to===entry.to))continue;
   const keys:string[]=[],edgeIds:string[]=[];
   for(let n=id;n>=0;n=search.states[n].parent){
    const step=search.states[n];const point=g.nodes.get(step.node);
    if(!point)return null;
    keys.push(step.node);if(step.parent>=0)edgeIds.push(step.edgeId);
   }
   keys.reverse();edgeIds.reverse();
   return {path:keys.map(k=>g.nodes.get(k)!),edgeIds,target:entry};
  }
  for(const edge of g.edges.get(state.node)??[]){
   // Travel between discovery targets exclusively on discovered roads.
   if(!explored.has(edge.id))continue;
   // Do not reverse direction at a junction unless it is a dead-end.
   if(state.incoming===edge.to&&(g.edges.get(state.node)??[]).some(e=>e.to!==state.incoming))continue;
   const cost=state.cost+edge.meters;
   const nextKey=edge.to+'|'+state.node;
   if(cost>=(search.best.get(nextKey)??Infinity))continue;
   search.best.set(nextKey,cost);
   const next=search.states.length;
   search.states.push({node:edge.to,incoming:state.node,cost,parent:id,edgeId:edge.id});
   majorSearchPush(search,next);
  }
 }
 search.complete=search.heap.length===0||search.visits>=MAJOR_ROUTE_MAX_VISITS;
 return null;
}
// Target a reachable motorway/trunk entry node instead of blindly expanding a
// broad local Dijkstra. Transit edges do not count as discoveries.
function targetMajorRoadMission(taxi:Taxi,g:RoadGraph,candidates:Set<string>,explored:Set<string>,reservedTargets:Set<string>,reservedEdges:Set<string>,eligibleCount:number):Taxi|null{
 const previous=majorRoadSearchDiagnostics.get(taxi.id);
 const stats={role:taxi.explorerRole??'',outcome:'searching',eligible:eligibleCount,candidates:candidates.size,entries:0,visits:0,attempts:(previous?.attempts??0)+1,at:performance.now()};
 majorRoadSearchDiagnostics.set(taxi.id,stats);
 const start=nearest(g,taxi.position);
 if(!start||!(g.edges.get(start)??[]).some(e=>explored.has(e.id))||!revealedNodesIndex.has(start)||(!candidates.size&&!majorSearches.has(taxi.id))){stats.outcome='no-start-or-candidates';majorSearches.delete(taxi.id);return null;}
 let search=majorSearches.get(taxi.id);
 // New tiles add graph edges; old searches remain valid for a short bounded
 // lifetime and are refreshed to discover newly reachable components.
 if(search&&(search.start!==start||search.role!==taxi.explorerRole||
    search.complete||performance.now()-search.born>60000)){
  majorSearches.delete(taxi.id);search=undefined;
 }
 if(!search){
  const ranked:MajorEntry[]=[];
  for(const id of candidates){
   if(explored.has(id)||reservedEdges.has(id))continue;
   const ends=roadEndpoints.get(id);if(!ends)continue;
   for(const [from,to] of [ends,[ends[1],ends[0]]] as [string,string][]){
    if(reservedTargets.has(to)||!(g.edges.get(from)??[]).some(e=>e.id===id&&e.to===to))continue;
    const point=g.nodes.get(from);if(point)ranked.push({from,to,id,distance:meters(taxi.position,point)});
   }
  }
  if(!ranked.length){stats.outcome='no-valid-entry';return null;}
  ranked.sort((a,b)=>a.distance-b.distance);
  const entries=ranked.length<=96?ranked:[
   ...ranked.slice(0,48),
   ...Array.from({length:32},(_,i)=>ranked[Math.floor(48+(ranked.length-48)*(i+.5)/32)]),
   ...ranked.slice(-16)
  ];
  const targets=new Map<string,number[]>();
  entries.forEach((entry,i)=>{const list=targets.get(entry.from)??[];list.push(i);targets.set(entry.from,list);});
  const incoming=taxi.lastRoadTo===start?taxi.lastRoadFrom??'':'';
  const state:MajorState={node:start,incoming,cost:0,parent:-1,edgeId:''};
  search={start,role:taxi.explorerRole??'',born:performance.now(),entries,targets,
   states:[state],best:new Map([[start+'|'+incoming,0]]),heap:[0],visits:0,roadCount:seenRoadIds.size,complete:false};
  majorSearches.set(taxi.id,search);
 }
 stats.entries=search.entries.length;
 const result=resumeMajorSearch(search,g,explored,reservedEdges,reservedTargets);
 stats.visits=search.visits;
 if(!result){
  stats.outcome=search.complete?'unreachable':'search-in-progress';
  if(search.complete)majorSearches.delete(taxi.id);
  return null;
 }
 majorSearches.delete(taxi.id);
 stats.outcome='success';
 reservedTargets.add(result.target.to);
 for(const id of result.edgeIds)reservedEdges.add(id);
 reservedEdges.add(result.target.id);
 const destination=g.nodes.get(result.target.to);
 if(!destination)return null;
 return {...taxi,status:'EXPLORING',path:[...result.path,destination],
  edgeIds:[...result.edgeIds,result.target.id],discoveryEdgeIds:[result.target.id],
  journeyEdges:[],leg:0,distanceIntoLeg:0,pickup:undefined,dropoff:undefined,fare:0,
  scoutingRuns:(taxi.scoutingRuns??0)+1};
}

// Persistent worker-local indexes, reset on graph revision.
const indexedExplored=new Set<string>();
const revealedNodesIndex=new Set<string>();
const completionRoadsIndex=new Set<string>();
const connectedFrontierIndex=new Set<string>();
let connectedHqNode:string|null=null;
let discoveryIndexRoads=0;
let discoveryIndexUpdates=0;
let discoveryIndexRebuilds=0;
let discoveryIndexLastMs=0;
let poiRoadsIndex=new Set<string>();
const nearestHarbourRoads=new Map<number,{id:string;distance:number}>();
const harbourAccessCandidates=new Map<number,Array<{id:string;distance:number}>>();
let poiTargetsSignature='';
let poiIndexedRoads=0;
const pendingLoadedExplored=new Set<string>();
// Incremental passenger stop index, independent of the 600k-edge graph scan.
const passengerIndexedRoads=new Set<string>();
const passengerEligibleStops=new Set<string>();
const passengerSpatialStops=new PassengerStopSpatialIndex();
const taxiOnlyRoadIds=new Set<string>();
let passengerLastSelectedDepot:string|null=null;
function registerPassengerStop(node:string):void{
 const position=graph?.nodes.get(node);
 if(!position)return;
 passengerEligibleStops.add(node);
 passengerSpatialStops.add(node,position);
}
let passengerIndexRebuilds=0;
let passengerIndexAdded=0;
function passengerStopsFor(explored:Set<string>):Set<string>{
 let reset=explored.size<passengerIndexedRoads.size;
 if(!reset&&explored.size===passengerIndexedRoads.size){
  for(const id of passengerIndexedRoads)if(!explored.has(id)){reset=true;break;}
 }
 if(reset){passengerIndexedRoads.clear();passengerEligibleStops.clear();passengerSpatialStops.clear();passengerIndexRebuilds++;}
 for(const id of explored){
  if(passengerIndexedRoads.has(id))continue;
  passengerIndexedRoads.add(id);
  const ends=roadEndpoints.get(id);
  if(ends&&!taxiOnlyRoadIds.has(id)){
   registerPassengerStop(ends[0]);registerPassengerStop(ends[1]);
  }
  passengerIndexAdded++;
 }
 return passengerEligibleStops;
}
function updateDiscoveryIndex(g:RoadGraph, explored:Set<string>, hqNode:string|null){
 const started=performance.now();
 let rebuild=explored.size<indexedExplored.size||hqNode!==connectedHqNode;
 if(!rebuild)for(const id of indexedExplored)if(!explored.has(id)){rebuild=true;break;}
 if(rebuild){
  indexedExplored.clear();revealedNodesIndex.clear();completionRoadsIndex.clear();connectedFrontierIndex.clear();discoveredRoleHistory.clear();
  connectedHqNode=hqNode;discoveryIndexRoads=0;discoveryIndexRebuilds++;
 }
 const touched=new Set<string>();
 for(const node of pendingLoadedExplored){revealedNodesIndex.add(node);touched.add(node);}
 pendingLoadedExplored.clear();
 for(const id of explored)if(!indexedExplored.has(id)){
  indexedExplored.add(id);
  const ends=roadEndpoints.get(id);
  if(ends){const road=(g.edges.get(ends[0])??[]).find(e=>e.id===id)??
   (g.edges.get(ends[1])??[]).find(e=>e.id===id);
   rememberDiscoveredRole(road?.highway);
   for(const node of ends){revealedNodesIndex.add(node);touched.add(node);}}
 }
 // Road additions can expose new connector candidates between revealed nodes.
 if(discoveryIndexRoads!==seenRoadIds.size){
  for(let i=discoveryIndexRoads;i<roadInsertionOrder.length;i++){
   const id=roadInsertionOrder[i],ends=roadEndpoints.get(id);
   if(ends&&!indexedExplored.has(id)&&(revealedNodesIndex.has(ends[0])||revealedNodesIndex.has(ends[1])))completionRoadsIndex.add(id);
  }
  discoveryIndexRoads=seenRoadIds.size;
 }
 for(const node of touched)for(const edge of g.edges.get(node)??[]){
  if(indexedExplored.has(edge.id))completionRoadsIndex.delete(edge.id);
  else completionRoadsIndex.add(edge.id);
 }
 const pending:string[]=[];
 // Newly explored directed edges can connect a component to the HQ frontier.
 for(const node of touched)if(!connectedFrontierIndex.has(node))for(const edge of g.edges.get(node)??[]){
  if(indexedExplored.has(edge.id)&&connectedFrontierIndex.has(edge.to)){
   // Reverse traversal is not generally valid for one-way roads; the HQ
   // traversal below still determines which direction can be reached.
   pending.push(edge.to);
  }
 }
 if(hqNode&&!connectedFrontierIndex.has(hqNode)){connectedFrontierIndex.add(hqNode);pending.push(hqNode);}
 for(const node of touched)if(connectedFrontierIndex.has(node))pending.push(node);
 for(let i=0;i<pending.length;i++)for(const edge of g.edges.get(pending[i])??[]){
  if(!indexedExplored.has(edge.id)||connectedFrontierIndex.has(edge.to))continue;
  connectedFrontierIndex.add(edge.to);pending.push(edge.to);
 }
 discoveryIndexUpdates++;discoveryIndexLastMs=performance.now()-started;
}
function updatePoiIndex(g:RoadGraph,targets:Point[]){
 const signature=JSON.stringify(targets);
 if(signature!==poiTargetsSignature){
  poiTargetsSignature=signature;poiRoadsIndex=new Set();nearestHarbourRoads.clear();harbourAccessCandidates.clear();poiIndexedRoads=0;poiRoadCursor=0;
 }
 if(!targets.length)return;
 if(poiIndexedRoads===seenRoadIds.size)return;
 // Track the actual nearest access segment for each harbour as road tiles
 // arrive. Discovering an unrelated road 500m away must not unlock a port.
 // Distances use a point-to-segment projection, not just endpoint proximity.
 let cursor=poiRoadCursor;
 for(;cursor<roadInsertionOrder.length;cursor++){
  const id=roadInsertionOrder[cursor],ends=roadEndpoints.get(id);
  if(!ends)continue;
  const a=g.nodes.get(ends[0]),b=g.nodes.get(ends[1]);if(!a||!b)continue;
  for(let i=0;i<targets.length;i++){
   const p=targets[i],margin=0.005;
   if(p[0]<Math.min(a[0],b[0])-margin||p[0]>Math.max(a[0],b[0])+margin||
      p[1]<Math.min(a[1],b[1])-margin||p[1]>Math.max(a[1],b[1])+margin)continue;
   const cos=Math.cos(p[1]*Math.PI/180),ax=(a[0]-p[0])*111320*cos,ay=(a[1]-p[1])*111320;
   const vx=(b[0]-a[0])*111320*cos,vy=(b[1]-a[1])*111320;
   const fraction=Math.max(0,Math.min(1,-(ax*vx+ay*vy)/(vx*vx+vy*vy||1)));
   const distance=Math.hypot(ax+fraction*vx,ay+fraction*vy);
   const previous=nearestHarbourRoads.get(i);
   if(distance<=300&&(!previous||distance<previous.distance))nearestHarbourRoads.set(i,{id,distance});
   // A mapped terminal often spans several connected short road pieces.
   // Match the same entrance corridor used by the harbour-unlock index.
   if(distance<=HARBOUR_ACCESS_RADIUS_METERS){
    const list=harbourAccessCandidates.get(i)??[];
    list.push({id,distance});
    harbourAccessCandidates.set(i,list);
   }
  }
 }
 poiRoadsIndex=new Set();
 for(const [index,best] of nearestHarbourRoads){
  poiRoadsIndex.add(best.id);
  for(const road of harbourAccessCandidates.get(index)??[])
   if(road.distance<=Math.min(HARBOUR_ACCESS_RADIUS_METERS,best.distance+HARBOUR_ACCESS_EXTRA_METERS))poiRoadsIndex.add(road.id);
 }
 poiRoadCursor=cursor;
 poiIndexedRoads=seenRoadIds.size;
}

// The POI specialist pursues harbour-access segments by shortest driven distance.
// Unlike road-class specialists, every previously red road on the chosen route
// is a discovery edge. The route remains directed and stays on the road graph.
const roadRole=(h:string)=>h==='motorway'||h==='motorway_link'?'motorway':h==='trunk'||h==='trunk_link'?'trunk':h==='primary'||h==='primary_link'?'primary':h==='secondary'||h==='secondary_link'?'secondary':h==='tertiary'||h==='tertiary_link'?'tertiary':h==='residential'||h==='living_street'?'residential':h==='unclassified'||h==='track'||h==='road'?'rural':h==='service'?'service':null;
type Init={type:'init';revision:number;plannerPoolEnabled?:boolean};
type AddRoads={type:'addRoads';revision:number;roads:import('../data/roadTiles').RoadSegment[]};
const idleFallbackAt=new Map<string,number>();
// Prevent deterministic fallback generation from repeatedly selling the
// same point-to-point ride every few seconds when the map is still small.
const recentPassengerPairs=new Map<string,number>();
const PASSENGER_PAIR_COOLDOWN_MS=180000;
// Avoid repeating costly route extensions on every dispatch while a scout
// continues following a valid route.
const extensionRetryAt=new Map<string,number>();
const extensionLastDestination=new Map<string,string>();
const EXTENSION_RETRY_MS=4000;
// An exploration mission is a committed route. Its successor is calculated
// from the known endpoint before the vehicle finishes the current mission.
const missionSequence=new Map<string,number>();
const missionPlannedAt=new Map<string,number>();
const missionLastEndpoint=new Map<string,string>();
type ExplorerMission={id:number;vehicleId:string;role:string;status:'active'|'completed'|'interrupted';targetNode:string;assignedAt:number;plannedEdges:number};
const explorerMissions=new Map<string,ExplorerMission>();
let completedExplorerMissions=0;
let interruptedExplorerMissions=0;
let missionCounter=0;
function recordExplorerMission(taxi:Taxi,now:number):void{
 const destination=taxi.path.at(-1);
 if(!destination)return;
 const target=nearest(graph!,destination);
 if(!target)return;
 explorerMissions.set(taxi.id,{id:++missionCounter,vehicleId:taxi.id,role:taxi.explorerRole??'balanced',status:'active',targetNode:target,assignedAt:now,plannedEdges:taxi.edgeIds.length});
}

const MISSION_LOOKAHEAD_EDGES=48;
const MAX_SUCCESSOR_PLANS_PER_DISPATCH=1;
// Avoid repeated nationwide path searches for unchanged idle scouts.
const idleRetryAt=new Map<string,number>();
const idleRetryRoadCount=new Map<string,number>();
const idleRetryExploredCount=new Map<string,number>();
const idleRetryPosition=new Map<string,string>();
const IDLE_RETRY_MS=5000;
let pausedExplorerRecoveries=0,depotReturns=0,depotRouteFailures=0;
const autoParkedExplorers=new Map<string,{roads:number;explored:number}>();
let autoParkReactivations=0,deferredDepotReturns=0,obsoleteReturnRecoveries=0;
// Limit expensive new mission searches per worker dispatch. Existing routes continue unaffected.
const MAX_IDLE_MISSION_PLANS_PER_DISPATCH=3;
let nextExplorerIndex=0;
const explorerLastPlanAttempt=new Map<string,number>();
const explorerLastConsidered=new Map<string,number>();
let explorerConsiderationSequence=0;
const explorerPlanSkipReason=new Map<string,string>();
// The iPhone single-worker fallback shares this graph instead of cloning it
// into two planning workers. Throttle deterministic frontier scans per explorer.
const singleWorkerScanAt=new Map<string,number>();
const singleWorkerScanResult=new Map<string,string>();
const explorerComponents=new Map<string,DirectedComponentReport>();
const explorerStartIssues=new Map<string,{nearestNodeMeters:number;nearestNodePurpleEdges:number;loadedPurpleRoads:number}>();
const frontierFailureCache=new Map<string,{signature:string;retryAt:number}>();
// Legacy roundabout/one-way fallback is expensive; do not rescan the entire
// graph every time a new connected-frontier search finds no candidate.
const legacyFallbackAt=new Map<string,number>();
const strandedRecoveryRetryAt=new Map<string,number>();

let poiRoadCursor=0;
// A failed scout permits the next road class to bootstrap without motorway access.

type OperationalRouteRequest={type:'operationalRoute';revision:number;requestId:number;vehicleId:string;purpose:'shift'|'service';from:Point;targets:Point[];allowTaxiOnly?:boolean};
type FuelPlanRequest={type:'fuelPlan';revision:number;requestId:number;vehicleId:string;from:Point;targets:{point:Point;depot:boolean}[];allowTaxiOnly?:boolean};
type RouteRequest={type:'routeRequest';revision:number;requestId:number;from:Point;to:Point;discoveredOnly?:boolean;allowTaxiOnly?:boolean;activeRoad?:{edgeId:string;start:Point;end:Point}};
type Dispatch={type:'dispatch';revision:number;now:number;gameNow?:number;taxis:Taxi[];queue:PassengerRequest[];discovered:string[];hq:Point;allowMission:boolean;allowTaxiShift:boolean;allowScout:boolean;stations?:Point[];poiTargets?:Point[];poiMissions?:{vehicleId:string;portId:string;point:Point}[];harbourTargets?:Point[];parkingTargets?:Point[];availableTaxiIds?:string[];depots?:Array<{id:string;position:Point}>;taxiDispatchMode?:TaxiDispatchMode;driverTripPreferences?:Record<string,DriverTripPreference>;driverDutyRemainingSeconds?:Record<string,number>;trafficIncidents?:TrafficIncident[]};
self.onmessage=async(event:MessageEvent<Init|Dispatch|AddRoads|RouteRequest|FuelPlanRequest|OperationalRouteRequest>)=>{
 const msg=event.data;
 try{
  if(msg.type==='init'){
   explorerProgressWatch.clear();explorerRecoveryAttempts.clear();
   explorerRecoveryReason.clear();explorerRejectedCandidate.clear();explorerRecoveryEvents.length=0;explorerRecoveryEventSeq=0;explorerExhaustionProof.clear();parkedProofChecks.clear();parkedExhaustionChecks=0;
   stalledExplorerReplans=0;loadedMissionPreservations=0;invalidMissionRecoveries=0;
   idleSince.clear();majorSearches.clear();majorRoadSearchDiagnostics.clear();explorerPlanningAttempts.clear();explorerLastPlanAttempt.clear();explorerLastConsidered.clear();explorerPlanSkipReason.clear();singleWorkerScanAt.clear();singleWorkerScanResult.clear();explorerComponents.clear();explorerStartIssues.clear();frontierFailureCache.clear();legacyFallbackAt.clear();strandedRecoveryRetryAt.clear();explorerConsiderationSequence=0;passengerRequestsCreated=0;passengerRequestsRejected=0;passengerAssignments=0;passengerRouteFailures=0;passengerGenerationAttempts=0;regionalTripsCreated=0;intercityTripsCreated=0;longTripRouteChecks=0;taxiUnprofitableSkips=0;taxiProfitableAssignments=0;taxiEstimatedContribution=0;taxiRepositionAttempts=0;taxiRepositionSuccesses=0;taxiRepositionRouteFailures=0;lastTaxiRepositionAt=-Infinity;taxiRepositionRetryAt.clear();coverageAttempts=0;coverageStarts=0;coverageRoadFailures=0;coverageWaitingJobs=0;driverPreferenceAssignments=0;coverageFailedAt.clear();passengerCompletedByTaxi.clear();passengerTripsCompleted=0;nextExplorerIndex=0;regionalRoads.clear();autoParkedExplorers.clear();failedRouteCache.clear();reachabilityCache.clear();regionalCellVersions.clear();regionalMissionQueues.clear();regionalQueueVersions.clear();poiRetryWallClock.clear();poiCooldownSkips=0;regionalMissionQueueHits=0;regionalMissionQueueBuilds=0;successorNegativeCache.clear();successorNegativeCacheHits=0;explorerSearchTier.clear();negativeScoutCache.clear();negativeScoutCacheHits=0;negativeScoutEmptySkips=0;regionalLookups=0;regionalCandidatesExamined=0;idleFallbackAt.clear();missionSequence.clear();missionPlannedAt.clear();missionLastEndpoint.clear();explorerMissions.clear();completedExplorerMissions=0;interruptedExplorerMissions=0;missionCounter=0;extensionRetryAt.clear();extensionLastDestination.clear();idleRetryAt.clear();idleRetryRoadCount.clear();idleRetryExploredCount.clear();idleRetryPosition.clear();poiRoadCursor=0;byClass.clear();allRoads.clear();classifiedRoads.clear();roadEndpoints.clear();roadInsertionOrder.length=0;roadClassCache.clear();indexedExplored.clear();revealedNodesIndex.clear();completionRoadsIndex.clear();connectedFrontierIndex.clear();discoveredRoleHistory.clear();connectedHqNode=null;discoveryIndexRoads=0;discoveryIndexUpdates=0;discoveryIndexRebuilds=0;discoveryIndexLastMs=0;poiRoadsIndex.clear();nearestHarbourRoads.clear();harbourAccessCandidates.clear();poiTargetsSignature='';poiIndexedRoads=0;pendingLoadedExplored.clear();passengerIndexedRoads.clear();passengerEligibleStops.clear();passengerSpatialStops.clear();taxiOnlyRoadIds.clear();passengerLastSelectedDepot=null;passengerIndexRebuilds=0;passengerIndexAdded=0;
   graph={nodes:new Map(),edges:new Map(),nodeKeys:[]};seenRoadIds.clear();activeRevision=msg.revision;
   // iOS runs exploration in this existing worker to avoid two more
   // 200k+ segment graph clones and Safari memory-pressure reloads.
   if(msg.plannerPoolEnabled!==false)startPlanningPool(activeRevision);
   else stopPlanningPool();
   self.postMessage({type:'ready',revision:activeRevision});return;
  }
  if(!graph||msg.revision!==activeRevision)return;
  if(msg.type==='addRoads'){
   for(const road of msg.roads){
    if(road.coordinates?.length!==2||!Number.isFinite(road.length)||road.length<=0||seenRoadIds.has(road.id))continue;
    seenRoadIds.add(road.id);
    allRoads.add(road.id);
    if(road.taxiOnly)taxiOnlyRoadIds.add(road.id);
    if(indexedExplored.has(road.id))rememberDiscoveredRole(road.highway);
    const role=road.taxiOnly?null:roadRole(road.highway??'');
    if(role){let ids=byClass.get(role);if(!ids){ids=new Set();byClass.set(role,ids);}ids.add(road.id);classifiedRoads.add(road.id);}
    const a=String(road.a),b=String(road.b);
    roadEndpoints.set(road.id,[a,b]);roadInsertionOrder.push(road.id);
    indexRegionalRoad(road.id,road.coordinates[0],road.coordinates[1]);
    if(indexedExplored.has(road.id)){pendingLoadedExplored.add(a);pendingLoadedExplored.add(b);}
    if(!graph.nodes.has(a)){graph.nodes.set(a,road.coordinates[0]);graph.nodeKeys.push(a);}
    if(!graph.nodes.has(b)){graph.nodes.set(b,road.coordinates[1]);graph.nodeKeys.push(b);}
    if(passengerIndexedRoads.has(road.id)&&!road.taxiOnly){
     registerPassengerStop(a);registerPassengerStop(b);
    }
    const add=(from:string,to:string)=>{
     let list=graph!.edges.get(from);
     if(!list){list=[];graph!.edges.set(from,list);}
     list.push({to,meters:road.length,id:road.id,speedKph:road.speed,highway:road.highway,layer:road.layer,bridge:road.bridge,tunnel:road.tunnel,level:road.level,taxiOnly:road.taxiOnly});
    };
    if(road.oneway!==-1)add(a,b);
    if(road.oneway!==1)add(b,a);
   }
   roadClassCache.clear();
   // New road tiles may unlock formerly unreachable areas. Existing proof
   // is invalidated by the road count check without a fleet-wide rescan.
   // Ordered posts guarantee each planner receives the same incremental road
   // graph before its subsequent route request.
   for(const slot of planningPool)slot.worker.postMessage({type:'addRoads',revision:activeRevision,roads:msg.roads});
   self.postMessage({type:'roadsAdded',revision:activeRevision,roadCount:seenRoadIds.size});return;
  }
  if(msg.type==='operationalRoute'){
   const started=performance.now();
   const from=nearest(graph,msg.from);
   // Find the actual nearest reachable stop on the directed road network.
   // Return the exact chosen POI: the caller must never guess which hotel
   // corresponds to the final road node.
   const valid=msg.targets.map(target=>{
    const node=nearest(graph!,target);
    const entrance=node?graph!.nodes.get(node):undefined;
    const offsetMeters=entrance?meters(entrance,target):Infinity;
    return {node,offsetMeters};
   }).map(({node,offsetMeters})=>({
    node:node??'',offsetMeters:offsetMeters<=(msg.purpose==='shift'?180:500)
     ?offsetMeters:Infinity
   }));
   const planned=from?routeToNearestTarget(graph,from,
    valid.filter(t=>Number.isFinite(t.offsetMeters)), '',50000,undefined,msg.allowTaxiOnly===true):null;
   // The search's targetIndex indexes the filtered list. Map it back to
   // the original request before returning the selected POI.
   const validIndices=valid.flatMap((t,i)=>Number.isFinite(t.offsetMeters)?[i]:[]);
   const targetIndex=planned?validIndices[planned.targetIndex]:-1;
   const target=targetIndex>=0?msg.targets[targetIndex]:null;
   self.postMessage({type:'operationalRouteResult',revision:activeRevision,
    requestId:msg.requestId,vehicleId:msg.vehicleId,purpose:msg.purpose,
    targetIndex,target,path:planned?.path??null,edgeIds:planned?.edgeIds??null,
    durationMs:performance.now()-started});
   return;
  }
  if(msg.type==='fuelPlan'){
   const started=performance.now();
   const from=nearest(graph,msg.from);
   const nearestMs=performance.now()-started;
   const targets=msg.targets.map(target=>{
    const node=nearest(graph!,target.point);
    return{node,offsetMeters:node&&graph!.nodes.has(node)?meters(graph!.nodes.get(node)!,target.point):Infinity};
   });
   const result=from?routeToNearestTarget(graph,from,targets,'',150000,undefined,msg.allowTaxiOnly===true):null;
   const best=result?{
    ...msg.targets[result.targetIndex],
    roadKm:result.totalMeters/1000,
    path:{path:result.path,edgeIds:result.edgeIds}
   }:null;
   self.postMessage({type:'fuelPlanResult',revision:activeRevision,requestId:msg.requestId,vehicleId:msg.vehicleId,position:msg.from,target:best,durationMs:performance.now()-started,perf:{nearestMs,targets:msg.targets.length}});return;
  }
  if(msg.type==='routeRequest'){
   const started=performance.now();
   const from=nearest(graph,msg.from),to=nearest(graph,msg.to);
   let planned:{path:Point[];edgeIds:string[]}|null=null;
   let reason='no-directed-path';
   let originNode=from;
   let targetNode=to;
   if(msg.activeRoad){
    const {edgeId,start,end}=msg.activeRoad;
    const nodes=roadEndpoints.get(edgeId);
    if(!nodes){
     reason='active-edge-unloaded';
    }else{
     const [a,b]=nodes;
     const aPoint=graph.nodes.get(a),bPoint=graph.nodes.get(b);
     const forward=!!aPoint&&!!bPoint&&meters(aPoint,start)<3&&meters(bPoint,end)<3;
     const reverse=!!aPoint&&!!bPoint&&meters(bPoint,start)<3&&meters(aPoint,end)<3;
     if(!forward&&!reverse){
      reason='active-edge-endpoints-mismatch';
     }else{
      const roadAnchor={
       edgeId,fromNode:forward?a:b,toNode:forward?b:a,position:msg.from,
      };
      const candidates=nearbyRoadNodes(graph,msg.to,35,8);
      if(!candidates.length&&to)candidates.push(to);
      // A nearby node on a different road level may be closer in 2D but
      // unreachable. Choose a real directed path to a nearby node, not a
      // new connection between vertically overlapping street segments.
      let bestLength=Infinity;
      reason='no-directed-path';
      for(const candidate of candidates){
       const anchored=routeFromDirectedRoad(graph,roadAnchor,candidate,
        msg.discoveredOnly?indexedExplored:undefined);
       if(anchored.reason==='ok'&&anchored.path&&anchored.edgeIds){
        const length=anchored.path.slice(1).reduce((sum,p,i)=>sum+meters(p,anchored.path![i]),0);
        if(length<bestLength){
         bestLength=length;
         planned={path:anchored.path,edgeIds:anchored.edgeIds};
         reason='ok';
         targetNode=candidate;
        }
       }else if(!planned&&reason==='no-directed-path')reason=anchored.reason;
       // Structural anchor errors cannot be solved by trying another target.
       if(anchored.reason==='active-edge-missing'||
          anchored.reason==='active-edge-not-directed'||
          anchored.reason==='position-off-edge')break;
      }
      if(!candidates.length)reason='target-unloaded';
      originNode=forward?a:b;
     }
    }
   }else if(from&&to){
    // Legacy route callers are supported; the taxi recovery caller always
    // supplies an exact active segment to avoid accidental level changes.
    const conventional=msg.discoveredOnly
     ?routeDiscovered(graph,from,to,indexedExplored,'',msg.allowTaxiOnly===true)
     :route(graph,from,to,'',msg.allowTaxiOnly===true);
    if(conventional){planned=conventional;reason='ok';}
   }else reason=from?'target-unloaded':'origin-unloaded';
   const originPoint=originNode?graph.nodes.get(originNode):undefined;
   const targetPoint=targetNode?graph.nodes.get(targetNode):undefined;
   self.postMessage({type:'routeResult',revision:activeRevision,requestId:msg.requestId,
    from:msg.from,to:msg.to,path:planned?.path??null,edgeIds:planned?.edgeIds??null,
    reason,originNode,targetNode,originOffsetMeters:originPoint?Math.round(meters(originPoint,msg.from)):null,
    targetOffsetMeters:targetPoint?Math.round(meters(targetPoint,msg.to)):null,
    durationMs:performance.now()-started});
   return;
  }
  // On slow/mobile browsers, a planner may hang during a nationwide graph
  // search or never finish loading its road clone. Fall back to the previous
  // worker-local dispatcher instead of leaving five explorers idle forever.
  if(planningPool.length===2){
   const stalled=[...planningRequests.values()].some(r=>performance.now()-r.at>20000);
   const neverReady=performance.now()-plannerPoolStartedAt>25000&&
    planningPool.some(slot=>!slot.ready||slot.roads===0);
   if(stalled||neverReady){
    for(const request of planningRequests.values())
     explorerPlanSkipReason.set(request.id,stalled?'pool-search-timeout':'pool-not-ready');
    stopPlanningPool();
   }
  }
  const dispatchStarted=performance.now();
  const {now,hq}=msg;
  setTrafficGameTime(msg.gameNow??now);
  setTrafficIncidents(msg.trafficIncidents??[]);
  const explored=new Set(msg.discovered);
  // Resting explorers remain parked until the main simulation releases them.
  const taxis=msg.taxis.map(t=>{
   if(t.ferryTrip)return t; // Main thread owns paid ferry travel.
   // Preserve legitimate saved RETURNING journeys after a browser refresh.
   // pauseAtHome is set for active hotel, parking and depot journeys, not
   // only legacy automatic returns. A route with remaining directed legs
   // must never be erased just because dispatch worker state was recreated.
   if(isObsoleteExplorerReturn(t,now)){
    obsoleteReturnRecoveries++;
    return {...t,status:'IDLE' as const,shiftParked:false,pauseAtHome:false,
     path:[],edgeIds:[],discoveryEdgeIds:[],leg:0,distanceIntoLeg:0,speedKph:0,journeyEdges:[]};
   }
   if(t.kind==='explorer'&&!t.ferryTrip&&t.status==='PAUSED'&&!t.shiftParked&&
      !(t.deliveryUntil&&t.deliveryUntil>now)&&!t.serviceDestination&&
      !t.refillDestination&&!t.recoveryPending&&!t.refillRequested&&energyPercent(t)>10)
    return {...t,status:'IDLE' as const,shiftParked:false,pauseAtHome:false,
     restStopId:undefined,path:[],edgeIds:[],leg:0,distanceIntoLeg:0,speedKph:0};
   return t;
  });

  for(const t of taxis){
    if(t.status==='IDLE'){if(!idleSince.has(t.id))idleSince.set(t.id,now);}else idleSince.delete(t.id);
    if(!t.kind||t.kind==='taxi'){
     const previous=passengerCompletedByTaxi.get(t.id);
     if(previous!==undefined&&t.completed>previous)passengerTripsCompleted+=t.completed-previous;
     passengerCompletedByTaxi.set(t.id,t.completed);
    }
   }
  const activeGraph=graph;
  // Validate restored routes on the streamed, directed graph. Missing
  // tiles must never erase the paid/saved explorer mission.
  const routeHealth=new Map<string,ExplorerRouteHealth>();
  for(let i=0;i<taxis.length;i++){
   const vehicle=taxis[i];
   if(vehicle.kind!=='explorer'||vehicle.status!=='EXPLORING'){
    explorerProgressWatch.delete(vehicle.id);
    if(vehicle.status!=='IDLE')explorerExhaustionProof.delete(vehicle.id);
    continue;
   }
   explorerExhaustionProof.delete(vehicle.id);
   const health=evaluateExplorerRoute(activeGraph,vehicle,seenRoadIds,
    roadEndpoints,explored);
   routeHealth.set(vehicle.id,health);
   if(health.state==='waiting-for-tiles'){
    loadedMissionPreservations++;
    explorerProgressWatch.delete(vehicle.id);
    explorerRecoveryReason.set(vehicle.id,'waiting-for-road-tiles:'+health.edgeId);
    continue;
   }
   if(health.state==='invalid'){
    // A future invalid segment is not evidence that the vehicle's current
    // directed leg is broken. Finish a verified prefix only when it ends on
    // an actual discovered-road junction; replan there without teleporting.
    const prefix=safeExplorerRoutePrefix(activeGraph,vehicle,health,roadEndpoints,explored);
    if(prefix){
     taxis[i]={...vehicle,...prefix};
     // The explorer stays on its valid prefix; the next planning cycle
     // handles the remaining frontier after it reaches the purple junction.
     explorerRecoveryReason.delete(vehicle.id);
     explorerProgressWatch.delete(vehicle.id);
     continue;
    }
    // Never drive an invalid saved direction or jump to a nearby level.
    taxis[i]={...vehicle,status:'IDLE',routeInvalid:true,
     path:[],edgeIds:[],discoveryEdgeIds:[],escapeTransitEdgeIds:[],
     leg:0,distanceIntoLeg:0,speedKph:0,journeyEdges:[]};
    explorerProgressWatch.delete(vehicle.id);
    explorerRecoveryReason.set(vehicle.id,'invalid-saved-route:'+health.reason+
     (health.edgeId?':road='+health.edgeId:'')+
     (health.leg!==undefined?':leg='+health.leg:''));
    invalidMissionRecoveries++;
    rejectExplorerCandidate(vehicle.id,health.edgeId);
    recordExplorerRecoveryEvent(vehicle.id,'invalid-route','Saved route rejected; checking a legal alternative');
    continue;
   }
   if(explorerRecoveryReason.get(vehicle.id)?.startsWith('invalid-saved-route:')||
      explorerRecoveryReason.get(vehicle.id)?.startsWith('waiting-for-road-tiles:'))
    explorerRecoveryReason.delete(vehicle.id);
   if(!msg.allowScout||!explorerMovementEligible(vehicle,now,energyPercent(vehicle))){
    explorerProgressWatch.delete(vehicle.id);
    continue;
   }
   const sample=watchExplorerProgress(explorerProgressWatch.get(vehicle.id),
    vehicle,now);
   explorerProgressWatch.set(vehicle.id,sample.watch);
   if(sample.stalledMs<90000){
    if(sample.stalledMs===0)explorerRecoveryReason.delete(vehicle.id);
    continue;
   }
   const start=purpleStartNear(vehicle.position,explored);
   const node=start?activeGraph.nodes.get(start.node):undefined;
   if(!node||meters(node,vehicle.position)>3){
    // Never restart midway through a one-way or undiscovered segment.
    explorerRecoveryReason.set(vehicle.id,'stalled-awaiting-legal-purple-junction');
    continue;
   }
   const attempt=canRetryStalledExplorer(explorerRecoveryAttempts.get(vehicle.id),now);
   if(!attempt.allowed){
    explorerRecoveryReason.set(vehicle.id,'stalled-replan-cooldown');
    continue;
   }
   explorerRecoveryAttempts.set(vehicle.id,attempt.next);
   explorerProgressWatch.delete(vehicle.id);
   // Explicit invalidation is required for App.tsx to accept this
   // intentional safe replan instead of preserving the old moving route.
   taxis[i]={...vehicle,status:'IDLE',routeInvalid:true,
    path:[],edgeIds:[],discoveryEdgeIds:[],escapeTransitEdgeIds:[],
    leg:0,distanceIntoLeg:0,speedKph:0,journeyEdges:[]};
   explorerRecoveryReason.set(vehicle.id,'stalled-replanning-from-purple-junction');
   stalledExplorerReplans++;
   recordExplorerRecoveryEvent(vehicle.id,'stalled-replan','Stalled explorer restarted from a connected road junction');
  }
  // Purple Explorer's driven roads are valid for taxi jobs regardless of Black Explorer territory.
  const validDiscovered=explored;
  const eligibleStops=passengerStopsFor(validDiscovered);
  const queue=msg.queue.filter(m=>m.expiresAt>now&&eligibleStops.has(nearest(activeGraph,m.pickup))&&eligibleStops.has(nearest(activeGraph,m.dropoff)));
  let generatedMission=false;
  const passengerTaxis=taxis.filter(t=>(!t.kind||t.kind==='taxi'));
  const demand=demandAt(msg.gameNow??now,passengerTaxis.length);
  const availableIds=new Set(msg.availableTaxiIds??passengerTaxis.filter(t=>t.status==='IDLE').map(t=>t.id));
  // Depots are headquarters, deliveries, maintenance and vehicle storage,
  // not passenger-demand magnets. Markets follow discovered roads and taxis.
  // Count available taxis by their actual location, regardless of where
  // they were delivered or which depot is their registered home.
  const roamingRegions=new Map<string,PassengerDepotRegion>();
  for(const taxi of passengerTaxis){
   if(taxi.status!=='IDLE'||!availableIds.has(taxi.id)||taxi.shiftParked||
    taxi.restStopId||taxi.deliveryUntil||taxi.refillRequested||
    energyPercent(taxi)<=10)continue;
   // Headquarters proximity does not influence the passenger market.
   // No new depot is created. Roaming demand follows the real taxi
   // position after drop-off, grouped into a few geographic regions.
   const zone='roaming:'+Math.floor(taxi.position[0]*10)+':'+
    Math.floor(taxi.position[1]*10);
   const active=roamingRegions.get(zone);
   if(active)active.available++;
   else roamingRegions.set(zone,{id:zone,position:taxi.position,available:1});
  }
  // A taxi heading toward a newly discovered service region may have an
  // advance customer request there, even before arriving. No phantom
  // depot is created and an unconnected road never becomes a pickup route.
  const inboundCoverage=new Map<string,PassengerDepotRegion>();
  for(const taxi of passengerTaxis){
   if(taxi.status!=='REPOSITIONING'||!taxi.coverageRegionId||
     !taxi.repositionTarget||(msg.driverDutyRemainingSeconds?.[taxi.id]??0)<=0)continue;
   inboundCoverage.set(taxi.coverageRegionId,{id:taxi.coverageRegionId,
    position:taxi.repositionTarget,available:1});
  }
  // Seed independent discovered-road passenger markets even where no taxi
  // is currently operating. This breaks the old depot/roaming demand loop.
  // Only one remote cell is offered per generation tick, and the index
  // samples a bounded number of cells; no new road graph or depot is made.
  const potentialMarkets=passengerSpatialStops.coverageRegions(
   hq,node=>activeGraph.nodes.get(node),0,120000,32);
  const remoteMarkets=potentialMarkets.filter(region=>
   ![...roamingRegions.values(),...inboundCoverage.values()].some(r=>
    meters(r.position,region.position)<3500));
  const rotatingMarket=remoteMarkets.length?
   remoteMarkets[passengerGenerationAttempts%remoteMarkets.length]:null;
  const regionalOrigins:PassengerDepotRegion[]=rotatingMarket?[{
   id:rotatingMarket.id,position:rotatingMarket.position,available:1,
  }]:[];
  const regionStates=regionalPassengerDemand(
   [...roamingRegions.values(),...inboundCoverage.values(),...regionalOrigins],
   queue,passengerLastSelectedDepot);
  const passengerLocalStops=new Map<string,number>();
  if(msg.allowMission&&queue.length<demand.queueLimit){
   for(const [pair,created] of recentPassengerPairs)
    if(now-created>PASSENGER_PAIR_COOLDOWN_MS)recentPassengerPairs.delete(pair);
   const exclude=new Set(recentPassengerPairs.keys());
   for(const pending of queue){
    exclude.add(passengerPairKey(pending.pickup,pending.dropoff));
    exclude.add(passengerPairKey(pending.dropoff,pending.pickup));
   }
   // Give every staffed depot local demand. The pool is restricted to actual
   // discovered OSM road nodes within 5.2 km of each region, so two islands
   // do not require a fictional road back to headquarters.
   for(const region of regionStates){
    if(region.waiting>=region.maxWaiting)continue;
    const localKeys=passengerSpatialStops.near(region.position,
     node=>activeGraph.nodes.get(node),5200,1600);
    passengerLocalStops.set(region.id,localKeys.length);
    if(localKeys.length<2)continue;
    // Try the intended 75/20/5 journey mix. Intercity destinations
    // are sampled from distant already-discovered nodes across Greece.
    // Bounded A* checks prove the *actual* directed connection, not a
    // straight-line connection or a ferry shortcut.
    const band=passengerTripTypeForAttempt(passengerGenerationAttempts++);
    let request=band==='local'?null:createLongPassengerRequest(
     activeGraph,validDiscovered,localKeys,
     (origin,min,max,limit)=>passengerSpatialStops.distant(
      origin,node=>activeGraph.nodes.get(node),min,max,limit),
     band,now,demand.fareMultiplier,exclude,
     planningPool.length===2?2:1);
    if(band!=='local')longTripRouteChecks++;
    // In a newly explored or island-only region, far destinations might
    // not yet exist. Fall back to local fares rather than fabricating
    // connections or permanently starving the passenger queue.
    if(!request)request=createPassengerRequest(activeGraph,validDiscovered,hq,now,
     demand.fareMultiplier,new Set(localKeys),exclude);
    if(!request)continue;
    const profile=passengerProfileFor(request,msg.gameNow??now);
    request={...request,passengerType:profile.passengerType,partySize:profile.partySize,
     luggageCount:profile.luggageCount,minimumClass:profile.minimumClass,
     fareMultiplier:Math.min(1.5,(request.fareMultiplier??1)*profile.fareBonus),
     fare:Math.round(request.fare*profile.fareBonus*100)/100};
    if(request.tripType==='regional')regionalTripsCreated++;
    else if(request.tripType==='intercity')intercityTripsCreated++;
    request.originDepotId=region.id;
    if(region.id.startsWith('coverage:')){
     // Longer-lived genuine waiting customer; no artificial fare is paid
     // for the drive toward this discovered-road market.
     request.expiresAt=Math.max(request.expiresAt,now+10*60000);
     coverageWaitingJobs++;
    }
    for(const pair of [passengerPairKey(request.pickup,request.dropoff),
     passengerPairKey(request.dropoff,request.pickup)])recentPassengerPairs.set(pair,now);
    queue.push(request);generatedMission=true;passengerRequestsCreated++;
    passengerLastSelectedDepot=region.id;
    break;
   }
   if(!generatedMission)passengerRequestsRejected++;
  }
  const preparationMs=performance.now()-dispatchStarted;
  const passengerStarted=performance.now();
  // Prioritise older waiting passengers. Within each booking select a legal
  // available taxi by player strategy. Speed and traffic calculations are
  // unchanged for local, regional and intercity journeys.
  const taxiMode=isTaxiDispatchMode(msg.taxiDispatchMode)?
   msg.taxiDispatchMode:'max-profit';
  queue.sort((a,b)=>a.createdAt-b.createdAt);
  const pending:PassengerRequest[]=[];
  for(const mission of queue){
   let best:{index:number;taxi:Taxi;etaSeconds:number;score:number;contribution:number|null}|null=null;
   for(let index=0;index<taxis.length;index++){
    const taxi=taxis[index];
    if(!msg.allowTaxiShift||(msg.availableTaxiIds&&!msg.availableTaxiIds.includes(taxi.id))||(taxi.kind&&taxi.kind!=='taxi')||taxi.status!=='IDLE'||taxi.deliveryUntil||taxi.refillRequested||energyPercent(taxi)<=10||!passengerCompatible(taxi,mission))continue;
    const assigned=assignPassenger(taxi,activeGraph,mission,validDiscovered,eligibleStops);
    if(!assigned){passengerRouteFailures++;continue;}
    // The job must fit the real fuel/charge range, including empty
    // approach and 15% reserve. A current on-duty roster is still
    // required via availableTaxiIds; accepted fares are never cut short
    // when a driver's scheduled shift ends.
    const approachMetres=passengerRouteMetres(assigned.path);
    if(mission.tripDistanceMeters!==undefined&&
       !sufficientPassengerRange(energyRangeKm(taxi),approachMetres,
        mission.tripDistanceMeters))continue;
    let etaSeconds=0;
    for(let j=0;j<assigned.edgeIds.length;j++){
     const from=nearest(activeGraph,assigned.path[j]);
     const to=nearest(activeGraph,assigned.path[j+1]);
     const edge=activeGraph.edges.get(from)?.find(e=>e.to===to&&e.id===assigned.edgeIds[j]);
     const distance=edge?.meters??meters(assigned.path[j],assigned.path[j+1]);
     etaSeconds+=trafficTravelSeconds(distance,edge?.speedKph??50,msg.gameNow??now,assigned.path[j],edge?.id);
    }
    // Include the existing acceleration allowance; do not change motion
    // physics or travel speed for different trip categories.
    etaSeconds+=Math.min(12,assigned.edgeIds.length*0.5+4);
    const estimate=estimateTaxiJob(taxi,mission,approachMetres,etaSeconds);
    if(!taxiJobAcceptable(taxiMode,estimate)){
     taxiUnprofitableSkips++;continue;
    }
    const preference=normalDriverTripPreference(msg.driverTripPreferences?.[taxi.id]);
    const score=taxiDispatchScore(taxiMode,etaSeconds,estimate)+
     driverTripMatchBonus(taxiMode,preference,mission.tripType);
    if(!best||score>best.score||
       score===best.score&&etaSeconds<best.etaSeconds)
     best={index,taxi:assigned,etaSeconds,score,
      contribution:estimate?.contribution??null};
   }
   if(best){
    if(driverTripMatchBonus(taxiMode,
      normalDriverTripPreference(msg.driverTripPreferences?.[best.taxi.id]),
      mission.tripType)>0)driverPreferenceAssignments++;
    taxis[best.index]=best.taxi;passengerAssignments++;
    if(best.contribution!==null){
     taxiProfitableAssignments++;
     taxiEstimatedContribution+=best.contribution;
    }
    idleSince.delete(best.taxi.id);
   }
   else pending.push(mission);
  }
  queue.length=0;queue.push(...pending);
  // Phase 2: idle-only empty repositioning after EVERY waiting passenger had
  // first chance at an on-duty vehicle. This is intentionally separate from
  // passenger requests: no fake fare, no free teleport and no speed modifier.
  // At most one taxi starts moving per 25 seconds, with at most two extra
  // bounded real discovered-road routing searches per dispatch.
  if(msg.allowTaxiShift&&now-lastTaxiRepositionAt>=TAXI_REPOSITION_GLOBAL_INTERVAL_MS&&
     activeGraph.nodeKeys.length&&eligibleStops.size>1){
   const available=taxis.filter(t=>taxiCanStartRepositioning(t,now,
    availableIds.has(t.id),idleSince.get(t.id)??now)&&
    now-(taxiRepositionRetryAt.get(t.id)??-Infinity)>=60000)
    .sort((a,b)=>(idleSince.get(a.id)??now)-(idleSince.get(b.id)??now));
   const vehicle=available[0];
   if(vehicle){
    taxiRepositionAttempts++;
    // Throttle failed hotspot routing too: never rescan each Safari tick.
    lastTaxiRepositionAt=now;
    taxiRepositionRetryAt.set(vehicle.id,now);
    let startedCoverage=false;
    // Prefer willing regional/intercity drivers for the initial geographic
    // expansion, but always allow Flexible (or Local) drivers if necessary.
    // The actual road, shift and tank checks below are non-negotiable.
    const longDriver=[...available].sort((a,b)=>
     driverCoveragePriority(normalDriverTripPreference(
      msg.driverTripPreferences?.[b.id]))-
     driverCoveragePriority(normalDriverTripPreference(
      msg.driverTripPreferences?.[a.id]))||
     (idleSince.get(a.id)??now)-(idleSince.get(b.id)??now))[0];
    if(longDriver){
     const start=nearest(activeGraph,longDriver.position);
     const anchor=activeGraph.nodes.get(start);
     if(anchor&&eligibleStops.has(start)&&
      meters(anchor,longDriver.position)<=8&&
      (msg.driverDutyRemainingSeconds?.[longDriver.id]??0)>=5400){
      // Coarse discovered zones exist independently of any depot or taxi.
      // The region samples are tiny; full graph routing is limited to two
      // candidates and occurs only under the global 25-second throttle.
      const lookup=(id:string)=>activeGraph.nodes.get(id);
      const regionalCandidates=rankUnservedCoverage(
       passengerSpatialStops.coverageRegions(
        longDriver.position,lookup,6500,65000,32),
       longDriver,taxis,24).sort((a,b)=>{
        const expected=(r:typeof a)=>queue.filter(q=>
         meters(q.pickup,r.position)<3500).reduce((sum,q)=>
         sum+Math.max(0,q.fare-(q.tripDistanceMeters??0)/1000*.2),0);
        // Confirmed waiting passenger value beats road-density potential.
        // Distance remains an empty-driving cost even with waiting fares.
        return (expected(b)-meters(longDriver.position,b.position)/1000*2)-
         (expected(a)-meters(longDriver.position,a.position)/1000*2);
       });
      if(regionalCandidates.length)coverageAttempts++;
      let routeAttempts=0;
      for(const region of regionalCandidates){
       if(routeAttempts>=2)break;
       const cacheKey=start+'|'+region.id;
       if(now-(coverageFailedAt.get(cacheKey)??-Infinity)<3*60000)continue;
       routeAttempts++;
       const candidate=routeDiscovered(activeGraph,start,region.node,
        validDiscovered,'',false,COVERAGE_MAX_ROUTE_VISITS);
       if(!candidate||candidate.edgeIds.length===0){
        coverageRoadFailures++;coverageFailedAt.set(cacheKey,now);continue;
       }
       const distance=passengerRouteMetres(candidate.path);
       if(!taxiCanCoverRegion(longDriver,distance)||
        !taxiHasDutyForCoverage(candidate.length,
         msg.driverDutyRemainingSeconds?.[longDriver.id]??0)){
        coverageFailedAt.set(cacheKey,now);continue;
       }
       const index=taxis.findIndex(t=>t.id===longDriver.id);
       if(index<0)break;
       taxis[index]={...longDriver,status:'REPOSITIONING',
        path:candidate.path,edgeIds:candidate.edgeIds,leg:0,
        distanceIntoLeg:0,speedKph:0,journeyEdges:[],
        pickup:undefined,dropoff:undefined,fare:0,
        coverageRegionId:region.id,repositionTarget:region.position,
        lastRepositionAt:now};
       idleSince.delete(longDriver.id);
       taxiRepositionRetryAt.set(longDriver.id,now);
       taxiRepositionSuccesses++;coverageStarts++;
       startedCoverage=true;break;
      }
      // Cap the short-lived negative route cache regardless of how much
      // of Greece has been discovered on an older phone.
      if(coverageFailedAt.size>120){
       for(const [key,at] of coverageFailedAt){
        if(now-at>3*60000)coverageFailedAt.delete(key);
       }
       while(coverageFailedAt.size>120)
        coverageFailedAt.delete(coverageFailedAt.keys().next().value!);
      }
     }
    }
    if(!startedCoverage){
    const from=nearest(activeGraph,vehicle.position);
    const fromPoint=activeGraph.nodes.get(from);
    // No nearest-node snap across bridges or from a mid-road position.
    if(fromPoint&&meters(vehicle.position,fromPoint)<=8&&eligibleStops.has(from)){
     const lookup=(node:string)=>activeGraph.nodes.get(node);
     const demandAtPoint=(point:Point)=>({
      localStops:passengerSpatialStops.countNear(point,lookup,2000,120),
      pendingPickups:queue.filter(q=>meters(point,q.pickup)<=2200).length,
      competingIdleTaxis:taxis.filter(t=>t.id!==vehicle.id&&
       (!t.kind||t.kind==='taxi')&&t.status==='IDLE'&&
       availableIds.has(t.id)&&meters(t.position,point)<=2500).length,
     });
     const baseline=demandAtPoint(vehicle.position);
     const waitTargets=queue.filter(q=>
      meters(vehicle.position,q.pickup)>=TAXI_REPOSITION_MIN_METRES&&
      meters(vehicle.position,q.pickup)<=TAXI_REPOSITION_MAX_METRES*1.2)
      .map(q=>nearest(activeGraph,q.pickup)).filter(k=>eligibleStops.has(k));
     const otherTargets=passengerSpatialStops.distant(vehicle.position,lookup,
      TAXI_REPOSITION_MIN_METRES,TAXI_REPOSITION_MAX_METRES*1.2,12);
     const ranked=[...new Set([...waitTargets.slice(0,6),...otherTargets])].slice(0,18)
      .map(node=>{
       const point=lookup(node);
       if(!point)return null;
       const straight=meters(vehicle.position,point);
       const signal=demandAtPoint(point);
       if(!taxiRepositionWorthwhile(baseline,signal,straight))return null;
       return {node,point,advantage:taxiDemandScore(signal)-taxiDemandScore(baseline)-
        straight/1000*1.4};
      }).filter((x):x is {node:string;point:Point;advantage:number}=>!!x)
      .sort((a,b)=>b.advantage-a.advantage).slice(0,3);
     let routesTried=0;
     for(const target of ranked){
      if(routesTried++>=2)break;
      // A map coordinate alone is not connectivity evidence. Reuse the
      // existing directed road-only routing and never board a ferry.
      const route=routeDiscovered(activeGraph,from,target.node,
       validDiscovered,'',false,12000);
      if(!route||route.edgeIds.length===0){
       taxiRepositionRouteFailures++;continue;
      }
      const distance=passengerRouteMetres(route.path);
      if(!taxiCanCompleteRepositioning(vehicle,distance))continue;
      const index=taxis.findIndex(t=>t.id===vehicle.id);
      if(index<0)break;
      taxis[index]={...vehicle,status:'REPOSITIONING',
       path:route.path,edgeIds:route.edgeIds,leg:0,distanceIntoLeg:0,
       speedKph:0,journeyEdges:[],pickup:undefined,dropoff:undefined,
       fare:0,repositionTarget:target.point,lastRepositionAt:now};
      idleSince.delete(vehicle.id);
      taxiRepositionSuccesses++;
      lastTaxiRepositionAt=now;
      break;
     }
    }
    }
   }
  }
  const passengerMs=performance.now()-passengerStarted;
  const scoutStarted=performance.now();
  let successorPlansThisDispatch=0;
  // Passenger assignments run first. Purple Explorers continuously select nearby eligible roads.
  let assignedCount=0;
  const scoutTimings:{vehicleId:string;role:string;ms:number;phase:string;result?:string}[]=[];
  let extensionSkipped=0;
  let idleSkipped=0;
  let idleMissionPlans=0;
  let orderedExplorerIndices:number[]=[];
  let planningCalls=0;
  // Plan successors and idle explorers in every cycle, with a bounded shared budget.
  // At most one moving scout extends, while three idle scouts can start missions.
  const planningBudget=4;
  const planningPhase='continuous';
   const discoveryRoads=(taxi:Taxi)=>{
    const role=taxi.explorerRole;
    // The existing classified-road index already holds every legal
    // drivable type (and excludes taxi-only roads); avoid an extra
    // nationwide Set allocation on memory-constrained iPhone Safari.
    if(role==='balanced'||!role)return classifiedRoads;
    if(role==='poi')return byClass.get('service')??new Set<string>();
    if(role==='completion')return completionRoadsIndex;
    // This index defines the specialist's PREFERRED class. The planner
    // falls back to all classified drivable roads when necessary.
    if(role==='highway'||role==='urban'||role==='primary'||role==='secondary'||role==='residential'){
     const cached=roadClassCache.get(role);if(cached)return cached;
     const roles=role==='highway'?['motorway','trunk']:
      role==='primary'?['primary']:
      role==='secondary'?['secondary','tertiary']:
      role==='residential'?['residential','rural']:
      ['tertiary','residential','rural','service'];
     const combined=new Set<string>();
     for(const key of roles)for(const id of byClass.get(key)??[])combined.add(id);
     roadClassCache.set(role,combined);return combined;
    }
    return byClass.get(role??'')??new Set<string>();
   };
  // A legacy saved explorer may remain auto-parked after it exhausted all
  // roads. Check one such vehicle per dispatch in the EXISTING worker, never
  // cloning Greece's OSM graph or waking an active scheduled rest. Proof is
  // only given when every allowed class has been conclusively searched.
  if(msg.allowScout){
   const reservations=reserveExplorerDiscoveries(taxis,explored,
    point=>nearest(activeGraph,point));
   let probes=0;
   for(const vehicle of taxis){
    if(probes>=1)break;
    if(!explorerWaitingForRoads(vehicle)||
     (vehicle.deliveryUntil&&vehicle.deliveryUntil>now)||
     energyPercent(vehicle)<=15)continue;
    const last=parkedProofChecks.get(vehicle.id)??0;
    if(now-last<60000)continue;
    const origin=purpleStartNear(vehicle.position,explored);
    if(!origin)continue;
    if(explorerFerryEligible(vehicle,explorerExhaustionProof.get(vehicle.id),
     now,energyPercent(vehicle),origin.node,seenRoadIds.size,explored.size))continue;
    parkedProofChecks.set(vehicle.id,now);probes++;parkedExhaustionChecks++;
    const result=planSpecialistMission(activeGraph,origin.node,explored,
     vehicle.explorerRole,tier=>discoveryRoads({...vehicle,explorerRole:tier}),
     reservations.edges,reservations.targets,{fallbackAllowed:true,maxVisits:14000});
    if(result.state!=='exhausted'){
     explorerRecoveryReason.set(vehicle.id,
      'parked-frontier-'+result.state+':'+result.reason);
     continue;
    }
    const component=inspectExplorerComponent(activeGraph,origin.node,explored,
     discoveryRoads(vehicle),reservations.edges,nearest(activeGraph,hq),14000);
    if(!component.complete||component.reservedFrontiers>0){
     explorerRecoveryReason.set(vehicle.id,'parked-component-search-incomplete');
     continue;
    }
    explorerComponents.set(vehicle.id,component);
    explorerExhaustionProof.set(vehicle.id,{
     origin:origin.node,role:vehicle.explorerRole,at:now,
     roadCount:seenRoadIds.size,discoveredCount:explored.size});
    explorerRecoveryReason.set(vehicle.id,'parked-frontier-exhausted-ferry-eligible');
    recordExplorerRecoveryEvent(vehicle.id,'ferry-ready','Connected roads exhausted; ferry transfer can be considered');
   }
  }
  if(msg.allowScout&&planningPool.length!==2){
    for(let i=0;i<taxis.length;i++){
     const t=taxis[i];
     if(t.kind==='explorer'&&!t.ferryTrip&&t.status==='PAUSED'&&!t.shiftParked&&!t.deliveryUntil&&!t.refillRequested&&energyPercent(t)>10){taxis[i]={...t,status:'IDLE',path:[],edgeIds:[],leg:0,distanceIntoLeg:0,speedKph:0};pausedExplorerRecoveries++;}
    }
   // All loaded roads are eligible for independent Purple Explorer discovery.
   const allowedRoads=allRoads;
   const purpleAllowedRoads=allowedRoads;
   const hqNode=nearest(graph,hq);
   updateDiscoveryIndex(graph,explored,hqNode);
   const revealedNodes=revealedNodesIndex;
   const poiTargets=msg.poiMissions?.map(m=>m.point)??(msg.poiTargets?.length?msg.poiTargets:msg.harbourTargets??[]);
   updatePoiIndex(graph,poiTargets);
   const poiRoads=poiRoadsIndex;
   const unlockedRoles=unlockedSpecialistRoles(graph,connectedFrontierIndex,
    explored,poiRoads);
   for(const role of discoveredRoleHistory)unlockedRoles.add(role);
   // An initial purple service/parking segment must not give the motorway
   // specialist permission to cross red streets toward a distant motorway.
   for(let i=0;i<taxis.length;i++){
    const t=taxis[i];
    if(t.kind==='explorer'&&t.status==='EXPLORING'&&
       !specialistCanDepart(t,unlockedRoles)&&specialistFallbackRoles(t.explorerRole).length===0){
     taxis[i]={...t,status:'IDLE',path:[],edgeIds:[],
      discoveryEdgeIds:[],escapeTransitEdgeIds:[],journeyEdges:[],
      leg:0,distanceIntoLeg:0,speedKph:0,routeInvalid:true};
     explorerPlanSkipReason.set(t.id,'waiting-for-connected-'+(t.explorerRole??'road')+'-frontier');
    }
   }
   const frontierFor=(_taxi:Taxi):Set<string>|undefined=>undefined;

   // Only wake auto-parked explorers when eligible roads are undiscovered.
   for(let i=0;i<taxis.length;i++){
    const t=taxis[i],parked=autoParkedExplorers.get(t.id);
    if(!explorerWaitingForRoads(t))continue;
     // Older saves retain shiftParked without the worker-only autoPark map.
     // Recover only at-home explorers with no operational rest/service/refuel obligation.
     const legacyParked=!parked&&t.shiftParked;
     if(!parked&&!legacyParked)continue;
     // Only active operational obligations keep a parked explorer paused.
     // Scheduled and manually requested parking/rest are excluded above.
     if((t.deliveryUntil&&t.deliveryUntil>now)||t.refillRequested||t.serviceDestination||t.refillDestination||t.recoveryPending||energyPercent(t)<=10)continue;
     if(parked&&parked.roads===seenRoadIds.size&&parked.explored===explored.size)continue;
    let available=false;
    // Wake for ANY newly reachable road type, not just the old preferred
    // specialist class. The shared planner will verify legal connectivity.
    for(const id of classifiedRoads){if(!explored.has(id)){available=true;break;}}
    if(!available)continue;
    taxis[i]={...t,status:'IDLE',shiftParked:false,pauseAtHome:false,
     restUntilGameMs:undefined,path:[],edgeIds:[],leg:0,distanceIntoLeg:0,speedKph:0};
    autoParkedExplorers.delete(t.id);autoParkReactivations++;
   }
   // Trim any previously assigned Explorer route at the first forbidden edge.
   // Do this before reserving routes or extending them, so stale assignments
   // cannot carry a vehicle beyond the current taxi-revealed boundary.
   for(let index=0;index<taxis.length;index++){
    const taxi=taxis[index];
    if((taxi.kind!=='explorer')||taxi.status!=='EXPLORING'||
       routeHealth.get(taxi.id)?.state==='waiting-for-tiles')continue;
    const permitted=taxi.kind==='explorer'?purpleAllowedRoads:allowedRoads;
    const discoveryAssignment=new Set(taxi.discoveryEdgeIds??[]);
     const validEscapeTransit=new Set(taxi.escapeTransitEdgeIds??[]);
     const startNode=taxi.path[0]?nearest(graph,taxi.path[0]):'';
     // Saved missions from older builds may start on isolated red roads.
     // Keep only routes that start from an actual discovered junction, and
     // never transit an undiscovered edge unless this mission discovers it.
     const invalidStart=taxi.leg===0&&!!startNode&&!purpleStartNear(taxi.path[0],explored);
     const invalidRedApproach=hasInvalidRedApproach(activeGraph,taxi.path,taxi.edgeIds,
      explored,new Set(taxi.discoveryEdgeIds??[]));
     const firstForbidden=invalidStart||invalidRedApproach?taxi.leg:taxi.edgeIds.findIndex((id,i)=>i>=taxi.leg&&
      (!permitted.has(id)||(!explored.has(id)&&!discoveryAssignment.has(id)&&!validEscapeTransit.has(id))));
    if(firstForbidden<0)continue;
    if(firstForbidden<=taxi.leg){
     // A vehicle already traversing an invalid edge is held at its current
     // position rather than permitted to complete that edge.
     taxis[index]={...taxi,status:'IDLE',routeInvalid:true,path:[],edgeIds:[],leg:0,distanceIntoLeg:0,speedKph:0};
    }else{
     taxis[index]={...taxi,path:taxi.path.slice(0,firstForbidden+1),
      edgeIds:taxi.edgeIds.slice(0,firstForbidden)};
    }
   }
   // A stale/operational save can leave an explorer on a red road.
   // The old recovery compared nearest() to graph.nodes, which is always
   // true for a nonempty graph: it never recovered a stranded explorer.
   // Drive over legal directed edges back to a real purple junction.
   // This is transit only; no red road becomes purple.
   for(let index=0;index<taxis.length;index++){
    const taxi=taxis[index];
    if(taxi.kind!=='explorer'||taxi.status!=='IDLE'||taxi.deliveryUntil||
       taxi.refillRequested||taxi.serviceDestination||taxi.refillDestination||
       energyPercent(taxi)<=10)continue;
    // Being physically near a discovered edge is not the same as having a
    // directed exit from its endpoint. A saved POI/specialist can otherwise
    // remain IDLE forever at the downstream end of a one-way segment.
    // Recovery is transport only and must not require the specialist role
    // to be unlocked at this location.
    const purpleOrigin=purpleStartNear(taxi.position,explored);
    const component=explorerComponents.get(taxi.id);
    // A local exit is not enough: the explorer may be circling an isolated
    // discovered component with no directed route to the HQ network.
    const isolated=!!purpleOrigin&&!connectedFrontierIndex.has(purpleOrigin.node)&&
      !!component&&component.complete&&!component.hqReachable&&component.visited<=120;
    const hasDrivablePurpleExit=!!purpleOrigin&&
     (activeGraph.edges.get(purpleOrigin.node)??[]).some(edge=>
      edge.meters>0&&explored.has(edge.id));
    if(hasDrivablePurpleExit&&!isolated)continue;
    if(performance.now()<(strandedRecoveryRetryAt.get(taxi.id)??0))continue;
    strandedRecoveryRetryAt.set(taxi.id,performance.now()+15000);
    const gx=Math.floor(taxi.position[0]/REGION_DEGREES);
    const gy=Math.floor(taxi.position[1]/REGION_DEGREES);
    const nearby=new Set<string>();
    for(let y=gy-1;y<=gy+1;y++)for(let x=gx-1;x<=gx+1;x++)
     for(const id of regionalRoads.get(regionKey(y,x))??[])nearby.add(id);
    const mainRecovery=purpleOrigin?
     routeIsolatedExplorerToMainNetwork(activeGraph,purpleOrigin.node,
      connectedFrontierIndex,explored):null;
    const legacyRecovery=mainRecovery?null:
     !hasDrivablePurpleExit?routeStrandedExplorerToPurple(activeGraph,
      taxi.position,explored,roadEndpoints,nearby):null;
    const recovery=mainRecovery?{
     ...mainRecovery,
     path:purpleOrigin?.connector?
      [taxi.position,...mainRecovery.path]:mainRecovery.path,
     edgeIds:purpleOrigin?.connector?
      [purpleOrigin.connector.edgeId,...mainRecovery.edgeIds]:mainRecovery.edgeIds
    }:legacyRecovery;
    if(recovery){
     taxis[index]={...taxi,status:'RETURNING',path:recovery.path,
      edgeIds:recovery.edgeIds,discoveryEdgeIds:[],escapeTransitEdgeIds:[],
      // Emergency transit may cross red roads but must never reveal them,
      // including on a POI specialist's RETURNING trip.
      recoveryTransitOnly:true,
      restStopId:undefined,refillDestination:undefined,serviceDestination:undefined,
      leg:0,distanceIntoLeg:0,journeyEdges:[],routeInvalid:false};
     explorerComponents.delete(taxi.id);
     singleWorkerScanResult.set(taxi.id,
      (mainRecovery?'returning-to-hq-purple':'returning-to-purple')+
      ':edges='+recovery.edgeIds.length);
     explorerPlanSkipReason.set(taxi.id,'directed-component-recovery');
     recordExplorerRecoveryEvent(taxi.id,'directed-return','Recovery assigned along legally connected roads');
    }else{
     singleWorkerScanResult.set(taxi.id,isolated?
      'isolated-component-no-legal-hq-route':'no-directed-purple-return');
     explorerPlanSkipReason.set(taxi.id,'stranded-no-legal-directed-route');
    }
   }
   // Reserve only pending discoveries; existing purple transit may be
   // shared by every explorer. One active mission owns each red target.
   const {edges:reservedEdges,targets:reservedTargets}=
    reserveExplorerDiscoveries(taxis,explored,point=>nearest(activeGraph,point));
   // Mission lifecycle is worker-owned, independent of frame-by-frame movement.
   // A vehicle leaving its assigned route completes or interrupts the mission;
   // the next idle dispatch will issue a new one.
   for(const taxi of taxis){
    if(taxi.kind!=='explorer')continue;
    const mission=explorerMissions.get(taxi.id);
    if(!mission){if(taxi.status==='EXPLORING'&&taxi.path.length>1&&taxi.edgeIds.length>taxi.leg){recordExplorerMission(taxi,now);if(!missionPlannedAt.has(taxi.id))missionPlannedAt.set(taxi.id,now);}continue;}
    if(taxi.status==='EXPLORING'&&taxi.path.length>1)continue;
    if(taxi.status==='IDLE'){
     completedExplorerMissions++;
     mission.status='completed';
    }else{
     interruptedExplorerMissions++;
     mission.status='interrupted';
    }
    explorerMissions.delete(taxi.id);
    missionLastEndpoint.delete(taxi.id);
   }
   // Mission-based exploration: keep the committed route while planning its successor.
   // Use the known endpoint to prepare the next mission before arrival.

   // Preplan the next sequence before an Explorer reaches its final junction.
   // Append the new path without resetting its current leg or position.
   const explorerOrder=taxis.map((t,i)=>t.kind==='explorer'?i:-1).filter(i=>i>=0);
   orderedExplorerIndices=explorerOrder.length?explorerOrder.slice(nextExplorerIndex%explorerOrder.length).concat(explorerOrder.slice(0,nextExplorerIndex%explorerOrder.length)):[];
   // Prioritise moving explorers closest to completing their route. Stable
   // rotating order breaks ties, so fast vehicles cannot monopolise planning.
   orderedExplorerIndices.sort((a,b)=>{
    const ta=taxis[a],tb=taxis[b];
    const aa=ta.status==='EXPLORING'?Math.max(0,ta.edgeIds.length-ta.leg):Infinity;
    const bb=tb.status==='EXPLORING'?Math.max(0,tb.edgeIds.length-tb.leg):Infinity;
    return aa-bb;
   });
   if(explorerOrder.length)nextExplorerIndex=(nextExplorerIndex+1)%explorerOrder.length;
   for(const index of orderedExplorerIndices){
    const taxi=taxis[index];
    if((taxi.kind!=='explorer')||taxi.status!=='EXPLORING'||taxi.deliveryUntil||
       !specialistCanDepart(taxi,unlockedRoles))continue;

    // Request the next route earlier to reduce waits at the final junction.
    if(!explorerSuccessorDue(taxi,MISSION_LOOKAHEAD_EDGES)||!taxi.path.length)continue;
    if(successorPlansThisDispatch>=MAX_SUCCESSOR_PLANS_PER_DISPATCH||planningCalls>=planningBudget-3)continue;
    const destination=taxi.path[taxi.path.length-1];
    const from=nearest(graph,destination);
    if(!from)continue;
    // Keep moving on the current route; periodically retry failed extensions
    // as nearby roads, reservations and exploration progress change.
    const destinationKey=from+'|'+taxi.edgeIds.length;
    if(missionLastEndpoint.get(taxi.id)===destinationKey)continue;
    if(extensionLastDestination.get(taxi.id)===destinationKey&&performance.now()<(extensionRetryAt.get(taxi.id)??0)){
     extensionSkipped++;continue;
    }
    const extensionTier=explorerSearchTier.get(taxi.id)??0;
     const failureSignature=failedRouteSignature(taxi.id,taxi.explorerRole??'balanced',destination,extensionTier,seenRoadIds.size,explored.size,poiTargetsSignature);
     const failedRoute=failedRouteCache.get('successor|'+taxi.id);
     if(failedRoute?.signature===failureSignature&&performance.now()<failedRoute.until){failedRouteCacheHits++;extensionSkipped++;continue;}
    const extensionSignature=[taxi.id,destinationKey,seenRoadIds.size].join('|');
    const previousFailure=successorNegativeCache.get(taxi.id);
    if(previousFailure?.signature===extensionSignature&&performance.now()<previousFailure.until){successorNegativeCacheHits++;extensionSkipped++;continue;}
    extensionLastDestination.set(taxi.id,destinationKey);
    extensionRetryAt.set(taxi.id,performance.now()+EXTENSION_RETRY_MS);
    successorPlansThisDispatch++;
    planningCalls++;
    // This vehicle may continue from its own reserved destination.
    // Never mutate the shared reservation set to allow our own endpoint.
    const successorTargets=new Set(reservedTargets);
    successorTargets.delete(from);
    // The current mission's committed discovery edges will be purple by
    // the time the explorer reaches its endpoint, but must NOT be revealed
    // in the global save until actually driven.
    const projected=new Set([...explored,...(taxi.discoveryEdgeIds??[])]);
    const ownEdges=new Set(taxi.discoveryEdgeIds??[]);
    const otherReservations=explorerPendingReservations(taxi.id,
     new Set([...reservedEdges].filter(id=>!ownEdges.has(id))));
    const start=purpleStartNear(destination,projected);
    if(!start){
     explorerPlanSkipReason.set(taxi.id,'successor-no-purple-start');
     continue;
    }
    const fallbackAllowed=performance.now()-
     (legacyFallbackAt.get(taxi.id)??-100000)>=30000;
    if(fallbackAllowed)legacyFallbackAt.set(taxi.id,performance.now());
    const extensionStarted=performance.now();
    const decision=planSpecialistMission(activeGraph,start.node,projected,
     taxi.explorerRole,tier=>discoveryRoads({...taxi,explorerRole:tier}),
     otherReservations,successorTargets,
     {fallbackAllowed,maxVisits:18000});
    const route=decision.route?prependPurpleStart(decision.route,start):null;
    const check=route&&decision.route?validateExplorerMission(activeGraph,{
     path:route.path,edgeIds:route.edgeIds,
     discoveryEdgeIds:decision.route.discoveryEdgeIds,
     escapeTransitEdgeIds:decision.route.escapeTransitEdgeIds,
    },destination,start,projected,
     discoveryRoads({...taxi,explorerRole:decision.tier}),
     otherReservations,successorTargets):null;
    scoutRoutingMs+=performance.now()-extensionStarted;
    scoutTimings.push({vehicleId:taxi.id,role:taxi.explorerRole??'',
     ms:Math.round(performance.now()-extensionStarted),phase:'extension',
     result:decision.state+':'+decision.reason});
    if(!route||check?.ok!==true){
     explorerPlanSkipReason.set(taxi.id,'successor-'+
      (!route?decision.state+':'+decision.reason:
       check&&!check.ok?check.reason:'invalid-route'));
     if(decision.state==='exhausted'){
      failedRouteCache.set('successor|'+taxi.id,{
       signature:failureSignature,until:performance.now()+FAILED_ROUTE_RETRY_MS});
     }
     successorNegativeCache.set(taxi.id,{
      signature:extensionSignature,until:performance.now()+EXTENSION_RETRY_MS});
     // A bounded/incomplete search cannot lower the explorer's class.
     continue;
    }
    if(msg.revision!==activeRevision)return;
    // Exact endpoint continuity: no jumping onto adjacent elevated,
    // underground or parallel roads.
    if(meters(destination,route.path[0])>2)continue;
    const next:Taxi={...taxi,
     path:[...taxi.path,...route.path.slice(1)],
     edgeIds:[...taxi.edgeIds,...route.edgeIds],
     discoveryEdgeIds:[...(taxi.discoveryEdgeIds??[]),...(decision.route?.discoveryEdgeIds??[])],
     escapeTransitEdgeIds:[...(taxi.escapeTransitEdgeIds??[]),...(decision.route?.escapeTransitEdgeIds??[])],
     scoutingRuns:(taxi.scoutingRuns??0)+1};
    // Validating the *successor alone* is not enough. An appended route
    // may cross an adjacent tunnel/bridge or inherit an invalid directed
    // turn at the join. Validate the entire resulting mission before
    // mutating this taxi or reserving its new discoveries.
    const mergedHealth=evaluateExplorerRoute(activeGraph,next,seenRoadIds,
     roadEndpoints,explored);
    if(mergedHealth.state!=='valid'){
     if(mergedHealth.state==='invalid')
      rejectExplorerCandidate(taxi.id,mergedHealth.edgeId);
     explorerPlanSkipReason.set(taxi.id,'successor-merged-route-'+
      mergedHealth.reason+(mergedHealth.edgeId?':'+mergedHealth.edgeId:''));
     successorNegativeCache.set(taxi.id,{
      signature:extensionSignature,until:performance.now()+EXTENSION_RETRY_MS});
     continue;
    }
    explorerSearchTier.set(taxi.id,0);
    successorNegativeCache.delete(taxi.id);
    failedRouteCache.delete('successor|'+taxi.id);
    missionLastEndpoint.set(taxi.id,destinationKey);
    taxis[index]=next;
    for(const id of decision.route?.discoveryEdgeIds??[])reservedEdges.add(id);
    reservedTargets.add(check.endNode);
    recordExplorerMission(next,now);
    missionSequence.set(taxi.id,(missionSequence.get(taxi.id)??0)+1);
    missionPlannedAt.set(taxi.id,now);
    assignedCount++;
   }
   // Reserve three of four route-planning slots for idle explorers.
   // Fairness is maintained by oldest consideration rather than fleet order.
   let singleWorkerScansThisDispatch=0;
   const idleOrder=[...orderedExplorerIndices].sort((a,b)=>
    (explorerLastConsidered.get(taxis[a].id)??0)-(explorerLastConsidered.get(taxis[b].id)??0));
   for(const index of idleOrder){
    const idleVehicle=taxis[index];
    if(idleVehicle.kind!=='explorer'||idleVehicle.ferryTrip||idleVehicle.status!=='IDLE')continue;
    if(!specialistCanDepart(idleVehicle,unlockedRoles)&&specialistFallbackRoles(idleVehicle.explorerRole).length===0){
     explorerPlanSkipReason.set(idleVehicle.id,
      'waiting-for-connected-'+(idleVehicle.explorerRole??'road')+'-frontier');
     continue;
    }
    // A skipped candidate counts as considered, ensuring every idle explorer
    // eventually moves to the front regardless of retry or mission status.
    explorerLastConsidered.set(idleVehicle.id,++explorerConsiderationSequence);
    if(idleVehicle.deliveryUntil||idleVehicle.refillRequested||energyPercent(idleVehicle)<=10){
     explorerPlanSkipReason.set(idleVehicle.id,'operational-unavailable');continue;
    }
    if(idleMissionPlans>=MAX_IDLE_MISSION_PLANS_PER_DISPATCH||planningCalls>=planningBudget){
     // Leave remaining explorers unconsidered so each gets a fair next turn.
     break;
    }
    // On iOS the pooled planner workers are disabled for memory safety.
    // Use the SAME class-aware, directed purple-frontier planner directly on
    // the dispatcher's existing graph before old regional candidate filters.
    // A bounded per-explorer cadence avoids repeatedly scanning 100k nodes.
    const role=idleVehicle.explorerRole;
    if(singleWorkerScansThisDispatch<1&&
      (role==='highway'||role==='primary'||role==='secondary'||role==='residential'||role==='poi')&&
      performance.now()-(singleWorkerScanAt.get(idleVehicle.id)??-100000)>=7000){
     singleWorkerScansThisDispatch++;
     singleWorkerScanAt.set(idleVehicle.id,performance.now());
     const origin=purpleStartNear(idleVehicle.position,explored);
     if(origin){
      explorerStartIssues.delete(idleVehicle.id);
      const allowed=discoveryRoads(idleVehicle);
      const signature=componentFailureSignature(origin.node,seenRoadIds.size,
       explored.size,role);
      const previousFailure=frontierFailureCache.get(idleVehicle.id);
      if(previousFailure?.signature===signature&&performance.now()<previousFailure.retryAt){
       explorerPlanSkipReason.set(idleVehicle.id,'unchanged-directed-component');
       singleWorkerScanResult.set(idleVehicle.id,'unchanged-component-waiting-for-new-roads');
       continue;
      }
      // Shared desktop/iPhone class order and "incomplete is not exhausted"
      // semantics. An expensive directed fallback is rate-limited on iOS;
      // during cooldown we HOLD the preferred class instead of downgrading.
      const timestamp=performance.now();
      const fallbackAllowed=timestamp-(legacyFallbackAt.get(idleVehicle.id)??-100000)>=30000;
      if(fallbackAllowed)legacyFallbackAt.set(idleVehicle.id,timestamp);
      const decision=planSpecialistMission(activeGraph,origin.node,explored,role,
       tier=>discoveryRoads({...idleVehicle,explorerRole:tier}),
       explorerPendingReservations(idleVehicle.id,reservedEdges),
       reservedTargets,{fallbackAllowed});
      const planned={route:decision.route,diagnostic:decision.diagnostic};
      const route=decision.route;
      const completed=route?prependPurpleStart(route,origin):null;
      const destination=completed?nearest(activeGraph,completed.path.at(-1)!):null;
      const check=route&&completed?validateExplorerMission(activeGraph,{
       path:completed.path,edgeIds:completed.edgeIds,
       discoveryEdgeIds:route.discoveryEdgeIds,
       escapeTransitEdgeIds:route.escapeTransitEdgeIds,
      },idleVehicle.position,origin,explored,
       discoveryRoads({...idleVehicle,explorerRole:decision.tier}),
       reservedEdges,reservedTargets):null;
      const routeHealthCheck=route&&completed?evaluateExplorerRoute(activeGraph,{
       ...idleVehicle,status:'EXPLORING',path:completed.path,
       edgeIds:completed.edgeIds,discoveryEdgeIds:route.discoveryEdgeIds,
       escapeTransitEdgeIds:route.escapeTransitEdgeIds,leg:0,distanceIntoLeg:0,
      },seenRoadIds,roadEndpoints,explored):null;
      const routeValid=check?.ok===true&&routeHealthCheck?.state==='valid';
      singleWorkerScanResult.set(idleVehicle.id,
       'road-frontier:'+decision.state+':'+decision.reason+
       ':tier='+decision.tier+':visited='+decision.diagnostic.visitedPurpleNodes);
      if(completed&&route){
       if(routeValid){
        explorerRejectedCandidate.delete(idleVehicle.id);
        explorerRecoveryReason.delete(idleVehicle.id);
        frontierFailureCache.delete(idleVehicle.id);
        explorerComponents.delete(idleVehicle.id);
        explorerExhaustionProof.delete(idleVehicle.id);
        const assignment:Taxi={...idleVehicle,
         ...(role==='poi'?{poiTargetId:undefined,poiTargetName:undefined}:{}),
         status:'EXPLORING',
         path:completed.path,edgeIds:completed.edgeIds,
         discoveryEdgeIds:route.discoveryEdgeIds,
         escapeTransitEdgeIds:route.escapeTransitEdgeIds,
         journeyEdges:[],leg:0,distanceIntoLeg:0,
         scoutingRuns:(idleVehicle.scoutingRuns??0)+1};
        taxis[index]=assignment;
        for(const id of route.discoveryEdgeIds)reservedEdges.add(id);
        if(destination)reservedTargets.add(destination);
        majorSearches.delete(idleVehicle.id);
        explorerSearchTier.set(idleVehicle.id,0);
        idleRetryAt.delete(idleVehicle.id);
        negativeScoutCache.delete(idleVehicle.id);
        failedRouteCache.delete('idle|'+idleVehicle.id);
        explorerPlanSkipReason.set(idleVehicle.id,'single-worker:planned');
        explorerPlanningAttempts.set(idleVehicle.id,(explorerPlanningAttempts.get(idleVehicle.id)??0)+1);
        missionPlannedAt.set(idleVehicle.id,now);
        recordExplorerMission(assignment,now);
        scoutTimings.push({vehicleId:idleVehicle.id,role:role??'',ms:0,phase:'idle',result:'single-worker-planned'});
        assignedCount++;idleMissionPlans++;planningCalls++;
        continue;
       }
       const reason=check&&!check.ok?check.reason:
        routeHealthCheck?.state==='invalid'?routeHealthCheck.reason:
        routeHealthCheck?.state==='waiting-for-tiles'?'route-tiles-loading':'unknown';
       rejectExplorerCandidate(idleVehicle.id,
        routeHealthCheck?.state==='invalid'?routeHealthCheck.edgeId:undefined);
       singleWorkerScanResult.set(idleVehicle.id,'route-rejected:'+reason);
      }
      if(route&&!routeValid){
       explorerPlanSkipReason.set(idleVehicle.id,
        'shared-route-validator-rejected:'+ (check&&!check.ok?check.reason:
         routeHealthCheck?.state==='invalid'?routeHealthCheck.reason:'route-tiles-loading'));
       continue;
      }
      if(!route){
       explorerPlanSkipReason.set(idleVehicle.id,decision.state==='incomplete'
        ?'preferred-class-search-incomplete:'+decision.reason:'no-eligible-candidates');
       if(decision.state==='exhausted')
        explorerSearchTier.set(idleVehicle.id,SEARCH_RADII_KM.length-1);
       const component=inspectExplorerComponent(activeGraph,origin.node,
        explored,allowed,reservedEdges,hqNode,14000);
       explorerComponents.set(idleVehicle.id,component);
       // Only conclusive negative scans may enter the failure cooldown.
       if(decision.state==='exhausted'&&component.complete){
        frontierFailureCache.set(idleVehicle.id,{
         signature,retryAt:performance.now()+12000});
        if(component.reservedFrontiers===0)
         explorerExhaustionProof.set(idleVehicle.id,{
          origin:origin.node,role:idleVehicle.explorerRole,
          at:now,roadCount:seenRoadIds.size,discoveredCount:explored.size});
       }else explorerExhaustionProof.delete(idleVehicle.id);
       // Incomplete checks must retry, and completed negative checks can
       // trigger ferry readiness. Neither may discover a lower class early.
       continue;
      }
      if(!route&&role!=='poi'&&planned&&hqNode&&
       meters(idleVehicle.position,hq)>300&&
       (planned.diagnostic.visitedPurpleNodes<=1||
        now-(idleSince.get(idleVehicle.id)??now)>45000)){
       // Do not leave a specialist parked at an exhausted one-way spur:
       // return to headquarters *only* if already discovered roads provide
       // a legally directed route. This never discovers unrelated classes.
       const homeRoute=routeDiscovered(activeGraph,origin.node,hqNode,explored,'',false);
       if(homeRoute&&homeRoute.edgeIds.length>0){
        const returnRoute=prependPurpleStart(homeRoute,origin);
        if(returnRoute.edgeIds.length===returnRoute.path.length-1){
         // Reposition to HQ without parking forever: the scout resumes
         // normal frontier planning as soon as the directed trip finishes.
         taxis[index]={...idleVehicle,status:'RETURNING',pauseAtHome:false,
          path:returnRoute.path,edgeIds:returnRoute.edgeIds,
          discoveryEdgeIds:[],escapeTransitEdgeIds:[],journeyEdges:[],
          leg:0,distanceIntoLeg:0,speedKph:0};
         explorerPlanSkipReason.set(idleVehicle.id,'repositioning-to-hq-no-reachable-frontier');
         singleWorkerScanResult.set(idleVehicle.id,'directed-return-to-depot:edges='+returnRoute.edgeIds.length);
         continue;
        }
       }
      }
     }else{
      singleWorkerScanResult.set(idleVehicle.id,'no-purple-segment-near-vehicle');
      const near=nearest(activeGraph,idleVehicle.position);
      const point=activeGraph.nodes.get(near);
      explorerStartIssues.set(idleVehicle.id,{
       nearestNodeMeters:point?Math.round(meters(point,idleVehicle.position)): -1,
       nearestNodePurpleEdges:(activeGraph.edges.get(near)??[])
        .filter(e=>explored.has(e.id)&&e.meters>0).length,
       loadedPurpleRoads:[...explored].filter(id=>roadEndpoints.has(id)).length
      });
     }
    }
    // Current specialists never fall through to legacy dispatchScout;
    // its regional road choices repeatedly violate one-way/layer topology.
    // On iPhone, one bounded shared-planner search per dispatch is deliberate.
    if(usesAutopilotRoutePlanner(idleVehicle.explorerRole)){
     const previous=explorerPlanSkipReason.get(idleVehicle.id)??'';
     if(!previous.startsWith('shared-route-')&&
        !previous.startsWith('preferred-class-')&&
        previous!=='no-purple-segment-near-vehicle')
      explorerPlanSkipReason.set(idleVehicle.id,'autopilot-planner-queued');
     continue;
    }
    if(idleVehicle.explorerRole==='poi'){const p=poiRetryWallClock.get(idleVehicle.id);if(p&&performance.now()<p.until&&p.roadCount===seenRoadIds.size&&p.poiSignature===poiTargetsSignature){poiCooldownSkips++;idleSkipped++;explorerPlanSkipReason.set(idleVehicle.id,'poi-cooldown');continue;}}
    const positionKey=idleVehicle.position.join(',');
    // Resume an existing pathfinding frontier before considering normal cooldowns.
    const existingMajorSearch=majorSearches.get(idleVehicle.id);
    const continuingMajorSearch=!!existingMajorSearch&&!existingMajorSearch.complete&&
     existingMajorSearch.role===idleVehicle.explorerRole&&
     existingMajorSearch.start===nearest(graph,idleVehicle.position)&&
     performance.now()-existingMajorSearch.born<=60000;
    const unchanged=idleRetryRoadCount.get(idleVehicle.id)===seenRoadIds.size&&
      idleRetryExploredCount.get(idleVehicle.id)===explored.size&&
      idleRetryPosition.get(idleVehicle.id)===positionKey;
    if(!continuingMajorSearch&&unchanged&&now<(idleRetryAt.get(idleVehicle.id)??0)){
     explorerPlanSkipReason.set(idleVehicle.id,'retry-cooldown');idleSkipped++;continue;
    }
    // Throttle starting a new motorway search, not resuming its bounded slices.
    if(!continuingMajorSearch&&taxis[index].explorerRole==='motorway'&&now<(idleFallbackAt.get(taxis[index].id)??0)){
     explorerPlanSkipReason.set(idleVehicle.id,'major-search-throttle');continue;
    }
    if(!continuingMajorSearch&&taxis[index].explorerRole==='motorway')idleFallbackAt.set(taxis[index].id,now+10000);
    const purpleCluster=purpleAllowedRoads;
    if(taxis[index].kind==='explorer'&&!purpleCluster){explorerPlanSkipReason.set(idleVehicle.id,'no-exploration-network');continue;}
    const tier=explorerSearchTier.get(idleVehicle.id)??0;
     const idleFailureSignature=failedRouteSignature(idleVehicle.id,idleVehicle.explorerRole??'balanced',idleVehicle.position,tier,seenRoadIds.size,explored.size,poiTargetsSignature);
     const failedIdle=failedRouteCache.get('idle|'+idleVehicle.id);
     if(!continuingMajorSearch&&failedIdle?.signature===idleFailureSignature&&performance.now()<failedIdle.until){explorerPlanSkipReason.set(idleVehicle.id,'failed-route-cache');failedRouteCacheHits++;idleSkipped++;continue;}
    const signature=scoutSignature(idleVehicle.position,tier,seenRoadIds.size,idleVehicle.explorerRole??'balanced');
    const cached=negativeScoutCache.get(idleVehicle.id);
    if(!continuingMajorSearch&&cached&&cached.signature===signature&&now<cached.until){
     explorerPlanSkipReason.set(idleVehicle.id,'negative-cache');negativeScoutCacheHits++;idleSkipped++;continue;
    }
    const candidateStarted=performance.now();
    // Do not rescan and sort regional candidates for every incremental slice.
    // Service explorers now route to connected service-road frontiers.
    // Never apply the obsolete harbour-only skip to saved POI-role vehicles.
    const candidates=continuingMajorSearch
     ?new Set<string>(existingMajorSearch!.entries.map(entry=>entry.id))
     :preferConnectedCandidates(graph,idleVehicle.position,prioritizeScoutCandidates(graph,idleVehicle.position,regionalCandidates(idleVehicle.position,discoveryRoads(idleVehicle),explored,reservedEdges,SEARCH_RADII_KM[tier],idleVehicle.explorerRole??'balanced')),idleVehicle.explorerRole??'balanced');
    candidateSelectionMs+=performance.now()-candidateStarted;
    if(candidates.size===0){
     explorerPlanSkipReason.set(idleVehicle.id,'no-eligible-candidates');negativeScoutEmptySkips++;idleSkipped++;
     negativeScoutCache.set(idleVehicle.id,{signature,until:now+NEGATIVE_SCOUT_TTL_MS});
     explorerSearchTier.set(idleVehicle.id,Math.min(tier+1,SEARCH_RADII_KM.length-1));
     // An empty bounded candidate search does not establish global exhaustion.
     if(tier===SEARCH_RADII_KM.length-1)deferredDepotReturns++;
     continue;
    }
    const idleStarted=performance.now();
    explorerPlanSkipReason.set(idleVehicle.id,'route-attempt');
    explorerPlanningAttempts.set(idleVehicle.id,(explorerPlanningAttempts.get(idleVehicle.id)??0)+1);
    explorerLastPlanAttempt.set(idleVehicle.id,performance.now());
    idleMissionPlans++;
    planningCalls++;
    const scoutRouteStarted=performance.now();
    const majorRoad=idleVehicle.explorerRole==='motorway'||idleVehicle.explorerRole==='trunk';
    const purpleOrigin=purpleStartNear(idleVehicle.position,explored);
    if(!purpleOrigin){explorerPlanSkipReason.set(idleVehicle.id,'no-purple-segment-near-vehicle');continue;}
    const anchoredTaxi={...idleVehicle,position:graph.nodes.get(purpleOrigin.node)!};
    const targeted=majorRoad?targetMajorRoadMission(anchoredTaxi,graph,candidates,explored,reservedTargets,reservedEdges,discoveryRoads(idleVehicle).size):null;
    // Search-budget exhaustion is inconclusive. Do not immediately repeat
    // another large graph search with dispatchScout in the same dispatch.
    const majorStats=majorRoadSearchDiagnostics.get(idleVehicle.id);
    // The legacy regional fallback is still used for some iPhone saves.
    // It must NOT mutate global reservations until a fully directed route
    // passes the same admission standard as Autopilot 2.0.
    const candidateTargets=new Set(reservedTargets);
    const candidateRoads=new Set(reservedEdges);
    const plannedScout=targeted??(majorRoad&&majorStats?.outcome==='search-in-progress'
     ?idleVehicle
     :await dispatchScout(anchoredTaxi,graph,explored,hq,candidateTargets,candidateRoads,undefined,purpleAllowedRoads,discoveryRoads(taxis[index]),undefined,undefined,undefined,poiTargets,frontierFor(taxis[index]),revealedNodes,()=>msg.revision===activeRevision,candidates));
    const scout=plannedScout.status==='EXPLORING'?
     {...plannedScout,position:idleVehicle.position,
      path:purpleOrigin.connector?[idleVehicle.position,...plannedScout.path]:plannedScout.path,
      edgeIds:purpleOrigin.connector?[purpleOrigin.connector.edgeId,...plannedScout.edgeIds]:plannedScout.edgeIds}:
     plannedScout;
    if(msg.revision!==activeRevision)return;
    scoutRoutingMs+=performance.now()-scoutRouteStarted;
   scoutTimings.push({vehicleId:taxis[index].id,role:taxis[index].explorerRole??'',ms:Math.round(performance.now()-idleStarted),phase:'idle',result:scout.status});
    let assignment=scout;
    if(assignment.status==='EXPLORING'&&
       hasInvalidRedApproach(activeGraph,assignment.path,assignment.edgeIds,
        explored,new Set(assignment.discoveryEdgeIds??[]))){
     explorerPlanSkipReason.set(idleVehicle.id,'red-transit-before-discovery');
     assignment=idleVehicle;
    }
    // Phase 3 used to discover these illegal routes one tick AFTER assigning
    // them, trapping the UI in "Checking Route" and repeatedly resetting the
    // same scout. Validate at admission, including every directed OSM node,
    // reserved discoveries, purple start and any mid-segment connector.
    if(assignment.status==='EXPLORING'){
     const checked=evaluateExplorerRoute(activeGraph,assignment,seenRoadIds,
      roadEndpoints,explored);
     if(checked.state!=='valid'){
      rejectExplorerCandidate(idleVehicle.id,checked.edgeId);
      explorerPlanSkipReason.set(idleVehicle.id,
       'legacy-candidate-rejected:'+checked.reason+
       (checked.edgeId?':road='+checked.edgeId:''));
      singleWorkerScanResult.set(idleVehicle.id,
       'legacy-candidate-rejected:'+checked.reason);
      assignment=idleVehicle;
     }
    }
    // No immediate second expensive search: retry in a later planning turn.
    if(assignment.status!=='IDLE'){
     explorerSearchTier.set(idleVehicle.id,0);
     negativeScoutCache.delete(idleVehicle.id);failedRouteCache.delete('idle|'+idleVehicle.id);
     idleRetryAt.delete(idleVehicle.id);poiRetryWallClock.delete(idleVehicle.id);
     taxis[index]=assignment;autoParkedExplorers.delete(idleVehicle.id);
     explorerRecoveryReason.delete(idleVehicle.id);
     for(const id of assignment.discoveryEdgeIds??[])if(!explored.has(id))reservedEdges.add(id);
     const goal=assignment.path.at(-1);
     if(goal){const node=nearest(activeGraph,goal);if(node)reservedTargets.add(node);}
     missionSequence.set(idleVehicle.id,(missionSequence.get(idleVehicle.id)??0)+1);
     missionLastEndpoint.delete(idleVehicle.id);
     missionPlannedAt.set(idleVehicle.id,now);
     if(assignment.status==='EXPLORING')recordExplorerMission(assignment,now);
     assignedCount++;
    }else{
     if(majorRoad&&majorStats?.outcome==='search-in-progress'){
      explorerPlanSkipReason.set(idleVehicle.id,'incremental-search');
      continue;
     }
     failedRouteSearches++;failedRouteCache.set('idle|'+idleVehicle.id,{signature:idleFailureSignature,until:performance.now()+FAILED_ROUTE_RETRY_MS});
      negativeScoutCache.set(idleVehicle.id,{signature,until:now+NEGATIVE_SCOUT_TTL_MS});
     explorerSearchTier.set(idleVehicle.id,Math.min(tier+1,SEARCH_RADII_KM.length-1));
     idleRetryAt.set(idleVehicle.id,now+IDLE_RETRY_MS);
     idleRetryRoadCount.set(idleVehicle.id,seenRoadIds.size);
     idleRetryExploredCount.set(idleVehicle.id,explored.size);
     idleRetryPosition.set(idleVehicle.id,positionKey);
      // A failed route search is inconclusive: retry when graph state changes.
      if(tier===SEARCH_RADII_KM.length-1)deferredDepotReturns++;
    }
   }
   // Idle explorers remain at their current location and retry discovery.
   // Never return to headquarters automatically for a lack of assignments.
   // Explorers stay IDLE when no reachable discovery target exists.
   // Do not park or pause them: the next dispatch automatically retries as
   // new eligible roads and territory arrive.
  }
  if(msg.allowScout&&planningPool.length===2){
   const hqNode=nearest(graph,hq);
   updateDiscoveryIndex(graph,explored,hqNode);
   const poiTargets=msg.poiMissions?.map(m=>m.point)??(msg.poiTargets?.length?msg.poiTargets:msg.harbourTargets??[]);
   updatePoiIndex(graph,poiTargets);
   const unlockedRoles=unlockedSpecialistRoles(graph,connectedFrontierIndex,
    explored,poiRoadsIndex);
   for(const role of discoveredRoleHistory)unlockedRoles.add(role);
   for(let i=0;i<taxis.length;i++){
    const t=taxis[i];
    if(t.kind==='explorer'&&t.status==='EXPLORING'&&
       !specialistCanDepart(t,unlockedRoles)&&specialistFallbackRoles(t.explorerRole).length===0){
     taxis[i]={...t,status:'IDLE',path:[],edgeIds:[],
      discoveryEdgeIds:[],escapeTransitEdgeIds:[],journeyEdges:[],
      leg:0,distanceIntoLeg:0,speedKph:0,routeInvalid:true};
     explorerPlanSkipReason.set(t.id,'waiting-for-connected-'+(t.explorerRole??'road')+'-frontier');
    }
   }
   // Preserve operational holds and recover only genuinely idle scouts.
   for(let i=0;i<taxis.length;i++){
    const t=taxis[i];
    if(t.kind==='explorer'&&!t.ferryTrip&&t.status==='PAUSED'&&!t.shiftParked&&
       !t.deliveryUntil&&!t.serviceDestination&&!t.refillDestination&&
       !t.recoveryPending&&!t.refillRequested&&energyPercent(t)>10){
     taxis[i]={...t,status:'IDLE',path:[],edgeIds:[],leg:0,distanceIntoLeg:0,speedKph:0};
     pausedExplorerRecoveries++;
    }
   }
   // Only active explorer routes reserve discovery edges. Purple transit can
   // be shared, but no two planners may claim an undiscovered road.
   const reservedTargets=new Set<string>(),reservedEdges=new Set<string>();
   for(const vehicle of taxis)if(vehicle.kind==='explorer'&&vehicle.status==='EXPLORING'){
    for(const id of vehicle.discoveryEdgeIds??[])if(!explored.has(id))reservedEdges.add(id);
    const end=vehicle.path.at(-1);
    if(end){const node=nearest(graph,end);if(node)reservedTargets.add(node);}
   }
   // Apply finished routes only after checking the latest purple network,
   // mission endpoint, role reservations and the vehicle's current status.
   for(let index=0;index<taxis.length;index++){
    const current=taxis[index];
    if(current.kind!=='explorer')continue;
    const proposal=planningResults.get(current.id);
    if(!specialistCanDepart(current,unlockedRoles)&&specialistFallbackRoles(current.explorerRole).length===0){
     planningResults.delete(current.id);
     explorerPlanSkipReason.set(current.id,
      'waiting-for-connected-'+(current.explorerRole??'road')+'-frontier');
     continue;
    }
    if(!proposal)continue;
    planningResults.delete(current.id);
    // Make rejected suggestions actionable in the downloadable diagnostics.
    // A rejected result must never leave a planner stuck with a stale route.
    const reject=(reason:string)=>{
     const old=planningStats.get(current.id);
     planningStats.set(current.id,{result:'rejected:'+reason,
      ms:old?.ms??0,queueMs:old?.queueMs??0,at:performance.now()});
     explorerPlanSkipReason.set(current.id,'pool-rejected:'+reason);
     planningBackoff.delete(current.id);
    };
    if(proposal.outcome!=='planned'||!proposal.taxi){
     // Exhaustion evidence comes from an accepted *current* IDLE request.
     // Never let a stale planner response trigger paid ferry booking.
     if(proposal.mode==='idle'&&proposal.searchState==='exhausted'&&
      proposal.outcome==='no-reachable-specialist-frontier'&&
      proposal.originNode&&explorerPlannerResultCurrent(current,{
       mode:'idle',role:proposal.requestedRole,
       scoutingRuns:proposal.expectedScoutingRuns,
      })){
      const component=inspectExplorerComponent(activeGraph,
       proposal.originNode,explored,discoveryRoads(current),
       reservedEdges,hqNode,14000);
      explorerComponents.set(current.id,component);
      if(component.complete&&component.reservedFrontiers===0)
       explorerExhaustionProof.set(current.id,{
        origin:proposal.originNode,role:current.explorerRole,
        at:now,roadCount:seenRoadIds.size,discoveredCount:explored.size});
     }
     continue;
    }
    if(!explorerPlannerResultCurrent(current,{
     mode:proposal.mode??'idle',role:proposal.requestedRole,
     scoutingRuns:proposal.expectedScoutingRuns,
     baseEdgeIds:proposal.baseEdgeIds,
    })){reject('stale-mission-generation');continue;}
    const route=proposal.taxi;
    const append=proposal.mode==='successor'&&current.status==='EXPLORING'&&
     !!proposal.baseEdgeIds&&proposal.baseEdgeIds.length===current.edgeIds.length&&
     proposal.baseEdgeIds.every((id,i)=>current.edgeIds[i]===id);
    if(current.status!=='IDLE'&&!append){reject('vehicle-no-longer-idle');continue;}
    const origin=append?current.path.at(-1):current.position;
    if(!origin||!route.path.length||meters(origin,route.path[0])>20||
       route.edgeIds.length!==route.path.length-1){reject('route-start-or-shape');continue;}
    const projected=append?new Set([...explored,...current.discoveryEdgeIds??[]]):explored;
    const startNode=purpleStartNear(origin,projected);
    if(!startNode){reject('no-purple-segment-at-departure');continue;}
    const tier=proposal.discoveryTier??current.explorerRole;
    const permitted=specialistFallbackRoles(current.explorerRole);
    if(permitted.length&&!permitted.includes(tier as typeof permitted[number])){
     reject('invalid-specialist-fallback-tier');continue;
    }
    const verified=validateExplorerMission(activeGraph,{
     path:route.path,edgeIds:route.edgeIds,
     discoveryEdgeIds:route.discoveryEdgeIds??[],
     escapeTransitEdgeIds:route.escapeTransitEdgeIds??[],
    },origin,startNode,projected,discoveryRoads({...current,explorerRole:tier}),
     reservedEdges,reservedTargets,
     append?nearest(graph,current.path.at(-1)!):undefined);
    if(!verified.ok){reject(verified.reason);continue;}
    const selected=new Set(route.discoveryEdgeIds??[]);
    const end=verified.endNode;
    const next:Taxi=append?{...current,
     path:[...current.path,...route.path.slice(1)],
     edgeIds:[...current.edgeIds,...route.edgeIds],
     discoveryEdgeIds:[...(current.discoveryEdgeIds??[]),...(route.discoveryEdgeIds??[])],
     escapeTransitEdgeIds:[...(current.escapeTransitEdgeIds??[]),...(route.escapeTransitEdgeIds??[])],
     scoutingRuns:route.scoutingRuns}:
     {...route,position:current.position,driver:current.driver,
      deliveryUntil:current.deliveryUntil,vehicleCondition:current.vehicleCondition,
      energyRemaining:current.energyRemaining};
    taxis[index]=next;
    for(const id of selected)reservedEdges.add(id);
    if(end)reservedTargets.add(end);
    recordExplorerMission(next,now);
    missionSequence.set(current.id,(missionSequence.get(current.id)??0)+1);
    missionPlannedAt.set(current.id,now);
    if(append)successorPlansThisDispatch++;
    assignedCount++;
   }
   // At most two concurrent tasks. Independent search state remains bound to
   // the explorer ID; failed POI searches do not block other specialists.
   const inFlight=new Set([...planningRequests.values()].map(r=>r.id));
   const explorers=taxis.filter(t=>t.kind==='explorer'&&t.status==='IDLE'&&
    (specialistCanDepart(t,unlockedRoles)||specialistFallbackRoles(t.explorerRole).length>0)&&
    !t.ferryTrip&&!t.deliveryUntil&&!t.serviceDestination&&
    !t.refillDestination&&!t.recoveryPending&&!t.refillRequested&&
    energyPercent(t)>10&&!inFlight.has(t.id)&&
    (!planningBackoff.has(t.id)||planningBackoff.get(t.id)!.until<=performance.now()||
     planningBackoff.get(t.id)!.roads!==seenRoadIds.size||
     planningBackoff.get(t.id)!.explored!==explored.size));
   // Give the local explorer the first opportunity to expand the purple
   // network. Once every role has received a turn, use fair oldest-first
   // scheduling so highway and POI planning do not starve other explorers.
   const initialPriority=(t:Taxi)=>t.explorerRole==='residential'?0:
    t.explorerRole==='secondary'?1:t.explorerRole==='primary'?2:
    t.explorerRole==='highway'?3:4;
   explorers.sort((a,b)=>{
    const aa=planningLastSent.get(a.id),bb=planningLastSent.get(b.id);
    if(aa===undefined&&bb===undefined)return initialPriority(a)-initialPriority(b);
    if(aa===undefined)return -1;
    if(bb===undefined)return 1;
    return aa-bb;
   });
   const readyPlannerSlots=planningPool.filter(slot=>slot.ready&&!slot.busy&&slot.roads>0).length;
   const urgentSuccessors=taxis.some(t=>t.kind==='explorer'&&
    explorerSuccessorUrgent(t)&&!t.ferryTrip&&!t.deliveryUntil&&!inFlight.has(t.id));
   const idleSlotQuota=explorerPlannerIdleQuota(readyPlannerSlots,urgentSuccessors);
   let idleSlotsUsed=0;
   for(const slot of planningPool){
    if(!slot.ready||slot.busy||slot.roads===0)continue;
    if(idleSlotsUsed>=idleSlotQuota)break;
    const vehicle=explorers.shift();
    if(!vehicle)break;
    const start=purpleStartNear(vehicle.position,explored);
    if(!start){
     explorerPlanSkipReason.set(vehicle.id,'no-purple-start');continue;
    }
    slot.busy=true;idleSlotsUsed++;
    const requestId=++nextPlanningRequest;
    slot.requestId=requestId;
    planningRequests.set(requestId,{id:vehicle.id,at:performance.now(),
     position:vehicle.position,exploredCount:explored.size,mode:'idle',
     requestedRole:vehicle.explorerRole,expectedScoutingRuns:vehicle.scoutingRuns??0,originNode:start.node});
    planningLastSent.set(vehicle.id,performance.now());
    explorerPlanningAttempts.set(vehicle.id,(explorerPlanningAttempts.get(vehicle.id)??0)+1);
    explorerPlanSkipReason.set(vehicle.id,'pool-search');
    idleMissionPlans++;planningCalls++;
    try{
     slot.worker.postMessage({type:'plan',revision:activeRevision,requestId,
      vehicle,explored:[...explored],reservedRoads:[...reservedEdges],
      reservedDestinations:[...reservedTargets],hq,
      poiRoadIds:[...poiRoadsIndex],poiTargets});
    }catch(error){
     slot.busy=false;planningRequests.delete(requestId);
     explorerPlanSkipReason.set(vehicle.id,'pool-message-error:'+String(error));
    }
   }
   // One slot is reserved for urgent successor work; the other still
   // serves idle explorers. Nonurgent lookahead uses genuinely free slots.
   {
    const moving=taxis.filter(t=>t.kind==='explorer'&&t.status==='EXPLORING'&&
     (specialistCanDepart(t,unlockedRoles)||specialistFallbackRoles(t.explorerRole).length>0)&&
     !t.ferryTrip&&!t.deliveryUntil&&t.path.length>=2&&
     explorerSuccessorDue(t,MISSION_LOOKAHEAD_EDGES)&&!inFlight.has(t.id)&&
     (!planningBackoff.has(t.id)||planningBackoff.get(t.id)!.until<=performance.now()||
      planningBackoff.get(t.id)!.roads!==seenRoadIds.size||
      planningBackoff.get(t.id)!.explored!==explored.size));
    moving.sort((a,b)=>explorerRemainingEdges(a)-explorerRemainingEdges(b)||
     (planningLastSent.get(a.id)??0)-(planningLastSent.get(b.id)??0));
    for(const slot of planningPool){
     if(!slot.ready||slot.busy||slot.roads===0)continue;
     const vehicle=moving.shift();
     if(!vehicle)break;
     const destination=vehicle.path.at(-1);
     if(!destination)continue;
     const projected=new Set([...explored,...vehicle.discoveryEdgeIds??[]]);
     const endNode=nearest(graph,destination);
     if(!purpleStartNear(destination,projected)||!endNode)continue;
     const requestId=++nextPlanningRequest;
     slot.busy=true;slot.requestId=requestId;
     planningRequests.set(requestId,{id:vehicle.id,at:performance.now(),
      position:destination,exploredCount:explored.size,mode:'successor',
      baseEdgeIds:vehicle.edgeIds.slice(),requestedRole:vehicle.explorerRole,
      expectedScoutingRuns:vehicle.scoutingRuns??0});
     planningLastSent.set(vehicle.id,performance.now());
     explorerPlanningAttempts.set(vehicle.id,(explorerPlanningAttempts.get(vehicle.id)??0)+1);
     explorerPlanSkipReason.set(vehicle.id,'pool-successor');
     planningCalls++;
     try{
      slot.worker.postMessage({type:'plan',revision:activeRevision,requestId,
       vehicle:{...vehicle,status:'IDLE',position:destination,path:[],edgeIds:[],
        discoveryEdgeIds:[],leg:0,distanceIntoLeg:0},
       explored:[...projected],
       reservedRoads:[...reservedEdges].filter(id=>!(vehicle.discoveryEdgeIds??[]).includes(id)),
       reservedDestinations:[...reservedTargets].filter(n=>n!==endNode),
       hq,poiRoadIds:[...poiRoadsIndex],poiTargets});
     }catch(error){
      slot.busy=false;planningRequests.delete(requestId);
      explorerPlanSkipReason.set(vehicle.id,'pool-successor-message-error:'+String(error));
     }
    }
   }
   orderedExplorerIndices=taxis.map((t,i)=>t.kind==='explorer'?i:-1).filter(i=>i>=0);
  }
  const scoutMs=performance.now()-scoutStarted;
  const workerMs=performance.now()-dispatchStarted;
  self.postMessage({type:'result',revision:activeRevision,taxis,queue,assignedCount,generatedMission,roadCount:seenRoadIds.size,perf:{workerMs,preparationMs,passengerMs,scoutMs,graphNodes:graph.nodes.size,graphRoads:seenRoadIds.size,vehicles:taxis.length,missions:msg.queue.length,plannerPool:{workers:planningPool.length,busy:planningPool.filter(p=>p.busy).length,
 pending:planningRequests.size,results:planningResults.size,
 vehicles:taxis.filter(t=>t.kind==='explorer').map(t=>({
 id:t.id,role:t.explorerRole??'balanced',
 ...(planningStats.get(t.id)??{result:'not-requested',ms:0,queueMs:0,at:0}),
 waiting:planningLastSent.has(t.id)&&planningRequests.size>0&&
  [...planningRequests.values()].some(r=>r.id===t.id)
 }))},planningQueue:{phase:planningPhase,searches:planningCalls,queued:orderedExplorerIndices.length,majorSearchesActive:majorSearches.size,cursor:nextExplorerIndex,regions:regionalRoads.size,regionalLookups,regionalCandidatesExamined,negativeScoutCacheHits,negativeScoutEmptySkips,negativeScoutCacheSize:negativeScoutCache.size,regionalMissionQueueSize:regionalMissionQueues.size,regionalMissionQueueHits,regionalMissionQueueBuilds,successorNegativeCacheHits,successorNegativeCacheSize:successorNegativeCache.size,poiCooldownSkips,failedRouteCacheHits,failedRouteSearches,failedRouteCacheSize:failedRouteCache.size,regionalMissionQueueLimit:MAX_REGIONAL_MISSION_QUEUES,reachabilityCacheHits,reachabilityCacheMisses,reachabilityCacheSize:reachabilityCache.size,candidateSelectionMs:Math.round(candidateSelectionMs*10)/10,scoutRoutingMs:Math.round(scoutRoutingMs*10)/10,reachabilityChecks,reachabilitySkips,reachabilityRejected,reachabilityMs:Math.round(reachabilityMs*10)/10,prioritizedCandidates},scoutTimings:scoutTimings.filter(t=>t.ms>=10).sort((a,b)=>b.ms-a.ms).slice(0,8),extensionSkipped,idleSkipped,explorationMissions:{recoveryEvents:explorerRecoveryEvents,active:explorerMissions.size,stalledExplorerReplans,loadedMissionPreservations,invalidMissionRecoveries,parkedExhaustionChecks,pausedExplorerRecoveries,depotReturns,depotRouteFailures,autoParkReactivations,deferredDepotReturns,obsoleteReturnRecoveries,autoParked:autoParkedExplorers.size,paused:taxis.filter(t=>t.kind==='explorer'&&t.status==='PAUSED').length,idlePlans:idleMissionPlans,vehicles:taxis.filter(t=>t.kind==='explorer').map(t=>({id:t.id,role:t.explorerRole??'balanced',status:t.status,pauseReason:t.status==='PAUSED'?(t.deliveryUntil&&t.deliveryUntil>now?'active-rest':t.refillRequested?'refuel':t.serviceDestination?'service':t.refillDestination?'fuel-route':t.recoveryPending?'recovery':energyPercent(t)<=10?'low-energy':explorerWaitingForRoads(t)?'parked-awaiting-roads':t.shiftParked?'scheduled-or-location-rest':t.restStopId?'stale-rest-stop':'unknown'):null,planningAttempts:explorerPlanningAttempts.get(t.id)??0,planningSkipReason:explorerPlanSkipReason.get(t.id)??null,recoveryReason:explorerRecoveryReason.get(t.id)??null,savedRouteHealth:routeHealth.get(t.id)?.state??null,exhaustionProven:explorerExhaustionProof.has(t.id),singleWorkerPlanner:singleWorkerScanResult.get(t.id)??null,
 connectedComponent:explorerComponents.get(t.id)??null,
 startConnectivity:explorerStartIssues.get(t.id)??null,majorRoadSearch:majorRoadSearchDiagnostics.get(t.id)??null,incrementalSearch:majorSearches.has(t.id)?{visits:majorSearches.get(t.id)!.visits,frontier:majorSearches.get(t.id)!.heap.length,targets:majorSearches.get(t.id)!.entries.length,complete:majorSearches.get(t.id)!.complete}:null,idleReason:t.status==='IDLE'?(t.deliveryUntil?'rest':t.refillRequested?'refuel':energyPercent(t)<=10?'low-energy':(idleRetryAt.get(t.id)??0)>now?'retry-cooldown':(explorerSearchTier.get(t.id)??0)>0?'searching-wider':'awaiting-planning'):null,returnReason:t.status==='RETURNING'?(t.serviceDestination?'service':t.refillDestination?'refuel':t.pauseAtHome?'legacy-no-mission':t.shiftParked?'shift-or-parking':'unspecified'):null,missionId:explorerMissions.get(t.id)?.id??null,remainingEdges:Math.max(0,t.edgeIds.length-t.leg),idleMs:t.status==='IDLE'?Math.max(0,now-(idleSince.get(t.id)??now)):0,ferryReady:explorerFerryEligible(t,explorerExhaustionProof.get(t.id),now,
 energyPercent(t),purpleStartNear(t.position,explored)?.node??null,
 seenRoadIds.size,explored.size)&&!majorSearches.has(t.id),retryInMs:Math.max(0,(idleRetryAt.get(t.id)??0)-now),lastPlannedAt:missionPlannedAt.get(t.id)??null})),created:missionCounter,completed:completedExplorerMissions,interrupted:interruptedExplorerMissions,successorsPlanned:successorPlansThisDispatch,lastPlannedAt:Math.max(0,...missionPlannedAt.values())},passengerDispatch:{coverageAttempts,coverageStarts,coverageRoadFailures,
 coverageWaitingJobs,driverPreferenceAssignments,repositioning:taxis.filter(t=>t.status==='REPOSITIONING').length,repositionAttempts:taxiRepositionAttempts,repositionStarts:taxiRepositionSuccesses,repositionRouteFailures:taxiRepositionRouteFailures,mode:taxiMode,unprofitableSkips:taxiUnprofitableSkips,profitableAssignments:taxiProfitableAssignments,estimatedContribution:Math.round(taxiEstimatedContribution*100)/100,allowMission:msg.allowMission,allowTaxiShift:msg.allowTaxiShift,queueLength:queue.length,queueLimit:demand.queueLimit,eligibleStops:eligibleStops.size,depots:regionStates.map(region=>({id:region.id,available:region.available,waiting:region.waiting,limit:region.maxWaiting,localStops:passengerLocalStops.get(region.id)??null})),created:passengerRequestsCreated,requestGenerationFailures:passengerRequestsRejected,assignments:passengerAssignments,routeFailures:passengerRouteFailures,completed:passengerTripsCompleted,regionalCreated:regionalTripsCreated,intercityCreated:intercityTripsCreated,longTripRouteChecks,activeRegional:taxis.filter(t=>t.jobTripType==='regional'&&(t.status==='TO_PICKUP'||t.status==='TO_DROPOFF')).length,activeIntercity:taxis.filter(t=>t.jobTripType==='intercity'&&(t.status==='TO_PICKUP'||t.status==='TO_DROPOFF')).length,vehicles:taxis.filter(t=>!t.kind||t.kind==='taxi').map(t=>({id:t.id,status:t.status,idleMs:t.status==='IDLE'?Math.max(0,now-(idleSince.get(t.id)??now)):0,shiftEligible:msg.allowTaxiShift&&(!msg.availableTaxiIds||msg.availableTaxiIds.includes(t.id)),energyPercent:Math.round(energyPercent(t))}))},passengerIndex:{roads:passengerIndexedRoads.size,stops:passengerEligibleStops.size,rebuilds:passengerIndexRebuilds,added:passengerIndexAdded},discoveryIndex:{updates:discoveryIndexUpdates,rebuilds:discoveryIndexRebuilds,lastMs:Math.round(discoveryIndexLastMs*10)/10,revealedNodes:revealedNodesIndex.size,connectedNodes:connectedFrontierIndex.size,completionRoads:completionRoadsIndex.size,poiRoads:poiRoadsIndex.size}}});
 }catch(error){self.postMessage({type:'error',revision:activeRevision,error:String(error)});}
};
