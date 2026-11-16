import {describe,expect,it} from 'vitest';
import type {DriverRecord,Taxi} from './taxi';
import {canAcceptPassengerJob,driverSchedule,updateDriverShift} from './driverSchedule';
import {automaticallyStaffIdleTaxis,taxiAvailableForDriverHandover,
 DRIVER_HANDOVER_COOLDOWN_GAME_MS} from './driverFleetAutomation';

const at=(hour:number)=>Date.UTC(2026,10,10)+hour*3600000;
const driver=(id:string,name:string,start:number,duration=8,
 homeDepotId='main'):DriverRecord=>({
 id,name,hiredAt:Number(id.replace(/[^0-9]/g,''))||1,
 shiftStartHour:start,shiftDurationHours:duration,homeDepotId,
});
const taxi=(name='Old',overrides:Partial<Taxi>={}):Taxi=>({
 id:name.toLowerCase().replaceAll(' ','-'),name:'Taxi '+name,
 driver:name,kind:'taxi',depotId:'main',
 position:[23,38],status:'IDLE',path:[],edgeIds:[],leg:0,
 distanceIntoLeg:0,fare:0,completed:0,...overrides,
});
const depots=[{id:'main',position:[23,38] as [number,number]},
 {id:'second',position:[23.5,38.5] as [number,number]}];

describe('Taxi Autopilot Phase 3 — custom driver schedules',()=>{
 it('retains all previous 12-hour automatic shifts and half-hour break defaults',()=>{
  const old:DriverRecord={id:'1',name:'Old',hiredAt:0};
  const schedule=driverSchedule(taxi(),[old],at(0));
  expect(schedule.duration).toBe(12);
  expect(schedule.breakStart).toBe(5.75);
  expect(schedule.breakEnd).toBe(6.25);
  expect(schedule.automatic).toBe(true);
  expect(schedule.preference).toBe('Morning');
 });
 it('supports a custom 8-hour shift crossing midnight without altering game time',()=>{
  const d=driver('1','Old',22,8);
  const roster=[d];
  expect(driverSchedule(taxi(),roster,at(23)).onDuty).toBe(true);
  expect(driverSchedule(taxi(),roster,at(26)).onDuty).toBe(true);
  expect(canAcceptPassengerJob(taxi(),roster,at(26))).toBe(false);
  // The default 8-hour break starts at elapsed 4 hours (02:00).
  expect(driverSchedule(taxi(),roster,at(26)).onBreak).toBe(true);
  expect(driverSchedule(taxi(),roster,at(26.5)).onBreak).toBe(false);
  expect(canAcceptPassengerJob(taxi(),roster,at(29))).toBe(true);
  expect(driverSchedule(taxi(),roster,at(30)).onDuty).toBe(false);
 });
 it('supports a manually timed 30-minute break for a ten-hour shift',()=>{
  const d={...driver('1','Old',8,10),shiftBreakAtHour:3};
  const schedule=driverSchedule(taxi(),[d],at(11));
  expect(schedule.breakStart).toBe(3);
  expect(schedule.breakEnd).toBe(3.5);
  expect(canAcceptPassengerJob(taxi(),[d],at(10.99))).toBe(true);
  expect(canAcceptPassengerJob(taxi(),[d],at(11.25))).toBe(false);
  expect(canAcceptPassengerJob(taxi(),[d],at(11.5))).toBe(true);
  expect(canAcceptPassengerJob(taxi(),[d],at(18))).toBe(false);
 });
 it('resets invalid saved roster options rather than creating 24h duty',()=>{
  const old=driver('1','Old',6,12);
  const bad=updateDriverShift(old,{
   shiftStartHour:99,shiftDurationHours:-3,shiftBreakAtHour:99,
  });
  expect(bad.shiftStartHour).toBeUndefined();
  expect(bad.shiftDurationHours).toBeUndefined();
  expect(bad.shiftBreakAtHour).toBeUndefined();
  expect(driverSchedule(taxi(),[bad],at(6)).duration).toBe(12);
 });
 it('drops an invalid custom break when shortening shift length',()=>{
  const d={...driver('1','Old',12,12),shiftBreakAtHour:9};
  const updated=updateDriverShift(d,{shiftDurationHours:6});
  expect(updated.shiftBreakAtHour).toBeUndefined();
  expect(driverSchedule(taxi(),[updated],at(15)).onBreak).toBe(true);
 });
 it('automatically staggered shifts stay stable for legacy drivers',()=>{
  const roster=Array.from({length:4},(_,i)=>({
   id:String(i),name:'Driver '+i,hiredAt:i,
  }));
  const starts=roster.map(d=>driverSchedule(taxi(d.name),roster,at(0)).start);
  expect(starts).toEqual([6,12,18,0]);
 });
});

