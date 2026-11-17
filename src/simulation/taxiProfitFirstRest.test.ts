import {describe,it,expect} from 'vitest';
import {shiftRestTargets} from './shiftRest';
import type {Company} from '../company';
import type {Taxi} from './taxi';
import type {RestStop} from './driverRest';

const company={headquarters:{lng:23.9,lat:37.9},
 depots:[{id:'d1',name:'Main depot',lng:23.901,lat:37.9,capacity:20}]} as Company;
const taxi={id:'t1',position:[23.9,37.9],depotId:'d1'} as Taxi;
const stops:RestStop[]=[
 {id:'h1',name:'Hotel',kind:'hotel',position:[23.9005,37.9]},
 {id:'p1',name:'Parking',kind:'parking',position:[23.9003,37.9]},
 {id:'r1',name:'Rest area',kind:'rest_area',position:[23.9007,37.9]},
];
describe('Taxi profit-first: depots are delivery and headquarters only',()=>{
 it('uses local hotel or parking and never the assigned depot',()=>{
  const overnight=shiftRestTargets(taxi,stops,company,true);
  expect(overnight[0].kind).toBe('hotel');
  expect(overnight.every(x=>x.kind!=='depot')).toBe(true);
  const breakStops=shiftRestTargets(taxi,stops,company,false);
  expect(breakStops.every(x=>x.kind==='parking')).toBe(true);
 });
 it('does not order a long headquarters drive without local rest options',()=>{
  expect(shiftRestTargets(taxi,[],company,true)).toEqual([]);
  expect(shiftRestTargets(taxi,[],company,false)).toEqual([]);
 });
});
