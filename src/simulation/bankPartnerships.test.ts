import {describe,expect,it} from 'vitest';
import {collectBankRevenue,partnershipOffer,revenueAverage,type BankPartnership} from './bankPartnerships';

const contract=(overrides:Partial<BankPartnership>={}):BankPartnership=>({
 id:'one',bank:'Growth Capital Bank',principal:2000000,revenueShare:18,
 repaymentMultiple:1.45,repaymentCap:2900000,repaid:0,startedAt:0,...overrides,
});
describe('revenue-backed bank partnerships',()=>{
 it('offers a two million deal for a profitable company with adequate valuation',()=>{
  const offer=partnershipOffer('growth',2000000,666284.58,7359.52,636,[]);
  expect(offer.approved).toBe(true);
  expect(offer.funding).toBe(2000000);
  expect(offer.repaymentCap).toBe(2900000);
 });
 it('counters requests larger than affordable funding',()=>{
  const offer=partnershipOffer('conservative',2000000,666284.58,7359.52,636,[]);
  expect(offer.funding).toBeLessThan(offer.requested);
  expect(offer.approved).toBe(true);
 });
 it('counters an aggressively low revenue-share proposal',()=>{
  const offer=partnershipOffer('growth',2000000,666284.58,7359.52,636,[],5);
  expect(offer.approved).toBe(true);
  expect(offer.revenueShare).toBe(18);
  expect(offer.reason).toContain('counters');
 });
 it('rewards a higher negotiated share with a lower repayment multiple',()=>{
  const base=partnershipOffer('growth',2000000,666284.58,7359.52,636,[],18);
  const revised=partnershipOffer('growth',2000000,666284.58,7359.52,636,[],25);
  expect(revised.repaymentMultiple).toBeLessThan(base.repaymentMultiple);
 });
 it('collects the contracted share of gross revenue',()=>{
  const r=collectBankRevenue([contract()],10000);
  expect(r.paid).toBe(1800);
  expect(r.deals[0].repaid).toBe(1800);
 });
 it('never collects above the repayment cap',()=>{
  const r=collectBankRevenue([contract({repaymentCap:1000,repaid:999})],10000);
  expect(r.paid).toBe(1);
  expect(collectBankRevenue(r.deals,10000).paid).toBe(0);
 });
 it('does not collect on non-revenue cash movements',()=>{
  expect(collectBankRevenue([contract()],0).paid).toBe(0);
 });
 it('rejects agreements above combined revenue share threshold',()=>{
  const r=partnershipOffer('empire',2000000,3000000,8000,700,[contract({revenueShare:25})]);
  expect(r.approved).toBe(false);
 });
 it('calculates daily history revenue average',()=>{
  expect(revenueAverage([{revenue:400},{revenue:600}])).toBe(500);
 });
});
