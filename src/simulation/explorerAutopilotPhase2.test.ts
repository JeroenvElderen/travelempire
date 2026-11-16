import {describe,expect,it} from 'vitest';
import {planConnectedFrontier} from './connectedFrontier';
import {
 estimateExplorerFrontierGain,scoreExplorerFrontier,
 explorerPlannerIdleQuota,explorerPlannerResultCurrent,
 explorerRemainingEdges,explorerSuccessorDue,explorerSuccessorUrgent,
 reserveExplorerDiscoveries,
} from './explorerAutopilot';
import type {Point,RoadGraph} from './taxi';

const p=(lon:number):Point=>[lon,38];
const graph=():RoadGraph=>{
 const nodes=new Map<string,Point>([
  ['A',p(23)],['B',p(23.001)],['C',p(23.002)],
  ['S',p(23.0012)],['D',p(23.003)],['E',p(23.004)],['F',p(23.005)],
 ]);
 const edges:RoadGraph['edges']=new Map();
 const edge=(a:string,b:string,id:string,length:number,highway='residential')=>{
  const links=edges.get(a)??[];links.push({id,to:b,meters:length,speedKph:35,highway});
  edges.set(a,links);
 };
 const both=(a:string,b:string,id:string,len:number,highway='residential')=>{
  edge(a,b,id,len,highway);edge(b,a,id,len,highway);
 };
 both('A','B','purple-a',111);
 both('B','C','purple-b',111);
 both('B','S','tiny',22);
 both('C','D','big1',111);
 both('D','E','big2',111);
 both('E','F','big3',111);
 return {nodes,edges,nodeKeys:[...nodes.keys()]};
};

describe('Explorer Autopilot 2.0 — efficient frontier selection',()=>{
 it('favors a productive connected local corridor over a nearby micro-segment',()=>{
  const g=graph();
  const explored=new Set(['purple-a','purple-b']);
  const allowed=new Set(['tiny','big1','big2','big3']);
  const result=planConnectedFrontier(g,'A',explored,allowed,
   new Set(),new Set(),'residential',500);
  expect(result.route?.discoveryEdgeIds).toEqual(['big1','big2','big3']);
  expect(result.route?.edgeIds[0]).toBe('purple-a');
  expect(result.route?.edgeIds).toContain('purple-b');
  expect(result.route?.edgeIds).not.toContain('tiny');
 });
 it('counts only nearby eligible, unreserved, undiscovered roads as prospective gain',()=>{
  const g=graph(),eligible=new Set(['big1','big2','big3']);
  const open=estimateExplorerFrontierGain(g,'C','D','big1',eligible,
   new Set(),new Set(),new Set());
  const blocked=estimateExplorerFrontierGain(g,'C','D','big1',eligible,
   new Set(),new Set(['big2']),new Set());
  expect(open).toBeGreaterThan(blocked);
  expect(blocked).toBe(111);
  expect(estimateExplorerFrontierGain(g,'C','B','purple-b',eligible,
   new Set(),new Set(),new Set())).toBe(0);
  expect(scoreExplorerFrontier(200,400)).toBeLessThan(scoreExplorerFrontier(100,20));
  expect(scoreExplorerFrontier(5000,500)).toBeGreaterThan(scoreExplorerFrontier(100,500));
 });
 it('never selects reserved discovery targets and may share existing purple transit',()=>{
  const g=graph(),explored=new Set(['purple-a','purple-b']);
  const result=planConnectedFrontier(g,'A',explored,new Set(['tiny','big1','big2','big3']),
   new Set(['big1','big2','big3']),new Set(),'residential',500);
  expect(result.route?.discoveryEdgeIds).toEqual(['tiny']);
  expect(result.route?.edgeIds).toContain('purple-a');
 });
});

describe('Explorer Autopilot 2.0 — continuous mission scheduler',()=>{
 it('starts successor planning well before stopping and prioritises near-arrivals',()=>{
  const moving={status:'EXPLORING' as const,edgeIds:Array.from({length:60},(_,i)=>String(i)),leg:11};
  expect(explorerRemainingEdges(moving)).toBe(49);
  expect(explorerSuccessorDue(moving)).toBe(false);
  moving.leg=12;
  expect(explorerSuccessorDue(moving)).toBe(true);
  expect(explorerSuccessorUrgent(moving)).toBe(false);
  moving.leg=36;
  expect(explorerSuccessorUrgent(moving)).toBe(true);
  expect(explorerSuccessorDue({...moving,status:'IDLE'})).toBe(false);
 });
 it('keeps one desktop planner slot for urgent successors while still serving idle explorers',()=>{
  expect(explorerPlannerIdleQuota(2,true)).toBe(1);
  expect(explorerPlannerIdleQuota(1,true)).toBe(0);
  expect(explorerPlannerIdleQuota(2,false)).toBe(2);
  expect(explorerPlannerIdleQuota(0,true)).toBe(0);
 });
 it('reserves undiscovered discoveries, never the purple road used to reach them',()=>{
  const A:Point=[23,38],B:Point=[23.001,38],C:Point=[23.002,38];
  const vehicles=[
   {kind:'explorer' as const,status:'EXPLORING' as const,
    path:[A,B],discoveryEdgeIds:['purple','new-one']},
   {kind:'explorer' as const,status:'EXPLORING' as const,
    path:[A,C],discoveryEdgeIds:['purple','new-two']},
   {kind:'taxi' as const,status:'EXPLORING' as const,
    path:[A,C],discoveryEdgeIds:['taxi-only']},
  ];
  const result=reserveExplorerDiscoveries(vehicles,new Set(['purple']),
   p=>String(p[0]));
  expect([...result.edges].sort()).toEqual(['new-one','new-two']);
  expect(result.targets).toEqual(new Set(['23.001','23.002']));
 });
 it('rejects old worker results after a newer mission or changed road-class assignment',()=>{
  const current={status:'EXPLORING' as const,explorerRole:'residential' as const,
   scoutingRuns:4,edgeIds:['purple','new1']};
  const request={mode:'successor' as const,role:'residential' as const,
   scoutingRuns:4,baseEdgeIds:['purple','new1']};
  expect(explorerPlannerResultCurrent(current,request)).toBe(true);
  expect(explorerPlannerResultCurrent({...current,scoutingRuns:5},request)).toBe(false);
  expect(explorerPlannerResultCurrent({...current,explorerRole:'poi' as const},request)).toBe(false);
  expect(explorerPlannerResultCurrent({...current,edgeIds:['purple','new2']},request)).toBe(false);
  expect(explorerPlannerResultCurrent({...current,status:'IDLE' as const},request)).toBe(false);
  expect(explorerPlannerResultCurrent({...current,status:'IDLE' as const},{
   mode:'idle',role:'residential',scoutingRuns:4,
  })).toBe(true);
 });
});
