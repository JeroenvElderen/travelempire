import {energyPercent} from './energy';
import {demandAt} from './demand';
import {createPassengerRequest,assignPassenger,dispatchScout,route,routeToNearestTarget,nearest,meters,trafficTravelSeconds,type RoadGraph,type Taxi,type PassengerRequest,type Point} from './taxi';
let graph:RoadGraph|null=null;
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
const regionalMissionQueues=new Map<string,{roadCount:number;ids:Set<string>}>();
const MAX_REGIONAL_MISSION_QUEUES=900;
let regionalMissionQueueHits=0,regionalMissionQueueBuilds=0;
const successorNegativeCache=new Map<string,{signature:string;until:number}>();
let successorNegativeCacheHits=0;
const POI_RETRY_MS=20000;
const poiRetryWallClock=new Map<string,{until:number;roadCount:number;poiSignature:string}>();
let poiCooldownSkips=0;
const regionKey=(lat:number,lon:number)=>lat+':'+lon;
function indexRegionalRoad(id:string,a:Point,b:Point):void{
 const keys=new Set([a,b].map(p=>regionKey(Math.floor(p[1]/REGION_DEGREES),Math.floor(p[0]/REGION_DEGREES))));
 for(const key of keys){let bucket=regionalRoads.get(key);if(!bucket){bucket=new Set();regionalRoads.set(key,bucket);}bucket.add(id);}
}
function regionalCandidates(position:Point,eligible:Set<string>,explored:Set<string>,reserved:Set<string>,radiusKm:number,role='balanced'):Set<string>{
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
  const cell=regionKey(lat,lon),key=role+'|'+cell;
  let queue=regionalMissionQueues.get(key);
  if(!queue||queue.roadCount!==seenRoadIds.size){
   const ids=new Set<string>();
   for(const id of regionalRoads.get(cell)??[])if(eligible.has(id))ids.add(id);
   queue={roadCount:seenRoadIds.size,ids};
   regionalMissionQueues.delete(key);regionalMissionQueues.set(key,queue);regionalMissionQueueBuilds++;
    if(regionalMissionQueues.size>MAX_REGIONAL_MISSION_QUEUES){const oldest=regionalMissionQueues.keys().next().value;if(oldest!==undefined)regionalMissionQueues.delete(oldest);}
  }else regionalMissionQueueHits++;
  for(const id of queue.ids)if(eligible.has(id)&&!explored.has(id)&&!reserved.has(id))result.add(id);
 }
 regionalCandidatesExamined+=result.size;
 return result;
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
   if(ends&&!classifiedRoads.has(id)&&!indexedExplored.has(id)&&revealedNodesIndex.has(ends[0])&&revealedNodesIndex.has(ends[1]))completionRoadsIndex.add(id);
  }
  discoveryIndexRoads=seenRoadIds.size;
 }
 for(const node of touched)for(const edge of g.edges.get(node)??[]){
  if(classifiedRoads.has(edge.id))continue;
  if(indexedExplored.has(edge.id))completionRoadsIndex.delete(edge.id);
  else if(revealedNodesIndex.has(edge.to))completionRoadsIndex.add(edge.id);
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
  poiTargetsSignature=signature;poiRoadsIndex=new Set();poiIndexedRoads=0;poiRoadCursor=0;
 }
 if(!targets.length)return;
 if(poiIndexedRoads===seenRoadIds.size)return;
 // A new road tile should not cause repeated nationwide POI scans.
 let cursor=poiRoadCursor;
 for(;cursor<roadInsertionOrder.length;cursor++){
  const id=roadInsertionOrder[cursor],ends=roadEndpoints.get(id);
  if(!ends)continue;
  if(classifiedRoads.has(id))continue;
  const a=g.nodes.get(ends[0]),b=g.nodes.get(ends[1]);
  if((a&&targets.some(p=>meters(a,p)<600))||(b&&targets.some(p=>meters(b,p)<600)))poiRoadsIndex.add(id);
 }
 poiRoadCursor=cursor;
 poiIndexedRoads=seenRoadIds.size;
}

