import {describe,it,expect} from 'vitest';
import {lockedFeature,vehicleResearchLock,upgradeResearchLock,dealershipModelAvailable} from './researchUnlocks';
import {empty} from './research';
import {EUROPEAN_MODELS,configuredOffer,trimChoices} from './europeanVehicleCatalog';
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


it('opens exactly the two cheapest catalogue models at starter level 2 and the full catalogue at level 5',()=>{
 const names=(level:number)=>EUROPEAN_MODELS.filter(m=>dealershipModelAvailable(m,level)).map(m=>m.brand+' '+m.name).sort();
 expect(names(1)).toEqual([]);
 expect(names(2)).toEqual(['Skoda Octavia Combi','Toyota Corolla Touring Sports']);
 expect(names(4)).toEqual(names(2));
 expect(names(5)).toHaveLength(EUROPEAN_MODELS.length);
 expect(lockedFeature('Dealership',true,{...empty(),starterLevel:1})).not.toBeNull();
 expect(lockedFeature('Dealership',true,{...empty(),starterLevel:2})).toBeNull();
});
it('enforces the same model gates for configured orders, including the starter Corolla hybrid',()=>{
 for(const model of EUROPEAN_MODELS){
  const year=model.years[0];
  const offer=configuredOffer(model,year,[],trimChoices(model,year)[0]);
  const state={...empty(),starterLevel:2};
  expect(vehicleResearchLock({...state,starterLevel:1},offer,true)).not.toBeNull();
  if(dealershipModelAvailable(model,2)){
   if(offer.fuel==='Petrol'||offer.fuel==='Diesel'||model.brand==='Toyota')expect(vehicleResearchLock(state,offer,true)).toBeNull();
  }else expect(vehicleResearchLock(state,offer,true)).toContain('Starter Level 5');
 }
 const corolla={id:'Toyota-Corolla Touring Sports-2027-base',model:'Toyota Corolla Touring Sports Hybrid',className:'Standard',fuel:'Hybrid'};
 expect(vehicleResearchLock({...empty(),starterLevel:5},corolla,true)).toBeNull();
 expect(vehicleResearchLock({...empty(),starterLevel:2},{...corolla,id:'Audi-A5 Avant e-hybrid-2027-base',model:'Audi A5 Avant e-hybrid'},true)).not.toBeNull();
});
