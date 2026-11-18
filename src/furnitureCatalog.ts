/** Hotel furniture catalogue v2 — pure data and product lookup.
 * Model IDs and finishes are optional for historical saves. Existing furniture
 * codes remain the gameplay requirement identifiers used by room readiness.
 */
import type {FurnitureCode,RoomType, ObjectPlacement} from './internalConstruction';

export type FurnitureCategory='bedroom'|'bathroom'|'lounge'|'kitchen'|
 'dining'|'office'|'lighting'|'decor'|'storage';
export type FurnitureStyle='modern'|'mediterranean'|'scandinavian'|
 'luxury'|'industrial'|'classic';
export type FurnitureTier='essential'|'signature'|'premium';
export type FurnitureFinish='oak'|'walnut'|'ivory'|'charcoal'|'sage'|'marble';
export type FurnitureBase={code:FurnitureCode;name:string;priceCents:number;
 width:number;height:number;requires?:RoomType[]};
export type FurnitureProduct=FurnitureBase&{
 id:string;category:FurnitureCategory;style:FurnitureStyle;
 tier:FurnitureTier;modelLabel:string;
 /** False only for items created before the catalogue was introduced. */
 catalogueModel:boolean;
};
export const FURNITURE_CATEGORIES:ReadonlyArray<{id:FurnitureCategory;label:string}>= [
 {id:'bedroom',label:'Bedroom'},{id:'bathroom',label:'Bathroom'},
 {id:'lounge',label:'Living & lounge'},{id:'kitchen',label:'Kitchen'},
 {id:'dining',label:'Dining & bar'},{id:'office',label:'Office & reception'},
 {id:'lighting',label:'Lighting'},{id:'decor',label:'Decoration'},
 {id:'storage',label:'Storage'},
];
export const FURNITURE_STYLES:ReadonlyArray<{id:FurnitureStyle;label:string}>= [
 {id:'modern',label:'Modern'},{id:'mediterranean',label:'Mediterranean'},
 {id:'scandinavian',label:'Scandinavian'},{id:'luxury',label:'Luxury'},
 {id:'industrial',label:'Industrial'},{id:'classic',label:'Classic'},
];
export const FURNITURE_FINISHES:ReadonlyArray<{id:FurnitureFinish;label:string;color:string}>= [
 {id:'oak',label:'Natural oak',color:'#c9a87b'},
 {id:'walnut',label:'Walnut',color:'#76523d'},
 {id:'ivory',label:'Ivory',color:'#e8dfcf'},
 {id:'charcoal',label:'Charcoal',color:'#59626c'},
 {id:'sage',label:'Sage green',color:'#849d83'},
 {id:'marble',label:'Marble',color:'#d9dde1'},
];
export const FURNITURE_REFINISH_CENTS=2500; // €25, only when an existing item is refinished
const CATEGORIES:Record<FurnitureCode,FurnitureCategory>={
 bed:'bedroom','single-bed':'bedroom',wardrobe:'bedroom',television:'lounge',
 desk:'office',lamp:'lighting',sofa:'lounge',reception:'office',toilet:'bathroom',
 shower:'bathroom',sink:'bathroom',oven:'kitchen',fridge:'kitchen',
 freezer:'kitchen',prep:'kitchen',table:'dining',chair:'dining',
 'bar-counter':'dining',coffee:'dining',shelves:'storage',computer:'office',
 printer:'office','office-chair':'office','conference-table':'office',
 nightstand:'bedroom',minibar:'bedroom',safe:'bedroom',headboard:'bedroom',
 vanity:'bedroom',bathtub:'bathroom',mirror:'bathroom','towel-rack':'bathroom',
 armchair:'lounge','coffee-table':'lounge','tv-stand':'lounge',bench:'lounge',
 'water-cooler':'lounge','reading-chair':'lounge',dishwasher:'kitchen',
 microwave:'kitchen','kitchen-island':'kitchen','bar-stool':'dining',
 booth:'dining',plant:'decor',rug:'decor',sculpture:'decor',
 'sofa-bed':'bedroom','luggage-rack':'bedroom',
};
const LABELS:Partial<Record<FurnitureCode,readonly [string,string,string]>>={
 bed:['Double bed','Queen bed','King bed'],
 'single-bed':['Single bed','Comfort single bed','Premium single bed'],
 wardrobe:['Single wardrobe','Sliding wardrobe','Built-in wardrobe'],
 sofa:['Two-seat sofa','Three-seat sofa','Corner sofa'],
 shower:['Standard shower','Walk-in shower','Rainfall shower'],
 bathtub:['Standard bathtub','Freestanding tub','Spa bathtub'],
 sink:['Single sink','Vanity sink','Double sink'],
 table:['Dining table','Large dining table','Banquet table'],
 chair:['Dining chair','Upholstered chair','Premium dining chair'],
 armchair:['Armchair','Lounge armchair','Recliner'],
 'tv-stand':['TV cabinet','Wide media console','Luxury media unit'],
 'coffee-table':['Coffee table','Round coffee table','Marble coffee table'],
 'sofa-bed':['Compact sofa bed','Double sofa bed','Premium sofa bed'],
 'kitchen-island':['Compact kitchen island','Prep kitchen island','Chef island'],
 'conference-table':['Meeting table','Executive meeting table','Boardroom table'],
 mirror:['Standing mirror','Tall framed mirror','Luxury full-length mirror'],
 rug:['Area rug','Woven rug','Large statement rug'],
 plant:['Potted plant','Indoor palm','Large ornamental plant'],
 safe:['Room safe','Digital safe','Premium safe'],
 minibar:['Minibar','Glass-front minibar','Premium minibar'],
 'bar-counter':['Bar counter','Long bar counter','Premium bar counter'],
};
const SIZES:Partial<Record<FurnitureCode,ReadonlyArray<readonly [number,number]>>>={
 bed:[[2,2],[2,2],[3,2]],
 wardrobe:[[1,1],[2,1],[2,1]],
 sofa:[[2,1],[3,1],[3,2]],
 shower:[[1,1],[2,1],[2,2]],
 bathtub:[[2,1],[2,2],[3,2]],
 sink:[[1,1],[2,1],[2,1]],
 table:[[2,1],[2,2],[3,2]],
 armchair:[[1,1],[1,1],[2,1]],
 'coffee-table':[[2,1],[2,1],[2,2]],
 'tv-stand':[[2,1],[2,1],[3,1]],
 'conference-table':[[3,2],[4,2],[4,3]],
 rug:[[2,2],[3,2],[3,3]],
 'kitchen-island':[[2,2],[3,2],[3,3]],
 'bar-counter':[[3,1],[4,1],[4,2]],
 'sofa-bed':[[2,2],[2,2],[3,2]],
 booth:[[2,2],[3,2],[3,3]],
 'reception':[[2,1],[3,1],[3,2]],
 'headboard':[[2,1],[2,1],[3,1]],
 'vanity':[[2,1],[2,1],[3,1]],
};
const TIERS:readonly FurnitureTier[]=['essential','signature','premium'];
const STYLES:readonly FurnitureStyle[]=[
 'modern','mediterranean','scandinavian','luxury','industrial','classic',
];
/** Each base family has 3 genuinely price/size/style-distinct models.
 * 48 furniture families yield 144 choices, without save schema migration.
 */
