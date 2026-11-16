/**
 * Taxi Autopilot 2.0 — Phase 4. Financial reporting uses posted game ledger
 * amounts; activity measures are observed distance/time, not route estimates.
 * Never changes dispatch decisions, graph copies or driving physics.
 */
import type {FleetState,Taxi,VehicleFinancePeriod} from './taxi';

export type TaxiAnalyticsRange='today'|'7d'|'30d';
export const TAXI_ANALYTICS_RANGES:readonly TaxiAnalyticsRange[]=['today','7d','30d'];
export type TaxiActivityField=
 'passengerKm'|'emptyKm'|'pickupKm'|'repositionKm'|
 'onDutyGameSeconds'|'serviceGameSeconds'|'occupiedGameSeconds';
export const TAXI_ACTIVITY_FIELDS:readonly TaxiActivityField[]=[
 'passengerKm','emptyKm','pickupKm','repositionKm','onDutyGameSeconds',
 'serviceGameSeconds','occupiedGameSeconds',
];

const finitePositive=(v:unknown):number=>
 typeof v==='number'&&Number.isFinite(v)&&v>0?v:0;
const roundPercent=(top:number,base:number):number|null=>
 base>0?Math.max(0,Math.min(100,Math.round(100*top/base))):null;

export type TaxiActivitySnapshot=Pick<Taxi,TaxiActivityField>;

/** Account for each actual move only once. Every non-passenger km, including
 * pickups, shift transfers and positioning, is an empty revenue km. The
 * 24x game-time multiplier is passed in by the simulation, not invented here.
 */
export function advanceTaxiActivity(
 vehicle:Taxi,status:Taxi['status'],actualMetres:number,
 elapsedGameSeconds:number,eligibleForWork:boolean,
):TaxiActivitySnapshot{
 const values=Object.fromEntries(TAXI_ACTIVITY_FIELDS.map(k=>[k,finitePositive(vehicle[k])])) as Record<TaxiActivityField,number>;
 if(vehicle.kind&&vehicle.kind!=='taxi')return values;
 const km=finitePositive(actualMetres)/1000;
 const seconds=finitePositive(elapsedGameSeconds);
 const carrying=status==='TO_DROPOFF';
 const pickup=status==='TO_PICKUP';
 const reposition=status==='REPOSITIONING';
 const busy=carrying||pickup;
 values.passengerKm+=carrying?km:0;
 values.emptyKm+=carrying?0:km;
 values.pickupKm+=pickup?km:0;
 values.repositionKm+=reposition?km:0;
 // Paid route overrun beyond shift still counts as service, and must be
 // included in the corresponding denominator.
 const available=eligibleForWork&&status!=='PAUSED'&&!vehicle.shiftParked||
  busy;
 values.onDutyGameSeconds+=available?seconds:0;
 values.serviceGameSeconds+=busy?seconds:0;
 values.occupiedGameSeconds+=carrying?seconds:0;
 return values;
}

export type TaxiOperationsRow={
 id:string;name:string;driver:string;depotId:string;status:Taxi['status'];
 revenue:number;expenses:number;net:number;km:number;trips:number;
 passengerKm:number;emptyKm:number;pickupKm:number;repositionKm:number;
 onDutyGameSeconds:number;serviceGameSeconds:number;occupiedGameSeconds:number;
 fuelCost:number;maintenanceCost:number;wageCost:number;insuranceCost:number;
 otherCost:number;
 hasDistanceMetrics:boolean;hasTimeMetrics:boolean;hasCostDetails:boolean;
 utilisation:number|null;occupiedShare:number|null;paidKmShare:number|null;
};
export type TaxiOperationsDepot={
 id:string;name:string;taxiCount:number;taxiRevenue:number;taxiExpenses:number;
 taxiContribution:number;taxiTrips:number;taxiKm:number;
 /** Depot total includes non-passenger explorers and their operating costs. */
 depotRevenue:number;depotVehicleExpenses:number;facilityCost:number;
 allocatedOverhead:number;depotNet:number;
};
export type TaxiOperationsDay={day:string;revenue:number;expenses:number;net:number;trips:number};
export type TaxiOperationsReport={
 range:TaxiAnalyticsRange;fromDay:string;toDay:string;
 rows:TaxiOperationsRow[];depots:TaxiOperationsDepot[];daily:TaxiOperationsDay[];
 totalRevenue:number;totalExpenses:number;totalNet:number;totalKm:number;
 totalTrips:number;totalPassengerKm:number;totalEmptyKm:number;
 totalPickupKm:number;totalRepositionKm:number;
 totalFuel:number;totalMaintenance:number;totalWages:number;totalInsurance:number;totalOther:number;
 utilisation:number|null;occupiedShare:number|null;paidKmShare:number|null;
 hasDistanceMetrics:boolean;hasTimeMetrics:boolean;hasCostDetails:boolean;
};

