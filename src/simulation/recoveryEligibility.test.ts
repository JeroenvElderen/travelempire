import {describe,it,expect} from 'vitest';
import {shouldAutomaticallyRecover} from './recoveryEligibility';
import type {Taxi} from './taxi';

const taxi=(overrides:Partial<Taxi>={}):Taxi=>({
 id:'taxi-1',kind:'taxi',name:'Taxi 1',driver:'Driver',
 position:[23.9,37.9],status:'RETURNING',
 path:[[23.9,37.9],[23.901,37.9]],edgeIds:['road-1'],
 leg:0,distanceIntoLeg:0,energyRemaining:35,
 fare:0,completed:0,...overrides
});
describe('automatic heavy recovery eligibility',()=>{
 it('never tows a taxi still driving to an assigned hotel',()=>{
  expect(shouldAutomaticallyRecover(taxi({
   scheduledShiftParked:true,shiftParked:true,restStopId:'hotel:one'
  }),300000)).toBe(false);
 });
 it('never tows a taxi driving to a parking lot or depot just for delayed movement',()=>{
  expect(shouldAutomaticallyRecover(taxi({restStopId:'parking:one'}),300000)).toBe(false);
  expect(shouldAutomaticallyRecover(taxi({shiftParked:true}),300000)).toBe(false);
 });
 it('never tows a healthy taxi with a valid active route',()=>{
  expect(shouldAutomaticallyRecover(taxi(),300000)).toBe(false);
 });
 it('does not mistake a 30 second worker delay for a breakdown',()=>{
  expect(shouldAutomaticallyRecover(taxi({edgeIds:[],path:[]}),30000)).toBe(false);
  expect(shouldAutomaticallyRecover(taxi({edgeIds:[],path:[]}),120000)).toBe(true);
 });
 it('does allow recovery after actual fuel depletion',()=>{
  expect(shouldAutomaticallyRecover(taxi({energyRemaining:0}),0)).toBe(true);
 });
 it('never automatically tows parked taxis or active servicing stops',()=>{
  expect(shouldAutomaticallyRecover(taxi({status:'PAUSED',energyRemaining:0}),300000)).toBe(false);
  expect(shouldAutomaticallyRecover(taxi({status:'SERVICING'}),300000)).toBe(false);
 });
});
