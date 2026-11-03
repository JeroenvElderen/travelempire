import {fareForDistance} from './demand';
import type {Company} from '../company';
export type Point=[number,number];
export type Taxi = {
  id: string;
  kind?: 'taxi' | 'explorer' | 'surveyor'; // Older saves default to taxi.
  name: string;
  driver: string;
  position: Point;

  status: 'IDLE' | 'TO_PICKUP' | 'TO_DROPOFF' | 'EXPLORING' | 'RETURNING' | 'REFUELLING' | 'SERVICING' | 'PAUSED';

  path: Point[];
  edgeIds: string[];
  leg: number;
  distanceIntoLeg: number;

  pickup?: Point;
  dropoff?: Point;

  fare: number;
  completed: number;
  journeyEdges?: string[];
  scoutingRuns?: number;
  pauseAtHome?: boolean;
  depotId?: string;
  // Edges eligible for discovery on this assignment; transit edges are excluded.
  discoveryEdgeIds?: string[];
  speedKph?: number;

  // Dealership vehicle information
  vehicleModel?: string;
  vehicleYear?: number;
  vehicleFuel?: string;
  vehicleClass?: string;
  vehicleCondition?: number;
  vehicleMileage?: number;
  operatingKm?: number;
  fuelExpense?: number;
  maintenanceExpense?: number;
  explorationExpense?: number;
  tripRevenue?: number;
  driverWages?: number;
  insuranceExpense?: number;
  serviceCount?: number;
  lastServiceKm?: number;
  fuelLitres?: number;
  energyRemaining?: number;
  energyPurchased?: number;
  refillDestination?: Point;
  refillAtDepot?: boolean;
  refillUntil?: number;
  refillRequested?: boolean;
  serviceUntil?: number;

  // Vehicle delivery information
  deliveryStartedAt?: number;
  deliveryUntil?: number;
  deliveryPath?: Point[];
};
export type MissionRecord={pickup:string;dropoff:string};
export type DriverRecord={id:string;name:string;hiredAt:number;completedTrips?:number;distanceKm?:number;revenueGenerated?:number;wagesEarned?:number};
export const driverLevel=(trips:number)=>trips>=100?'Expert':trips>=30?'Experienced':trips>=10?'Developing':'Novice';
export const driverSkill=(trips:number)=>Math.min(5,1+Math.floor(Math.max(0,trips)/25));
export type BusinessLoan={id:string;principal:number;balance:number;annualRate:number;termDays:number;remainingDays:number;dailyPayment:number;accruedGameSeconds:number};
export type EconomyUpgrade='fuel'|'workshop'|'dispatch'|'training'|'depot-capacity';
export type FleetState={loans?:BusinessLoan[];upgrades?:EconomyUpgrade[];overheadExpense?:number;loanInterestExpense?:number;loanPrincipalPaid?:number;drivers?:DriverRecord[];taxis:Taxi[];revenue:number;completed:number;exploredEdgeIds?:string[];territoryEdgeIds?:string[];missionHistory?:MissionRecord[];fuelExpense?:number;maintenanceExpense?:number;distanceKm?:number;driverWages?:number;insuranceExpense?:number;serviceExpense?:number;explorationExpense?:number;transactions?:FinancialTransaction[]};
export type FinancialTransaction={id:string;time:number;taxiId?:string;description:string;amount:number};
export type RoadGraph={nodes:Map<string,Point>;edges:Map<string,{to:string;meters:number;id:string;speedKph:number}[]>;nodeKeys:string[]};
const key=(p:Point)=>`${p[0].toFixed(6)},${p[1].toFixed(6)}`;
export const meters=(a:Point,b:Point)=>{const lat=(a[1]+b[1])*Math.PI/360;return Math.hypot((a[0]-b[0])*111320*Math.cos(lat),(a[1]-b[1])*111320)};
// Road speeds are in km/h; gameplay fallbacks are used only when OSM maxspeed is absent.
export const GAME_SPEED = 1;
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
// Spatial lookup for road nodes. Cache per graph and append new nodes when the
// road manager extends an existing graph. WeakMap allows old graphs to be GC'd.
const NEAREST_CELL_DEGREES = 0.005;
type NearestIndex = {cells: Map<number, Map<number, string[]>>; count: number; minLat: number; maxLat: number};
const nearestIndexes = new WeakMap<RoadGraph, NearestIndex>();
function roadNodeIndex(graph: RoadGraph): NearestIndex {
 let index = nearestIndexes.get(graph);
 if (!index || index.count > graph.nodeKeys.length) {
  index = {cells: new Map(), count: 0, minLat: Infinity, maxLat: -Infinity};
  nearestIndexes.set(graph, index);
 }
 for (let i = index.count; i < graph.nodeKeys.length; i++) {
  const k = graph.nodeKeys[i];
  const p = graph.nodes.get(k);
  if (!p) continue;
  const x = Math.floor(p[0] / NEAREST_CELL_DEGREES);
  const y = Math.floor(p[1] / NEAREST_CELL_DEGREES);
  let column = index.cells.get(x);
  if (!column) {column = new Map(); index.cells.set(x, column);}
  let cell = column.get(y);
  if (!cell) {cell = []; column.set(y, cell);}
  cell.push(k);
  index.minLat = Math.min(index.minLat, p[1]);
  index.maxLat = Math.max(index.maxLat, p[1]);
 }
 index.count = graph.nodeKeys.length;
 return index;
}
export function nearest(graph: RoadGraph, point: Point): string {
 if (!graph.nodeKeys.length) return '';
 const index = roadNodeIndex(graph);
 const size = NEAREST_CELL_DEGREES;
 const cx = Math.floor(point[0] / size), cy = Math.floor(point[1] / size);
 let best = '', distance = Infinity;
 const visit = (x: number, y: number) => {
  const cell = index.cells.get(x)?.get(y);
  if (!cell) return;
  for (const k of cell) {
   const p = graph.nodes.get(k);
   if (!p) continue;
   const d = meters(p, point);
   if (d < distance) {distance = d; best = k;}
  }
 };
 // Examine square rings. Stop only when the nearest point outside the square
 // cannot beat the current best. The latitude factor is conservative for all
 // nodes in the graph, so the original nearest-node semantics are preserved.
 const minCos = Math.max(0.001, Math.cos(Math.max(
  Math.abs((point[1] + index.minLat) * Math.PI / 360),
  Math.abs((point[1] + index.maxLat) * Math.PI / 360)
 )));
 for (let ring = 0; ; ring++) {
  if (ring === 0) visit(cx, cy);
  else {
   for (let x = cx - ring; x <= cx + ring; x++) {
    visit(x, cy - ring);
    visit(x, cy + ring);
   }
   for (let y = cy - ring + 1; y < cy + ring; y++) {
    visit(cx - ring, y);
    visit(cx + ring, y);
   }
  }
  if (best) {
   const west = (point[0] - (cx - ring) * size) * 111320 * minCos;
   const east = ((cx + ring + 1) * size - point[0]) * 111320 * minCos;
   const south = (point[1] - (cy - ring) * size) * 111320;
   const north = ((cy + ring + 1) * size - point[1]) * 111320;
   if (Math.min(west, east, south, north) > distance) return best;
  }
  // The index is finite; this guard handles queries far outside the network.
  if (ring > 100000) return best;
 }
}
export function route(graph:RoadGraph,from:string,to:string):{path:Point[];edgeIds:string[];length:number}|null{if(from===to)return{path:[graph.nodes.get(from)!],edgeIds:[],length:0};const dist=new Map([[from,0]]),prev=new Map<string,{from:string;id:string}>();const heap:Array<[number,string]>=[[0,from]];const push=(item:[number,string])=>{heap.push(item);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p][0]<=item[0])break;heap[i]=heap[p];i=p;}heap[i]=item;};const pop=():[number,string]|undefined=>{if(!heap.length)return;const first=heap[0],last=heap.pop()!;if(heap.length){let i=0;while(2*i+1<heap.length){let c=2*i+1;if(c+1<heap.length&&heap[c+1][0]<heap[c][0])c++;if(heap[c][0]>=last[0])break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;};let visits=0;while(heap.length&&visits++<150000){const [d,k]=pop()!;if(d!==(dist.get(k)??Infinity))continue;if(k===to)break;for(const e of graph.edges.get(k)??[]){const nd=d+e.meters;if(nd<(dist.get(e.to)??Infinity)){dist.set(e.to,nd);prev.set(e.to,{from:k,id:e.id});push([nd,e.to]);}}}if(!dist.has(to))return null;const keys=[to],ids:string[]=[];let cur=to;while(cur!==from){const p=prev.get(cur);if(!p)return null;ids.push(p.id);keys.push(p.from);cur=p.from;}keys.reverse();ids.reverse();return{path:keys.map(k=>graph.nodes.get(k)!),edgeIds:ids,length:dist.get(to)!};}
export const fleetKey=(id:string)=>`travelempire.fleet.v0.8.${id}`;
export function loadFleet(id:string):FleetState{try{const saved=JSON.parse(localStorage.getItem(fleetKey(id))??'null') as FleetState|null;if(saved&&Array.isArray(saved.taxis)){
  // Migrate legacy saves without changing any existing taxi assignment.
  const names=new Set<string>();for(const taxi of saved.taxis)if(taxi.driver?.trim())names.add(taxi.driver.trim());
  const roster=saved.drivers??[];for(const name of names)if(!roster.some(d=>d.name.toLowerCase()===name.toLowerCase()))roster.push({id:crypto.randomUUID(),name,hiredAt:Date.now()});
  // PR A saved Black Explorers as 'explorer'; migrate only those vehicles.
  const taxis=saved.taxis.map(t=>t.kind==='explorer'&&(t.vehicleModel==='Black Explorer'||t.name==='Black Explorer')?{...t,kind:'surveyor' as const}:t);
  return {...saved,taxis,drivers:roster};
 }}catch{/* ignore invalid save */}return{taxis:[],revenue:0,completed:0,exploredEdgeIds:[]};}
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

// Explorer targets are *inside* undiscovered road networks, not passenger stops
// on the already explored boundary. Follow outward, connected, unvisited roads.
export function explorationFrontierNodes(graph:RoadGraph,explored:Set<string>,hq:Point):string[]{
 const eligible=new Set(exploredRoadNodes(graph,explored,hq));
 const frontier=new Set<string>();
 const visited=new Set<string>();
 const queue:Array<{node:string;distance:number}>=[];
 for(const from of eligible){
  for(const edge of graph.edges.get(from)??[]){
   if(!explored.has(edge.id)&&edge.meters<=750&&!eligible.has(edge.to)&&!visited.has(edge.to)){
    visited.add(edge.to);
    queue.push({node:edge.to,distance:edge.meters});
   }
  }
 }
 // Continue past the boundary so explorers spend time discovering NEW roads,
 // rather than driving only to the next node beside the existing fog edge.
 let cursor=0;
 while(cursor<queue.length&&cursor<12000){
  const current=queue[cursor++];
  if(current.distance>=450)frontier.add(current.node);
  if(current.distance>=2500)continue;
  for(const edge of graph.edges.get(current.node)??[]){
   if(explored.has(edge.id)||edge.meters>750||eligible.has(edge.to)||visited.has(edge.to))continue;
   const distance=current.distance+edge.meters;
   if(distance>3000)continue;
   visited.add(edge.to);
   queue.push({node:edge.to,distance});
  }
 }
 // Very short isolated streets must still be explorable.
 if(!frontier.size)for(const item of queue)frontier.add(item.node);
 return [...frontier];
}

// WorldFront-inspired generation: sample random geographic coordinates near
// the taxi, snap them to valid road nodes, and validate both road routes.
// Do not use fixed location lists, distance bands, or historical weights.
export function dispatch(taxi:Taxi,graph:RoadGraph,explored:Set<string>,hq:Point,_history:MissionRecord[]=[]):Taxi{
 if(taxi.status!=='IDLE'||graph.nodeKeys.length<2)return taxi;
 const from=nearest(graph,taxi.position);
 const eligible=exploredRoadNodes(graph,explored,hq);
 if(!eligible.length)return taxi;
 const pickupPoints=eligible.filter(k=>meters(graph.nodes.get(k)!,taxi.position)<=3500);
 if(!pickupPoints.length)return taxi;
 // Passenger destinations must never be on the unexplored frontier.
 const destinations=eligible;
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

// A shared pool of passenger requests, independent of the number of idle taxis.
export type PassengerRequest={id:string;pickup:Point;dropoff:Point;fare:number;createdAt:number;expiresAt:number};
// A passenger stop is valid only at a node touching an Explorer-discovered edge.
export function passengerRoadNodes(graph:RoadGraph,discovered:Set<string>):Set<string>{
 const eligible=new Set<string>();
 for(const [from,links] of graph.edges)for(const edge of links)if(discovered.has(edge.id)){
  eligible.add(from);eligible.add(edge.to);
 }
 return eligible;
}
export function createPassengerRequest(graph:RoadGraph,explored:Set<string>,_hq:Point,now=Date.now(),fareMultiplier=1):PassengerRequest|null{
 const allEligible=[...passengerRoadNodes(graph,explored)];
 if(allEligible.length<2)return null;
 const eligible=allEligible.length>3000?Array.from({length:3000},()=>allEligible[Math.floor(Math.random()*allEligible.length)]):allEligible;
 for(let attempt=0;attempt<35;attempt++){
  const from=eligible[Math.floor(Math.random()*eligible.length)];
  const near=eligible.filter(k=>{const d=meters(graph.nodes.get(k)!,graph.nodes.get(from)!);return d>=200&&d<=4000;});
  if(!near.length)continue;
  const to=near[Math.floor(Math.random()*near.length)];
  // No passenger journey may traverse an undiscovered road.
  const trip=routeDiscovered(graph,from,to,explored);
  if(!trip||trip.length<150||trip.length>5000)continue;
  return{id:crypto.randomUUID(),pickup:graph.nodes.get(from)!,dropoff:graph.nodes.get(to)!,fare:fareForDistance(trip.length,fareMultiplier),createdAt:now,expiresAt:now+120000};
 }
 return null;
}
export function routeDiscovered(graph:RoadGraph,from:string,to:string,discovered:Set<string>):ReturnType<typeof route>{
 if(from===to)return{path:[graph.nodes.get(from)!],edgeIds:[],length:0};
 const dist=new Map<string,number>([[from,0]]),prev=new Map<string,{from:string;id:string}>();
 const heap:Array<[number,string]>=[[0,from]];
 while(heap.length){
  heap.sort((a,b)=>b[0]-a[0]);
  const [d,k]=heap.pop()!;
  if(d!==(dist.get(k)??Infinity))continue;
  if(k===to)break;
  for(const edge of graph.edges.get(k)??[]){
   if(!discovered.has(edge.id))continue;
   const nd=d+edge.meters;
   if(nd<(dist.get(edge.to)??Infinity)){
    dist.set(edge.to,nd);prev.set(edge.to,{from:k,id:edge.id});heap.push([nd,edge.to]);
   }
  }
 }
 if(!dist.has(to))return null;
 const keys=[to],ids:string[]=[];let current=to;
 while(current!==from){
  const step=prev.get(current);if(!step)return null;
  ids.push(step.id);keys.push(step.from);current=step.from;
 }
 keys.reverse();ids.reverse();
 return{path:keys.map(k=>graph.nodes.get(k)!),edgeIds:ids,length:dist.get(to)!};
}
export function assignPassenger(taxi:Taxi,graph:RoadGraph,mission:PassengerRequest,discovered?:Set<string>):Taxi|null{
 if(taxi.status!=='IDLE')return null;
 const start=nearest(graph,taxi.position),pickup=nearest(graph,mission.pickup);
 if(!start||!pickup)return null;
 if(discovered){
  const eligible=passengerRoadNodes(graph,discovered);
  if(!eligible.has(pickup)||!eligible.has(nearest(graph,mission.dropoff)))return null;
 }
 const toPickup=discovered?routeDiscovered(graph,start,pickup,discovered):route(graph,start,pickup);
 if(!toPickup||toPickup.length>6500)return null;
 return{...taxi,status:'TO_PICKUP',path:toPickup.path,edgeIds:toPickup.edgeIds,journeyEdges:[],leg:0,distanceIntoLeg:0,pickup:mission.pickup,dropoff:mission.dropoff,fare:mission.fare};
}
// Systematic exploration: finish undiscovered streets connected to the revealed
// network before pushing the frontier outward. Never choose random destinations.

// A road is eligible for discovery only when it intersects the Black Explorer's
// 150 m territory corridor. Travel through other roads is still permitted.
// Work in locally projected metres, including closest-point checks on segments
// (not merely endpoint checks), to handle long road segments.
export function territoryDiscoveryEdges(graph:RoadGraph,territory:Set<string>,radius=150):Set<string>{
 const allowed=new Set<string>();
 if(!territory.size)return allowed;
 type Segment={a:Point;b:Point};
 const territorySegments:Segment[]=[];
 const seenTerritory=new Set<string>();
 for(const [from,links] of graph.edges){
  const a=graph.nodes.get(from);if(!a)continue;
  for(const edge of links){
   if(!territory.has(edge.id))continue;
   const b=graph.nodes.get(edge.to);if(!b)continue;
   const segmentKey=[from,edge.to].sort().join('|');
   if(seenTerritory.has(segmentKey))continue;
   seenTerritory.add(segmentKey);territorySegments.push({a,b});
  }
 }
 if(!territorySegments.length)return allowed;
 const cell=0.003;
 const grid=new Map<string,Segment[]>();
 const cellKey=(x:number,y:number)=>x+','+y;
 for(const seg of territorySegments){
  const minX=Math.floor((Math.min(seg.a[0],seg.b[0])-0.002)/cell);
  const maxX=Math.floor((Math.max(seg.a[0],seg.b[0])+0.002)/cell);
  const minY=Math.floor((Math.min(seg.a[1],seg.b[1])-0.002)/cell);
  const maxY=Math.floor((Math.max(seg.a[1],seg.b[1])+0.002)/cell);
  for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++){
   const k=cellKey(x,y),items=grid.get(k)??[];items.push(seg);grid.set(k,items);
  }
 }
 const pointSegmentDistance=(p:[number,number],a:[number,number],b:[number,number])=>{
  const dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy;
  const t=len?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len)):0;
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
 };
 const close=(a:Point,b:Point,c:Point,d:Point)=>{
  const latitude=(a[1]+b[1]+c[1]+d[1])/4*Math.PI/180;
  const x=111320*Math.cos(latitude),y=111320;
  const A:[number,number]=[a[0]*x,a[1]*y],B:[number,number]=[b[0]*x,b[1]*y];
  const C:[number,number]=[c[0]*x,c[1]*y],D:[number,number]=[d[0]*x,d[1]*y];
  const cross=(u:[number,number],v:[number,number],w:[number,number])=>(v[0]-u[0])*(w[1]-u[1])-(v[1]-u[1])*(w[0]-u[0]);
  if(cross(A,B,C)*cross(A,B,D)<=0&&cross(C,D,A)*cross(C,D,B)<=0)return true;
  return Math.min(pointSegmentDistance(A,C,D),pointSegmentDistance(B,C,D),pointSegmentDistance(C,A,B),pointSegmentDistance(D,A,B))<=radius;
 };
 for(const [from,links] of graph.edges){
  const a=graph.nodes.get(from);if(!a)continue;
  for(const edge of links){
   const b=graph.nodes.get(edge.to);if(!b)continue;
   const candidates=new Set<Segment>();
   const minX=Math.floor((Math.min(a[0],b[0])-0.002)/cell);
   const maxX=Math.floor((Math.max(a[0],b[0])+0.002)/cell);
   const minY=Math.floor((Math.min(a[1],b[1])-0.002)/cell);
   const maxY=Math.floor((Math.max(a[1],b[1])+0.002)/cell);
   for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++)
    for(const seg of grid.get(cellKey(x,y))??[])candidates.add(seg);
   for(const seg of candidates)if(close(a,b,seg.a,seg.b)){allowed.add(edge.id);break;}
  }
 }
 return allowed;
}

