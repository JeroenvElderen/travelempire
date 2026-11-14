import {useEffect,useMemo,useState} from 'react';
import {Download,Trash2,RefreshCw,Activity,AlertTriangle} from 'lucide-react';
import {financialAuditEntries,financialAuditReport,financialAuditTotals,clearFinancialAudit,transactionLedgerReport,type LedgerTransaction,type FinancialAuditEntry} from '../financialDiagnostics';
import './FrontendConsole.css';
const eur=(n:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(n);
const stamp=()=>new Date().toISOString().replace(/[:.]/g,'-');
const save=(name:string,body:string,mime:string)=>{const url=URL.createObjectURL(new Blob([body],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),10000)};
const csvCell=(v:unknown)=>'"'+String(v??'').replace(/"/g,'""')+'"';
const exportCsv=(entries:FinancialAuditEntry[])=>{
 const headers=['id','realTime','gameTime','kind','description','reference','gross','operatingCost','bankShare','savings','other','cashDelta','cashBefore','pendingBefore','pendingAfter','cashAfter','discrepancy','warnings','breakdown','bankLenders'];
 return [headers.join(','),...entries.map(e=>headers.map(h=>csvCell((e as unknown as Record<string,unknown>)[h] instanceof Object?JSON.stringify((e as unknown as Record<string,unknown>)[h]):(e as unknown as Record<string,unknown>)[h])).join(','))].join('\n');
};
export default function FinancialConsole({transactions=[]}:{transactions?:readonly LedgerTransaction[]}){
 const [entries,setEntries]=useState<FinancialAuditEntry[]>(financialAuditEntries);
 const [kind,setKind]=useState('all'),[query,setQuery]=useState(''),[paused,setPaused]=useState(false),[issuesOnly,setIssuesOnly]=useState(false);
 useEffect(()=>{if(paused)return;const id=window.setInterval(()=>setEntries(financialAuditEntries()),1000);return()=>window.clearInterval(id)},[paused]);
 const types=useMemo(()=>[...new Set(entries.map(e=>e.kind))].sort(),[entries]);
 const totals=useMemo(()=>financialAuditTotals(entries),[entries]);
 const visible=useMemo(()=>entries.filter(e=>(kind==='all'||e.kind===kind)&&(!issuesOnly||(e.warnings?.length??0)>0)&&(!query||(e.description+' '+e.kind+' '+JSON.stringify(e.breakdown??{})+' '+JSON.stringify(e.bankLenders??{})).toLowerCase().includes(query.toLowerCase()))).reverse(),[entries,kind,query,issuesOnly]);
 const expenseRows=Object.entries(totals.byCategory).filter(([,n])=>n!==0).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
 const lenderRows=Object.entries(totals.byLender).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]);
 return <section className="te-console">
  <header className="te-console-head"><div><small>DEVELOPER TOOLS · FINANCIAL AUDIT</small><h1>Financial console</h1><p>Detailed cash movements, income, operating expenses, financing, transfers and reconciliation alerts. Read-only: does not change company finances.</p></div><span className="te-console-live"><Activity size={16}/>{paused?'Paused':'Live'}</span></header>
  <div className="te-console-metrics">
   <article><small>GROSS RECEIPTS</small><strong>{eur(totals.gross)}</strong><span>Audited settlements</span></article>
   <article><small>OPERATING COSTS</small><strong>{eur(totals.operatingCost)}</strong><span>Recorded cost total</span></article>
   <article><small>BANK REVENUE SHARES</small><strong>{eur(totals.bankShare)}</strong><span>25% + 16% agreements</span></article>
   <article><small>AUTOMATIC SAVINGS</small><strong>{eur(totals.savings)}</strong><span>Operating to savings</span></article>
   <article><small>OTHER CASH MOVEMENTS</small><strong>{eur(totals.other)}</strong><span>Signed loans, taxes, transfers etc.</span></article>
   <article><small>NET AUDITED CASH DELTA</small><strong>{eur(totals.cashDelta)}</strong><span>Flushes excluded</span></article>
   <article><small>ALERTS</small><strong>{totals.warnings}</strong><span>Reconciliation warnings</span></article>
   <article><small>EVENTS</small><strong>{entries.length}</strong><span>Latest 5,000 in memory</span></article>
  </div>
  <div className="te-console-metrics">
   <article><small>EXPENSES BY CATEGORY</small>{expenseRows.length?expenseRows.map(([name,value])=><div key={name} className="te-finance-detail"><span>{name}</span><b>{eur(value)}</b></div>):<span>No expense breakdown captured yet</span>}</article>
   <article><small>BANK COLLECTIONS BY LENDER</small>{lenderRows.length?lenderRows.map(([name,value])=><div key={name} className="te-finance-detail"><span>{name}</span><b>{eur(value)}</b></div>):<span>No lender collections yet</span>}</article>
  </div>
  <div className="te-console-toolbar"><label>Event type<select value={kind} onChange={e=>setKind(e.target.value)}><option value="all">All financial events</option>{types.map(t=><option key={t} value={t}>{t}</option>)}</select></label><label>Search<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ferry, wages, fuel, bank, taxes…"/></label>
   <label className="te-finance-checkbox"><input type="checkbox" checked={issuesOnly} onChange={e=>setIssuesOnly(e.target.checked)}/> Alerts only</label>
   <button onClick={()=>setPaused(v=>!v)}>{paused?'Resume':'Pause'}</button><button onClick={()=>setEntries(financialAuditEntries())}><RefreshCw size={15}/> Refresh</button>
   <button onClick={()=>save('travelempire-financial-'+stamp()+'.log',financialAuditReport()+'\\n'+transactionLedgerReport(transactions),'text/plain;charset=utf-8')}><Download size={15}/> Detailed .log</button>
   <button onClick={()=>save('travelempire-financial-'+stamp()+'.csv',exportCsv(entries),'text/csv;charset=utf-8')}><Download size={15}/> CSV</button>
   <button onClick={()=>{clearFinancialAudit();setEntries([])}}><Trash2 size={15}/> Clear</button>
  </div>
  <div className="te-console-explainer"><AlertTriangle size={17}/><span>Only events instrumented by the game are counted. Missing historical transactions are not zero. Cash-flush records are excluded from income totals to prevent double counting. Download before refreshing Safari; this in-memory capture resets on reload.</span></div>
  <div className="te-console-log" role="log" aria-label="Financial audit events">
   {visible.length?visible.map(e=><div className={'te-console-entry'+((e.warnings?.length??0)?' issue':'')} key={e.id}>
    <time>{e.realTime.slice(11,19)}</time><span className="te-console-category">{e.kind}</span>
    <div className="te-console-message"><strong>{e.description}</strong> · game {e.gameTime}
     <div>Revenue {eur(e.gross)} · operating cost {eur(e.operatingCost)} · bank {eur(e.bankShare)} · savings {eur(e.savings)} · other {eur(e.other)}</div>
     <div>Cash delta {eur(e.cashDelta)} · committed cash {eur(e.cashBefore)} · pending {eur(e.pendingBefore)} → {eur(e.pendingAfter)} · projected {eur(e.cashAfter)}</div>
     {Object.entries(e.breakdown??{}).filter(([,n])=>n!==0).map(([name,amount])=><div key={name} className="te-finance-line">{name}: {eur(amount)}</div>)}
     {Object.entries(e.bankLenders??{}).filter(([,n])=>n!==0).map(([name,amount])=><div key={name} className="te-finance-line">Bank · {name}: {eur(amount)}</div>)}
     {e.reference&&<div className="te-finance-line">Reference: {e.reference}</div>}
     {e.warnings?.map((warning,i)=><div key={i} className="te-finance-warning">⚠ {warning}</div>)}
    </div>
   </div>):<p>No matching financial events. Leave the simulation running to record new transactions.</p>}
  </div>
 </section>
}
