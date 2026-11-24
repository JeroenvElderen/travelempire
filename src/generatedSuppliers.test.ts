import {describe,it,expect} from 'vitest';
import {generateSuppliers,reserveSupplier,supplierStock,type GeneratedSupplier} from './generatedSuppliers';
import {emptyCollector,addCollector,tickCollectorFleet,collectorVehicles} from './resourceCollectors';
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
