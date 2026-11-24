import {meters,nearest,routeDiscovered,type Point,type RoadGraph} from './simulation/taxi';

import type {CollectorSupplier} from './collectorSuppliers';
import {reserveSupplier,supplierStock,type GeneratedSupplier} from './generatedSuppliers';

export const COLLECTOR_PARTS=['mechanical','electronics','business','construction','marine','research','energy','rare'] as const;
export type CollectorPart=typeof COLLECTOR_PARTS[number];
export const COLLECTOR_NAMES:Record<CollectorPart,string>={mechanical:'Mechanical parts',electronics:'Electronic components',business:'Business resources',construction:'Construction materials',marine:'Marine components',research:'Research data',energy:'Energy components',rare:'Rare components'};
export type CollectorStock=Partial<Record<CollectorPart,number>>;
export type CollectorTrip={path:Point[];outboundMetres:number;distance:number;startedAt:number;endsAt:number;part:CollectorPart;quantity:number;supplierId?:string;supplierName?:string;warehouseId?:string};
export type CollectorState={stock:CollectorStock;delivered:CollectorStock;trips:number;trip?:CollectorTrip;vehicles?:CollectorVehicle[];warehouses?:CollectorWarehouse[];suppliers?:Record<string,GeneratedSupplier>;expenses?:CollectorExpenses};
export const emptyCollector=():CollectorState=>({stock:{},delivered:{},trips:0});
const categoryParts:CollectorPart[]=['business','mechanical','electronics','research','business','mechanical','business','rare','marine','business','construction','energy'];
export function collectorRequirement(category:number,level:number):{part:CollectorPart;quantity:number}{
 return {part:categoryParts[category]??'research',quantity:Math.max(1,Math.ceil(level*2))};
}
export function collectorPosition(trip:CollectorTrip,now:number):Point{
 if(now<=trip.startedAt)return trip.path[0];
 if(now>=trip.endsAt)return trip.path[trip.path.length-1];
 let left=trip.distance*Math.max(0,Math.min(1,(now-trip.startedAt)/(trip.endsAt-trip.startedAt)));
 for(let i=1;i<trip.path.length;i++){
  const a=trip.path[i-1],b=trip.path[i],d=meters(a,b);
  if(left<=d&&d>0){const f=left/d;return [a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];}
  left-=d;
 }
 return trip.path[trip.path.length-1];
}
/** An independent depot-based collector. Only discovered, non-taxi-only roads
 * are eligible. A shipment is credited once, on return to the depot.
 * Prefer mapped suppliers; local simulated supply points maintain rural access. */
