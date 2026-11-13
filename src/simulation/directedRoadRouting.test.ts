import {describe,it,expect} from 'vitest';
import {routeFromDirectedRoad,type RoadGraph} from './taxi';

const graph=():RoadGraph=>{
 const nodes=new Map<string,[number,number]>([
  ['lowA',[23,38]],['lowB',[23.001,38]],['lowC',[23.002,38]],
  // This upper crossing is deliberately geometrically closer to the taxi,
  // but has different real OSM node identifiers and no legal ramp.
  ['upperA',[23.0005,38.00001]],['upperB',[23.0015,38.00001]],
 ]);
 const edges=new Map<string,any[]>([
  ['lowA',[{to:'lowB',id:'tunnel',meters:88,speedKph:40,tunnel:true,layer:-1}]],
  ['lowB',[{to:'lowC',id:'exit',meters:88,speedKph:40}]],
  ['upperA',[{to:'upperB',id:'bridge',meters:88,speedKph:80,bridge:true,layer:1}]],
 ]);
 return {nodes,edges,nodeKeys:[...nodes.keys()]};
};
describe('directed road recovery for underpasses',()=>{
 it('continues the original tunnel before exiting, never switching to a nearby bridge',()=>{
  const g=graph();
  const result=routeFromDirectedRoad(g,{
   edgeId:'tunnel',fromNode:'lowA',toNode:'lowB',position:[23.00055,38],
  },'lowC');
  expect(result.reason).toBe('ok');
  expect(result.edgeIds).toEqual(['tunnel','exit']);
  expect(result.path?.[0]).toEqual([23.00055,38]);
  expect(result.path?.at(-1)).toEqual([23.002,38]);
 });
 it('rejects a fake reverse against one-way roads',()=>{
  const result=routeFromDirectedRoad(graph(),{
   edgeId:'tunnel',fromNode:'lowB',toNode:'lowA',position:[23.00055,38],
  },'lowC');
  expect(result.reason).toBe('active-edge-not-directed');
 });
 it('refuses to invent an interchange to an overlapping elevated road',()=>{
  const result=routeFromDirectedRoad(graph(),{
   edgeId:'tunnel',fromNode:'lowA',toNode:'lowB',position:[23.00055,38],
  },'upperB');
  expect(result.reason).toBe('no-directed-path');
 });
 it('blocks passenger travel from an undiscovered tunnel',()=>{
  const result=routeFromDirectedRoad(graph(),{
   edgeId:'tunnel',fromNode:'lowA',toNode:'lowB',position:[23.00055,38],
  },'lowC',new Set(['exit']));
  expect(result.reason).toBe('no-directed-path');
 });
 it('refuses a position that is not on the actual edge',()=>{
  const result=routeFromDirectedRoad(graph(),{
   edgeId:'tunnel',fromNode:'lowA',toNode:'lowB',position:[23.00055,38.004],
  },'lowC');
  expect(result.reason).toBe('position-off-edge');
 });
});
