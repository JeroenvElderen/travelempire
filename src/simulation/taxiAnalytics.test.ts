import {describe,expect,it} from 'vitest';
import type {FleetState,Taxi,VehicleFinancePeriod} from './taxi';
import {advanceTaxiActivity,taxiAnalyticsDateRange,taxiOperationsReport} from './taxiAnalytics';

const taxi=(id:string,extra:Partial<Taxi>={}):Taxi=>({
 id,name:id,driver:'Driver',kind:'taxi',depotId:'main',
 position:[23,38],status:'IDLE',path:[],edgeIds:[],
 leg:0,distanceIntoLeg:0,fare:0,completed:0,...extra,
});
const now=Date.UTC(2026,10,16,14);
const day='2026-11-16';
const previous='2026-11-15';
const old='2026-11-01';
const recorded=(taxiId:string,dayValue:string,values:Partial<VehicleFinancePeriod>={}):
 VehicleFinancePeriod=>({
 day:dayValue,taxiId,name:taxiId,revenue:100,expenses:45,km:30,trips:3,...values,
});

describe('Taxi Phase 4 — measured travel and utilisation',()=>{
 it('separates actual passenger, pickup and reposition kilometres',()=>{
  const vehicle=taxi('taxi-a');
  const passenger=advanceTaxiActivity(vehicle,'TO_DROPOFF',1200,120,true);
  expect(passenger.passengerKm).toBeCloseTo(1.2);
  expect(passenger.emptyKm).toBe(0);
  expect(passenger.serviceGameSeconds).toBe(120);
  expect(passenger.occupiedGameSeconds).toBe(120);
  const pickup=advanceTaxiActivity({...vehicle,...passenger},'TO_PICKUP',700,90,true);
  expect(pickup.passengerKm).toBeCloseTo(1.2);
  expect(pickup.emptyKm).toBeCloseTo(.7);
  expect(pickup.pickupKm).toBeCloseTo(.7);
  expect(pickup.serviceGameSeconds).toBe(210);
  const reposition=advanceTaxiActivity({...vehicle,...pickup},'REPOSITIONING',900,180,true);
  expect(reposition.emptyKm).toBeCloseTo(1.6);
  expect(reposition.repositionKm).toBeCloseTo(.9);
  expect(reposition.serviceGameSeconds).toBe(210);
  const returning=advanceTaxiActivity({...vehicle,...reposition},'RETURNING',800,60,false);
  expect(returning.emptyKm).toBeCloseTo(2.4);
  expect(returning.onDutyGameSeconds).toBe(390);
 });
 it('tracks active passenger-service time beyond shift, but not off-duty parking',()=>{
  const vehicle=taxi('taxi-a');
  const service=advanceTaxiActivity(vehicle,'TO_DROPOFF',100,240,false);
  expect(service.serviceGameSeconds).toBe(240);
  expect(service.onDutyGameSeconds).toBe(240);
  const off=advanceTaxiActivity({...vehicle,...service},'PAUSED',0,3600,false);
  expect(off.onDutyGameSeconds).toBe(240);
  const working=advanceTaxiActivity({...vehicle,...off},'IDLE',0,600,true);
  expect(working.onDutyGameSeconds).toBe(840);
  const manualRest=advanceTaxiActivity({...vehicle,...working,shiftParked:true},
   'IDLE',0,500,true);
  expect(manualRest.onDutyGameSeconds).toBe(840);
 });
 it('never gives a passenger explorer or ferry a taxi analytics record',()=>{
  const explorer=taxi('scout',{kind:'explorer',status:'EXPLORING'});
  const recorded=advanceTaxiActivity(explorer,'EXPLORING',5000,3600,true);
  expect(recorded.passengerKm).toBe(0);
  expect(recorded.emptyKm).toBe(0);
  expect(recorded.onDutyGameSeconds).toBe(0);
 });
 it('does not invent activity from invalid or negative telemetry',()=>{
  const vehicle=taxi('a');
  expect(advanceTaxiActivity(vehicle,'IDLE',-400,-1,true).onDutyGameSeconds).toBe(0);
  expect(advanceTaxiActivity(vehicle,'REPOSITIONING',NaN,Infinity,true).emptyKm).toBe(0);
  expect(advanceTaxiActivity(vehicle,'TO_DROPOFF',0,0,true).passengerKm).toBe(0);
 });
});

