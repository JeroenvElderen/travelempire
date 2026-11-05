import {energyPercent} from './energy';
import {demandAt} from './demand';
import {createPassengerRequest,assignPassenger,passengerRoadNodes,dispatchScout,route,nearest,meters,trafficTravelSeconds,type RoadGraph,type Taxi,type PassengerRequest,type Point} from './taxi';
let graph:RoadGraph|null=null;
let activeRevision=0;
const seenRoadIds=new Set<string>();
type Init={type:'init';revision:number};
type AddRoads={type:'addRoads';revision:number;roads:import('../data/roadTiles').RoadSegment[]};
const idleFallbackAt=new Map<string,number>();
const explorerIdleSince=new Map<string,number>();
const explorerDepotCooldown=new Map<string,number>();
const EXPLORER_IDLE_RETURN_MS=60000;
type OperationalRouteRequest={type:'operationalRoute';revision:number;requestId:number;vehicleId:string;purpose:'shift'|'service';from:Point;targets:Point[]};
type FuelPlanRequest={type:'fuelPlan';revision:number;requestId:number;vehicleId:string;from:Point;targets:{point:Point;depot:boolean}[]};
type RouteRequest={type:'routeRequest';revision:number;requestId:number;from:Point;to:Point};
type Dispatch={type:'dispatch';revision:number;now:number;taxis:Taxi[];queue:PassengerRequest[];discovered:string[];hq:Point;allowMission:boolean;allowTaxiShift:boolean;allowScout:boolean;stations?:Point[];availableTaxiIds?:string[]};
self.onmessage=(event:MessageEvent<Init|Dispatch|AddRoads|RouteRequest|FuelPlanRequest|OperationalRouteRequest>)=>{
 const msg=event.data;
 try{
  if(msg.type==='init'){
   explorerIdleSince.clear();explorerDepotCooldown.clear();idleFallbackAt.clear();
   graph={nodes:new Map(),edges:new Map(),nodeKeys:[]};seenRoadIds.clear();activeRevision=msg.revision;
   self.postMessage({type:'ready',revision:activeRevision});return;
  }
  if(!graph||msg.revision!==activeRevision)return;
  if(msg.type==='addRoads'){
   for(const road of msg.roads){
    if(road.coordinates?.length!==2||!Number.isFinite(road.length)||road.length<=0||seenRoadIds.has(road.id))continue;
    seenRoadIds.add(road.id);
    const a=String(road.a),b=String(road.b);
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
   let best:{point:Point;depot:boolean;roadKm:number;path:{path:Point[];edgeIds:string[]}}|null=null;
   for(const target of msg.targets){
    const to=nearest(graph,target.point);
    const planned=from&&to?route(graph,from,to):null;
    if(!planned)continue;
    const roadKm=planned.path.reduce((sum,p,i)=>i?sum+meters(p,planned.path[i-1])/1000:sum,0)+(graph.nodes.get(to)?meters(graph.nodes.get(to)!,target.point)/1000:0);
    if(!best||roadKm<best.roadKm)best={...target,roadKm,path:planned};
   }
   self.postMessage({type:'fuelPlanResult',revision:activeRevision,requestId:msg.requestId,vehicleId:msg.vehicleId,position:msg.from,target:best,durationMs:performance.now()-started});return;
  }
  if(msg.type==='routeRequest'){
   const started=performance.now();
   const from=nearest(graph,msg.from),to=nearest(graph,msg.to);
   const planned=from&&to?route(graph,from,to):null;
   self.postMessage({type:'routeResult',revision:activeRevision,requestId:msg.requestId,from:msg.from,to:msg.to,path:planned?.path??null,edgeIds:planned?.edgeIds??null,durationMs:performance.now()-started});
   return;
  }
  const {now,hq}=msg;
  const explored=new Set(msg.discovered);
  const taxis=msg.taxis.map(t=>
   (t.kind==='explorer')&&t.status==='PAUSED'&&
   !t.recoveryPending&&!t.refillRequested&&energyPercent(t)>10
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
  // Passenger assignments run first. Purple Explorers continuously select nearby eligible roads.
  let assignedCount=0;
  if(msg.allowScout){
   // All loaded roads are eligible for independent Purple Explorer discovery.
   const allowedRoads=new Set<string>();
   for(const links of graph.edges.values())for(const edge of links)allowedRoads.add(edge.id);
   const purpleAllowedRoads=allowedRoads;
  const discoveryRoads=(taxi:Taxi)=>{if(!taxi.discoveryMode||taxi.discoveryMode==='balanced')return purpleAllowedRoads;const allowed=new Set<string>();for(const links of graph!.edges.values())for(const edge of links){const h=edge.highway??'';const mode=taxi.discoveryMode;const match=mode==='highways'?['motorway','trunk','primary'].some(v=>h===v||h===v+'_link'):mode==='urban'?['residential','living_street','service'].includes(h):['secondary','tertiary','unclassified','road'].includes(h);if(match&&purpleAllowedRoads.has(edge.id))allowed.add(edge.id);}return allowed;};
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
   const permittedNodes=new Set<string>();
   for(const [from,links] of graph.edges)for(const edge of links)if(allowedRoads.has(edge.id)){
    permittedNodes.add(from);permittedNodes.add(edge.to);
   }
   for(let index=0;index<taxis.length;index++){
    const taxi=taxis[index];
    if((taxi.kind!=='explorer')||taxi.status!=='IDLE'||taxi.deliveryUntil||taxi.refillRequested||energyPercent(taxi)<=10)continue;
    const start=nearest(graph,taxi.position);
    if(!start||permittedNodes.has(start))continue;
    const candidates=[...permittedNodes].map(k=>({k,d:meters(taxi.position,graph!.nodes.get(k)!)}))
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
    if(remaining>2||!taxi.path.length)continue;
    const destination=taxi.path[taxi.path.length-1];
    const from=nearest(graph,destination);
    if(!from)continue;
    // This vehicle may continue from its own reserved destination.
    reservedTargets.delete(from);
    const purpleCluster=purpleAllowedRoads;
    if(taxi.kind==='explorer'&&!purpleCluster)continue;
    const extension=dispatchScout({...taxi,status:'IDLE',position:destination,path:[],edgeIds:[],leg:0,distanceIntoLeg:0},
     graph,explored,hq,reservedTargets,reservedEdges,undefined,purpleAllowedRoads,discoveryRoads(taxi),undefined,undefined);
    if(extension.status!=='EXPLORING'||extension.path.length<2)continue;
    // The nearest node at the destination must match the new route's start.
    if(extension.path[0][0]!==destination[0]||extension.path[0][1]!==destination[1])continue;
    taxis[index]={...taxi,path:[...taxi.path,...extension.path.slice(1)],
     edgeIds:[...taxi.edgeIds,...extension.edgeIds],scoutingRuns:extension.scoutingRuns};
    assignedCount++;
   }
   for(let index=0;index<taxis.length;index++){
    if((taxis[index].kind!=='explorer')||taxis[index].status!=='IDLE'||taxis[index].deliveryUntil||taxis[index].refillRequested||energyPercent(taxis[index])<=10)continue;
    const purpleCluster=purpleAllowedRoads;
    if(taxis[index].kind==='explorer'&&!purpleCluster)continue;
    const scout=dispatchScout(taxis[index],graph,explored,hq,reservedTargets,reservedEdges,undefined,purpleAllowedRoads,discoveryRoads(taxis[index]));
    let assignment=scout;
    // A saved section may have remaining roads but no reachable target from
    // this vehicle. Search eligible connected roads without stale ownership
    // or soft reservations, then release the old section if reassigned.
    if(assignment.status==='IDLE'&&taxis[index].kind==='explorer'&&
       now>=(idleFallbackAt.get(taxis[index].id)??0)){
     idleFallbackAt.set(taxis[index].id,now+5000);
     assignment=dispatchScout({...taxis[index],shiftParked:true},graph,explored,hq,new Set<string>(),new Set<string>(),undefined,purpleAllowedRoads,discoveryRoads(taxis[index]));
    }
    if(assignment.status!=='IDLE'){
     explorerIdleSince.delete(taxis[index].id);
     taxis[index]=assignment;
     assignedCount++;
    }
   }
   // After a full minute without an assignment, drive home along roads.
   // Use wall-clock time: dispatch messages arrive every 500 ms, while the
   // simulation clock runs faster. Never teleport or call roadside recovery.
   const realNow=Date.now();
   for(let index=0;index<taxis.length;index++){
    const t=taxis[index];
    if(t.kind!=='explorer'||t.recoveryPending||t.refillRequested||t.deliveryUntil){
     explorerIdleSince.delete(t.id);continue;
    }
    if(t.status!=='IDLE'){
     explorerIdleSince.delete(t.id);continue;
    }
    if(!explorerIdleSince.has(t.id))explorerIdleSince.set(t.id,realNow);
    if(realNow-(explorerIdleSince.get(t.id)??realNow)<EXPLORER_IDLE_RETURN_MS||
       realNow<(explorerDepotCooldown.get(t.id)??0))continue;
    const from=nearest(graph,t.position),to=nearest(graph,hq);
    if(!from||!to||from===to){
     explorerDepotCooldown.set(t.id,realNow+60000);continue;
    }
    const home=route(graph,from,to);
    if(!home||home.path.length<2){
     explorerDepotCooldown.set(t.id,realNow+60000);continue;
    }
    taxis[index]={...t,status:'RETURNING',pauseAtHome:false,shiftParked:false,
     path:home.path,edgeIds:home.edgeIds,leg:0,distanceIntoLeg:0,
     speedKph:0,journeyEdges:[],explorationSection:undefined};
    explorerIdleSince.delete(t.id);
    explorerDepotCooldown.set(t.id,realNow+120000);
   }
   // Explorers stay IDLE when no reachable discovery target exists.
   // Do not park or pause them: the next dispatch automatically retries as
   // new eligible roads and territory arrive.
  }
  self.postMessage({type:'result',revision:activeRevision,taxis,queue,assignedCount,generatedMission,roadCount:seenRoadIds.size});
 }catch(error){self.postMessage({type:'error',revision:activeRevision,error:String(error)});}
};
