import type {Company} from '../company';
export type Point=[number,number];
export type Taxi={id:string;name:string;driver:string;position:Point;status:'IDLE'|'TO_PICKUP'|'TO_DROPOFF'|'EXPLORING';path:Point[];edgeIds:string[];leg:number;distanceIntoLeg:number;pickup?:Point;dropoff?:Point;fare:number;completed:number;journeyEdges?:string[];scoutingRuns?:number;speedKph?:number};
export type MissionRecord={pickup:string;dropoff:string};
export type FleetState={taxis:Taxi[];revenue:number;completed:number;exploredEdgeIds?:string[];missionHistory?:MissionRecord[]};
export type RoadGraph={nodes:Map<string,Point>;edges:Map<string,{to:string;meters:number;id:string;speedKph:number}[]>;nodeKeys:string[]};
const key=(p:Point)=>`${p[0].toFixed(6)},${p[1].toFixed(6)}`;
export const meters=(a:Point,b:Point)=>{const lat=(a[1]+b[1])*Math.PI/360;return Math.hypot((a[0]-b[0])*111320*Math.cos(lat),(a[1]-b[1])*111320)};
// Road speeds are in km/h; gameplay fallbacks are used only when OSM maxspeed is absent.
export const GAME_SPEED = 4;
const DEFAULT_SPEED: Record<string,number> = {
 motorway:110,motorway_link:60,trunk:100,trunk_link:60,primary:90,primary_link:50,
 secondary:70,secondary_link:45,tertiary:50,tertiary_link:40,
 residential:30,living_street:15,service:20,unclassified:50,road:50,
};
export function roadSpeedKph(properties:Record<string,unknown>):number {
 const roadType=String(properties.highway??properties.roadType??properties.type??'residential').toLowerCase();
 const fallback=DEFAULT_SPEED[roadType]??50;
 const raw=properties.maxspeed??properties.maxSpeed??properties.speedLimit;
 if(typeof raw==='number'&&Number.isFinite(raw)&&raw>0)return Math.min(160,raw);
 if(typeof raw!=='string')return fallback;
 const value=raw.trim().toLowerCase().split(';')[0].trim();
 if(!value||['none','signals','variable','walk','national','implicit','unknown'].includes(value))return fallback;
 const match=value.match(/^(\d+(?:\.\d+)?)\s*(mph|km\/h|kmh|kph)?$/);
 if(!match)return fallback;
 const speed=Number(match[1])*(match[2]==='mph'?1.609344:1);
 return speed>0?Math.min(160,speed):fallback;
}
export async function loadRoadGraph():Promise<RoadGraph>{
 const response=await fetch(`${import.meta.env.BASE_URL}data/roads/preview.geojson`);
 if(!response.ok)throw Error('Road preview not found. Run the offline road extraction first.');
 const json=await response.json() as {features:Array<{properties?:Record<string,unknown>;geometry:{type:string;coordinates:unknown}}>};
 const nodes=new Map<string,Point>();
 const edges=new Map<string,{to:string;meters:number;id:string;speedKph:number}[]>();
 let i=0;
 for(const f of json.features){
  if(f.geometry?.type!=='LineString')continue;
  const coords=f.geometry.coordinates as Point[];
  const props=f.properties??{};
  const id=String(props.segmentId??`edge-${i++}`);
  const oneway=String(props.oneway??'no');
  const speedKph=roadSpeedKph(props);
  for(let j=1;j<coords.length;j++){
   const a=coords[j-1],b=coords[j];
   if(!Array.isArray(a)||!Array.isArray(b))continue;
   const ak=key(a),bk=key(b),length=meters(a,b);
   if(length<0.01)continue;
   nodes.set(ak,a);nodes.set(bk,b);
   const add=(from:string,to:string)=>{
    if(!edges.has(from))edges.set(from,[]);
    edges.get(from)!.push({to,meters:length,id,speedKph});
   };
   if(oneway!=='-1')add(ak,bk);
   if(oneway!=='yes'&&oneway!=='1'&&oneway!=='true')add(bk,ak);
  }
 }
 return{nodes,edges,nodeKeys:[...nodes.keys()]};
}
export function nearest(graph:RoadGraph,point:Point):string{let best='',d=Infinity;for(const k of graph.nodeKeys){const p=graph.nodes.get(k)!;const distance=meters(p,point);if(distance<d){d=distance;best=k;}}return best;}
export function route(graph:RoadGraph,from:string,to:string):{path:Point[];edgeIds:string[];length:number}|null{if(from===to)return{path:[graph.nodes.get(from)!],edgeIds:[],length:0};const dist=new Map([[from,0]]),prev=new Map<string,{from:string;id:string}>();const heap:Array<[number,string]>=[[0,from]];const push=(item:[number,string])=>{heap.push(item);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p][0]<=item[0])break;heap[i]=heap[p];i=p;}heap[i]=item;};const pop=():[number,string]|undefined=>{if(!heap.length)return;const first=heap[0],last=heap.pop()!;if(heap.length){let i=0;while(2*i+1<heap.length){let c=2*i+1;if(c+1<heap.length&&heap[c+1][0]<heap[c][0])c++;if(heap[c][0]>=last[0])break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;};let visits=0;while(heap.length&&visits++<150000){const [d,k]=pop()!;if(d!==(dist.get(k)??Infinity))continue;if(k===to)break;for(const e of graph.edges.get(k)??[]){const nd=d+e.meters;if(nd<(dist.get(e.to)??Infinity)){dist.set(e.to,nd);prev.set(e.to,{from:k,id:e.id});push([nd,e.to]);}}}if(!dist.has(to))return null;const keys=[to],ids:string[]=[];let cur=to;while(cur!==from){const p=prev.get(cur);if(!p)return null;ids.push(p.id);keys.push(p.from);cur=p.from;}keys.reverse();ids.reverse();return{path:keys.map(k=>graph.nodes.get(k)!),edgeIds:ids,length:dist.get(to)!};}
export const fleetKey=(id:string)=>`travelempire.fleet.v0.8.${id}`;
export function loadFleet(id:string):FleetState{try{const saved=JSON.parse(localStorage.getItem(fleetKey(id))??'null') as FleetState|null;if(saved&&Array.isArray(saved.taxis))return saved;}catch{/* ignore invalid save */}return{taxis:[],revenue:0,completed:0,exploredEdgeIds:[]};}
export function saveFleet(id:string,fleet:FleetState){localStorage.setItem(fleetKey(id),JSON.stringify(fleet));}
export const TAXI_COST=18000,DRIVER_COST=1200;
export function purchaseTaxi(company:Company,fleet:FleetState,graph:RoadGraph,driver:string):{company:Company;fleet:FleetState}{if(company.cash<TAXI_COST+DRIVER_COST)throw Error('Insufficient company funds.');if(!driver.trim())throw Error('Enter a driver name.');const start=nearest(graph,[company.headquarters.lng,company.headquarters.lat]);if(!start)throw Error('No roads available near headquarters.');const taxi:Taxi={id:crypto.randomUUID(),name:`Taxi ${fleet.taxis.length+1}`,driver:driver.trim(),position:graph.nodes.get(start)!,status:'IDLE',path:[],edgeIds:[],leg:0,distanceIntoLeg:0,fare:0,completed:0};return{company:{...company,cash:company.cash-TAXI_COST-DRIVER_COST},fleet:{...fleet,taxis:[...fleet.taxis,taxi]}};}
// Passenger stops must be in the 500 m headquarters seed or on a discovered road.
// This predicate is shared by pickup and drop-off selection; coordinates are road nodes
// already, so no later snap can move a stop outside the eligible network.
export function exploredRoadNodes(graph:RoadGraph, explored:Set<string>, hq:Point):string[]{
 const eligible=new Set<string>();
 for(const k of graph.nodeKeys){if(meters(graph.nodes.get(k)!,hq)<=500)eligible.add(k);}
 for(const [from,links] of graph.edges){for(const e of links){if(explored.has(e.id)){eligible.add(from);eligible.add(e.to);}}}
 return [...eligible];
}

// Frontier stops are road nodes immediately beyond the explored network.
// They must connect directly to an eligible node, never an arbitrary unexplored road.
export function explorationFrontierNodes(graph:RoadGraph,explored:Set<string>,hq:Point):string[]{
 const eligible=new Set(exploredRoadNodes(graph,explored,hq));
 const frontier=new Set<string>();
 for(const from of eligible){
  for(const edge of graph.edges.get(from)??[]){
   if(!explored.has(edge.id)&&!eligible.has(edge.to)&&edge.meters<=750){
    frontier.add(edge.to);
   }
  }
 }
 return [...frontier];
}

// WorldFront-inspired generation: sample random geographic coordinates near
// the taxi, snap them to valid road nodes, and validate both road routes.
// Do not use fixed location lists, distance bands, or historical weights.
export function dispatch(taxi:Taxi,graph:RoadGraph,explored:Set<string>,hq:Point,_history:MissionRecord[]=[]):Taxi{
 if(taxi.status!=='IDLE'||graph.nodeKeys.length<2)return taxi;
 const from=nearest(graph,taxi.position);
 const eligible=exploredRoadNodes(graph,explored,hq);
 const frontier=explorationFrontierNodes(graph,explored,hq);
 if(!eligible.length)return taxi;
 const pickupPoints=eligible.filter(k=>meters(graph.nodes.get(k)!,taxi.position)<=3500);
 if(!pickupPoints.length)return taxi;
 const destinations=[...new Set([...eligible,...frontier])];
 const pointNear=(origin:Point,radius:number):Point=>{
  const distance=radius*Math.sqrt(Math.random());
  const angle=Math.random()*2*Math.PI;
  const lat=origin[1]+Math.sin(angle)*distance/111320;
  const lon=origin[0]+Math.cos(angle)*distance/(111320*Math.max(0.1,Math.cos(origin[1]*Math.PI/180)));
  return [lon,lat];
 };
 // Snap a random geographical location to a road node. Sampling uniformly
 // across area, rather than from the road-node list, reduces dense-road bias.
 const snap=(sample:Point,keys:string[],maxSnap:number):string|undefined=>{
  let best:string|undefined;let distance=maxSnap;
  for(const k of keys){
   const d=meters(graph.nodes.get(k)!,sample);
   if(d<distance){distance=d;best=k;}
  }
  return best;
 };
 for(let attempt=0;attempt<100;attempt++){
  const pickupKey=snap(pointNear(taxi.position,3500),pickupPoints,600);
  if(!pickupKey)continue;
  const pickupPoint=graph.nodes.get(pickupKey)!;
  const pickup=route(graph,from,pickupKey);
  if(!pickup||pickup.length>4500||pickup.length<50)continue;
  // Pick a random destination direction and radius; the current local road
  // graph limits maximum distance until region packages are integrated.
  const dropKey=snap(pointNear(pickupPoint,3000),destinations,600);
  if(!dropKey||dropKey===pickupKey)continue;
  const drop=route(graph,pickupKey,dropKey);
  if(!drop||drop.length<120||drop.length>3500)continue;
  return {...taxi,status:'TO_PICKUP',path:pickup.path,edgeIds:pickup.edgeIds,
   journeyEdges:[],leg:0,distanceIntoLeg:0,pickup:pickupPoint,
   dropoff:graph.nodes.get(dropKey),fare:Math.round((4+drop.length/1000*1.8)*100)/100};
 }
 return taxi;
}

// Shared integrator: simulation and marker animation use exactly the same road speeds.
// Acceleration/deceleration is expressed in simulated seconds (4x wall time).
export function advanceTaxi(taxi:Taxi,graph:RoadGraph,realSeconds:number):{taxi:Taxi;crossed:string[]}{
 if(taxi.status==='IDLE'||taxi.path.length<2||realSeconds<=0)return{taxi,crossed:[]};
 let t={...taxi};
 const crossed:string[]=[];
 let time=Math.min(realSeconds,5)*GAME_SPEED;
 // Short steps avoid overshooting junctions and make transitions smooth.
 while(time>0.00001&&t.leg<t.path.length-1){
  const a=t.path[t.leg],b=t.path[t.leg+1];
  const length=meters(a,b);
  const edge=graph.edges.get(key(a))?.find(e=>e.to===key(b)&&e.id===t.edgeIds[t.leg]);
  const limitKph=edge?.speedKph??50;
  const target=limitKph/3.6;
  const dt=Math.min(0.1,time);
  const previous=Math.max(0,t.speedKph??0)/3.6;
  const acceleration=target>=previous?2:3.5;
  const speed=previous+Math.sign(target-previous)*Math.min(Math.abs(target-previous),acceleration*dt);
  t.speedKph=speed*3.6;
  const distance=(previous+speed)/2*dt;
  const available=Math.max(0,length-t.distanceIntoLeg);
  const moved=Math.min(distance,available);
  t.distanceIntoLeg+=moved;
  const fraction=length>0?Math.min(1,t.distanceIntoLeg/length):1;
  t.position=[a[0]+(b[0]-a[0])*fraction,a[1]+(b[1]-a[1])*fraction];
  if(t.distanceIntoLeg>=length-0.0001){
   const id=t.edgeIds[t.leg];if(id)crossed.push(id);
   t.leg++;t.distanceIntoLeg=0;t.position=b;
  }
  time-=dt;
 }
 return{taxi:t,crossed};
}
export function tickTaxi(taxi:Taxi,graph:RoadGraph,seconds:number):{taxi:Taxi;earned:number;finished:boolean;discovered:string[]}{
 // Cancel any legacy scouting job restored from an older local save.
 if(taxi.status==='EXPLORING')return{taxi:{...taxi,status:'IDLE',path:[],edgeIds:[],journeyEdges:[],leg:0,distanceIntoLeg:0,pickup:undefined,dropoff:undefined,fare:0,speedKph:0},earned:0,finished:false,discovered:[]};
 if(taxi.status==='IDLE')return{taxi,earned:0,finished:false,discovered:[]};
 const advanced=advanceTaxi(taxi,graph,seconds);
 let t={...advanced.taxi,journeyEdges:[...(taxi.journeyEdges??[]),...advanced.crossed]};
 if(t.leg<t.path.length-1)return{taxi:t,earned:0,finished:false,discovered:[]};
 if(t.status==='TO_PICKUP'&&t.dropoff){
  const from=nearest(graph,t.position),to=nearest(graph,t.dropoff);
  const next=route(graph,from,to);
  if(next&&next.path.length>1){
   t={...t,status:'TO_DROPOFF',path:next.path,edgeIds:next.edgeIds,leg:0,distanceIntoLeg:0};
   return{taxi:t,earned:0,finished:false,discovered:[]};
  }
 }
 const earned=t.status==='TO_DROPOFF'?t.fare:0;
 const discovered=[...new Set(t.journeyEdges??[])];
 t={...t,status:'IDLE',path:[],edgeIds:[],leg:0,distanceIntoLeg:0,
  pickup:undefined,dropoff:undefined,fare:0,journeyEdges:[],speedKph:0,
  completed:t.completed+(earned?1:0)};
 return{taxi:t,earned,finished:earned>0,discovered};
}
