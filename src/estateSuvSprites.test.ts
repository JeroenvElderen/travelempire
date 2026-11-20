import {describe,it,expect} from 'vitest';
import {EUROPEAN_MODELS,paintChoices,trimChoices} from './europeanVehicleCatalog';
import {
 ESTATE_SUV_PAINTS,ESTATE_SUV_COLUMNS,ESTATE_SUV_ROWS,
 estateSuvModelForVehicle,estateSuvPaintForConfigurator,
 estateSuvPaintForVehicle,estateSuvPaintById,estateSuvSpriteUrl,
} from './estateSuvSprites';
const cases=[
 ['Audi','Q7 SUV TFSI e','q7',12],
 ['Audi','Q9 SUV','q9',10],
 ['Volvo','XC60','xc60',8],
 ['Volvo','V60','v60',8],
 ['Volvo','XC90','xc90',9],
] as const;
describe('Q7 Q9 Volvo PNG paint support',()=>{
 it('covers five models with separate paint rows',()=>{
  expect(ESTATE_SUV_PAINTS).toHaveLength(47);
  expect(ESTATE_SUV_COLUMNS).toBe(12);
  expect(ESTATE_SUV_ROWS).toBe(5);
  for(const [brand,name,key,count] of cases){
   const group=ESTATE_SUV_PAINTS.filter(p=>p.model===key);
   expect(group.length).toBe(count);
   expect(new Set(group.map(p=>p.column)).size).toBe(count);
   expect(new Set(group.map(p=>p.row)).size).toBe(1);
   expect(estateSuvModelForVehicle(brand+' '+name)).toBe(key);
   expect(estateSuvModelForVehicle(brand+' '+name+' T6 AWD Automatic')).toBe(key);
  }
 });
 it('matches factory paint IDs without changing prices or trims',()=>{
  for(const [brand,name,key] of cases){
   const model=EUROPEAN_MODELS.find(m=>m.brand===brand&&m.name===name)!;
   expect(model).toBeTruthy();
   const options=paintChoices(model,model.years[0],trimChoices(model,model.years[0])[0]);
   for(const choice of options){
    const sprite=estateSuvPaintForConfigurator(brand,name,choice.id);
    if(sprite){
     expect(sprite.model).toBe(key);
     expect(sprite.name).toBeTruthy();
     expect(estateSuvPaintById(sprite.id)).toBe(sprite);
    }else{
     expect(choice.id).toBe('audi-q9-paint-10');
    }
   }
  }
 });
 it('reuses saved paint IDs including XC90 Black Edition aliases',()=>{
  expect(estateSuvPaintForVehicle('Volvo XC90 T8 Hybrid',['paint:xc90-paint-3-black'],'#354A65')?.id).toBe('xc90-paint-3');
  expect(estateSuvPaintForVehicle('Volvo XC90 T8 Hybrid',['paint:xc90-paint-onyx-black-edition'],undefined)?.id).toBe('xc90-paint-2');
  expect(estateSuvPaintForVehicle('Audi Q7 SUV TFSI e',['paint:q7-tfsi-paint-5'],'#17191D')?.id).toBe('q7-tfsi-paint-5');
  expect(estateSuvPaintForVehicle('Audi Q9 SUV 3.0',['paint:audi-q9-paint-10'],'#777777')).toBeNull();
 });
 it('does not substitute another model for an unmatched paint',()=>{
  expect(estateSuvPaintById('audi-q9-paint-10')).toBeNull();
  expect(estateSuvPaintForVehicle('Audi A5 Avant e-hybrid',['paint:audi-q9-paint-1'],undefined)).toBeNull();
  expect(estateSuvPaintForConfigurator('Audi','A6 Avant e-hybrid','q7-tfsi-paint-0')).toBeNull();
  expect(estateSuvPaintForConfigurator('Volvo','XC60','xc90-paint-0')).toBeNull();
 });
 it('does not crash when canvas is unavailable',async()=>{
  expect(await estateSuvSpriteUrl('unknown-id')).toBeNull();
 });
});
