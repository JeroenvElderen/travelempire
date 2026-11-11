import {describe,expect,it} from 'vitest';
import {isObsoleteExplorerReturn} from './savedReturnJourney';
import type {Taxi} from './taxi';

const vehicle=(overrides:Partial<Taxi>={}):Taxi=>({
 id:'explorer-1',kind:'explorer',explorerRole:'highway',name:'Highway Explorer',
 driver:'Autonomous',position:[23.9,37.9],status:'RETURNING',
 path:[[23.9,37.9],[23.901,37.9]],edgeIds:['road-1'],
 leg:0,distanceIntoLeg:20,pauseAtHome:true,fare:0,completed:0,...overrides
});
describe('saved explorer return journeys after refresh',()=>{
 it('retains a partially driven route to a hotel',()=>{
  expect(isObsoleteExplorerReturn(vehicle({restStopId:'hotel:abc',restStopName:'Hotel'}),100)).toBe(false);
 });
 it('retains a genuine depot return even without a rest-stop ID',()=>{
  expect(isObsoleteExplorerReturn(vehicle(),100)).toBe(false);
 });
 it('retains routes for fuel and service',()=>{
  expect(isObsoleteExplorerReturn(vehicle({refillDestination:[23.91,37.9]}),100)).toBe(false);
  expect(isObsoleteExplorerReturn(vehicle({serviceDestination:[23.91,37.9]}),100)).toBe(false);
 });
 it('repairs only orphaned old RETURNING states with no route or purpose',()=>{
  expect(isObsoleteExplorerReturn(vehicle({path:[],edgeIds:[],leg:0}),100)).toBe(true);
  expect(isObsoleteExplorerReturn(vehicle({path:[],edgeIds:[],restStopId:'hotel:test'}),100)).toBe(false);
 });
 it('never alters regular passenger taxi return trips',()=>{
  expect(isObsoleteExplorerReturn(vehicle({kind:'taxi'}),100)).toBe(false);
 });
});
