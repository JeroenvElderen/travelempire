import {hardcodedRoadSpeedKph} from '../data/hardcodedSpeedLimits';
import {fareForDistance} from './demand';
import type {Company} from '../company';
export type Point=[number,number];
export type Taxi = {
  id: string;
  kind?: 'taxi' | 'explorer' | 'surveyor' | 'recovery';
  ferryVisitedPorts?: string[];
  ferryTrip?: {stage:'boarding'|'sailing';routeId:string;fromPortId:string;toPortId:string;geometry:Point[];destination:Point;durationGameMs:number;startedGameMs?:number;ticketEuros:number};
  explorerRole?: 'motorway'|'trunk'|'primary'|'secondary'|'tertiary'|'residential'|'rural'|'service'|'poi'|'completion'|'highway'|'urban'; // Older saves default to taxi.
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
  // Last completed road approach, retained across separate assignments.
  lastRoadFrom?: string;
  lastRoadTo?: string;
  scoutingRuns?: number;
  // Persist the local road section across dispatches and page reloads.
  explorationSection?: string;
  explorationSectionCompleted?: number;
  explorationSectionTotal?: number;
  explorationMode?: 'local'|'frontier';
  discoveryMode?: 'balanced'|'highways'|'urban'|'rural';
  drivingPolicy?: 'economy'|'balanced'|'performance';
  serviceThreshold?: number;
  discoveredKm?: number;
  uniqueDiscoveredKm?: number;
  autoDepotService?: boolean;
  pauseAtHome?: boolean;
  shiftParked?: boolean;
  scheduledBreakUntil?: number;
  scheduledBreakPending?: boolean;
  scheduledRestPending?: boolean;
  // Persistent rest planning state (timestamps are in simulated game time).
  restPreference?: 'automatic'|'parking'|'hotel'|'depot';
  drivingSinceRestGameMs?: number;
  drivingSinceHotelGameMs?: number;
  restStopId?: string;
  restStopName?: string;
  restUntilGameMs?: number;
  restExpense?: number;
  recoveryPending?: boolean;
  depotId?: string;
  // Edges eligible for discovery on this assignment; transit edges are excluded.
  discoveryEdgeIds?: string[];
  speedKph?: number;

  // Dealership vehicle information
  ownership?: 'owned' | 'leased';
  purchasePrice?:number;
  accumulatedDepreciation?:number;
  vehicleModel?: string;
  vehicleTrim?: string;
  vehicleOptionIds?: string[];
  vehiclePaintHex?: string;
  vehicleRevenueBonus?: number;
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
  serviceDestination?: Point;

  // Vehicle delivery information
  deliveryStartedAt?: number;
  deliveryUntil?: number;
  deliveryPath?: Point[];
};
export type MissionRecord={pickup:string;dropoff:string};
export type DriverRecord={id:string;name:string;hiredAt:number;completedTrips?:number;distanceKm?:number;revenueGenerated?:number;wagesEarned?:number};
export const driverLevel=(trips:number)=>trips>=100?'Expert':trips>=30?'Experienced':trips>=10?'Developing':'Novice';
export const driverSkill=(trips:number)=>Math.min(5,1+Math.floor(Math.max(0,trips)/25));
export type LeaseContract={id:string;vehicleId:string;vehicleName:string;dailyPayment:number;remainingDays:number;termDays:number;accruedGameSeconds:number;totalPaid:number};
export type BusinessLoan={paymentsMade?:number;vehicleId?:string;purpose?:'business'|'vehicle';id:string;principal:number;balance:number;annualRate:number;termDays:number;remainingDays:number;dailyPayment:number;accruedGameSeconds:number};
export type EconomyUpgrade='fuel'|'workshop'|'dispatch'|'training'|'depot-capacity';
export type FinanceCategories={fuel:number;maintenance:number;exploration:number;payroll:number;insurance:number;overhead:number;interest:number};
export type VehicleFinancePeriod={day:string;taxiId:string;name:string;revenue:number;expenses:number;km:number;trips:number};
export type FinancePeriod={day:string;revenue:number;expenses:number;trips:number;categories?:FinanceCategories};
export type BankEntry={id:string;time:number;description:string;amount:number;account:'operating'|'savings'|'reserve';type:'transfer'|'loan'|'repayment'|'purchase'|'equity'|'corporate'};
export type BankSettings={savings:number;reserve:number;autoSavePercent:number;minimumOperatingCash:number;lastAutoSaveDay?:string;entries:BankEntry[]};
export type DepotFinanceRecord={day:string;depotId:string;depotName:string;revenue:number;vehicleExpenses:number;facilityExpenses:number;allocatedOverhead:number;trips:number;km:number};
export type DepotUpgradeKind='workshop'|'charging'|'fuel'|'dispatch'|'capacity'|'explorer-parking';
export type DepotUpgradeState=Partial<Record<DepotUpgradeKind,number>>;
export type AccountingPeriod={month:string;grossRevenue:number;netRevenue:number;grossExpenses:number;netExpenses:number;vatCollected:number;vatInput:number;depreciation:number;corporateTax:number;vatPaid:number;corporateTaxPaid:number;closed:boolean};
export type AccountingSettings={corporateRate:number;vatRate:number;settlement:'monthly'};
export type AccountingState={settings:AccountingSettings;periods:AccountingPeriod[];lastSettledMonth?:string};
export type EquityHolder={id:string;name:string;shares:number;votesPerShare:number;invested:number;dividendsReceived:number};
export type EquityEvent={id:string;gameTime:number;type:'investment'|'issue'|'dividend'|'buyback';holderId:string;holderName:string;amount:number;shares:number;valuation:number;note:string};
export type ValuationPoint={gameDay:string;value:number;confidence:number;founderPercent:number;equity:number};
export type EquityState={holders:EquityHolder[];events:EquityEvent[];valuationHistory:ValuationPoint[];lastValuationDay?:string;totalDividends:number;issuedCapital:number};
export type CorporateSubsidiary={id:string;name:string;city:string;createdDay:string;source:'acquired'|'founded';ownershipPercent:number;fleetCount:number;depotCount:number;drivers:number;cash:number;vehicleAssets:number;depotAssets:number;goodwill:number;externalDebt:number;revenuePerDay:number;expensesPerDay:number;retainedEarnings:number;taxPaid:number;accumulatedRevenue:number;accumulatedExpenses:number;lastSettledDay:string;active:boolean;parentId?:string;countryCode?:string;currencyCode?:string;localCash?:number;fxRateToEUR?:number;foreignTaxRate?:number;licensePaid?:boolean};
export type CorporateLoan={id:string;principal:number;balance:number;annualRate:number;dailyPayment:number;remainingDays:number;targetId:string};
export type CorporateEvent={id:string;gameTime:number;kind:'acquisition'|'formation'|'loan'|'repayment'|'transfer'|'merger'|'restructure'|'asset-transfer';subsidiaryId:string;description:string;parentCashDelta:number;subsidiaryCashDelta:number;amount:number};
export type CorporateState={subsidiaries:CorporateSubsidiary[];loans:CorporateLoan[];events:CorporateEvent[];lastProcessedDay?:string;totalAcquisitionSpend:number;totalInterest:number;totalRevenue:number;totalExpenses:number;totalTaxes:number};
export type FleetState={explorerExpansionApplied?:boolean;corporate?:CorporateState;equity?:EquityState;accounting?:AccountingState;depotFinanceHistory?:DepotFinanceRecord[];depotUpgrades?:Record<string,DepotUpgradeState>;depotFacilityExpense?:number;financePaymentsMade?:number;leases?:LeaseContract[];leaseExpense?:number;bank?:BankSettings;wageMultiplier?:number;financeHistory?:FinancePeriod[];vehicleFinanceHistory?:VehicleFinancePeriod[];loans?:BusinessLoan[];upgrades?:EconomyUpgrade[];overheadExpense?:number;loanInterestExpense?:number;loanPrincipalPaid?:number;drivers?:DriverRecord[];taxis:Taxi[];revenue:number;completed:number;exploredEdgeIds?:string[];territoryEdgeIds?:string[];missionHistory?:MissionRecord[];fuelExpense?:number;maintenanceExpense?:number;distanceKm?:number;driverWages?:number;insuranceExpense?:number;serviceExpense?:number;explorationExpense?:number;transactions?:FinancialTransaction[]};
export type FinancialTransaction={id:string;time:number;taxiId?:string;description:string;amount:number};
export type RoadGraph={nodes:Map<string,Point>;edges:Map<string,{to:string;meters:number;id:string;speedKph:number;highway?:string}[]>;nodeKeys:string[]};
const key=(p:Point)=>`${p[0].toFixed(6)},${p[1].toFixed(6)}`;
export const meters=(a:Point,b:Point)=>{const lat=(a[1]+b[1])*Math.PI/360;return Math.hypot((a[0]-b[0])*111320*Math.cos(lat),(a[1]-b[1])*111320)};
// Road speeds are fixed by highway category; OSM maxspeed is deliberately ignored.
// Deterministic, Greece-local traffic model. No external traffic feed or map overlay.
const trafficHourFormatter=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Athens',hour:'2-digit',hourCycle:'h23'});
const trafficWeekdayFormatter=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Athens',weekday:'short'});
let trafficCachedMinute=NaN,trafficCachedHour=0,trafficCachedWeekday='';
export function trafficFactor(speedKph:number,at=Date.now()):number{
 // Athens traffic classification changes only at hour/day boundaries.
 // Reuse Intl formatting across the integrator's 100ms physics steps.
 const minute=Math.floor(at/60000);
 if(minute!==trafficCachedMinute){
  trafficCachedMinute=minute;
  trafficCachedHour=Number(trafficHourFormatter.format(at));
  trafficCachedWeekday=trafficWeekdayFormatter.format(at);
 }
 const hour=trafficCachedHour;
 const weekday=trafficCachedWeekday;
 const weekend=weekday==='Sat'||weekday==='Sun';
 const rush=!weekend&&((hour>=7&&hour<10)||(hour>=16&&hour<19));
 const busy=!weekend&&hour>=11&&hour<16;
 // Posted speed is never exceeded; slower urban streets experience heavier congestion.
 const density=speedKph<=50?1:speedKph<=80?0.55:0.18;
 return Math.max(0.3,1-density*(rush?0.48:busy?0.22:weekend?0.10:0.07));
}
export function trafficTravelSeconds(meters:number,speedKph:number,at=Date.now()):number{
 return meters/(Math.max(5,speedKph)*trafficFactor(speedKph,at)/3.6);
}
export const GAME_SPEED = 1;
export function roadSpeedKph(properties:Record<string,unknown>):number {
 return hardcodedRoadSpeedKph(properties.highway??properties.roadType??properties.type);
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
// Compare the actual geometry, not just identical node IDs: OSM often
// represents a straight reversal as two different short road segments.
function forbiddenUTurn(graph:RoadGraph,previous:string,current:string,next:string,allowed?:Set<string>):boolean{
 const a=graph.nodes.get(previous),b=graph.nodes.get(current),c=graph.nodes.get(next);
 if(!a||!b||!c)return previous===next;
 const lat=b[1]*Math.PI/180,scale=Math.cos(lat);
 const ax=(b[0]-a[0])*scale,ay=b[1]-a[1];
 const bx=(c[0]-b[0])*scale,by=c[1]-b[1];
 const magnitude=Math.hypot(ax,ay)*Math.hypot(bx,by);
 const reversal=magnitude>1e-15&&(ax*bx+ay*by)/magnitude < -0.94;
 if(!reversal&&previous!==next)return false;
 // A dead end has no legal forward/side exit; ignore the reversing option.
 return (graph.edges.get(current)??[]).some(e=>
  (!allowed||allowed.has(e.id))&&e.to!==next&&e.to!==previous&&
  !forbiddenTurnGeometry(graph,previous,current,e.to));
}
function forbiddenTurnGeometry(graph:RoadGraph,previous:string,current:string,next:string):boolean{
 const a=graph.nodes.get(previous),b=graph.nodes.get(current),c=graph.nodes.get(next);
 if(!a||!b||!c)return previous===next;
 const scale=Math.cos(b[1]*Math.PI/180);
 const x=(b[0]-a[0])*scale,y=b[1]-a[1],u=(c[0]-b[0])*scale,v=c[1]-b[1];
 const denom=Math.hypot(x,y)*Math.hypot(u,v);
 return previous===next||(denom>1e-15&&(x*u+y*v)/denom < -0.94);
}
// Turn-aware Dijkstra: the state includes the incoming road node. A shortest
// path to an intersection must not erase another valid approach direction.
function turnAwareRoute(graph:RoadGraph,from:string,to:string,allowed?:Set<string>,timed=false,incoming=''):{path:Point[];edgeIds:string[];length:number}|null{
 if(!graph.nodes.has(from)||!graph.nodes.has(to))return null;
 if(from===to)return{path:[graph.nodes.get(from)!],edgeIds:[],length:0};
 type State={node:string;incoming:string;cost:number;parent:number;edgeId:string};
 const states:State[]=[{node:from,incoming,cost:0,parent:-1,edgeId:''}];
 const best=new Map<string,number>([[JSON.stringify([from,incoming]),0]]);
 const heap:number[]=[0];
 const push=(id:number)=>{heap.push(id);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(states[heap[p]].cost<=states[id].cost)break;heap[i]=heap[p];i=p;}heap[i]=id;};
 const pop=():number|undefined=>{if(!heap.length)return undefined;const first=heap[0],last=heap.pop()!;if(heap.length){let i=0;while(2*i+1<heap.length){let c=2*i+1;if(c+1<heap.length&&states[heap[c+1]].cost<states[heap[c]].cost)c++;if(states[heap[c]].cost>=states[last].cost)break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;};
 let finish=-1,visits=0;
 while(heap.length&&visits++<150000){
  const id=pop()!,state=states[id];
  if(state.cost!==(best.get(JSON.stringify([state.node,state.incoming]))??Infinity))continue;
  if(state.node===to){finish=id;break;}
  const links=graph.edges.get(state.node)??[];
  // A U-turn is legal only when no alternative permitted outgoing road exists.

  for(const edge of links){
   if(allowed&&!allowed.has(edge.id))continue;
   if(state.incoming&&forbiddenUTurn(graph,state.incoming,state.node,edge.to,allowed))continue;
   const cost=state.cost+(timed?trafficTravelSeconds(edge.meters,edge.speedKph):edge.meters);
   const k=JSON.stringify([edge.to,state.node]);
   if(cost>=(best.get(k)??Infinity))continue;
   best.set(k,cost);const next=states.length;
   states.push({node:edge.to,incoming:state.node,cost,parent:id,edgeId:edge.id});push(next);
  }
 }
 if(finish<0)return null;
 const keys:string[]=[],ids:string[]=[];
 for(let id=finish;id>=0;id=states[id].parent){keys.push(states[id].node);if(states[id].parent>=0)ids.push(states[id].edgeId);}
 keys.reverse();ids.reverse();
 return{path:keys.map(k=>graph.nodes.get(k)!),edgeIds:ids,length:states[finish].cost};
}
export function route(graph:RoadGraph,from:string,to:string,incoming=''){return turnAwareRoute(graph,from,to,undefined,false,incoming);}

// Single turn-aware Dijkstra for multiple destinations. Stops when the cheapest
// reachable target is settled; never substitutes straight-line proximity for
// actual road distance. A target's off-road connection is part of its cost.
export function routeToNearestTarget(
 graph:RoadGraph,from:string,targets:{node:string;offsetMeters:number}[],incoming='',maxVisits=150000,diagnostics?:{reason?:'invalid-start'|'no-valid-targets'|'search-budget'|'unreachable'|'success';visits?:number}
):{targetIndex:number;path:Point[];edgeIds:string[];roadMeters:number;totalMeters:number}|null{
 if(!graph.nodes.has(from)||!targets.length){if(diagnostics)diagnostics.reason='invalid-start';return null;}
 const atNode=new Map<string,{index:number;offset:number}[]>();
 for(let i=0;i<targets.length;i++){
  const target=targets[i];
  if(!graph.nodes.has(target.node))continue;
  const items=atNode.get(target.node)??[];
  items.push({index:i,offset:target.offsetMeters});
  atNode.set(target.node,items);
 }
 if(!atNode.size){if(diagnostics)diagnostics.reason='no-valid-targets';return null;}
 type State={node:string;incoming:string;cost:number;parent:number;edgeId:string};
 const states:State[]=[{node:from,incoming,cost:0,parent:-1,edgeId:''}];
 const best=new Map<string,number>([[JSON.stringify([from,incoming]),0]]);
 const heap:number[]=[0];
 const push=(id:number)=>{heap.push(id);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(states[heap[p]].cost<=states[id].cost)break;heap[i]=heap[p];i=p;}heap[i]=id;};
 const pop=():number|undefined=>{if(!heap.length)return undefined;const first=heap[0],last=heap.pop()!;if(heap.length){let i=0;while(2*i+1<heap.length){let c=2*i+1;if(c+1<heap.length&&states[heap[c+1]].cost<states[heap[c]].cost)c++;if(states[heap[c]].cost>=states[last].cost)break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;};
 let finish=-1,selected=-1,selectedCost=Infinity,visits=0;
 while(heap.length&&visits++<maxVisits){
  const id=pop()!,state=states[id];
  if(state.cost!==(best.get(JSON.stringify([state.node,state.incoming]))??Infinity))continue;
  if(state.cost>selectedCost)break;
  for(const target of atNode.get(state.node)??[]){
   const total=state.cost+target.offset;
   if(total<selectedCost||(total===selectedCost&&target.index<selected)){
    selectedCost=total;selected=target.index;finish=id;
   }
  }
  for(const edge of graph.edges.get(state.node)??[]){
   if(state.incoming&&forbiddenUTurn(graph,state.incoming,state.node,edge.to))continue;
   const cost=state.cost+edge.meters;
   if(cost>selectedCost)continue;
   const k=JSON.stringify([edge.to,state.node]);
   if(cost>=(best.get(k)??Infinity))continue;
   best.set(k,cost);
   const next=states.length;
   states.push({node:edge.to,incoming:state.node,cost,parent:id,edgeId:edge.id});push(next);
  }
 }
 if(diagnostics){diagnostics.visits=visits;diagnostics.reason=finish>=0?'success':heap.length?'search-budget':'unreachable';}
 if(finish<0)return null;
 const keys:string[]=[],edgeIds:string[]=[];
 for(let id=finish;id>=0;id=states[id].parent){
  keys.push(states[id].node);
  if(states[id].parent>=0)edgeIds.push(states[id].edgeId);
 }
 keys.reverse();edgeIds.reverse();
 return{targetIndex:selected,path:keys.map(k=>graph.nodes.get(k)!),edgeIds,roadMeters:states[finish].cost,totalMeters:selectedCost};
}

export const fleetKey=(id:string)=>`travelempire.fleet.v0.8.${id}`;
export function loadFleet(id:string):FleetState{try{const saved=JSON.parse(localStorage.getItem(fleetKey(id))??'null') as FleetState|null;if(saved&&Array.isArray(saved.taxis)){
  // Migrate legacy saves without changing any existing taxi assignment.
  const names=new Set<string>();for(const taxi of saved.taxis)if(taxi.driver?.trim())names.add(taxi.driver.trim());
  const roster=saved.drivers??[];for(const name of names)if(!roster.some(d=>d.name.toLowerCase()===name.toLowerCase()))roster.push({id:crypto.randomUUID(),name,hiredAt:Date.now()});
  // PR A saved Black Explorers as 'explorer'; migrate only those vehicles.
  const taxis=saved.taxis.filter(t=>t.kind!=='surveyor'&&t.vehicleModel!=='Black Explorer'&&t.name!=='Black Explorer');
  return {...saved,taxis,drivers:roster};
 }}catch{/* ignore invalid save */}return{taxis:[],revenue:0,completed:0,exploredEdgeIds:[]};}
export function saveFleet(id:string,fleet:FleetState){localStorage.setItem(fleetKey(id),JSON.stringify({...fleet,taxis:fleet.taxis.filter(t=>t.kind!=='surveyor'&&t.vehicleModel!=='Black Explorer'&&t.name!=='Black Explorer')}));}
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
export function createPassengerRequest(graph:RoadGraph,explored:Set<string>,_hq:Point,now=Date.now(),fareMultiplier=1,eligibleStops?:Set<string>):PassengerRequest|null{
 const allEligible=[...(eligibleStops??passengerRoadNodes(graph,explored))];
 if(allEligible.length<2)return null;
 const eligible=allEligible.length>3000?Array.from({length:3000},()=>allEligible[Math.floor(Math.random()*allEligible.length)]):allEligible;
 for(let attempt=0;attempt<35;attempt++){
  const from=eligible[Math.floor(Math.random()*eligible.length)];
  const near=eligible.filter(k=>{const d=meters(graph.nodes.get(k)!,graph.nodes.get(from)!);return d>=200&&d<=4000;});
  if(!near.length)continue;
  const to=near[Math.floor(Math.random()*near.length)];
  // Pickup and drop-off are on Explorer-discovered roads within the revealed area.
  // Travel between those stops may use undiscovered roads without revealing them.
  const trip=routeDiscovered(graph,from,to,explored);
  if(!trip||trip.length<150||trip.length>5000)continue;
  return{id:crypto.randomUUID(),pickup:graph.nodes.get(from)!,dropoff:graph.nodes.get(to)!,fare:fareForDistance(trip.length,fareMultiplier),createdAt:now,expiresAt:now+120000};
 }
 // Fallback: find a reachable pair of discovered-road stops without relying
 // on random sampling, so sparse explored networks can still produce jobs.
 for(let i=0;i<Math.min(eligible.length,120);i++){
  const from=eligible[i];
  const origin=graph.nodes.get(from)!;
  for(const to of eligible){
   if(to===from)continue;
   const direct=meters(origin,graph.nodes.get(to)!);
   if(direct<150||direct>4000)continue;
   const trip=route(graph,from,to);
   if(!trip||trip.length<150||trip.length>5000)continue;
   return{id:crypto.randomUUID(),pickup:origin,dropoff:graph.nodes.get(to)!,fare:fareForDistance(trip.length,fareMultiplier),createdAt:now,expiresAt:now+120000};
  }
 }
 return null;
}
export function routeDiscovered(graph:RoadGraph,from:string,to:string,discovered:Set<string>,incoming=''):ReturnType<typeof route>{
 return turnAwareRoute(graph,from,to,discovered,true,incoming);
}
export function assignPassenger(taxi:Taxi,graph:RoadGraph,mission:PassengerRequest,discovered?:Set<string>,eligibleStops?:Set<string>):Taxi|null{
 if(taxi.status!=='IDLE')return null;
 const start=nearest(graph,taxi.position),pickup=nearest(graph,mission.pickup);
 if(!start||!pickup)return null;
 if(discovered){
  // Reuse the dispatch-wide eligibility index instead of scanning the entire
  // discovered network once per taxi and passenger candidate.
  const eligible=eligibleStops??passengerRoadNodes(graph,discovered);
  if(!eligible.has(pickup)||!eligible.has(nearest(graph,mission.dropoff)))return null;
 }
 // Passenger stops must be discovered, but taxis may travel over any road without exploring it.
 // Empty taxis may return from fuel, hotels or rest stops on undiscovered roads.
 // The pickup transfer is operational travel, not exploration; passenger trips
 // remain restricted to discovered roads in the TO_PICKUP -> TO_DROPOFF transition.
 const toPickup=route(graph,start,pickup,taxi.lastRoadTo===start?taxi.lastRoadFrom??'':'');
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
   // A crossing or endpoint overlap does not make the whole road eligible.
   // All samples must remain within the Black Surveyor's 150m corridor.
   const nearby=[...candidates];
   if(!nearby.length)continue;
   const steps=Math.max(1,Math.ceil(meters(a,b)/20));
   let fullyInside=true;
   for(let step=0;step<=steps;step++){
    const t=step/steps;
    const p:Point=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
    const latitude=p[1]*Math.PI/180;
    const sx=111320*Math.cos(latitude),sy=111320;
    const point:[number,number]=[p[0]*sx,p[1]*sy];
    if(!nearby.some(seg=>pointSegmentDistance(point,
     [seg.a[0]*sx,seg.a[1]*sy],[seg.b[0]*sx,seg.b[1]*sy])<=radius)){
     fullyInside=false;break;
    }
   }
   if(fullyInside)allowed.add(edge.id);
  }
 }
 return allowed;
}

// Stable ~600m road sections. Longitude width is latitude-adjusted.
export function roadSection(point:Point):string{
 const y=Math.floor(point[1]*111320/600);
 const x=Math.floor(point[0]*111320*Math.cos(point[1]*Math.PI/180)/600);
 return x+':'+y;
}

/** Unique eligible road coverage for one 600m section. */
export function sectionCoverage(graph:RoadGraph,allowed:Set<string>,discovered:Set<string>,section:string):{completed:number;total:number}{
 const ids=new Set<string>();
 for(const [from,links] of graph.edges){
  const a=graph.nodes.get(from);if(!a)continue;
  for(const edge of links){
   if(!allowed.has(edge.id)||ids.has(edge.id))continue;
   const b=graph.nodes.get(edge.to);if(!b)continue;
   if(roadSection([(a[0]+b[0])/2,(a[1]+b[1])/2])===section)ids.add(edge.id);
  }
 }
 let completed=0;for(const id of ids)if(discovered.has(id))completed++;
 return {completed,total:ids.size};
}

// Find a bounded block perimeter through a second road path between junctions.
function blockPerimeter(graph:RoadGraph,from:string,to:string,excludeId:string,allowed?:Set<string>):{nodes:string[];ids:string[]}|null{
 type Item={node:string;distance:number;nodes:string[];ids:string[]};
 const queue:Item[]=[{node:to,distance:0,nodes:[to],ids:[]}],best=new Map<string,number>([[to,0]]);
 for(let i=0;i<queue.length&&i<450;i++){
  let min=i;for(let j=i+1;j<queue.length;j++)if(queue[j].distance<queue[min].distance)min=j;
  [queue[i],queue[min]]=[queue[min],queue[i]];
  const item=queue[i];if(item.distance!==(best.get(item.node)??Infinity))continue;
  if(item.node===from&&item.ids.length>=2)return{nodes:item.nodes,ids:item.ids};
  if(item.distance>850||item.ids.length>=30)continue;
  for(const e of graph.edges.get(item.node)??[]){
   if(e.id===excludeId||(allowed&&!allowed.has(e.id)))continue;
   const next=item.distance+e.meters;if(next>850||next>=(best.get(e.to)??Infinity))continue;
   best.set(e.to,next);queue.push({node:e.to,distance:next,nodes:[...item.nodes,e.to],ids:[...item.ids,e.id]});
  }
 }
 return null;
}

export async function dispatchScout(
 taxi:Taxi,graph:RoadGraph,explored:Set<string>,hq:Point,
 reservedTargets:Set<string>=new Set(),reservedEdges:Set<string>=new Set(),
 _frontierNodes?:string[],_allowedRoads?:Set<string>,discoveryAllowed?:Set<string>,_territoryCovered?:Set<string>,incomingNode?:string,_sectionOwners?:Set<string>,poiTargets?:Point[],requiredFrontier?:Set<string>,sharedRevealed?:Set<string>,shouldContinue?:()=>boolean,regionalCandidates?:Set<string>
):Promise<Taxi>{
 if(taxi.status!=='IDLE')return taxi;
 const start=nearest(graph,taxi.position);
 if(!start)return taxi;
 incomingNode??=taxi.lastRoadTo===start?taxi.lastRoadFrom:undefined;
 const revealed=sharedRevealed??new Set(exploredRoadNodes(graph,explored,hq));
 // Independent road discovery: choose nearby unvisited roads without zones or AI priorities.
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
 // After completing a block, choose the nearest reachable undiscovered road.
 // Search is bounded and runs in the dispatch worker, never the animation loop.
 let best:{from:string;to:string;id:string;distance:number;inside:boolean;local:boolean}|null=null;
 let completionBest:{from:string;to:string;id:string;distance:number;inside:boolean;local:boolean}|null=null;
 let specialistBest:{from:string;to:string;id:string;distance:number;inside:boolean;local:boolean}|null=null;
 let specialistScore=Infinity;
 const specialist=taxi.explorerRole;
 // POI candidate edges are already indexed near harbours by the worker.
 const poiPoints=specialist==='poi'?(poiTargets??[]):[];
 const specialistMatch=(h:string)=>specialist==='highway'?['motorway','trunk','primary','secondary','motorway_link','trunk_link','primary_link','secondary_link'].includes(h):specialist==='urban'?['residential','living_street','service','tertiary','unclassified'].includes(h):specialist==='motorway'?['motorway','motorway_link'].includes(h):specialist==='trunk'?['trunk','trunk_link'].includes(h):specialist==='primary'?['primary','primary_link'].includes(h):specialist==='secondary'?['secondary','secondary_link'].includes(h):specialist==='tertiary'?['tertiary','tertiary_link'].includes(h):specialist==='residential'?['residential','living_street'].includes(h):specialist==='rural'?h==='unclassified':specialist==='service'?h==='service':false;
 let visits=0;
 const fullRetry=taxi.kind==='explorer'&&taxi.shiftParked&&taxi.explorationMode==='frontier';
 // Major-road specialists search the entire connected discovered-road network,
 // rather than an arbitrary radius or node count. Only an undiscovered road
 // of their own class can be selected as a discovery target.
 const majorRoadScout=specialist==='motorway'||specialist==='trunk'||specialist==='primary';
 const maxSearchMeters=majorRoadScout?Infinity:taxi.kind==='explorer'&&specialist?15000:fullRetry?Infinity:taxi.kind==='explorer'&&taxi.shiftParked?5000:taxi.explorationMode==='frontier'?5000:3500;
 // Every role, including motorway and recovery searches, must have a finite work limit.
 // The scheduler retries later as more road tiles and discoveries become available.
 const maxScoutVisits=majorRoadScout?18000:12000;
 const SCOUT_SLICE_NODES=384;
 while(heap.length&&visits<maxScoutVisits){
  visits++;
  if(visits%SCOUT_SLICE_NODES===0){
   await new Promise<void>(resolve=>setTimeout(resolve,0));
   if(shouldContinue&&!shouldContinue())return taxi;
  }
  const current=pop();if(!current)break;
  const [distance,node]=current;
  if(distance!==(dist.get(node)??Infinity))continue;
  if(distance>maxSearchMeters)break;
  // Dijkstra visits junctions in increasing travel distance. Once the
  // closest candidate is found, more distant junctions cannot beat it.
  // Completion explorers keep searching for gaps between revealed junctions.
  // Dijkstra expands in ascending travel distance. Once the frontier is
  // farther than the best candidate score, no later candidate can win.
  // This applies to all specialist roles, not only motorway/trunk scouts.
  if((!specialist&&best&&distance>best.distance)||
     (specialist==='completion'&&completionBest&&distance>completionBest.distance)||
     (specialist!=='completion'&&specialistBest&&distance>specialistScore))break;
  for(const edge of graph.edges.get(node)??[]){
   if(taxi.kind==='explorer'&&_allowedRoads&&!_allowedRoads.has(edge.id))continue;

   // Routing can reverse at a junction when needed to reach the next specialist road.
   // The turn restriction is a preference, not a reason to strand a scout.
   const isNew=(!regionalCandidates||regionalCandidates.has(edge.id))&&(!discoveryAllowed||discoveryAllowed.has(edge.id))&&!explored.has(edge.id)&&!reservedEdges.has(edge.id)&&!reservedTargets.has(edge.to);
   // Reach the frontier through actual connected graph edges; a transit road
   // does not become discovered merely because it was used to get here.
   if(isNew&&(!requiredFrontier||requiredFrontier.has(node))){
    const inside=revealed.has(node)&&revealed.has(edge.to);
    const candidate={from:node,to:edge.to,id:edge.id,distance,inside,local:true};
    // Nearest undiscovered road by shortest travel distance to its junction.
    if(!best||candidate.distance<best.distance)best=candidate;
     // Green explorers finish undiscovered links between already explored junctions first.
     if(taxi.explorerRole==='completion'&&inside&&(!completionBest||candidate.distance<completionBest.distance))completionBest=candidate;
     if(specialist&&specialist!=='poi'&&specialist!=='completion'){
      if((!discoveryAllowed||discoveryAllowed.has(edge.id))&&specialistMatch(edge.highway??'')&&distance<specialistScore){specialistBest=candidate;specialistScore=distance;}
     }else if(specialist==='poi'&&poiPoints.length){
      // Select the nearest harbour-access road by actual travel distance.
      // Never discard a distant harbour solely because it is >8km away.
      if(distance<specialistScore){specialistBest=candidate;specialistScore=distance;}
     }
   }
   // Transit may use any loaded road class. Only discoveryAllowed roads
   // become explorer targets and get revealed when the vehicle traverses them.
   const next=distance+edge.meters;
   if(next<=maxSearchMeters&&next<(dist.get(edge.to)??Infinity)){
    dist.set(edge.to,next);previous.set(edge.to,{from:node,id:edge.id});push([next,edge.to]);
   }
  }
 }
 // Green explorers prefer missing links, falling back to nearest-road expansion.
 if(specialist==='completion')best=completionBest;
 else if(specialist)best=specialistBest;
 // Keep specialist scouts moving along the road they are already following.
 // The nearest-frontier search otherwise sends them backwards even when an
 // eligible undiscovered continuation is connected to the current junction.
 if(taxi.kind==='explorer'&&specialist&&specialist!=='completion'&&specialist!=='poi'&&incomingNode){
  const previousPoint=graph.nodes.get(incomingNode),at=graph.nodes.get(start);
  if(previousPoint&&at){
   const scale=Math.cos(at[1]*Math.PI/180);
   const ax=(at[0]-previousPoint[0])*scale,ay=at[1]-previousPoint[1];
   const am=Math.hypot(ax,ay);
   let forward:{from:string;to:string;id:string;distance:number;inside:boolean;local:boolean}|null=null;
   let forwardAngle=Infinity;
   for(const edge of graph.edges.get(start)??[]){
    if(edge.to===incomingNode||edge.meters<=0||explored.has(edge.id)||reservedEdges.has(edge.id)||reservedTargets.has(edge.to)||
       (_allowedRoads&&!_allowedRoads.has(edge.id))||(discoveryAllowed&&!discoveryAllowed.has(edge.id))||
       (requiredFrontier&&!requiredFrontier.has(start))||!specialistMatch(edge.highway??''))continue;
    const end=graph.nodes.get(edge.to);if(!end||am<1e-12)continue;
    const bx=(end[0]-at[0])*scale,by=end[1]-at[1],bm=Math.hypot(bx,by);
    if(bm<1e-12)continue;
    const cosine=(ax*bx+ay*by)/(am*bm);
    if(cosine>0.5&&-cosine<forwardAngle){
     forwardAngle=-cosine;
     forward={from:start,to:edge.to,id:edge.id,distance:0,inside:false,local:true};
    }
   }
   if(forward)best=forward;
  }
 }
 if(!best)return taxi;
 const block=taxi.explorerRole?null:blockPerimeter(graph,best.from,best.to,best.id,_allowedRoads);
 const keys=[best.from],ids:string[]=[];
 let node=best.from;
 while(node!==start){
  const step=previous.get(node);if(!step)return taxi;
  ids.push(step.id);keys.push(step.from);node=step.from;
 }
 keys.reverse();ids.reverse();
 keys.push(best.to);ids.push(best.id);
 // Connected routes may reverse at junctions when necessary.
 // Before continuing each block perimeter, clear short dead-end branches.
 // Traverse the branch to its tip and return to the SAME junction, then resume
 // the saved perimeter. Limit work per assignment to keep dispatch responsive.
 if(block){
  const perimeterIds=new Set<string>([best.id,...block.ids]);
  const visitedBranches=new Set<string>();
  // Branches are prioritised before the next perimeter segment. There is no
  // distance limit: only a graph-work safety bound against malformed networks.
  const MAX_BRANCH_NODES=12000;
  const branchFrom=(junction:string,previousNode:string|undefined)=>{
   for(const candidate of graph.edges.get(junction)??[]){
    if(perimeterIds.has(candidate.id)||visitedBranches.has(candidate.id)||explored.has(candidate.id)||
       reservedEdges.has(candidate.id)||(discoveryAllowed&&!discoveryAllowed.has(candidate.id))||
       (_allowedRoads&&!_allowedRoads.has(candidate.id)))continue;
    if(previousNode&&forbiddenUTurn(graph,previousNode,junction,candidate.to,_allowedRoads))continue;
    // Walk the connected branch and collect its tree edges. If it connects
    // back to another road on the block, it is not a dead-end branch.
    const parent=new Map<string,{from:string;id:string}>();
    const seen=new Set<string>([junction,candidate.to]);
    const stack=[candidate.to];
    parent.set(candidate.to,{from:junction,id:candidate.id});
    let hasCycle=false,overLimit=false;
    for(let cursor=0;cursor<stack.length;cursor++){
     if(stack.length>MAX_BRANCH_NODES){overLimit=true;break;}
     const node=stack[cursor];
     for(const edge of graph.edges.get(node)??[]){
      if(edge.to===parent.get(node)?.from)continue;
      if(perimeterIds.has(edge.id)||edge.to===junction){hasCycle=true;continue;}
      if((_allowedRoads&&!_allowedRoads.has(edge.id))||
         (discoveryAllowed&&!discoveryAllowed.has(edge.id)))continue;
      if(seen.has(edge.to)){hasCycle=true;continue;}
      if(explored.has(edge.id)||reservedEdges.has(edge.id)||visitedBranches.has(edge.id)){
       // An already explored exit means this is not a terminal branch.
       hasCycle=true;continue;
      }
      seen.add(edge.to);parent.set(edge.to,{from:node,id:edge.id});stack.push(edge.to);
     }
    }
    if(hasCycle||overLimit)continue;
    // Depth-first traversal covers each side branch before returning to its
    // parent junction, then resumes the original block perimeter.
    const children=new Map<string,Array<{to:string;id:string}>>();
    for(const [to,entry] of parent){
     const list=children.get(entry.from)??[];list.push({to,id:entry.id});children.set(entry.from,list);
    }
    type Frame={node:string;index:number};
    const frames:Frame[]=[{node:junction,index:0}];
    while(frames.length){
     const frame=frames[frames.length-1],options=children.get(frame.node)??[];
     if(frame.index>=options.length){
      frames.pop();
      if(frames.length){
       const p=parent.get(frame.node)!;
       keys.push(p.from);ids.push(p.id);
      }
      continue;
     }
     const edge=options[frame.index++];
     keys.push(edge.to);ids.push(edge.id);visitedBranches.add(edge.id);
     frames.push({node:edge.to,index:0});
    }
   }
  };
  for(let i=1;i<block.nodes.length;i++){
   const junction=keys[keys.length-1];
   const previousNode=keys.length>1?keys[keys.length-2]:undefined;
   branchFrom(junction,previousNode);
   keys.push(block.nodes[i]);ids.push(block.ids[i-1]);
  }
 }
 // Prefer a continuous forward corridor rather than a short segment and distant reversal.
 const planned=new Set(ids);
 let cursor=keys[keys.length-1];
 let extraMeters=0;
 const corridorSpecialist=taxi.kind==='explorer'&&['motorway','trunk','primary','secondary','tertiary','residential','rural','service'].includes(taxi.explorerRole??'');
 const maxSegments=corridorSpecialist?160:24;
 const maxMeters=corridorSpecialist?16000:900;
 const turnCost=(from:string,at:string,to:string):number=>{
  const a=graph.nodes.get(from),b=graph.nodes.get(at),c=graph.nodes.get(to);
  if(!a||!b||!c)return 2;
  const scale=Math.cos(b[1]*Math.PI/180);
  const ux=(b[0]-a[0])*scale,uy=b[1]-a[1];
  const vx=(c[0]-b[0])*scale,vy=c[1]-b[1];
  const mag=Math.hypot(ux,uy)*Math.hypot(vx,vy);
  return mag>1e-14?1-(ux*vx+uy*vy)/mag:2;
 };
 for(let step=0;step<(block?0:maxSegments)&&extraMeters<maxMeters;step++){
  const previousNode=keys.length>1?keys[keys.length-2]:undefined;
  const links=(graph.edges.get(cursor)??[]).filter(edge=>
   (taxi.kind!=='explorer'||!_allowedRoads||_allowedRoads.has(edge.id))&&
   (!regionalCandidates||regionalCandidates.has(edge.id))&&(!discoveryAllowed||discoveryAllowed.has(edge.id))&&!explored.has(edge.id)&&
   !reservedEdges.has(edge.id)&&!planned.has(edge.id)&&
   !reservedTargets.has(edge.to)&&edge.meters>0&&edge.to!==previousNode
  );
  if(!links.length)break;
  links.sort((a,b)=>{
   if(corridorSpecialist&&previousNode){
    const turnA=turnCost(previousNode,cursor,a.to);
    const turnB=turnCost(previousNode,cursor,b.to);
    if(Math.abs(turnA-turnB)>0.02)return turnA-turnB;
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
  pickup:undefined,dropoff:undefined,fare:0,explorationSection:undefined,explorationSectionCompleted:undefined,explorationSectionTotal:undefined,scoutingRuns:(taxi.scoutingRuns??0)+1};
}
// Shared integrator: simulation and marker animation use exactly the same road speeds.
// Acceleration/deceleration is expressed in real seconds (1x wall time).
// PR D: Road-speed-aware vehicle dynamics. Only speed integration changes;
// existing route, discovery, dispatch and arrival handling remain untouched.
const clamp=(value:number,low:number,high:number)=>Math.max(low,Math.min(high,value));
// Road graphs are keyed by OSM node IDs, not coordinate strings.
// Cache an edge-ID speed index per graph snapshot to avoid O(E) work per frame.
const roadSpeedIndex=new WeakMap<RoadGraph,Map<string,number>>();
function speedForEdge(graph:RoadGraph,id:string|undefined):number{
 if(!id)return 50;
 let index=roadSpeedIndex.get(graph);
 if(!index){
  index=new Map<string,number>();
  for(const links of graph.edges.values())for(const edge of links)index.set(edge.id,edge.speedKph);
  roadSpeedIndex.set(graph,index);
 }
 return index.get(id)??50;
}
export function advanceTaxi(taxi:Taxi,graph:RoadGraph,realSeconds:number):{taxi:Taxi;crossed:string[];distanceMeters:number}{
 if(taxi.status==='IDLE'||taxi.path.length<2||realSeconds<=0)return{taxi,crossed:[],distanceMeters:0};
 const t={...taxi};
 const crossed:string[]=[];
 let distanceMeters=0;
 // Drive at the exact hardcoded road speed: no acceleration, traffic or turn slowdown.
 let time=Math.min(realSeconds,5)*GAME_SPEED;
 while(time>0.00001&&t.leg<t.path.length-1){
  const a=t.path[t.leg],b=t.path[t.leg+1];
  const length=meters(a,b);
  const roadSpeed=clamp(speedForEdge(graph,t.edgeIds[t.leg]),5,160);
  const metersPerSecond=roadSpeed/3.6;
  t.speedKph=roadSpeed;
  const remaining=Math.max(0,length-t.distanceIntoLeg);
  const stepSeconds=Math.min(time,remaining/metersPerSecond);
  const moved=metersPerSecond*stepSeconds;
  t.distanceIntoLeg+=moved;
  distanceMeters+=moved;
  const fraction=length>0?clamp(t.distanceIntoLeg/length,0,1):1;
  t.position=[a[0]+(b[0]-a[0])*fraction,a[1]+(b[1]-a[1])*fraction];
  time-=stepSeconds;
  if(t.distanceIntoLeg>=length-0.0001){
   const id=t.edgeIds[t.leg];if(id)crossed.push(id);
   t.lastRoadFrom=key(a);t.lastRoadTo=key(b);
   t.leg++;t.distanceIntoLeg=0;t.position=b;
   if(t.leg<t.path.length-1){
    t.speedKph=clamp(speedForEdge(graph,t.edgeIds[t.leg]),5,160);
   }
  }
  if(stepSeconds<=0&&remaining>0)break;
 }
 return{taxi:t,crossed,distanceMeters};
}
export function tickTaxi(taxi:Taxi,graph:RoadGraph,seconds:number,_discoveredRoads?:Set<string>):{taxi:Taxi;earned:number;finished:boolean;discovered:string[];distanceMeters:number}{
 if(taxi.status==='IDLE'||taxi.status==='REFUELLING'||taxi.status==='PAUSED')return{taxi,earned:0,finished:false,discovered:[],distanceMeters:0};
 const advanced=advanceTaxi(taxi,graph,seconds);
 // Only completed graph edges are discovered. advanceTaxi reports an edge
 // when the vehicle reaches its destination node, never partway through.
 // Discovery is not the same as driving: transit on another category never reveals it.
  // The assignment's discoveryEdgeIds are the sole authority for explorer discoveries.
  const eligible=taxi.kind==='explorer'?new Set(taxi.status==='EXPLORING'?(taxi.discoveryEdgeIds??[]):[]):null;
  // The motorway explorer may transit undiscovered roads of any class, but
  // traversing them must never reveal them. Validate against the graph as well
  // as the dispatch assignment, including routes restored from older saves.
  const newlyDiscovered=eligible?advanced.crossed.filter(id=>{
   if(!eligible.has(id))return false;
   if(taxi.explorerRole!=='motorway')return true;
   // Only inspect edges actually crossed this tick, never scan the whole graph.
   for(let leg=taxi.leg;leg<advanced.taxi.leg;leg++){
    if(taxi.edgeIds[leg]!==id)continue;
    const from=taxi.path[leg],to=taxi.path[leg+1];
    if(!from||!to)continue;
    const edge=graph.edges.get(key(from))?.find(e=>e.id===id&&e.to===key(to));
    if(edge?.highway==='motorway'||edge?.highway==='motorway_link')return true;
   }
   return false;
  }):advanced.crossed;
 let t={...advanced.taxi,journeyEdges:[...(taxi.journeyEdges??[]),...newlyDiscovered]};
 if(t.leg<t.path.length-1)return{taxi:t,earned:0,finished:false,discovered:newlyDiscovered,distanceMeters:advanced.distanceMeters};
 if(t.status==='TO_PICKUP'&&t.dropoff){
  const from=nearest(graph,t.position),to=nearest(graph,t.dropoff);
  const next=_discoveredRoads?routeDiscovered(graph,from,to,_discoveredRoads,t.lastRoadTo===from?t.lastRoadFrom??'':''):route(graph,from,to,t.lastRoadTo===from?t.lastRoadFrom??'':'');
  if(next&&next.path.length>1){
   t={...t,status:'TO_DROPOFF',path:next.path,edgeIds:next.edgeIds,leg:0,distanceIntoLeg:0};
   return{taxi:t,earned:0,finished:false,discovered:advanced.crossed,distanceMeters:advanced.distanceMeters};
  }
 }
 if(t.status==='RETURNING'&&t.pauseAtHome){
  t={...t,status:t.kind==='surveyor'?'IDLE':'PAUSED',pauseAtHome:false,shiftParked:t.kind==='surveyor'?false:t.shiftParked,path:[],edgeIds:[],leg:0,distanceIntoLeg:0,speedKph:0,journeyEdges:[]};
  return{taxi:t,earned:0,finished:false,discovered:[],distanceMeters:advanced.distanceMeters};
 }
 if(t.status==='RETURNING'&&t.serviceDestination){
  t={...t,status:'SERVICING',path:[],edgeIds:[],leg:0,distanceIntoLeg:0,speedKph:0,serviceUntil:undefined,serviceDestination:undefined,journeyEdges:[]};
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
