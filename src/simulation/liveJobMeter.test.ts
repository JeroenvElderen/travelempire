import {describe,expect,it} from 'vitest';
import type {Taxi} from './taxi';
import {liveJobMeter} from './liveJobMeter';

const vehicle=(overrides:Partial<Taxi>={}):Taxi=>({
 id:'taxi-1',kind:'taxi',name:'Taxi 1',driver:'Driver',
 position:[23.9,37.9],status:'TO_DROPOFF',
 path:[[23.9,37.9],[23.902,37.9]],edgeIds:['route-1'],
 leg:0,distanceIntoLeg:50,
 pickup:[23.9,37.9],dropoff:[23.902,37.9],
 fare:8,jobFareTotal:10,jobDistanceMeters:200,
 jobDrivenMeters:50,completed:0,...overrides
});
describe('live passenger job meter',()=>{
 it('displays fare accumulated from actual passenger distance',()=>{
  const result=liveJobMeter(vehicle());
  expect(result?.phase).toBe('passenger');
  expect(result?.earnedSoFar).toBe(2.5);
  expect(result?.expectedFare).toBe(10);
  expect(result?.drivenKm).toBeCloseTo(.05);
  expect(result?.totalKm).toBeCloseTo(.2);
  expect(result?.progress).toBeCloseTo(.25);
 });
 it('does not charge passenger fare during pickup travel',()=>{
  const result=liveJobMeter(vehicle({
   status:'TO_PICKUP',jobDrivenMeters:undefined,
   jobDistanceMeters:undefined,jobFareTotal:undefined,
   distanceIntoLeg:40
  }));
  expect(result?.phase).toBe('pickup');
  expect(result?.earnedSoFar).toBe(0);
  expect(result?.drivenKm).toBeGreaterThan(0);
  expect(result?.expectedFare).toBe(8);
 });
 it('never displays a 100% collected fare before the confirmed drop-off',()=>{
  const result=liveJobMeter(vehicle({jobDrivenMeters:300,distanceIntoLeg:175}));
  expect(result?.earnedSoFar).toBeLessThan(10);
  expect(result?.progress).toBeLessThan(1);
  expect(result?.drivenKm).toBeCloseTo(.3);
 });
 it('extends the remaining trip distance when its old quote underestimates the route',()=>{
  const result=liveJobMeter(vehicle({
   jobDistanceMeters:100,jobDrivenMeters:100,distanceIntoLeg:20
  }));
  expect(result?.totalKm).toBeGreaterThan(.1);
  expect(result?.progress).toBeLessThan(1);
 });
 it('hides the meter for explorers, idle taxis, and completed jobs',()=>{
  expect(liveJobMeter(vehicle({kind:'explorer',status:'EXPLORING'}))).toBeNull();
  expect(liveJobMeter(vehicle({status:'IDLE'}))).toBeNull();
  expect(liveJobMeter(vehicle({status:'RETURNING'}))).toBeNull();
 });
 it('calculates remaining distance for older saved taxi jobs',()=>{
  const result=liveJobMeter(vehicle({
   jobDistanceMeters:undefined,jobDrivenMeters:undefined,
   leg:0,distanceIntoLeg:60,jobFareTotal:undefined
  }));
  expect(result?.totalKm).toBeGreaterThan(.15);
  expect(result?.drivenKm).toBeCloseTo(.06);
  expect(result?.earnedSoFar).toBeGreaterThan(0);
 });
});
