import {describe,it,expect} from 'vitest';
import {projects,empty} from './research';
import {EMPTY_RESOURCES,observation,selectTechnology,queueTechnology,autoContribute,
 safeBag,researchCosts,newProjects,type OperationalContext} from './researchProgress';
const context:OperationalContext={roads:20000,explorers:2,depots:2};
const counters=(patch:Partial<typeof EMPTY_RESOURCES>={})=>({...EMPTY_RESOURCES,...patch});

describe('automatic research economy',()=>{
 it('contains 169 advanced technologies including 133 new branches beside 28 legacy programmes',()=>{
  expect(projects).toHaveLength(28);
  expect(newProjects).toHaveLength(169);
  expect(new Set([...projects,...newProjects].map(p=>p.id)).size).toBe(207);
 });
 it('awards resources only for positive settled counter deltas',()=>{
  const initial=observation(empty(),counters({roads:120,passengers:10,revenue:500}));
  const repeated=observation(initial,counters({roads:120,passengers:10,revenue:500}));
  expect(repeated).toBe(initial);
  const earned=observation(repeated,counters({roads:130,passengers:12,revenue:550}));
  expect(earned.resources?.roads).toBe(130);
  expect(earned.resources?.passengers).toBe(12);
  expect(earned.resources?.revenue).toBe(550);
  const backwards=observation(earned,counters({roads:110,passengers:8,revenue:400}));
  expect(backwards).toBe(earned);
  expect(earned.sourceSnapshot?.roads).toBe(130);
 });
 it('consumes resources automatically and retains surplus for the next project',()=>{
  const initial={...empty(),researchV3:true as const,
   resources:safeBag({passengers:500,roads:5000,revenue:150000}),
   earned:safeBag({passengers:500,roads:5000,revenue:150000}),
   queue:['demandIntelligence']};
  const result=selectTechnology(initial,'pricing',projects,context);
  expect(result.levels.pricing).toBe(1);
  expect(result.levels.demandIntelligence).toBe(1);
  expect(result.resources?.roads).toBe(4700);
  expect(result.resources?.passengers).toBe(410);
  expect(result.resources?.revenue).toBe(141000);
  expect(result.selected).toBeUndefined();
  expect(result.queue).toHaveLength(0);
 });
 it('preserves delivered materials when a research target is paused',()=>{
  const first=selectTechnology({...empty(),researchV3:true as const,
   resources:safeBag({passengers:20,revenue:1000})},'pricing',projects,context);
  expect(first.levels.pricing).toBeUndefined();
  expect(first.contributions?.['pricing:1']?.passengers).toBe(20);
  const paused={...first,selected:undefined};
  const resumed=selectTechnology({...paused,resources:safeBag({passengers:20,revenue:3000})},
   'pricing',projects,context);
  expect(resumed.levels.pricing).toBe(1);
 });
 it('does not unlock advanced nodes before their prerequisites',()=>{
  const initial={...empty(),researchV3:true as const,
   resources:safeBag({passengers:1000,roads:5000,revenue:100000})};
  const advanced=selectTechnology(initial,'demandIntelligence',projects,context);
  expect(advanced.levels.demandIntelligence).toBeUndefined();
  expect(advanced.resources?.passengers).toBe(1000);
  const base=selectTechnology(advanced,'pricing',projects,context);
  expect(base.levels.pricing).toBe(1);
  expect(base.levels.demandIntelligence).toBe(1);
 });
 it('queues at most five projects and does not duplicate already queued targets',()=>{
  let state={...empty(),researchV3:true as const};
  for(const id of ['pricing','peakPricing','premium','longDistance','engine','fuelInjection','durability'])
   state=queueTechnology(state,id,projects,context);
  expect(state.queue?.length).toBe(5);
  expect(new Set(state.queue).size).toBe(5);
 });
 it('uses level-based resource costs for previously researched programme families',()=>{
  expect(researchCosts('pricing',2,projects).passengers).toBeGreaterThan(researchCosts('pricing',1,projects).passengers!);
  expect(researchCosts('explorerExpansion',1,projects).roads).toBe(5000);
 });
 it('keeps completed technologies stable with no new resource awards',()=>{
  const state={...empty(),researchV3:true as const,levels:{pricing:5},resources:safeBag({passengers:0,revenue:0})};
  const next=autoContribute(state,projects,context);
  expect(next.levels.pricing).toBe(5);
 });
});