export function tickCollector(state:CollectorState,now:number,graph:RoadGraph|null,discovered:Set<string>,hq:Point,options:{capacity?:number;speed?:number;priority?:CollectorPart;offset?:number;loadingMs?:number;suppliers?:readonly CollectorSupplier[];generated?:readonly GeneratedSupplier[];warehouseId?:string;maxDistanceKm?:number;freeByPart?:CollectorStock}={}):CollectorState{
 if(state.trip){
  if(now<state.trip.endsAt)return state;
  const {part,quantity}=state.trip;
  return {...state,trip:undefined,trips:state.trips+1,stock:{...state.stock,[part]:(state.stock[part]??0)+quantity},delivered:{...state.delivered,[part]:(state.delivered[part]??0)+quantity}};
 }
 if(!graph||!discovered.size)return state;
 const start=nearest(graph,hq),origin=graph.nodes.get(start);
 if(!origin||meters(origin,hq)>500)return state;
 const part=options.priority??COLLECTOR_PARTS[(state.trips+(options.offset??0))%COLLECTOR_PARTS.length];
 const candidatesBySupplier=(options.suppliers??[]).filter(p=>p.parts.includes(part)&&meters(origin,p.position)<=25000).sort((a,b)=>meters(origin,a.position)-meters(origin,b.position)).slice(0,16);
 const makeTrip=(end:string,supplier?:{id:string;name:string},resource=part,quantity=options.capacity??12):CollectorState|null=>{
  const out=routeDiscovered(graph,start,end,discovered,'',false,10000);
  const back=routeDiscovered(graph,end,start,discovered,'',false,10000);
  if(!out||!back||out.path.length<2||back.path.length<2)return null;
  const path=[...out.path,...back.path.slice(1)];
  const distance=path.slice(1).reduce((n,p,j)=>n+meters(path[j],p),0);
  if(distance<200||distance/1000>(options.maxDistanceKm??Infinity))return null;
  quantity=Math.min(quantity,options.freeByPart?.[resource]??Infinity);if(quantity<=0)return null;
  const duration=Math.max(180000,Math.round(distance/1000/(options.speed??35)*3600000+(options.loadingMs??0)));
  return {...state,trip:{path,outboundMetres:out.length,distance,startedAt:now,endsAt:now+duration,part:resource,quantity,supplierId:supplier?.id,supplierName:supplier?.name??'Local supply point (simulated)',warehouseId:options.warehouseId??'main'}};
 };
 if(options.generated){
  // Automatic vehicles rotate the preferred resource, but may collect another
  // available type when that resource is not yet reachable. Explicit priorities
  // wait for a matching supplier rather than silently changing the cargo.
  const nearby=options.generated.filter(p=>(!options.priority||p.part===options.priority)&&supplierStock(p,now)>0&&(options.freeByPart?.[p.part]??Infinity)>0&&meters(origin,p.position)<=25000)
   .sort((a,b)=>Number(b.part===part)-Number(a.part===part)||meters(origin,a.position)-meters(origin,b.position));
  for(const supplier of nearby.slice(0,24)){
   if(!graph.nodes.has(supplier.node)||supplier.node===start)continue;
   const trip=makeTrip(supplier.node,supplier,supplier.part,Math.min(options.capacity??12,supplierStock(supplier,now)));
   if(trip)return trip;
  }
  return state; // Never mint cargo from an unregistered fallback in procedural mode.
 }
 for(const supplier of candidatesBySupplier){
  const target=nearest(graph,supplier.position),point=graph.nodes.get(target);
  if(!point||meters(point,supplier.position)>350||target===start)continue;
  const trip=makeTrip(target,supplier);if(trip)return trip;
 }
 const queue=[start],seen=new Set(queue),candidates:string[]=[];
 for(let i=0;i<queue.length&&i<700;i++){
  const node=queue[i],point=graph.nodes.get(node);
  if(point&&meters(origin,point)>300)candidates.push(node);
  for(const e of graph.edges.get(node)??[]){
   if(e.taxiOnly||!discovered.has(e.id)||seen.has(e.to))continue;
   seen.add(e.to);queue.push(e.to);
  }
 }
 if(!candidates.length)return state;
 for(let i=0;i<Math.min(8,candidates.length);i++){
  const end=candidates[(state.trips*17+(options.offset??0)*23+i*13)%candidates.length];
  const trip=makeTrip(end);if(trip)return trip;
 }
 return state;
}

