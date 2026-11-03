import {describe,it,expect} from 'vitest';
import {advanceFerryCrossing,boardFerry,crossingPosition} from './crossing';
import type {Taxi} from '../simulation/taxi';
import type {FerryNetwork} from './ferries';
const network:FerryNetwork={version:1,ports:[{id:'a',name:'A',position:[0,0]},{id:'b',name:'B',position:[2,0]}],routes:[{id:'r',from:'a',to:'b',geometry:[[0,0],[1,0],[2,0]],durationMinutes:10,source:'osm'}]};
const vehicle={id:'taxi-1',status:'TO_DROPOFF'} as Taxi;
const leg={kind:'ferry' as const,routeId:'r',fromPortId:'a',toPortId:'b',geometry:[[0,0],[1,0],[2,0]] as [number,number][],durationMinutes:10};
describe('ferry crossing',()=>{
 it('rejects unpurchased routes',()=>expect(boardFerry(vehicle,leg,network,new Set())).toBeNull());
 it('advances along ferry geometry without mutating the taxi',()=>{
  const crossing=boardFerry(vehicle,leg,network,new Set(['r']))!;
  expect(crossing).not.toBeNull();
  const halfway=advanceFerryCrossing(crossing,300);
  expect(halfway.position[0]).toBeCloseTo(1,3);
  expect(halfway.arrived).toBe(false);
  const end=advanceFerryCrossing(halfway.crossing!,300);
  expect(end.arrived).toBe(true);
  expect(end.crossing).toBeNull();
  expect(end.position).toEqual([2,0]);
  expect(vehicle.status).toBe('TO_DROPOFF');
 });
 it('clamps progress',()=>{expect(crossingPosition(leg.geometry,-1)).toEqual([0,0]);expect(crossingPosition(leg.geometry,2)).toEqual([2,0]);});
});
