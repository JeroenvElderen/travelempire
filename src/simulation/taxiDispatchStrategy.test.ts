import {describe,expect,it} from 'vitest';
import {energySpec} from './energy';
import {trafficTravelSeconds,type PassengerRequest,type Taxi} from './taxi';
import {estimateTaxiJob,isTaxiDispatchMode,taxiDispatchScore,taxiJobAcceptable,
 selectTaxiJobCandidate,TAXI_DISPATCH_MODES} from './taxiDispatchStrategy';

const taxi=(overrides:Partial<Taxi>={}):Taxi=>({
 id:'taxi-a',name:'Taxi A',driver:'Operator',kind:'taxi',
 position:[23,38],status:'IDLE',path:[],edgeIds:[],
 leg:0,distanceIntoLeg:0,fare:0,completed:0,vehicleFuel:'Petrol',
 ...overrides,
});
const mission=(overrides:Partial<PassengerRequest>={}):PassengerRequest=>({
 id:'passenger-a',pickup:[23,38],dropoff:[23.03,38],
 fare:20,createdAt:100,expiresAt:1000,
 tripType:'local',tripDistanceMeters:8000,tripTravelSeconds:600,
 ...overrides,
});

describe('Taxi Autopilot 2.0 Phase 1 — profitable but unchanged driving',()=>{
 it('offers three selectable strategies, with Balanced as the default fallback',()=>{
  expect(TAXI_DISPATCH_MODES).toEqual(['max-jobs','balanced','max-profit']);
  expect(isTaxiDispatchMode('balanced')).toBe(true);
  expect(isTaxiDispatchMode('max-jobs')).toBe(true);
  expect(isTaxiDispatchMode('max-profit')).toBe(true);
  expect(isTaxiDispatchMode('sprint')).toBe(false);
 });
 it('uses existing game rates for distance, fuel, maintenance and driver time',()=>{
  const t=taxi();
  const estimate=estimateTaxiJob(t,mission(),2000,240)!;
  const spec=energySpec(t);
  expect(estimate.passengerMetres).toBe(8000);
  expect(estimate.approachMetres).toBe(2000);
  expect(estimate.fuelCost).toBeCloseTo(spec.per100km*.1*spec.pricePerUnit);
  expect(estimate.maintenanceCost).toBeCloseTo(.75);
  expect(estimate.labourCost).toBeCloseTo(840*.009);
  expect(estimate.insuranceCost).toBeCloseTo(840*.00085);
  expect(estimate.contribution).toBeCloseTo(20-estimate.operatingCost);
 });
 it('treats a long trip exactly like a local trip with equal metres and travel time',()=>{
  const a=estimateTaxiJob(taxi(),mission({tripType:'local'}),2000,240);
  const b=estimateTaxiJob(taxi(),mission({tripType:'intercity'}),2000,240);
  expect(a).toEqual(b);
  // No Taxi Autopilot change to traffic speed: it comes from the original
  // central routing function, regardless of the passenger trip category.
  expect(trafficTravelSeconds(1000,60,1000)).toBeGreaterThan(0);
 });
 it('accepts longer regional and intercity bookings when estimated margins permit',()=>{
  const regional=estimateTaxiJob(taxi({vehicleFuel:'Diesel'}),
   mission({tripType:'regional',tripDistanceMeters:42000,
    tripTravelSeconds:3600,fare:95}),3500,300);
  const intercity=estimateTaxiJob(taxi({vehicleFuel:'Hybrid'}),
   mission({tripType:'intercity',tripDistanceMeters:110000,
    tripTravelSeconds:7200,fare:230}),3500,300);
  expect(regional?.contribution).toBeGreaterThan(0);
  expect(intercity?.contribution).toBeGreaterThan(0);
  expect(taxiJobAcceptable('balanced',regional)).toBe(true);
  expect(taxiJobAcceptable('max-profit',intercity)).toBe(true);
 });
 it('does not count the same operating expense twice or mutate the taxi',()=>{
  const t=taxi(),original={...t};
  const quote=estimateTaxiJob(t,mission(),2000,120);
  expect(t).toEqual(original);
  expect(quote?.operatingCost).toBeCloseTo(
   (quote?.fuelCost??0)+(quote?.maintenanceCost??0)+
   (quote?.labourCost??0)+(quote?.insuranceCost??0));
 });
 it('accounts for different drivetrains and vehicle sales premiums',()=>{
  const petrol=estimateTaxiJob(taxi({vehicleFuel:'Petrol'}),mission(),500,45)!;
  const electric=estimateTaxiJob(taxi({vehicleFuel:'Electric'}),mission(),500,45)!;
  expect(electric.fuelCost).toBeLessThan(petrol.fuelCost);
  const premium=estimateTaxiJob(taxi({vehicleFuel:'Petrol',vehicleRevenueBonus:25}),
   mission(),500,45)!;
  expect(premium.fare).toBeCloseTo(petrol.fare*1.25);
  expect(premium.contribution).toBeGreaterThan(petrol.contribution);
 });
 it('denies impossible or missing quotes without claiming accurate profit',()=>{
  expect(estimateTaxiJob(taxi(),mission({tripDistanceMeters:undefined}),2000,60)).toBeNull();
  expect(estimateTaxiJob(taxi(),mission({tripTravelSeconds:0}),2000,60)).toBeNull();
  expect(estimateTaxiJob(taxi(),mission(),-1,60)).toBeNull();
  expect(estimateTaxiJob(taxi(),mission(),2000,Infinity)).toBeNull();
  expect(taxiJobAcceptable('max-jobs',null)).toBe(true);
  expect(taxiJobAcceptable('balanced',null)).toBe(true);
  expect(taxiJobAcceptable('max-profit',null)).toBe(false);
 });
 it('Maximum Jobs retains the original fastest reachable pickup choice',()=>{
  const t=taxi();
  const choices=[{name:'far',pickupEtaSeconds:520,
   estimate:estimateTaxiJob(t,mission({fare:100}),6500,520)},
   {name:'near',pickupEtaSeconds:120,
   estimate:estimateTaxiJob(t,mission({fare:8}),1200,120)}];
  expect(selectTaxiJobCandidate('max-jobs',choices)?.name).toBe('near');
 });
 it('Balanced prefers material profit without ignoring passenger wait',()=>{
  const t=taxi();
  const low={name:'close',pickupEtaSeconds:120,
   estimate:estimateTaxiJob(t,mission({fare:10}),1000,120)};
  const better={name:'better',pickupEtaSeconds:180,
   estimate:estimateTaxiJob(t,mission({fare:25}),1700,180)};
  expect(selectTaxiJobCandidate('balanced',[low,better])?.name).toBe('better');
  expect(taxiDispatchScore('balanced',120,low.estimate)).toBeGreaterThan(
   taxiDispatchScore('balanced',520,low.estimate));
 });
 it('Maximum Profit refuses jobs that tie up a driver for negligible margin',()=>{
  const t=taxi();
  const low=estimateTaxiJob(t,mission({fare:8,tripTravelSeconds:800}),2500,300)!;
  const lucrative=estimateTaxiJob(t,mission({fare:140,
   tripDistanceMeters:50000,tripTravelSeconds:2400}),1000,120)!;
  expect(taxiJobAcceptable('max-jobs',low)).toBe(true);
  expect(taxiJobAcceptable('max-profit',low)).toBe(false);
  expect(taxiJobAcceptable('max-profit',lucrative)).toBe(true);
  const choice=selectTaxiJobCandidate('max-profit',[
   {name:'low',pickupEtaSeconds:300,estimate:low},
   {name:'lucrative',pickupEtaSeconds:120,estimate:lucrative},
  ]);
  expect(choice?.name).toBe('lucrative');
 });
});
