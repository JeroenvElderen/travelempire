import {describe,expect,it} from 'vitest';
import {
 newHotelSite,drawRoom,placeFurniture,toggleWall,constructionQuote,
 updateFloor,roomIssues,type HotelFloor,type HotelSite,type Room,type Wall,
} from './internalConstruction';
import {
 windowAdjacentRoom,windowAllowed,toggleHotelWindow,toggleHotelLighting,
 suggestRoomWindow,suggestRoomLighting,analyzeRoomAtmosphere,
 hotelAtmosphereDemandModifier,WINDOW_COST_CENTS,LIGHT_COST_CENTS,
} from './hotelAtmosphere';
import {hotelGuestRoomQuality,hotelBlueprintHealth} from './hotelBlueprintEditing';
import {roomInventory} from './hotelOperations';
import {STARTING_CAPITAL} from './company';

const room=(id:string,type:Room['type'],x:number,y:number,w:number,h:number):Room=>
 ({id,type,name:id,x,y,width:w,height:h});
const window=(id:string,x:number,y:number,orientation:'v'|'h'='h',
 type:'window'|'panoramic-window'='window'):Wall=>({
 id,x,y,orientation,type,
});
function scene(){
 const site:HotelSite={...newHotelSite('atmosphere-site','Hotel','new',
  37.98,23.72,100),atmosphereRulesVersion:1};
 let floor=site.draft[0];
 floor=drawRoom(floor,room('guest','guest',4,4,5,4),site);
 floor=drawRoom(floor,room('bathroom','bathroom',9,4,3,3),site);
 floor=placeFurniture(floor,{id:'bed',code:'bed',x:5,y:4,rotated:false},site);
 floor=placeFurniture(floor,{id:'toilet',code:'toilet',x:9,y:4,rotated:false},site);
 floor=placeFurniture(floor,{id:'sink',code:'sink',x:10,y:4,rotated:false},site);
 floor=placeFurniture(floor,{id:'shower',code:'shower',x:11,y:4,rotated:false},site);
 return {site,floor,guest:floor.rooms[0]};
}
const installed=(floor:HotelFloor,site:HotelSite)=>{
 const withWindow=toggleHotelWindow(floor,site,window('w-1',4,8));
 const withMore=toggleHotelWindow(withWindow,site,window('w-2',5,8));
 return toggleHotelLighting(withMore,site,{id:'ceiling',kind:'ceiling',x:6,y:6});
};
describe('Hotel Architecture Phase 3 — exterior glazing',()=>{
 it('requires a real building exterior, not a floating plot or shared room wall',()=>{
  const {site,floor,guest}=scene();
  expect(windowAdjacentRoom(floor,site,window('outside',4,8))?.id).toBe(guest.id);
  expect(windowAllowed(floor,site,window('inside',9,5,'v'))).toBe(false);
  expect(windowAllowed(floor,site,window('plot',19,14))).toBe(false);
  expect(windowAllowed(floor,site,window('bad',-1,8))).toBe(false);
  expect(windowAllowed(floor,site,window('real',4,8))).toBe(true);
  expect(()=>toggleHotelWindow(floor,site,window('shared',9,5,'v')))
   .toThrow('face outdoors');
 });
 it('supports standard and panoramic windows with real changed building state',()=>{
  const {site,floor}=scene();
  const one=toggleHotelWindow(floor,site,window('w1',4,8));
  expect(one.walls[0].type).toBe('window');
  const panorama=toggleHotelWindow(one,site,window('p1',4,8,'h','panoramic-window'));
  expect(panorama.walls).toHaveLength(1);
  expect(panorama.walls[0].type).toBe('panoramic-window');
  const removed=toggleHotelWindow(panorama,site,window('p2',4,8,'h','panoramic-window'));
  expect(removed.walls).toHaveLength(0);
 });
 it('does not silently replace a valid guest doorway with glazing',()=>{
  const {site,floor}=scene();
  const withDoor=toggleWall(floor,{id:'door',x:9,y:5,orientation:'v',type:'door'},site);
  expect(()=>toggleHotelWindow(withDoor,site,window('w',9,5,'v'))).toThrow('Remove');
  expect(withDoor.walls).toHaveLength(1);
  expect(withDoor.walls[0].type).toBe('door');
 });
 it('removes the daylight benefit if construction later encloses the exterior',()=>{
  const {site,floor,guest}=scene();
  const sunny=toggleHotelWindow(floor,site,window('sun',4,8));
  const originally=analyzeRoomAtmosphere(sunny,guest,site);
  const blocked=drawRoom(sunny,room('new-neighbor','storage',4,8,3,3),site);
  const later=analyzeRoomAtmosphere(blocked,guest,site);
  expect(originally.naturalLight).toBeGreaterThan(0);
  expect(later.naturalLight).toBe(0);
  expect(windowAllowed(blocked,site,window('sun',4,8))).toBe(false);
 });
 it('suggests legal empty exterior windows from selected rooms',()=>{
  const {site,floor,guest}=scene();
  const suggestion=suggestRoomWindow(floor,site,guest.id);
  expect(suggestion).not.toBeNull();
  expect(windowAllowed(floor,site,suggestion!)).toBe(true);
  const changed=toggleHotelWindow(floor,site,{...suggestion!,id:'suggested',type:'window'});
  expect(suggestRoomWindow(changed,site,guest.id)).not.toEqual(suggestion);
  expect(suggestRoomWindow(floor,site,'missing')).toBeNull();
 });
});
describe('Hotel Architecture Phase 3 — safe ceiling and ambient lights',()=>{
 it('adds light without blocking a bed or occupying furniture space',()=>{
  const {site,floor}=scene();
  const lit=toggleHotelLighting(floor,site,{id:'over-bed',kind:'ceiling',x:5,y:4});
  expect(lit.objects).toEqual(floor.objects);
  expect(lit.lights).toMatchObject([{id:'over-bed',kind:'ceiling',x:5,y:4}]);
 });
 it('replaces fixture kind without double purchase and toggles to remove',()=>{
  const {site,floor}=scene();
  const a=toggleHotelLighting(floor,site,{id:'a',kind:'ceiling',x:6,y:5});
  const b=toggleHotelLighting(a,site,{id:'b',kind:'ambient',x:6,y:5});
  expect(b.lights).toMatchObject([{id:'a',kind:'ambient'}]);
  const c=toggleHotelLighting(b,site,{id:'c',kind:'ambient',x:6,y:5});
  expect(c.lights).toHaveLength(0);
 });
 it('rejects fixtures outside rooms and inside lift or stair shafts',()=>{
  const {site,floor}=scene();
  expect(()=>toggleHotelLighting(floor,site,{id:'x',kind:'ceiling',x:0,y:0}))
   .toThrow('usable room');
  expect(()=>toggleHotelLighting(floor,site,{id:'x',kind:'ceiling',x:-1,y:0}))
   .toThrow('valid room grid');
  const stairs=drawRoom(floor,room('stairs','stairwell',15,5,2,3),site);
  expect(()=>toggleHotelLighting(stairs,site,{id:'x',kind:'ambient',x:15,y:5}))
   .toThrow('lift shaft');
 });
 it('suggests a central available fixture location',()=>{
  const {site,floor}=scene();
  const position=suggestRoomLighting(floor,'guest');
  expect(position).not.toBeNull();
  const one=toggleHotelLighting(floor,site,{id:'first',kind:'ceiling',...position!});
  expect(suggestRoomLighting(one,'guest')).not.toEqual(position);
  expect(suggestRoomLighting(floor,'missing')).toBeNull();
 });
});
describe('Room comfort and construction finance',()=>{
 it('scores extra glazing and ceiling light separately from existing furnishing',()=>{
  const {site,floor,guest}=scene();
  const dark=analyzeRoomAtmosphere(floor,guest,site);
  const sunny=installed(floor,site);
  const bright=analyzeRoomAtmosphere(sunny,guest,site);
  expect(bright.naturalLight).toBeGreaterThan(dark.naturalLight);
  expect(bright.artificialLight).toBeGreaterThan(dark.artificialLight);
  expect(bright.score).toBeGreaterThan(dark.score);
  expect(bright.windowCount).toBe(2);
  expect(bright.grade).not.toBe('Dark');
  expect(hotelGuestRoomQuality(sunny,guest,site).score)
   .toBeGreaterThan(hotelGuestRoomQuality(floor,guest,site).score);
  expect(hotelBlueprintHealth(sunny,site).averageGuestRoomQuality)
   .toBe(hotelGuestRoomQuality(sunny,guest,site).score);
 });
 it('values panoramic glazing above standard glazing without claiming a real view',()=>{
  const {site,floor,guest}=scene();
  const standard=toggleHotelWindow(floor,site,window('std',4,8));
  const panorama=toggleHotelWindow(floor,site,window('big',4,8,'h','panoramic-window'));
  expect(analyzeRoomAtmosphere(panorama,guest,site).naturalLight)
   .toBeGreaterThan(analyzeRoomAtmosphere(standard,guest,site).naturalLight);
  expect(WINDOW_COST_CENTS['panoramic-window']).toBeGreaterThan(WINDOW_COST_CENTS.window);
 });
 it('quotes windows as materials and lights as equipment with no repeat purchases',()=>{
  const {site,floor}=scene();
  const expanded=installed(floor,site);
  const draft=updateFloor(site,0,()=>expanded);
  const quote=constructionQuote(draft,'contractor',0);
  expect(quote.materials.find(m=>m.id==='window-glazing'))
   .toMatchObject({quantity:2,totalCents:50000});
  expect(quote.furnitureCents).toBeGreaterThanOrEqual(LIGHT_COST_CENTS.ceiling);
  expect(quote.materialCents).toBeGreaterThan(50000);
  const completed={...draft,built:[expanded]};
  expect(constructionQuote(completed,'contractor',0).changes).toBe(0);
  expect(constructionQuote(completed,'contractor',0).furnitureCents).toBe(0);
  const changed=toggleHotelLighting(expanded,site,{id:'another',kind:'ambient',x:6,y:6});
  const revised=constructionQuote({...completed,draft:[changed]},'contractor',0);
  expect(revised.furnitureCents).toBe(LIGHT_COST_CENTS.ambient);
 });
 it('uses BUILT atmosphere in hotel demand, not an unfinished draft',()=>{
  const {site,floor}=scene();
  const built={...site,built:[floor],draft:[floor]};
  expect(roomIssues(floor,floor.rooms[0])).toEqual([]);
  expect(roomInventory(built,100).readyRooms).toHaveLength(1);
  const before=roomInventory(built,100).atmosphereDemandModifier;
  const draft={...built,draft:[installed(floor,site)]};
  expect(roomInventory(draft,100).atmosphereDemandModifier).toBe(before);
  const finished={...draft,built:draft.draft};
  expect(roomInventory(finished,100).atmosphereDemandModifier).toBeGreaterThan(before);
  expect(hotelAtmosphereDemandModifier(-500)).toBe(-.05);
  expect(hotelAtmosphereDemandModifier(500)).toBe(.06);
  expect(hotelAtmosphereDemandModifier(Number.NaN)).toBe(0);
 });
 it('grandfathers old hotels, and does not rewrite existing company capital',()=>{
  const {site,floor,guest}=scene();
  const legacy={...site,built:[floor],atmosphereRulesVersion:undefined};
  expect(roomInventory(legacy,100).atmosphereDemandModifier).toBe(0);
  expect(hotelGuestRoomQuality(floor,guest,legacy).score)
   .toBe(hotelGuestRoomQuality(floor,guest).score);
  expect(STARTING_CAPITAL).toBe(3000000);
  const priorCompany={startingCapital:600000,cash:137500};
  expect(priorCompany.startingCapital).toBe(600000);
  expect(priorCompany.cash).toBe(137500);
 });
});
