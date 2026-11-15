import {describe,expect,it} from 'vitest';
import {planZoom,zoomScrollAt,pinchViewport} from './blueprintViewport';

describe('hotel blueprint pan and zoom',()=>{
 it('keeps the screen centre on the same grid cell after zooming',()=>{
  const before={left:350,top:200},focus={x:190,y:150};
  const after=zoomScrollAt(before,1,2,focus);
  expect(after.left).toBe(890);
  expect(after.top).toBe(550);
  expect((after.left+focus.x)/2).toBe(before.left+focus.x);
  expect((after.top+focus.y)/2).toBe(before.top+focus.y);
 });
 it('pinch pans at constant scale while staying over the selected room',()=>{
  const origin={zoom:1.2,distance:100,scroll:{left:300,top:100},center:{x:150,y:120}};
  const out=pinchViewport(origin,{distance:100,center:{x:190,y:140}});
  expect(out.zoom).toBe(1.2);
  expect(out.scroll).toEqual({left:260,top:80});
 });
 it('pinch zoom anchors to the original two-finger midpoint',()=>{
  const origin={zoom:1,distance:100,scroll:{left:150,top:100},center:{x:200,y:150}};
  const out=pinchViewport(origin,{distance:200,center:{x:230,y:160}});
  expect(out.zoom).toBe(2);
  expect(out.scroll).toEqual({left:470,top:340});
  expect((out.scroll.left+230)/out.zoom).toBe(350);
  expect((out.scroll.top+160)/out.zoom).toBe(250);
 });
 it('clamps zoom for accidental extreme pinch and invalid inputs',()=>{
  expect(planZoom(0.03)).toBe(0.25);
  expect(planZoom(20)).toBe(2.5);
  expect(planZoom(NaN)).toBe(1);
 });
});
