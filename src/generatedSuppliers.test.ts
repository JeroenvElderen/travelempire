import {describe,it,expect} from 'vitest';
import {generateSuppliers,reserveSupplier,supplierStock,supplierAvailable,supplierReserved,supplierVisible,SUPPLIER_PRODUCTION_HOURS,type GeneratedSupplier} from './generatedSuppliers';
import {emptyCollector,addCollector,tickCollectorFleet,collectorVehicles,collectorMotion,collectorCargoAt,collectorTripCost,collectorExpenseTotal,collectorStorageCapacity,collectorStorageUsage,openCollectorWarehouse} from './resourceCollectors';
import type {Point,RoadGraph} from './simulation/taxi';
const a:Point=[23.7,38],b:Point=[23.71,38],c:Point=[23.72,38];
const graph:RoadGraph={nodes:new Map([['a',a],['b',b],['c',c]]),nodeKeys:['a','b','c'],edges:new Map([['a',[{to:'b',meters:876,id:'ab',speedKph:40}]],['b',[{to:'a',meters:876,id:'ba',speedKph:40}]],['c',[{to:'b',meters:876,id:'cb',speedKph:40,taxiOnly:true}]]])};
const discovered=new Set(['ab','ba','cb']);
const supplier:GeneratedSupplier={id:'supply:test',name:'Small Mechanical supply',position:b,node:'b',part:'mechanical',capacity:50,stock:15,updatedAt:0,size:'Small'};
describe('procedural supplier network',()=>{
 it('generates only discovered non-restricted locations and preserves them on reload',()=>{
  const initial=generateSuppliers({},graph,discovered,graph.nodeKeys,'company',0);
  expect(Object.values(initial).map(s=>s.node)).toEqual(['a','b']);
  expect(Object.values(initial).every(s=>s.stock===0&&!supplierVisible(s,0))).toBe(true);
  expect(generateSuppliers(initial,graph,discovered,graph.nodeKeys,'company',999)).toBe(initial);
  expect(generateSuppliers({},graph,discovered,graph.nodeKeys,'company',0)).toEqual(initial);
  expect(generateSuppliers({},graph,new Set(),graph.nodeKeys,'company',0)).toEqual({});
 });
 it('reserves finite stock and replenishes only whole game hours',()=>{
  const first=reserveSupplier(supplier,0,12);
  const second=reserveSupplier(first.supplier,0,12);
  expect(first.quantity).toBe(12);expect(second.quantity).toBe(3);
  expect(supplierStock(second.supplier,4*3600000-1)).toBe(0);
  expect(supplierStock(second.supplier,4*3600000)).toBe(2);
  expect(supplierStock(second.supplier,100*3600000)).toBe(50);
 });
 it('does not duplicate cargo across simultaneous departures or use infinite fallbacks',()=>{
  const state=addCollector({...emptyCollector(),suppliers:{[supplier.id]:supplier}},'light','second',{collectorBasics:1});
  const next=tickCollectorFleet(state,0,graph,discovered,a,{});
  expect(collectorVehicles(next).map(v=>v.trip?.quantity)).toEqual([12,3]);
  expect(supplierAvailable(next.suppliers![supplier.id],0)).toBe(0);
  expect(supplierStock(next.suppliers![supplier.id],0)).toBe(15);
  expect(supplierVisible(next.suppliers![supplier.id],0)).toBe(true);
  const third=addCollector(next,'light','third',{collectorBasics:1});
  expect(collectorVehicles(tickCollectorFleet(third,0,graph,discovered,a,{}))[2].trip).toBeUndefined();
  const finish=Math.max(...collectorVehicles(next).map(v=>v.trip!.endsAt));
  const completed=tickCollectorFleet(next,finish,graph,discovered,a,{});
  expect(completed.stock.mechanical).toBe(15);
  expect(collectorVehicles(completed).every(v=>!v.trip)).toBe(true);
 });
});

