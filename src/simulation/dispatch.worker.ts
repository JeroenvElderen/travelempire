import {demandAt} from './demand';
import {createPassengerRequest,assignPassenger,passengerRoadNodes,dispatchScout,route,nearest,meters,type RoadGraph,type Taxi,type PassengerRequest,type Point} from './taxi';
let graph:RoadGraph|null=null;
let activeRevision=0;
const seenRoadIds=new Set<string>();
type Init={type:'init';revision:number};
type AddRoads={type:'addRoads';revision:number;roads:import('../data/roadTiles').RoadSegment[]};
type Dispatch={type:'dispatch';revision:number;now:number;taxis:Taxi[];queue:PassengerRequest[];discovered:string[];territory:string[];hq:Point;allowMission:boolean;allowScout:boolean};
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
  const taxis=msg.taxis.slice();
  const activeGraph=graph;
  const eligibleStops=passengerRoadNodes(activeGraph,explored);
  const queue=msg.queue.filter(m=>m.expiresAt>now&&eligibleStops.has(nearest(activeGraph,m.pickup))&&eligibleStops.has(nearest(activeGraph,m.dropoff)));
  let generatedMission=false;
  const passengerTaxis=taxis.filter(t=>t.kind!=='explorer');
  const demand=demandAt(now,passengerTaxis.length);
  if(msg.allowMission&&queue.length<demand.queueLimit){
   const request=createPassengerRequest(graph,explored,hq,now,demand.fareMultiplier);
   if(request){queue.push(request);generatedMission=true;}
  }
  for(let i=queue.length-1;i>=0;i--){
   const mission=queue[i];
   const candidates=taxis.map((t,index)=>({index,d:t.kind!=='explorer'&&t.status==='IDLE'&&!t.deliveryUntil?meters(t.position,mission.pickup):Infinity}))
    .filter(c=>Number.isFinite(c.d)).sort((a,b)=>a.d-b.d).slice(0,3);
   let best:{index:number;taxi:Taxi;distance:number}|null=null;
   for(const candidate of candidates){
    const assigned=assignPassenger(taxis[candidate.index],graph,mission,explored);
    if(!assigned)continue;
    const distance=assigned.path.reduce((sum,p,j)=>j?sum+meters(p,assigned.path[j-1]):sum,0);
    if(!best||distance<best.distance)best={index:candidate.index,taxi:assigned,distance};
   }
   if(best){taxis[best.index]=best.taxi;queue.splice(i,1);}
  }
  // Passenger assignments run first. Explorers systematically clear nearby undiscovered roads.
  let assignedCount=0;
  if(msg.allowScout){
   // The starting HQ is revealed within 500m; taxi-travelled segments reveal
   // 150m corridors. Explorer-discovered roads alone never expand this mask.
   const territoryIds=new Set(msg.territory??[]);
   const revealedSegments:Array<[Point,Point]>=[];
   const seenTerritory=new Set<string>();
   for(const [from,links] of graph.edges){
    for(const edge of links){
     if(!territoryIds.has(edge.id)||seenTerritory.has(edge.id))continue;
     const a=graph.nodes.get(from),b=graph.nodes.get(edge.to);
     if(a&&b){revealedSegments.push([a,b]);seenTerritory.add(edge.id);}
    }
   }
   // Index taxi corridor segments spatially; avoid O(all roads × all corridors).
   const cell=0.003;
   const grid=new Map<string,Array<[Point,Point]>>();
   const cellKey=(x:number,y:number)=>x+','+y;
   for(const segment of revealedSegments){
    const [a,b]=segment;
    const x0=Math.floor(Math.min(a[0],b[0])/cell)-1,x1=Math.floor(Math.max(a[0],b[0])/cell)+1;
    const y0=Math.floor(Math.min(a[1],b[1])/cell)-1,y1=Math.floor(Math.max(a[1],b[1])/cell)+1;
    for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){
     const k=cellKey(x,y),list=grid.get(k)??[];list.push(segment);grid.set(k,list);
    }
   }
   const inside=(point:Point)=>{
    if(meters(point,hq)<=500)return true;
    const segments=grid.get(cellKey(Math.floor(point[0]/cell),Math.floor(point[1]/cell)))??[];
    const cos=Math.cos(point[1]*Math.PI/180);
    for(const [a,b] of segments){
     const ax=(a[0]-point[0])*111320*cos,ay=(a[1]-point[1])*111320;
     const bx=(b[0]-point[0])*111320*cos,by=(b[1]-point[1])*111320;
     const dx=bx-ax,dy=by-ay;
     const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));
     if(Math.hypot(ax+t*dx,ay+t*dy)<=150)return true;
    }
    return false;
   };
   const allowedRoads=new Set<string>();
   for(const [from,links] of graph.edges){
    const a=graph.nodes.get(from);if(!a)continue;
    for(const edge of links){
     if(allowedRoads.has(edge.id))continue;
     const b=graph.nodes.get(edge.to);if(!b)continue;
     const middle:Point=[(a[0]+b[0])/2,(a[1]+b[1])/2];
     if(inside(a)&&inside(b)&&inside(middle))allowedRoads.add(edge.id);
    }
   }
   // Trim any previously assigned Explorer route at the first forbidden edge.
   // Do this before reserving routes or extending them, so stale assignments
   // cannot carry a vehicle beyond the current taxi-revealed boundary.
   for(let index=0;index<taxis.length;index++){
    const taxi=taxis[index];
    if(taxi.kind!=='explorer'||taxi.status!=='EXPLORING')continue;
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
    if(taxi.kind!=='explorer'||taxi.status!=='IDLE'||taxi.deliveryUntil)continue;
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
    if(taxi.kind!=='explorer'||taxi.status!=='EXPLORING'||taxi.deliveryUntil)continue;
    const remaining=taxi.path.length-1-taxi.leg;
    if(remaining>2||!taxi.path.length)continue;
    const destination=taxi.path[taxi.path.length-1];
    const from=nearest(graph,destination);
    if(!from)continue;
    // This vehicle may continue from its own reserved destination.
    reservedTargets.delete(from);
    const extension=dispatchScout({...taxi,status:'IDLE',position:destination,path:[],edgeIds:[],leg:0,distanceIntoLeg:0},
     graph,explored,hq,reservedTargets,reservedEdges,undefined,allowedRoads);
    if(extension.status!=='EXPLORING'||extension.path.length<2)continue;
    // The nearest node at the destination must match the new route's start.
    if(extension.path[0][0]!==destination[0]||extension.path[0][1]!==destination[1])continue;
    taxis[index]={...taxi,path:[...taxi.path,...extension.path.slice(1)],
     edgeIds:[...taxi.edgeIds,...extension.edgeIds],scoutingRuns:extension.scoutingRuns};
    assignedCount++;
   }
   for(let index=0;index<taxis.length;index++){
    if(taxis[index].kind!=='explorer'||taxis[index].status!=='IDLE'||taxis[index].deliveryUntil)continue;
    const scout=dispatchScout(taxis[index],graph,explored,hq,reservedTargets,reservedEdges,undefined,allowedRoads);
    if(scout.status!=='IDLE'){
     taxis[index]=scout;
     assignedCount++;
    }
   }
  }
  self.postMessage({type:'result',revision:activeRevision,taxis,queue,assignedCount,generatedMission,roadCount:seenRoadIds.size});
 }catch(error){self.postMessage({type:'error',revision:activeRevision,error:String(error)});}
};
