import {dispatchScout,nearest,type Taxi,type RoadGraph,type Point} from './taxi';
import type {RoadSegment} from '../data/roadTiles';
import {explorerClassEligible} from './explorerRoles';

type Init={type:'init';revision:number};
type Roads={type:'addRoads';revision:number;roads:RoadSegment[]};
type Plan={type:'plan';revision:number;requestId:number;vehicle:Taxi;
 explored:string[];reservedRoads:string[];reservedDestinations:string[];
 hq:Point;poiRoadIds:string[];poiTargets:Point[];};
type Message=Init|Roads|Plan;

let revision=0;
let graph:RoadGraph={nodes:new Map(),edges:new Map(),nodeKeys:[]};
const known=new Set<string>();
const roadClasses=new Map<string,Set<string>>();
let roadCount=0;
const roleAllowed=(role:Taxi['explorerRole'],poiRoadIds:string[]):Set<string>=>{
 if(role==='poi')return new Set(poiRoadIds);
 if(!role||role==='balanced')return known;
 let result=roadClasses.get(role);
 if(result)return result;
 result=new Set<string>();
 // Road-class index is updated incrementally as batches arrive.
 roadClasses.set(role,result);
 return result;
};
function addRoads(roads:RoadSegment[]):void{
 for(const road of roads){
  if(known.has(road.id)||road.coordinates?.length!==2||!Number.isFinite(road.length)||road.length<=0)continue;
  known.add(road.id);roadCount++;
  const a=String(road.a),b=String(road.b);
  if(!graph.nodes.has(a)){graph.nodes.set(a,road.coordinates[0]);graph.nodeKeys.push(a);}
  if(!graph.nodes.has(b)){graph.nodes.set(b,road.coordinates[1]);graph.nodeKeys.push(b);}
  const add=(from:string,to:string)=>{
   const edges=graph.edges.get(from)??[];
   edges.push({id:road.id,to,meters:road.length,speedKph:road.speed,highway:road.highway});
   graph.edges.set(from,edges);
  };
  if(road.oneway!==-1)add(a,b);
  if(road.oneway!==1)add(b,a);
  const roles:Taxi['explorerRole'][]=['highway','primary','secondary','residential'];
  for(const role of roles)if(explorerClassEligible(role,road.highway)){
   let set=roadClasses.get(role!);
   if(!set){set=new Set();roadClasses.set(role!,set);}
   set.add(road.id);
  }
 }
}
self.onmessage=async(event:MessageEvent<Message>)=>{
 const msg=event.data;
 if(msg.type==='init'){
  revision=msg.revision;
  graph={nodes:new Map(),edges:new Map(),nodeKeys:[]};
  known.clear();roadClasses.clear();roadCount=0;
  self.postMessage({type:'ready',revision,roadCount});return;
 }
 if(msg.revision!==revision)return;
 if(msg.type==='addRoads'){
  addRoads(msg.roads);
  self.postMessage({type:'roadsAdded',revision,roadCount});return;
 }
 const started=performance.now();
 const explored=new Set(msg.explored);
 const currentNode=nearest(graph,msg.vehicle.position);
 // Never start on an arbitrary nearby or remotely selected road.
 if(!currentNode||!(graph.edges.get(currentNode)??[]).some(e=>explored.has(e.id))){
  self.postMessage({type:'planResult',revision,requestId:msg.requestId,vehicleId:msg.vehicle.id,
   outcome:'no-purple-start',roadCount,ms:performance.now()-started});return;
 }
 try{
  const valid=new Set(roleAllowed(msg.vehicle.explorerRole,msg.poiRoadIds));
  const planned=await dispatchScout({...msg.vehicle,status:'IDLE'},
   graph,explored,msg.hq,new Set(msg.reservedDestinations),new Set(msg.reservedRoads),
   undefined,known,valid,undefined,undefined,undefined,msg.poiTargets,undefined,undefined,
   ()=>revision===msg.revision);
  const assigned=planned.status==='EXPLORING'&&planned.path.length>=2;
  self.postMessage({type:'planResult',revision,requestId:msg.requestId,vehicleId:msg.vehicle.id,
   outcome:assigned?'planned':'no-reachable-target',taxi:assigned?planned:undefined,
   roadCount,ms:performance.now()-started});
 }catch(error){
  self.postMessage({type:'planResult',revision,requestId:msg.requestId,vehicleId:msg.vehicle.id,
   outcome:'error',error:String(error),roadCount,ms:performance.now()-started});
 }
};
