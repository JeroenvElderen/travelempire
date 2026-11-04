import {useState} from 'react';
import type {Company} from '../company';
import type {FleetState} from '../simulation/taxi';
import {accountingOf,balanceSheet,periodLiability,roundMoney} from '../accounting';
import './accounting-panel.css';
const eur=(n:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(n);
type Props={company:Company|null;fleet:FleetState;onSettings:(corporateRate:number,vatRate:number)=>void};
export default function AccountingPanel({company,fleet,onSettings}:Props){
 const state=accountingOf(fleet.accounting);
 const [corporate,setCorporate]=useState(String(state.settings.corporateRate));
 const [vat,setVat]=useState(String(state.settings.vatRate));
 const [selected,setSelected]=useState('all');
 const periods=state.periods.slice().sort((a,b)=>b.month.localeCompare(a.month));
 const filtered=selected==='all'?periods:periods.filter(p=>p.month===selected);
 const totals=filtered.reduce((a,p)=>({grossRevenue:a.grossRevenue+p.grossRevenue,netRevenue:a.netRevenue+p.netRevenue,expenses:a.expenses+p.netExpenses,vatCollected:a.vatCollected+p.vatCollected,vatInput:a.vatInput+p.vatInput,depreciation:a.depreciation+p.depreciation,corporateTax:a.corporateTax+p.corporateTax,vatPaid:a.vatPaid+p.vatPaid,taxPaid:a.taxPaid+p.corporateTaxPaid}),{grossRevenue:0,netRevenue:0,expenses:0,vatCollected:0,vatInput:0,depreciation:0,corporateTax:0,vatPaid:0,taxPaid:0});
 const profitBeforeTax=totals.netRevenue-totals.expenses-totals.depreciation;
 const sheet=balanceSheet(fleet,company?.cash??0);
 const bank=fleet.bank;
 const ledger=fleet.transactions??[];
 const cashFlow=ledger.reduce((a,t)=>{
  const d=t.description.toLowerCase();
  if(d.includes('vehicle purchase')||d.includes('depot')&&d.includes('upgrade')||d.includes('new depot')||d.includes('ferry route purchase'))a.investing+=t.amount;
  else if(d.includes('loan')||d.includes('finance payoff')||d.includes('vehicle sale'))a.financing+=t.amount;
  else a.operating+=t.amount;
  return a;
 },{operating:0,investing:0,financing:0});
 const bankTaxPayments=(bank?.entries??[]).filter(e=>e.description.includes('tax settlement')||e.description.includes('VAT settlement'));
 const download=()=>{
  const header='Month,Gross revenue,Net revenue,Net expenses,Depreciation,VAT collected,Input VAT,Corporate tax,VAT paid,Corporate tax paid,Outstanding liability';
  const rows=periods.map(p=>[p.month,p.grossRevenue,p.netRevenue,p.netExpenses,p.depreciation,p.vatCollected,p.vatInput,p.corporateTax,p.vatPaid,p.corporateTaxPaid,periodLiability(p)].map((v,i)=>i===0?v:roundMoney(Number(v))).join(','));
  const csv=[header,...rows].join('\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='travelempire-accounting.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 return <section className="accounting-panel">
  <div className="accounting-heading"><div><h2>Company accounting</h2><p>Gameplay taxes · monthly settlement · VAT-inclusive passenger fares</p></div><button onClick={download}>Export accounting CSV</button></div>
  <div className="accounting-settings"><label>Corporate income tax (%)<input type="number" min={0} max={40} step={1} value={corporate} onChange={e=>setCorporate(e.target.value)}/></label><label>Passenger fare VAT (%)<input type="number" min={0} max={25} step={1} value={vat} onChange={e=>setVat(e.target.value)}/></label><button disabled={!Number.isFinite(Number(corporate))||!Number.isFinite(Number(vat))||corporate===''||vat===''} onClick={()=>onSettings(Number(corporate),Number(vat))}>Save tax rates</button><small>Default: 22% corporate tax and 13% VAT. Tax rates are fictional gameplay parameters, not legal advice. Updated rates apply to new accruals; current-period corporate tax is recalculated using the selected rate.</small></div>
  <div className="accounting-heading"><h3>Financial statements</h3><label>Period <select value={selected} onChange={e=>setSelected(e.target.value)}><option value="all">All recorded periods</option>{periods.map(p=><option key={p.month} value={p.month}>{p.month}</option>)}</select></label></div>
  <div className="accounting-metrics"><article><small>NET REVENUE (EX VAT)</small><strong>{eur(totals.netRevenue)}</strong></article><article><small>PROFIT BEFORE TAX</small><strong>{eur(profitBeforeTax)}</strong></article><article><small>NET PROFIT AFTER TAX</small><strong>{eur(profitBeforeTax-totals.corporateTax)}</strong></article><article><small>UNPAID TAX LIABILITIES</small><strong>{eur(periods.reduce((sum,p)=>sum+periodLiability(p),0))}</strong></article></div>
  <div className="accounting-columns"><article><h3>Profit & loss</h3><div><span>Gross revenue</span><strong>{eur(totals.grossRevenue)}</strong></div><div><span>Output VAT (included in fares)</span><strong>{eur(totals.vatCollected)}</strong></div><div><span>Net revenue</span><strong>{eur(totals.netRevenue)}</strong></div><div><span>Operating expenses (net eligible VAT)</span><strong>{eur(totals.expenses)}</strong></div><div><span>Non-cash vehicle depreciation</span><strong>{eur(totals.depreciation)}</strong></div><div><span>Corporate income tax</span><strong>{eur(totals.corporateTax)}</strong></div><div><span>Net accounting profit</span><strong>{eur(profitBeforeTax-totals.corporateTax)}</strong></div></article>
  <article><h3>Balance sheet</h3><div><span>Operating + savings + reserve cash</span><strong>{eur(sheet.cash)}</strong></div><div><span>Owned vehicle book value</span><strong>{eur(sheet.vehicles)}</strong></div><div><span>Total tracked assets</span><strong>{eur(sheet.assets)}</strong></div><div><span>Outstanding loans</span><strong>{eur(sheet.loans)}</strong></div><div><span>Unpaid taxes</span><strong>{eur(sheet.taxLiabilities)}</strong></div><div><span>Tracked equity</span><strong>{eur(sheet.equity)}</strong></div></article></div>
  <div className="accounting-columns"><article><h3>VAT & tax settlements</h3><div><span>Output VAT</span><strong>{eur(totals.vatCollected)}</strong></div><div><span>Eligible input VAT credit</span><strong>{eur(totals.vatInput)}</strong></div><div><span>VAT paid</span><strong>{eur(totals.vatPaid)}</strong></div><div><span>Corporate tax paid</span><strong>{eur(totals.taxPaid)}</strong></div><p>At the start of each new simulated calendar month, previous-month liabilities are paid from available operating cash. Unpaid balances carry forward and are retried automatically.</p>{bankTaxPayments.slice(0,12).map(e=><div key={e.id}><span>{new Date(e.time).toLocaleDateString()} · {e.description}</span><strong>{eur(e.amount)}</strong></div>)}</article>
  <article><h3>Cash flow · available transaction history</h3><div><span>Operating</span><strong>{eur(cashFlow.operating)}</strong></div><div><span>Investing</span><strong>{eur(cashFlow.investing)}</strong></div><div><span>Financing</span><strong>{eur(cashFlow.financing)}</strong></div><p>Cash flow is an activity-based summary from the retained transaction ledger. Older transactions and some scheduled transfers may be unavailable; it is not a reconciled lifetime statement.</p></article></div>
  <h3>Monthly accounting ledger</h3><div className="accounting-periods">{periods.map(p=><article key={p.month}><strong>{p.month} · {p.closed?'Closed':'Current'}</strong><span>Revenue {eur(p.netRevenue)} · Expenses {eur(p.netExpenses)} · Depreciation {eur(p.depreciation)}</span><span>Corporate tax {eur(p.corporateTax)} · VAT net {eur(Math.max(0,p.vatCollected-p.vatInput))}</span><span>Outstanding {eur(periodLiability(p))}</span></article>)}</div>
  {!periods.length&&<p>Accounting records begin with Phase 1.5. Earlier periods are not retroactively taxed.</p>}
  <p className="accounting-note">Leased vehicles are excluded from owned assets; lease instalments are operating expenses. Loan principal is financing cash flow, not a P&L expense. Vehicle depreciation is non-cash. Vehicle values use recorded purchase prices when available and an estimated opening value for legacy vehicles. This is a simplified game accounting model.</p>
 </section>;
}
