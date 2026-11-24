import {describe,it,expect} from 'vitest';
import {lockedFeature,vehicleResearchLock,upgradeResearchLock} from './researchUnlocks';
import {empty} from './research';
describe('research action gates',()=>{
 it('gates existing companies but retains starter graduation',()=>{
  expect(lockedFeature('Dealership',false,empty())).toBeNull();
  expect(lockedFeature('Dealership',true,empty())).not.toBeNull();
  expect(lockedFeature('Ferries',false,empty())).not.toBeNull();
  expect(lockedFeature('Ferries',false,{levels:{portAnalytics:1}})).toBeNull();
  expect(lockedFeature('Fleet',false,empty())).toBeNull();
 });
 it('gates premium and alternative fuel purchases',()=>{
  expect(vehicleResearchLock(empty(),{className:'Economy',fuel:'Petrol'})).toBeNull();
  expect(vehicleResearchLock(empty(),{className:'Premium',fuel:'Petrol'})).not.toBeNull();
  expect(vehicleResearchLock({levels:{premium:1}},{className:'Premium',fuel:'Petrol'})).toBeNull();
  expect(vehicleResearchLock({levels:{engine:2}},{className:'Standard',fuel:'Electric'})).toBeNull();
 });
 it('gates operating upgrades',()=>{
  expect(upgradeResearchLock(empty(),'dispatch')).not.toBeNull();
  expect(upgradeResearchLock({levels:{dispatchResearch:1}},'dispatch')).toBeNull();
 });
});