export function taxiAnalyticsDateRange(now:number,range:TaxiAnalyticsRange):{
 start:string;end:string;days:number;
}{
 const nowMs=Number.isFinite(now)?now:Date.now();
 const current=new Date(nowMs);
 const end=current.toISOString().slice(0,10);
 const days=range==='today'?1:range==='7d'?7:30;
 const midnight=Date.UTC(current.getUTCFullYear(),
  current.getUTCMonth(),current.getUTCDate());
 const start=new Date(midnight-(days-1)*86400000).toISOString().slice(0,10);
 return {start,end,days};
}

const activityFields=([...TAXI_ACTIVITY_FIELDS] as const);
const costFields=['fuelCost','maintenanceCost','wageCost','insuranceCost'] as const;

export function taxiOperationsReport(
 fleet:Pick<FleetState,'taxis'|'vehicleFinanceHistory'|'depotFinanceHistory'>,
 now:number,range:TaxiAnalyticsRange,
):TaxiOperationsReport{
 const {start,end,days}=taxiAnalyticsDateRange(now,range);
 const taxis=fleet.taxis.filter(t=>!t.kind||t.kind==='taxi');
 const rowsById=new Map<string,TaxiOperationsRow>();
 for(const taxi of taxis){
  rowsById.set(taxi.id,{
   id:taxi.id,name:taxi.name,driver:taxi.driver,
   depotId:taxi.depotId??'main',status:taxi.status,
   revenue:0,expenses:0,net:0,km:0,trips:0,
   passengerKm:0,emptyKm:0,pickupKm:0,repositionKm:0,
   onDutyGameSeconds:0,serviceGameSeconds:0,occupiedGameSeconds:0,
   fuelCost:0,maintenanceCost:0,wageCost:0,insuranceCost:0,
   otherCost:0,
   hasDistanceMetrics:false,hasTimeMetrics:false,hasCostDetails:false,
   utilisation:null,occupiedShare:null,paidKmShare:null,
  });
 }
 const perDay=new Map<string,TaxiOperationsDay>();
 // Already bounded by save policy (max 5,000 rows). No full road graph,
 // network request, new worker, or per-tick computation in the dashboard.
 for(const entry of fleet.vehicleFinanceHistory??[]){
  if(entry.day<start||entry.day>end)continue;
  const row=rowsById.get(entry.taxiId);
  if(!row)continue; // excludes explorers, sold and no-longer-owned taxis
  const revenue=finitePositive(entry.revenue);
  const expenses=finitePositive(entry.expenses);
  const km=finitePositive(entry.km);
  const trips=finitePositive(entry.trips);
  row.revenue+=revenue;row.expenses+=expenses;row.km+=km;row.trips+=trips;
  for(const field of activityFields){
   row[field]+=finitePositive(entry[field]);
  }
  for(const field of costFields){
   row[field]+=finitePositive(entry[field]);
  }
  if(entry.passengerKm!==undefined||entry.emptyKm!==undefined)row.hasDistanceMetrics=true;
  if(entry.onDutyGameSeconds!==undefined||entry.serviceGameSeconds!==undefined)row.hasTimeMetrics=true;
  if(entry.fuelCost!==undefined||entry.maintenanceCost!==undefined||
    entry.wageCost!==undefined||entry.insuranceCost!==undefined)row.hasCostDetails=true;
  const day=perDay.get(entry.day)??{day:entry.day,revenue:0,expenses:0,net:0,trips:0};
  day.revenue+=revenue;day.expenses+=expenses;day.net+=revenue-expenses;day.trips+=trips;
  perDay.set(entry.day,day);
 }
 const rows=[...rowsById.values()];
 for(const row of rows){
  row.net=row.revenue-row.expenses;
  row.otherCost=Math.max(0,row.expenses-row.fuelCost-row.maintenanceCost-
   row.wageCost-row.insuranceCost);
  row.utilisation=row.hasTimeMetrics?
   roundPercent(row.serviceGameSeconds,row.onDutyGameSeconds):null;
  row.occupiedShare=row.hasTimeMetrics?
   roundPercent(row.occupiedGameSeconds,row.onDutyGameSeconds):null;
  row.paidKmShare=row.hasDistanceMetrics?
   roundPercent(row.passengerKm,row.passengerKm+row.emptyKm):null;
 }
 rows.sort((a,b)=>b.net-a.net||a.name.localeCompare(b.name));

 const depotsById=new Map<string,TaxiOperationsDepot>();
 const ensureDepot=(id:string,name:string):TaxiOperationsDepot=>{
  let d=depotsById.get(id);
  if(!d){
   d={id,name,taxiCount:0,taxiRevenue:0,taxiExpenses:0,
    taxiContribution:0,taxiTrips:0,taxiKm:0,depotRevenue:0,
    depotVehicleExpenses:0,facilityCost:0,allocatedOverhead:0,depotNet:0};
   depotsById.set(id,d);
  }
  return d;
 };
 for(const t of taxis)ensureDepot(t.depotId??'main',t.depotId??'main').taxiCount++;
 for(const row of rows){
  const depot=ensureDepot(row.depotId,row.depotId);
  depot.taxiRevenue+=row.revenue;depot.taxiExpenses+=row.expenses;
  depot.taxiContribution+=row.net;
  depot.taxiTrips+=row.trips;depot.taxiKm+=row.km;
 }
 for(const entry of fleet.depotFinanceHistory??[]){
  if(entry.day<start||entry.day>end)continue;
  const depot=ensureDepot(entry.depotId,entry.depotName);
  depot.name=entry.depotName;
  depot.depotRevenue+=finitePositive(entry.revenue);
  depot.depotVehicleExpenses+=finitePositive(entry.vehicleExpenses);
  depot.facilityCost+=finitePositive(entry.facilityExpenses);
  depot.allocatedOverhead+=finitePositive(entry.allocatedOverhead);
 }
 const depots=[...depotsById.values()];
 for(const d of depots){
  d.depotNet=d.depotRevenue-d.depotVehicleExpenses-
   d.facilityCost-d.allocatedOverhead;
 }
 depots.sort((a,b)=>b.taxiRevenue-a.taxiRevenue||a.name.localeCompare(b.name));
 const midnight=Date.parse(start+'T00:00:00.000Z');
 const daily=Array.from({length:days},(_,i)=>{
  const day=new Date(midnight+i*86400000).toISOString().slice(0,10);
  return perDay.get(day)??{day,revenue:0,expenses:0,net:0,trips:0};
 });
 const sum=(field:keyof TaxiOperationsRow):number=>rows.reduce((n,r)=>{
  const value=r[field];return n+(typeof value==='number'?value:0);
 },0);
 const totalPassengerKm=sum('passengerKm'),totalEmptyKm=sum('emptyKm');
 const duty=sum('onDutyGameSeconds'),service=sum('serviceGameSeconds');
 const tracking=rows.some(r=>r.hasDistanceMetrics);
 const trackedTime=rows.some(r=>r.hasTimeMetrics);
 const trackedCost=rows.some(r=>r.hasCostDetails);
 const totalRevenue=sum('revenue'),totalExpenses=sum('expenses');
 return {range,fromDay:start,toDay:end,rows,depots,daily,
  totalRevenue,totalExpenses,totalNet:totalRevenue-totalExpenses,
  totalKm:sum('km'),totalTrips:sum('trips'),
  totalPassengerKm,totalEmptyKm,totalPickupKm:sum('pickupKm'),
  totalRepositionKm:sum('repositionKm'),
  totalFuel:sum('fuelCost'),totalMaintenance:sum('maintenanceCost'),
  totalWages:sum('wageCost'),totalInsurance:sum('insuranceCost'),
  totalOther:sum('otherCost'),
  utilisation:trackedTime?roundPercent(service,duty):null,
  occupiedShare:trackedTime?roundPercent(sum('occupiedGameSeconds'),duty):null,
  paidKmShare:tracking?roundPercent(totalPassengerKm,totalPassengerKm+totalEmptyKm):null,
  hasDistanceMetrics:tracking,hasTimeMetrics:trackedTime,hasCostDetails:trackedCost,
 };
}
