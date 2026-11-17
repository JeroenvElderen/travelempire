import {describe,expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {
 newHotelSite,drawRoom,placeFurniture,toggleWall,constructionQuote,
 type HotelFloor,type HotelSite,
} from './internalConstruction';
import {
 MAX_PREVIEW_PRIMITIVES,MAX_PREVIEW_ROOMS,planCounts,
 buildIsoScene,isoCorners,isoProject,isoRotate,roomShortLabel,pointString,
} from './hotelVisualisation';
import {ArchitecturalRooms,ArchitecturalDetails} from './components/HotelArchitecturalPlan';
import HotelIsometricPreview from './components/HotelIsometricPreview';
const original=()=>{
 const site=newHotelSite('preview','Hotel preview','new',37.98,23.72,101);
 let f=drawRoom(site.draft[0],{id:'r1',type:'guest',name:'Room 101',
  x:2,y:2,width:6,height:5},site);
 f=drawRoom(f,{id:'stairs',type:'stairwell',name:'Stairwell',
  x:8,y:2,width:2,height:3},site);
 f=placeFurniture(f,{id:'bed',code:'bed',x:2,y:2,rotated:false},site);
 f=placeFurniture(f,{id:'desk',code:'desk',x:5,y:2,rotated:true},site);
 f=toggleWall(f,{id:'window',type:'window',x:2,y:2,orientation:'h'},site);
 f=toggleWall(f,{id:'door',type:'door',x:8,y:3,orientation:'v'},site);
 f={...f,lights:[{id:'l',kind:'ceiling',x:4,y:4}],
  safetyFixtures:[{id:'alarm',kind:'smoke-alarm',x:4,y:3}]};
 return {...site,draft:[f]};
};
describe('Hotel Architecture Phase 5 — projection geometry',()=>{
 it('projects the four camera angles deterministically without moving buildings',()=>{
  const q=[0,1,2,3] as const;
  const seen=new Set<string>();
  const p=original();
  for(const angle of q){
   const rotated=isoRotate(2,5,p.width,p.height,angle);
   const point=isoProject(2,5,24,p.width,p.height,angle);
   expect(Number.isFinite(point.x)&&Number.isFinite(point.y)).toBe(true);
   expect(point.y).toBeCloseTo((rotated.x+rotated.y)*4.7-24,8);
   seen.add(pointString([point]));
  }
  expect(seen.size).toBe(4);
 });
 it('provides four corners per room and a valid viewport at any rotation',()=>{
  const s=original();
  for(const angle of [0,1,2,3] as const){
   const c=isoCorners(1,2,3,4,24,s.width,s.height,angle);
   expect(c).toHaveLength(4);
   expect(new Set(c.map(p=>pointString([p]))).size).toBe(4);
   const scene=buildIsoScene(s,'building',0,angle);
   const [x,y,width,height]=scene.viewBox.split(' ').map(Number);
   expect(width).toBeGreaterThan(0);expect(height).toBeGreaterThan(0);
   for(const pt of c){expect(pt.x).toBeGreaterThanOrEqual(x);
    expect(pt.x).toBeLessThanOrEqual(x+width);
    expect(pt.y).toBeGreaterThanOrEqual(y);
    expect(pt.y).toBeLessThanOrEqual(y+height);
   }
  }
 });
 it('distinguishes individual levels from the entire building without mutation',()=>{
  const s=original();
  s.draft=[s.draft[0],{...s.draft[0],id:'second',label:'Floor 1',
   rooms:s.draft[0].rooms.map(r=>({...r,id:'upper-'+r.id}))}];
  const whole=buildIsoScene(s,'building',0,0);
  expect(whole.levels).toHaveLength(2);
  expect(whole.levels.map(l=>l.z)).toEqual([0,24]);
  const one=buildIsoScene(s,'floor',1,0);
  expect(one.levels).toHaveLength(1);
  expect(one.levels[0].index).toBe(1);
  expect(one.levels[0].floor.label).toBe('Floor 1');
  expect(s.draft).toHaveLength(2);
 });
 it('caps large previews to protect mobile rendering, preserving source data',()=>{
  const s=original();
  const veryLarge=Array.from({length:MAX_PREVIEW_ROOMS+25},(_,i)=>({
   id:'huge-'+i,name:'Guest '+i,type:'guest' as const,
   x:i%25,y:Math.floor(i/25),width:1,height:1,
  }));
  const source={...s,draft:Array.from({length:3},(_,i)=>({
   ...s.draft[0],id:'floor-'+i,rooms:veryLarge.map(r=>({...r,id:r.id+'-'+i})),
   objects:[],walls:[],lights:[],safetyFixtures:[],
  }))};
  const scene=buildIsoScene(source,'building',0,0);
  expect(scene.primitiveCount).toBeGreaterThan(MAX_PREVIEW_PRIMITIVES);
  expect(scene.detailed).toBe(false);
  expect(scene.truncated).toBe(true);
  expect(scene.levels.reduce((n,f)=>n+f.floor.rooms.length,0))
   .toBeLessThanOrEqual(MAX_PREVIEW_ROOMS);
  expect(source.draft[0].rooms).toHaveLength(MAX_PREVIEW_ROOMS+25);
  expect(scene.levels.every(l=>l.floor.objects.length===0)).toBe(true);
 });
 it('handles old hotel saves with missing optional lighting or safety fields',()=>{
  const s=original(),f={...s.draft[0],lights:undefined,safetyFixtures:undefined};
  const legacy={...s,draft:[f],atmosphereRulesVersion:undefined,
   safetyRulesVersion:undefined};
  expect(planCounts(f)).toMatchObject({rooms:2,furniture:2,
   doors:1,windows:1,stairs:1,lifts:0,lighting:0,safety:0});
  expect(buildIsoScene(legacy,'building',0,2).levels).toHaveLength(1);
 });
});
describe('Hotel Architecture Phase 5 — SVG rendering and save integrity',()=>{
 it('renders readable architectural labels, room sizes and stair marks',()=>{
  const s=original(),f=s.draft[0];
  const markup=renderToStaticMarkup(createElement('svg',{},
   createElement(ArchitecturalRooms,{floor:f})));
  expect(markup).toContain('Room 101');
  expect(markup).toContain('6 × 5 m');
  expect(markup).toContain('STAIRS');
  expect(markup).toContain('pointer-events="none"');
  expect(roomShortLabel(f.rooms[1])).toBe('STAIRS');
 });
 it('draws door arcs, distinct windows and furnished items without hit targets',()=>{
  const s=original(),f=s.draft[0];
  const markup=renderToStaticMarkup(createElement('svg',{},
   createElement(ArchitecturalDetails,{
    floor:f,site:s,selectedFurnitureId:'bed',furniturePreview:null,
   })));
  expect(markup).toContain('#7bd2ff');
  expect(markup).toContain('#9ff0c7');
  expect(markup).toContain('pointer-events="none"');
  expect(markup).toContain('translate(2 2)');
 });
 it('renders the isometric cutaway without mutating the blueprint or charging money',()=>{
  const s=original(),before=JSON.stringify(s),quote=constructionQuote(s,'contractor',0);
  const markup=renderToStaticMarkup(createElement(HotelIsometricPreview,{
   site:s,floorIndex:0,onExit:()=>{},
  }));
  expect(markup).toContain('Isometric building cutaway');
  expect(markup).toContain('Rotate building right');
  expect(markup).toContain('Return to 2D editor');
  expect(markup).toContain('Room 101');
  expect(JSON.stringify(s)).toBe(before);
  expect(constructionQuote(s,'contractor',0)).toEqual(quote);
 });
 it('shows true room item counts without relying on obsolete saved schema',()=>{
  const s=original(),f:HotelFloor=s.draft[0];
  expect(planCounts(f)).toEqual({rooms:2,furniture:2,windows:1,doors:1,
   stairs:1,lifts:0,safety:1,lighting:1});
  const site:HotelSite=JSON.parse(JSON.stringify(s));
  expect(planCounts(site.draft[0])).toEqual(planCounts(f));
 });
});
