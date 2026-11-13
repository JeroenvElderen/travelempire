import {describe,expect,it} from 'vitest';
import {route,routeToNearestTarget,type RoadGraph} from './taxi';

const graph=():RoadGraph=>({
 nodes:new Map([['a',[23.943,37.935]],['b',[23.9435,37.935]],
                ['c',[23.944,37.935]],['d',[23.945,37.935]]]),
 edges:new Map([
  ['a',[{to:'b',id:'inbound',meters:45,speedKph:20}]],
  ['b',[{to:'c',id:'osm-157772015-0',meters:45,speedKph:20,taxiOnly:true}]],
  ['c',[{to:'d',id:'outbound',meters:55,speedKph:20}]],
 ]),
 nodeKeys:['a','b','c','d'],
});
describe('explicitly taxi-permitted OSM access',()=>{
 it('allows passenger taxis to exit through taxi=yes even when general access=no',()=>{
  expect(route(graph(),'a','d')?.edgeIds)
   .toEqual(['inbound','osm-157772015-0','outbound']);
 });
 it('does not allow non-taxi exploration to transit the taxi-only exit',()=>{
  expect(route(graph(),'a','d','',false)).toBeNull();
 });
 it('keeps the directed oneway restriction',()=>{
  expect(route(graph(),'c','b')).toBeNull();
 });
 it('filters restricted edges in nearest-destination searches for explorers',()=>{
  expect(routeToNearestTarget(graph(),'a',[{node:'d',offsetMeters:0}],
    '',150000,undefined,false)).toBeNull();
  expect(routeToNearestTarget(graph(),'a',[{node:'d',offsetMeters:0}])?.edgeIds)
   .toContain('osm-157772015-0');
 });
});
