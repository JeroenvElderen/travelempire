import {useEffect,useMemo,useState} from 'react';
import {diagnosticEntries,diagnosticReport,diagnostic,clearDiagnostics,type DiagnosticEntry} from '../frontendDiagnostics';
import {Copy,Trash2,RefreshCw,AlertTriangle,Activity} from 'lucide-react';
import './FrontendConsole.css';
export default function FrontendConsole(){
 const [items,setItems]=useState<DiagnosticEntry[]>(()=>diagnosticEntries());
 const [filter,setFilter]=useState('all'),[search,setSearch]=useState(''),[paused,setPaused]=useState(false),[copied,setCopied]=useState(false);
 useEffect(()=>{if(paused)return;const refresh=()=>setItems(diagnosticEntries());refresh();const id=window.setInterval(refresh,1000);return()=>window.clearInterval(id)},[paused]);
 const categories=useMemo(()=>Array.from(new Set(items.map(e=>e.category))).sort(),[items]);
 const isIssue=(e:DiagnosticEntry)=>/error|warn|promise|longtask|gap|slow|failure/i.test(e.category+' '+e.message);
 const visible=useMemo(()=>items.filter(e=>(filter==='all'||(filter==='issues'?isIssue(e):e.category===filter))&&(!search||(e.category+' '+e.message).toLowerCase().includes(search.toLowerCase()))).slice().reverse(),[items,filter,search]);
 const issues=items.filter(isIssue).length;
 const frames=items.filter(e=>e.category==='frames').slice(-12).map(e=>Number(e.message.match(/fps=(\d+)/)?.[1]??0)).filter(Boolean);
 const fps=frames.length?Math.round(frames.reduce((a,b)=>a+b,0)/frames.length):null;
 const lastFrame=items.filter(e=>e.category==='frames').at(-1);
 const copy=async()=>{const report=diagnosticReport()+'\n\n--- Filtered view ---\n'+visible.map(e=>e.ms+'ms | '+e.category+' | '+e.message).join('\n');try{await navigator.clipboard.writeText(report);setCopied(true)}catch{const blob=new Blob([report],{type:'text/plain'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='travelempire-diagnostics.txt';link.click();URL.revokeObjectURL(url)}};
 return <section className="te-console">
  <header className="te-console-head"><div><small>DEVELOPER TOOLS · LIVE DIAGNOSTICS</small><h1>Frontend console</h1><p>Inspect startup, rendering, road loading, simulation and browser failures without opening developer tools.</p></div><span className="te-console-live"><Activity size={16}/> {paused?'Paused':'Live'}</span></header>
  <div className="te-console-metrics"><article><small>EVENTS RETAINED</small><strong>{items.length}</strong><span>Latest 1,500 events</span></article><article><small>ISSUES / SLOW EVENTS</small><strong>{issues}</strong><span>Review warnings and stalls</span></article><article><small>AVERAGE FPS</small><strong>{fps??'—'}</strong><span>Recent sampled frames</span></article><article><small>LAST FRAME SAMPLE</small><strong>{lastFrame?Math.round((performance.now()-lastFrame.ms)/1000)+'s':'—'}</strong><span>Time since frame report</span></article></div>
  <div className="te-console-toolbar"><label>Category<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All events</option><option value="issues">Issues and slowdowns</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></label><label>Search<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filter messages, routes, workers…"/></label><button onClick={()=>setPaused(v=>!v)}>{paused?'Resume':'Pause'} updates</button><button onClick={()=>{setItems(diagnosticEntries());setCopied(false)}}><RefreshCw size={15}/> Refresh</button><button onClick={()=>void copy()}><Copy size={15}/> {copied?'Copied':'Copy report'}</button><button onClick={()=>{clearDiagnostics();diagnostic('session','Log cleared manually');setItems(diagnosticEntries())}}><Trash2 size={15}/> Clear</button></div>
  <div className="te-console-explainer"><AlertTriangle size={17}/><span>Issues include errors, warnings, frame gaps and slow operations. A slow event does not always mean a fault. Logs stay in memory and reset on reload; copy the report before refreshing.</span></div>
  <div className="te-console-log" role="log" aria-label="Frontend diagnostic events">{visible.length?visible.map((e,i)=><div className={isIssue(e)?'te-console-entry issue':'te-console-entry'} key={e.ms+'-'+i}><time>{(e.ms/1000).toFixed(1)}s</time><span className="te-console-category">{e.category}</span><span className="te-console-message">{e.message}</span></div>):<p>No events match these filters.</p>}</div>
 </section>
}