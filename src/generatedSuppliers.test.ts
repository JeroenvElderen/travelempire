import {describe,it,expect} from 'vitest';
import {generateSuppliers,reserveSupplier,supplierStock,type GeneratedSupplier} from './generatedSuppliers';
import {emptyCollector,addCollector,tickCollectorFleet,collectorVehicles,collectorTripCost,collectorExpenseTotal,collectorStorageCapacity,collectorStorageUsage,openCollectorWarehouse} from './resourceCollectors';
import type {Point,RoadGraph} from './simulation/taxi';
const a:Point=[23.7,38],b:Point=[23.71,38],c:Point=[23.72,38];
const graph:RoadGraph={nodes:new Map([['a',a],['b',b],['c',c]]),nodeKeys:['a','b','c'],edges:new Map([['a',[{to:'b',meters:876,id:'ab',speedKph:40}]],['b',[{to:'a',meters:876,id:'ba',speedKph:40}]],['c',[{to:'b',meters:876,id:'cb',speedKph:40,taxiOnly:true}]]])};
const discovered=new Set(['ab','ba','cb']);
const supplier:GeneratedSupplier={id:'supply:test',name:'Small Mechanical supply',position:b,node:'b',part:'mechanical',capacity:50,stock:15,updatedAt:0,size:'Small'};
describe('procedural supplier network',()=>{
 it('generates only discovered non-restricted locations and preserves them on reload',()=>{
  const initial=generateSuppliers({},graph,discovered,graph.nodeKeys,'company',0);
  expect(Object.values(initial).map(s=>s.node)).toEqual(['a','b']);
  expect(generateSuppliers(initial,graph,discovered,graph.nodeKeys,'company',999)).toBe(initial);
  expect(generateSuppliers({},graph,discovered,graph.nodeKeys,'company',0)).toEqual(initial);
  expect(generateSuppliers({},graph,new Set(),graph.nodeKeys,'company',0)).toEqual({});
 });
 it('reserves finite stock and replenishes only whole game hours',()=>{
  const first=reserveSupplier(supplier,0,12);
  const second=reserveSupplier(first.supplier,0,12);
  expect(first.quantity).toBe(12);expect(second.quantity).toBe(3);
  expect(supplierStock(second.supplier,3599999)).toBe(0);
  expect(supplierStock(second.supplier,3600000)).toBe(4);
  expect(supplierStock(second.supplier,100*3600000)).toBe(50);
 });
 it('does not duplicate cargo across simultaneous departures or use infinite fallbacks',()=>{
  const state=addCollector({...emptyCollector(),suppliers:{[supplier.id]:supplier}},'light','second',{collectorBasics:1});
  const next=tickCollectorFleet(state,0,graph,discovered,a,{});
  expect(collectorVehicles(next).map(v=>v.trip?.quantity)).toEqual([12,3]);
  expect(next.suppliers?.[supplier.id].stock).toBe(0);
  const completed=tickCollectorFleet(next,1000000,graph,discovered,a,{});
  expect(completed.stock.mechanical).toBe(15);
  const exhausted=tickCollectorFleet(completed,1000000,graph,discovered,a,{});
  expect(collectorVehicles(exhausted).every(v=>!v.trip)).toBe(true);
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
  const state=addCollector({...ready,stock:{mechanical:145}},'light','second',{collectorBasics:1});
  const next=tickCollectorFleet(state,0,graph,discovered,a,{},[],[],{cash:100});
  expect(collectorStorageUsage(next)).toEqual({stored:145,reserved:5});
  expect(next.suppliers?.[supplier.id].stock).toBe(10);
  expect(collectorVehicles(next)[0].trip?.quantity).toBe(5);
  expect(collectorVehicles(next)[1].trip).toBeUndefined();
  const completed=tickCollectorFleet(next,1000000,graph,discovered,a,{},[],[],{cash:100});
  expect(completed.stock.mechanical).toBe(150);
  expect(completed.expenses).toEqual(next.expenses);
 });
 it('serves a due collector once and grows capacity through warehouses',()=>{
  const state={...ready,vehicles:collectorVehicles(ready).map(v=>({...v,distanceKm:5000}))};
  const service=tickCollectorFleet(state,0,graph,discovered,a,{},[],[],{cash:1000});
  expect(service.expenses?.serviceCents).toBe(18000);
  expect(collectorVehicles(service)[0].serviceUntil).toBe(3600000);
  expect(tickCollectorFleet(service,1000,graph,discovered,a,{},[],[],{cash:1000})).toBe(service);
  expect(collectorStorageCapacity(state,{})).toBe(1200);
  const expanded=openCollectorWarehouse(state,'regional',{collectorRegional:1},[{id:'regional',name:'Regional',lng:a[0],lat:a[1]}]);
  expect(collectorStorageCapacity(expanded,{})).toBe(3200);
  expect(collectorStorageCapacity(expanded,{depotEfficiency:5})).toBe(4800);
 });
});
