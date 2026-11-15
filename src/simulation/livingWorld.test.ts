import {describe,expect,it} from 'vitest';
import type {RoadGraph,Point} from './taxi';
import type {RoadFeature} from '../components/purpleRoadDiff';
import {advanceWorldState,dispatchResponders,newWorldState,pointOnPath,weatherAt,weatherTaxiSpeedFactor,incidentStatus} from './livingWorld';

const points:Point[]=Array.from({length:7},(_,i)=>[23+i*0.002,38]);
const key=(p:Point)=>p[0].toFixed(6)+','+p[1].toFixed(6);
const roads:RoadFeature[]=points.slice(1).map((p,i)=>({
 type:'Feature',id:'road-'+i,properties:{roadId:'road-'+i},
 geometry:{type:'LineString',coordinates:[points[i],p]},
}));
const edges:RoadGraph['edges']=new Map();
for(let i=0;i<points.length;i++){
 const e:Array<{to:string;id:string;meters:number;speedKph:number}>=[];
 if(i>0)e.push({to:key(points[i-1]),id:'road-'+(i-1),meters:180,speedKph:40});
 if(i<points.length-1)e.push({to:key(points[i+1]),id:'road-'+i,meters:180,speedKph:40});
 edges.set(key(points[i]),e);
}
const graph:RoadGraph={
 nodes:new Map<string,Point>(points.map(p=>[key(p),p] as [string,Point])),
 edges,
 nodeKeys:points.map(key),
};
const discovered=new Set(roads.map(r=>String(r.id)));
describe('living world hybrid simulation',()=>{
 it('uses stable regional weather per game day',()=>{
  const time=Date.parse('2026-11-16T08:00:00Z');
  expect(weatherAt(points[0],time)).toBe(weatherAt(points[0],time));
 });
 it('retains weather-only speed effects without a civilian traffic model',()=>{
  for(const date of ['2026-11-16','2026-11-17','2026-11-18']){
   const time=Date.parse(date+'T08:00:00Z');
   const condition=weatherAt(points[0],time);
   const expected={clear:1,rain:0.90,storm:0.80,wind:0.98,snow:0.70}[condition];
   expect(weatherTaxiSpeedFactor(points[0],time)).toBe(expected);
  }
 });
 it('interpolates emergency routes along the polyline and points north',()=>{
  const p=pointOnPath([[23,38],[23,38.002]],0.5);
  expect(p?.point[0]).toBeCloseTo(23,6);
  expect(p?.point[1]).toBeCloseTo(38.001,6);
  expect(p?.bearing).toBeCloseTo(0,6);
 });
 it('dispatches responders on existing discovered graph edges',()=>{
  const response=dispatchResponders(roads[5],roads,graph,discovered,Date.now(),'collision','test');
  expect(response.length).toBeGreaterThan(0);
  for(const unit of response){
   expect(unit.path.length).toBeGreaterThan(1);
   for(let i=1;i<unit.path.length;i++){
    const from=key(unit.path[i-1]),to=key(unit.path[i]);
    expect(graph.edges.get(from)?.some(e=>e.to===to&&discovered.has(e.id))).toBe(true);
   }
  }
 });
 it('never creates world events without discovered roads',()=>{
  const now=Date.parse('2026-11-16T06:00:00Z');
  const next=advanceWorldState(newWorldState(),now,roads,graph,new Set(),'test');
  expect(next.incidents).toEqual([]);
 });
 it('tracks responding emergency units without rendering them',()=>{
  const now=Date.parse('2026-11-16T08:00:00Z');
  const incident={id:'incident',kind:'collision' as const,roadId:'road-4',point:points[4],startedAt:now,endsAt:now+45*60000,
   responders:[{id:'police',kind:'police' as const,path:[points[0],points[4]],departAt:now,arriveAt:now+8*60000}]};
  expect(incidentStatus(incident,now+2*60000)).toBe('responding');
  expect(incidentStatus(incident,now+10*60000)).toBe('on-scene');
  expect(incidentStatus(incident,now+42*60000)).toBe('clearing');
 });
});