describe('collector operating economy',()=>{
 const ready={...emptyCollector(),suppliers:{[supplier.id]:supplier}};
 it('quotes fuel and maintenance by model and research',()=>{
  const cost=collectorTripCost('light',100,{});
  expect(cost.litres).toBe(7.5);
  expect(cost.expenses.fuelCents).toBe(1313);
  expect(cost.expenses.maintenanceCents).toBe(650);
  expect(collectorExpenseTotal(collectorTripCost('light',100,{engine:5,workshopResearch:5}).expenses)).toBeLessThan(collectorExpenseTotal(cost.expenses));
 });
 it('does not reserve supplies or spend money when a trip cannot be afforded',()=>{
  const next=tickCollectorFleet(ready,0,graph,discovered,a,{},[],[],{cash:0});
  expect(collectorVehicles(next)[0].trip).toBeUndefined();
  expect(collectorVehicles(next)[0].waitingReason).toBe('Insufficient operating cash');
  expect(next.suppliers?.[supplier.id].stock).toBe(15);
 });
 it('limits dispatch to remaining resource capacity, including simultaneous vehicles',()=>{
  const state=addCollector({...ready,stock:{mechanical:620}},'light','second',{collectorBasics:1});
  const next=tickCollectorFleet(state,0,graph,discovered,a,{},[],[],{cash:100});
  expect(collectorStorageUsage(next)).toEqual({stored:620,reserved:5});
  expect(supplierAvailable(next.suppliers![supplier.id],0)).toBe(10);
  expect(collectorVehicles(next)[0].trip?.quantity).toBe(5);
  expect(collectorVehicles(next)[1].trip).toBeUndefined();
  const completed=tickCollectorFleet(next,collectorVehicles(next)[0].trip!.endsAt,graph,discovered,a,{},[],[],{cash:100});
  expect(completed.stock.mechanical).toBe(625);
  expect(completed.expenses).toEqual(next.expenses);
 });
 it('serves a due collector once and grows capacity through warehouses',()=>{
  const state={...ready,vehicles:collectorVehicles(ready).map(v=>({...v,distanceKm:5000}))};
  const service=tickCollectorFleet(state,0,graph,discovered,a,{},[],[],{cash:1000});
  expect(service.expenses?.serviceCents).toBe(18000);
  expect(collectorVehicles(service)[0].serviceUntil).toBe(3600000);
  expect(tickCollectorFleet(service,1000,graph,discovered,a,{},[],[],{cash:1000})).toBe(service);
  expect(collectorStorageCapacity(state,{})).toBe(5000);
  const expanded=openCollectorWarehouse(state,'regional',{collectorRegional:1},[{id:'regional',name:'Regional',lng:a[0],lat:a[1]}]);
  expect(collectorStorageCapacity(expanded,{})).toBe(15000);
  expect(collectorStorageCapacity(expanded,{depotEfficiency:5})).toBe(22500);
 });
});

describe('rarity-based supplier production and visibility',()=>{
 const hour=3600000;
 it('starts empty and produces exactly two units per complete cycle at every size',()=>{
  for(const [part,interval] of Object.entries(SUPPLIER_PRODUCTION_HOURS)){
   for(const capacity of [50,150,1000,3000]){
    const s:GeneratedSupplier={...supplier,part:part as GeneratedSupplier['part'],capacity,stock:0,updatedAt:1000};
    expect(supplierVisible(s,1000)).toBe(false);
    expect(supplierStock(s,1000+interval*hour-1)).toBe(0);
    expect(supplierStock(s,1000+interval*hour)).toBe(2);
    expect(supplierVisible(s,1000+interval*hour)).toBe(true);
    expect(supplierStock(s,1000+interval*hour*3)).toBe(6);
    expect(supplierStock(s,1000+interval*hour*10000)).toBe(capacity);
   }
  }
 });
 it('hides a depleted supplier immediately and reappears on its next production cycle',()=>{
  const rare:GeneratedSupplier={...supplier,part:'rare',stock:0};
  const reserved=reserveSupplier(rare,32*hour+1000,12);
  expect(reserved.quantity).toBe(2);
  expect(reserved.supplier.updatedAt).toBe(32*hour);
  expect(supplierVisible(reserved.supplier,32*hour+1000)).toBe(false);
  expect(supplierVisible(reserved.supplier,64*hour-1)).toBe(false);
  expect(supplierVisible(reserved.supplier,64*hour)).toBe(true);
 });
 it('preserves existing stock and does not bank surplus production beyond capacity',()=>{
  const s:GeneratedSupplier={...supplier,stock:49,capacity:50};
  const reservation=reserveSupplier(s,100*hour,50);
  expect(reservation.quantity).toBe(50);
  expect(supplierStock(reservation.supplier,100*hour)).toBe(0);
  expect(supplierStock(reservation.supplier,104*hour)).toBe(2);
 });
});

