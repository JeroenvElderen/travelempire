import {describe,expect,it} from 'vitest';
import {nearbyExplorerRestStops,reasonableExplorerRestRoute} from './explorerRestPolicy';
import type {RestStop} from './driverRest';
const at:[number,number]=[23.9,37.9];
const stops:RestStop[]=[
 {id:'far-hotel',name:'Airport Hotel',kind:'hotel',position:[24.05,37.9]},
 {id:'near-parking',name:'Nearby parking',kind:'parking',position:[23.902,37.9]},
 {id:'near-hotel',name:'Nearby hotel',kind:'hotel',position:[23.901,37.9]},
 {id:'far-parking',name:'Far parking',kind:'parking',position:[23.99,37.9]}
];
describe('efficient explorer rest routing',()=>{
 it('uses nearby parking for a short break, not a distant hotel',()=>{
  const result=nearbyExplorerRestStops(at,stops,false);
  expect(result.map(s=>s.id)).toEqual(['near-parking']);
 });
 it('prefers a hotel nearby for overnight rest',()=>{
  expect(nearbyExplorerRestStops(at,stops,true).map(s=>s.id)).toEqual(['near-hotel']);
 });
 it('uses nearby parking overnight when every hotel is too far away',()=>{
  const choices=nearbyExplorerRestStops(at,stops.filter(s=>s.id!=='near-hotel'),true);
  expect(choices.map(s=>s.id)).toEqual(['near-parking']);
 });
 it('rejects cross-city road detours even if a stop looks geographically close',()=>{
  const route:[[number,number],[number,number],[number,number]]=[
   at,[23.97,37.9],[23.902,37.9]
  ];
  expect(reasonableExplorerRestRoute(route,true)).toBe(false);
  expect(reasonableExplorerRestRoute([at,[23.902,37.9]],false)).toBe(true);
 });
});
