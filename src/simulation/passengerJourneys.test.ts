import {describe,expect,it} from 'vitest';
import {
 createLongPassengerRequest,PASSENGER_TRIP_BANDS,
 passengerTripTypeForAttempt,passengerTripTypeForMetres,
 sufficientPassengerRange,
} from './passengerJourneys';
import {PassengerStopSpatialIndex} from './passengerDepotDemand';
import {createPassengerRequest,meters,passengerRouteMetres,routeDiscovered,
 type Point,type RoadGraph} from './taxi';

const p=(x:number,y=38):Point=>[x,y];
const make=()=>{
 const nodes=new Map<string,Point>([
  ['A',p(23)],['B',p(23.1)],['C',p(23.29)],
  ['D',p(24.05)],['ISLAND',p(24.25)],
 ]);
 const edges:RoadGraph['edges']=new Map();
 const both=(a:string,b:string,id:string)=>{
  const start=nodes.get(a)!,end=nodes.get(b)!;
  for(const [from,to] of [[a,b],[b,a]]){
   const links=edges.get(from)??[];
   links.push({to,id,highway:'primary',speedKph:75,
    meters:meters(start,end)});
   edges.set(from,links);
  }
 };
 both('A','B','ab');both('B','C','bc');both('C','D','cd');
 edges.set('ISLAND',[]);
 const discovered=new Set(['ab','bc','cd']);
 const graph:RoadGraph={nodes,edges,nodeKeys:[...nodes.keys()]};
 return {graph,discovered,nodes};
};

describe('Taxi Phase 0: local/regional/intercity demand',()=>{
 it('uses the specified 75/20/5 demand mix, not 100% short trips',()=>{
  const types=Array.from({length:20},(_,i)=>passengerTripTypeForAttempt(i));
  expect(types.filter(x=>x==='local')).toHaveLength(15);
  expect(types.filter(x=>x==='regional')).toHaveLength(4);
  expect(types.filter(x=>x==='intercity')).toHaveLength(1);
  expect(passengerTripTypeForAttempt(20)).toBe('local');
 });
 it('classifies routed trip kilometres, not a straight-line quote',()=>{
  expect(passengerTripTypeForMetres(9999)).toBe('local');
  expect(passengerTripTypeForMetres(10000)).toBe('regional');
  expect(passengerTripTypeForMetres(50000)).toBe('intercity');
  expect(PASSENGER_TRIP_BANDS.intercity.maxMetres).toBeGreaterThan(250000);
 });
 it('creates a routed regional journey beyond the old 5 km cap',()=>{
  const {graph,discovered,nodes}=make();
  const request=createLongPassengerRequest(graph,discovered,['A'],()=>['C'],
   'regional',10000,1.1,new Set(),1);
  expect(request?.tripType).toBe('regional');
  expect(request?.tripDistanceMeters).toBeGreaterThan(10000);
  expect(request?.tripDistanceMeters).toBeLessThan(50000);
  expect(request?.tripTravelSeconds).toBeGreaterThan(0);
  expect(request?.pickup).toEqual(nodes.get('A'));
  expect(request?.dropoff).toEqual(nodes.get('C'));
  expect(request?.fare).toBeGreaterThan(30);
 });
 it('creates a genuinely connected intercity journey when all edges are discovered',()=>{
  const {graph,discovered}=make();
  const request=createLongPassengerRequest(graph,discovered,['A'],()=>['D'],
   'intercity',10000,1,new Set(),1);
  expect(request?.tripType).toBe('intercity');
  expect(request?.tripDistanceMeters).toBeGreaterThan(50000);
  expect(request?.fare).toBeGreaterThan(100);
 });
 it('does not fabricate cross-island trips with no actual road connection',()=>{
  const {graph,discovered}=make();
  const request=createLongPassengerRequest(graph,discovered,['A'],()=>['ISLAND'],
   'intercity',10000,1,new Set(),1);
  expect(request).toBeNull();
 });
 it('will not cross undiscovered links even when the endpoints are revealed',()=>{
  const {graph,discovered}=make();
  discovered.delete('bc');
  expect(createLongPassengerRequest(graph,discovered,['A'],()=>['C'],
   'regional',10000,1,new Set(),1)).toBeNull();
 });
 it('quotes a passenger fare from real metres, not travel seconds',()=>{
  const {graph,discovered}=make();
  const result=routeDiscovered(graph,'A','B',discovered);
  expect(result).not.toBeNull();
  const actual=passengerRouteMetres(result!.path);
  expect(actual).toBeGreaterThan(result!.length);
  expect(actual).toBeGreaterThan(5000);
  const local=createPassengerRequest(graph,discovered,p(23),10000,1,
   new Set(['A','B']),new Set());
  expect(local?.tripDistanceMeters).toBeCloseTo(actual,-1);
  expect(local?.fare).toBeCloseTo(4+actual/1000*1.8,1);
 });
 it('rejects already-queued duplicate origin and destination pairs',()=>{
  const {graph,discovered,nodes}=make();
  const a=nodes.get('A')!,c=nodes.get('C')!;
  const pair=a.map(x=>x.toFixed(6)).join(',')+'>'+c.map(x=>x.toFixed(6)).join(',');
  expect(createLongPassengerRequest(graph,discovered,['A'],()=>['C'],
   'regional',10000,1,new Set([pair]),1)).toBeNull();
 });
});

describe('Taxi Phase 0: fuel and geographical sampling',()=>{
 it('requires fuel for the pickup, full paid journey and 15% reserve',()=>{
  expect(sufficientPassengerRange(180,3500,100000)).toBe(true);
  expect(sufficientPassengerRange(120,3500,100000)).toBe(false);
  expect(sufficientPassengerRange(180,100000,100000)).toBe(false);
  expect(sufficientPassengerRange(Infinity,1,100)).toBe(false);
 });
 it('samples distant stops without making local pickups global',()=>{
  const {nodes}=make();
  const index=new PassengerStopSpatialIndex();
  for(const [id,point] of nodes)index.add(id,point);
  const near=index.near(p(23),id=>nodes.get(id),3000);
  expect(near).toContain('A');
  expect(near).not.toContain('D');
  const distant=index.distant(p(23),id=>nodes.get(id),50000,300000);
  expect(distant).toContain('D');
  expect(distant).not.toContain('B');
  index.clear();
  expect(index.distant(p(23),id=>nodes.get(id),50000,300000)).toEqual([]);
 });
});