export const COLLECTOR_MODELS={
 light:{name:'Light collector van',price:18000,capacity:12,speed:35,litresPer100Km:7.5,tank:55,maintenancePerKm:.065,servicePrice:180,research:'collectorBasics'},
 medium:{name:'Medium collector van',price:42000,capacity:30,speed:42,litresPer100Km:10,tank:75,maintenancePerKm:.09,servicePrice:300,research:'collectorMedium'},
 heavy:{name:'Heavy collector truck',price:85000,capacity:65,speed:32,litresPer100Km:26,tank:180,maintenancePerKm:.18,servicePrice:650,research:'collectorHeavy'},
 offroad:{name:'Utility collector pickup',price:56000,capacity:22,speed:38,litresPer100Km:11.5,tank:70,maintenancePerKm:.11,servicePrice:350,research:'collectorUtility'}
} as const;
export type CollectorModel=keyof typeof COLLECTOR_MODELS;
export type CollectorVehicle={id:string;model:CollectorModel;trips:number;trip?:CollectorTrip;priority?:CollectorPart;paused?:boolean;offset:number;distanceKm:number;warehouseId?:string;fuelLitres?:number;expenses?:CollectorExpenses;lastServiceKm?:number;serviceUntil?:number;waitingReason?:string};
type Levels=Partial<Record<string,number>>;
export function collectorVehicles(state:CollectorState):CollectorVehicle[]{
 return state.vehicles??[{id:'starter-collector',model:'light',trips:state.trips,trip:state.trip,offset:0,distanceKm:0}];
}
export function collectorLimit(levels:Levels):number{
 return levels.collectorRegional?12:levels.collectorDispatch?6:levels.collectorBasics?3:1;
}
export function collectorPurchaseLock(state:CollectorState,model:CollectorModel,levels:Levels):string|null{
 if(!levels[COLLECTOR_MODELS[model].research])return 'Requires '+COLLECTOR_MODELS[model].research+' research';
 if(collectorVehicles(state).length>=collectorLimit(levels))return 'Collector fleet capacity reached';
 return null;
}
export function addCollector(state:CollectorState,model:CollectorModel,id:string,levels:Levels):CollectorState{
 const reason=collectorPurchaseLock(state,model,levels);if(reason)throw Error(reason);
 const vehicles=collectorVehicles(state);
 return {...state,trip:undefined,vehicles:[...vehicles,{id,model,trips:0,offset:vehicles.length,distanceKm:0}]};
}
export function configureCollector(state:CollectorState,id:string,change:{priority?:CollectorPart|null;paused?:boolean;warehouseId?:string},levels:Levels):CollectorState{
 const vehicles=collectorVehicles(state);
 if(!vehicles.some(v=>v.id===id))return state;
 if(change.priority!==undefined&&!levels.collectorPriority)return state;
 if(change.warehouseId!==undefined&&(!levels.collectorRegional||!state.warehouses?.some(w=>w.id===change.warehouseId)&&change.warehouseId!=='main'||vehicles.some(v=>v.id===id&&(v.trip||!v.paused))))return state;
 return {...state,trip:undefined,vehicles:vehicles.map(v=>v.id===id?{...v,...(change.paused!==undefined?{paused:change.paused}:{}),...(change.priority!==undefined?{priority:change.priority??undefined}:{}),...(change.warehouseId!==undefined?{warehouseId:change.warehouseId}:{})}:v)};
}
export function collectorCapacity(model:CollectorModel,levels:Levels):number{
 return Math.floor(COLLECTOR_MODELS[model].capacity*(levels.collectorCargo?1.25:1));
}
/** Preserve the old starter journey, settle each van once, and share one depot inventory. */
export function tickCollectorFleet(state:CollectorState,now:number,graph:RoadGraph|null,discovered:Set<string>,hq:Point,levels:Levels,suppliers:readonly CollectorSupplier[]=[],depots:readonly CollectorDepot[]=[],economy?:{cash:number;fuelPrice?:number}):CollectorState{
 let stock=state.stock,delivered=state.delivered,trips=state.trips,changed=!state.vehicles||!state.warehouses;
 let generated=state.suppliers;
 let expenses=state.expenses??emptyCollectorExpenses();
 let budget=economy?Math.max(0,Math.floor(economy.cash*100)):Infinity;
 const capacity=collectorStorageCapacity(state,levels);
 const stored=collectorUnits(state.stock);
 let reserved=collectorVehicles(state).reduce((sum,v)=>sum+(v.trip?.quantity??0),0);
 const reservedByPart:CollectorStock={};
 for(const v of collectorVehicles(state))if(v.trip)reservedByPart[v.trip.part]=(reservedByPart[v.trip.part]??0)+v.trip.quantity;
 let warehouses=state.warehouses??[{id:'main',trips:state.trips,delivered:{...state.delivered}}];
 const available=collectorWarehouses(state,depots,hq);
 const vehicles=collectorVehicles(state).map(v=>{
  if(v.paused&&!v.trip)return v;
  if(v.trip&&now<v.trip.endsAt)return v;
  if(v.serviceUntil&&now<v.serviceUntil)return v;
  const wait=(reason:string)=>{if(v.waitingReason===reason)return v;changed=true;return {...v,waitingReason:reason};};
  const model=COLLECTOR_MODELS[v.model];
  if(!v.trip&&economy&&v.distanceKm-(v.lastServiceKm??0)>=COLLECTOR_SERVICE_KM){
   const cost=Math.round(model.servicePrice*100);if(budget<cost)return wait('Waiting for service funds');
   budget-=cost;expenses=addCollectorExpenses(expenses,{fuelCents:0,maintenanceCents:0,serviceCents:cost});changed=true;
   return {...v,lastServiceKm:v.distanceKm,serviceUntil:now+3600000,waitingReason:'Scheduled maintenance',expenses:addCollectorExpenses(v.expenses??emptyCollectorExpenses(),{fuelCents:0,maintenanceCents:0,serviceCents:cost})};
  }
  const freeByPart:CollectorStock={};
  const free=Math.max(0,capacity-stored-reserved);
  for(const part of COLLECTOR_PARTS)freeByPart[part]=Math.max(0,Math.min(free,Math.floor(capacity/8)-(stock[part]??0)-(reservedByPart[part]??0)));
  if(!v.trip&&economy&&(!free||!COLLECTOR_PARTS.some(p=>(freeByPart[p]??0)>0)))return wait('Warehouse storage full');
  const previous:CollectorState={stock,delivered,trips:v.trips,trip:v.trip};
  const warehouse=available.find(w=>w.id===(v.warehouseId??'main'))??available[0];
  const next=tickCollector(previous,now,graph,discovered,warehouse.position,{suppliers,generated:generated?Object.values(generated):undefined,warehouseId:warehouse.id,freeByPart:economy?freeByPart:undefined,maxDistanceKm:economy?model.tank*100/collectorFuelRate(v.model,levels):undefined,capacity:collectorCapacity(v.model,levels),speed:model.speed*(levels.collectorRouting?1.15:1),priority:v.priority,offset:v.offset,loadingMs:levels.collectorLoading?30000:90000});
  if(next===previous)return economy?wait(v.priority&&(freeByPart[v.priority]??0)<=0?'Resource storage full':'Waiting for reachable supplier'):v;
  let tripExpenses:CollectorExpenses|undefined,tripLitres=0;
  if(!v.trip&&next.trip&&economy){
   const quote=collectorTripCost(v.model,next.trip.distance/1000,levels,economy.fuelPrice);
   tripExpenses=quote.expenses;tripLitres=quote.litres;
   if(collectorExpenseTotal(tripExpenses)>budget)return wait('Insufficient operating cash');
  }
  if(!v.trip&&next.trip&&generated){
   const supplier=generated[next.trip.supplierId??''];if(!supplier)return v;
   const reservation=reserveSupplier(supplier,now,next.trip.quantity);
   if(!reservation.quantity)return v;
   generated={...generated,[supplier.id]:reservation.supplier};
   next.trip={...next.trip,quantity:reservation.quantity};
  }
  if(!v.trip&&next.trip){reserved+=next.trip.quantity;reservedByPart[next.trip.part]=(reservedByPart[next.trip.part]??0)+next.trip.quantity;}
  if(tripExpenses){budget-=collectorExpenseTotal(tripExpenses);expenses=addCollectorExpenses(expenses,tripExpenses);}
  changed=true;stock=next.stock;delivered=next.delivered;
  trips+=next.trips-v.trips;
  if(v.trip&&!next.trip){const id=v.trip.warehouseId??'main';const prior=warehouses;const old=prior.find(w=>w.id===id);const item={id,delivered:{...old?.delivered,[v.trip.part]:(old?.delivered[v.trip.part]??0)+v.trip.quantity},trips:(old?.trips??0)+1};warehouses=[...prior.filter(w=>w.id!==id),item];}
  return {...v,trips:next.trips,trip:next.trip,distanceKm:v.distanceKm+(v.trip&&!next.trip?v.trip.distance/1000:0),waitingReason:undefined,serviceUntil:undefined,fuelLitres:(v.fuelLitres??0)+tripLitres,expenses:tripExpenses?addCollectorExpenses(v.expenses??emptyCollectorExpenses(),tripExpenses):v.expenses};
 });
 return changed?{...state,stock,delivered,trips,trip:undefined,vehicles,warehouses,suppliers:generated,expenses}:state;
}

