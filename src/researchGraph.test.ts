import {describe,expect,it} from 'vitest';
import {allProjects,empty,projects} from './research';
import {buildResearchDiagram,RESEARCH_CANVAS_WIDTH,RESEARCH_NODE_SIZE} from './researchGraph';
import {technologyParents,prerequisites} from './researchProgress';

describe('connected Builderment-style research diagram',()=>{
 it('places all 64 unique technologies on a compact map',()=>{
  const diagram=buildResearchDiagram(allProjects.map(p=>p.id));
  expect(diagram.nodes).toHaveLength(101);
  expect(new Set(diagram.nodes.map(node=>node.id)).size).toBe(64);
  expect(diagram.width).toBe(RESEARCH_CANVAS_WIDTH);
  expect(diagram.nodes.every(n=>n.x>=0&&n.x+RESEARCH_NODE_SIZE<=diagram.width)).toBe(true);
  expect(diagram.nodes.every(n=>n.y>=0&&n.y+RESEARCH_NODE_SIZE<=diagram.height)).toBe(true);
 });
 it('draws a real prerequisite edge for every prerequisite technology',()=>{
  const diagram=buildResearchDiagram(allProjects.map(p=>p.id));
  const edges=new Set(diagram.edges.map(e=>e.from+'>'+e.to));
  for(const project of allProjects){
   for(const parent of technologyParents(project.id)){
    expect(edges.has(parent+'>'+project.id),parent+' must connect to '+project.id).toBe(true);
   }
  }
 });
 it('gates new levels behind legacy and advanced parents without rewriting completed levels',()=>{
  const context={roads:40000,explorers:2,depots:3};
  expect(prerequisites('peakPricing',empty().levels,context)).toContain('pricing');
  expect(prerequisites('demandIntelligence',empty().levels,context)).toContain('pricing');
  const levels={pricing:4,peakPricing:2};
  expect(prerequisites('peakPricing',levels,context)).toEqual([]);
  expect(prerequisites('demandIntelligence',levels,context)).toEqual([]);
  expect(projects.find(p=>p.id==='pricing')).toBeDefined();
 });
});
