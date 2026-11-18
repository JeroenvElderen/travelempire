/** Real top-down Audi A5 Avant PNG assets, produced from the same source car.
 * The atlas keeps nine official named paints in ONE small request on iPhone Safari.
 * Crops are decoded once and cached as image/png data URLs. Other vehicle
 * models and unavailable Audi exclusive paints keep the original SVG icon.
 */
export type AudiPaintSprite={id:string;name:string;hex:string;index:number;slug:string};
export const AUDI_A5_PAINT_SPRITES:readonly AudiPaintSprite[]=[
 {id:'audi-a5-paint-0',name:'Arkona White',hex:'#E8E9E8',index:0,slug:'arkona-white'},
 {id:'audi-a5-paint-1',name:'Glacier White Metallic',hex:'#E8E9E5',index:1,slug:'glacier-white'},
 {id:'audi-a5-paint-2',name:'Mythos Black Metallic',hex:'#15171B',index:2,slug:'mythos-black'},
 {id:'audi-a5-paint-3',name:'Firmament Blue Metallic',hex:'#273D54',index:3,slug:'firmament-blue'},
 {id:'audi-a5-paint-4',name:'Floret Silver Metallic',hex:'#B9BEC3',index:4,slug:'floret-silver'},
 {id:'audi-a5-paint-5',name:'Plateau Grey Metallic',hex:'#7C858B',index:5,slug:'plateau-grey'},
 {id:'audi-a5-paint-6',name:'Horizon Blue Metallic',hex:'#597E94',index:6,slug:'horizon-blue'},
 {id:'audi-a5-paint-7',name:'Grenadine Red Metallic',hex:'#8E2633',index:7,slug:'grenadine-red'},
 {id:'audi-a5-paint-9',name:'Daytona Grey Pearl Effect',hex:'#666A70',index:8,slug:'daytona-grey'},
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
/** Each paint is a separate optimized, transparent PNG. The small versions are
 * for moving taxis; the higher-resolution variants are for the showroom.
 * The 9-colour atlas above is used only by the cheap thumbnail strip.
 */
export function audiA5MapSpriteUrl(paintId:string):string|null{
 const entry=PAINT_BY_ID.get(paintId);
 return entry?`${import.meta.env.BASE_URL??'/'}assets/vehicles/audi-a5-avant/${entry.slug}.png`:null;
}
export function audiA5PreviewSpriteUrl(paintId:string):string|null{
 const entry=PAINT_BY_ID.get(paintId);
 return entry?`${import.meta.env.BASE_URL??'/'}assets/vehicles/audi-a5-avant/${entry.slug}-preview.png`:null;
}
export async function audiA5SpriteUrl(
 paintId:string,quality:'map'|'preview'='map',
):Promise<string|null>{
 // Retain promise-based compatibility for the map's current async image
 // loading; no canvas, colour processing or extra CPU work is needed.
 return quality==='preview'?audiA5PreviewSpriteUrl(paintId):audiA5MapSpriteUrl(paintId);
}
