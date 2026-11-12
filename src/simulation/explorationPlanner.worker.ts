import {routeToNearestTarget,type Taxi,type RoadGraph,type Point} from './taxi';
import {resolvePurpleExplorerStart,prependPurpleStart} from './explorerStart';
import {planReachableExplorerRoad} from './explorerRoadPlanner';
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
const roadEndpoints=new Map<string,[string,string]>();
const ROAD_CELL=0.02;
const localRoads=new Map<string,Set<string>>();
const roadCell=(lat:number,lon:number)=>lat+':'+lon;
function nearbyRoads(point:Point):Set<string>{
 const lat=Math.floor(point[1]/ROAD_CELL),lon=Math.floor(point[0]/ROAD_CELL);
 const nearby=new Set<string>();
 for(let y=lat-1;y<=lat+1;y++)for(let x=lon-1;x<=lon+1;x++)
  for(const id of localRoads.get(roadCell(y,x))??[])nearby.add(id);
 return nearby;
}
let roadCount=0;
const roleAllowed=(role:Taxi['explorerRole'],poiRoadIds:string[]):Set<string>=>{
 if(role==='poi')return known;
 if(!role||role==='balanced')return known;
 let result=roadClasses.get(role);
 if(result)return result;
 result=new Set<string>();
 // Road-class index is updated incrementally as batches arrive.
 roadClasses.set(role,result);
 return result;
};
function shortestHarbourRoute(start:string,explored:Set<string>,poiRoadIds:string[]){
 const targets:Array<{node:string;offsetMeters:number}>=[];
 const finalLegs:Array<{to:string;id:string}>=[];
 for(const id of poiRoadIds){
  if(explored.has(id))continue;
  const ends=roadEndpoints.get(id);if(!ends)continue;
  for(const from of ends)for(const edge of graph.edges.get(from)??[]){
   if(edge.id!==id)continue;
   targets.push({node:from,offsetMeters:edge.meters});
   finalLegs.push({to:edge.to,id});
  }
 }
 const found=routeToNearestTarget(graph,start,targets,'',150000);
 if(!found)return null;
 const leg=finalLegs[found.targetIndex],point=graph.nodes.get(leg.to);
 if(!point)return null;
 const edgeIds=[...found.edgeIds,leg.id];
 return {path:[...found.path,point],edgeIds,
  discoveryEdgeIds:[...new Set(edgeIds.filter(id=>!explored.has(id)))],
  escapeTransitEdgeIds:[] as string[]};
}
function addRoads(roads:RoadSegment[]):void{
 for(const road of roads){
  if(known.has(road.id)||road.coordinates?.length!==2||!Number.isFinite(road.length)||road.length<=0)continue;
  known.add(road.id);roadCount++;
  roadEndpoints.set(road.id,[String(road.a),String(road.b)]);
  const [fromPoint,toPoint]=road.coordinates;
  for(const p of [fromPoint,toPoint,
   [(fromPoint[0]+toPoint[0])/2,(fromPoint[1]+toPoint[1])/2] as Point]){
   const cell=roadCell(Math.floor(p[1]/ROAD_CELL),Math.floor(p[0]/ROAD_CELL));
   let bucket=localRoads.get(cell);
   if(!bucket){bucket=new Set();localRoads.set(cell,bucket);}
   bucket.add(road.id);
  }
  const a=String(road.a),b=String(road.b);
  if(!graph.nodes.has(a)){graph.nodes.set(a,road.coordinates[0]);graph.nodeKeys.push(a);}
  if(!graph.nodes.has(b)){graph.nodes.set(b,road.coordinates[1]);graph.nodeKeys.push(b);}
  const add=(from:string,to:string)=>{
   const edges=graph.edges.get(from)??[];
   edges.push({id:road.id,to,meters:road.length,speedKph:road.speed,highway:road.highway,layer:road.layer,bridge:road.bridge,tunnel:road.tunnel,level:road.level});
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
  known.clear();roadClasses.clear();roadEndpoints.clear();localRoads.clear();roadCount=0;
  self.postMessage({type:'ready',revision,roadCount});return;
 }
 if(msg.revision!==revision)return;
 if(msg.type==='addRoads'){
  addRoads(msg.roads);
  self.postMessage({type:'roadsAdded',revision,roadCount});return;
 }
 const started=performance.now();
 const explored=new Set(msg.explored);
 const origin=resolvePurpleExplorerStart(graph,msg.vehicle.position,explored,roadEndpoints,20,
  nearbyRoads(msg.vehicle.position));
 // The nearest graph node can belong to a red road, even if the vehicle is
 // parked on a purple segment. Select a legal endpoint of that segment.
 if(!origin){
  self.postMessage({type:'planResult',revision,requestId:msg.requestId,vehicleId:msg.vehicle.id,
   outcome:'no-purple-segment-near-vehicle',roadCount,ms:performance.now()-started});return;
 }
 const currentNode=origin.node;
 try{
  const valid=new Set(roleAllowed(msg.vehicle.explorerRole,msg.poiRoadIds));
  const planned=msg.vehicle.explorerRole==='poi'?null:planReachableExplorerRoad(graph,currentNode,explored,valid,
   new Set(msg.reservedRoads),new Set(msg.reservedDestinations),
   msg.vehicle.explorerRole);
  const candidate=msg.vehicle.explorerRole==='poi'
   ?shortestHarbourRoute(currentNode,explored,msg.poiRoadIds)
   :planned?.route??null;
  const route=candidate?prependPurpleStart(candidate,origin):null;
  self.postMessage({type:'planResult',revision,requestId:msg.requestId,
   vehicleId:msg.vehicle.id,outcome:route?'planned':planned?.diagnostic.reason??'no-reachable-harbour',
   taxi:route?{...msg.vehicle,status:'EXPLORING',path:route.path,
    edgeIds:route.edgeIds,discoveryEdgeIds:route.discoveryEdgeIds,
    escapeTransitEdgeIds:candidate?.escapeTransitEdgeIds??[],
    journeyEdges:[],leg:0,distanceIntoLeg:0,
    scoutingRuns:(msg.vehicle.scoutingRuns??0)+1}:undefined,
   diagnostic:planned?.diagnostic,roadCount,ms:performance.now()-started});
 }catch(error){
  self.postMessage({type:'planResult',revision,requestId:msg.requestId,vehicleId:msg.vehicle.id,
   outcome:'error',error:String(error),roadCount,ms:performance.now()-started});
 }
};
