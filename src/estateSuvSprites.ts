/** Five new factory-catalogue models rendered as model-specific, top-down PNGs.
 * This is a shared atlas: 12 columns for paints, 5 rows for vehicle models.
 * The image is loaded only once, and the selected colour is cropped once.
 * Saved car IDs, trim restrictions, paint prices, and map animation stay intact.
 */
export type EstateSuvModel='q7'|'q9'|'xc60'|'v60'|'xc90';
export type EstateSuvPaint={
 id:string;name:string;hex:string;model:EstateSuvModel;column:number;row:number;
};
const catalog:{
 model:EstateSuvModel;brand:string;name:string;row:number;paints:readonly [string,string,string][];
}[]=[
 {model:'q7',brand:'Audi',name:'Q7 SUV TFSI e',row:0,paints:[
 ['q7-tfsi-paint-0','Carrara White','#EEEDEA'],
 ['q7-tfsi-paint-1','Vicuna Beige Metallic','#A18D79'],
 ['q7-tfsi-paint-2','Tamarind Brown Metallic','#59473D'],
 ['q7-tfsi-paint-3','Samurai Grey Metallic','#777A7D'],
 ['q7-tfsi-paint-4','Satellite Silver Metallic','#B6B8B8'],
 ['q7-tfsi-paint-5','Mythos Black Metallic','#17191D'],
 ['q7-tfsi-paint-6','Waitomo Blue Metallic','#283C52'],
 ['q7-tfsi-paint-7','Glacier White Metallic','#ECECE8'],
 ['q7-tfsi-paint-8','Chili Red Metallic','#9A2530'],
 ['q7-tfsi-paint-9','Daytona Grey Pearl Effect','#676B71'],
 ['q7-tfsi-paint-10','Ascari Blue Metallic','#1F4D88'],
 ['q7-tfsi-paint-11','Sakhir Gold Metallic','#A48D59'],
 ]},
 {model:'q9',brand:'Audi',name:'Q9 SUV',row:1,paints:[
 ['audi-q9-paint-0','Carrara White','#EDEBE7'],
 ['audi-q9-paint-1','Satellite Silver Metallic','#B5B7BB'],
 ['audi-q9-paint-2','Mythos Black Metallic','#191A1D'],
 ['audi-q9-paint-3','Glacier White Metallic','#E9E9E5'],
 ['audi-q9-paint-4','Merapi Grey Metallic','#66696D'],
 ['audi-q9-paint-5','Waitomo Blue Metallic','#30465D'],
 ['audi-q9-paint-6','Midnight Green Metallic','#263D38'],
 ['audi-q9-paint-7','Alopias Blue Metallic','#2D536A'],
 ['audi-q9-paint-8','Agave Green Metallic','#455C45'],
 ['audi-q9-paint-9','Daytona Grey Pearl Effect','#666A70'],
 ]},
 {model:'xc60',brand:'Volvo',name:'XC60',row:2,paints:[
 ['volvo-xc60-paint-0','Ice White','#F1F0ED'],
 ['volvo-xc60-paint-1','Crystal White','#E5E6E4'],
 ['volvo-xc60-paint-2','Onyx Black','#17191B'],
 ['volvo-xc60-paint-3','Denim Blue','#36485F'],
 ['volvo-xc60-paint-4','Vapour Grey','#A6A8A7'],
 ['volvo-xc60-paint-5','Aurora Silver','#C0C5C6'],
 ['volvo-xc60-paint-6','Forest Lake','#51615A'],
 ['volvo-xc60-paint-7','Heather Bronze','#8D7774'],
 ]},
 {model:'v60',brand:'Volvo',name:'V60',row:3,paints:[
 ['volvo-v60-paint-0','Ice White','#F1F0EB'],
 ['volvo-v60-paint-1','Crystal White Metallic','#E6E7E4'],
 ['volvo-v60-paint-2','Onyx Black Metallic','#17191B'],
 ['volvo-v60-paint-3','Denim Blue Metallic','#34465B'],
 ['volvo-v60-paint-4','Bright Dusk Metallic','#9D918A'],
 ['volvo-v60-paint-5','Vapour Grey Metallic','#8C9392'],
 ['volvo-v60-paint-6','Aurora Silver Metallic','#BEC4C5'],
 ['volvo-v60-paint-7','Forest Lake Metallic','#344B49'],
 ]},
 {model:'xc90',brand:'Volvo',name:'XC90',row:4,paints:[
 ['xc90-paint-0','Ice White','#F0F0EB'],
 ['xc90-paint-1','Crystal White Pearl','#E7E9E7'],
 ['xc90-paint-2','Onyx Black','#18191D'],
 ['xc90-paint-3','Denim Blue','#354A65'],
 ['xc90-paint-4','Bright Dusk','#B1A5A0'],
 ['xc90-paint-5','Mulberry','#75404E'],
 ['xc90-paint-6','Vapour Grey','#A5A8A7'],
 ['xc90-paint-7','Aurora Silver','#BFC3C5'],
 ['xc90-paint-8','Forest Lake','#52615B'],
 ]},
] as const;
export const ESTATE_SUV_COLUMNS=12;
export const ESTATE_SUV_ROWS=5;
export const ESTATE_SUV_SPRITE_WIDTH=20;
export const ESTATE_SUV_SPRITE_HEIGHT=44;
export const ESTATE_SUV_PAINTS:readonly EstateSuvPaint[]=catalog.flatMap(({model,row,paints})=>
 paints.map(([id,name,hex],column)=>({id,name,hex,model,column,row})));
