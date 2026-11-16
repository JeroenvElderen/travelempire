import {describe,it,expect} from 'vitest';
import {PassengerStopSpatialIndex} from './passengerDepotDemand';
import {driverTripAffinity,driverTripMatchBonus,driverCoveragePriority,
 normalDriverTripPreference,isDriverTripPreference} from './driverTripPreferences';
import {rankUnservedCoverage,isCoverageUnderserved,
 taxiCanCoverRegion,taxiHasDutyForCoverage,
 COVERAGE_MAX_ROAD_METRES} from './taxiRegionalCoverage';
import {energyRangeKm} from './energy';
import {routeDiscovered,meters,type Taxi,type RoadGraph,type Point} from './taxi';

const P=(lon:number):Point=>[lon,38];
const makeTaxi=(overrides:Partial<Taxi>={}):Taxi=>({
 id:'taxi-1',kind:'taxi',name:'Taxi 1',driver:'Driver',
 position:P(23),status:'IDLE',path:[],edgeIds:[],leg:0,
 distanceIntoLeg:0,fare:0,completed:0,...overrides,
});

describe('Autopilot 2.1 — driver trip preferences',()=>{
 it('keeps old saves flexible and rejects unknown preferences',()=>{
  expect(normalDriverTripPreference(undefined)).toBe('flexible');
  expect(normalDriverTripPreference('wrong')).toBe('flexible');
  expect(isDriverTripPreference('long-distance')).toBe(true);
  expect(isDriverTripPreference('regional')).toBe(true);
  expect(isDriverTripPreference('short')).toBe(false);
 });
 it('prioritises willing long-distance drivers for intercity requests',()=>{
  expect(driverTripAffinity('long-distance','intercity')).toBe(1);
  expect(driverTripAffinity('local','intercity')).toBeLessThan(0);
  expect(driverTripAffinity('regional','regional')).toBe(1);
  expect(driverTripAffinity('flexible','intercity')).toBe(0);
  // Just 20 seconds slower to pickup: matching preferences wins.
  const longDriver=-240+driverTripMatchBonus('max-jobs','long-distance','intercity');
  const localDriver=-220+driverTripMatchBonus('max-jobs','local','intercity');
  expect(longDriver).toBeGreaterThan(localDriver);
 });
 it('never lets a preference compensate for an extremely slow pickup',()=>{
  const longDriver=-1200+driverTripMatchBonus('max-jobs','long-distance','intercity');
  const nearby=-120+driverTripMatchBonus('max-jobs','flexible','intercity');
  expect(nearby).toBeGreaterThan(longDriver);
 });
 it('does not forbid local jobs for flexible or long-distance drivers',()=>{
  expect(Number.isFinite(driverTripMatchBonus('balanced','long-distance','local'))).toBe(true);
  expect(driverCoveragePriority('long-distance')).toBeGreaterThan(driverCoveragePriority('regional'));
  expect(driverCoveragePriority('flexible')).toBeGreaterThan(driverCoveragePriority('local'));
 });
});

