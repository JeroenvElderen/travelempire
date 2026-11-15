import {describe,it,expect} from 'vitest';
import {formatConstructionDate,formatGameCountdown,milestoneCountdown} from './constructionTime';
import {HOUR_MS} from './internalConstruction';

const nov15=Date.UTC(2026,10,15,12,0,0)/HOUR_MS;

describe('hotel construction readable in-game timestamps',()=>{
 it('shows an actual UTC in-game date rather than a Unix hour index',()=>{
  const display=formatConstructionDate(nov15);
  expect(display).toMatch(/15 Nov 2026/);
  expect(display).toMatch(/12:00/);
  expect(display).not.toContain(String(Math.floor(nov15)));
  expect(formatConstructionDate(NaN)).toBe('Time unavailable');
 });
 it('countdowns use the fractional game clock and update before the next hour boundary',()=>{
  expect(formatGameCountdown(nov15+1.5,nov15)).toBe('In 1h 30m (game time)');
  expect(formatGameCountdown(nov15+1.5,nov15+0.25)).toBe('In 1h 15m (game time)');
  expect(formatGameCountdown(nov15+1.5,nov15+1)).toBe('In 30m (game time)');
  expect(formatGameCountdown(nov15+1.5,nov15+1.5)).toBe('Due now');
 });
 it('formats multi-day construction work without exposing raw epoch hours',()=>{
  expect(formatGameCountdown(nov15+52,nov15)).toBe('In 2d 4h (game time)');
  expect(formatGameCountdown(nov15+0.25,nov15)).toBe('In 15m (game time)');
  expect(formatGameCountdown(NaN,nov15)).toBe('Time unavailable');
 });
 it('milestones switch to completed text once the delivery event happens',()=>{
  expect(milestoneCountdown(nov15+2,nov15,'Arrived')).toBe('In 2h (game time)');
  expect(milestoneCountdown(nov15+2,nov15+2,'Arrived')).toBe('Arrived');
  expect(milestoneCountdown(nov15+2,nov15+3,'Arrived')).toBe('Arrived');
 });
});