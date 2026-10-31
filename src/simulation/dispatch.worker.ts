import {createPassengerRequest,assignPassenger,dispatchScout,meters,type RoadGraph,type Taxi,type PassengerRequest,type Point} from './taxi';
let graph:RoadGraph|null=null;
let activeRevision=0;
const seenRoadIds=new Set<string>();
type Init={type:'init';revision:number};
type AddRoads={type:'addRoads';revision:number;roads:import('../data/regionalRoads').RegionalRoad[]};
type Dispatch={type:'dispatch';revision:number;now:number;taxis:Taxi[];queue:PassengerRequest[];discovered:string[];hq:Point;allowMission:boolean;allowScout:boolean};
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
  const queue=msg.queue.filter(m=>m.expiresAt>now);
  let generatedMission=false;
  if(msg.allowMission&&queue.length<Math.min(8,Math.max(3,taxis.length*2))){
   const request=createPassengerRequest(graph,explored,hq,now);
   if(request){queue.push(request);generatedMission=true;}
  }
  for(let i=queue.length-1;i>=0;i--){
   const mission=queue[i];
   const candidates=taxis.map((t,index)=>({index,d:t.status==='IDLE'&&!t.deliveryUntil?meters(t.position,mission.pickup):Infinity}))
    .filter(c=>Number.isFinite(c.d)).sort((a,b)=>a.d-b.d).slice(0,3);
   let best:{index:number;taxi:Taxi;distance:number}|null=null;
   for(const candidate of candidates){
    const assigned=assignPassenger(taxis[candidate.index],graph,mission);
    if(!assigned)continue;
    const distance=assigned.path.reduce((sum,p,j)=>j?sum+meters(p,assigned.path[j-1]):sum,0);
    if(!best||distance<best.distance)best={index:candidate.index,taxi:assigned,distance};
   }
   if(best){taxis[best.index]=best.taxi;queue.splice(i,1);}
  }
  // An unreachable waiting passenger must not block all scouting.
  let assignedCount=0;
  if(msg.allowScout){
   for(let index=0;index<taxis.length;index++){
    if(taxis[index].status!=='IDLE'||taxis[index].deliveryUntil)continue;
    const scout=dispatchScout(taxis[index],graph,explored,hq);
    if(scout.status!=='IDLE'){taxis[index]=scout;assignedCount++;break;}
   }
  }
  self.postMessage({type:'result',revision:activeRevision,taxis,queue,assignedCount,generatedMission,roadCount:seenRoadIds.size});
 }catch(error){self.postMessage({type:'error',revision:activeRevision,error:String(error)});}
};
