import {describe,it,expect} from 'vitest';
import {configuredOffer,EUROPEAN_MODELS,paintChoices} from './europeanVehicleCatalog';
import {AUDI_A6_PAINT_SPRITES,AUDI_A6_ATLAS_COLUMNS,
 AUDI_A6_SPRITE_WIDTH,AUDI_A6_SPRITE_HEIGHT,
 audiA6PaintForVehicle,audiA6PaintForConfigurator,audiA6AtlasUrl,
 audiA6SpriteUrl,isAudiA6Avant} from './audiA6Sprites';
import {audiA5PaintForVehicle} from './audiA5Sprites';

const model=EUROPEAN_MODELS.find(m=>m.brand==='Audi'&&m.name==='A6 Avant e-hybrid')!;
describe('Audi A6 Avant PNG paint integration',()=>{
 it('has nine uniquely indexed A6 paints in a 504 × 119 PNG atlas',()=>{
  expect(AUDI_A6_PAINT_SPRITES).toHaveLength(9);
  expect(new Set(AUDI_A6_PAINT_SPRITES.map(s=>s.id)).size).toBe(9);
  expect(AUDI_A6_PAINT_SPRITES.map(s=>s.index)).toEqual([0,1,2,3,4,5,6,7,8]);
  expect(AUDI_A6_ATLAS_COLUMNS*AUDI_A6_SPRITE_WIDTH).toBe(504);
  expect(AUDI_A6_SPRITE_HEIGHT).toBe(119);
  expect(audiA6AtlasUrl()).toContain('/assets/vehicles/audi-a6-avant/paint-atlas.png');
 });
 it('retains all six factory-listed MY27 colours and explicitly labels three game-only colours',()=>{
  const paints=paintChoices(model,2027,'220 kW quattro');
  for(const sprite of AUDI_A6_PAINT_SPRITES){
   const option=paints.find(p=>p.id===sprite.id);
   expect(option, sprite.name).toBeDefined();
   if(sprite.index<=5){
    expect(option!.name.toLowerCase()).not.toContain('custom');
    expect(option!.price).toBe(sprite.index===0?0:1225);
   }else{
    expect(option!.name).toContain('TravelEmpire custom');
    expect(option!.price).toBe(6850);
   }
   expect(audiA6PaintForConfigurator('Audi','A6 Avant e-hybrid',sprite.id)?.id).toBe(sprite.id);
  }
  expect(audiA6PaintForConfigurator('Audi','A6 Limousine e-hybrid','audi-a6-paint-2')).toBeNull();
 });
 it('keeps Ascari Blue and the original unrestricted custom paint on SVG fallback',()=>{
  expect(audiA6PaintForVehicle('Audi A6 Avant e-hybrid',['paint:audi-a6-paint-6'],'#214B83')).toBeNull();
  expect(audiA6PaintForVehicle('Audi A6 Avant e-hybrid',['paint:audi-a6-paint-7'],'#777777')).toBeNull();
  expect(audiA6PaintForVehicle('Audi A6 Limousine e-hybrid',['paint:audi-a6-paint-2'],'#15171B')).toBeNull();
 });
 it('maps purchased paint options, older HEX saves and missing paints correctly',()=>{
  const offer=configuredOffer(model,2027,[],'220 kW quattro','audi-a6-avant-220','audi-a6-paint-10');
  expect(offer.optionIds).toContain('paint:audi-a6-paint-10');
  expect(audiA6PaintForVehicle(offer.model,offer.optionIds,offer.paintHex)?.id).toBe('audi-a6-paint-10');
  expect(audiA6PaintForVehicle('Audi A6 Avant e-hybrid',undefined,'#15171b')?.id).toBe('audi-a6-paint-2');
  expect(audiA6PaintForVehicle('Audi A6 Avant e-hybrid',undefined,undefined)?.id).toBe('audi-a6-paint-0');
  expect(audiA6PaintForVehicle('Audi A6 Avant e-hybrid',undefined,'#ffffff')).toBeNull();
 });
 it('never changes A5 mapping or other cars',()=>{
  expect(audiA5PaintForVehicle('Audi A6 Avant e-hybrid',['paint:audi-a6-paint-2'],'#15171B')).toBeNull();
  expect(audiA6PaintForVehicle('Audi A5 Avant e-hybrid',['paint:audi-a5-paint-2'],'#15171B')).toBeNull();
  expect(audiA6PaintForVehicle('Volvo V60',undefined,'#15171B')).toBeNull();
  expect(isAudiA6Avant('Audi A6 Avant e-hybrid 299 hp')).toBe(true);
  expect(isAudiA6Avant('Audi A6 Limousine e-hybrid')).toBe(false);
 });
 it('gracefully falls back without browser canvas or unsupported IDs',async()=>{
  expect(await audiA6SpriteUrl('audi-a6-paint-7')).toBeNull();
  expect(await audiA6SpriteUrl('unknown')).toBeNull();
  expect(await audiA6SpriteUrl('audi-a6-paint-1')).toBeNull(); // vitest Node has no Image
 });
});
