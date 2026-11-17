import {describe,it,expect} from 'vitest';
import {postFinance,detailedFinanceBreakdown} from './financeJournal';
describe('Detailed financial accounting',()=>{
 const now=Date.parse('2026-12-09T19:30:00Z');
 const history=[{day:'2026-12-09',revenue:100,expenses:50,trips:0}];
 it('preserves category postings without rounding away revenue',()=>{
  const journal=postFinance(undefined,[
   {day:'2026-12-09',side:'income',category:'taxi.fares',amount:40},
   {day:'2026-12-09',side:'income',category:'ferry.fares',amount:60},
   {day:'2026-12-09',side:'expense',category:'taxi.fuel',amount:30},
   {day:'2026-12-09',side:'expense',category:'taxi.payroll',amount:20},
  ]);
  expect(detailedFinanceBreakdown(journal,history,now,'income').map(r=>r.value)).toEqual([60,40]);
  expect(detailedFinanceBreakdown(journal,history,now,'expense').reduce((s,r)=>s+r.value,0)).toBe(50);
 });
 it('never invents missing legacy classifications',()=>{
  const journal=postFinance(undefined,[{day:'2026-12-09',side:'income',category:'ferry.fares',amount:60}]);
  expect(detailedFinanceBreakdown(journal,history,now,'income').find(r=>r.category==='legacy.income')?.value).toBe(40);
  expect(detailedFinanceBreakdown(journal,history,now,'expense')[0].category).toBe('legacy.expense');
 });
 it('does not mistake financing transfers for operating income',()=>{
  const journal=postFinance(undefined,[{day:'2026-12-09',side:'income',category:'taxi.fares',amount:100}]);
  expect(detailedFinanceBreakdown(journal,history,now,'income')).toHaveLength(1);
 });
 it('ignores invalid postings and bounds stored game-day history',()=>{
  const journal=postFinance(undefined,[{day:'bad',side:'income',category:'taxi.fares',amount:100},
   {day:'2026-12-09',side:'income',category:'taxi.fares',amount:NaN}]);
  expect(Object.keys(journal)).toHaveLength(0);
 });
});