export type CollectorDepot={id:string;name:string;lng:number;lat:number};
export type CollectorWarehouse={id:string;delivered:CollectorStock;trips:number};
export function collectorWarehouses(state:CollectorState,depots:readonly CollectorDepot[],hq:Point){
 const main=state.warehouses?.find(w=>w.id==='main');
 return [{id:'main',name:'Headquarters warehouse',position:hq,trips:main?.trips??state.trips,delivered:main?.delivered??state.delivered},...depots.filter(d=>state.warehouses?.some(w=>w.id===d.id)).map(d=>{
  const w=state.warehouses!.find(w=>w.id===d.id)!;
  return {id:d.id,name:d.name+' warehouse',position:[d.lng,d.lat] as Point,trips:w.trips,delivered:w.delivered};
 })];
}
export const REGIONAL_WAREHOUSE_PRICE=75000;
export function openCollectorWarehouse(state:CollectorState,id:string,levels:Levels,depots:readonly CollectorDepot[]):CollectorState{
 if(!levels.collectorRegional)throw Error('Requires Regional Collector Network');
 if(id==='main'||state.warehouses?.some(w=>w.id===id)||!depots.some(d=>d.id===id))throw Error('Choose an existing depot without a warehouse');
 const previous=state.warehouses??[{id:'main',trips:state.trips,delivered:{...state.delivered}}];
 return {...state,warehouses:[...previous,{id,trips:0,delivered:{}}]};
}

