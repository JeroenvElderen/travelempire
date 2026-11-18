import {describe,it,expect} from 'vitest';
import {configuredOffer,EUROPEAN_MODELS,paintChoices} from './europeanVehicleCatalog';
import {
 SKODA_OCTAVIA_PAINT_SPRITES,SKODA_OCTAVIA_ATLAS_COLUMNS,
 SKODA_OCTAVIA_SPRITE_WIDTH,SKODA_OCTAVIA_SPRITE_HEIGHT,
 SKODA_PHOENIX_PAINT_ID,skodaOctaviaAtlasUrl,
 skodaOctaviaPaintForVehicle,skodaOctaviaPaintByOptionId,
 skodaOctaviaPaintForConfigurator,skodaOctaviaSpriteUrl,
 isSkodaOctaviaCombi,
} from './skodaOctaviaSprites';
import {audiA5PaintForVehicle} from './audiA5Sprites';
import {audiA6PaintForVehicle} from './audiA6Sprites';

const combi=EUROPEAN_MODELS.find(m=>m.brand==='Skoda'&&m.name==='Octavia Combi')!;
// Historical metadata remains readable, but the Octavia saloon is no longer in the showroom.
const saloon={...combi,name:'Octavia'};
describe('Octavia Combi PNG integration',()=>{
 it('has all ten original factory shades and one explicitly game-only orange',()=>{
  expect(SKODA_OCTAVIA_PAINT_SPRITES).toHaveLength(11);
  expect(SKODA_OCTAVIA_PAINT_SPRITES.map(p=>p.index)).toEqual(
   Array.from({length:11},(_,i)=>i));
  expect(SKODA_OCTAVIA_PAINT_SPRITES.filter(p=>p.factory)).toHaveLength(10);
  expect(SKODA_OCTAVIA_PAINT_SPRITES.filter(p=>!p.factory).map(p=>p.name))
   .toEqual(['Phoenix Orange (TravelEmpire custom)']);
  expect(SKODA_OCTAVIA_SPRITE_WIDTH*SKODA_OCTAVIA_ATLAS_COLUMNS).toBe(616);
  expect(SKODA_OCTAVIA_SPRITE_HEIGHT).toBe(119);
  expect(skodaOctaviaAtlasUrl()).toContain('/assets/vehicles/skoda-octavia-combi/paint-atlas.png');
 });
 it('preserves trim-specific factory paint codes and price amounts',()=>{
  for(const trim of ['Selection','Selection+','Heritage','Sportline','RS']){
   const paints=paintChoices(combi,2027,trim);
   expect(paints.some(p=>p.id===SKODA_PHOENIX_PAINT_ID)).toBe(true);
   const known=paints.filter(p=>p.id.startsWith('oct27-paint-')&&p.id!==SKODA_PHOENIX_PAINT_ID);
   for(const paint of known)
    expect(skodaOctaviaPaintForConfigurator('Skoda','Octavia Combi',paint.id),paint.id).not.toBeNull();
   if(trim==='RS')expect(paints.some(p=>p.name==='Mamba Green')).toBe(true);
   else expect(paints.some(p=>p.name==='Mamba Green')).toBe(false);
  }
  expect(paintChoices(saloon,2027,'Selection').some(p=>p.id===SKODA_PHOENIX_PAINT_ID)).toBe(false);
 });
 it('maps the purchased factory paint ID irrespective of selected grade suffix',()=>{
  const selection=paintChoices(combi,2027,'Selection');
  const race=selection.find(p=>p.name==='Race Blue Metallic')!;
  expect(skodaOctaviaPaintForConfigurator('Skoda','Octavia Combi',race.id)?.id).toBe('6');
  const offer=configuredOffer(combi,2027,[],'Selection',undefined,race.id);
  expect(offer.optionIds).toContain('paint:'+race.id);
  expect(skodaOctaviaPaintForVehicle(offer.model,offer.optionIds,offer.paintHex)?.slug).toBe('race-blue');
 });
 it('supports historical HEX-only saves, default paints and custom orange',()=>{
  expect(skodaOctaviaPaintForVehicle('Skoda Octavia Combi',undefined,'#8c2532')?.name)
   .toBe('Velvet Red Exclusive');
  expect(skodaOctaviaPaintForVehicle('Skoda Octavia Combi',undefined,undefined)?.id).toBe('0');
  expect(skodaOctaviaPaintForVehicle('Skoda Octavia Combi',['paint:'+SKODA_PHOENIX_PAINT_ID],undefined)?.slug)
   .toBe('phoenix-orange');
  expect(skodaOctaviaPaintByOptionId('oct27-paint-3-4')?.slug).toBe('mamba-green');
  expect(skodaOctaviaPaintForConfigurator('Skoda','Octavia Combi',SKODA_PHOENIX_PAINT_ID)?.index).toBe(10);
 });
 it('does not render wrong paint on saloon, unrelated cars or unknown custom colours',()=>{
  expect(skodaOctaviaPaintForConfigurator('Skoda','Octavia','oct27-paint-6-0')).toBeNull();
  expect(skodaOctaviaPaintForVehicle('Skoda Octavia',undefined,'#8c2532')).toBeNull();
  expect(skodaOctaviaPaintForVehicle('Audi A5 Avant e-hybrid',undefined,'#8c2532')).toBeNull();
  expect(skodaOctaviaPaintForVehicle('Skoda Octavia Combi',['paint:future-mystery'],undefined)).toBeNull();
  expect(skodaOctaviaPaintForVehicle('Skoda Octavia Combi',undefined,'#123456')).toBeNull();
  expect(audiA5PaintForVehicle('Skoda Octavia Combi',undefined,undefined)).toBeNull();
  expect(audiA6PaintForVehicle('Skoda Octavia Combi',undefined,undefined)).toBeNull();
  expect(isSkodaOctaviaCombi('Skoda Octavia Combi 2027')).toBe(true);
  expect(isSkodaOctaviaCombi('Skoda Octavia RS')).toBe(false);
 });
 it('falls back safely without canvas and rejects unknown paint IDs',async()=>{
  expect(await skodaOctaviaSpriteUrl('not-a-paint')).toBeNull();
  expect(await skodaOctaviaSpriteUrl('6')).toBeNull(); // Node test runner has no Image
 });
});
