import {describe,it,expect} from 'vitest';
import {
 BRANDS,EUROPEAN_MODELS,DEALERSHIP_MODEL_ALLOWLIST,
 isDealershipModelAllowed,vehicleConfiguration,verifiedVariants,
 type VehicleModel,
} from './europeanVehicleCatalog';
import {OFFERS} from './dealership';

const key=(m:{brand:string;name:string})=>m.brand+'|'+m.name;
const permitted=[
 'Toyota|Corolla Touring Sports',
 'Skoda|Superb Combi',
 'Skoda|Octavia Combi',
 'Audi|A5 Avant e-hybrid',
 'Audi|A6 Avant e-hybrid',
 'Audi|Q7 SUV TFSI e',
 'Audi|Q9 SUV',
 'Volvo|XC90',
 'Volvo|XC60',
 'Volvo|V60',
];
const retired=[
 'Toyota|Corolla Saloon',
 'Toyota|RAV4 Hybrid',
 'Skoda|Superb',
 'Skoda|Octavia',
 'Skoda|Kodiaq',
 'Audi|A5 Limousine e-hybrid',
 'Audi|A6 Limousine e-hybrid',
];
describe('Estate-only dealership inventory',()=>{
 it('allows exactly the estates and the Volvo/Audi SUV exceptions requested',()=>{
  expect(EUROPEAN_MODELS).toHaveLength(10);
  expect(new Set(EUROPEAN_MODELS.map(key))).toEqual(new Set(permitted));
  expect(new Set(DEALERSHIP_MODEL_ALLOWLIST)).toEqual(new Set(permitted));
  expect(EUROPEAN_MODELS.every(isDealershipModelAllowed)).toBe(true);
 });
 it('keeps all three Volvo models, the Q7/Q9 and both Octavia/Superb Combi estates',()=>{
  expect(EUROPEAN_MODELS.filter(m=>m.brand==='Volvo').map(m=>m.name).sort())
   .toEqual(['V60','XC60','XC90']);
  expect(EUROPEAN_MODELS.filter(m=>m.brand==='Skoda').map(m=>m.name).sort())
   .toEqual(['Octavia Combi','Superb Combi']);
  expect(EUROPEAN_MODELS.filter(m=>m.brand==='Toyota').map(m=>m.name))
   .toEqual(['Corolla Touring Sports']);
  expect(EUROPEAN_MODELS.filter(m=>m.brand==='Audi').map(m=>m.name).sort())
   .toEqual(['A5 Avant e-hybrid','A6 Avant e-hybrid','Q7 SUV TFSI e','Q9 SUV']);
  expect(BRANDS).toEqual(['Toyota','Audi','Skoda','Volvo']);
 });
 it('never offers standard saloons, limousines or other SUVs',()=>{
  for(const name of retired){
   const [brand,model]=name.split('|');
   expect(EUROPEAN_MODELS.some(m=>key(m)===name)).toBe(false);
   expect(isDealershipModelAllowed({brand,name:model})).toBe(false);
  }
 });
 it('retires the old generic marketplace without deleting owned taxis',()=>{
  expect(OFFERS).toEqual([]);
 });
 it('does not remove historical vehicle configs or engine variants for old saves',()=>{
  for(const compound of retired){
   const [brand,name]=compound.split('|');
   const model:VehicleModel={brand,name,segment:'Comfort',basePrice:0,seats:5,
    fuel:'Petrol',years:[name.includes('Q7')?2026:2027]};
   // Configuration data is intentionally retained even when the model is
   // hidden from the current showroom.
   const year=compound==='Toyota|Corolla Saloon'||compound==='Toyota|RAV4 Hybrid'?2026:2027;
   expect(vehicleConfiguration(model,year),compound).toBeDefined();
   expect(verifiedVariants(model,year).length,compound).toBeGreaterThan(0);
  }
 });
});