const roadRole=(h:string)=>h==='motorway'||h==='motorway_link'?'motorway':h==='trunk'||h==='trunk_link'?'trunk':h==='primary'||h==='primary_link'?'primary':h==='secondary'||h==='secondary_link'?'secondary':h==='tertiary'||h==='tertiary_link'?'tertiary':h==='residential'||h==='living_street'?'residential':h==='unclassified'?'rural':h==='service'?'service':null;
type Init={type:'init';revision:number};
type AddRoads={type:'addRoads';revision:number;roads:import('../data/roadTiles').RoadSegment[]};
const idleFallbackAt=new Map<string,number>();
// Avoid repeating costly route extensions on every dispatch while a scout
// continues following a valid route.
const extensionRetryAt=new Map<string,number>();
const extensionLastDestination=new Map<string,string>();
const EXTENSION_RETRY_MS=15000;
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

const MISSION_LOOKAHEAD_EDGES=24;
const MAX_SUCCESSOR_PLANS_PER_DISPATCH=1;
// Avoid repeated nationwide path searches for unchanged idle scouts.
const idleRetryAt=new Map<string,number>();
const idleRetryRoadCount=new Map<string,number>();
const idleRetryExploredCount=new Map<string,number>();
const idleRetryPosition=new Map<string,string>();
const IDLE_RETRY_MS=5000;
// Limit expensive new mission searches per worker dispatch. Existing routes continue unaffected.
const MAX_IDLE_MISSION_PLANS_PER_DISPATCH=1;
let nextExplorerIndex=0;
let nextPlanningPhase:'idle'|'successor'='idle';
let poiRoadCursor=0;
// A failed scout permits the next road class to bootstrap without motorway access.

