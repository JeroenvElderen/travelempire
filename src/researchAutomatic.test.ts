import {describe,expect,it} from 'vitest';
import {empty,projects,allProjects} from './research';
import {STARTER_STAGES,advanceAutomaticTree,automaticUnlocked,effectiveCosts,researchNodeId,
 technologyLevelRequirements} from './researchAutomatic';
import {buildLevelResearchDiagram} from './researchGraph';
import {safeBag,resourceKeys,type OperationalContext,type ResourceCosts} from './researchProgress';

const context:OperationalContext={freshStart:true,roads:9000,explorers:5,depots:2};
const state=(earned:ResourceCosts={},resources:ResourceCosts=earned)=>({
 ...empty(),researchV3:true as const,
 earned:safeBag(earned),resources:safeBag(resources)
});
describe('Builderment-style fully automatic research progression',()=>{
 it('requires five cumulative job-and-road milestones, never spending road research inventory',()=>{
  expect(STARTER_STAGES.map(s=>[s.jobs,s.roads])).toEqual([
   [10,50],[20,200],[30,500],[40,1000],[50,2000]]);
  const noHistoricalRoads={...context,roads:0};
  let s=advanceAutomaticTree(state({passengers:9,roads:20000}),projects,noHistoricalRoads);
  expect(s.starterLevel).toBe(0);
  s=advanceAutomaticTree(state({passengers:10,roads:50}),projects,noHistoricalRoads);
  expect(s.starterLevel).toBe(1);
  s=advanceAutomaticTree(state({passengers:20,roads:200}),projects,noHistoricalRoads);
  expect(s.starterLevel).toBe(2);
  s=advanceAutomaticTree(state({passengers:30,roads:500}),projects,noHistoricalRoads);
  expect(s.starterLevel).toBe(3);
  s=advanceAutomaticTree(state({passengers:40,roads:1000}),projects,noHistoricalRoads);
  expect(s.starterLevel).toBe(4);
  expect(automaticUnlocked(s,true)).toBe(false);
  s=advanceAutomaticTree(state({passengers:50,roads:2000}),projects,noHistoricalRoads);
  expect(s.starterLevel).toBe(5);
  expect(automaticUnlocked(s,true)).toBe(true);
 });
 it('prevents purchases until Level 5 only for newly created companies',()=>{
  expect(automaticUnlocked(state(),true)).toBe(false);
  expect(automaticUnlocked(state(),false)).toBe(true);
  const mature=advanceAutomaticTree({...state(),levels:{pricing:4,engine:2}},projects,
   {...context,freshStart:false});
  expect(mature.starterLevel).toBe(5);
  expect(mature.levels.pricing).toBe(4);
  expect(mature.levels.engine).toBe(2);
 });
 it('keeps all nonstarter research locked until startup graduation',()=>{
  expect(technologyLevelRequirements('pricing',1,{},context)).toContain('Starter Level 5 · Vehicle Dealership');
  expect(technologyLevelRequirements('pricing',1,{}, {...context,starterLevel:5})).toEqual([]);
 });
 it('automatically researches consecutive levels without user selection or a queue',()=>{
  const s=advanceAutomaticTree(state({passengers:500,revenue:75000,roads:5000,distance:10000}),projects,context);
  expect(s.starterLevel).toBe(5);
  expect((s.levels.pricing??0)).toBeGreaterThan(0);
  expect((s.levels.depotEfficiency??0)).toBeGreaterThan(0);
  expect(s.selected).toBeUndefined();
  expect(s.queue).toEqual([]);
  expect(s.contributions?.[researchNodeId('pricing',1)]).toBeDefined();
 });
 it('does not duplicate or mint any delivered research resources',()=>{
  const earned={passengers:700,roads:20000,revenue:170000,distance:30000,maintenance:300,
   hotels:0,ferries:0,parking:0,construction:0,corporate:0};
  const initial=state(earned);
  const current=advanceAutomaticTree(initial,projects,context);
  const spent=Object.values(current.contributions??{}).reduce((tot,c)=>{
   for(const k of resourceKeys)tot[k]=(tot[k]??0)+(c[k]??0);
   return tot;
  },safeBag({}));
  for(const k of resourceKeys)
   expect((current.resources?.[k]??0)+(spent[k]??0)+(current.productRawSpent?.[k]??0)).toBeCloseTo(earned[k]??0,5);
  const again=advanceAutomaticTree(current,projects,context);
  expect(again).toBe(current);
 });
 it('requires multiple parent technologies and specific levels to join branches',()=>{
  const levels={fleetAnalytics:1,routing:1,pricing:1,peakPricing:1,premium:1};
  expect(technologyLevelRequirements('regionalReposition',1,levels,{...context,starterLevel:5}))
   .toContain('fleetAnalytics Level 2');
  expect(technologyLevelRequirements('airportMarkets',1,levels,{...context,starterLevel:5}))
   .toContain('premium Level 2');
  const better={...levels,fleetAnalytics:2,routing:2,navigation:2,premium:2,demandIntelligence:1};
  expect(technologyLevelRequirements('regionalReposition',1,better,{...context,starterLevel:5})).toEqual([]);
  expect(technologyLevelRequirements('airportMarkets',1,better,{...context,starterLevel:5})).toEqual([]);
 });
 it('retains existing progress and limits legacy project levels to five',()=>{
  const s=advanceAutomaticTree({...state({passengers:300,revenue:150000,roads:20000,distance:9000}),
   levels:{pricing:5,engine:3,explorerExpansion:1}},projects,{...context,freshStart:false});
  expect(s.levels.pricing).toBe(5);
  expect(s.levels.explorerExpansion).toBe(1);
  expect(effectiveCosts('pricing',5,s.levels,projects).revenue).toBeGreaterThan(0);
 });
 it('draws a unique tile for every research level and five starter milestones',()=>{
  const graph=buildLevelResearchDiagram(allProjects.map(p=>p.id));
  expect(graph.nodes).toHaveLength(5+27*5+1+36+37+96+10);
  expect(new Set(graph.nodes.map(n=>n.id)).size).toBe(graph.nodes.length);
  expect(graph.nodes.filter(n=>n.type==='starter')).toHaveLength(5);
  expect(graph.nodes.filter(n=>n.projectId==='pricing')).toHaveLength(5);
  const edges=new Set(graph.edges.map(e=>e.from+'>'+e.to));
  expect(edges.has('starter:1>starter:2')).toBe(true);
  expect(edges.has('starter:5>pricing:1')).toBe(true);
  expect(edges.has('pricing:1>pricing:2')).toBe(true);
  expect(edges.has('premium:2>airportMarkets:1')).toBe(true);
  expect(graph.nodes.every(n=>n.y+54<=graph.height)).toBe(true);
 });
});
