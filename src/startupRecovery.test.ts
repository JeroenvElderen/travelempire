import {describe,it,expect} from 'vitest';
import {startupErrorMessage,freshStartupUrl} from './startupRecovery';

describe('Mobile Safari startup recovery',()=>{
 it('distinguishes a missing deployment JS chunk from a gameplay error',()=>{
  expect(startupErrorMessage(new TypeError('Failed to fetch dynamically imported module: /assets/App-123.js')))
   .toContain('game file could not be loaded');
  expect(startupErrorMessage(new Error('Loading chunk 10 failed')))
   .toContain('deployment');
  expect(startupErrorMessage(new Error('Unexpected save state')))
   .toBe('Unexpected save state');
 });
 it('gives safe text for null, strings and very long crashes',()=>{
  expect(startupErrorMessage(undefined)).toContain('could not finish starting');
  expect(startupErrorMessage('Network unavailable')).toBe('Network unavailable');
  expect(startupErrorMessage(new Error('A'.repeat(500))).length).toBeLessThanOrEqual(250);
 });
 it('refreshes only the HTML URL, preserving path and other query parameters',()=>{
  const result=freshStartupUrl('https://travelempire.example/?language=en&panel=fleet',123456);
  const url=new URL(result);
  expect(url.searchParams.get('te_refresh')).toBe('123456');
  expect(url.searchParams.get('language')).toBe('en');
  expect(url.searchParams.get('panel')).toBe('fleet');
  expect(url.pathname).toBe('/');
  expect(url.origin).toBe('https://travelempire.example');
 });
 it('replaces a previous refresh token rather than stacking them',()=>{
  const url=new URL(freshStartupUrl('https://travelempire.example/?te_refresh=1',2));
  expect(url.searchParams.getAll('te_refresh')).toEqual(['2']);
 });
});
