import {energyPercent} from './energy';
import {demandAt} from './demand';
import {createPassengerRequest,assignPassenger,dispatchScout,route,routeDiscovered,routeToNearestTarget,nearest,meters,trafficTravelSeconds,type RoadGraph,type Taxi,type PassengerRequest,type Point} from './taxi';
let graph:RoadGraph|null=null;
// Two independent exploration planners run outside passenger dispatch.
// Their results are committed by this coordinator only after validating the
// shared discovered network and current route reservations.
type PoolResult={type:'planResult';revision:number;requestId:number;vehicleId:string;
 outcome:string;taxi?:Taxi;roadCount:number;ms:number;error?:string;
 mode?:'idle'|'successor';baseEdgeIds?:string[];};
type PoolMessage=PoolResult|{type:'ready'|'roadsAdded';revision:number;roadCount?:number};
type PoolSlot={worker:Worker;busy:boolean;requestId:number;ready:boolean;roads:number};
const planningPool:PoolSlot[]=[];
const planningRequests=new Map<number,{id:string;at:number;position:Point;exploredCount:number;
 mode:'idle'|'successor';baseEdgeIds?:string[]}>();
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
    planningResults.set(request.id,{...msg,mode:request.mode,baseEdgeIds:request.baseEdgeIds} as PoolResult);
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
let passengerRequestsCreated=0,passengerRequestsRejected=0,passengerAssignments=0,passengerRouteFailures=0;
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
const REGION_DEGREES=0.02;
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
const POI_RETRY_MS=20000;
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
let poiTargetsSignature='';
let poiIndexedRoads=0;
const pendingLoadedExplored=new Set<string>();
// Incremental passenger stop index, independent of the 600k-edge graph scan.
const passengerIndexedRoads=new Set<string>();
const passengerEligibleStops=new Set<string>();
let passengerIndexRebuilds=0;
let passengerIndexAdded=0;
function passengerStopsFor(explored:Set<string>):Set<string>{
 let reset=explored.size<passengerIndexedRoads.size;
 if(!reset&&explored.size===passengerIndexedRoads.size){
  for(const id of passengerIndexedRoads)if(!explored.has(id)){reset=true;break;}
 }
 if(reset){passengerIndexedRoads.clear();passengerEligibleStops.clear();passengerIndexRebuilds++;}
 for(const id of explored){
  if(passengerIndexedRoads.has(id))continue;
  passengerIndexedRoads.add(id);
  const ends=roadEndpoints.get(id);
  if(ends){passengerEligibleStops.add(ends[0]);passengerEligibleStops.add(ends[1]);}
  passengerIndexAdded++;
 }
 return passengerEligibleStops;
}
function updateDiscoveryIndex(g:RoadGraph, explored:Set<string>, hqNode:string|null){
 const started=performance.now();
 let rebuild=explored.size<indexedExplored.size||hqNode!==connectedHqNode;
 if(!rebuild)for(const id of indexedExplored)if(!explored.has(id)){rebuild=true;break;}
 if(rebuild){
  indexedExplored.clear();revealedNodesIndex.clear();completionRoadsIndex.clear();connectedFrontierIndex.clear();
  connectedHqNode=hqNode;discoveryIndexRoads=0;discoveryIndexRebuilds++;
 }
 const touched=new Set<string>();
 for(const node of pendingLoadedExplored){revealedNodesIndex.add(node);touched.add(node);}
 pendingLoadedExplored.clear();
 for(const id of explored)if(!indexedExplored.has(id)){
  indexedExplored.add(id);
  const ends=roadEndpoints.get(id);
  if(ends)for(const node of ends){revealedNodesIndex.add(node);touched.add(node);}
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
  poiTargetsSignature=signature;poiRoadsIndex=new Set();nearestHarbourRoads.clear();poiIndexedRoads=0;poiRoadCursor=0;
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
  }
 }
 poiRoadsIndex=new Set([...nearestHarbourRoads.values()].map(v=>v.id));
 poiRoadCursor=cursor;
 poiIndexedRoads=seenRoadIds.size;
}

const roadRole=(h:string)=>h==='motorway'||h==='motorway_link'?'motorway':h==='trunk'||h==='trunk_link'?'trunk':h==='primary'||h==='primary_link'?'primary':h==='secondary'||h==='secondary_link'?'secondary':h==='tertiary'||h==='tertiary_link'?'tertiary':h==='residential'||h==='living_street'?'residential':h==='unclassified'||h==='track'||h==='road'?'rural':h==='service'?'service':null;
type Init={type:'init';revision:number};
type AddRoads={type:'addRoads';revision:number;roads:import('../data/roadTiles').RoadSegment[]};
const idleFallbackAt=new Map<string,number>();
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

let poiRoadCursor=0;
// A failed scout permits the next road class to bootstrap without motorway access.