describe('Taxi Autopilot Phase 3 — safe automatic driver staffing',()=>{
 const old=driver('1','Old',0,8);
 const spare=driver('2','Spare',12,8);
 const fleet=[taxi()];
 it('defaults disabled, leaving existing companies and drivers unchanged',()=>{
  const assigned=automaticallyStaffIdleTaxis(fleet,[old,spare],depots,at(14),false);
  expect(assigned).toEqual(fleet);
 });
 it('hands over an idle depot taxi to an unassigned on-duty driver',()=>{
  const updated=automaticallyStaffIdleTaxis(fleet,[old,spare],depots,at(14),true);
  expect(updated[0].driver).toBe('Spare');
  expect(updated[0].position).toEqual(fleet[0].position);
  expect(updated[0].status).toBe('IDLE');
  expect(updated[0].path).toEqual([]);
  expect(updated[0].lastDriverHandoverGameMs).toBe(at(14));
  expect(canAcceptPassengerJob(updated[0],[old,spare],at(14))).toBe(true);
 });
 it('never switches an on-duty driver or one taking their 30-minute break',()=>{
  const onDuty=driver('1','Old',12,8);
  expect(automaticallyStaffIdleTaxis(fleet,[onDuty,spare],depots,at(14),true)[0].driver).toBe('Old');
  const onBreak=driver('1','Old',8,12);
  expect(automaticallyStaffIdleTaxis(fleet,[onBreak,spare],depots,at(13.8),true)[0].driver).toBe('Old');
 });
 it('does not move remote taxis or swap at an unrelated depot',()=>{
  expect(taxiAvailableForDriverHandover(
   taxi('Old',{position:[23.02,38]}),depots,at(14))).toBe(false);
  expect(automaticallyStaffIdleTaxis(
   [taxi('Old',{position:[23.02,38]})],[old,spare],depots,at(14),true)[0].driver).toBe('Old');
  const second=[taxi('Old',{position:[23.5,38.5],depotId:'second'})];
  expect(automaticallyStaffIdleTaxis(second,[old,spare],depots,at(14),true)[0].driver).toBe('Old');
  const localDriver=driver('3','Second shift',12,8,'second');
  expect(automaticallyStaffIdleTaxis(second,[old,spare,localDriver],depots,at(14),true)[0].driver).toBe('Second shift');
 });
 it('never reallocates a driver already assigned to another taxi',()=>{
  const another=taxi('Spare',{id:'second-taxi'});
  expect(automaticallyStaffIdleTaxis([taxi(),another],
   [old,spare],depots,at(14),true)[0].driver).toBe('Old');
 });
 it('cannot duplicate a spare employee across multiple eligible taxis',()=>{
  const otherOld=driver('3','Other',0,8);
  const both=[taxi(),taxi('Other',{id:'other-taxi'})];
  const assigned=automaticallyStaffIdleTaxis(both,
   [old,spare,otherOld],depots,at(14),true);
  expect(assigned.filter(t=>t.driver==='Spare')).toHaveLength(1);
 });
 it('never swaps a driver during paid fares, repositioning, rest or service',()=>{
  for(const changed of [
   {status:'TO_PICKUP' as const},{status:'TO_DROPOFF' as const},
   {status:'REPOSITIONING' as const},{status:'RETURNING' as const},
   {status:'PAUSED' as const},{status:'SERVICING' as const},
   {status:'REFUELLING' as const},{shiftParked:true},
   {scheduledShiftParked:true},{refillRequested:true},
   {recoveryPending:true},{restStopId:'hotel-1'},
   {repositionTarget:[23.001,38] as [number,number]},
   {deliveryUntil:at(15)},{activeJobId:'pending-job'},
  ]){
   expect(automaticallyStaffIdleTaxis([
    taxi('Old',changed)],[old,spare],depots,at(14),true)[0].driver).toBe('Old');
  }
 });
 it('prevents rapid handover thrashing and preserves the taxi identity',()=>{
  const existing=taxi('Old',{
   lastDriverHandoverGameMs:at(14)-DRIVER_HANDOVER_COOLDOWN_GAME_MS+1000,
  });
  expect(automaticallyStaffIdleTaxis([existing],
   [old,spare],depots,at(14),true)[0]).toEqual(existing);
 });
});
