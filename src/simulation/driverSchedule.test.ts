import {describe,it,expect} from 'vitest';
import type {DriverRecord,Taxi} from './taxi';
import {driverSchedule,canAcceptPassengerJob} from './driverSchedule';

const driver:DriverRecord={id:'driver-1',name:'Example Driver',hiredAt:1};
const taxi:Taxi={id:'taxi-1',name:'Taxi 1',driver:'Example Driver',
 position:[23.9,37.9],status:'IDLE',path:[],edgeIds:[],
 leg:0,distanceIntoLeg:0,fare:0,completed:0};
const at=(hour:number)=>Date.UTC(2026,10,10,0,0,0)+hour*3600000;

describe('automatic taxi shift enforcement',()=>{
 it('rejects new jobs before a shift and after the 12-hour duty period',()=>{
  const start=driverSchedule(taxi,[driver],at(0)).start;
  expect(canAcceptPassengerJob(taxi,[driver],at(start-0.01+24))).toBe(false);
  expect(canAcceptPassengerJob(taxi,[driver],at(start+12))).toBe(false);
  expect(canAcceptPassengerJob(taxi,[driver],at(start+23.9))).toBe(false);
 });
 it('accepts new jobs during shift and rejects the 30-minute scheduled break',()=>{
  const start=driverSchedule(taxi,[driver],at(0)).start;
  expect(canAcceptPassengerJob(taxi,[driver],at(start))).toBe(true);
  expect(canAcceptPassengerJob(taxi,[driver],at(start+5.74))).toBe(true);
  expect(canAcceptPassengerJob(taxi,[driver],at(start+5.75))).toBe(false);
  expect(canAcceptPassengerJob(taxi,[driver],at(start+6.24))).toBe(false);
  expect(canAcceptPassengerJob(taxi,[driver],at(start+6.25))).toBe(true);
 });
 it('handles shifts crossing midnight using game time rather than wall time',()=>{
  // Force preference slot for Night: third index in hire order (0 based).
  const roster:DriverRecord[]=Array.from({length:4},(_,i)=>({
   id:'driver-'+i,name:'Driver '+i,hiredAt:i
  }));
  const nightTaxi={...taxi,driver:'Driver 3'};
  const start=driverSchedule(nightTaxi,roster,at(0)).start;
  expect(start).toBe(0);
  expect(canAcceptPassengerJob(nightTaxi,roster,at(1))).toBe(true);
  expect(canAcceptPassengerJob(nightTaxi,roster,at(13))).toBe(false);
  expect(canAcceptPassengerJob(nightTaxi,roster,at(25))).toBe(true);
 });
});
