import {describe,expect,it} from 'vitest';
import {configuredOffer,EUROPEAN_MODELS,paintChoices} from './europeanVehicleCatalog';
import {
 TOYOTA_COROLLA_PAINT_SPRITES,TOYOTA_COROLLA_ATLAS_COLUMNS,
 TOYOTA_COROLLA_SPRITE_WIDTH,TOYOTA_COROLLA_SPRITE_HEIGHT,
 toyotaCorollaPaintById,toyotaCorollaPaintForConfigurator,
 toyotaCorollaPaintForVehicle,toyotaCorollaAtlasUrl,
 toyotaCorollaSpriteUrl,isToyotaCorollaTouringSports,
} from './toyotaCorollaSprites';
import {audiA5PaintForVehicle} from './audiA5Sprites';
import {skodaOctaviaPaintForVehicle} from './skodaOctaviaSprites';
const touring=EUROPEAN_MODELS.find(m=>m.brand==='Toyota'&&m.name==='Corolla Touring Sports')!;
describe('Toyota Corolla Touring Sports PNG integration',()=>{
 it('has ten one-to-one paint sprites sharing one nose-up transparent PNG atlas',()=>{
  expect(TOYOTA_COROLLA_PAINT_SPRITES).toHaveLength(10);
  expect(TOYOTA_COROLLA_PAINT_SPRITES.map(p=>p.index)).toEqual(
   Array.from({length:10},(_,i)=>i));
  expect(new Set(TOYOTA_COROLLA_PAINT_SPRITES.map(p=>p.id)).size).toBe(10);
  expect(TOYOTA_COROLLA_SPRITE_WIDTH*TOYOTA_COROLLA_ATLAS_COLUMNS).toBe(800);
  expect(TOYOTA_COROLLA_SPRITE_HEIGHT).toBe(170);
  expect(toyotaCorollaAtlasUrl()).toContain(
   '/assets/vehicles/toyota-corolla-touring-sports/paint-atlas.png');
 });
 it('shows exactly six standard shades for Luna/Sol and four black-roof GR SPORT variants',()=>{
  expect(touring).toBeDefined();
  for(const trim of ['Luna','Sol']){
   const available=paintChoices(touring,2027,trim);
   expect(available).toHaveLength(6);
   expect(available.every(p=>toyotaCorollaPaintById(p.id)?.twoTone===false)).toBe(true);
  }
  const sport=paintChoices(touring,2027,'GR SPORT');
  expect(sport).toHaveLength(4);
  expect(sport.every(p=>toyotaCorollaPaintById(p.id)?.twoTone===true)).toBe(true);
  expect(TOYOTA_COROLLA_PAINT_SPRITES.filter(p=>p.twoTone)).toHaveLength(4);
 });
 it('connects all ten existing manufacturer option IDs and retains individual paint prices',()=>{
  for(const trim of ['Luna','Sol','GR SPORT']){
   for(const paint of paintChoices(touring,2027,trim)){
    const found=toyotaCorollaPaintForConfigurator('Toyota','Corolla Touring Sports',paint.id);
    expect(found?.id).toBe(paint.id);
    const offer=configuredOffer(touring,2027,[],trim,undefined,paint.id);
    expect(offer.optionIds).toContain('paint:'+paint.id);
    expect(toyotaCorollaPaintForVehicle(offer.model,offer.optionIds,offer.paintHex)?.id)
     .toBe(paint.id);
   }
  }
 });
 it('prefers saved paint option IDs over shared metallic HEX for two-tone models',()=>{
  const saved=['paint:corolla-ts-paint-8'];
  expect(toyotaCorollaPaintForVehicle('Toyota Corolla Touring Sports',saved,'#9F2530')?.id)
   .toBe('corolla-ts-paint-8');
  expect(toyotaCorollaPaintForVehicle('Toyota Corolla Touring Sports',undefined,'#9f2530')?.id)
   .toBe('corolla-ts-paint-4');
  expect(toyotaCorollaPaintForVehicle('Toyota Corolla Touring Sports',undefined,undefined)?.id)
   .toBe('corolla-ts-paint-0');
 });
 it('never replaces artwork on the Corolla saloon, other models or unknown paints',()=>{
  expect(toyotaCorollaPaintForVehicle('Toyota Corolla Saloon',undefined,'#9F2530')).toBeNull();
  expect(toyotaCorollaPaintForVehicle('Audi A5 Avant e-hybrid',undefined,'#9F2530')).toBeNull();
  expect(toyotaCorollaPaintForConfigurator('Toyota','Corolla Saloon','corolla-ts-paint-0')).toBeNull();
  expect(toyotaCorollaPaintForVehicle('Toyota Corolla Touring Sports',['paint:unknown'],undefined)).toBeNull();
  expect(toyotaCorollaPaintForVehicle('Toyota Corolla Touring Sports',undefined,'#123456')).toBeNull();
  expect(audiA5PaintForVehicle('Toyota Corolla Touring Sports',undefined,undefined)).toBeNull();
  expect(skodaOctaviaPaintForVehicle('Toyota Corolla Touring Sports',undefined,undefined)).toBeNull();
  expect(isToyotaCorollaTouringSports('Toyota Corolla Touring Sports 2027')).toBe(true);
  expect(isToyotaCorollaTouringSports('Toyota Corolla Saloon')).toBe(false);
 });
 it('safely falls back if no Image/canvas is present',async()=>{
  expect(await toyotaCorollaSpriteUrl('not-a-paint')).toBeNull();
  expect(await toyotaCorollaSpriteUrl('corolla-ts-paint-0')).toBeNull();
 });
});
