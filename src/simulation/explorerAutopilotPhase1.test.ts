import {describe,expect,it} from 'vitest';
import {planSpecialistMission,explorerSearchConclusive,usesAutopilotRoutePlanner} from './explorerPlanCore';
import {validateExplorerMission} from './explorerMissionValidation';
import {resolvePurpleExplorerStart,prependPurpleStart} from './explorerStart';
import {explorerClassEligible} from './explorerRoles';
import type {Point,RoadGraph,Taxi} from './taxi';

const A:Point=[23,38],B:Point=[23.001,38],C:Point=[23.002,38],D:Point=[23.003,38],R:Point=[23,38.001];
const make=()=>{
 const nodes=new Map<string,Point>([['A',A],['B',B],['C',C],['D',D],['R',R]]);
 const edges:RoadGraph['edges']=new Map();
 const add=(from:string,to:string,id:string,highway:string)=>{
  const links=edges.get(from)??[];
  links.push({to,id,meters:111,speedKph:40,highway});
  edges.set(from,links);
 };
 const twoWay=(from:string,to:string,id:string,highway:string)=>{
  add(from,to,id,highway);add(to,from,id,highway);
 };
 twoWay('A','B','purple-ab','residential');
 twoWay('B','C','purple-bc','residential');
 twoWay('C','D','highway-cd','motorway');
 twoWay('A','R','local-ar','residential');
 const graph:RoadGraph={nodes,edges,nodeKeys:[...nodes.keys()]};
 const classes=(tier:Taxi['explorerRole'])=>{
  const found=new Set<string>();
  for(const links of graph.edges.values())for(const edge of links)
   if(explorerClassEligible(tier,edge.highway))found.add(edge.id);
  return found;
 };
 const discovered=new Set(['purple-ab','purple-bc']);
 return {graph,classes,discovered};
};

describe('iPhone shared-planner admission for existing saved explorers',()=>{
 it('uses strict directed Autopilot exclusively for each modern specialist',()=>{
  for(const role of ['highway','primary','secondary','residential','poi'] as const)
   expect(usesAutopilotRoutePlanner(role)).toBe(true);
 });
 it('allows legacy-only role aliases to use the compatibility path',()=>{
  for(const role of ['motorway','trunk','balanced',undefined] as const)
   expect(usesAutopilotRoutePlanner(role)).toBe(false);
 });
});

describe('Explorer Autopilot 2.0 Phase 1: identical specialist planning rules',()=>{
 it('does not downgrade motorway discovery after an incomplete preferred-class scan',()=>{
  const {graph,classes,discovered}=make();
  const pending=planSpecialistMission(graph,'A',discovered,'highway',classes,
   new Set(),new Set(),{fallbackAllowed:true,maxVisits:1});
  expect(pending.state).toBe('incomplete');
  expect(pending.tier).toBe('highway');
  expect(pending.route).toBeNull();
  expect(pending.reason).toBe('search-node-budget');
 });
 it('finds the preferred road over the full purple component before lower classes',()=>{
  const {graph,classes,discovered}=make();
  const plan=planSpecialistMission(graph,'A',discovered,'highway',classes,
   new Set(),new Set(),{fallbackAllowed:true,maxVisits:100});
  expect(plan.state).toBe('planned');
  expect(plan.tier).toBe('highway');
  expect(plan.route?.discoveryEdgeIds).toContain('highway-cd');
  expect(plan.route?.discoveryEdgeIds).not.toContain('local-ar');
 });
 it('permits strict class fallback after a complete negative preferred search',()=>{
  const {graph,classes,discovered}=make();
  graph.edges.set('C',graph.edges.get('C')!.filter(e=>e.id!=='highway-cd'));
  graph.edges.set('D',graph.edges.get('D')!.filter(e=>e.id!=='highway-cd'));
  const plan=planSpecialistMission(graph,'A',discovered,'highway',classes,
   new Set(),new Set(),{fallbackAllowed:true,maxVisits:100});
  expect(plan.state).toBe('planned');
  expect(plan.tier).toBe('residential');
  expect(plan.route?.discoveryEdgeIds).toContain('local-ar');
 });
 it('holds the preferred class until directed fallback is checked, even on iPhone',()=>{
  const {graph,classes,discovered}=make();
  const pending=planSpecialistMission(graph,'A',discovered,'highway',classes,
   new Set(),new Set(),{fallbackAllowed:false,maxVisits:100});
  // Preferred road is reachable by the connected planner, so it remains
  // immediately available even while the expensive fallback is throttled.
  expect(pending.state).toBe('planned');
  const stalled=planSpecialistMission(graph,'A',discovered,'poi',classes,
   new Set(),new Set(),{fallbackAllowed:false,maxVisits:100});
  expect(stalled.state).toBe('incomplete');
  expect(stalled.reason).toBe('directed-fallback-pending');
  expect(stalled.tier).toBe('poi');
 });
 it('Service Explorer seeks only reachable service roads',()=>{
  const {graph,classes,discovered}=make();
  const add=(from:string,to:string,id:string,highway:string)=>{
   const edges=graph.edges.get(from)??[];
   edges.push({id,to,meters:111,speedKph:25,highway});
   graph.edges.set(from,edges);
  };
  add('A','R','service-road','service');add('R','A','service-road','service');
  const plan=planSpecialistMission(graph,'A',discovered,'poi',classes,
   new Set(),new Set(),{fallbackAllowed:true,maxVisits:100});
  expect(plan.state).toBe('planned');
  expect(plan.tier).toBe('poi');
  expect(plan.route?.discoveryEdgeIds).toEqual(['service-road']);
  expect(explorerClassEligible('poi','residential')).toBe(false);
  expect(explorerClassEligible('poi','service')).toBe(true);
 });
 it('distinguishes exhausted search from budget, distance and broken path',()=>{
  expect(explorerSearchConclusive('no-connected-class-road')).toBe(true);
  expect(explorerSearchConclusive('one-way-no-legal-exit')).toBe(true);
  for(const reason of ['search-node-budget','outside-search-distance','broken-parent-route','route-too-long'])
   expect(explorerSearchConclusive(reason)).toBe(false);
 });
});

