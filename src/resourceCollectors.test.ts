import {describe,it,expect} from 'vitest';
import {addCollector,collectorVehicles,collectorLimit,collectorPurchaseLock,collectorCapacity,configureCollector,tickCollectorFleet,collectorPosition,collectorRequirement,emptyCollector,tickCollector,type CollectorTrip} from './resourceCollectors';
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
