/** Toyota Corolla Touring Sports MY27 paint-specific top-down PNG sprites.
 * Paint IDs, trim availability and prices come from the existing game catalogue.
 * All 10 images share one transparent atlas (80 × 170 per paint, nose up).
 * No changes to saved vehicle records or gameplay movement are necessary.
 */
export type ToyotaCorollaPaintSprite={
 id:string;name:string;hex:string;index:number;twoTone:boolean;
};
export const TOYOTA_COROLLA_PAINT_SPRITES:readonly ToyotaCorollaPaintSprite[]=[
 {id:'corolla-ts-paint-0',name:'Pure White (040)',hex:'#F3F2EF',index:0,twoTone:false},
 {id:'corolla-ts-paint-1',name:'Night Sky Black (209)',hex:'#1B1D22',index:1,twoTone:false},
 {id:'corolla-ts-paint-2',name:'Precious Silver (1J6)',hex:'#B7BABD',index:2,twoTone:false},
 {id:'corolla-ts-paint-3',name:'Pearl Ice White (089)',hex:'#F3F1E9',index:3,twoTone:false},
 {id:'corolla-ts-paint-4',name:'Pearl Red (3U5)',hex:'#9F2530',index:4,twoTone:false},
 {id:'corolla-ts-paint-5',name:'Storm Grey (1M2)',hex:'#6F7479',index:5,twoTone:false},
 {id:'corolla-ts-paint-6',name:'Precious Silver Bi-tone (2RD)',hex:'#B7BABD',index:6,twoTone:true},
 {id:'corolla-ts-paint-7',name:'Pearl Ice White Bi-tone (2PU)',hex:'#F3F1E9',index:7,twoTone:true},
 {id:'corolla-ts-paint-8',name:'Pearl Red Bi-tone (2SZ)',hex:'#9F2530',index:8,twoTone:true},
 {id:'corolla-ts-paint-9',name:'Storm Grey Bi-tone (M52)',hex:'#6F7479',index:9,twoTone:true},
];
export const TOYOTA_COROLLA_ATLAS_COLUMNS=10;
export const TOYOTA_COROLLA_SPRITE_WIDTH=80;
export const TOYOTA_COROLLA_SPRITE_HEIGHT=170;
const byId=new Map(TOYOTA_COROLLA_PAINT_SPRITES.map(p=>[p.id,p]));
const byHex=new Map<string,ToyotaCorollaPaintSprite>();
for(const paint of TOYOTA_COROLLA_PAINT_SPRITES){
 // On older HEX-only saves, a flat colour cannot distinguish black-roof
 // editions. Keep the single-colour version as the safe default.
 if(!byHex.has(paint.hex.toUpperCase()))byHex.set(paint.hex.toUpperCase(),paint);
}
export const isToyotaCorollaTouringSports=(model:string|undefined):boolean=>
 typeof model==='string'&&/^Toyota Corolla Touring Sports(?:\s|$)/i.test(model);
export const toyotaCorollaPaintById=(id:string|undefined):ToyotaCorollaPaintSprite|null=>
 id?byId.get(id)??null:null;
export function toyotaCorollaPaintForVehicle(
 model:string|undefined,optionIds:readonly string[]|undefined,paintHex:string|undefined,
):ToyotaCorollaPaintSprite|null{
 if(!isToyotaCorollaTouringSports(model))return null;
 const saved=optionIds?.find(id=>id.startsWith('paint:'));
 if(saved)return toyotaCorollaPaintById(saved.slice(6));
 if(paintHex)return byHex.get(paintHex.toUpperCase())??null;
 return byId.get('corolla-ts-paint-0')??null;
}
export function toyotaCorollaPaintForConfigurator(
 brand:string,name:string,paintId:string|undefined,
):ToyotaCorollaPaintSprite|null{
 if(brand!=='Toyota'||name!=='Corolla Touring Sports')return null;
 return byId.get(paintId??'corolla-ts-paint-0')??null;
}
export function toyotaCorollaAtlasUrl():string{
 return `${import.meta.env.BASE_URL??'/'}assets/vehicles/toyota-corolla-touring-sports/paint-atlas.png`;
}
let loading:Promise<HTMLImageElement>|null=null;
const cached=new Map<string,Promise<string|null>>();
function loadAtlas():Promise<HTMLImageElement>{
 if(loading)return loading;
 loading=new Promise<HTMLImageElement>((resolve,reject)=>{
  const image=new Image();
  image.onload=()=>resolve(image);
  image.onerror=()=>reject(new Error('Toyota Corolla paint atlas unavailable'));
  image.src=toyotaCorollaAtlasUrl();
 }).catch(e=>{loading=null;throw e;});
 return loading;
}
/** Decode once and cache only the colours currently displayed in the game.
 * The map reuses the resulting PNG data URL; no per-frame canvas processing.
 */
export function toyotaCorollaSpriteUrl(id:string):Promise<string|null>{
 const selected=byId.get(id);
 if(!selected||typeof document==='undefined'||typeof Image==='undefined')
  return Promise.resolve(null);
 const current=cached.get(id);
 if(current)return current;
 const promise=loadAtlas().then(atlas=>{
  if(atlas.naturalWidth!==TOYOTA_COROLLA_SPRITE_WIDTH*TOYOTA_COROLLA_ATLAS_COLUMNS||
   atlas.naturalHeight!==TOYOTA_COROLLA_SPRITE_HEIGHT)
   throw Error('Toyota Corolla paint atlas dimensions do not match the catalogue');
  const canvas=document.createElement('canvas');
  canvas.width=TOYOTA_COROLLA_SPRITE_WIDTH;
  canvas.height=TOYOTA_COROLLA_SPRITE_HEIGHT;
  const context=canvas.getContext('2d');if(!context)return null;
  context.drawImage(atlas,selected.index*TOYOTA_COROLLA_SPRITE_WIDTH,0,
   TOYOTA_COROLLA_SPRITE_WIDTH,TOYOTA_COROLLA_SPRITE_HEIGHT,
   0,0,TOYOTA_COROLLA_SPRITE_WIDTH,TOYOTA_COROLLA_SPRITE_HEIGHT);
  return canvas.toDataURL('image/png');
 }).catch(err=>{
  cached.delete(id);
  console.warn('[TravelEmpire] Toyota Corolla PNG unavailable:',err);
  return null;
 });
 cached.set(id,promise);
 return promise;
}
