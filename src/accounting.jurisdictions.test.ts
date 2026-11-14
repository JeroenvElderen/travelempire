import {describe,it,expect} from 'vitest';
import {accountingOf,accountingSettingsFor,bookAccounting,settleAccounting,periodLiability,balanceSheet} from './accounting';
describe('tax-free economy and historical archive',()=>{
 it('retains future jurisdiction profiles for eventual reactivation',()=>{
  expect(accountingSettingsFor('GR').corporateRate).toBe(22);
  expect(accountingSettingsFor('IE').vatFrequencyMonths).toBe(2);
 });
 it('never accrues or collects tax even when game advances',()=>{
  const state=bookAccounting(undefined,'2027-01',11300,1000,1000,100);
  expect(state.periods[0]).toMatchObject({netRevenue:11300,netExpenses:1000,vatCollected:0,vatInput:0,corporateTax:0});
  const paid=settleAccounting(state,'2028-07',100000,Date.parse('2028-07-31T12:00:00Z'));
  expect(paid.paidVat).toBe(0);
  expect(paid.paidCorporate).toBe(0);
 });
 it('archives historical debt once and removes it from active liability without changing payments',()=>{
  const legacy={settings:{corporateRate:22,vatRate:13,settlement:'monthly' as const},periods:[{
   month:'2026-12',grossRevenue:11300,netRevenue:10000,grossExpenses:1000,netExpenses:900,
   vatCollected:1300,vatInput:100,depreciation:100,corporateTax:1980,vatPaid:200,corporateTaxPaid:300,closed:true
  }]};
  const before=periodLiability(legacy.periods[0]);
  const migrated=accountingOf(legacy);
  expect(migrated.taxesDisabled).toBe(true);
  expect(migrated.archivedTaxPeriods?.[0].vatPaid).toBe(200);
  expect(periodLiability(migrated.archivedTaxPeriods![0])).toBe(before);
  expect(periodLiability(migrated.periods[0])).toBe(0);
  expect(migrated.periods[0].netRevenue).toBe(11300);
  expect(accountingOf(migrated).archivedTaxPeriods).toEqual(migrated.archivedTaxPeriods);
  expect(settleAccounting(migrated,'2028-07',100000).paidVat).toBe(0);
 });
});
