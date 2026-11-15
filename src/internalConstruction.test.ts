import {describe,expect,it} from 'vitest';
import {
 newHotelSite,drawRoom,placeFurniture,updateFloor,constructionQuote,beginConstruction,
 settleConstruction,emptyConstruction,roomIssues,addFloor,MAX_FLOORS,HOUR_MS,
 type Room
} from './internalConstruction';

const site=()=>newHotelSite('test-site','Test Hotel','new',37.98,23.72,1000);
const firstRoom:Room={id:'room-1',name:'Room 101',type:'guest',x:1,y:1,width:4,height:4};

describe('internal property construction',()=>{
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
  expect(()=>updateFloor(started.site,0,f=>f)).toThrow('underway');
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
 it('keeps time and project estimates in game hours',()=>{
  expect(HOUR_MS).toBe(3600000);
  const s=site(),next=updateFloor(s,0,f=>drawRoom(f,firstRoom,s));
  const started=beginConstruction(next,'contractor',0,100,'t');
  expect(started.site.projects[0].deliveryHour).toBeGreaterThan(100);
  expect(started.site.projects[0].finishHour).toBeGreaterThan(started.site.projects[0].deliveryHour);
 });
});