type OperationalRouteRequest={type:'operationalRoute';revision:number;requestId:number;vehicleId:string;purpose:'shift'|'service';from:Point;targets:Point[]};
type FuelPlanRequest={type:'fuelPlan';revision:number;requestId:number;vehicleId:string;from:Point;targets:{point:Point;depot:boolean}[]};
type RouteRequest={type:'routeRequest';revision:number;requestId:number;from:Point;to:Point;discoveredOnly?:boolean};
type Dispatch={type:'dispatch';revision:number;now:number;taxis:Taxi[];queue:PassengerRequest[];discovered:string[];hq:Point;allowMission:boolean;allowTaxiShift:boolean;allowScout:boolean;stations?:Point[];poiTargets?:Point[];harbourTargets?:Point[];availableTaxiIds?:string[]};
self.onmessage=async(event:MessageEvent<Init|Dispatch|AddRoads|RouteRequest|FuelPlanRequest|OperationalRouteRequest>)=>{
 const msg=event.data;
 try{
  if(msg.type==='init'){
   idleSince.clear();majorSearches.clear();majorRoadSearchDiagnostics.clear();explorerPlanningAttempts.clear();explorerLastPlanAttempt.clear();explorerLastConsidered.clear();explorerPlanSkipReason.clear();explorerConsiderationSequence=0;passengerRequestsCreated=0;passengerRequestsRejected=0;passengerAssignments=0;passengerRouteFailures=0;passengerCompletedByTaxi.clear();passengerTripsCompleted=0;nextExplorerIndex=0;regionalRoads.clear();autoParkedExplorers.clear();failedRouteCache.clear();reachabilityCache.clear();regionalCellVersions.clear();regionalMissionQueues.clear();regionalQueueVersions.clear();poiRetryWallClock.clear();poiCooldownSkips=0;regionalMissionQueueHits=0;regionalMissionQueueBuilds=0;successorNegativeCache.clear();successorNegativeCacheHits=0;explorerSearchTier.clear();negativeScoutCache.clear();negativeScoutCacheHits=0;negativeScoutEmptySkips=0;regionalLookups=0;regionalCandidatesExamined=0;idleFallbackAt.clear();missionSequence.clear();missionPlannedAt.clear();missionLastEndpoint.clear();explorerMissions.clear();completedExplorerMissions=0;interruptedExplorerMissions=0;missionCounter=0;extensionRetryAt.clear();extensionLastDestination.clear();idleRetryAt.clear();idleRetryRoadCount.clear();idleRetryExploredCount.clear();idleRetryPosition.clear();poiRoadCursor=0;byClass.clear();allRoads.clear();classifiedRoads.clear();roadEndpoints.clear();roadInsertionOrder.length=0;roadClassCache.clear();indexedExplored.clear();revealedNodesIndex.clear();completionRoadsIndex.clear();connectedFrontierIndex.clear();connectedHqNode=null;discoveryIndexRoads=0;discoveryIndexUpdates=0;discoveryIndexRebuilds=0;discoveryIndexLastMs=0;poiRoadsIndex.clear();nearestHarbourRoads.clear();poiTargetsSignature='';poiIndexedRoads=0;pendingLoadedExplored.clear();passengerIndexedRoads.clear();passengerEligibleStops.clear();passengerIndexRebuilds=0;passengerIndexAdded=0;
   graph={nodes:new Map(),edges:new Map(),nodeKeys:[]};seenRoadIds.clear();activeRevision=msg.revision;
   startPlanningPool(activeRevision);
   self.postMessage({type:'ready',revision:activeRevision});return;
  }
  if(!graph||msg.revision!==activeRevision)return;
  if(msg.type==='addRoads'){
   for(const road of msg.roads){
    if(road.coordinates?.length!==2||!Number.isFinite(road.length)||road.length<=0||seenRoadIds.has(road.id))continue;
    seenRoadIds.add(road.id);
    allRoads.add(road.id);
    const role=roadRole(road.highway??'');
    if(role){let ids=byClass.get(role);if(!ids){ids=new Set();byClass.set(role,ids);}ids.add(road.id);classifiedRoads.add(road.id);}
    const a=String(road.a),b=String(road.b);
    roadEndpoints.set(road.id,[a,b]);roadInsertionOrder.push(road.id);
    indexRegionalRoad(road.id,road.coordinates[0],road.coordinates[1]);
    if(indexedExplored.has(road.id)){pendingLoadedExplored.add(a);pendingLoadedExplored.add(b);}
    if(passengerIndexedRoads.has(road.id)){passengerEligibleStops.add(a);passengerEligibleStops.add(b);}
    if(!graph.nodes.has(a)){graph.nodes.set(a,road.coordinates[0]);graph.nodeKeys.push(a);}
    if(!graph.nodes.has(b)){graph.nodes.set(b,road.coordinates[1]);graph.nodeKeys.push(b);}
    const add=(from:string,to:string)=>{
     let list=graph!.edges.get(from);
     if(!list){list=[];graph!.edges.set(from,list);}
     list.push({to,meters:road.length,id:road.id,speedKph:road.speed,highway:road.highway});
    };
    if(road.oneway!==-1)add(a,b);
    if(road.oneway!==1)add(b,a);
   }
   roadClassCache.clear();
   // Ordered posts guarantee each planner receives the same incremental road
   // graph before its subsequent route request.
   for(const slot of planningPool)slot.worker.postMessage({type:'addRoads',revision:activeRevision,roads:msg.roads});
   self.postMessage({type:'roadsAdded',revision:activeRevision,roadCount:seenRoadIds.size});return;
  }
  if(msg.type==='operationalRoute'){
   const started=performance.now();
   const from=nearest(graph,msg.from);
   let planned:{path:Point[];edgeIds:string[]}|null=null;
   // Preserve target order: break stations are preferred over the depot.
   for(const target of msg.targets){
    const to=nearest(graph,target);
    if(!from||!to)continue;
    planned=route(graph,from,to);
    if(planned)break;
   }
   self.postMessage({type:'operationalRouteResult',revision:activeRevision,requestId:msg.requestId,vehicleId:msg.vehicleId,purpose:msg.purpose,path:planned?.path??null,edgeIds:planned?.edgeIds??null,durationMs:performance.now()-started});
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
   const result=from?routeToNearestTarget(graph,from,targets):null;
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
   const planned=from&&to?(msg.discoveredOnly?routeDiscovered(graph,from,to,indexedExplored):route(graph,from,to)):null;
   self.postMessage({type:'routeResult',revision:activeRevision,requestId:msg.requestId,from:msg.from,to:msg.to,path:planned?.path??null,edgeIds:planned?.edgeIds??null,durationMs:performance.now()-started});
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
  const explored=new Set(msg.discovered);
  // Resting explorers remain parked until the main simulation releases them.
  const taxis=msg.taxis.map(t=>{
   if(t.ferryTrip)return t; // Main thread owns paid ferry travel.
   // Legacy automatic depot returns carry pauseAtHome. Preserve operational trips.
   if(t.kind==='explorer'&&t.status==='RETURNING'&&t.pauseAtHome&&
      !t.serviceDestination&&!t.refillDestination&&!t.recoveryPending&&!t.refillRequested&&
      !(t.deliveryUntil&&t.deliveryUntil>now)){
    // Stale rest-stop references and expired rest timers can survive older saves.
    // Only a currently active rest timer should block legacy return recovery.
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
  // Purple Explorer's driven roads are valid for taxi jobs regardless of Black Explorer territory.
  const validDiscovered=explored;
  const eligibleStops=passengerStopsFor(validDiscovered);
  const queue=msg.queue.filter(m=>m.expiresAt>now&&eligibleStops.has(nearest(activeGraph,m.pickup))&&eligibleStops.has(nearest(activeGraph,m.dropoff)));
  let generatedMission=false;
  const passengerTaxis=taxis.filter(t=>(!t.kind||t.kind==='taxi'));
  const demand=demandAt(now,passengerTaxis.length);
  if(msg.allowMission&&queue.length<demand.queueLimit){
   const request=createPassengerRequest(graph,validDiscovered,hq,now,demand.fareMultiplier,eligibleStops);
   if(request){queue.push(request);generatedMission=true;passengerRequestsCreated++;}else passengerRequestsRejected++;
  }
  const preparationMs=performance.now()-dispatchStarted;
  const passengerStarted=performance.now();
  // Prioritise older waiting passengers, then choose the fastest reachable taxi.
  // Evaluate actual discovered-road routes, never straight-line proximity alone.
  queue.sort((a,b)=>a.createdAt-b.createdAt);
  const pending:PassengerRequest[]=[];
  for(const mission of queue){
   let best:{index:number;taxi:Taxi;etaSeconds:number}|null=null;
   for(let index=0;index<taxis.length;index++){
    const taxi=taxis[index];
    if(!msg.allowTaxiShift||(msg.availableTaxiIds&&!msg.availableTaxiIds.includes(taxi.id))||(taxi.kind&&taxi.kind!=='taxi')||taxi.status!=='IDLE'||taxi.deliveryUntil||taxi.refillRequested||energyPercent(taxi)<=10)continue;
    const assigned=assignPassenger(taxi,activeGraph,mission,validDiscovered,eligibleStops);
    if(!assigned){passengerRouteFailures++;continue;}
    let etaSeconds=0;
    for(let j=0;j<assigned.edgeIds.length;j++){
     const from=nearest(activeGraph,assigned.path[j]);
     const to=nearest(activeGraph,assigned.path[j+1]);
     const edge=activeGraph.edges.get(from)?.find(e=>e.to===to&&e.id===assigned.edgeIds[j]);
     const distance=edge?.meters??meters(assigned.path[j],assigned.path[j+1]);
     etaSeconds+=trafficTravelSeconds(distance,edge?.speedKph??50,now);
    }
    // Include approximate time to accelerate from a stop.
    etaSeconds+=Math.min(12,assigned.edgeIds.length*0.5+4);
    if(!best||etaSeconds<best.etaSeconds)best={index,taxi:assigned,etaSeconds};
   }
   if(best){taxis[best.index]=best.taxi;passengerAssignments++;idleSince.delete(best.taxi.id);}
   else pending.push(mission);
  }
  queue.length=0;queue.push(...pending);
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
   const completionRoads=completionRoadsIndex;
   const poiTargets=(msg.poiTargets?.length?msg.poiTargets:msg.harbourTargets??[]).slice(0,150);
   updatePoiIndex(graph,poiTargets);
   const poiRoads=poiRoadsIndex;
   const frontierFor=(_taxi:Taxi):Set<string>|undefined=>undefined;
   const discoveryRoads=(taxi:Taxi)=>{
    const role=taxi.explorerRole;
    if(role==='balanced'||!role)return allRoads;
    if(role==='poi')return poiRoads;
    if(role==='completion')return completionRoads;
    // Each specialist discovers ONLY its own road classes, while all may
    // travel along already-purple roads to reach their next target.
    if(role==='highway'||role==='urban'||role==='primary'||role==='secondary'||role==='residential'){
     const cached=roadClassCache.get(role);if(cached)return cached;
     const roles=role==='highway'?['motorway','trunk']:
      role==='primary'?['primary']:
      role==='secondary'?['secondary','tertiary']:
      role==='residential'?['residential','rural','service']:
      ['tertiary','residential','rural','service'];
     const combined=new Set<string>();
     for(const key of roles)for(const id of byClass.get(key)??[])combined.add(id);
     roadClassCache.set(role,combined);return combined;
    }
    return byClass.get(role??'')??new Set<string>();
   };
   // Only wake auto-parked explorers when eligible roads are undiscovered.
   for(let i=0;i<taxis.length;i++){
    const t=taxis[i],parked=autoParkedExplorers.get(t.id);
    if(t.kind!=='explorer'||t.ferryTrip||t.status!=='PAUSED')continue;
     // Older saves retain shiftParked without the worker-only autoPark map.
     // Recover only at-home explorers with no operational rest/service/refuel obligation.
     const legacyParked=!parked&&t.shiftParked;
     if(!parked&&!legacyParked)continue;
     // Only active operational obligations keep a parked explorer paused.
     // Saved restStopId and expired timers do not imply an ongoing break.
     if((t.deliveryUntil&&t.deliveryUntil>now)||t.refillRequested||t.serviceDestination||t.refillDestination||t.recoveryPending||energyPercent(t)<=10)continue;
     if(parked&&parked.roads===seenRoadIds.size&&parked.explored===explored.size)continue;
    let available=false;
    for(const id of discoveryRoads(t)){if(!explored.has(id)){available=true;break;}}
    if(!available)continue;
    taxis[i]={...t,status:'IDLE',shiftParked:false,pauseAtHome:false,restStopId:undefined,path:[],edgeIds:[],leg:0,distanceIntoLeg:0,speedKph:0};
    autoParkedExplorers.delete(t.id);autoParkReactivations++;
   }
   // Trim any previously assigned Explorer route at the first forbidden edge.
   // Do this before reserving routes or extending them, so stale assignments
   // cannot carry a vehicle beyond the current taxi-revealed boundary.
   for(let index=0;index<taxis.length;index++){
    const taxi=taxis[index];
    if((taxi.kind!=='explorer')||taxi.status!=='EXPLORING')continue;
    const permitted=taxi.kind==='explorer'?purpleAllowedRoads:allowedRoads;
    const discoveryAssignment=new Set(taxi.discoveryEdgeIds??[]);
     const startNode=taxi.path[0]?nearest(graph,taxi.path[0]):'';
     // Saved missions from older builds may start on isolated red roads.
     // Keep only routes that start from an actual discovered junction, and
     // never transit an undiscovered edge unless this mission discovers it.
     const invalidStart=!!startNode&&!revealedNodesIndex.has(startNode);
     const firstForbidden=invalidStart?taxi.leg:taxi.edgeIds.findIndex((id,i)=>i>=taxi.leg&&
      (!permitted.has(id)||(!explored.has(id)&&!discoveryAssignment.has(id))));
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
   // Stranded idle Explorers return to the nearest reachable permitted road.
   // Returning never discovers roads or reveals territory.
   // All indexed graph edges are permitted transit roads.
   const permittedNodes=graph.nodes;
   for(let index=0;index<taxis.length;index++){
    const taxi=taxis[index];
    if((taxi.kind!=='explorer')||taxi.status!=='IDLE'||taxi.deliveryUntil||taxi.refillRequested||energyPercent(taxi)<=10)continue;
    const start=nearest(graph,taxi.position);
    if(!start||permittedNodes.has(start))continue;
    const candidates=[...permittedNodes.keys()].map(k=>({k,d:meters(taxi.position,graph!.nodes.get(k)!)}))
     .sort((a,b)=>a.d-b.d).slice(0,12);
    for(const candidate of candidates){
     const home=route(graph,start,candidate.k);
     if(!home||home.path.length<2)continue;
     taxis[index]={...taxi,status:'RETURNING',path:home.path,edgeIds:home.edgeIds,
      leg:0,distanceIntoLeg:0,journeyEdges:[]};
     break;
    }
   }
   const reservedTargets=new Set<string>();
   const reservedEdges=new Set<string>();
   // Existing scouts reserve their remaining route, so new scouts avoid following them.
   for(const taxi of taxis){
    if(taxi.status!=='EXPLORING')continue;
    const destination=taxi.path.at(-1);
    if(destination){const target=nearest(graph,destination);if(target)reservedTargets.add(target);}
    for(const edge of taxi.edgeIds.slice(taxi.leg))reservedEdges.add(edge);
   }
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
    if((taxi.kind!=='explorer')||taxi.status!=='EXPLORING'||taxi.deliveryUntil)continue;

    const remaining=taxi.path.length-1-taxi.leg;
    // Request the next route earlier to reduce waits at the final junction.
    if(remaining>MISSION_LOOKAHEAD_EDGES||!taxi.path.length)continue;
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
    reservedTargets.delete(from);
    const purpleCluster=purpleAllowedRoads;
    if(taxi.kind==='explorer'&&!purpleCluster)continue;
    const extensionStarted=performance.now();
    const extensionCandidates=preferConnectedCandidates(graph,destination,prioritizeScoutCandidates(graph,destination,regionalCandidates(destination,discoveryRoads(taxi),explored,reservedEdges,SEARCH_RADII_KM[extensionTier],taxi.explorerRole??'balanced')),taxi.explorerRole??'balanced');
    candidateSelectionMs+=performance.now()-extensionStarted;
    // No eligible undiscovered roads in this tier: skip the costly route
    // search, and try a wider tier on the next successor planning turn.
    if(extensionCandidates.size===0){
     negativeScoutEmptySkips++;
     successorNegativeCache.set(taxi.id,{signature:extensionSignature,until:performance.now()+EXTENSION_RETRY_MS});
     explorerSearchTier.set(taxi.id,Math.min(extensionTier+1,SEARCH_RADII_KM.length-1));
     continue;
    }
    const extensionRouteStarted=performance.now();
    // Successor planning starts at the end of the current mission. The last
    // junction may still be undiscovered because the explorer is driving
    // towards it. Project only THIS explorer's committed discovery edges for
    // route planning, without changing the actual saved discovery network.
    const projectedExplored=new Set(explored);
    const projectedRevealed=new Set(revealedNodes);
    // This explorer may reuse its own committed roads as transit, while
    // other vehicles' reservations remain off limits.
    const successorReservations=new Set(reservedEdges);
    for(const id of taxi.edgeIds.slice(taxi.leg))successorReservations.delete(id);
    for(const id of taxi.discoveryEdgeIds??[]){
     if(projectedExplored.has(id))continue;
     projectedExplored.add(id);
     const ends=roadEndpoints.get(id);
     if(ends){projectedRevealed.add(ends[0]);projectedRevealed.add(ends[1]);}
    }
    const extension=await dispatchScout({...taxi,status:'IDLE',position:destination,path:[],edgeIds:[],leg:0,distanceIntoLeg:0},
     graph,projectedExplored,hq,reservedTargets,successorReservations,undefined,purpleAllowedRoads,discoveryRoads(taxi),undefined,taxi.path.length>1?(nearest(graph,taxi.path[taxi.path.length-2])??undefined):undefined,undefined,poiTargets,undefined,projectedRevealed,()=>msg.revision===activeRevision,extensionCandidates);
    if(msg.revision!==activeRevision)return;
    scoutRoutingMs+=performance.now()-extensionRouteStarted;
   scoutTimings.push({vehicleId:taxi.id,role:taxi.explorerRole??'',ms:Math.round(performance.now()-extensionStarted),phase:'extension',result:extension.status});
    if(extension.status!=='EXPLORING'||extension.path.length<2){failedRouteSearches++;failedRouteCache.set('successor|'+taxi.id,{signature:failureSignature,until:performance.now()+FAILED_ROUTE_RETRY_MS});successorNegativeCache.set(taxi.id,{signature:extensionSignature,until:performance.now()+EXTENSION_RETRY_MS});explorerSearchTier.set(taxi.id,Math.min(extensionTier+1,SEARCH_RADII_KM.length-1));continue;}
    explorerSearchTier.set(taxi.id,0);
    successorNegativeCache.delete(taxi.id);failedRouteCache.delete('successor|'+taxi.id);
    // The nearest node at the destination must match the new route's start.
    if(extension.path[0][0]!==destination[0]||extension.path[0][1]!==destination[1])continue;
    missionLastEndpoint.set(taxi.id,destinationKey);
    // The appended successor becomes the committed mission destination.
    recordExplorerMission({...taxi,path:[...taxi.path,...extension.path.slice(1)],edgeIds:[...taxi.edgeIds,...extension.edgeIds]},now);
    missionSequence.set(taxi.id,(missionSequence.get(taxi.id)??0)+1);
    missionPlannedAt.set(taxi.id,now);
    taxis[index]={...taxi,path:[...taxi.path,...extension.path.slice(1)],
     edgeIds:[...taxi.edgeIds,...extension.edgeIds],discoveryEdgeIds:[...(taxi.discoveryEdgeIds??taxi.edgeIds),...(extension.discoveryEdgeIds??[])],scoutingRuns:extension.scoutingRuns};
    assignedCount++;
   }
   // Reserve three of four route-planning slots for idle explorers.
   // Fairness is maintained by oldest consideration rather than fleet order.
   const idleOrder=[...orderedExplorerIndices].sort((a,b)=>
    (explorerLastConsidered.get(taxis[a].id)??0)-(explorerLastConsidered.get(taxis[b].id)??0));
   for(const index of idleOrder){
    const idleVehicle=taxis[index];
    if(idleVehicle.kind!=='explorer'||idleVehicle.ferryTrip||idleVehicle.status!=='IDLE')continue;
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
    // Indexed POIs form a small target set; never discard a reachable
    // harbour/facility road just because a nearer POI is disconnected.
    const candidates=continuingMajorSearch
     ?new Set<string>(existingMajorSearch!.entries.map(entry=>entry.id))
     :idleVehicle.explorerRole==='poi'
      ?new Set([...discoveryRoads(idleVehicle)].filter(id=>!explored.has(id)&&!reservedEdges.has(id)))
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
    const majorRoad=idleVehicle.explorerRole==='motorway'||idleVehicle.explorerRole==='trunk'||idleVehicle.explorerRole==='poi';
    const targeted=majorRoad?targetMajorRoadMission(idleVehicle,graph,candidates,explored,reservedTargets,reservedEdges,discoveryRoads(idleVehicle).size):null;
    // Search-budget exhaustion is inconclusive. Do not immediately repeat
    // another large graph search with dispatchScout in the same dispatch.
    const majorStats=majorRoadSearchDiagnostics.get(idleVehicle.id);
    const scout=targeted??(majorRoad&&majorStats?.outcome==='search-in-progress'
     ?idleVehicle
     :await dispatchScout(taxis[index],graph,explored,hq,reservedTargets,reservedEdges,undefined,purpleAllowedRoads,discoveryRoads(taxis[index]),undefined,undefined,undefined,poiTargets,frontierFor(taxis[index]),revealedNodes,()=>msg.revision===activeRevision,candidates));
    if(msg.revision!==activeRevision)return;
    scoutRoutingMs+=performance.now()-scoutRouteStarted;
   scoutTimings.push({vehicleId:taxis[index].id,role:taxis[index].explorerRole??'',ms:Math.round(performance.now()-idleStarted),phase:'idle',result:scout.status});
    let assignment=scout;
    // No immediate second expensive search: retry in a later planning turn.
    if(assignment.status!=='IDLE'){
     explorerSearchTier.set(idleVehicle.id,0);
     negativeScoutCache.delete(idleVehicle.id);failedRouteCache.delete('idle|'+idleVehicle.id);
     idleRetryAt.delete(idleVehicle.id);poiRetryWallClock.delete(idleVehicle.id);
     taxis[index]=assignment;autoParkedExplorers.delete(idleVehicle.id);
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
      if(idleVehicle.explorerRole==='poi')poiRetryWallClock.set(idleVehicle.id,{until:performance.now()+POI_RETRY_MS,roadCount:seenRoadIds.size,poiSignature:poiTargetsSignature});
      negativeScoutCache.set(idleVehicle.id,{signature,until:now+NEGATIVE_SCOUT_TTL_MS});
     explorerSearchTier.set(idleVehicle.id,Math.min(tier+1,SEARCH_RADII_KM.length-1));
     idleRetryAt.set(idleVehicle.id,now+(idleVehicle.explorerRole==='poi'?POI_RETRY_MS:IDLE_RETRY_MS));
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
   const poiTargets=(msg.poiTargets?.length?msg.poiTargets:msg.harbourTargets??[]).slice(0,150);
   updatePoiIndex(graph,poiTargets);
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
    if(proposal.outcome!=='planned'||!proposal.taxi)continue;
    const route=proposal.taxi;
    const append=proposal.mode==='successor'&&current.status==='EXPLORING'&&
     !!proposal.baseEdgeIds&&proposal.baseEdgeIds.length===current.edgeIds.length&&
     proposal.baseEdgeIds.every((id,i)=>current.edgeIds[i]===id);
    if(current.status!=='IDLE'&&!append){reject('vehicle-no-longer-idle');continue;}
    const origin=append?current.path.at(-1):current.position;
    if(!origin||!route.path.length||meters(origin,route.path[0])>20||
       route.edgeIds.length!==route.path.length-1){reject('route-start-or-shape');continue;}
    const projected=append?new Set([...explored,...current.discoveryEdgeIds??[]]):explored;
    const startNode=nearest(graph,origin);
    if(!startNode||!(graph.edges.get(startNode)??[]).some(e=>projected.has(e.id))){reject('no-purple-departure');continue;}
    const selected=new Set(route.discoveryEdgeIds??[]);
    const valid=route.edgeIds.every(id=>allRoads.has(id)&&
     (projected.has(id)||selected.has(id)));
    if(!valid||![...selected].every(id=>!projected.has(id)&&!reservedEdges.has(id))){reject('reservation-or-unrevealed-transit');continue;}
    const end=nearest(graph,route.path.at(-1)!);
    if(end&&reservedTargets.has(end)&&
       (!append||end!==nearest(graph,current.path.at(-1)!))){reject('reserved-destination');continue;}
    const next:Taxi=append?{...current,
     path:[...current.path,...route.path.slice(1)],
     edgeIds:[...current.edgeIds,...route.edgeIds],
     discoveryEdgeIds:[...(current.discoveryEdgeIds??[]),...(route.discoveryEdgeIds??[])],
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
   for(const slot of planningPool){
    if(!slot.ready||slot.busy||slot.roads===0)continue;
    const vehicle=explorers.shift();
    if(!vehicle)break;
    const start=nearest(graph,vehicle.position);
    if(!start||!(graph.edges.get(start)??[]).some(edge=>explored.has(edge.id))){
     explorerPlanSkipReason.set(vehicle.id,'no-purple-start');continue;
    }
    slot.busy=true;
    const requestId=++nextPlanningRequest;
    slot.requestId=requestId;
    planningRequests.set(requestId,{id:vehicle.id,at:performance.now(),position:vehicle.position,exploredCount:explored.size,mode:'idle'});
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
   // Only spend otherwise unused pool capacity on route extensions. Idle
   // specialists always take precedence over moving explorers' lookahead.
   if(explorers.length===0){
    const moving=taxis.filter(t=>t.kind==='explorer'&&t.status==='EXPLORING'&&
     !t.ferryTrip&&!t.deliveryUntil&&t.path.length>=2&&
     t.edgeIds.length-t.leg<=10&&!inFlight.has(t.id)&&
     (!planningBackoff.has(t.id)||planningBackoff.get(t.id)!.until<=performance.now()||
      planningBackoff.get(t.id)!.roads!==seenRoadIds.size||
      planningBackoff.get(t.id)!.explored!==explored.size));
    moving.sort((a,b)=>(planningLastSent.get(a.id)??0)-(planningLastSent.get(b.id)??0));
    for(const slot of planningPool){
     if(!slot.ready||slot.busy||slot.roads===0)continue;
     const vehicle=moving.shift();
     if(!vehicle)break;
     const destination=vehicle.path.at(-1);
     if(!destination)continue;
     const projected=new Set([...explored,...vehicle.discoveryEdgeIds??[]]);
     const endNode=nearest(graph,destination);
     if(!endNode||!(graph.edges.get(endNode)??[]).some(e=>projected.has(e.id)))continue;
     const requestId=++nextPlanningRequest;
     slot.busy=true;slot.requestId=requestId;
     planningRequests.set(requestId,{id:vehicle.id,at:performance.now(),
      position:destination,exploredCount:explored.size,mode:'successor',
      baseEdgeIds:vehicle.edgeIds.slice()});
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
 }))},planningQueue:{phase:planningPhase,searches:planningCalls,queued:orderedExplorerIndices.length,majorSearchesActive:majorSearches.size,cursor:nextExplorerIndex,regions:regionalRoads.size,regionalLookups,regionalCandidatesExamined,negativeScoutCacheHits,negativeScoutEmptySkips,negativeScoutCacheSize:negativeScoutCache.size,regionalMissionQueueSize:regionalMissionQueues.size,regionalMissionQueueHits,regionalMissionQueueBuilds,successorNegativeCacheHits,successorNegativeCacheSize:successorNegativeCache.size,poiCooldownSkips,failedRouteCacheHits,failedRouteSearches,failedRouteCacheSize:failedRouteCache.size,regionalMissionQueueLimit:MAX_REGIONAL_MISSION_QUEUES,reachabilityCacheHits,reachabilityCacheMisses,reachabilityCacheSize:reachabilityCache.size,candidateSelectionMs:Math.round(candidateSelectionMs*10)/10,scoutRoutingMs:Math.round(scoutRoutingMs*10)/10,reachabilityChecks,reachabilitySkips,reachabilityRejected,reachabilityMs:Math.round(reachabilityMs*10)/10,prioritizedCandidates},scoutTimings:scoutTimings.filter(t=>t.ms>=10).sort((a,b)=>b.ms-a.ms).slice(0,8),extensionSkipped,idleSkipped,explorationMissions:{active:explorerMissions.size,pausedExplorerRecoveries,depotReturns,depotRouteFailures,autoParkReactivations,deferredDepotReturns,obsoleteReturnRecoveries,autoParked:autoParkedExplorers.size,paused:taxis.filter(t=>t.kind==='explorer'&&t.status==='PAUSED').length,idlePlans:idleMissionPlans,vehicles:taxis.filter(t=>t.kind==='explorer').map(t=>({id:t.id,role:t.explorerRole??'balanced',status:t.status,pauseReason:t.status==='PAUSED'?(t.deliveryUntil&&t.deliveryUntil>now?'active-rest':t.refillRequested?'refuel':t.serviceDestination?'service':t.refillDestination?'fuel-route':t.recoveryPending?'recovery':energyPercent(t)<=10?'low-energy':t.shiftParked?'parked-awaiting-roads':t.restStopId?'stale-rest-stop':'unknown'):null,planningAttempts:explorerPlanningAttempts.get(t.id)??0,planningSkipReason:explorerPlanSkipReason.get(t.id)??null,majorRoadSearch:majorRoadSearchDiagnostics.get(t.id)??null,incrementalSearch:majorSearches.has(t.id)?{visits:majorSearches.get(t.id)!.visits,frontier:majorSearches.get(t.id)!.heap.length,targets:majorSearches.get(t.id)!.entries.length,complete:majorSearches.get(t.id)!.complete}:null,idleReason:t.status==='IDLE'?(t.deliveryUntil?'rest':t.refillRequested?'refuel':energyPercent(t)<=10?'low-energy':(idleRetryAt.get(t.id)??0)>now?'retry-cooldown':(explorerSearchTier.get(t.id)??0)>0?'searching-wider':'awaiting-planning'):null,returnReason:t.status==='RETURNING'?(t.serviceDestination?'service':t.refillDestination?'refuel':t.pauseAtHome?'legacy-no-mission':t.shiftParked?'shift-or-parking':'unspecified'):null,missionId:explorerMissions.get(t.id)?.id??null,remainingEdges:Math.max(0,t.edgeIds.length-t.leg),idleMs:t.status==='IDLE'?Math.max(0,now-(idleSince.get(t.id)??now)):0,ferryReady:!t.ferryTrip&&t.status==='IDLE'&&(explorerSearchTier.get(t.id)??0)>=SEARCH_RADII_KM.length-1&&!majorSearches.has(t.id)&&(explorerPlanningAttempts.get(t.id)??0)>0,retryInMs:Math.max(0,(idleRetryAt.get(t.id)??0)-now),lastPlannedAt:missionPlannedAt.get(t.id)??null})),created:missionCounter,completed:completedExplorerMissions,interrupted:interruptedExplorerMissions,successorsPlanned:successorPlansThisDispatch,lastPlannedAt:Math.max(0,...missionPlannedAt.values())},passengerDispatch:{allowMission:msg.allowMission,allowTaxiShift:msg.allowTaxiShift,queueLength:queue.length,queueLimit:demand.queueLimit,eligibleStops:eligibleStops.size,created:passengerRequestsCreated,requestGenerationFailures:passengerRequestsRejected,assignments:passengerAssignments,routeFailures:passengerRouteFailures,completed:passengerTripsCompleted,vehicles:taxis.filter(t=>!t.kind||t.kind==='taxi').map(t=>({id:t.id,status:t.status,idleMs:t.status==='IDLE'?Math.max(0,now-(idleSince.get(t.id)??now)):0,shiftEligible:msg.allowTaxiShift&&(!msg.availableTaxiIds||msg.availableTaxiIds.includes(t.id)),energyPercent:Math.round(energyPercent(t))}))},passengerIndex:{roads:passengerIndexedRoads.size,stops:passengerEligibleStops.size,rebuilds:passengerIndexRebuilds,added:passengerIndexAdded},discoveryIndex:{updates:discoveryIndexUpdates,rebuilds:discoveryIndexRebuilds,lastMs:Math.round(discoveryIndexLastMs*10)/10,revealedNodes:revealedNodesIndex.size,connectedNodes:connectedFrontierIndex.size,completionRoads:completionRoadsIndex.size,poiRoads:poiRoadsIndex.size}}});
 }catch(error){self.postMessage({type:'error',revision:activeRevision,error:String(error)});}
};
