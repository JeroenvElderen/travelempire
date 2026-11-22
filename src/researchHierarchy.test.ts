import {describe,expect,it} from 'vitest';
import {allProjects} from './research';
import {buildResearchHierarchy,INDEPENDENT_RESEARCH_ROOTS} from './researchHierarchy';
import {technologyParents} from './researchProgress';
import {PARENT_LEVEL_REQUIREMENTS,STARTER_STAGES} from './researchAutomatic';

describe('immersive dependency-first research tree',()=>{
 const diagram=buildResearchHierarchy(allProjects.map(p=>p.id));
 const byId=diagram.byId;
 it('includes every one of 176 research levels and all four intro milestones',()=>{
  expect(diagram.nodes).toHaveLength(176);
  expect(diagram.nodes.filter(n=>n.kind==='starter')).toHaveLength(4);
  expect(new Set(diagram.nodes.map(n=>n.id)).size).toBe(176);
  for(const node of diagram.nodes){
   expect(node.x).toBeGreaterThanOrEqual(0);
   expect(node.y).toBeGreaterThanOrEqual(0);
   expect(node.x+54).toBeLessThanOrEqual(diagram.width);
   expect(node.y+54).toBeLessThanOrEqual(diagram.height);
  }
 });
 it('starts with four serial job-and-cash milestones',()=>{
  expect(STARTER_STAGES.map(s=>s.jobs)).toEqual([10,20,30,50]);
  expect(byId.get('starter:1')?.rank).toBe(0);
  expect(byId.get('starter:4')?.rank).toBe(3);
  const wired=new Set(diagram.edges.map(e=>e.from+'>'+e.to));
  for(let level=2;level<=4;level++)
   expect(wired.has('starter:'+(level-1)+'>starter:'+level)).toBe(true);
 });
 it('starts five research families, including two genuinely independent paths',()=>{
  const roots=diagram.nodes.filter(n=>n.rank===4&&n.kind==='research');
  expect(new Set(roots.map(n=>n.projectId))).toEqual(new Set([
   'pricing','fleetAnalytics','depotEfficiency','survey','procurement'
  ]));
  expect(INDEPENDENT_RESEARCH_ROOTS).toEqual(['pricing','procurement']);
  const linked=diagram.edges.filter(e=>e.from==='starter:4').map(e=>e.to).sort();
  expect(linked).toEqual(['fleetAnalytics:1','depotEfficiency:1','survey:1'].sort());
  expect(diagram.edges.some(e=>e.to==='pricing:1'||e.to==='procurement:1')).toBe(false);
 });
 it('requires actual parental technology levels for multi-branch joins',()=>{
  const edges=new Set(diagram.edges.map(e=>e.from+'>'+e.to));
  for(const project of allProjects){
   for(const parent of technologyParents(project.id)){
    const required=PARENT_LEVEL_REQUIREMENTS[project.id]?.[parent]??1;
    expect(edges.has(parent+':'+required+'>'+project.id+':1')).toBe(true);
   }
  }
  expect(edges.has('premium:2>airportMarkets:1')).toBe(true);
  expect(edges.has('fleetAnalytics:2>regionalReposition:1')).toBe(true);
  expect(edges.has('routing:2>regionalReposition:1')).toBe(true);
  expect(edges.has('navigation:2>regionalReposition:1')).toBe(true);
  const merge=diagram.junctions.find(j=>j.id==='regionalReposition:1');
  expect(merge?.inputs).toBe(3);
  expect(edges.has('regionalReposition:1>multiDepotDispatch:1')).toBe(true);
  expect(edges.has('regionalReposition:1>advancedScheduling:1')).toBe(true);
  expect(edges.has('multiDepotDispatch:1>profitAwareFleet:1')).toBe(true);
  expect(edges.has('advancedScheduling:1>profitAwareFleet:1')).toBe(true);
 });
 it('connects every dependent technology in downward-ranked paths',()=>{
  for(const edge of diagram.edges){
   const parent=byId.get(edge.from),child=byId.get(edge.to);
   expect(parent).toBeDefined();expect(child).toBeDefined();
   expect(child!.rank).toBeGreaterThan(parent!.rank);
   expect(edge.path.startsWith('M ')).toBe(true);
  }
 });
 it('keeps all 176 level tiles collision-free, including staggered branches',()=>{
  const layers=new Map<number,typeof diagram.nodes>();
  for(const node of diagram.nodes)layers.set(node.rank,[...(layers.get(node.rank)??[]),node]);
  for(const layer of layers.values()){
   const ordered=[...layer].sort((a,b)=>a.x-b.x);
   for(let i=1;i<ordered.length;i++)
    expect(ordered[i].x-ordered[i-1].x).toBeGreaterThanOrEqual(54);
  }
  expect(diagram.nodes.filter(n=>n.kind==='research').every(n=>n.rank>=4)).toBe(true);
  expect(new Set(diagram.nodes.map(n=>n.rank)).size).toBeGreaterThanOrEqual(17);
 });
 it('keeps the standalone fare-only chain in a coherent directed progression',()=>{
  const edges=new Set(diagram.edges.map(e=>e.from+'>'+e.to));
  expect(edges.has('pricing:1>peakPricing:1')).toBe(true);
  expect(edges.has('peakPricing:1>premium:1')).toBe(true);
  expect(edges.has('premium:1>longDistance:1')).toBe(true);
  const root=byId.get('pricing:1')!;
  const leaf=byId.get('longDistance:1')!;
  expect(leaf.y).toBeGreaterThan(root.y);
 });
});
