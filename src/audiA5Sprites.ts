/** Real top-down Audi A5 Avant PNG assets, produced from the same source car.
 * The atlas keeps nine official named paints in ONE small request on iPhone Safari.
 * Crops are decoded once and cached as image/png data URLs. Other vehicle
 * models and unavailable Audi exclusive paints keep the original SVG icon.
 */
export type AudiPaintSprite={id:string;name:string;hex:string;index:number};
export const AUDI_A5_PAINT_SPRITES:readonly AudiPaintSprite[]=[
 {id:'audi-a5-paint-0',name:'Arkona White',hex:'#E8E9E8',index:0},
 {id:'audi-a5-paint-1',name:'Glacier White Metallic',hex:'#E8E9E5',index:1},
 {id:'audi-a5-paint-2',name:'Mythos Black Metallic',hex:'#15171B',index:2},
 {id:'audi-a5-paint-3',name:'Firmament Blue Metallic',hex:'#273D54',index:3},
 {id:'audi-a5-paint-4',name:'Floret Silver Metallic',hex:'#B9BEC3',index:4},
 {id:'audi-a5-paint-5',name:'Plateau Grey Metallic',hex:'#7C858B',index:5},
 {id:'audi-a5-paint-6',name:'Horizon Blue Metallic',hex:'#597E94',index:6},
 {id:'audi-a5-paint-7',name:'Grenadine Red Metallic',hex:'#8E2633',index:7},
 {id:'audi-a5-paint-9',name:'Daytona Grey Pearl Effect',hex:'#666A70',index:8},
] as const;
export const AUDI_A5_ATLAS_COLUMNS=9;
export const AUDI_A5_SPRITE_WIDTH=80;
export const AUDI_A5_SPRITE_HEIGHT=170;
const PAINT_BY_ID=new Map(AUDI_A5_PAINT_SPRITES.map(p=>[p.id,p]));
const PAINT_BY_HEX=new Map(AUDI_A5_PAINT_SPRITES.map(p=>[p.hex.toUpperCase(),p]));
export const isAudiA5Avant=(model:string|undefined):boolean=>
 typeof model==='string'&&/^Audi A5 Avant(?: e-hybrid)?(?:\s|$)/i.test(model);
/** Resolves an owned vehicle without modifying saved Taxi fields.
 * Option IDs are authoritative (more precise than approximated hex swatches).
 * Unknown/custom Audi paints use the existing generic tinted icon.
 */
export function audiA5PaintForVehicle(
 model:string|undefined,optionIds:readonly string[]|undefined,paintHex:string|undefined,
):AudiPaintSprite|null{
 if(!isAudiA5Avant(model))return null;
 const saved=optionIds?.find(o=>o.startsWith('paint:'));
 if(saved)return PAINT_BY_ID.get(saved.slice(6))??null;
 if(paintHex)return PAINT_BY_HEX.get(paintHex.toUpperCase())??null;
 return PAINT_BY_ID.get('audi-a5-paint-0')??null;
}
export function audiA5PaintForConfigurator(
 brand:string,name:string,paintId:string|undefined,
):AudiPaintSprite|null{
 if(brand!=='Audi'||name!=='A5 Avant e-hybrid')return null;
 return PAINT_BY_ID.get(paintId??'audi-a5-paint-0')??null;
}
const atlasUrl=()=>`${import.meta.env.BASE_URL??'/'}assets/vehicles/audi-a5-avant/paint-atlas.png`;
let atlasPromise:Promise<HTMLImageElement>|null=null;
const spriteCache=new Map<string,string>();
function loadAtlas():Promise<HTMLImageElement>{
 if(atlasPromise)return atlasPromise;
 atlasPromise=new Promise((resolve,reject)=>{
  const img=new Image();
  img.onload=()=>resolve(img);
  img.onerror=()=>reject(new Error('Audi A5 Avant paint atlas failed to load'));
  img.src=atlasUrl();
 }).catch(error=>{atlasPromise=null;throw error;});
 return atlasPromise;
}
/** Never request or recolor an image on every map simulation tick. One atlas
 * decode, then one cropped PNG per actually used colour. No WebGL layers.
 */
export async function audiA5SpriteUrl(paintId:string):Promise<string|null>{
 const entry=PAINT_BY_ID.get(paintId);
 if(!entry||typeof document==='undefined'||typeof Image==='undefined')return null;
 const cached=spriteCache.get(entry.id);
 if(cached)return cached;
 try{
  const atlas=await loadAtlas();
  if(atlas.naturalWidth!==AUDI_A5_SPRITE_WIDTH*AUDI_A5_ATLAS_COLUMNS||
   atlas.naturalHeight!==AUDI_A5_SPRITE_HEIGHT)
   throw Error('Audi atlas dimensions do not match the sprite manifest');
  const canvas=document.createElement('canvas');
  canvas.width=AUDI_A5_SPRITE_WIDTH;canvas.height=AUDI_A5_SPRITE_HEIGHT;
  const ctx=canvas.getContext('2d');
  if(!ctx)return null;
  ctx.drawImage(atlas,entry.index*AUDI_A5_SPRITE_WIDTH,0,
   AUDI_A5_SPRITE_WIDTH,AUDI_A5_SPRITE_HEIGHT,
   0,0,AUDI_A5_SPRITE_WIDTH,AUDI_A5_SPRITE_HEIGHT);
  const url=canvas.toDataURL('image/png');
  spriteCache.set(entry.id,url);
  return url;
 }catch(error){
  // Retain the old car SVG on unsupported browsers or asset load failures.
  console.warn('[TravelEmpire] Audi A5 Avant sprite unavailable:',error);
  return null;
 }
}
