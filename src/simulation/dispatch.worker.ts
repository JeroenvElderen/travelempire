import {energyPercent} from './energy';
import {demandAt} from './demand';
import {createPassengerRequest,assignPassenger,passengerRoadNodes,dispatchScout,route,nearest,meters,trafficTravelSeconds,type RoadGraph,type Taxi,type PassengerRequest,type Point} from './taxi';
let graph:RoadGraph|null=null;
let activeRevision=0;
const seenRoadIds=new Set<string>();
// Classification is stable for each road tile; build it once as roads arrive.
const byClass=new Map<string,Set<string>>();
const allRoads=new Set<string>();
const classifiedRoads=new Set<string>();
const roadEndpoints=new Map<string,[string,string]>();
const roadClassCache=new Map<string,Set<string>>();
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
  for(const [id,ends] of roadEndpoints)if(!classifiedRoads.has(id)&&!indexedExplored.has(id)&&revealedNodesIndex.has(ends[0])&&revealedNodesIndex.has(ends[1]))completionRoadsIndex.add(id);
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
 if(signature!==poiTargetsSignature){poiTargetsSignature=signature;poiRoadsIndex=new Set();poiIndexedRoads=0;}
 if(!targets.length)return;
 if(poiIndexedRoads===seenRoadIds.size)return;
 for(const [id,ends] of roadEndpoints){
  if(classifiedRoads.has(id)||poiRoadsIndex.has(id))continue;
  const a=g.nodes.get(ends[0]),b=g.nodes.get(ends[1]);
  if((a&&targets.some(p=>meters(a,p)<600))||(b&&targets.some(p=>meters(b,p)<600)))poiRoadsIndex.add(id);
 }
 poiIndexedRoads=seenRoadIds.size;
}

const roadRole=(h:string)=>h==='motorway'||h==='motorway_link'?'motorway':h==='trunk'||h==='trunk_link'?'trunk':h==='primary'||h==='primary_link'?'primary':h==='secondary'||h==='secondary_link'?'secondary':h==='tertiary'||h==='tertiary_link'?'tertiary':h==='residential'||h==='living_street'?'residential':h==='unclassified'?'rural':h==='service'?'service':null;
type Init={type:'init';revision:number};
type AddRoads={type:'addRoads';revision:number;roads:import('../data/roadTiles').RoadSegment[]};
const idleFallbackAt=new Map<string,number>();
// A failed scout permits the next road class to bootstrap without motorway access.

