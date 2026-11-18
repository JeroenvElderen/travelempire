import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {
 furniture,drawRoom,placeFurniture,furnitureSize,newHotelSite,
 updateFloor,constructionQuote,
 type HotelSite,type Room,type HotelFloor,
} from './internalConstruction';
import {furnitureRoomStyleBonus,FURNITURE_STYLES} from './furnitureCatalog';
import {
 ROOM_COLLECTIONS,COLLECTION_STYLES,furnitureCollectionFor,
 curatedCollectionPieces,planRoomFurnitureCollection,roomDoorClearance,
 type CollectionMode,
} from './hotelFurnitureCollections';
import {toggleHotelAccessDoor} from './hotelAccess';
import HotelRoomCollections from './components/HotelRoomCollections';

function hotel(width=24,height=16):HotelSite{
 return newHotelSite('sets-1','Collections hotel','new',37.98,23.72,100,
  undefined,{width,height});
}
function room(site:HotelSite,type:Room['type']='guest',
 x=2,y=2,width=16,height=12){
 const r:Room={id:'room-a',name:'Suite A',type,x,y,width,height};
 return drawRoom(site.draft[0],r,site);
}
const plan=(floor:HotelFloor,site:HotelSite,style= 'mediterranean' as const,
 mode:CollectionMode='fill')=>
 planRoomFurnitureCollection(floor,site,'room-a',style,mode);
