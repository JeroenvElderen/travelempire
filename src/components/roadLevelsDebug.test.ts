import {describe,it,expect} from 'vitest';
import {roadLevelKind,roadLevelDirection} from './roadLevelsDebug';

describe('road level diagnostics',()=>{
 it('labels a mapped tunnel even where layer is missing',()=>{
  expect(roadLevelKind({tunnel:true,bridge:false,layer:0})).toBe('tunnel');
 });
 it('distinguishes bridge from negative/positive layers',()=>{
  expect(roadLevelKind({bridge:true,layer:1})).toBe('bridge');
  expect(roadLevelKind({layer:-1})).toBe('below');
  expect(roadLevelKind({layer:1})).toBe('above');
  expect(roadLevelKind({layer:0})).toBe('surface');
 });
 it('retains exact directed-OSM connectivity instead of inferring it from a crossing',()=>{
  expect(roadLevelDirection({forward:true,reverse:true})).toBe('both');
  expect(roadLevelDirection({forward:true,reverse:false})).toBe('forward');
  expect(roadLevelDirection({forward:false,reverse:true})).toBe('reverse');
  expect(roadLevelDirection({forward:false,reverse:false})).toBe('none');
 });
});