type OperationalRouteRequest={type:'operationalRoute';revision:number;requestId:number;vehicleId:string;purpose:'shift'|'service';from:Point;targets:Point[]};
type FuelPlanRequest={type:'fuelPlan';revision:number;requestId:number;vehicleId:string;from:Point;targets:{point:Point;depot:boolean}[]};
type RouteRequest={type:'routeRequest';revision:number;requestId:number;from:Point;to:Point};
type Dispatch={type:'dispatch';revision:number;now:number;taxis:Taxi[];queue:PassengerRequest[];discovered:string[];hq:Point;allowMission:boolean;allowTaxiShift:boolean;allowScout:boolean;stations?:Point[];poiTargets?:Point[];availableTaxiIds?:string[]};
self.onmessage=(event:MessageEvent<Init|Dispatch|AddRoads|RouteRequest|FuelPlanRequest|OperationalRouteRequest>)=>{
 const msg=event.data;
 try{
  if(msg.type==='init'){
   idleFallbackAt.clear();byClass.clear();allRoads.clear();classifiedRoads.clear();roadEndpoints.clear();roadClassCache.clear();indexedExplored.clear();revealedNodesIndex.clear();completionRoadsIndex.clear();connectedFrontierIndex.clear();connectedHqNode=null;discoveryIndexRoads=0;discoveryIndexUpdates=0;discoveryIndexRebuilds=0;discoveryIndexLastMs=0;poiRoadsIndex.clear();poiTargetsSignature='';poiIndexedRoads=0;pendingLoadedExplored.clear();
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
    roadEndpoints.set(road.id,[a,b]);
    if(indexedExplored.has(road.id)){pendingLoadedExplored.add(a);pendingLoadedExplored.add(b);}
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
   let best:{point:Point;depot:boolean;roadKm:number;path:{path:Point[];edgeIds:string[]}}|null=null;
   for(const target of msg.targets){
    const to=nearest(graph,target.point);
    const planned=from&&to?route(graph,from,to):null;
    if(!planned)continue;
    const roadKm=planned.path.reduce((sum,p,i)=>i?sum+meters(p,planned.path[i-1])/1000:sum,0)+(graph.nodes.get(to)?meters(graph.nodes.get(to)!,target.point)/1000:0);
    if(!best||roadKm<best.roadKm)best={...target,roadKm,path:planned};
   }
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
  const eligibleStops=passengerRoadNodes(activeGraph,validDiscovered);
  const queue=msg.queue.filter(m=>m.expiresAt>now&&eligibleStops.has(nearest(activeGraph,m.pickup))&&eligibleStops.has(nearest(activeGraph,m.dropoff)));
  let generatedMission=false;
  const passengerTaxis=taxis.filter(t=>(!t.kind||t.kind==='taxi'));
  const demand=demandAt(now,passengerTaxis.length);
  if(msg.allowMission&&queue.length<demand.queueLimit){
   const request=createPassengerRequest(graph,validDiscovered,hq,now,demand.fareMultiplier);
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
    const assigned=assignPassenger(taxi,activeGraph,mission,validDiscovered);
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
  // Passenger assignments run first. Purple Explorers continuously select nearby eligible roads.
  let assignedCount=0;
  const scoutTimings:{role:string;ms:number;phase:string}[]=[];
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
   // Preplan the next sequence before an Explorer reaches its final junction.
   // Append the new path without resetting its current leg or position.
   for(let index=0;index<taxis.length;index++){
    const taxi=taxis[index];
    if((taxi.kind!=='explorer')||taxi.status!=='EXPLORING'||taxi.deliveryUntil)continue;

    const remaining=taxi.path.length-1-taxi.leg;
    // Request the next route earlier to reduce waits at the final junction.
    if(remaining>8||!taxi.path.length)continue;
    const destination=taxi.path[taxi.path.length-1];
    const from=nearest(graph,destination);
    if(!from)continue;
    // This vehicle may continue from its own reserved destination.
    reservedTargets.delete(from);
    const purpleCluster=purpleAllowedRoads;
    if(taxi.kind==='explorer'&&!purpleCluster)continue;
    const extensionStarted=performance.now();
    const extension=dispatchScout({...taxi,status:'IDLE',position:destination,path:[],edgeIds:[],leg:0,distanceIntoLeg:0},
     graph,explored,hq,reservedTargets,reservedEdges,undefined,purpleAllowedRoads,discoveryRoads(taxi),undefined,undefined,undefined,msg.poiTargets,new Set([from]),revealedNodes);
    scoutTimings.push({role:taxi.explorerRole??'',ms:Math.round(performance.now()-extensionStarted),phase:'extension'});
    if(extension.status!=='EXPLORING'||extension.path.length<2)continue;
    // The nearest node at the destination must match the new route's start.
    if(extension.path[0][0]!==destination[0]||extension.path[0][1]!==destination[1])continue;
    taxis[index]={...taxi,path:[...taxi.path,...extension.path.slice(1)],
     edgeIds:[...taxi.edgeIds,...extension.edgeIds],discoveryEdgeIds:[...(taxi.discoveryEdgeIds??taxi.edgeIds),...(extension.discoveryEdgeIds??[])],scoutingRuns:extension.scoutingRuns};
    assignedCount++;
   }
   for(let index=0;index<taxis.length;index++){
    if((taxis[index].kind!=='explorer')||taxis[index].status!=='IDLE'||taxis[index].deliveryUntil||taxis[index].refillRequested||energyPercent(taxis[index])<=10)continue;

    // Long-distance motorway scans are expensive: retry only every 10 seconds.
    if(taxis[index].explorerRole==='motorway'&&now<(idleFallbackAt.get(taxis[index].id)??0))continue;
    if(taxis[index].explorerRole==='motorway')idleFallbackAt.set(taxis[index].id,now+10000);
    const purpleCluster=purpleAllowedRoads;
    if(taxis[index].kind==='explorer'&&!purpleCluster)continue;
    const idleStarted=performance.now();
    const scout=dispatchScout(taxis[index],graph,explored,hq,reservedTargets,reservedEdges,undefined,purpleAllowedRoads,discoveryRoads(taxis[index]),undefined,undefined,undefined,msg.poiTargets,frontierFor(taxis[index]),revealedNodes);
    scoutTimings.push({role:taxis[index].explorerRole??'',ms:Math.round(performance.now()-idleStarted),phase:'idle'});
    let assignment=scout;
    // A saved section may have remaining roads but no reachable target from
    // this vehicle. Search eligible connected roads without stale ownership
    // or soft reservations, then release the old section if reassigned.
    if(assignment.status==='IDLE'&&taxis[index].kind==='explorer'&&taxis[index].explorerRole!=='motorway'&&
       now>=(idleFallbackAt.get(taxis[index].id)??0)){
     idleFallbackAt.set(taxis[index].id,now+5000);
     const fallbackStarted=performance.now();
     assignment=dispatchScout({...taxis[index],shiftParked:true},graph,explored,hq,new Set<string>(),new Set<string>(),undefined,purpleAllowedRoads,discoveryRoads(taxis[index]),undefined,undefined,undefined,msg.poiTargets,frontierFor(taxis[index]),revealedNodes);
     scoutTimings.push({role:taxis[index].explorerRole??'',ms:Math.round(performance.now()-fallbackStarted),phase:'fallback'});
    }
    if(assignment.status!=='IDLE'){
     taxis[index]=assignment;
     assignedCount++;
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
  self.postMessage({type:'result',revision:activeRevision,taxis,queue,assignedCount,generatedMission,roadCount:seenRoadIds.size,perf:{workerMs,preparationMs,passengerMs,scoutMs,graphNodes:graph.nodes.size,graphRoads:seenRoadIds.size,vehicles:taxis.length,missions:msg.queue.length,scoutTimings:scoutTimings.filter(t=>t.ms>=10).sort((a,b)=>b.ms-a.ms).slice(0,8),discoveryIndex:{updates:discoveryIndexUpdates,rebuilds:discoveryIndexRebuilds,lastMs:Math.round(discoveryIndexLastMs*10)/10,revealedNodes:revealedNodesIndex.size,connectedNodes:connectedFrontierIndex.size,completionRoads:completionRoadsIndex.size,poiRoads:poiRoadsIndex.size}}});
 }catch(error){self.postMessage({type:'error',revision:activeRevision,error:String(error)});}
};
