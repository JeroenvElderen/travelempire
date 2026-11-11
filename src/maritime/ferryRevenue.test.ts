import {describe,it,expect} from 'vitest';
import {settleFerryCrossings} from './ferryRevenue';
const minute=60000;
const route=[{id:'ferry-1',durationMinutes:180}];
describe('ferry ticket revenue settlement',()=>{
 it('never credits tickets while a long crossing is still underway',()=>{
  const initial=settleFerryCrossings(route,{},0);
  expect(initial.crossings).toHaveLength(0);
  expect(initial.departures['ferry-1']).toBe(0);
  const sailing=settleFerryCrossings(route,initial.departures,2*60*minute);
  expect(sailing.crossings).toHaveLength(0);
 });
 it('pays exactly once when a crossing finishes, not every hour',()=>{
  const before=settleFerryCrossings(route,{'ferry-1':0},179*minute);
  expect(before.crossings).toHaveLength(0);
  const after=settleFerryCrossings(route,before.departures,180*minute);
  expect(after.crossings).toHaveLength(1);
  expect(after.departures['ferry-1']).toBe(180*minute);
  const repeated=settleFerryCrossings(route,after.departures,180*minute);
  expect(repeated.crossings).toHaveLength(0);
 });
 it('credits each completed voyage only once after time skips',()=>{
  const settled=settleFerryCrossings(route,{'ferry-1':0},8*60*minute);
  expect(settled.crossings).toHaveLength(2);
  expect(settled.crossings.map(c=>c.completedAt)).toEqual([180*minute,360*minute]);
  expect(settleFerryCrossings(route,settled.departures,8*60*minute).crossings).toHaveLength(0);
 });
 it('settles each purchased route separately',()=>{
  const routes=[{id:'slow',durationMinutes:180},{id:'fast',durationMinutes:30}];
  const settled=settleFerryCrossings(routes,{slow:0,fast:0},60*minute);
  expect(settled.crossings.filter(c=>c.routeId==='slow')).toHaveLength(0);
  expect(settled.crossings.filter(c=>c.routeId==='fast')).toHaveLength(2);
 });
 it('starts existing saves with no marker from the current game time',()=>{
  const migrated=settleFerryCrossings(route,{},12*60*minute);
  expect(migrated.crossings).toHaveLength(0);
  expect(migrated.departures['ferry-1']).toBe(12*60*minute);
 });
 it('does not double-credit after the game clock is reset backward',()=>{
  const reset=settleFerryCrossings(route,{'ferry-1':500*minute},100*minute);
  expect(reset.crossings).toHaveLength(0);
  expect(reset.departures['ferry-1']).toBe(100*minute);
 });
});