type OperationalRouteRequest={type:'operationalRoute';revision:number;requestId:number;vehicleId:string;purpose:'shift'|'service';from:Point;targets:Point[]};
type FuelPlanRequest={type:'fuelPlan';revision:number;requestId:number;vehicleId:string;from:Point;targets:{point:Point;depot:boolean}[]};
type RouteRequest={type:'routeRequest';revision:number;requestId:number;from:Point;to:Point};
type Dispatch={type:'dispatch';revision:number;now:number;taxis:Taxi[];queue:PassengerRequest[];discovered:string[];hq:Point;allowMission:boolean;allowTaxiShift:boolean;allowScout:boolean;stations?:Point[];poiTargets?:Point[];availableTaxiIds?:string[]};
self.onmessage=async(event:MessageEvent<Init|Dispatch|AddRoads|RouteRequest|FuelPlanRequest|OperationalRouteRequest>)=>{
 const msg=event.data;
 try{
  if(msg.type==='init'){
   nextExplorerIndex=0;nextPlanningPhase='idle';regionalRoads.clear();regionalMissionQueues.clear();poiRetryWallClock.clear();poiCooldownSkips=0;regionalMissionQueueHits=0;regionalMissionQueueBuilds=0;successorNegativeCache.clear();successorNegativeCacheHits=0;explorerSearchTier.clear();negativeScoutCache.clear();negativeScoutCacheHits=0;negativeScoutEmptySkips=0;regionalLookups=0;regionalCandidatesExamined=0;idleFallbackAt.clear();missionSequence.clear();missionPlannedAt.clear();missionLastEndpoint.clear();explorerMissions.clear();completedExplorerMissions=0;interruptedExplorerMissions=0;missionCounter=0;extensionRetryAt.clear();extensionLastDestination.clear();idleRetryAt.clear();idleRetryRoadCount.clear();idleRetryExploredCount.clear();idleRetryPosition.clear();poiRoadCursor=0;byClass.clear();allRoads.clear();classifiedRoads.clear();roadEndpoints.clear();roadInsertionOrder.length=0;roadClassCache.clear();indexedExplored.clear();revealedNodesIndex.clear();completionRoadsIndex.clear();connectedFrontierIndex.clear();connectedHqNode=null;discoveryIndexRoads=0;discoveryIndexUpdates=0;discoveryIndexRebuilds=0;discoveryIndexLastMs=0;poiRoadsIndex.clear();poiTargetsSignature='';poiIndexedRoads=0;pendingLoadedExplored.clear();passengerIndexedRoads.clear();passengerEligibleStops.clear();passengerIndexRebuilds=0;passengerIndexAdded=0;
   graph={nodes:new Map(),edges:new Map(),nodeKeys:[]};seenRoadIds.clear();activeRevision=msg.revision;
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
   const planned=from&&to?route(graph,from,to):null;
   self.postMessage({type:'routeResult',revision:activeRevision,requestId:msg.requestId,from:msg.from,to:msg.to,path:planned?.path??null,edgeIds:planned?.edgeIds??null,durationMs:performance.now()-started});
   return;
  }
  const dispatchStarted=performance.now();
  const {now,hq}=msg;
  const explored=new Set(msg.discovered);
  // Resting explorers remain parked until the main simulation releases them.
  const taxis=msg.taxis.map(t=>
   (t.kind==='explorer')&&t.status==='PAUSED'&&
   !t.shiftParked&&!t.restStopId&&!t.recoveryPending&&!t.refillRequested&&energyPercent(t)>10
    ?{...t,status:'IDLE' as const,shiftParked:false,pauseAtHome:false}:t);

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
   if(request){queue.push(request);generatedMission=true;}
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
    if(!assigned)continue;
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
   if(best)taxis[best.index]=best.taxi;
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
  const planningBudget=1;
  const planningPhase=nextPlanningPhase;
  nextPlanningPhase=planningPhase==='idle'?'successor':'idle';
  if(msg.allowScout){
   // All loaded roads are eligible for independent Purple Explorer discovery.
   const allowedRoads=allRoads;
   const purpleAllowedRoads=allowedRoads;
   const hqNode=nearest(graph,hq);
   updateDiscoveryIndex(graph,explored,hqNode);
   const revealedNodes=revealedNodesIndex;
   const completionRoads=completionRoadsIndex;
   const poiTargets=(msg.poiTargets??[]).slice(0,150);
   updatePoiIndex(graph,poiTargets);
   const poiRoads=poiRoadsIndex;
   const connectedFrontier=connectedFrontierIndex;
   const frontierFor=(_taxi:Taxi):Set<string>=>connectedFrontier;
   const discoveryRoads=(taxi:Taxi)=>{
    const role=taxi.explorerRole;
    if(role==='poi')return poiRoads;
    if(role==='completion')return new Set([...completionRoads].filter(id=>!poiRoads.has(id)));
    if(role==='highway'||role==='urban'){
     const cached=roadClassCache.get(role);if(cached)return cached;
     const roles=role==='highway'?['motorway','trunk','primary','secondary']:['tertiary','residential','rural','service'];
     const combined=new Set<string>();for(const key of roles)for(const id of byClass.get(key)??[])combined.add(id);
     roadClassCache.set(role,combined);return combined;
    }
    return byClass.get(role??'')??new Set<string>();
   };
   // Trim any previously assigned Explorer route at the first forbidden edge.
   // Do this before reserving routes or extending them, so stale assignments
   // cannot carry a vehicle beyond the current taxi-revealed boundary.
   for(let index=0;index<taxis.length;index++){
    const taxi=taxis[index];
    if((taxi.kind!=='explorer')||taxi.status!=='EXPLORING')continue;
    const permitted=taxi.kind==='explorer'?purpleAllowedRoads:allowedRoads;
    const firstForbidden=taxi.edgeIds.findIndex((id,i)=>i>=taxi.leg&&!permitted.has(id));
    if(firstForbidden<0)continue;
    if(firstForbidden<=taxi.leg){
     // A vehicle already traversing an invalid edge is held at its current
     // position rather than permitted to complete that edge.
     taxis[index]={...taxi,status:'IDLE',path:[],edgeIds:[],leg:0,distanceIntoLeg:0,speedKph:0};
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
   if(explorerOrder.length)nextExplorerIndex=(nextExplorerIndex+1)%explorerOrder.length;
   for(const index of orderedExplorerIndices){
    const taxi=taxis[index];
    if((taxi.kind!=='explorer')||taxi.status!=='EXPLORING'||taxi.deliveryUntil)continue;

    const remaining=taxi.path.length-1-taxi.leg;
    // Request the next route earlier to reduce waits at the final junction.
    if(remaining>MISSION_LOOKAHEAD_EDGES||!taxi.path.length)continue;
    if(successorPlansThisDispatch>=MAX_SUCCESSOR_PLANS_PER_DISPATCH||planningCalls>=planningBudget||planningPhase!=='successor')continue;
    const destination=taxi.path[taxi.path.length-1];
    const from=nearest(graph,destination);
    if(!from)continue;
    // Keep moving on the current route; periodically retry failed extensions
    // as nearby roads, reservations and exploration progress change.
    const destinationKey=from+'|'+taxi.edgeIds.length;
    if(missionLastEndpoint.get(taxi.id)===destinationKey)continue;
    if(extensionLastDestination.get(taxi.id)===destinationKey&&now<(extensionRetryAt.get(taxi.id)??0)){
     extensionSkipped++;continue;
    }
    const extensionTier=explorerSearchTier.get(taxi.id)??0;
    const extensionSignature=[taxi.id,destinationKey,seenRoadIds.size].join('|');
    const previousFailure=successorNegativeCache.get(taxi.id);
    if(previousFailure?.signature===extensionSignature&&performance.now()<previousFailure.until){successorNegativeCacheHits++;extensionSkipped++;continue;}
    extensionLastDestination.set(taxi.id,destinationKey);
    extensionRetryAt.set(taxi.id,now+EXTENSION_RETRY_MS);
    successorPlansThisDispatch++;
    planningCalls++;
    // This vehicle may continue from its own reserved destination.
    reservedTargets.delete(from);
    const purpleCluster=purpleAllowedRoads;
    if(taxi.kind==='explorer'&&!purpleCluster)continue;
    const extensionStarted=performance.now();
    const extensionCandidates=regionalCandidates(destination,discoveryRoads(taxi),explored,reservedEdges,SEARCH_RADII_KM[extensionTier],taxi.explorerRole??'balanced');
    // No eligible undiscovered roads in this tier: skip the costly route
    // search, and try a wider tier on the next successor planning turn.
    if(extensionCandidates.size===0){
     negativeScoutEmptySkips++;
     successorNegativeCache.set(taxi.id,{signature:extensionSignature,until:performance.now()+EXTENSION_RETRY_MS});
     explorerSearchTier.set(taxi.id,Math.min(extensionTier+1,SEARCH_RADII_KM.length-1));
     continue;
    }
    const extension=await dispatchScout({...taxi,status:'IDLE',position:destination,path:[],edgeIds:[],leg:0,distanceIntoLeg:0},
     graph,explored,hq,reservedTargets,reservedEdges,undefined,purpleAllowedRoads,discoveryRoads(taxi),undefined,undefined,undefined,msg.poiTargets,new Set([from]),revealedNodes,()=>msg.revision===activeRevision,extensionCandidates);
    if(msg.revision!==activeRevision)return;
   scoutTimings.push({vehicleId:taxi.id,role:taxi.explorerRole??'',ms:Math.round(performance.now()-extensionStarted),phase:'extension',result:extension.status});
    if(extension.status!=='EXPLORING'||extension.path.length<2){successorNegativeCache.set(taxi.id,{signature:extensionSignature,until:performance.now()+EXTENSION_RETRY_MS});explorerSearchTier.set(taxi.id,Math.min(extensionTier+1,SEARCH_RADII_KM.length-1));continue;}
    explorerSearchTier.set(taxi.id,0);
    successorNegativeCache.delete(taxi.id);
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
   for(const index of orderedExplorerIndices){
    if((taxis[index].kind!=='explorer')||taxis[index].status!=='IDLE'||taxis[index].deliveryUntil||taxis[index].refillRequested||energyPercent(taxis[index])<=10)continue;

    if(idleMissionPlans>=MAX_IDLE_MISSION_PLANS_PER_DISPATCH||planningCalls>=planningBudget||planningPhase!=='idle'){idleSkipped++;continue;}
    const idleVehicle=taxis[index];
    if(idleVehicle.explorerRole==='poi'){const p=poiRetryWallClock.get(idleVehicle.id);if(p&&performance.now()<p.until&&p.roadCount===seenRoadIds.size&&p.poiSignature===poiTargetsSignature){poiCooldownSkips++;idleSkipped++;continue;}}
    const positionKey=idleVehicle.position.join(',');
    const unchanged=idleRetryRoadCount.get(idleVehicle.id)===seenRoadIds.size&&
      idleRetryExploredCount.get(idleVehicle.id)===explored.size&&
      idleRetryPosition.get(idleVehicle.id)===positionKey;
    if(unchanged&&now<(idleRetryAt.get(idleVehicle.id)??0)){
     idleSkipped++;continue;
    }
    // Long-distance motorway scans are expensive: retry only every 10 seconds.
    if(taxis[index].explorerRole==='motorway'&&now<(idleFallbackAt.get(taxis[index].id)??0))continue;
    if(taxis[index].explorerRole==='motorway')idleFallbackAt.set(taxis[index].id,now+10000);
    const purpleCluster=purpleAllowedRoads;
    if(taxis[index].kind==='explorer'&&!purpleCluster)continue;
    const tier=explorerSearchTier.get(idleVehicle.id)??0;
    const signature=scoutSignature(idleVehicle.position,tier,seenRoadIds.size,idleVehicle.explorerRole??'balanced');
    const cached=negativeScoutCache.get(idleVehicle.id);
    if(cached&&cached.signature===signature&&now<cached.until){
     negativeScoutCacheHits++;idleSkipped++;continue;
    }
    const candidates=regionalCandidates(idleVehicle.position,discoveryRoads(idleVehicle),explored,reservedEdges,SEARCH_RADII_KM[tier],idleVehicle.explorerRole??'balanced');
    if(candidates.size===0){
     negativeScoutEmptySkips++;idleSkipped++;
     negativeScoutCache.set(idleVehicle.id,{signature,until:now+NEGATIVE_SCOUT_TTL_MS});
     explorerSearchTier.set(idleVehicle.id,Math.min(tier+1,SEARCH_RADII_KM.length-1));
     continue;
    }
    const idleStarted=performance.now();
    idleMissionPlans++;
    planningCalls++;
    const scout=await dispatchScout(taxis[index],graph,explored,hq,reservedTargets,reservedEdges,undefined,purpleAllowedRoads,discoveryRoads(taxis[index]),undefined,undefined,undefined,msg.poiTargets,frontierFor(taxis[index]),revealedNodes,()=>msg.revision===activeRevision,candidates);
    if(msg.revision!==activeRevision)return;
   scoutTimings.push({vehicleId:taxis[index].id,role:taxis[index].explorerRole??'',ms:Math.round(performance.now()-idleStarted),phase:'idle',result:scout.status});
    let assignment=scout;
    // No immediate second expensive search: retry in a later planning turn.
    if(assignment.status!=='IDLE'){
     explorerSearchTier.set(idleVehicle.id,0);
     negativeScoutCache.delete(idleVehicle.id);
     idleRetryAt.delete(idleVehicle.id);poiRetryWallClock.delete(idleVehicle.id);
     taxis[index]=assignment;
     missionSequence.set(idleVehicle.id,(missionSequence.get(idleVehicle.id)??0)+1);
     missionLastEndpoint.delete(idleVehicle.id);
     missionPlannedAt.set(idleVehicle.id,now);
     if(assignment.status==='EXPLORING')recordExplorerMission(assignment,now);
     assignedCount++;
    }else{
     if(idleVehicle.explorerRole==='poi')poiRetryWallClock.set(idleVehicle.id,{until:performance.now()+POI_RETRY_MS,roadCount:seenRoadIds.size,poiSignature:poiTargetsSignature});
      negativeScoutCache.set(idleVehicle.id,{signature,until:now+NEGATIVE_SCOUT_TTL_MS});
     explorerSearchTier.set(idleVehicle.id,Math.min(tier+1,SEARCH_RADII_KM.length-1));
     idleRetryAt.set(idleVehicle.id,now+(idleVehicle.explorerRole==='poi'?POI_RETRY_MS:IDLE_RETRY_MS));
     idleRetryRoadCount.set(idleVehicle.id,seenRoadIds.size);
     idleRetryExploredCount.set(idleVehicle.id,explored.size);
     idleRetryPosition.set(idleVehicle.id,positionKey);
    }
   }
   // Idle explorers remain at their current location and retry discovery.
   // Never return to headquarters automatically for a lack of assignments.
   // Explorers stay IDLE when no reachable discovery target exists.
   // Do not park or pause them: the next dispatch automatically retries as
   // new eligible roads and territory arrive.
  }
  const scoutMs=performance.now()-scoutStarted;
  const workerMs=performance.now()-dispatchStarted;
  self.postMessage({type:'result',revision:activeRevision,taxis,queue,assignedCount,generatedMission,roadCount:seenRoadIds.size,perf:{workerMs,preparationMs,passengerMs,scoutMs,graphNodes:graph.nodes.size,graphRoads:seenRoadIds.size,vehicles:taxis.length,missions:msg.queue.length,planningQueue:{phase:planningPhase,searches:planningCalls,queued:orderedExplorerIndices.length,cursor:nextExplorerIndex,regions:regionalRoads.size,regionalLookups,regionalCandidatesExamined,negativeScoutCacheHits,negativeScoutEmptySkips,negativeScoutCacheSize:negativeScoutCache.size,regionalMissionQueueSize:regionalMissionQueues.size,regionalMissionQueueHits,regionalMissionQueueBuilds,successorNegativeCacheHits,successorNegativeCacheSize:successorNegativeCache.size,poiCooldownSkips,regionalMissionQueueLimit:MAX_REGIONAL_MISSION_QUEUES},scoutTimings:scoutTimings.filter(t=>t.ms>=10).sort((a,b)=>b.ms-a.ms).slice(0,8),extensionSkipped,idleSkipped,explorationMissions:{active:explorerMissions.size,idlePlans:idleMissionPlans,vehicles:taxis.filter(t=>t.kind==='explorer').map(t=>({id:t.id,role:t.explorerRole??'balanced',status:t.status,missionId:explorerMissions.get(t.id)?.id??null,remainingEdges:Math.max(0,t.edgeIds.length-t.leg),retryInMs:Math.max(0,(idleRetryAt.get(t.id)??0)-now),lastPlannedAt:missionPlannedAt.get(t.id)??null})),created:missionCounter,completed:completedExplorerMissions,interrupted:interruptedExplorerMissions,successorsPlanned:successorPlansThisDispatch,lastPlannedAt:Math.max(0,...missionPlannedAt.values())},passengerIndex:{roads:passengerIndexedRoads.size,stops:passengerEligibleStops.size,rebuilds:passengerIndexRebuilds,added:passengerIndexAdded},discoveryIndex:{updates:discoveryIndexUpdates,rebuilds:discoveryIndexRebuilds,lastMs:Math.round(discoveryIndexLastMs*10)/10,revealedNodes:revealedNodesIndex.size,connectedNodes:connectedFrontierIndex.size,completionRoads:completionRoadsIndex.size,poiRoads:poiRoadsIndex.size}}});
 }catch(error){self.postMessage({type:'error',revision:activeRevision,error:String(error)});}
};
