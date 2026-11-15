import {describe,expect,it} from 'vitest';
import {snapshotOfWorld} from './WorldEventsController';
import type {WorldState} from '../simulation/livingWorld';

const start=Date.parse('2026-11-16T08:00:00Z');
const state:WorldState={
 lastBucket:0,
 incidents:[
  {id:'medical-1',kind:'medical',roadId:'osm:100',
   point:[23.7,38],startedAt:start,endsAt:start+30*60000,
   responders:[{id:'ambulance-1',kind:'ambulance',
    path:[[23.7,38],[23.71,38]],departAt:start,arriveAt:start+5*60000}]},
  {id:'works-1',kind:'roadworks',roadId:'osm:200',
   point:[23.8,38],startedAt:start,endsAt:start+80*60000,responders:[]},
 ],
};
describe('headless Living World event summary',()=>{
 it('includes emergency responders and roadworks as status, not map features',()=>{
  const summary=snapshotOfWorld(state,start+60_000,[23.7,38]);
  expect(summary.incidents).toHaveLength(2);
  expect(summary.incidents[0]).toEqual({
   id:'medical-1',kind:'medical',status:'responding',
   responders:['ambulance'],roadId:'osm:100',
  });
  expect(summary.incidents[1].kind).toBe('roadworks');
  expect(summary).not.toHaveProperty('features');
  expect(summary).not.toHaveProperty('markers');
 });
 it('advances response state without requiring vehicle positions',()=>{
  const summary=snapshotOfWorld(state,start+10*60_000,[23.7,38]);
  expect(summary.incidents[0].status).toBe('on-scene');
 });
 it('expires events and preserves local weather',()=>{
  const summary=snapshotOfWorld(state,start+95*60_000,[23.7,38]);
  expect(summary.incidents).toEqual([]);
  expect(['clear','rain','storm','wind','snow']).toContain(summary.weather);
 });
});