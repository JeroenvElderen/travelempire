import {describe,expect,it} from 'vitest';
import {asEuros,defaultInvestmentEuros,investmentLimitCents,selectedInvestmentCents} from './investmentAmounts';
describe('independent property slider purchase bounds',()=>{
 it('limits a hotel investment by cash when ownership is available',()=>{
  expect(investmentLimitCents(50000000,1200.45)).toBe(120045);
 });
 it('limits a parking investment by remaining shares even with enough cash',()=>{
  expect(investmentLimitCents(12345,100000)).toBe(12345);
 });
 it('preserves arbitrary exact euro and cent input',()=>{
  expect(selectedInvestmentCents('123.47',12347)).toBe(12347);
  expect(selectedInvestmentCents('0.01',12347)).toBe(1);
  expect(asEuros(12347)).toBe('123.47');
 });
 it('rejects over-limit, negative, excessive decimals and zero',()=>{
  expect(selectedInvestmentCents('123.48',12347)).toBe(0);
  expect(selectedInvestmentCents('-2',12347)).toBe(0);
  expect(selectedInvestmentCents('1.234',12347)).toBe(0);
  expect(selectedInvestmentCents('0',12347)).toBe(0);
 });
 it('respects empty cash balance and full ownership',()=>{
  expect(investmentLimitCents(10000,0)).toBe(0);
  expect(investmentLimitCents(0,1000)).toBe(0);
  expect(defaultInvestmentEuros(0)).toBe('0.00');
 });
 it('defaults to the smaller of €15,000 and the spendable maximum',()=>{
  expect(defaultInvestmentEuros(1500020)).toBe('15000.00');
  expect(defaultInvestmentEuros(100)).toBe('1.00');
 });
});