describe('Taxi Phase 4 — truthful game-ledger reporting',()=>{
 const build=(entries:VehicleFinancePeriod[]):FleetState=>({
  taxis:[taxi('A'),taxi('B',{depotId:'second'}),taxi('explorer',{kind:'explorer'})],
  revenue:0,completed:0,vehicleFinanceHistory:entries,
  depotFinanceHistory:[
   {day,name:'',depotId:'main',depotName:'Athens',
    revenue:240,vehicleExpenses:95,facilityExpenses:25,allocatedOverhead:10,
    trips:6,km:65},
   {day,name:'',depotId:'second',depotName:'Corinth',
    revenue:70,vehicleExpenses:55,facilityExpenses:10,allocatedOverhead:5,
    trips:2,km:22},
   {day:old,depotId:'main',depotName:'Athens',
    revenue:1000,vehicleExpenses:200,facilityExpenses:20,
    allocatedOverhead:10,trips:20,km:400},
  ].map(({name:unused,...row})=>row),
 });
 it('builds calendar-correct Today/7 days/30 days game time boundaries',()=>{
  expect(taxiAnalyticsDateRange(now,'today')).toEqual({
   start:day,end:day,days:1,
  });
  expect(taxiAnalyticsDateRange(now,'7d')).toEqual({
   start:'2026-11-10',end:day,days:7,
  });
  expect(taxiAnalyticsDateRange(now,'30d')).toEqual({
   start:'2026-10-18',end:day,days:30,
  });
 });
 it('reports actual taxi fare and costs, excludes explorers and older days',()=>{
  const fleet=build([
   recorded('A',day,{revenue:120,expenses:50,km:36,trips:4}),
   recorded('B',day,{revenue:70,expenses:40,km:22,trips:2}),
   recorded('explorer',day,{revenue:999,expenses:800,km:1000,trips:1}),
   recorded('A',old,{revenue:1000,expenses:200,km:250,trips:12}),
  ]);
  const report=taxiOperationsReport(fleet,now,'today');
  expect(report.totalRevenue).toBe(190);
  expect(report.totalExpenses).toBe(90);
  expect(report.totalNet).toBe(100);
  expect(report.totalKm).toBe(58);
  expect(report.totalTrips).toBe(6);
  expect(report.rows).toHaveLength(2);
  expect(report.rows[0].name).toBe('A');
  expect(report.rows[0].net).toBe(70);
  expect(report.rows[1].net).toBe(30);
  expect(report.depots.find(d=>d.id==='main')?.depotNet).toBe(110);
  expect(report.depots.find(d=>d.id==='second')?.depotNet).toBe(0);
  expect(report.depots.find(d=>d.id==='main')?.taxiContribution).toBe(70);
 });
 it('shows untracked distance and time as missing for legacy finance entries',()=>{
  const report=taxiOperationsReport(build([recorded('A',day)]),now,'today');
  expect(report.utilisation).toBeNull();
  expect(report.paidKmShare).toBeNull();
  expect(report.hasDistanceMetrics).toBe(false);
  expect(report.rows[0].utilisation).toBeNull();
  expect(report.rows[0].otherCost).toBe(45);
  expect(report.hasCostDetails).toBe(false);
 });
 it('accurately distinguishes paid, empty, pickup and repositioned km',()=>{
  const report=taxiOperationsReport(build([
   recorded('A',day,{passengerKm:12,emptyKm:8,pickupKm:3,
    repositionKm:2,onDutyGameSeconds:7200,serviceGameSeconds:3600,
    occupiedGameSeconds:2400,fuelCost:12,maintenanceCost:8,
    wageCost:25,insuranceCost:5,expenses:55}),
   recorded('B',day,{passengerKm:2,emptyKm:8,pickupKm:5,
    repositionKm:1,onDutyGameSeconds:10800,serviceGameSeconds:1800,
    occupiedGameSeconds:900,fuelCost:2,maintenanceCost:4,
    wageCost:24,insuranceCost:3,expenses:39}),
  ]),now,'today');
  expect(report.totalPassengerKm).toBe(14);
  expect(report.totalEmptyKm).toBe(16);
  expect(report.totalPickupKm).toBe(8);
  expect(report.totalRepositionKm).toBe(3);
  expect(report.paidKmShare).toBe(47);
  expect(report.utilisation).toBe(30);
  expect(report.occupiedShare).toBe(18);
  expect(report.totalFuel).toBe(14);
  expect(report.totalMaintenance).toBe(12);
  expect(report.totalWages).toBe(49);
  expect(report.totalInsurance).toBe(8);
  expect(report.totalOther).toBe(11);
  expect(report.hasCostDetails).toBe(true);
 });
 it('compares one-day and seven-day results without mixing outside dates',()=>{
  const fleet=build([
   recorded('A',day,{revenue:60,expenses:10,trips:1}),
   recorded('A',previous,{revenue:30,expenses:15,trips:2}),
   recorded('A',old,{revenue:150,expenses:20,trips:5}),
  ]);
  const today=taxiOperationsReport(fleet,now,'today');
  const week=taxiOperationsReport(fleet,now,'7d');
  const month=taxiOperationsReport(fleet,now,'30d');
  expect(today.totalRevenue).toBe(60);
  expect(week.totalRevenue).toBe(90);
  expect(month.totalRevenue).toBe(240);
  expect(week.daily).toHaveLength(7);
  expect(week.daily.at(-1)?.revenue).toBe(60);
  expect(week.daily.at(-2)?.revenue).toBe(30);
  expect(week.daily[0].revenue).toBe(0);
 });
 it('handles company with no taxis or old retained records gracefully',()=>{
  const report=taxiOperationsReport({taxis:[],vehicleFinanceHistory:[
   recorded('sold',day)]},now,'7d');
  expect(report.totalRevenue).toBe(0);
  expect(report.rows).toEqual([]);
  expect(report.utilisation).toBeNull();
  expect(report.daily.every(v=>v.revenue===0)).toBe(true);
 });
});