export function dispatchScout(
 taxi:Taxi,graph:RoadGraph,explored:Set<string>,hq:Point,
 reservedTargets:Set<string>=new Set(),reservedEdges:Set<string>=new Set(),
 _frontierNodes?:string[],_allowedRoads?:Set<string>,discoveryAllowed?:Set<string>,territoryCovered?:Set<string>
):Taxi{
 if(taxi.status!=='IDLE')return taxi;
 const start=nearest(graph,taxi.position);
 if(!start)return taxi;
 const revealed=new Set(exploredRoadNodes(graph,explored,hq));
 // Dijkstra from the current vehicle position: one search replaces dozens of
 // independent full-graph routes, and yields the cheapest road-by-road approach.
 const dist=new Map<string,number>([[start,0]]);
 const previous=new Map<string,{from:string;id:string}>();
 const heap:Array<[number,string]>=[[0,start]];
 const push=(item:[number,string])=>{
  heap.push(item);let i=heap.length-1;
  while(i>0){const p=(i-1)>>1;if(heap[p][0]<=item[0])break;heap[i]=heap[p];i=p;}
  heap[i]=item;
 };
 const pop=():[number,string]|undefined=>{
  if(!heap.length)return undefined;
  const first=heap[0],last=heap.pop()!;
  if(heap.length){let i=0;while(2*i+1<heap.length){let c=2*i+1;
   if(c+1<heap.length&&heap[c+1][0]<heap[c][0])c++;
   if(heap[c][0]>=last[0])break;heap[i]=heap[c];i=c;
  }heap[i]=last;}
  return first;
 };
 // Bounded nearest-first search. A full graph scan blocked dispatch on mobile.
 // Complete nearby streets within the revealed territory, then expand outward.
 let best:{from:string;to:string;id:string;distance:number;inside:boolean}|null=null;
 let bestOutside:{from:string;to:string;id:string;distance:number;inside:boolean}|null=null;
 // Surveyor: prioritise roads outside the existing 150 m territory corridor.
 // Covered roads remain available as transit routes, not preferred survey targets.
 let bestSurvey:{from:string;to:string;id:string;distance:number;inside:boolean;score:number}|null=null;
 let visits=0;
 const maxSearchMeters=3500;
 while(heap.length&&visits++<12000){
  const current=pop();if(!current)break;
  const [distance,node]=current;
  if(distance!==(dist.get(node)??Infinity))continue;
  if(distance>maxSearchMeters)break;
  // Once the nearest inside road is found, only finish nodes with shorter
  // approach distances; avoid searching the entire connected road network.
  if(taxi.kind!=='surveyor'&&best&&distance>best.distance)break;
  for(const edge of graph.edges.get(node)??[]){
   const isNew=(!discoveryAllowed||discoveryAllowed.has(edge.id))&&!explored.has(edge.id)&&!reservedEdges.has(edge.id)&&!reservedTargets.has(edge.to);
   if(isNew){
    if(taxi.kind==='surveyor'&&territoryCovered){
     // A road outside the covered corridor expands the map. Prefer it even
     // when a covered but untravelled road is closer. Penalise long detours.
     const newTerritory=!territoryCovered.has(edge.id);
     const score=(newTerritory?6000:0)+Math.min(edge.meters,600)*2-distance*0.8;
     if(!bestSurvey||score>bestSurvey.score)
      bestSurvey={from:node,to:edge.to,id:edge.id,distance:distance+edge.meters,inside:false,score};
    }
    const inside=revealed.has(node)&&revealed.has(edge.to);
    const candidate={from:node,to:edge.to,id:edge.id,distance:distance+edge.meters,inside};
    if(inside){
     if(!best||candidate.distance<best.distance)best=candidate;
    }else if(!bestOutside||candidate.distance<bestOutside.distance)bestOutside=candidate;
   }
   const next=distance+edge.meters;
   if(next<=maxSearchMeters&&next<(dist.get(edge.to)??Infinity)){
    dist.set(edge.to,next);previous.set(edge.to,{from:node,id:edge.id});push([next,edge.to]);
   }
  }
 }
 best=taxi.kind==='surveyor'&&bestSurvey?bestSurvey:(best??bestOutside);
 if(!best)return taxi;
 const keys=[best.from],ids:string[]=[];
 let node=best.from;
 while(node!==start){
  const step=previous.get(node);if(!step)return taxi;
  ids.push(step.id);keys.push(step.from);node=step.from;
 }
 keys.reverse();ids.reverse();
 keys.push(best.to);ids.push(best.id);
 // Extend the assignment along connected, undiscovered streets. This avoids
 // becoming IDLE at every junction and waiting for the next worker dispatch.
 const planned=new Set(ids);
 let cursor=best.to;
 let extraMeters=0;
 for(let step=0;step<24&&extraMeters<900;step++){
  const links=(graph.edges.get(cursor)??[]).filter(edge=>
   (!discoveryAllowed||discoveryAllowed.has(edge.id))&&!explored.has(edge.id)&&!reservedEdges.has(edge.id)&&!planned.has(edge.id)&&
   !reservedTargets.has(edge.to)&&edge.meters>0
  );
  if(!links.length)break;
  // Black Explorer expands into unrevealed territory; Purple Explorer stays
  // focused on eligible discovered-territory roads.
  links.sort((a,b)=>{
   if(taxi.kind==='surveyor'&&territoryCovered){
    const ai=territoryCovered.has(a.id)?1:0,bi=territoryCovered.has(b.id)?1:0;
    return ai-bi||b.meters-a.meters;
   }
   const ai=revealed.has(a.to)?0:1,bi=revealed.has(b.to)?0:1;
   return ai-bi||a.meters-b.meters;
  });
  const edge=links[0];
  keys.push(edge.to);ids.push(edge.id);planned.add(edge.id);
  extraMeters+=edge.meters;cursor=edge.to;
 }
 reservedTargets.add(cursor);
 for(const id of ids)reservedEdges.add(id);
 return {...taxi,status:'EXPLORING',path:keys.map(k=>graph.nodes.get(k)!),
  edgeIds:ids,discoveryEdgeIds:discoveryAllowed?ids.filter(id=>discoveryAllowed.has(id)):ids,journeyEdges:[],leg:0,distanceIntoLeg:0,
  pickup:undefined,dropoff:undefined,fare:0,scoutingRuns:(taxi.scoutingRuns??0)+1};
}
// Shared integrator: simulation and marker animation use exactly the same road speeds.
// Acceleration/deceleration is expressed in real seconds (1x wall time).
// PR D: Road-speed-aware vehicle dynamics. Only speed integration changes;
// existing route, discovery, dispatch and arrival handling remain untouched.
const clamp=(value:number,low:number,high:number)=>Math.max(low,Math.min(high,value));
function turnSpeedKph(previous:Point,junction:Point,next:Point):number{
 const latitude=junction[1]*Math.PI/180;
 const x=Math.cos(latitude);
 const ux=(junction[0]-previous[0])*x,uy=junction[1]-previous[1];
 const vx=(next[0]-junction[0])*x,vy=next[1]-junction[1];
 const magnitude=Math.hypot(ux,uy)*Math.hypot(vx,vy);
 if(magnitude<1e-12)return 50;
 const angle=Math.acos(clamp((ux*vx+uy*vy)/magnitude,-1,1))*180/Math.PI;
 if(angle<15)return 160;
 if(angle<35)return 70;
 if(angle<60)return 45;
 if(angle<90)return 30;
 if(angle<125)return 20;
 return 12;
}
export function advanceTaxi(taxi:Taxi,graph:RoadGraph,realSeconds:number):{taxi:Taxi;crossed:string[];distanceMeters:number}{
 if(taxi.status==='IDLE'||taxi.path.length<2||realSeconds<=0)return{taxi,crossed:[],distanceMeters:0};
 const t={...taxi};
 const crossed:string[]=[];
 let distanceMeters=0;
 let time=Math.min(realSeconds,5)*GAME_SPEED;
 const acceleration=t.kind==='explorer'||t.kind==='surveyor'?1.35:1.9;
 const braking=3.5;
 // Fixed small time steps preserve smooth animation and prevent junction overshoot.
 while(time>0.00001&&t.leg<t.path.length-1){
  const a=t.path[t.leg],b=t.path[t.leg+1];
  const length=meters(a,b);
  const edge=graph.edges.get(key(a))?.find(e=>e.to===key(b)&&e.id===t.edgeIds[t.leg]);
  const roadLimit=clamp(edge?.speedKph??50,5,160)/3.6;
  const cruiseFactor=t.kind==='surveyor'?0.93:t.kind==='explorer'?0.95:0.97;
  const cruise=roadLimit*cruiseFactor;
  const remaining=Math.max(0,length-t.distanceIntoLeg);
  const nextIndex=t.leg+1;
  let junctionLimit=roadLimit;
  if(nextIndex<t.path.length-1){
   const c=t.path[nextIndex+1];
   const nextEdge=graph.edges.get(key(b))?.find(e=>e.to===key(c)&&e.id===t.edgeIds[nextIndex]);
   const nextLimit=clamp(nextEdge?.speedKph??50,5,160)/3.6;
   const curveLimit=turnSpeedKph(a,b,c)/3.6;
   junctionLimit=Math.min(nextLimit,curveLimit);
  }
  // v² = u² + 2as: brake early enough to respect the next road and turn.
  const safeApproach=Math.sqrt(Math.max(0,junctionLimit*junctionLimit+2*braking*remaining));
  const target=Math.min(cruise,roadLimit,safeApproach);
  const dt=Math.min(0.1,time);
  const current=clamp((t.speedKph??0)/3.6,0,roadLimit);
  const change=target-current;
  const nextSpeed=clamp(current+clamp(change,-braking*dt,acceleration*dt),0,roadLimit);
  t.speedKph=nextSpeed*3.6;
  const distance=(current+nextSpeed)/2*dt;
  const moved=Math.min(distance,remaining);
  t.distanceIntoLeg+=moved;
  distanceMeters+=moved;
  const fraction=length>0?clamp(t.distanceIntoLeg/length,0,1):1;
  t.position=[a[0]+(b[0]-a[0])*fraction,a[1]+(b[1]-a[1])*fraction];
  if(t.distanceIntoLeg>=length-0.0001){
   const id=t.edgeIds[t.leg];if(id)crossed.push(id);
   t.leg++;t.distanceIntoLeg=0;t.position=b;
   if(t.leg<t.path.length-1){
    const next=t.path[t.leg+1];
    const nextEdge=graph.edges.get(key(b))?.find(e=>e.to===key(next)&&e.id===t.edgeIds[t.leg]);
    t.speedKph=Math.min(t.speedKph??0,clamp(nextEdge?.speedKph??50,5,160));
   }
  }
  time-=distance>0?dt*(moved/distance):dt;
 }
 return{taxi:t,crossed,distanceMeters};
}
export function tickTaxi(taxi:Taxi,graph:RoadGraph,seconds:number,discoveredRoads?:Set<string>):{taxi:Taxi;earned:number;finished:boolean;discovered:string[];distanceMeters:number}{
 if(taxi.status==='IDLE'||taxi.status==='REFUELLING'||taxi.status==='PAUSED')return{taxi,earned:0,finished:false,discovered:[],distanceMeters:0};
 const advanced=advanceTaxi(taxi,graph,seconds);
 let t={...advanced.taxi,journeyEdges:[...(taxi.journeyEdges??[]),...advanced.crossed]};
 if(t.leg<t.path.length-1)return{taxi:t,earned:0,finished:false,discovered:advanced.crossed,distanceMeters:advanced.distanceMeters};
 if(t.status==='TO_PICKUP'&&t.dropoff){
  const from=nearest(graph,t.position),to=nearest(graph,t.dropoff);
  const next=discoveredRoads?routeDiscovered(graph,from,to,discoveredRoads):route(graph,from,to);
  if(next&&next.path.length>1){
   t={...t,status:'TO_DROPOFF',path:next.path,edgeIds:next.edgeIds,leg:0,distanceIntoLeg:0};
   return{taxi:t,earned:0,finished:false,discovered:advanced.crossed,distanceMeters:advanced.distanceMeters};
  }
 }
 if(t.status==='RETURNING'&&t.pauseAtHome){
  t={...t,status:'PAUSED',pauseAtHome:false,path:[],edgeIds:[],leg:0,distanceIntoLeg:0,speedKph:0,journeyEdges:[]};
  return{taxi:t,earned:0,finished:false,discovered:[],distanceMeters:advanced.distanceMeters};
 }
 if(t.status==='RETURNING'&&t.refillDestination){
  t={...t,status:'REFUELLING',path:[],edgeIds:[],leg:0,distanceIntoLeg:0,speedKph:0,refillUntil:undefined,journeyEdges:[]};
  return{taxi:t,earned:0,finished:false,discovered:[],distanceMeters:advanced.distanceMeters};
 }
 const earned=t.status==='TO_DROPOFF'?t.fare:0;
 const discovered=[...new Set(t.journeyEdges??[])];
 t={...t,status:'IDLE',path:[],edgeIds:[],leg:0,distanceIntoLeg:0,
  pickup:undefined,dropoff:undefined,fare:0,journeyEdges:[],speedKph:0,
  completed:t.completed+(earned?1:0)};
 return{taxi:t,earned,finished:earned>0,discovered,distanceMeters:advanced.distanceMeters};
}
