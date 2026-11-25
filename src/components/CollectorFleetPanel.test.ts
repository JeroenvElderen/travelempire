import {describe,it,expect} from 'vitest';
import {collectorStatus} from './CollectorFleetPanel';
import type {CollectorVehicle,CollectorTrip} from '../resourceCollectors';
const v:CollectorVehicle={id:'test',model:'light',trips:0,offset:0,distanceKm:0};
const trip:CollectorTrip={path:[[23,38],[23.01,38],[23,38]],outboundMetres:800,distance:1600,startedAt:0,endsAt:1000,part:'mechanical',quantity:12};
describe('collector fleet status labels',()=>{
 it('distinguishes active, pause pending, parked, service and waiting',()=>{
  expect(collectorStatus({...v,trip},0)).toBe('Collecting');
  expect(collectorStatus({...v,trip,paused:true},0)).toBe('Finishing route before pause');
  expect(collectorStatus({...v,paused:true},0)).toBe('Paused at depot');
  expect(collectorStatus({...v,serviceUntil:1000},0)).toBe('Servicing');
  expect(collectorStatus({...v,waitingReason:'Insufficient operating cash'},0)).toBe('Insufficient operating cash');
  expect(collectorStatus(v,0)).toBe('Awaiting dispatch');
 });
});
