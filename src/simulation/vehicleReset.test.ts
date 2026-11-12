import {describe,expect,it} from 'vitest';
import type {Taxi} from './taxi';
import {resetVehicleAtDepot} from './vehicleReset';

const taxi=(overrides:Partial<Taxi>={}):Taxi=>({
 id:'taxi-7',kind:'taxi',name:'Audi Q7',driver:'Nikos',
 status:'RETURNING',position:[23.9,37.9],
 path:[[23.9,37.9],[23.91,37.9]],edgeIds:['parking-road'],
 leg:0,distanceIntoLeg:24,speedKph:0,
 fare:18,pickup:[23.9,37.9],dropoff:[23.91,37.9],
 pauseAtHome:true,shiftParked:true,scheduledShiftParked:true,
 restStopId:'parking:one',restStopName:'Parking',restStopPosition:[23.91,37.9],
 scheduledBreakPending:true,refillRequested:true,serviceDestination:[23.91,37.9],
 recoveryPending:false,completed:5,...overrides
});
describe('reset vehicle to depot',()=>{
 it('resets a taxi stuck returning to parking without changing its driver or history',()=>{
  const destination:[number,number]=[23.901,37.9];
  const result=resetVehicleAtDepot(taxi(),destination);
  expect(result.kind).toBe('taxi');
  expect(result.driver).toBe('Nikos');
  expect(result.completed).toBe(5);
  expect(result.position).toEqual(destination);
  expect(result.status).toBe('IDLE');
  expect(result.path).toEqual([]);
  expect(result.edgeIds).toEqual([]);
  expect(result.speedKph).toBe(0);
  expect(result.restStopId).toBeUndefined();
  expect(result.restStopPosition).toBeUndefined();
  expect(result.scheduledShiftParked).toBe(false);
  expect(result.scheduledBreakPending).toBe(false);
  expect(result.refillRequested).toBe(false);
  expect(result.serviceDestination).toBeUndefined();
 });
 it('cancels an active passenger journey without awarding its unfinished fare',()=>{
  const result=resetVehicleAtDepot(taxi({status:'TO_DROPOFF',fare:120,activeJobId:'job-1',jobSurgeMultiplier:1.25}),[23.901,37.9]);
  expect(result.fare).toBe(0);
  expect(result.pickup).toBeUndefined();
  expect(result.dropoff).toBeUndefined();
  expect(result.activeJobId).toBeUndefined();
  expect(result.jobSurgeMultiplier).toBeUndefined();
  expect(result.completed).toBe(5);
 });
 it('also preserves explorer identity while clearing a stale discovery route',()=>{
  const result=resetVehicleAtDepot(taxi({
   kind:'explorer',explorerRole:'highway',status:'EXPLORING',
   discoveryEdgeIds:['highway-1'],escapeTransitEdgeIds:['ring-1']
  }),[23.901,37.9]);
  expect(result.kind).toBe('explorer');
  expect(result.explorerRole).toBe('highway');
  expect(result.discoveryEdgeIds).toEqual([]);
  expect(result.escapeTransitEdgeIds).toEqual([]);
  expect(result.status).toBe('IDLE');
 });
});
