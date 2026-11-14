import {beforeEach,describe,expect,it} from 'vitest';
import {clearFinancialAudit,financialAuditEntries,financialAuditTotals,financialAuditReport,recordFinancialAudit} from './financialDiagnostics';
beforeEach(clearFinancialAudit);
const entry=(overrides:Record<string,unknown>={})=>({
 gameTime:'2027-01-05T05:00:00.000Z',kind:'ferry',description:'Ferry fare',gross:1600,operatingCost:353.4,bankShare:656,savings:0,other:0,
 cashBefore:-4,pendingBefore:0,pendingAfter:590.6,bankLenders:{Empire:400,Growth:256},breakdown:{'Ferry operating costs':353.4},...overrides
});
describe('financial audit',()=>{
 it('reconciles a 25% + 16% ferry settlement',()=>{
  recordFinancialAudit(entry());
  const [e]=financialAuditEntries();
  expect(e.cashDelta).toBe(590.6);
  expect(e.bankShare).toBe(656);
  expect(e.discrepancy).toBe(0);
  expect(e.warnings).toEqual([]);
  expect(financialAuditTotals([e]).byLender).toEqual({Empire:400,Growth:256});
 });
 it('excludes flushes from income and settlement totals',()=>{
  recordFinancialAudit(entry());
  recordFinancialAudit(entry({kind:'cash-flush',description:'Flush',gross:0,operatingCost:0,bankShare:0,other:590.6,cashBefore:-4,cashAfter:586.6,pendingBefore:590.6,pendingAfter:0}));
  expect(financialAuditTotals(financialAuditEntries()).gross).toBe(1600);
  expect(financialAuditTotals(financialAuditEntries()).cashDelta).toBe(590.6);
 });
 it('does not report a cash flush as a pending-cash discrepancy',()=>{
  recordFinancialAudit(entry());
  recordFinancialAudit(entry({kind:'cash-flush',description:'Flush',gross:0,operatingCost:0,bankShare:0,savings:0,other:590.6,cashBefore:-4,cashAfter:586.6,pendingBefore:590.6,pendingAfter:0}));
  const flush=financialAuditEntries()[1];
  expect(flush.discrepancy).toBe(0);
  expect(flush.warnings).toEqual([]);
 });
 it('does not invent missing-money warnings from interleaved event snapshots',()=>{
  recordFinancialAudit(entry());
  recordFinancialAudit(entry({kind:'cash-flush',gross:0,operatingCost:0,bankShare:0,savings:0,other:590.6,cashBefore:-4,cashAfter:586.6,pendingBefore:590.6,pendingAfter:0}));
  recordFinancialAudit(entry({cashBefore:586.6,pendingBefore:-464.7,pendingAfter:125.9}));
  expect(financialAuditEntries()[2].warnings).toEqual([]);
 });
 it('flags a flush whose committed cash does not match the transfer',()=>{
  recordFinancialAudit(entry({kind:'cash-flush',gross:0,operatingCost:0,bankShare:0,savings:0,other:590.6,cashBefore:-4,cashAfter:500,pendingBefore:590.6,pendingAfter:0}));
  expect(financialAuditEntries()[0].warnings?.join(' ')).toContain('Cash flush does not match');
 });
 it('flags unexplained pending balance changes and exports itemized records',()=>{
  recordFinancialAudit(entry({pendingAfter:100}));
  expect(financialAuditEntries()[0].warnings?.length).toBeGreaterThan(0);
  const log=financialAuditReport();
  expect(log).toContain('EXPENSE BREAKDOWN');
  expect(log).toContain('Ferry operating costs');
  expect(log).toContain('Empire');
 });
});
