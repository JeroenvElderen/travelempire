import {describe,it,expect} from 'vitest';
import {openCollectorWarehouse,collectorWarehouses,addCollector,collectorVehicles,collectorLimit,collectorPurchaseLock,collectorCapacity,configureCollector,tickCollectorFleet,collectorPosition,collectorMotion,collectorRequirement,emptyCollector,tickCollector,type CollectorTrip} from './resourceCollectors';
import type {RoadGraph,Point} from './simulation/taxi';
const a:Point=[23.7,38],b:Point=[23.71,38];
const graph:RoadGraph={nodes:new Map([['a',a],['b',b]]),nodeKeys:['a','b'],edges:new Map([
 ['a',[{to:'b',meters:876,id:'ab',speedKph:40}]],
 ['b',[{to:'a',meters:876,id:'ba',speedKph:40}]]
])};
describe('resource collector',()=>{
 it('does not use undiscovered or one-way stranded routes',()=>{
  const empty=emptyCollector();
  expect(tickCollector(empty,0,graph,new Set(['ab']),a)).toBe(empty);
  expect(tickCollector(empty,0,graph,new Set(),a)).toBe(empty);
 });
 it('credits delivered cargo exactly once on return',()=>{
  const trip:CollectorTrip={path:[a,b,a],outboundMetres:876,distance:1752,startedAt:0,endsAt:1000,part:'mechanical',quantity:12};
  const active={...emptyCollector(),trip};
  expect(tickCollector(active,999,null,new Set(),a)).toBe(active);
  const delivered=tickCollector(active,1000,null,new Set(),a);
  expect(delivered.stock.mechanical).toBe(12);
  expect(delivered.trips).toBe(1);
  expect(tickCollector(delivered,1000,null,new Set(),a)).toBe(delivered);
  expect(collectorPosition(trip,0)).toEqual(a);
  expect(collectorPosition(trip,1000)).toEqual(a);
 });
 it('assigns distinct component requirements to divisions',()=>{
  expect(collectorRequirement(1,2)).toEqual({part:'mechanical',quantity:4});
  expect(collectorRequirement(8,1).part).toBe('marine');
 });
});

describe('collector fleet expansion',()=>{
 it('preserves the starter trip and expands only through unlocked technology',()=>{
  const state=emptyCollector();
  expect(collectorVehicles(state)).toHaveLength(1);
  expect(collectorPurchaseLock(state,'medium',{})).not.toBeNull();
  const expanded=addCollector(state,'medium','van-2',{collectorBasics:1,collectorMedium:1});
  expect(collectorVehicles(expanded)).toHaveLength(2);
  expect(collectorCapacity('medium',{collectorCargo:1})).toBe(37);
  expect(collectorLimit({collectorRegional:1})).toBe(12);
  expect(configureCollector(expanded,'van-2',{priority:'marine'},{})).toBe(expanded);
  const configured=configureCollector(expanded,'van-2',{priority:'marine'},{collectorPriority:1});
  expect(collectorVehicles(configured)[1].priority).toBe('marine');
 });
 it('credits simultaneous deliveries exactly once to the shared stock',()=>{
  const trip:CollectorTrip={path:[a,b,a],outboundMetres:876,distance:1752,startedAt:0,endsAt:1000,part:'mechanical',quantity:12};
  const initial=addCollector({...emptyCollector(),trip},'light','second',{collectorBasics:1});
  const vehicles=collectorVehicles(initial).map(v=>({...v,trip}));
  const complete=tickCollectorFleet({...initial,vehicles},1000,null,new Set(),a,{});
  expect(complete.stock.mechanical).toBe(24);
  expect(complete.trips).toBe(2);
  expect(tickCollectorFleet(complete,1000,null,new Set(),a,{})).toBe(complete);
 });
});

describe('mapped suppliers and regional warehouses',()=>{
 const supplier={id:'workshop:1',name:'Mapped workshop',position:b,parts:['mechanical'] as const,source:'station' as const};
 const depots=[{id:'regional',name:'Regional depot',lng:a[0],lat:a[1]}];
 it('uses a mapped supplier only when a discovered round trip exists',()=>{
  const options={priority:'mechanical' as const,suppliers:[supplier]};
  expect(tickCollector(emptyCollector(),0,graph,new Set(['ab']),a,options).trip).toBeUndefined();
  const result=tickCollector(emptyCollector(),0,graph,new Set(['ab','ba']),a,options);
  expect(result.trip?.supplierId).toBe(supplier.id);
  expect(result.trip?.supplierName).toBe(supplier.name);
 });
 it('gates warehouses and only permits parked collectors to redeploy',()=>{
  const initial=emptyCollector();
  expect(()=>openCollectorWarehouse(initial,'regional',{},depots)).toThrow();
  const levels={collectorRegional:1};
  const opened=openCollectorWarehouse(initial,'regional',levels,depots);
  expect(collectorWarehouses(opened,depots,a)).toHaveLength(2);
  expect(()=>openCollectorWarehouse(opened,'regional',levels,depots)).toThrow();
  expect(configureCollector(opened,'starter-collector',{warehouseId:'regional'},levels)).toBe(opened);
  const paused=configureCollector(opened,'starter-collector',{paused:true},levels);
  const moved=configureCollector(paused,'starter-collector',{warehouseId:'regional'},levels);
  expect(collectorVehicles(moved)[0].warehouseId).toBe('regional');
 });
 it('records warehouse deliveries without duplicating shared inventory',()=>{
  const opened=openCollectorWarehouse(emptyCollector(),'regional',{collectorRegional:1},depots);
  const trip:CollectorTrip={path:[a,b,a],outboundMetres:876,distance:1752,startedAt:0,endsAt:1000,part:'mechanical',quantity:12,warehouseId:'regional'};
  const state={...opened,vehicles:collectorVehicles(opened).map(v=>({...v,warehouseId:'regional',trip}))};
  const complete=tickCollectorFleet(state,1000,null,new Set(),a,{},[],depots);
  expect(complete.stock.mechanical).toBe(12);
  expect(collectorWarehouses(complete,depots,a)[1].delivered.mechanical).toBe(12);
  expect(collectorWarehouses(complete,depots,a)[0].trips).toBe(0);
  expect(tickCollectorFleet(complete,1000,null,new Set(),a,{},[],depots)).toBe(complete);
 });
});

describe('collector real-time road movement',()=>{
 it('matches posted speeds, stops for loading and faces the return road',()=>{
  const trip=tickCollector(emptyCollector(),0,graph,new Set(['ab','ba']),a,{loadingMs:90000}).trip!;
  expect(trip.legMs).toHaveLength(2);
  const outbound=trip.legMs![0];
  const halfway=collectorMotion(trip,outbound/2);
  expect(halfway.speedKph).toBeCloseTo(40,5);
  expect(halfway.position[0]).toBeCloseTo((a[0]+b[0])/2,7);
  expect(outbound/24/1000).toBeGreaterThan(70);
  expect(collectorMotion(trip,outbound+45000).position).toEqual(b);
  expect(collectorMotion(trip,outbound+45000).speedKph).toBe(0);
  expect(collectorMotion(trip,outbound+90001).heading).toBeCloseTo(-90,1);
  expect(collectorMotion(trip,trip.endsAt).position).toEqual(a);
 });
});
