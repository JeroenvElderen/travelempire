import {describe,expect,it} from 'vitest';
import {
 newHotelSite,drawRoom,placeFurniture,updateFloor,constructionQuote,beginConstruction,
 settleConstruction,emptyConstruction,roomIssues,addFloor,orderSupplies,supplyStock,hotelPlotCostCents,validHotelPlotSize,LAND_PRICE_CENTS,MAX_FLOORS,HOUR_MS,
 type Room
} from './internalConstruction';

const site=()=>newHotelSite('test-site','Test Hotel','new',37.98,23.72,1000);
const firstRoom:Room={id:'room-1',name:'Room 101',type:'guest',x:1,y:1,width:4,height:4};

describe('internal property construction',()=>{
 it('offers custom plot sizes and scales land cost by purchased area',()=>{
  expect(validHotelPlotSize({width:24,height:16})).toBe(true);
  expect(hotelPlotCostCents({width:24,height:16})).toBe(LAND_PRICE_CENTS);
  expect(hotelPlotCostCents({width:48,height:32})).toBe(LAND_PRICE_CENTS*4);
  expect(hotelPlotCostCents({width:12,height:12})).toBe(Math.round(LAND_PRICE_CENTS*144/(24*16)));
  expect(validHotelPlotSize({width:13,height:16})).toBe(false);
  expect(validHotelPlotSize({width:24,height:66})).toBe(false);
  expect(()=>hotelPlotCostCents({width:0,height:16})).toThrow('Plot width');
 });
 it('retains the purchased plot dimensions and guards old hotel/HQ footprints',()=>{
  const compact=newHotelSite('small','Compact','new',37.98,23.72,1010,undefined,{width:12,height:14});
  const large=newHotelSite('large','Large','new',37.98,23.72,1010,undefined,{width:48,height:32});
  expect([compact.width,compact.height]).toEqual([12,14]);
  expect([large.width,large.height]).toEqual([48,32]);
  expect(()=>drawRoom(compact.draft[0],{...firstRoom,x:10},compact)).toThrow('outside');
  expect(drawRoom(large.draft[0],{...firstRoom,x:42,y:20},large).rooms).toHaveLength(1);
  const oldHotel=site();
  const headOffice=newHotelSite('hq','HQ','headquarters',37.98,23.72,1000,undefined,{width:48,height:32});
  expect([oldHotel.width,oldHotel.height,headOffice.width,headOffice.height]).toEqual([24,16,24,16]);
 });

 it('starts without external tenders or arbitrary revenue',()=>{
  const s=site();
  expect(s.draft).toHaveLength(1);
  expect(s.built[0].rooms).toHaveLength(0);
  expect(constructionQuote(s,'contractor',0).totalCents).toBe(0);
 });
 it('draws rooms in the grid and rejects too-small and overlapping layouts',()=>{
  const s=site();
  const floor=drawRoom(s.draft[0],firstRoom,s);
  expect(floor.rooms).toHaveLength(1);
  expect(()=>drawRoom(floor,{...firstRoom,id:'duplicate',x:3},s)).toThrow('overlap');
  expect(()=>drawRoom(floor,{...firstRoom,id:'small',x:14,width:1},s)).toThrow('smaller');
  expect(()=>drawRoom(floor,{...firstRoom,id:'outside',x:23},s)).toThrow('outside');
 });
 it('blocks invalid furniture and tracks furnishing requirements',()=>{
  const s=site(),floor=drawRoom(s.draft[0],firstRoom,s);
  expect(roomIssues(floor,firstRoom)).toContain('Missing bed or single-bed');
  const withBed=placeFurniture(floor,{id:'bed-1',code:'bed',x:1,y:1,rotated:false},s);
  expect(roomIssues(withBed,firstRoom)).toHaveLength(0);
  expect(()=>placeFurniture(withBed,{id:'other',code:'desk',x:1,y:1,rotated:false},s)).toThrow('overlap');
  expect(()=>placeFurniture(floor,{id:'oven',code:'oven',x:1,y:1,rotated:false},s)).toThrow('cannot be placed');
 });
 it('charges construction once and finishes the actual blueprint after game time',()=>{
  const s=site();
  const next=updateFloor(s,0,f=>drawRoom(f,firstRoom,s));
  const quote=constructionQuote(next,'contractor',0);
  expect(quote.totalCents).toBeGreaterThan(0);
  expect(quote.materials.some(m=>m.id==='concrete')).toBe(true);
  const started=beginConstruction(next,'contractor',0,1010,'project-1');
  expect(started.quote.totalCents).toBe(quote.totalCents);
  expect(()=>updateFloor(started.site,0,f=>f)).toThrow('construction');
  const state={...emptyConstruction(1010),sites:{[s.id]:started.site}};
  const before=settleConstruction(state,1011);
  expect(before.state.sites[s.id].built[0].rooms).toHaveLength(0);
  const after=settleConstruction(before.state,started.site.projects[0].finishHour);
  expect(after.completed).toEqual(['Test Hotel']);
  expect(after.state.sites[s.id].built[0].rooms).toHaveLength(1);
  expect(after.state.sites[s.id].projects[0].status).toBe('complete');
  expect(constructionQuote(after.state.sites[s.id],'contractor',0).totalCents).toBe(0);
 });
 it('requires an owned workforce for self-build and calculates crew payroll',()=>{
  const s=site(),next=updateFloor(s,0,f=>drawRoom(f,firstRoom,s));
  expect(()=>constructionQuote(next,'own',1)).toThrow('two construction workers');
  const quote=constructionQuote(next,'own',3);
  expect(quote.totalCents).toBeGreaterThan(0);
  const state={...emptyConstruction(100),workers:3};
  const payout=settleConstruction(state,110);
  expect(payout.wageCents).toBe(10*3*1800);
 });
 it('supports an HQ interior and limits the number of building floors',()=>{
  const hq=newHotelSite('hq','Corporate HQ','headquarters',37.98,23.72,1000);
  const office:Room={id:'office',name:'Office 1',type:'office',x:0,y:0,width:5,height:5};
  const planned=updateFloor(hq,0,f=>drawRoom(f,office,hq));
  expect(planned.draft[0].rooms[0].type).toBe('office');
  let floors=planned;
  for(let i=1;i<MAX_FLOORS;i++)floors=addFloor(floors);
  expect(floors.draft.length).toBe(MAX_FLOORS);
  expect(()=>addFloor(floors)).toThrow('Maximum');
 });
 it('requires a constructed kitchen or bar for stock orders',()=>{
  const s=site();
  expect(()=>orderSupplies(s,'eggs',10,100,'eggs-1')).toThrow('Finish constructing');
  const kitchen:Room={id:'kitchen',name:'Kitchen',type:'kitchen',x:0,y:0,width:5,height:5};
  const withKitchen={...s,built:[{...s.built[0],rooms:[kitchen]}]};
  const order=orderSupplies(withKitchen,'eggs',10,100,'order-1');
  expect(order.costCents).toBe(350);
  expect(supplyStock(order.site,'eggs',100)).toBe(0);
  const next={...emptyConstruction(100),sites:{[s.id]:order.site}};
  const delivered=settleConstruction(next,107);
  expect(supplyStock(delivered.state.sites[s.id],'eggs',107)).toBe(10);
  expect(delivered.state.sites[s.id].supplyOrders?.[0].status).toBe('delivered');
  const spoiled=settleConstruction(delivered.state,107+14*24);
  expect(supplyStock(spoiled.state.sites[s.id],'eggs',107+14*24)).toBe(0);
 });
 it('limits order quantities and storage capacity',()=>{
  const s=site();
  const storage:Room={id:'storage',name:'Storage',type:'storage',x:0,y:0,width:6,height:6};
  const equipped={...s,built:[{...s.built[0],rooms:[storage]}]};
  expect(()=>orderSupplies(equipped,'linen',201,100,'x')).toThrow('1–200');
  expect(()=>orderSupplies(equipped,'wine',5,100,'x')).toThrow('bar');
  const once=orderSupplies(equipped,'linen',200,100,'first');
  expect(()=>orderSupplies(once.site,'linen',1,100,'second')).toThrow('storage');
 });
 it('keeps time and project estimates in game hours',()=>{
  expect(HOUR_MS).toBe(3600000);
  const s=site(),next=updateFloor(s,0,f=>drawRoom(f,firstRoom,s));
  const started=beginConstruction(next,'contractor',0,100,'t');
  expect(started.site.projects[0].deliveryHour).toBeGreaterThan(100);
  expect(started.site.projects[0].finishHour).toBeGreaterThan(started.site.projects[0].deliveryHour);
 });
});
