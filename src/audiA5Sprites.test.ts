import {describe,it,expect} from 'vitest';
import {
 AUDI_A5_PAINT_SPRITES,AUDI_A5_SPRITE_WIDTH,AUDI_A5_SPRITE_HEIGHT,
 AUDI_A5_ATLAS_COLUMNS,audiA5MapSpriteUrl,audiA5PreviewSpriteUrl,audiA5PaintForConfigurator,
 audiA5PaintForVehicle,audiA5SpriteUrl,isAudiA5Avant,
} from './audiA5Sprites';
import {EUROPEAN_MODELS,paintChoices,configuredOffer} from './europeanVehicleCatalog';

describe('Audi A5 Avant official paint sprite integration',()=>{
 const model=EUROPEAN_MODELS.find(m=>m.brand==='Audi'&&m.name==='A5 Avant e-hybrid');
 it('has nine distinct, correctly indexed transparent PNG crop slots',()=>{
  expect(AUDI_A5_PAINT_SPRITES).toHaveLength(9);
  expect(new Set(AUDI_A5_PAINT_SPRITES.map(p=>p.id)).size).toBe(9);
  expect(AUDI_A5_PAINT_SPRITES.map(p=>p.index)).toEqual([0,1,2,3,4,5,6,7,8]);
  expect(AUDI_A5_ATLAS_COLUMNS*AUDI_A5_SPRITE_WIDTH).toBe(720);
  expect(AUDI_A5_SPRITE_HEIGHT).toBe(170);
 });
 it('maps all nine existing dealership paint IDs without changing any prices',()=>{
  expect(model).toBeDefined();
  const paints=paintChoices(model!,2027,'220 kW quattro');
  for(const sprite of AUDI_A5_PAINT_SPRITES){
   const existing=paints.find(p=>p.id===sprite.id);
   expect(existing).toBeDefined();
   expect(existing?.name).toBe(sprite.name);
   expect(audiA5PaintForConfigurator('Audi','A5 Avant e-hybrid',sprite.id))
    .toEqual(sprite);
  }
  expect(audiA5PaintForConfigurator('Audi','A5 Limousine e-hybrid','audi-a5-paint-2')).toBeNull();
  expect(audiA5PaintForConfigurator('Volvo','A5 Avant e-hybrid','audi-a5-paint-2')).toBeNull();
 });
 it('matches a purchased A5 Avant with the saved paint option before HEX',()=>{
  const offer=configuredOffer(model!,2027,[],'220 kW quattro',
   'audi-a5-avant-220','audi-a5-paint-7',undefined);
  expect(offer.optionIds).toContain('paint:audi-a5-paint-7');
  expect(audiA5PaintForVehicle(offer.model,offer.optionIds,offer.paintHex)?.id)
   .toBe('audi-a5-paint-7');
  expect(isAudiA5Avant(offer.model)).toBe(true);
 });
 it('supports older saved vehicles with only paint HEX and missing optional fields',()=>{
  expect(audiA5PaintForVehicle('Audi A5 Avant e-hybrid',undefined,'#15171b')?.id)
   .toBe('audi-a5-paint-2');
  expect(audiA5PaintForVehicle('Audi A5 Avant e-hybrid',undefined,undefined)?.id)
   .toBe('audi-a5-paint-0');
  expect(audiA5PaintForVehicle('Audi A5 Avant e-hybrid',undefined,'#001122')).toBeNull();
 });
 it('does not misapply these sprites to A5 saloon, other cars or custom paints',()=>{
  expect(audiA5PaintForVehicle('Audi A5 Limousine e-hybrid',
   ['paint:audi-a5-paint-7'],'#8E2633')).toBeNull();
  expect(audiA5PaintForVehicle('Audi A5 Avant e-hybrid',
   ['paint:audi-a5-paint-8'],'#214B83')).toBeNull();
  expect(audiA5PaintForVehicle('Audi A5 Avant e-hybrid',
   ['paint:audi-a5-paint-10'],'#777777')).toBeNull();
  expect(audiA5PaintForVehicle('Volvo V60',undefined,'#15171B')).toBeNull();
  expect(isAudiA5Avant('Audi A5 Avant e-hybrid 2.0 TFSI e-hybrid 299 hp 7-speed S tronic')).toBe(true);
 });
 it('uses real static PNG URLs, not browser canvas or runtime recolouring',async()=>{
  for(const sprite of AUDI_A5_PAINT_SPRITES){
   const map=audiA5MapSpriteUrl(sprite.id);
   const preview=audiA5PreviewSpriteUrl(sprite.id);
   expect(map).toContain('/assets/vehicles/audi-a5-avant/'+sprite.slug+'.png');
   expect(preview).toContain('/assets/vehicles/audi-a5-avant/'+sprite.slug+'-preview.png');
   expect(await audiA5SpriteUrl(sprite.id)).toBe(map);
   expect(await audiA5SpriteUrl(sprite.id,'preview')).toBe(preview);
  }
  expect(await audiA5SpriteUrl('unsupported')).toBeNull();
 });
});
