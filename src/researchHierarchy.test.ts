import {describe,expect,it} from 'vitest';
import {allProjects} from './research';
import {buildResearchHierarchy} from './researchHierarchy';
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
 it('branches into four foundation technologies instead of twelve flat columns',()=>{
  const roots=diagram.nodes.filter(n=>n.rank===4&&n.kind==='research');
  expect(new Set(roots.map(n=>n.projectId))).toEqual(new Set([
   'pricing','depotEfficiency','survey','procurement'
  ]));
  const first=diagram.edges.filter(e=>e.from==='starter:4');
  expect(first.map(e=>e.to).sort()).toEqual(roots.map(n=>n.id).sort());
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
 });
 it('connects every dependent technology in downward-ranked paths',()=>{
  for(const edge of diagram.edges){
   const parent=byId.get(edge.from),child=byId.get(edge.to);
   expect(parent).toBeDefined();expect(child).toBeDefined();
   expect(child!.rank).toBeGreaterThan(parent!.rank);
   expect(edge.path.startsWith('M ')).toBe(true);
  }
 });
 it('has no overlapping tiles in a single research depth layer',()=>{
  const layers=new Map<number,typeof diagram.nodes>();
  for(const node of diagram.nodes)layers.set(node.rank,[...(layers.get(node.rank)??[]),node]);
  for(const layer of layers.values()){
   const ordered=[...layer].sort((a,b)=>a.x-b.x);
   for(let i=1;i<ordered.length;i++)
    expect(ordered[i].x-ordered[i-1].x).toBeGreaterThanOrEqual(54);
  }
 });
});
