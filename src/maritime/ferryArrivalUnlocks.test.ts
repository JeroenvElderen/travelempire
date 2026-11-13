import {describe,expect,it} from 'vitest';
import {arrivedHarbourIds,mergeUnlockedHarbours} from './ferryArrivalUnlocks';
import {completedFerryArrivals,FERRY_TURNAROUND_MINUTES} from './ferryService';

const route=new Map([['ferry-a',{from:'piraeus',to:'naxos'}]]);
const ports=new Set(['piraeus','naxos','paros']);
const minute=60000;
const duration=120;
describe('automatic ferry arrivals unlock real destinations',()=>{
 it('does not unlock a harbour before the ferry has docked',()=>{
  const early=completedFerryArrivals([{id:'ferry-a',durationMinutes:duration}],
   {'ferry-a':0},{'ferry-a':0},(FERRY_TURNAROUND_MINUTES+duration-1)*minute);
  expect(arrivedHarbourIds(early.arrivals,route,ports)).toEqual([]);
 });
 it('unlocks the outbound destination only after arrival',()=>{
  const arrival=completedFerryArrivals([{id:'ferry-a',durationMinutes:duration}],
   {'ferry-a':0},{'ferry-a':0},(FERRY_TURNAROUND_MINUTES+duration)*minute);
  expect(arrivedHarbourIds(arrival.arrivals,route,ports)).toEqual(['naxos']);
 });
 it('unlocks the reverse destination when the ferry docks on return',()=>{
  const outward=completedFerryArrivals([{id:'ferry-a',durationMinutes:duration}],
   {'ferry-a':0},{'ferry-a':0},(FERRY_TURNAROUND_MINUTES+duration)*minute);
  const back=completedFerryArrivals([{id:'ferry-a',durationMinutes:duration}],
   {'ferry-a':0},outward.paid,(FERRY_TURNAROUND_MINUTES+duration+FERRY_TURNAROUND_MINUTES+duration)*minute);
  expect(arrivedHarbourIds(back.arrivals,route,ports)).toEqual(['piraeus']);
 });
 it('does not unlock unrelated ports or unknown route ids',()=>{
  const ids=arrivedHarbourIds([
   {routeId:'ferry-a',direction:'outbound'},
   {routeId:'unknown',direction:'outbound'}],route,ports);
  expect(ids).toEqual(['naxos']);
  expect(ids).not.toContain('paros');
 });
 it('merges persistent achievements without duplicates',()=>{
  expect(mergeUnlockedHarbours(['piraeus'],['naxos','piraeus']))
   .toEqual(['piraeus','naxos']);
 });
});
