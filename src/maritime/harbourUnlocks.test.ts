import {describe,expect,it} from 'vitest';
import {harbourRoadEdges} from './harbourUnlocks';
import type {FerryNetwork} from './ferries';
import type {RoadGraph,Point} from '../simulation/taxi';

const at=(lon:number,lat:number=38):Point=>[lon,lat];
function graph(segments:Array<{id:string;a:Point;b:Point}>):RoadGraph{
 const nodes=new Map<string,Point>(),edges:RoadGraph['edges']=new Map();
 for(const s of segments){
  const from=s.id+':a',to=s.id+':b';
  nodes.set(from,s.a);nodes.set(to,s.b);
  edges.set(from,[{id:s.id,to,meters:50,speedKph:30}]);
 }
 return{nodes,nodeKeys:[...nodes.keys()],edges};
}
const port=(point:Point):FerryNetwork=>({
 version:1,ports:[{id:'rafina',name:'Rafina',position:point,roadAccess:point}],routes:[]
});
describe('harbour discovery access-road indexing',()=>{
 it('recognises multiple short terminal approach segments, not just the nearest road',async()=>{
  const p=at(24);
  const roads=graph([
   {id:'terminal-yard',a:at(24.00002),b:at(24.00015)},
   {id:'approach',a:at(24.00016),b:at(24.00040)},
   {id:'distant-road',a:at(24.01),b:at(24.012)}
  ]);
  const matches=(await harbourRoadEdges(port(p),roads)).get('rafina')??[];
  expect(matches).toContain('terminal-yard');
  expect(matches).toContain('approach');
  expect(matches).not.toContain('distant-road');
 });
 it('falls back to the nearest mapped access segment when no nearby alternative exists',async()=>{
  const roads=graph([{id:'single',a:at(24.005),b:at(24.006)}]);
  expect((await harbourRoadEdges(port(at(24)),roads)).get('rafina')).toEqual(['single']);
 });
});
