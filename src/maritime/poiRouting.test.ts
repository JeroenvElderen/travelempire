import {describe,expect,it} from 'vitest';
import {routeToNearestTarget,type Point,type RoadGraph} from '../simulation/taxi';
const graph=():RoadGraph=>{
 const points:[string,Point][]=[['start',[24,38]],['junction',[24.01,38]],
  ['reachable-port',[24.04,38]],['island',[24.002,38.002]]];
 const nodes=new Map(points),nodeKeys=points.map(([id])=>id);
 const edges:RoadGraph['edges']=new Map([
  ['start',[{id:'road-1',to:'junction',meters:900,speedKph:40}]],
  ['junction',[{id:'road-2',to:'reachable-port',meters:3000,speedKph:40},
   {id:'road-1',to:'start',meters:900,speedKph:40}]],
  ['reachable-port',[{id:'road-2',to:'junction',meters:3000,speedKph:40}]],
  ['island',[]]
 ]);
 return{nodes,nodeKeys,edges};
};
describe('POI shortest reachable harbour',()=>{
 it('chooses a farther reachable harbour over a closer disconnected island',()=>{
  const g=graph();
  const result=routeToNearestTarget(g,'start',[
   {node:'island',offsetMeters:25},
   {node:'reachable-port',offsetMeters:40}], '',150000);
  expect(result?.targetIndex).toBe(1);
  expect(result?.edgeIds).toEqual(['road-1','road-2']);
 });
 it('does not create an imaginary road or sea shortcut to a disconnected harbour',()=>{
  const result=routeToNearestTarget(graph(),'start',[{node:'island',offsetMeters:0}]);
  expect(result).toBeNull();
 });
});