describe('Explorer Autopilot 2.0 Phase 1: directed mission validation',()=>{
 const good=()=>{
  const {graph,classes,discovered}=make();
  const start=resolvePurpleExplorerStart(graph,A,discovered);
  const mission={path:[A,B,C,D],edgeIds:['purple-ab','purple-bc','highway-cd'],
   discoveryEdgeIds:['highway-cd'],escapeTransitEdgeIds:[]};
  return {graph,classes,discovered,start:start!,mission};
 };
 it('accepts connected purple transfer followed by correct-class discovery',()=>{
  const v=good();
  expect(validateExplorerMission(v.graph,v.mission,A,v.start,v.discovered,
   v.classes('highway'),new Set(),new Set())).toEqual({ok:true,endNode:'D'});
 });
 it('rejects illegal reverse movement on a one-way discovery segment',()=>{
  const v=good();
  v.graph.edges.set('C',v.graph.edges.get('C')!.filter(e=>e.id!=='highway-cd'));
  const check=validateExplorerMission(v.graph,v.mission,A,v.start,v.discovered,
   v.classes('highway'),new Set(),new Set());
  expect(check).toEqual({ok:false,reason:'road-direction-or-layer-disconnected'});
 });
 it('rejects unreserved lower-class discovery and duplicate frontier claims',()=>{
  const v=good();
  expect(validateExplorerMission(v.graph,v.mission,A,v.start,v.discovered,
   v.classes('residential'),new Set(),new Set())).toEqual({
    ok:false,reason:'reserved-or-wrong-class-discovery'});
  expect(validateExplorerMission(v.graph,v.mission,A,v.start,v.discovered,
   v.classes('highway'),new Set(['highway-cd']),new Set())).toEqual({
    ok:false,reason:'reserved-or-wrong-class-discovery'});
 });
 it('rejects fake intersections between graph layers with identical geometry',()=>{
  const v=good();
  v.graph.nodes.set('D',[23.003,38.00001]);
  v.graph.nodes.set('upperD',[23.003,38.00001]);
  v.graph.nodes.set('E',[23.004,38.00001]);
  v.graph.edges.set('D',[]);
  v.graph.edges.set('upperD',[{id:'bridge-de',to:'E',meters:111,speedKph:50,highway:'motorway',layer:1,bridge:true}]);
  const fake={path:[A,B,C,D,v.graph.nodes.get('E')!],
   edgeIds:['purple-ab','purple-bc','highway-cd','bridge-de'],
   discoveryEdgeIds:['highway-cd','bridge-de'],escapeTransitEdgeIds:[]};
  const check=validateExplorerMission(v.graph,fake,A,v.start,v.discovered,
   v.classes('highway'),new Set(),new Set());
  expect(check).toEqual({ok:false,reason:'road-direction-or-layer-disconnected'});
 });
 it('accepts a validated mid-segment purple connector but rejects a fabricated one',()=>{
  const v=good();
  const middle:Point=[23.0006,38];
  const start=resolvePurpleExplorerStart(v.graph,middle,v.discovered,new Map([
   ['purple-ab',['A','B']],['purple-bc',['B','C']]
  ]));
  expect(start?.connector?.edgeId).toBe('purple-ab');
  const mission=prependPurpleStart(v.mission,start!);
  // Existing route starts at A; correct it to follow the validated B connector.
  const legal={path:[middle,B,C,D],
   edgeIds:['purple-ab','purple-bc','highway-cd'],
   discoveryEdgeIds:['highway-cd'],escapeTransitEdgeIds:[]};
  expect(validateExplorerMission(v.graph,legal,middle,start!,v.discovered,
   v.classes('highway'),new Set(),new Set()).ok).toBe(true);
  expect(validateExplorerMission(v.graph,{...legal,edgeIds:['purple-bc','purple-bc','highway-cd']},
   middle,start!,v.discovered,v.classes('highway'),new Set(),new Set()).ok).toBe(false);
  expect(mission.path[0]).toEqual(middle);
 });
});
