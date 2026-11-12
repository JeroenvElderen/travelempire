import {describe,expect,it} from 'vitest';
import {assignPoiHarbours,poiRouteCandidates} from './poiMissions';
import type {Taxi} from '../simulation/taxi';
import type {FerryPort} from './ferries';
const port=(id:string,x:number):FerryPort=>({id,name:id,position:[x,38]});
const scout=(id:string,x=24,assigned?:string):Taxi=>({
 id,name:id,driver:'Autonomous',kind:'explorer',explorerRole:'poi',
 position:[x,38],status:'IDLE',path:[],edgeIds:[],leg:0,
 distanceIntoLeg:0,fare:0,completed:0,poiTargetId:assigned
});
describe('nationwide harbour scout missions',()=>{
 it('assigns all ports, including targets beyond the former first 150',()=>{
  const ports=Array.from({length:160},(_,i)=>port('port-'+i,20+i*.01));
  const result=assignPoiHarbours([scout('poi-1',21.59)],ports,new Set(ports.slice(0,159).map(p=>p.id)));
  expect(result.missions).toHaveLength(1);
  expect(result.missions[0].portId).toBe('port-159');
 });
 it('keeps existing assignments across repeated dispatches',()=>{
  const first=assignPoiHarbours([scout('poi-1',24,'far')],[port('near',24),port('far',25)],new Set());
  const second=assignPoiHarbours(first.taxis,[port('near',24),port('far',25)],new Set());
  expect(first.missions[0].portId).toBe('far');
  expect(second.changed).toBe(false);
 });
 it('reserves unique destinations and reallocates only when a port unlocks',()=>{
  const ports=[port('a',24.01),port('b',24.02),port('c',24.03)];
  const first=assignPoiHarbours([scout('one'),scout('two')],ports,new Set());
  expect(new Set(first.missions.map(m=>m.portId)).size).toBe(2);
  const second=assignPoiHarbours(first.taxis,ports,new Set([first.missions[0].portId]));
  expect(second.missions[0].portId).not.toBe(first.missions[0].portId);
  expect(second.missions).toHaveLength(2);
 });
 it('offers alternate harbours beyond nearby unreachable island ports',()=>{
  const ports=Array.from({length:130},(_,i)=>port('port-'+i,24+i*.01));
  const result=poiRouteCandidates([scout('poi-1',24,'port-0')],ports,new Set(),14);
  expect(result.length).toBe(14);
  expect(result[0].portId).toBe('port-0');
  expect(result.some(m=>m.portId==='port-24')).toBe(true);
  expect(result.some(m=>m.portId==='port-49')).toBe(true);
 });
 it('does not offer harbours assigned to another explorer',()=>{
  const ports=[port('a',24),port('b',24.1),port('c',24.2),port('d',24.3)];
  const result=poiRouteCandidates([scout('one',24,'a'),scout('two',24.1,'b')],ports,new Set());
  expect(result.filter(m=>m.vehicleId==='one').some(m=>m.portId==='b')).toBe(false);
  expect(result.filter(m=>m.vehicleId==='two').some(m=>m.portId==='a')).toBe(false);
 });
 it('never gives passenger taxis a harbour assignment',()=>{
  const taxi={...scout('taxi'),kind:'taxi' as const,explorerRole:undefined};
  const result=assignPoiHarbours([taxi],[port('a',24)],new Set());
  expect(result.missions).toHaveLength(0);
  expect(result.taxis[0].poiTargetId).toBeUndefined();
 });
});
