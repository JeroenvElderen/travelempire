import {describe,expect,it} from 'vitest';
import {settlePassengerFare} from './passengerSettlement';
import {passengerPairKey,pricedPassengerFare} from './taxi';
describe('passenger journey settlement',()=>{
 it('books a completed request once, even if the worker replays it later',()=>{
  const paid=new Set<string>();
  expect(settlePassengerFare('job-1',false,8,1.4,paid).earned).toBe(0);
  expect(paid.size).toBe(0);
  const first=settlePassengerFare('job-1',true,8,1.4,paid);
  expect(first).toEqual({earned:11.2,duplicate:false});
  expect(settlePassengerFare('job-1',true,8,1.4,paid)).toEqual({earned:0,duplicate:true});
  expect(paid.has('job-1')).toBe(true);
 });
 it('keeps distinct passenger jobs payable',()=>{
  const paid=new Set<string>();
  expect(settlePassengerFare('a',true,5,1,paid).earned).toBe(5);
  expect(settlePassengerFare('b',true,5,1,paid).earned).toBe(5);
 });
 it('caps stacked vehicle and research bonuses, especially on short journeys',()=>{
  expect(settlePassengerFare('a',true,4.4,4,new Set()).earned).toBe(7.04);
  expect(pricedPassengerFare(220,1)).toBe(4.4);
  expect(pricedPassengerFare(220,1.25)).toBe(5.5);
 });
 it('generates stable directed passenger route keys',()=>{
  expect(passengerPairKey([23.9,37.9],[23.91,37.9])).not.toBe(
   passengerPairKey([23.91,37.9],[23.9,37.9]));
 });
});