export function buildFurnitureCatalogue(specs:ReadonlyArray<FurnitureBase>):FurnitureProduct[]{
 return specs.flatMap((base,index)=>TIERS.map((tier,tierIndex)=>{
  const dimension=SIZES[base.code]?.[tierIndex];
  const modelLabel=LABELS[base.code]?.[tierIndex]??
   (tier==='essential'?base.name:tier==='signature'?'Signature '+base.name:'Premium '+base.name);
  return {...base,id:base.code+':'+tier,
   name:modelLabel,modelLabel,category:CATEGORIES[base.code],
   tier,style:STYLES[(index+tierIndex*2)%STYLES.length],
   width:dimension?.[0]??base.width,height:dimension?.[1]??base.height,
   priceCents:Math.round(base.priceCents*[1,1.38,1.95][tierIndex]/100)*100,
   catalogueModel:true};
 }));
}
/** Models with unknown identifiers (e.g. a newer save) retain their original
 * base footprint and price instead of crashing an old game version.
 */
export function furnitureProductForPlacement(
 specs:ReadonlyArray<FurnitureBase>,
 item:Pick<ObjectPlacement,'code'|'modelId'>,
):FurnitureProduct{
 const base=specs.find(s=>s.code===item.code);
 if(!base)throw Error('Unknown furniture.');
 const model=item.modelId&&buildFurnitureCatalogue(specs).find(p=>p.id===item.modelId&&p.code===item.code);
 if(model)return model;
 return {...base,id:item.code+':legacy',category:CATEGORIES[item.code],
  tier:'essential',style:'classic',modelLabel:base.name,
  catalogueModel:false};
}
export function furnitureFinishColor(id:string|undefined):string{
 return FURNITURE_FINISHES.find(f=>f.id===id)?.color??'#b9a28c';
}
export function furnitureIsCompatible(
 product:Pick<FurnitureProduct,'requires'>,roomType:RoomType,
):boolean{
 return !product.requires||product.requires.includes(roomType);
}
export function furnitureRoomStyleBonus(
 roomObjects:ReadonlyArray<ObjectPlacement>,
 specs:ReadonlyArray<FurnitureBase>,
):number{
 const selected=roomObjects.filter(o=>!!o.modelId);
 if(selected.length<2)return 0;
 const counts=new Map<FurnitureStyle,number>();
 for(const obj of selected){
  const model=furnitureProductForPlacement(specs,obj);
  if(!model.catalogueModel)continue;
  counts.set(model.style,(counts.get(model.style)??0)+1);
 }
 const strongest=Math.max(0,...counts.values());
 const total=[...counts.values()].reduce((a,b)=>a+b,0);
 return total>=2&&strongest/total>=.6?Math.min(6,strongest*2):0;
}
