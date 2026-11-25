import {describe,it,expect} from 'vitest';
import {passengerRouteIssue,passengerRouteAdvanced,watchPassengerProgress} from './passengerRouteRecovery';
import type {Taxi} from './taxi';

const moving=():Taxi=>({
 id:'t1',name:'Taxi 1',driver:'Driver',position:[23.73,37.98],
 status:'TO_PICKUP',path:[[23.73,37.98],[23.731,37.98]],
 edgeIds:['osm-123-0'],leg:0,distanceIntoLeg:0,fare:20,completed:0
});

describe('passenger route recovery guards',()=>{
 it('accepts a directed trip with a consistent edge itinerary',()=>{
  expect(passengerRouteIssue(moving())).toBeNull();
 });
 it('detects missing or corrupted passenger itineraries without changing the job',()=>{
  expect(passengerRouteIssue({...moving(),path:[],edgeIds:[]})).toBe('missing-path');
  expect(passengerRouteIssue({...moving(),edgeIds:[]})).toBe('edge-count-mismatch');
  expect(passengerRouteIssue({...moving(),leg:5})).toBe('invalid-leg');
 });
 it('does not interfere with explorers and parked taxis',()=>{
  expect(passengerRouteIssue({...moving(),status:'PAUSED'})).toBeNull();
 });
 it('recognises real leg progress even without significant lat/lon changes',()=>{
  expect(passengerRouteAdvanced({leg:0,distanceIntoLeg:0},{leg:0,distanceIntoLeg:2})).toBe(true);
  expect(passengerRouteAdvanced({leg:0,distanceIntoLeg:30},{leg:1,distanceIntoLeg:0})).toBe(true);
  expect(passengerRouteAdvanced({leg:0,distanceIntoLeg:30},{leg:0,distanceIntoLeg:30})).toBe(false);
 });
});


describe('cumulative passenger movement watchdog',()=>{
 it('counts slow continuous movement across frames',()=>{
  const t=moving();let watch=watchPassengerProgress(undefined,t,1000);
  for(let i=1;i<=12;i++){
   const now=1000+i*1000;
   watch=watchPassengerProgress(watch,{...t,distanceIntoLeg:i*.1},now);
   expect(now-watch.lastProgressAt).toBeLessThanOrEqual(3000);
  }
 });
 it('preserves a genuine stall but resets after suspension or itinerary replacement',()=>{
  const t=moving();let watch=watchPassengerProgress(undefined,t,1000);
  for(const now of [6000,11000,16000])watch=watchPassengerProgress(watch,t,now);
  expect(16000-watch.lastProgressAt).toBe(15000);
  expect(watchPassengerProgress(watch,t,60000).lastProgressAt).toBe(60000);
  expect(watchPassengerProgress(watch,{...t,edgeIds:['replacement']},17000).lastProgressAt).toBe(17000);
 });
});
