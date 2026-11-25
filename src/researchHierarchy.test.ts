import {describe,expect,it} from 'vitest';
import {allProjects} from './research';
import {buildResearchHierarchy,DIVISIONS,RESEARCH_TILE_SIZE} from './researchHierarchy';
import {maximum,technologyParents} from './researchProgress';
import {PARENT_LEVEL_REQUIREMENTS,STARTER_STAGES} from './researchAutomatic';

describe('approved nine-division research technology tree',()=>{
 const diagram=buildResearchHierarchy(allProjects.map(p=>p.id));
 const byId=diagram.byId;
 const researchLevels=allProjects.reduce((n,p)=>n+maximum(p.id),0);
 it('keeps every real research level plus exactly five startup milestones and nine division entrances',()=>{
  expect(STARTER_STAGES.map(s=>s.jobs)).toEqual([10,20,30,40,50]);
  expect(STARTER_STAGES.map(s=>s.roads)).toEqual([50,200,500,1000,2000]);
  expect(researchLevels).toBe(317);
  expect(diagram.nodes).toHaveLength(researchLevels+5+9);
  expect(diagram.nodes.filter(n=>n.kind==='starter')).toHaveLength(5);
  expect(diagram.nodes.filter(n=>n.kind==='division')).toHaveLength(9);
  expect(diagram.nodes.filter(n=>n.kind==='research')).toHaveLength(researchLevels);
  expect(new Set(diagram.nodes.map(n=>n.id)).size).toBe(diagram.nodes.length);
 });
 it('opens nine unequal, separately growing research divisions, without a common final',()=>{
  expect(DIVISIONS.map(d=>d.name)).toEqual([
   'Revenue','Taxis & Ferries','Explorers','Hotels','Parking',
   'Banking & Finance','Fleet & Vehicles','Construction','Resource Collectors']);
  const lengths=DIVISIONS.map(d=>d.projects.length);
  expect(lengths[1]).toBeGreaterThan(lengths[3]);
  expect(lengths[0]).toBeGreaterThan(lengths[4]);
  expect(new Set(lengths).size).toBeGreaterThan(4);
  const nodes=diagram.nodes.filter(n=>n.kind==='division');
  expect(new Set(nodes.map(n=>n.y)).size).toBe(1);
  expect(nodes.every(n=>n.y>byId.get('starter:5')!.y)).toBe(true);
  expect(diagram.nodes.some(n=>n.id.includes('final')||n.id.includes('trophy'))).toBe(false);
 });
 it('connects the five intro milestones and fans out to exactly nine entrances',()=>{
  const visible=diagram.edges.filter(e=>e.visible);
  const wired=new Set(visible.map(e=>e.from+'>'+e.to));
  for(let l=2;l<=5;l++)expect(wired.has('starter:'+(l-1)+'>starter:'+l)).toBe(true);
  const entrances=visible.filter(e=>e.from==='starter:5'&&e.to.startsWith('division:'));
  expect(entrances).toHaveLength(9);
  for(const division of DIVISIONS){
   expect(wired.has('division:'+division.key+'>'+division.root+':1')).toBe(true);
  }
 });
 it('preserves every real prerequisite even when its wire is hidden for readability',()=>{
  const wired=new Set(diagram.edges.map(e=>e.from+'>'+e.to));
  for(const project of allProjects)
   for(const parent of technologyParents(project.id)){
    const level=PARENT_LEVEL_REQUIREMENTS[project.id]?.[parent]??1;
    expect(wired.has(parent+':'+level+'>'+project.id+':1')).toBe(true);
   }
  expect(wired.has('premium:2>airportMarkets:1')).toBe(true);
  expect(wired.has('fleetAnalytics:2>regionalReposition:1')).toBe(true);
  expect(wired.has('routing:2>regionalReposition:1')).toBe(true);
  expect(wired.has('navigation:2>regionalReposition:1')).toBe(true);
  expect(diagram.junctions.find(n=>n.id==='regionalReposition:1')?.inputs).toBe(3);
 });
 it('gives each research node one visible ancestor, including local fork splits',()=>{
  const visible=diagram.edges.filter(e=>e.visible);
  for(const node of diagram.nodes.filter(n=>n.kind==='research')){
   const inbound=visible.filter(e=>e.to===node.id);
   expect(inbound, node.id).toHaveLength(1);
  }
  expect(visible.some(e=>e.from==='pricing:3'&&e.to==='peakPricing:1')).toBe(true);
  expect(visible.some(e=>e.from==='pricing:3'&&e.to==='demandIntelligence:1')).toBe(true);
  expect(visible.some(e=>e.from==='fleetAnalytics:3'&&e.to==='trainingResearch:1')).toBe(true);
 });
 it('avoids tile overlaps and renders all connections inside the canvas',()=>{
  const occupied=new Set<string>();
  for(const node of diagram.nodes){
   expect(node.x).toBeGreaterThanOrEqual(0);
   expect(node.y).toBeGreaterThanOrEqual(0);
   expect(node.x+RESEARCH_TILE_SIZE).toBeLessThanOrEqual(diagram.width);
   expect(node.y+RESEARCH_TILE_SIZE).toBeLessThanOrEqual(diagram.height);
   const key=node.x+':'+node.y;
   expect(occupied.has(key),key).toBe(false);
   occupied.add(key);
  }
  for(const edge of diagram.edges.filter(e=>e.visible)){
   const from=byId.get(edge.from)!,to=byId.get(edge.to)!;
   expect(to.y).toBeGreaterThan(from.y);
   expect(edge.path.startsWith('M ')).toBe(true);
  }
 });
 it('does not introduce research progress or resource requirements from decorative division tiles',()=>{
  expect(diagram.nodes.filter(n=>n.kind==='division').every(n=>n.level===0)).toBe(true);
  const ids=new Set(diagram.nodes.filter(n=>n.kind==='research').map(n=>n.projectId));
  expect(ids).toEqual(new Set(allProjects.map(p=>p.id)));
  expect(diagram.height).toBeGreaterThan(1100);
 });
});
