import {describe,it,expect} from 'vitest';
import {accountingOf,accountingSettingsFor,bookAccounting,settleAccounting,periodLiability} from './accounting';
describe('country-specific tax scheduling and migration',()=>{
 it('configures Greek and Irish rates without equating VAT with corporation tax',()=>{
  expect(accountingSettingsFor('GR')).toMatchObject({corporateRate:22,vatRate:13,vatFrequencyMonths:1});
  expect(accountingSettingsFor('IE')).toMatchObject({corporateRate:12.5,vatRate:0,vatFrequencyMonths:2});
 });
 it('never sweeps previous month tax before its VAT filing deadline',()=>{
  const state=bookAccounting(undefined,'2027-01',11300,0,0,0);
  const before=settleAccounting(state,'2027-02',5000,Date.parse('2027-02-01T12:00:00Z'));
  expect(before.paidVat).toBe(0);
  expect(before.paidCorporate).toBe(0);
  const due=settleAccounting(before.accounting,'2027-02',5000,Date.parse('2027-02-28T12:00:00Z'));
  expect(due.paidVat).toBe(1300);
  expect(due.paidCorporate).toBe(0);
  expect(settleAccounting(due.accounting,'2027-02',5000,Date.parse('2027-02-28T18:00:00Z')).paidVat).toBe(0);
 });
 it('quarantines legacy liabilities without deleting or paying them',()=>{
  const old=bookAccounting(undefined,'2026-12',11300,0,0,0);
  const legacy={...old,schemaVersion:undefined,settings:{corporateRate:22,vatRate:13,settlement:'monthly' as const}};
  const before=periodLiability(legacy.periods[0]);
  const migrated=accountingOf(legacy);
  expect(migrated.legacyTaxReviewRequired).toBe(true);
  const result=settleAccounting(migrated,'2028-08',100000,Date.parse('2028-08-31T00:00:00Z'));
  expect(result.paidVat).toBe(0);
  expect(result.paidCorporate).toBe(0);
  expect(periodLiability(result.accounting.periods[0])).toBe(before);
 });
 it('corporate tax is not due at the VAT due date',()=>{
  const state=bookAccounting(undefined,'2026-12',11300,0,0,0);
  const feb=settleAccounting(state,'2027-02',10000,Date.parse('2027-02-28T00:00:00Z'));
  expect(feb.paidCorporate).toBe(0);
  const july=settleAccounting(feb.accounting,'2027-07',10000,Date.parse('2027-07-31T00:00:00Z'));
  expect(july.paidCorporate).toBeGreaterThan(0);
 });
});
