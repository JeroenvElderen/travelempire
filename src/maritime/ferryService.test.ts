import {describe,expect,it} from 'vitest';
import {completedFerryArrivals,ferryPhase,FERRY_TURNAROUND_MINUTES} from './ferryService';

const minute=60000;
const duration=180;
const boarding=FERRY_TURNAROUND_MINUTES;
const routes=[{id:'island',durationMinutes:duration}];

describe('shared ferry arrivals and visible boat position',()=>{
 it('requires boarding and full sailing time before the outbound fare',()=>{
  const before=ferryPhase(0,duration,(boarding+duration-1)*minute);
  expect(before.direction).toBe('outbound');
  expect(before.phase).toBe('sailing');
  expect(before.completedCount).toBe(0);
  const arrival=ferryPhase(0,duration,(boarding+duration)*minute);
  expect(arrival.phase).toBe('turnaround');
  expect(arrival.progress).toBe(1);
  expect(arrival.completedCount).toBe(1);
  expect(arrival.lastArrivalAt).toBe((boarding+duration)*minute);
 });
 it('allows a return crossing only after a separate port turnaround',()=>{
  const turnaround=ferryPhase(0,duration,(boarding+duration+boarding-1)*minute);
  expect(turnaround.phase).toBe('turnaround');
  expect(turnaround.completedCount).toBe(1);
  const departed=ferryPhase(0,duration,(boarding+duration+boarding)*minute);
  expect(departed.direction).toBe('return');
  expect(departed.phase).toBe('sailing');
  expect(departed.progress).toBe(0);
  expect(departed.completedCount).toBe(1);
  const arrived=ferryPhase(0,duration,(boarding+duration+boarding+duration)*minute);
  expect(arrived.completedCount).toBe(2);
  expect(arrived.lastArrivalAt).toBe((boarding+duration+boarding+duration)*minute);
 });
 it('records an outbound fare and a distinct return fare, never a repeated payment',()=>{
  const outboundTime=(boarding+duration)*minute;
  const outbound=completedFerryArrivals(routes,{island:0},{island:0},outboundTime);
  expect(outbound.arrivals).toEqual([{routeId:'island',direction:'outbound',
   completedAt:outboundTime,durationMinutes:duration,voyageIndex:0}]);
  expect(completedFerryArrivals(routes,{island:0},outbound.paid,outboundTime).arrivals).toHaveLength(0);
  const returnTime=(boarding+duration+boarding+duration)*minute;
  const back=completedFerryArrivals(routes,{island:0},outbound.paid,returnTime);
  expect(back.arrivals).toEqual([{routeId:'island',direction:'return',
   completedAt:returnTime,durationMinutes:duration,voyageIndex:1}]);
  expect(completedFerryArrivals(routes,{island:0},back.paid,returnTime).arrivals).toHaveLength(0);
 });
 it('does not credit a return fare when the boat is still sailing home',()=>{
  const outbound=completedFerryArrivals(routes,{island:0},{island:0},(boarding+duration)*minute);
  const whileReturning=completedFerryArrivals(routes,{island:0},outbound.paid,
   (boarding+duration+boarding+duration-1)*minute);
  expect(whileReturning.arrivals).toHaveLength(0);
 });
 it('does not replay 48 invented catch-up fares after a long offline period',()=>{
  const manyDays=45*24*60*minute;
  const settled=completedFerryArrivals(routes,{island:0},{island:0},manyDays);
  expect(settled.arrivals).toHaveLength(1);
  expect(settled.paid.island).toBeGreaterThan(48);
  expect(completedFerryArrivals(routes,{island:0},settled.paid,manyDays).arrivals).toHaveLength(0);
 });
 it('tracks independent purchased ferry routes',()=>{
  const two=[...routes,{id:'mainland',durationMinutes:30}];
  const settled=completedFerryArrivals(two,{island:0,mainland:0},
   {island:0,mainland:0},(boarding+180)*minute);
  expect(settled.arrivals).toHaveLength(2);
  expect(settled.arrivals.map(a=>a.routeId).sort()).toEqual(['island','mainland']);
 });
});
