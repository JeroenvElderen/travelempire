import {describe,expect,it} from 'vitest';
import {ferryPhase,ferryStartsAtFrom,nextPassengerDeparture,
 PUBLIC_PASSENGER_FERRY_EPOCH_MS,FERRY_TURNAROUND_MINUTES,mayBoardPassengerFerry} from './ferryService';
import {vehicleActivity} from '../simulation/vehicleActivity';
import type {Taxi} from '../simulation/taxi';

const minute=60000;
const duration=75;
const origin=Date.UTC(2026,0,1,0,0);
describe('passenger ferry vehicles wait for the scheduled vessel',()=>{
 it('waits for the outbound ferry to return before the next outbound departure',()=>{
  const first=origin+FERRY_TURNAROUND_MINUTES*minute;
  const slot=nextPassengerDeparture(origin,duration,first+minute,true);
  expect(slot.voyageIndex).toBe(2);
  expect(slot.departureGameMs).toBe(first+2*(duration+FERRY_TURNAROUND_MINUTES)*minute);
  const prior=ferryPhase(origin,duration,slot.departureGameMs-1);
  expect(prior.phase).toBe('turnaround');
  expect(prior.direction).toBe('return');
  const boarding=ferryPhase(origin,duration,slot.departureGameMs);
  expect(boarding.phase).toBe('sailing');
  expect(boarding.direction).toBe('outbound');
  expect(boarding.progress).toBe(0);
 });
 it('boards on the reverse service from the opposite terminal only',()=>{
  const first=origin+FERRY_TURNAROUND_MINUTES*minute;
  const slot=nextPassengerDeparture(origin,duration,first+minute,false);
  expect(slot.voyageIndex).toBe(1);
  expect(slot.departureGameMs).toBe(first+(duration+FERRY_TURNAROUND_MINUTES)*minute);
  const phase=ferryPhase(origin,duration,slot.departureGameMs);
  expect(phase.direction).toBe('return');
  expect(phase.phase).toBe('sailing');
  expect(phase.progress).toBe(0);
 });
 it('allows boarding at the exact departure, never before departure',()=>{
  const first=origin+FERRY_TURNAROUND_MINUTES*minute;
  expect(nextPassengerDeparture(origin,duration,first,true).departureGameMs).toBe(first);
  expect(nextPassengerDeparture(origin,duration,first-1,true).departureGameMs).toBe(first);
 });
 it('refuses to board a ferry that was missed while the tab was suspended',()=>{
  const first=origin+FERRY_TURNAROUND_MINUTES*minute;
  expect(mayBoardPassengerFerry(first,first-1)).toBe(false);
  expect(mayBoardPassengerFerry(first,first+24_000)).toBe(true);
  expect(mayBoardPassengerFerry(first,first+3*minute)).toBe(false);
  const next=nextPassengerDeparture(origin,duration,first+3*minute,true);
  expect(next.departureGameMs).toBeGreaterThan(first+3*minute);
 });
 it('keeps public passenger ferry departures stable across reloads',()=>{
  const now=Date.UTC(2026,11,29,23,19);
  expect(nextPassengerDeparture(PUBLIC_PASSENGER_FERRY_EPOCH_MS,40,now,false))
   .toEqual(nextPassengerDeparture(PUBLIC_PASSENGER_FERRY_EPOCH_MS,40,now,false));
 });
 it('uses HQ orientation identical to the visible ferry marker',()=>{
  expect(ferryStartsAtFrom([23,37],[24,38],[23.01,37])).toBe(true);
  expect(ferryStartsAtFrom([23,37],[24,38],[23.99,38])).toBe(false);
  expect(ferryStartsAtFrom([23,37],[24,38])).toBe(true);
 });
 it('shows a ferry badge while a vehicle waits rather than a sleeping icon',()=>{
  const vehicle={
   id:'explorer',kind:'explorer',name:'Explorer',driver:'Autonomous',
   position:[23,37],status:'PAUSED',path:[],edgeIds:[],leg:0,
   distanceIntoLeg:0,fare:0,completed:0,
   ferryTrip:{stage:'waiting',routeId:'route',fromPortId:'a',
    toPortId:'b',geometry:[[23,37],[24,38]],destination:[24,38],
    durationGameMs:75*minute,ticketEuros:20},
  } as Taxi;
  expect(vehicleActivity(vehicle)).toMatchObject({icon:'⛴️',label:'Waiting at harbour for scheduled ferry'});
  expect(vehicleActivity({...vehicle,ferryTrip:{...vehicle.ferryTrip!,stage:'sailing'}}).label)
   .toBe('Travelling aboard ferry');
 });
});
