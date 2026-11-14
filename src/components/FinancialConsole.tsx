import {useEffect,useMemo,useState} from 'react';
import {Download,Trash2,RefreshCw,Activity,AlertTriangle} from 'lucide-react';
import {financialAuditEntries,financialAuditReport,clearFinancialAudit,type FinancialAuditEntry} from '../financialDiagnostics';
import './FrontendConsole.css';
const eur=(n:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(n);
export default function FinancialConsole(){
 const [entries,setEntries]=useState<FinancialAuditEntry[]>(financialAuditEntries);
 const [kind,setKind]=useState('all'),[query,setQuery]=useState(''),[paused,setPaused]=useState(false);
 useEffect(()=>{if(paused)return;const id=window.setInterval(()=>setEntries(financialAuditEntries()),1000);return()=>window.clearInterval(id)},[paused]);
 const types=useMemo(()=>[...new Set(entries.map(e=>e.kind))].sort(),[entries]);
 const visible=useMemo(()=>entries.filter(e=>(kind==='all'||e.kind===kind)&&(!query||(e.description+' '+e.kind).toLowerCase().includes(query.toLowerCase()))).reverse(),[entries,kind,query]);
 const totals=useMemo(()=>entries.filter(e=>e.kind!=='cash-flush').reduce((a,e)=>({gross:a.gross+e.gross,bank:a.bank+e.bankShare,savings:a.savings+e.savings,delta:a.delta+e.cashDelta}),{gross:0,bank:0,savings:0,delta:0}),[entries]);
 const download=()=>{const blob=new Blob([financialAuditReport()],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='travelempire-financial-'+new Date().toISOString().replace(/[:.]/g,'-')+'.log';document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),10000)};
 return <section className="te-console">
  <header className="te-console-head"><div><small>DEVELOPER TOOLS · FINANCIAL AUDIT</small><h1>Financial console</h1><p>Trace revenue, operating costs, bank revenue shares, automatic savings and cash flushes independently of map performance logs.</p></div><span className="te-console-live"><Activity size={16}/>{paused?'Paused':'Live'}</span></header>
  <div className="te-console-metrics"><article><small>RECORDED RECEIPTS</small><strong>{eur(totals.gross)}</strong><span>Audited events only</span></article><article><small>BANK COLLECTIONS</small><strong>{eur(totals.bank)}</strong><span>Revenue financing</span></article><article><small>SAVINGS TRANSFERS</small><strong>{eur(totals.savings)}</strong><span>Moved from operating cash</span></article><article><small>AUDITED CASH DELTA</small><strong>{eur(totals.delta)}</strong><span>Excludes flushes to avoid double counting</span></article></div>
  <div className="te-console-toolbar"><label>Event type<select value={kind} onChange={e=>setKind(e.target.value)}><option value="all">All financial events</option>{types.map(t=><option key={t} value={t}>{t}</option>)}</select></label><label>Search<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search settlement, bank, property…"/></label><button onClick={()=>setPaused(v=>!v)}>{paused?'Resume':'Pause'}</button><button onClick={()=>setEntries(financialAuditEntries())}><RefreshCw size={15}/> Refresh</button><button onClick={download}><Download size={15}/> Download financial log</button><button onClick={()=>{clearFinancialAudit();setEntries([])}}><Trash2 size={15}/> Clear</button></div>
  <div className="te-console-explainer"><AlertTriangle size={17}/><span>Entries are recorded in memory and reset on Safari reload. Download before closing the page. This audit covers instrumented settlements; it is not yet a complete historical cash ledger.</span></div>
  <div className="te-console-log" role="log" aria-label="Financial audit events">{visible.length?visible.map(e=><div className="te-console-entry" key={e.id}><time>{e.realTime.slice(11,19)}</time><span className="te-console-category">{e.kind}</span><span className="te-console-message">{e.description} · game {e.gameTime}
  {'\n'}Gross {eur(e.gross)} · costs {eur(e.operatingCost)} · bank {eur(e.bankShare)} · savings {eur(e.savings)} · other {eur(e.other)}
  {'\n'}Delta {eur(e.cashDelta)} · committed {eur(e.cashBefore)} · pending {eur(e.pendingBefore)} → {eur(e.pendingAfter)} · projected {eur(e.cashAfter)}</span></div>):<p>No financial events recorded yet. Leave the game running to capture new settlements.</p>}</div>
 </section>
}