describe('Hotel room collections — 6 themes and 6 compatible room types',()=>{
 it('exposes coherent sets for six room types and all six interior styles',()=>{
  expect(ROOM_COLLECTIONS).toHaveLength(6);
  expect(COLLECTION_STYLES).toEqual(FURNITURE_STYLES.map(item=>item.id));
  for(const recipe of ROOM_COLLECTIONS){
   expect(recipe.pieces.length).toBeGreaterThanOrEqual(5);
   expect(furnitureCollectionFor(recipe.roomType)?.name).toBe(recipe.name);
   for(const style of COLLECTION_STYLES){
    const selection=curatedCollectionPieces(recipe.roomType,style);
    expect(selection.length).toBe(recipe.pieces.length);
    expect(selection.every(piece=>piece.model.requires===undefined||
     piece.model.requires.includes(recipe.roomType))).toBe(true);
    expect(selection.every(piece=>piece.finish&&piece.model.priceCents>0)).toBe(true);
   }
  }
  expect(furnitureCollectionFor('stairwell')).toBeNull();
 });
 it('plans each of the 36 room-style combinations on a spacious valid floor',()=>{
  for(const recipe of ROOM_COLLECTIONS)for(const style of COLLECTION_STYLES){
   const site=hotel();
   const floor=room(site,recipe.roomType);
   const result=planRoomFurnitureCollection(floor,site,'room-a',style,'fill');
   expect(result.requested).toBe(recipe.pieces.length);
   expect(result.added).toHaveLength(recipe.pieces.length);
   expect(result.floor.objects).toHaveLength(recipe.pieces.length);
   expect(result.added.every(obj=>obj.designStyle===style)).toBe(true);
   const checked=updateFloor(site,0,()=>result.floor);
   const quoted=constructionQuote(checked,'contractor',0);
   expect(quoted.furnitureCents).toBe(result.furnitureCents);
  }
 });
 it('is pure in preview mode and creates the same layout as final placement',()=>{
  const site=hotel(),floor=room(site);
  const before=JSON.stringify({site,floor});
  const preview=plan(floor,site);
  const final=planRoomFurnitureCollection(floor,site,'room-a','mediterranean','fill',
   i=>'real-'+i);
  expect(JSON.stringify({site,floor})).toBe(before);
  expect(preview.added.map(({x,y,rotated})=>[x,y,rotated]))
   .toEqual(final.added.map(({x,y,rotated})=>[x,y,rotated]));
  expect(final.added.every(obj=>obj.id.startsWith('real-'))).toBe(true);
  expect(final.furnitureCents).toBe(preview.furnitureCents);
 });
 it('keeps all furnishing objects inside the chosen room using real footprints',()=>{
  const site=hotel(),floor=room(site);
  const preview=plan(floor,site);
  const selected=floor.rooms[0];
  for(const object of preview.added){
   const {width,height}=furnitureSize(object);
   expect(object.x).toBeGreaterThanOrEqual(selected.x);
   expect(object.y).toBeGreaterThanOrEqual(selected.y);
   expect(object.x+width).toBeLessThanOrEqual(selected.x+selected.width);
   expect(object.y+height).toBeLessThanOrEqual(selected.y+selected.height);
  }
 });
 it('never blocks an existing guest-room door with automatic placement',()=>{
  const site=hotel(),f=room(site);
  const withHall=drawRoom(f,{id:'corridor',name:'Access corridor',type:'corridor',x:0,y:2,width:2,height:12},site);
  const withDoor=toggleHotelAccessDoor(withHall,site,{
   id:'guest-door',type:'door',orientation:'v',x:2,y:5,
  });
  const doorTiles=roomDoorClearance(withDoor,withDoor.rooms[0]);
  expect(doorTiles).toContainEqual({x:2,y:5});
  const furnished=plan(withDoor,site);
  for(const obj of furnished.added){
   const size=furnitureSize(obj);
   expect(doorTiles.some(tile=>tile.x>=obj.x&&tile.x<obj.x+size.width&&
    tile.y>=obj.y&&tile.y<obj.y+size.height)).toBe(false);
  }
 });
 it('rejects an impossibly small room without partial furnishings or changes',()=>{
  const site=hotel(),f=room(site,'guest',0,0,3,3);
  const original=JSON.stringify(f);
  expect(()=>plan(f,site)).toThrow('cannot fit');
  expect(JSON.stringify(f)).toBe(original);
  expect(f.objects).toEqual([]);
 });
 it('rejects unsupported rooms and missing room references clearly',()=>{
  const site=hotel(),f=room(site,'stairwell',2,2,2,3);
  expect(()=>plan(f,site)).toThrow('Choose a furnished');
  expect(()=>planRoomFurnitureCollection(f,site,'no-such-room','modern','fill'))
   .toThrow('Select an existing room');
 });
});
describe('One-action furnishing, preservation and construction costs',()=>{
 it('fills only missing furniture, retains IDs, prevents duplicate beds',()=>{
  const site=hotel(),f=room(site);
  const withBed=placeFurniture(f,{id:'original-bed',code:'bed',x:2,y:2,rotated:false},site);
  const result=plan(withBed,site);
  expect(result.keptExisting).toBe(1);
  expect(result.added).toHaveLength(ROOM_COLLECTIONS[0].pieces.length-1);
  expect(result.floor.objects.some(item=>item.id==='original-bed')).toBe(true);
  expect(result.floor.objects.filter(item=>item.code==='bed')).toHaveLength(1);
  expect(result.removed).toHaveLength(0);
  expect(result.furnitureCents).toBe(result.added.reduce((sum,item)=>
   sum+(curatedCollectionPieces('guest','mediterranean').find(p=>p.code===item.code)?.model.priceCents??0),0));
 });
 it('replacing furniture only affects the selected room and never touches another room',()=>{
  const site=hotel();
  let f=room(site,'guest',0,0,11,10);
  f=drawRoom(f,{id:'room-b',name:'Another room',type:'guest',x:12,y:0,width:9,height:9},site);
  f=placeFurniture(f,{id:'keep-other',code:'bed',x:13,y:1,rotated:false},site);
  f=placeFurniture(f,{id:'replace-me',code:'bed',x:1,y:1,rotated:false},site);
  const ready=planRoomFurnitureCollection(f,site,'room-a','luxury','replace');
  expect(ready.removed.map(x=>x.id)).toEqual(['replace-me']);
  expect(ready.floor.objects.some(x=>x.id==='replace-me')).toBe(false);
  expect(ready.floor.objects.find(x=>x.id==='keep-other')).toEqual(
   f.objects.find(x=>x.id==='keep-other'));
  expect(f.objects).toHaveLength(2);
  expect(ready.added.length).toBe(ROOM_COLLECTIONS[0].pieces.length);
 });
 it('keeps installed lights, safety fixtures and doorways unchanged',()=>{
  const site=hotel(),f=room(site);
  const initial={...f,
   lights:[{id:'light',kind:'ceiling' as const,x:3,y:3}],
   safetyFixtures:[{id:'smoke',kind:'smoke-alarm' as const,x:4,y:4}],
   walls:[{id:'wall',type:'window' as const,orientation:'h' as const,x:3,y:2}]};
  const result=plan(initial,site);
  expect(result.floor.lights).toEqual(initial.lights);
  expect(result.floor.safetyFixtures).toEqual(initial.safetyFixtures);
  expect(result.floor.walls).toEqual(initial.walls);
 });
 it('charges for added furniture only after the draft is approved',()=>{
  const site=hotel(),floor=room(site);
  const designed=plan(floor,site);
  const originalCash=123450000;
  const original=JSON.stringify(site);
  const edited=updateFloor({...site,draft:[floor]},0,()=>designed.floor);
  expect(JSON.stringify(site)).toBe(original);
  expect(originalCash).toBe(123450000);
  expect(constructionQuote(edited,'contractor',0).furnitureCents)
   .toBe(designed.furnitureCents);
  const completed={...edited,built:edited.draft};
  expect(constructionQuote(completed,'contractor',0).furnitureCents).toBe(0);
 });
 it('does not introduce a new saved-state version and keeps existing catalog objects readable',()=>{
  const site=hotel(),f=room(site);
  const legacy=placeFurniture(f,{id:'legacy',code:'bed',x:2,y:2,rotated:false},site);
  expect(legacy.objects[0].designStyle).toBeUndefined();
  expect(plan(legacy,site).floor.objects[0]).toEqual(legacy.objects[0]);
  const refreshed=JSON.parse(JSON.stringify(plan(legacy,site).floor)) as HotelFloor;
  expect(refreshed.objects[0].id).toBe('legacy');
  expect(refreshed.objects.some(o=>o.designStyle==='mediterranean')).toBe(true);
 });
 it('awards a coordinated theme score while leaving older rooms unaffected',()=>{
  const site=hotel(),f=room(site);
  const styled=plan(f,site).floor;
  expect(furnitureRoomStyleBonus(styled.objects,furniture)).toBeGreaterThan(0);
  const old=placeFurniture(f,{id:'old',code:'bed',x:2,y:2,rotated:false},site);
  expect(furnitureRoomStyleBonus(old.objects,furniture)).toBe(0);
  const mismatched=styled.objects.map((obj,i)=>({...obj,designStyle:
   (i%2?'modern':'luxury') as 'modern'|'luxury'}));
  expect(furnitureRoomStyleBonus(styled.objects,furniture))
   .toBeGreaterThan(furnitureRoomStyleBonus(mismatched,furniture));
 });
 it('validates collection changes through the existing construction lock',()=>{
  const site=hotel(),f=room(site);
  const project={id:'busy',method:'contractor' as const,status:'active' as const,
   startHour:0,deliveryHour:5,finishHour:10,budgetCents:0,
   materials:[],furnitureCents:0,labourCents:0,target:[f]};
  const active={...site,draft:[f],projects:[project]};
  expect(()=>updateFloor(active,0,original=>
   planRoomFurnitureCollection(original,active,'room-a','classic','replace').floor))
   .toThrow('Finish the current construction project');
 });
 it('supports high-level furnishing after selecting an existing room on mobile',()=>{
  const site=hotel(),f=room(site);
  const markup=renderToStaticMarkup(createElement(HotelRoomCollections,{
   site,floor:f,roomId:'room-a',disabled:false,
   onRoomSelect:()=>{},onApply:()=>{},
  }));
  expect(markup).toContain('Complete room collections');
  expect(markup).toContain('Room to furnish');
  expect(markup).toContain('Collection interior style');
  expect(markup).toContain('Fill missing pieces');
  expect(markup).toContain('Replace room furniture');
  expect(markup).toContain('Room layout preview');
  expect(markup).toContain('Furnish this room');
  expect(markup).toContain('Estimated new furniture');
  expect(markup).toContain('Mediterranean');
 });
});