const byId=new Map(ESTATE_SUV_PAINTS.map(sprite=>[sprite.id,sprite]));
const alias=new Map<string,string>([
 ['xc90-paint-1-black','xc90-paint-1'],
 ['xc90-paint-3-black','xc90-paint-3'],
 ['xc90-paint-6-black','xc90-paint-6'],
 ['xc90-paint-onyx-black-edition','xc90-paint-2'],
]);
const groups=new Map(catalog.map(row=>[row.model,row]));
export function estateSuvModelForVehicle(model:string|undefined):EstateSuvModel|null{
 if(!model)return null;
 for(const row of catalog){
  const prefix=row.brand+' '+row.name;
  if(model===prefix||model.startsWith(prefix+' '))return row.model;
 }
 return null;
}
export function estateSuvPaintById(paintId:string|undefined):EstateSuvPaint|null{
 if(!paintId)return null;
 return byId.get(alias.get(paintId)??paintId)??null;
}
export function estateSuvPaintForConfigurator(brand:string,name:string,paintId:string|undefined):EstateSuvPaint|null{
 const row=catalog.find(row=>row.brand===brand&&row.name===name);
 if(!row)return null;
 const candidate=paintId?estateSuvPaintById(paintId):estateSuvPaintById(row.paints[0][0]);
 return candidate?.model===row.model?candidate:null;
}
export function estateSuvPaintForVehicle(model:string|undefined,optionIds:readonly string[]|undefined,paintHex:string|undefined):EstateSuvPaint|null{
 const group=estateSuvModelForVehicle(model);
 if(!group)return null;
 const saved=optionIds?.find(x=>x.startsWith('paint:'));
 if(saved){
  const mapped=estateSuvPaintById(saved.slice(6));
  return mapped?.model===group?mapped:null;
 }
 if(paintHex){
  const match=ESTATE_SUV_PAINTS.find(s=>s.model===group&&s.hex.toUpperCase()===paintHex.toUpperCase());
  if(match)return match;
 }
 const first=groups.get(group)?.paints[0]?.[0];
 return first?estateSuvPaintById(first):null;
}
export function estateSuvAtlasUrl():string{
 return `${import.meta.env.BASE_URL??'/'}assets/vehicles/estate-suv/paint-atlas.png`;
}
let atlasPromise:Promise<HTMLImageElement>|null=null;
const cropped=new Map<string,Promise<string|null>>();
function loadAtlas():Promise<HTMLImageElement>{
 if(atlasPromise)return atlasPromise;
 atlasPromise=new Promise<HTMLImageElement>((resolve,reject)=>{
  const img=new Image();
  img.onload=()=>resolve(img);
  img.onerror=()=>reject(new Error('Estate/SUV PNG atlas unavailable'));
  img.src=estateSuvAtlasUrl();
 }).catch(error=>{atlasPromise=null;throw error;});
 return atlasPromise;
}
export function estateSuvSpriteUrl(id:string):Promise<string|null>{
 const sprite=estateSuvPaintById(id);
 if(!sprite||typeof document==='undefined'||typeof Image==='undefined')return Promise.resolve(null);
 const existing=cropped.get(sprite.id);
 if(existing)return existing;
 const promise=loadAtlas().then(atlas=>{
  if(atlas.naturalWidth!==ESTATE_SUV_COLUMNS*ESTATE_SUV_SPRITE_WIDTH||
    atlas.naturalHeight!==ESTATE_SUV_ROWS*ESTATE_SUV_SPRITE_HEIGHT)
    throw Error('Estate/SUV atlas dimensions are invalid');
  const canvas=document.createElement('canvas');
  canvas.width=ESTATE_SUV_SPRITE_WIDTH;canvas.height=ESTATE_SUV_SPRITE_HEIGHT;
  const ctx=canvas.getContext('2d');if(!ctx)return null;
  ctx.drawImage(atlas,sprite.column*ESTATE_SUV_SPRITE_WIDTH,
    sprite.row*ESTATE_SUV_SPRITE_HEIGHT,ESTATE_SUV_SPRITE_WIDTH,ESTATE_SUV_SPRITE_HEIGHT,
    0,0,ESTATE_SUV_SPRITE_WIDTH,ESTATE_SUV_SPRITE_HEIGHT);
  return canvas.toDataURL('image/png');
 }).catch(error=>{
  console.warn('[TravelEmpire] Estate/SUV sprite unavailable',error);
  cropped.delete(sprite.id);
  return null;
 });
 cropped.set(sprite.id,promise);
 return promise;
}
