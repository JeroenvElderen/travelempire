import {describe,expect,it} from 'vitest';
import {visibleOperationalPois} from './poiVisibility';
import type {Taxi} from '../simulation/taxi';
import type {Station} from '../data/stations';
import type {RestStop} from '../simulation/driverRest';
import type {PropertyHolding} from '../investments';

const station:Station={id:'fuel-1',kind:'fuel',name:'Fuel A',lng:23.7,lat:37.9};
const other:Station={id:'fuel-2',kind:'fuel',name:'Fuel B',lng:23.8,lat:37.9};
const workshop:Station={id:'shop',kind:'workshop',name:'Service A',lng:23.6,lat:37.9};
const hotel:RestStop={id:'hotel-1',kind:'hotel',name:'Hotel A',position:[23.75,37.95]};
const parking:RestStop={id:'park-1',kind:'parking',name:'Parking A',position:[23.76,37.95]};
const holdings:PropertyHolding[]=[{
 id:'hotel-1',name:'Hotel A',kind:'hotel',position:[23.75,37.95],
 valuationCents:100000,investedCents:1000,dividendsCents:0
}];
const vehicle=(overrides:Partial<Taxi>={}):Taxi=>({
 id:'taxi-1',kind:'taxi',name:'Taxi',driver:'Driver',position:[23.7,37.9],
 status:'IDLE',path:[],edgeIds:[],leg:0,distanceIntoLeg:0,fare:0,completed:0,
 ...overrides
});
describe('investment and vehicle-destination POI rendering',()=>{
 it('hides every unowned facility without an active vehicle target',()=>{
  const visible=visibleOperationalPois([station,other,workshop],
   [hotel,parking],[],[vehicle()]);
  expect(visible.stations).toEqual([]);
  expect(visible.restStops).toEqual([]);
 });
 it('renders invested hotels even if their road tile has not been loaded',()=>{
  const visible=visibleOperationalPois([],[],holdings,[]);
  expect(visible.restStops.map(p=>p.id)).toEqual(['hotel-1']);
 });
 it('shows only the actual fuel destination, not other nearby POIs',()=>{
  const visible=visibleOperationalPois([station,other,workshop],[],[],
   [vehicle({status:'RETURNING',refillDestination:[23.7,37.9]})]);
  expect(visible.stations.map(p=>p.id)).toEqual(['fuel-1']);
 });
 it('shows the targeted workshop only during servicing travel',()=>{
  const visible=visibleOperationalPois([station,workshop],[],[],
   [vehicle({status:'RETURNING',serviceDestination:[23.6,37.9]})]);
  expect(visible.stations.map(p=>p.id)).toEqual(['shop']);
 });
 it('shows a targeted parking facility and deduplicates a purchased hotel',()=>{
  const visible=visibleOperationalPois([], [hotel,parking],holdings,[
   vehicle({status:'RETURNING',restStopId:'parking:park-1',
    restStopPosition:[23.76,37.95]})
  ]);
  expect(visible.restStops.map(p=>p.id).sort()).toEqual(['hotel-1','park-1']);
 });
 it('hides unowned targets immediately after the journey ends',()=>{
  const travelling=visibleOperationalPois([station],[parking],[],[
   vehicle({status:'RETURNING',refillDestination:[23.7,37.9],
    restStopPosition:[23.76,37.95]})
  ]);
  const finished=visibleOperationalPois([station],[parking],[],[
   vehicle({status:'IDLE',refillDestination:[23.7,37.9],
    restStopPosition:[23.76,37.95]})
  ]);
  expect(travelling.stations).toHaveLength(1);
  expect(travelling.restStops).toHaveLength(1);
  expect(finished.stations).toHaveLength(0);
  expect(finished.restStops).toHaveLength(0);
 });
 it('does not show a zero-investment property',()=>{
  const zero={...holdings[0],investedCents:0};
  expect(visibleOperationalPois([],[],[zero],[]).restStops).toEqual([]);
 });
});
