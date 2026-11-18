import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {
 furniture,placeFurniture,furnitureSize,drawRoom,newHotelSite,updateFloor,
 constructionQuote,roomIssues,type FurnitureCode,type ObjectPlacement,
} from './internalConstruction';
import {editBlueprintFurniture,hotelGuestRoomQuality} from './hotelBlueprintEditing';
import {
 buildFurnitureCatalogue,furnitureProductForPlacement,furnitureFinishColor,
 FURNITURE_CATEGORIES,FURNITURE_STYLES,FURNITURE_FINISHES,
 furnitureRoomStyleBonus,furnitureIsCompatible,FURNITURE_REFINISH_CENTS,
} from './furnitureCatalog';
import HotelFurnitureCatalogue from './components/HotelFurnitureCatalogue';
import {ArchitecturalDetails} from './components/HotelArchitecturalPlan';
import HotelIsometricPreview from './components/HotelIsometricPreview';

const PRODUCTS=buildFurnitureCatalogue(furniture);
const get=(id:string)=>{const item=PRODUCTS.find(p=>p.id===id);if(!item)throw Error('Missing test SKU '+id);return item;};
const placed=(id:string,x=0,y=0,finish='oak'):ObjectPlacement=>({
 id,code:get(id).code,modelId:id,finish,x,y,rotated:false,
});
const hotel=()=>{
 const s=newHotelSite('furniture-hotel','Furniture Hotel','new',37.98,23.72,100);
 const floor=drawRoom(s.draft[0],{id:'guest',type:'guest',
  name:'Suite 101',x:0,y:0,width:9,height:8},s);
 return {s,floor};
};
describe('Phase 6 catalogue coverage and saved data',()=>{
 it('delivers 48 furniture families and 144 distinct model choices',()=>{
  expect(furniture).toHaveLength(48);
  expect(PRODUCTS).toHaveLength(144);
  expect(new Set(PRODUCTS.map(p=>p.id)).size).toBe(144);
  expect(PRODUCTS.every(p=>Number.isInteger(p.priceCents)&&p.priceCents>0&&
   Number.isInteger(p.width)&&p.width>0&&Number.isInteger(p.height)&&p.height>0)).toBe(true);
  expect(FURNITURE_CATEGORIES).toHaveLength(9);
  expect(FURNITURE_STYLES).toHaveLength(6);
  expect(FURNITURE_FINISHES).toHaveLength(6);
 });
 it('provides distinct bed sizes, sofa types and bathroom models',()=>{
  expect(get('bed:premium')).toMatchObject({width:3,height:2});
  expect(get('sofa:premium')).toMatchObject({width:3,height:2});
  expect(get('shower:signature')).toMatchObject({width:2,height:1});
  expect(get('bathtub:premium')).toMatchObject({width:3,height:2});
  expect(get('wardrobe:signature').width).toBe(2);
  expect(get('bed:premium').priceCents).toBeGreaterThan(get('bed:essential').priceCents);
 });
 it('covers all nine categories, six styles and six visible finishes',()=>{
  expect(new Set(PRODUCTS.map(p=>p.category)).size).toBe(9);
  expect(new Set(PRODUCTS.map(p=>p.style)).size).toBe(6);
  expect(new Set(FURNITURE_FINISHES.map(f=>f.color)).size).toBe(6);
  expect(furnitureFinishColor('walnut')).toBe('#76523d');
  expect(furnitureFinishColor(undefined)).toBe('#b9a28c');
 });
 it('respects real room restrictions, without arbitrary catalog-only exceptions',()=>{
  expect(furnitureIsCompatible(get('toilet:essential'),'bathroom')).toBe(true);
  expect(furnitureIsCompatible(get('toilet:essential'),'guest')).toBe(false);
  expect(furnitureIsCompatible(get('minibar:signature'),'guest')).toBe(true);
  expect(furnitureIsCompatible(get('minibar:signature'),'kitchen')).toBe(false);
 });
 it('reads every old pre-catalogue object with exact original dimensions and price',()=>{
  for(const spec of furniture){
   const obj:{code:FurnitureCode;modelId?:string}={code:spec.code};
   const product=furnitureProductForPlacement(furniture,obj);
   expect(product.catalogueModel).toBe(false);
   expect(product.priceCents).toBe(spec.priceCents);
   expect(product.width).toBe(spec.width);
   expect(product.height).toBe(spec.height);
  }
 });
 it('unknown future model falls back to its base item instead of losing save data',()=>{
  const fallback=furnitureProductForPlacement(furniture,{code:'bed',modelId:'bed:future'});
  expect(fallback).toMatchObject({catalogueModel:false,width:2,height:2});
  const {s,floor}=hotel();
  expect(()=>placeFurniture(floor,{id:'x',code:'bed',modelId:'bed:future',
   x:0,y:0,rotated:false},s)).toThrow('does not exist');
 });
});
describe('Model-aware placement, existing construction and finance',()=>{
 it('uses the selected SKU footprint with rotation and refuses room overflow',()=>{
  const {s,floor}=hotel();
  const king=placed('bed:premium',0,0);
  expect(furnitureSize(king)).toEqual({width:3,height:2});
  expect(furnitureSize({...king,rotated:true})).toEqual({width:2,height:3});
  const first=placeFurniture(floor,king,s);
  expect(first.objects).toHaveLength(1);
  expect(()=>placeFurniture(first,placed('nightstand:essential',2,1),s))
   .toThrow('overlap');
  expect(()=>placeFurniture(first,placed('bed:premium',7,1),s))
   .toThrow('inside a room');
 });
 it('can switch models in place if they fit, while preserving stable furniture IDs',()=>{
  const {s,floor}=hotel();
  const initial=placeFurniture(floor,placed('bed:essential',0,0),s);
  const upgraded=editBlueprintFurniture(initial,s,initial.objects[0].id,{modelId:'bed:premium'});
  expect(upgraded.objects[0]).toMatchObject({
   id:'bed:essential',modelId:'bed:premium',x:0,y:0,
  });
  expect(furnitureSize(upgraded.objects[0])).toEqual({width:3,height:2});
  expect(initial.objects[0].modelId).toBe('bed:essential');
 });
 it('rejects a wider variant that collides with another furnishing, without data loss',()=>{
  const {s,floor}=hotel();
  let first=placeFurniture(floor,placed('bed:essential',0,0),s);
  first=placeFurniture(first,placed('nightstand:essential',2,0),s);
  expect(()=>editBlueprintFurniture(first,s,'bed:essential',{modelId:'bed:premium'}))
   .toThrow('overlap');
  expect(first.objects[0].modelId).toBe('bed:essential');
 });
 it('charges full upgraded model cost but never bills a pure move or rotation as new furniture',()=>{
  const {s,floor}=hotel();
  const original=placeFurniture(floor,placed('bed:essential'),s);
  const bought=updateFloor(s,0,()=>original);
  expect(constructionQuote(bought,'contractor',0).furnitureCents).toBe(get('bed:essential').priceCents);
  const paid={...bought,built:[original]};
  expect(constructionQuote(paid,'contractor',0).changes).toBe(0);
  const moved=editBlueprintFurniture(original,s,'bed:essential',{x:1,y:2,rotated:true});
  expect(constructionQuote({...paid,draft:[moved]},'contractor',0).furnitureCents).toBe(0);
  const upgraded=editBlueprintFurniture(original,s,'bed:essential',{modelId:'bed:premium'});
  expect(constructionQuote({...paid,draft:[upgraded]},'contractor',0).furnitureCents)
   .toBe(get('bed:premium').priceCents);
 });
 it('charges a small explicit refinish fee without buying furniture again',()=>{
  const {s,floor}=hotel();
  const original=placeFurniture(floor,placed('bed:signature'),s);
  const paid={...s,built:[original],draft:[original]};
  const restyled=editBlueprintFurniture(original,s,'bed:signature',{finish:'sage'});
  const quote=constructionQuote({...paid,draft:[restyled]},'contractor',0);
  expect(quote.furnitureCents).toBe(FURNITURE_REFINISH_CENTS);
  const completed={...paid,built:[restyled],draft:[restyled]};
  expect(constructionQuote(completed,'contractor',0).changes).toBe(0);
 });
 it('allows alternative valid furniture to satisfy the existing room operating requirements',()=>{
  const {s,floor}=hotel();
  const withSofaBed=placeFurniture(floor,placed('sofa-bed:essential'),s);
  expect(roomIssues(withSofaBed,withSofaBed.rooms[0])).toEqual([]);
  const bath=drawRoom(withSofaBed,{id:'bath',type:'bathroom',
   name:'Bathroom',x:10,y:0,width:4,height:4},s);
  let ready=placeFurniture(bath,placed('bathtub:essential',10,0),s);
  ready=placeFurniture(ready,placed('sink:essential',10,1),s);
  ready=placeFurniture(ready,placed('toilet:essential',11,1),s);
  expect(roomIssues(ready,ready.rooms[1])).toEqual([]);
 });
 it('rewards coherent style without altering old guest rooms lacking model IDs',()=>{
  const {s,floor}=hotel();
  const legacy=placeFurniture(floor,{id:'legacy',code:'bed',x:0,y:0,rotated:false},s);
  expect(furnitureRoomStyleBonus(legacy.objects,furniture)).toBe(0);
  const matching=PRODUCTS.filter(p=>p.style==='modern'&&
   (!p.requires||p.requires.includes('guest')));
  expect(matching.length).toBeGreaterThan(1);
  const items=[{...placed(matching[0].id,0,0),id:'a'},
   {...placed(matching.find(p=>p.width===1&&p.height===1)!.id,5,5),id:'b'}];
  expect(furnitureRoomStyleBonus(items,furniture)).toBeGreaterThan(0);
  expect(hotelGuestRoomQuality(legacy,legacy.rooms[0],s).score).toBeGreaterThan(0);
 });
});
describe('Catalogue interface and model visualisation',()=>{
 it('renders searchable categorical furniture tiles and selected room-aware filters',()=>{
  const markup=renderToStaticMarkup(createElement(HotelFurnitureCatalogue,{
   products:PRODUCTS,selectedId:'bed:essential',finish:'oak',
   selectedRoomType:'guest',disabled:false,onSelect:()=>{},onFinish:()=>{},
  }));
  expect(markup).toContain('Furniture &amp; interiors');
  expect(markup).toContain('Search furniture');
  expect(markup).toContain('Bedroom');
  expect(markup).toContain('Living &amp; lounge');
  expect(markup).toContain('Furniture finish');
  expect(markup).toContain('Double bed');
  expect(markup).toContain('Save favourite');
 });
 it('reflects chosen finish in the SVG 2D architecture without any save migration',()=>{
  const {s,floor}=hotel();
  const decorated=placeFurniture(floor,placed('bed:signature',0,0,'walnut'),s);
  const markup=renderToStaticMarkup(createElement('svg',{},
   createElement(ArchitecturalDetails,{floor:decorated,site:s,
    selectedFurnitureId:null,furniturePreview:null})));
  expect(markup).toContain('#76523d');
  expect(markup).toContain('translate(0 0)');
 });
 it('reflects material finish in the read-only isometric preview',()=>{
  const {s,floor}=hotel();
  const decorated=placeFurniture(floor,placed('bed:signature',0,0,'sage'),s);
  const markup=renderToStaticMarkup(createElement(HotelIsometricPreview,{
   site:{...s,draft:[decorated]},floorIndex:0,onExit:()=>{},
  }));
  expect(markup).toContain('#849d83');
  expect(markup).toContain('Return to 2D editor');
 });
});