describe('multi-stop collectors and deferred supplier pickups',()=>{
 const network:RoadGraph={nodes:new Map([['a',a],['b',b],['c',c]]),nodeKeys:['a','b','c'],edges:new Map([
  ['a',[{to:'b',meters:876,id:'ab',speedKph:40}]],
  ['b',[{to:'a',meters:876,id:'ba',speedKph:40},{to:'c',meters:876,id:'bc',speedKph:60}]],
  ['c',[{to:'b',meters:876,id:'cb',speedKph:60}]]
 ])};
 const roads=new Set(['ab','ba','bc','cb']);
 const small={...supplier,stock:4};
 const extra:GeneratedSupplier={...supplier,id:'second-supplier',name:'Electronics',position:c,node:'c',part:'electronics',stock:10};
 const initial=()=>({...emptyCollector(),suppliers:{[small.id]:small,[extra.id]:extra}});
 it('fills the truck across suppliers and unloads mixed cargo only at the warehouse',()=>{
  const next=tickCollectorFleet(initial(),0,network,roads,a,{},[],[],{cash:100});
  const trip=collectorVehicles(next)[0].trip!;
  expect(trip.quantity).toBe(12);
  expect(trip.cargo).toEqual({mechanical:4,electronics:8});
  expect(trip.stops?.map(s=>s.supplierId)).toEqual([small.id,extra.id]);
  const reserved=next.suppliers![small.id];
  expect(supplierStock(reserved,0)).toBe(4);
  expect(supplierReserved(reserved,0)).toBe(4);
  expect(supplierAvailable(reserved,0)).toBe(0);
  expect(supplierVisible(reserved,trip.stops![0].leavesAt-1)).toBe(true);
  expect(supplierVisible(reserved,trip.stops![0].leavesAt)).toBe(false);
  expect(supplierAvailable(next.suppliers![extra.id],0)).toBe(2);
  expect(collectorStorageUsage(next)).toEqual({stored:0,reserved:12});
  expect(collectorCargoAt(trip,trip.stops![0].arrivesAt)).toEqual({});
  expect(collectorMotion(trip,trip.stops![0].arrivesAt+1000).position).toEqual(b);
  expect(collectorCargoAt(trip,trip.stops![0].leavesAt)).toEqual({mechanical:4});
  expect(collectorMotion(trip,trip.stops![1].arrivesAt+1000).position).toEqual(c);
  expect(collectorCargoAt(trip,trip.stops![1].leavesAt)).toEqual(trip.cargo);
  const finished=tickCollectorFleet(next,trip.endsAt,network,roads,a,{},[],[],{cash:100});
  expect(finished.stock).toEqual(trip.cargo);
  expect(finished.delivered).toEqual(trip.cargo);
  expect(finished.warehouses?.[0].delivered).toEqual(trip.cargo);
  expect(finished.trips).toBe(1);
 });
 it('does not mix types when a collector has a specific resource priority',()=>{
  const state={...initial(),vehicles:[{...collectorVehicles(initial())[0],priority:'mechanical' as const}]};
  const trip=collectorVehicles(tickCollectorFleet(state,0,network,roads,a,{}))[0].trip!;
  expect(trip.quantity).toBe(4);
  expect(trip.stops).toHaveLength(1);
 });
 it('preserves production during reservations and prevents duplicate reservations',()=>{
  const empty={...supplier,stock:4};
  const booking=reserveSupplier(empty,0,4,8*3600000);
  expect(supplierStock(booking.supplier,0)).toBe(4);
  expect(reserveSupplier(booking.supplier,0,4,4*3600000).quantity).toBe(0);
  expect(supplierStock(booking.supplier,4*3600000)).toBe(6);
  expect(supplierAvailable(booking.supplier,4*3600000)).toBe(2);
  expect(supplierStock(booking.supplier,8*3600000)).toBe(4);
  expect(supplierReserved(booking.supplier,8*3600000)).toBe(0);
 });
});