export type CollectorExpenses={fuelCents:number;maintenanceCents:number;serviceCents:number};
export const emptyCollectorExpenses=():CollectorExpenses=>({fuelCents:0,maintenanceCents:0,serviceCents:0});
export const collectorExpenseTotal=(e:CollectorExpenses)=>e.fuelCents+e.maintenanceCents+e.serviceCents;
export function addCollectorExpenses(a:CollectorExpenses,b:CollectorExpenses):CollectorExpenses{return {fuelCents:a.fuelCents+b.fuelCents,maintenanceCents:a.maintenanceCents+b.maintenanceCents,serviceCents:a.serviceCents+b.serviceCents};}
export const COLLECTOR_FUEL_PRICE=1.75;
export const COLLECTOR_SERVICE_KM=5000;
export function collectorFuelRate(model:CollectorModel,levels:Levels){return COLLECTOR_MODELS[model].litresPer100Km*(1-Math.min(.35,(levels.engine??0)*.04+(levels.fuelInjection??0)*.02));}
export function collectorTripCost(model:CollectorModel,km:number,levels:Levels,price=COLLECTOR_FUEL_PRICE){
 const litres=km*collectorFuelRate(model,levels)/100;
 const maintenance=km*COLLECTOR_MODELS[model].maintenancePerKm*(1-Math.min(.4,(levels.workshopResearch??0)*.04+(levels.lubrication??0)*.03));
 return {litres,expenses:{fuelCents:Math.round(litres*price*100),maintenanceCents:Math.round(maintenance*100),serviceCents:0}};
}
export const collectorUnits=(stock:CollectorStock)=>COLLECTOR_PARTS.reduce((sum,p)=>sum+(stock[p]??0),0);
export function collectorStorageCapacity(state:CollectorState,levels:Levels){
 const regional=state.warehouses?.filter(w=>w.id!=='main').length??0;
 return Math.floor((1200+regional*2000)*(1+Math.min(.5,(levels.depotEfficiency??0)*.10)));
}
export function collectorStorageUsage(state:CollectorState){return {stored:collectorUnits(state.stock),reserved:collectorVehicles(state).reduce((sum,v)=>sum+(v.trip?.quantity??0),0)};}
