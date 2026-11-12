import {describe,expect,it} from 'vitest';
import {registerNewRoadDistance} from './explorerDiscoveryDistance';
import type {Point} from './taxi';

const start:Point=[24,38],end:Point=[24.001,38];
describe('explorer unique discovered distance with streamed road tiles',()=>{
 it('credits roads from later tiles instead of silently counting 0 km',()=>{
  const known=new Set<string>(['already-blue']);
  const liveLengths=new Map<string,number>([['new-highway',180]]);
  const total=registerNewRoadDistance(['new-highway'],known,liveLengths,
   ['new-highway'],[start,end]);
  expect(total).toEqual({kilometres:0.18,roads:1});
  expect(known.has('new-highway')).toBe(true);
 });
 it('uses the driven road geometry when an older save lacks an ID in the index',()=>{
  const known=new Set<string>();
  const lengths=new Map<string,number>();
  const total=registerNewRoadDistance(['later-tile'],known,lengths,
   ['later-tile'],[start,end]);
  expect(total.roads).toBe(1);
  expect(total.kilometres).toBeGreaterThan(0.08);
  expect(lengths.get('later-tile')).toBeGreaterThan(80);
 });
 it('never double counts an already explored road or repeated crossings',()=>{
  const known=new Set<string>(['known']);
  const lengths=new Map([['known',500],['fresh',200]]);
  const total=registerNewRoadDistance(['known','fresh','fresh'],known,lengths,
   ['fresh'],[start,end]);
  expect(total).toEqual({kilometres:0.2,roads:1});
 });
 it('does not credit zero distance without a valid graph edge or geometry',()=>{
  const total=registerNewRoadDistance(['missing-edge'],new Set(),new Map(),[],[]);
  expect(total).toEqual({kilometres:0,roads:1});
 });
});
