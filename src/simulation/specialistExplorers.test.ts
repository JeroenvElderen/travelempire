import {describe,expect,it} from 'vitest';
import {dispatchScout,tickTaxi,type Point,type RoadGraph,type Taxi} from './taxi';
import {SPECIALIST_EXPLORERS,explorerClassEligible} from './explorerRoles';

const nodes=new Map<string,Point>([
 ['A',[0,0]],['B',[0.001,0]],['C',[0.002,0]]
]);
const graph:RoadGraph={nodes,nodeKeys:[...nodes.keys()],edges:new Map([
 ['A',[{to:'B',meters:111,id:'ab',highway:'residential',speedKph:40}]],
 ['B',[{to:'A',meters:111,id:'ab',highway:'residential',speedKph:40},
       {to:'C',meters:111,id:'bc',highway:'primary',speedKph:40}]],
 ['C',[{to:'B',meters:111,id:'bc',highway:'primary',speedKph:40}]]
])};
const scout=(role:Taxi['explorerRole'],status:Taxi['status']='IDLE'):Taxi=>({
 id:'specialist',kind:'explorer',explorerRole:role,name:'Specialist',
 driver:'Autonomous',position:nodes.get('B')!,status,
 path:[],edgeIds:[],leg:0,distanceIntoLeg:0,fare:0,completed:0
});

describe('five specialist explorers',()=>{
 it('has five unique roles',()=>{
  expect(SPECIALIST_EXPLORERS.map(e=>e.role)).toEqual([
   'highway','primary','secondary','residential','poi']);
 });
 it('assigns mutually separated road classes',()=>{
  expect(explorerClassEligible('highway','motorway_link')).toBe(true);
  expect(explorerClassEligible('highway','primary')).toBe(false);
  expect(explorerClassEligible('primary','primary_link')).toBe(true);
  expect(explorerClassEligible('primary','secondary')).toBe(false);
  expect(explorerClassEligible('secondary','tertiary')).toBe(true);
  expect(explorerClassEligible('secondary','residential')).toBe(false);
  expect(explorerClassEligible('residential','service')).toBe(true);
  expect(explorerClassEligible('residential','primary')).toBe(false);
 });
 it('does not start exploration near HQ without a purple road',async()=>{
  const result=await dispatchScout(scout('primary'),graph,new Set(),
   nodes.get('B')!,new Set(),new Set());
  expect(result.status).toBe('IDLE');
  expect(result.edgeIds).toHaveLength(0);
 });
 it('can depart from an actual purple segment to discover its class',async()=>{
  const result=await dispatchScout(scout('primary'),graph,new Set(['ab']),
   nodes.get('B')!,new Set(),new Set(),
   undefined,undefined,new Set(['bc']));
  expect(result.status).toBe('EXPLORING');
  expect(result.discoveryEdgeIds).toContain('bc');
  expect(result.path[0]).toEqual(nodes.get('B'));
 });
});
describe('explorer operational discovery',()=>{
 const travel=(purpose:'hotel'|'parking'|'fuel'|'service'|'depot')=>{
  const t:Taxi={...scout('primary','RETURNING'),
   position:nodes.get('A')!,path:[nodes.get('A')!,nodes.get('B')!],
   edgeIds:['ab'],leg:0,distanceIntoLeg:0,
   ...(purpose==='hotel'?{restStopId:'hotel:test',pauseAtHome:true}:
   purpose==='parking'?{restStopId:'parking:test',pauseAtHome:true}:
   purpose==='fuel'?{refillDestination:nodes.get('B')!}:
   purpose==='service'?{serviceDestination:nodes.get('B')!}:
   {pauseAtHome:true})};
  return tickTaxi(t,graph,5,new Set());
 };
 it.each(['hotel','parking','fuel','service'] as const)(
  'reveals the physically travelled road on a %s journey',purpose=>{
   expect(travel(purpose).discovered).toContain('ab');
  }
 );
 it('does not reveal routine depot transit',()=>{
  expect(travel('depot').discovered).not.toContain('ab');
 });
});
