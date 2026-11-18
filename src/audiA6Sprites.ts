/** Audi A6 Avant paint sprites built from the user's nine transparent car PNGs.
 * The factory MY27 A6 paints match the original catalog IDs; three
 * additional TravelEmpire custom finishes use explicitly new IDs.
 * This atlas is deliberately separate from A5. No vehicle save migration.
 */
import type {AudiPaintSprite} from './audiA5Sprites';
export const AUDI_A6_PAINT_SPRITES:readonly AudiPaintSprite[]=[
 {id:'audi-a6-paint-0',name:'Arkona White',hex:'#E8E9E8',index:0,slug:'arkona-white'},
 {id:'audi-a6-paint-1',name:'Glacier White Metallic',hex:'#E8E9E5',index:1,slug:'glacier-white'},
 {id:'audi-a6-paint-2',name:'Mythos Black Metallic',hex:'#15171B',index:2,slug:'mythos-black'},
 {id:'audi-a6-paint-3',name:'Firmament Blue Metallic',hex:'#273D54',index:3,slug:'firmament-blue'},
 {id:'audi-a6-paint-4',name:'Florett Silver Metallic',hex:'#B9BEC3',index:4,slug:'floret-silver'},
 {id:'audi-a6-paint-5',name:'Daytona Grey Pearl Effect',hex:'#666A70',index:5,slug:'daytona-grey'},
 {id:'audi-a6-paint-8',name:'Plateau Grey Metallic (game custom)',hex:'#7C858B',index:6,slug:'plateau-grey'},
 {id:'audi-a6-paint-9',name:'Horizon Blue Metallic (game custom)',hex:'#597E94',index:7,slug:'horizon-blue'},
 {id:'audi-a6-paint-10',name:'Grenadine Red Metallic (game custom)',hex:'#8E2633',index:8,slug:'grenadine-red'},
];
export const AUDI_A6_ATLAS_COLUMNS=9;
export const AUDI_A6_SPRITE_WIDTH=56;
export const AUDI_A6_SPRITE_HEIGHT=119;
const BY_ID=new Map(AUDI_A6_PAINT_SPRITES.map(p=>[p.id,p]));
const BY_HEX=new Map(AUDI_A6_PAINT_SPRITES.map(p=>[p.hex.toUpperCase(),p]));
export const isAudiA6Avant=(model:string|undefined):boolean=>
 typeof model==='string'&&/^Audi A6 Avant(?: e-hybrid)?(?:\s|$)/i.test(model);
export function audiA6PaintForVehicle(
 model:string|undefined,optionIds:readonly string[]|undefined,paintHex:string|undefined,
):AudiPaintSprite|null{
 if(!isAudiA6Avant(model))return null;
 const saved=optionIds?.find(o=>o.startsWith('paint:'));
 if(saved)return BY_ID.get(saved.slice(6))??null;
 if(paintHex)return BY_HEX.get(paintHex.toUpperCase())??null;
 return BY_ID.get('audi-a6-paint-0')??null;
}
export function audiA6PaintForConfigurator(
 brand:string,name:string,paintId:string|undefined,
):AudiPaintSprite|null{
 if(brand!=='Audi'||name!=='A6 Avant e-hybrid')return null;
 return BY_ID.get(paintId??'audi-a6-paint-0')??null;
}
export function audiA6AtlasUrl():string{
 return `${import.meta.env.BASE_URL??'/'}assets/vehicles/audi-a6-avant/paint-atlas.png`;
}
let loaded:Promise<HTMLImageElement>|null=null;
const imageCache=new Map<string,Promise<string|null>>();
function loadAtlas():Promise<HTMLImageElement>{
 if(loaded)return loaded;
 const pending=new Promise<HTMLImageElement>((resolve,reject)=>{
  const img=new Image();
  img.onload=()=>resolve(img);
  img.onerror=()=>reject(new Error('Audi A6 PNG atlas failed to load'));
  img.src=audiA6AtlasUrl();
 }).catch(error=>{loaded=null;throw error;});
 loaded=pending;
 return pending;
}
/** Cache one 80 × 170 PNG crop per actual paint.
 * The dealership previews and MapLibre sprites reuse the same result.
 * Unsupported, custom factory and older unknown colours retain normal SVGs.
 */
export function audiA6SpriteUrl(id:string):Promise<string|null>{
 const item=BY_ID.get(id);
 if(!item||typeof Image==='undefined'||typeof document==='undefined')
  return Promise.resolve(null);
 const hit=imageCache.get(id);
 if(hit)return hit;
 const promise=loadAtlas().then(atlas=>{
  if(atlas.naturalWidth!==AUDI_A6_ATLAS_COLUMNS*AUDI_A6_SPRITE_WIDTH||
    atlas.naturalHeight!==AUDI_A6_SPRITE_HEIGHT)
   throw Error('Audi A6 atlas is missing or mismatched');
  const canvas=document.createElement('canvas');
  canvas.width=AUDI_A6_SPRITE_WIDTH;canvas.height=AUDI_A6_SPRITE_HEIGHT;
  const ctx=canvas.getContext('2d');
  if(!ctx)return null;
  ctx.drawImage(atlas,item.index*AUDI_A6_SPRITE_WIDTH,0,
   AUDI_A6_SPRITE_WIDTH,AUDI_A6_SPRITE_HEIGHT,
   0,0,AUDI_A6_SPRITE_WIDTH,AUDI_A6_SPRITE_HEIGHT);
  return canvas.toDataURL('image/png');
 }).catch(error=>{
  imageCache.delete(id);
  console.warn('[TravelEmpire] Audi A6 sprite unavailable',error);
  return null;
 });
 imageCache.set(id,promise);
 return promise;
}
