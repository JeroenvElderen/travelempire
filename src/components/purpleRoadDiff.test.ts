import {describe,expect,it} from 'vitest';
import {diffVisibleRoads,withRoadFeatureId,type RoadFeature} from './purpleRoadDiff';

const road=(id:string,a:[number,number]=[23,38],b:[number,number]=[23.01,38],
 tunnel=false):RoadFeature=>withRoadFeatureId({
 type:'Feature',properties:{roadId:id,tunnel,bridge:false,layer:0,level:null},
 geometry:{type:'LineString',coordinates:[a,b]}
});
const index=(...features:RoadFeature[])=>new Map(features.map(f=>[String(f.id),f]));

describe('incremental MapLibre discovered-road data',()=>{
 it('uses the exact stable OSM road id as the GeoJSON feature id',()=>{
  const feature=road('osm:way:100:segment:3');
  expect(feature.id).toBe('osm:way:100:segment:3');
  expect(feature.properties?.roadId).toBe(feature.id);
 });
 it('adds only the new road, not thousands of unchanged discovered features',()=>{
  const first=road('road-1'),second=road('road-2');
  const diff=diffVisibleRoads(index(first),index(first,second));
  expect(diff.add.map(f=>f.id)).toEqual(['road-2']);
  expect(diff.remove).toEqual([]);
 });
 it('removes only the roads that left the viewport',()=>{
  const a=road('a'),b=road('b');
  const diff=diffVisibleRoads(index(a,b),index(b));
  expect(diff.add).toEqual([]);
  expect(diff.remove).toEqual(['a']);
 });
 it('does not re-upload identical geometry recreated by a map scan',()=>{
  const first=road('a'),identical=road('a');
  expect(diffVisibleRoads(index(first),index(identical))).toEqual({add:[],remove:[]});
 });
 it('replaces a road if its geometry or bridge/tunnel status changes',()=>{
  const before=road('a');
  const changed=road('a',[23,38],[23.05,38],true);
  const diff=diffVisibleRoads(index(before),index(changed));
  expect(diff.add.map(f=>f.id)).toEqual(['a']);
  expect(diff.remove).toEqual([]);
 });
 it('handles a completely new viewport without retaining old features',()=>{
  const diff=diffVisibleRoads(index(road('a'),road('b')),
   index(road('c'),road('d')));
  expect(diff.remove).toEqual(['a','b']);
  expect(diff.add.map(f=>f.id)).toEqual(['c','d']);
 });
 it('rejects features lacking a stable road id',()=>{
  expect(()=>withRoadFeatureId({
   type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[[1,1],[2,2]]}
  })).toThrow(/road ID/);
 });
});
