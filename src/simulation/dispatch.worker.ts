import {energyPercent} from './energy';
import {demandAt} from './demand';
import {createPassengerRequest,assignPassenger,passengerRoadNodes,dispatchScout,territoryDiscoveryEdges,route,nearest,meters,trafficTravelSeconds,type RoadGraph,type Taxi,type PassengerRequest,type Point} from './taxi';
let graph:RoadGraph|null=null;
let activeRevision=0;
const seenRoadIds=new Set<string>();
type Init={type:'init';revision:number};
type AddRoads={type:'addRoads';revision:number;roads:import('../data/roadTiles').RoadSegment[]};
let eligibilityCacheKey='';
let eligibilityCache=new Set<string>();
const parkedRetryAt=new Map<string,number>();
type Dispatch={type:'dispatch';revision:number;now:number;taxis:Taxi[];queue:PassengerRequest[];discovered:string[];territory:string[];hq:Point;allowMission:boolean;allowTaxiShift:boolean;allowScout:boolean;stations?:Point[];availableTaxiIds?:string[]};
self.onmessage=(event:MessageEvent<Init|Dispatch|AddRoads>)=>{
 const msg=event.data;
 try{
  if(msg.type==='init'){
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
     list.push({to,meters:road.length,id:road.id,speedKph:road.speed});
    };
    if(road.oneway!==-1)add(a,b);
    if(road.oneway!==1)add(b,a);
   }
   self.postMessage({type:'roadsAdded',revision:activeRevision,roadCount:seenRoadIds.size});return;
  }
  const {now,hq}=msg;
  const explored=new Set(msg.discovered);
  const territoryExplored=new Set(msg.territory);
  // Recompute only when the territory or road graph changes; dispatch runs often.
  const territorySignature=msg.territory.length+':'+msg.territory.join('|');
  const cacheKey=activeRevision+':'+seenRoadIds.size+':'+territorySignature;
  if(cacheKey!==eligibilityCacheKey){
   eligibilityCacheKey=cacheKey;
   eligibilityCache=territoryDiscoveryEdges(graph,territoryExplored);
  }
  const discoveryEligible=eligibilityCache;
  const taxis=msg.taxis.slice();
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
   // Road Explorers discover roads; Black Explorer independently reveals territory.
   // Only its actual exploration routes contribute to discovered territory.
   const allowedRoads=new Set<string>();
   for(const links of graph.edges.values())for(const edge of links)allowedRoads.add(edge.id);
   // Trim any previously assigned Explorer route at the first forbidden edge.
   // Do this before reserving routes or extending them, so stale assignments
   // cannot carry a vehicle beyond the current taxi-revealed boundary.
   for(let index=0;index<taxis.length;index++){
    const taxi=taxis[index];
    if((taxi.kind!=='explorer'&&taxi.kind!=='surveyor')||taxi.status!=='EXPLORING')continue;
    const firstForbidden=taxi.edgeIds.findIndex((id,i)=>i>=taxi.leg&&!allowedRoads.has(id));
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
    if((taxi.kind!=='explorer'&&taxi.kind!=='surveyor')||taxi.status!=='IDLE'||taxi.deliveryUntil||taxi.refillRequested||energyPercent(taxi)<=10)continue;
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
    if((taxi.kind!=='explorer'&&taxi.kind!=='surveyor')||taxi.status!=='EXPLORING'||taxi.deliveryUntil)continue;
    const remaining=taxi.path.length-1-taxi.leg;
    if(remaining>2||!taxi.path.length)continue;
    const destination=taxi.path[taxi.path.length-1];
    const from=nearest(graph,destination);
    if(!from)continue;
    // This vehicle may continue from its own reserved destination.
    reservedTargets.delete(from);
    const purpleCluster=taxi.kind==='explorer'?discoveryEligible:undefined;
    if(taxi.kind==='explorer'&&!purpleCluster)continue;
    const extension=dispatchScout({...taxi,status:'IDLE',position:destination,path:[],edgeIds:[],leg:0,distanceIntoLeg:0},
     graph,taxi.kind==='surveyor'?territoryExplored:explored,hq,reservedTargets,reservedEdges,undefined,allowedRoads,taxi.kind==='explorer'?discoveryEligible:undefined,taxi.kind==='surveyor'?discoveryEligible:undefined,
     taxi.kind==='explorer'&&taxi.path.length>=2?nearest(graph,taxi.path[taxi.path.length-2]):undefined);
    if(extension.status!=='EXPLORING'||extension.path.length<2)continue;
    // The nearest node at the destination must match the new route's start.
    if(extension.path[0][0]!==destination[0]||extension.path[0][1]!==destination[1])continue;
    taxis[index]={...taxi,path:[...taxi.path,...extension.path.slice(1)],
     edgeIds:[...taxi.edgeIds,...extension.edgeIds],scoutingRuns:extension.scoutingRuns};
    assignedCount++;
   }
   for(let index=0;index<taxis.length;index++){
    if((taxis[index].kind!=='explorer'&&taxis[index].kind!=='surveyor')||taxis[index].status!=='IDLE'||taxis[index].deliveryUntil||taxis[index].refillRequested||energyPercent(taxis[index])<=10)continue;
    const purpleCluster=taxis[index].kind==='explorer'?discoveryEligible:undefined;
    if(taxis[index].kind==='explorer'&&!purpleCluster)continue;
    const scout=dispatchScout(taxis[index],graph,taxis[index].kind==='surveyor'?territoryExplored:explored,hq,reservedTargets,reservedEdges,undefined,allowedRoads,taxis[index].kind==='explorer'?discoveryEligible:undefined,taxis[index].kind==='surveyor'?discoveryEligible:undefined);
    if(scout.status!=='IDLE'){
     taxis[index]=scout;
     assignedCount++;
    }
   }
   // Purple Explorers park only after a genuine failed scout search. The
   // return route uses normal road movement and never counts as exploration.
   for(let index=0;index<taxis.length;index++){
    const taxi=taxis[index];
    if(taxi.kind!=='explorer'||taxi.deliveryUntil||taxi.refillRequested)continue;
    if(taxi.status==='PAUSED'&&taxi.shiftParked){
     if(now<(parkedRetryAt.get(taxi.id)??0))continue;
     parkedRetryAt.set(taxi.id,now+5000);
     const candidate=dispatchScout({...taxi,status:'IDLE',shiftParked:false},graph,explored,hq,
      reservedTargets,reservedEdges,undefined,allowedRoads,discoveryEligible);
     if(candidate.status==='EXPLORING')taxis[index]={...candidate,shiftParked:false};
     continue;
    }
    if(taxi.status!=='IDLE'||taxi.shiftParked||energyPercent(taxi)<=10)continue;
    // Only park if there is no reachable exploration route. The scout pass
    // above has already attempted to assign one.
    const start=nearest(graph,taxi.position);
    if(!start)continue;
    const destinations=[hq,...(msg.stations??[])];
    let best:ReturnType<typeof route>|null=null;
    for(const point of destinations){
     const end=nearest(graph,point);
     if(!end)continue;
     const candidate=route(graph,start,end);
     if(candidate&&candidate.path.length>=2&&(!best||candidate.length<best.length))best=candidate;
    }
    if(best){
     taxis[index]={...taxi,status:'RETURNING',pauseAtHome:true,shiftParked:true,
      path:best.path,edgeIds:best.edgeIds,leg:0,distanceIntoLeg:0,journeyEdges:[]};
    }else if(destinations.some(point=>meters(taxi.position,point)<80)){
     taxis[index]={...taxi,status:'PAUSED',shiftParked:true,path:[],edgeIds:[],speedKph:0};
    }
   }
  }
  self.postMessage({type:'result',revision:activeRevision,taxis,queue,assignedCount,generatedMission,roadCount:seenRoadIds.size,discoveryEligible:[...discoveryEligible]});
 }catch(error){self.postMessage({type:'error',revision:activeRevision,error:String(error)});}
};
