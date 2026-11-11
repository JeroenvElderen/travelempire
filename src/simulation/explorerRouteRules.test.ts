import {describe,it,expect} from 'vitest';
import {hasPrematureRedTransit} from './explorerRouteRules';
describe('connected exploration approaches',()=>{
 it('permits a long purple-road transfer before the class-specific first discovery',()=>{
  expect(hasPrematureRedTransit(['p1','p2','p3','motorway'],new Set(['p1','p2','p3']),new Set(['motorway']))).toBe(false);
 });
 it('rejects wrong-class red streets before secondary road discovery',()=>{
  expect(hasPrematureRedTransit(['purple','red-residential','secondary'],new Set(['purple']),new Set(['secondary']))).toBe(true);
 });
 it('allows legally validated red escape only after class discovery',()=>{
  expect(hasPrematureRedTransit(['purple','secondary','red-exit','purple-return'],new Set(['purple','purple-return']),new Set(['secondary']))).toBe(false);
 });
 it('rejects exploration missions without an assigned discovery edge',()=>{
  expect(hasPrematureRedTransit(['purple','red-road'],new Set(['purple']),new Set())).toBe(true);
 });
});