describe('Autopilot 2.1 — new discovered-road regional markets',()=>{
 const cell=()=>{
  const index=new PassengerStopSpatialIndex(),nodes=new Map<string,Point>();
  for(let i=0;i<12;i++){
   const node='west-'+i,position=P(23.18+i*.0007);
   nodes.set(node,position);index.add(node,position);
  }
  for(let i=0;i<10;i++){
   const node='far-'+i,position=P(23.44+i*.0008);
   nodes.set(node,position);index.add(node,position);
  }
  for(let i=0;i<12;i++){
   const node='home-'+i,position=P(23+i*.0008);
   nodes.set(node,position);index.add(node,position);
  }
  return {index,nodes};
 };
 it('discovers remote markets without a depot or taxi at the destination',()=>{
  const {index,nodes}=cell();
  const regions=index.coverageRegions(P(23),id=>nodes.get(id),6500,65000);
  expect(regions.some(r=>r.node.startsWith('west-'))).toBe(true);
  expect(regions.some(r=>r.node.startsWith('far-'))).toBe(true);
  expect(regions.some(r=>r.node.startsWith('home-'))).toBe(false);
  expect(regions.every(r=>r.discoveredStops>=8)).toBe(true);
 });
 it('avoids duplicating service where a taxi is already operating or heading',()=>{
  const {index,nodes}=cell();
  const regions=index.coverageRegions(P(23),id=>nodes.get(id),6500,65000);
  const west=regions.find(r=>r.node.startsWith('west-'))!;
  const alone=rankUnservedCoverage(regions,makeTaxi(),[makeTaxi()]);
  expect(alone.some(r=>r.id===west.id)).toBe(true);
  expect(isCoverageUnderserved(west,[makeTaxi({position:west.position})])).toBe(false);
  expect(isCoverageUnderserved(west,[makeTaxi({position:P(23),
   status:'REPOSITIONING',repositionTarget:west.position})])).toBe(false);
  expect(isCoverageUnderserved(west,[makeTaxi({position:west.position,status:'PAUSED'})])).toBe(true);
 });
 it('keeps the geographic shortlist bounded for iPhone Safari',()=>{
  const {index,nodes}=cell();
  expect(index.coverageRegions(P(23),id=>nodes.get(id),6500,65000,1)).toHaveLength(1);
  expect(index.coverageRegions(P(23),id=>nodes.get(id),6500,65000,0)).toHaveLength(0);
  index.clear();
  expect(index.coverageRegions(P(23),id=>nodes.get(id))).toHaveLength(0);
 });
 it('will not establish coverage without substantial post-arrival fuel',()=>{
  const t=makeTaxi();
  expect(energyRangeKm(t)).toBeGreaterThan(100);
  expect(taxiCanCoverRegion(t,20000)).toBe(true);
  expect(taxiCanCoverRegion(t,800)).toBe(false);
  expect(taxiCanCoverRegion(t,COVERAGE_MAX_ROAD_METRES+1)).toBe(false);
  const low=makeTaxi({energyRemaining:.5});
  expect(taxiCanCoverRegion(low,30000)).toBe(false);
 });
 it('respects imminent breaks and allows long empty routes across shifts',()=>{
  expect(taxiHasDutyForCoverage(300,6000)).toBe(true);
  expect(taxiHasDutyForCoverage(3600,9000)).toBe(true);
  expect(taxiHasDutyForCoverage(3600,2000)).toBe(false);
  expect(taxiHasDutyForCoverage(Infinity,9000)).toBe(false);
 });
 it('never treats a disconnected or grade-separated node as a real route',()=>{
  const A=P(23),B=P(23.01),C=P(23.2),upperB=P(23.01);
  const graph:RoadGraph={
   nodes:new Map([['A',A],['B',B],['C',C],['upperB',upperB]]),
   nodeKeys:['A','B','C','upperB'],
   edges:new Map([
    ['A',[{id:'known',to:'B',meters:meters(A,B),speedKph:60,highway:'primary'}]],
    ['B',[]],
    ['upperB',[{id:'island',to:'C',meters:meters(upperB,C),
     speedKph:60,highway:'primary',layer:1,bridge:true}]],
    ['C',[]],
   ]),
  };
  expect(routeDiscovered(graph,'A','C',new Set(['known','island']),
   '',false,28000)).toBeNull();
  expect(routeDiscovered(graph,'A','upperB',new Set(['known','island']),
   '',false,28000)).toBeNull();
  graph.edges.get('B')!.push({id:'connected',to:'C',
   meters:meters(B,C),speedKph:60,highway:'primary'});
  expect(routeDiscovered(graph,'A','C',
   new Set(['known','island','connected']),'',false,28000)?.edgeIds)
   .toEqual(['known','connected']);
 });
});
