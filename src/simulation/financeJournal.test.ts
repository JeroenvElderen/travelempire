import {describe,it,expect} from 'vitest';
import {postFinance,detailedFinanceBreakdown,financePeriodRows,divisionFinanceReport,recordDailyOperatingExpense} from './financeJournal';
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

describe('game-time division reporting',()=>{
 it('uses simulated dates and excludes future snapshots',()=>{
  const rows=['2030-01-01','2030-01-05','2030-01-10','2030-01-11'].map(day=>({day,revenue:10,expenses:2,trips:1}));
  expect(financePeriodRows(rows,Date.parse('2030-01-10T12:00:00Z'),7).map(r=>r.day)).toEqual(['2030-01-05','2030-01-10']);
 });
 it('reconciles separate divisions and preserves unknown legacy expenses',()=>{
  const day='2030-01-10';
  const history=[{day,revenue:150,expenses:70,trips:1}];
  const journal=postFinance(undefined,[
   {day,side:'income',category:'taxi.fares',amount:100},
   {day,side:'income',category:'ferry.fares',amount:50},
   {day,side:'expense',category:'ferry.operations',amount:20},
   {day,side:'expense',category:'collector.operations',amount:10},
  ]);
  const report=divisionFinanceReport(journal,history);
  expect(report.find(r=>r.division==='Ferries')).toMatchObject({profit:30,margin:60});
  expect(report.find(r=>r.division==='Resource logistics')).toMatchObject({profit:-10,margin:null});
  expect(report.find(r=>r.division==='Unclassified / legacy')?.expenses).toBe(40);
  expect(report.reduce((sum,r)=>sum+r.profit,0)).toBe(80);
 });
 it('posts collector costs without overwriting same-day revenue or other expenses',()=>{
  const day='2030-01-10',history=[{day,revenue:100,expenses:20,trips:1}];
  expect(recordDailyOperatingExpense(history,day,15)).toEqual([{day,revenue:100,expenses:35,trips:1}]);
  expect(history[0].expenses).toBe(20);
  expect(recordDailyOperatingExpense(history,'2030-01-09',5)[0].expenses).toBe(5);
 });
});
