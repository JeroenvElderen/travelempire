/** Škoda Octavia Combi overhead PNG artwork.
 * Existing MY27 factory paint IDs (including trim-dependent IDs/prices) are
 * unchanged; Phoenix Orange is explicitly game-only.
 * The 11-column transparent PNG atlas is pre-rotated nose-up for MapLibre.
 */
export type SkodaOctaviaPaintSprite={
 id:string;name:string;hex:string;index:number;slug:string;factory:boolean;
};
export const SKODA_OCTAVIA_PAINT_SPRITES:readonly SkodaOctaviaPaintSprite[]=[
 {id:'0',name:'Energy Blue',hex:'#254D85',index:0,slug:'energy-blue',factory:true},
 {id:'1',name:'Candy White',hex:'#F1F0E9',index:1,slug:'candy-white',factory:true},
 {id:'2',name:'Steel Grey',hex:'#82898C',index:2,slug:'steel-grey',factory:true},
 {id:'3',name:'Mamba Green',hex:'#69A52B',index:3,slug:'mamba-green',factory:true},
 {id:'4',name:'Black Magic Metallic',hex:'#17191D',index:4,slug:'black-magic',factory:true},
 {id:'5',name:'Moon White Metallic',hex:'#E6E8E5',index:5,slug:'moon-white',factory:true},
 {id:'6',name:'Race Blue Metallic',hex:'#28559B',index:6,slug:'race-blue',factory:true},
 {id:'7',name:'Graphite Grey Metallic',hex:'#555B60',index:7,slug:'graphite-grey',factory:true},
 {id:'8',name:'Smokey Diamond Silver Metallic',hex:'#B5B9BB',index:8,slug:'smokey-diamond-silver',factory:true},
 {id:'9',name:'Velvet Red Exclusive',hex:'#8C2532',index:9,slug:'velvet-red',factory:true},
 {id:'phoenix',name:'Phoenix Orange (TravelEmpire custom)',hex:'#C65E18',index:10,slug:'phoenix-orange',factory:false},
] as const;
export const SKODA_OCTAVIA_SPRITE_WIDTH=56;
export const SKODA_OCTAVIA_SPRITE_HEIGHT=119;
export const SKODA_OCTAVIA_ATLAS_COLUMNS=SKODA_OCTAVIA_PAINT_SPRITES.length;
export const SKODA_PHOENIX_PAINT_ID='oct27-paint-phoenix-custom';
const HEX_MAP=new Map(SKODA_OCTAVIA_PAINT_SPRITES.map(p=>[p.hex.toUpperCase(),p]));
const INDEX_MAP=new Map(SKODA_OCTAVIA_PAINT_SPRITES.map(p=>[p.id,p]));
export const isSkodaOctaviaCombi=(model:string|undefined):boolean=>
 typeof model==='string'&&/^Skoda Octavia Combi(?:\s|$)/i.test(model);
/** Option IDs are authoritative; the same base paint ID has distinct
 * suffixes per grade. An unknown paint keeps the existing SVG fallback.
 */
export function skodaOctaviaPaintByOptionId(paintId:string|undefined):SkodaOctaviaPaintSprite|null{
 if(!paintId)return null;
 if(paintId===SKODA_PHOENIX_PAINT_ID)return INDEX_MAP.get('phoenix')??null;
 const code=/^oct27-paint-(\d+)-\d+$/.exec(paintId)?.[1];
 return code?INDEX_MAP.get(code)??null:null;
}
export function skodaOctaviaPaintForVehicle(
 model:string|undefined,optionIds:readonly string[]|undefined,paintHex:string|undefined,
):SkodaOctaviaPaintSprite|null{
 if(!isSkodaOctaviaCombi(model))return null;
 const saved=optionIds?.find(id=>id.startsWith('paint:'));
 if(saved)return skodaOctaviaPaintByOptionId(saved.slice(6));
 if(paintHex)return HEX_MAP.get(paintHex.toUpperCase())??null;
 // Earlier cars without an explicit paint defaulted to Energy Blue.
 return INDEX_MAP.get('0')??null;
}
export function skodaOctaviaPaintForConfigurator(
 brand:string,model:string,paintId:string|undefined,
):SkodaOctaviaPaintSprite|null{
 if(brand!=='Skoda'||model!=='Octavia Combi')return null;
 return skodaOctaviaPaintByOptionId(paintId)??(!paintId?INDEX_MAP.get('0')??null:null);
}
export function skodaOctaviaAtlasUrl():string{
 return `${import.meta.env.BASE_URL??'/'}assets/vehicles/skoda-octavia-combi/paint-atlas.png`;
}
let loaded:Promise<HTMLImageElement>|null=null;
const cached=new Map<number,Promise<string|null>>();
function loadAtlas():Promise<HTMLImageElement>{
 if(loaded)return loaded;
 loaded=new Promise<HTMLImageElement>((resolve,reject)=>{
  const img=new Image();
  img.onload=()=>resolve(img);
  img.onerror=()=>reject(new Error('Škoda Octavia Combi sprite atlas could not load'));
  img.src=skodaOctaviaAtlasUrl();
 }).catch(error=>{loaded=null;throw error;});
 return loaded;
}
/** Crops only the selected colour, once. All paints share one 56 × 119 PNG
 * sheet, with no new moving-map layer or animation-frame recolouring.
 */
export function skodaOctaviaSpriteUrl(id:string):Promise<string|null>{
 const paint=INDEX_MAP.get(id);
 if(!paint||typeof document==='undefined'||typeof Image==='undefined')return Promise.resolve(null);
 const hit=cached.get(paint.index);
 if(hit)return hit;
 const promise=loadAtlas().then(atlas=>{
  if(atlas.naturalWidth!==SKODA_OCTAVIA_SPRITE_WIDTH*SKODA_OCTAVIA_ATLAS_COLUMNS||
   atlas.naturalHeight!==SKODA_OCTAVIA_SPRITE_HEIGHT)
   throw Error('Škoda Octavia Combi paint atlas has unexpected dimensions');
  const canvas=document.createElement('canvas');
  canvas.width=SKODA_OCTAVIA_SPRITE_WIDTH;
  canvas.height=SKODA_OCTAVIA_SPRITE_HEIGHT;
  const ctx=canvas.getContext('2d');if(!ctx)return null;
  ctx.drawImage(atlas,paint.index*SKODA_OCTAVIA_SPRITE_WIDTH,0,
   SKODA_OCTAVIA_SPRITE_WIDTH,SKODA_OCTAVIA_SPRITE_HEIGHT,
   0,0,SKODA_OCTAVIA_SPRITE_WIDTH,SKODA_OCTAVIA_SPRITE_HEIGHT);
  return canvas.toDataURL('image/png');
 }).catch(error=>{
  cached.delete(paint.index);
  console.warn('[TravelEmpire] Škoda Octavia Combi sprite unavailable:',error);
  return null;
 });
 cached.set(paint.index,promise);
 return promise;
}
