import {describe,expect,it} from 'vitest';
import {regionalTrafficFactor,urbanTrafficIntensity,setTrafficIncidents,incidentTrafficFactor,trafficLevel} from './trafficConditions';
const athens:[number,number]=[23.7275,37.9838],rural:[number,number]=[21.1,37.2];
describe('regional traffic without civilian vehicles',()=>{
 it('has heavier weekday morning congestion near Athens than in rural areas',()=>{
  const at=Date.parse('2026-11-16T06:30:00Z');
  expect(urbanTrafficIntensity(athens)).toBeGreaterThan(urbanTrafficIntensity(rural));
  expect(regionalTrafficFactor(40,at,athens)).toBeLessThan(regionalTrafficFactor(40,at,rural));
  expect(['Moderate','Heavy']).toContain(trafficLevel(40,at,athens));
 });
 it('has better flow during quiet hours',()=>{
  const rush=Date.parse('2026-11-16T06:30:00Z'),quiet=Date.parse('2026-11-16T01:30:00Z');
  expect(regionalTrafficFactor(40,rush,athens)).toBeLessThan(regionalTrafficFactor(40,quiet,athens));
 });
 it('incidents delay only the identified road and expire on the game clock',()=>{
  const at=Date.parse('2026-11-16T08:00:00Z');
  setTrafficIncidents([{roadId:'edge-1',kind:'collision',startedAt:at,endsAt:at+1800000}]);
  expect(incidentTrafficFactor('edge-1',at)).toBeLessThan(incidentTrafficFactor('edge-2',at));
  expect(incidentTrafficFactor('edge-1',at+3600000)).toBe(1);
  setTrafficIncidents([]);
 });
});