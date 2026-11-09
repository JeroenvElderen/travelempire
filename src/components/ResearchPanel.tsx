import {useState} from 'react';
import {Beaker,Clock3,FlaskConical,Coins,TrendingUp,CheckCircle2,ArrowUpRight,ShieldCheck} from 'lucide-react';
import type {Company} from '../company';
import {projects,categories,level,maxLevel,price,duration,type ResearchId,type ResearchState} from '../research';
import '../research.css';

type Tab='overview'|'projects'|'progress';
const icons:Record<ResearchId,typeof TrendingUp>=Object.fromEntries(projects.map(p=>[p.id,p.category===0?TrendingUp:p.category===7?Coins:Beaker])) as Record<ResearchId,typeof TrendingUp>;
const euro=(amount:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(amount);
const formatDuration=(ms:number)=>{const seconds=Math.ceil(Math.max(0,ms)/1000);const hours=Math.floor(seconds/3600);const minutes=Math.floor(seconds%3600/60);const secs=seconds%60;return hours>0?`${hours}h ${String(minutes).padStart(2,'0')}m ${String(secs).padStart(2,'0')}s`:`${minutes}m ${String(secs).padStart(2,'0')}s`;};
export default function ResearchPanel({company,state,discoveredRoads,explorerSpecializations,gameNow,onStart,onCancel}:{company:Company|null;state:ResearchState;discoveredRoads:number;explorerSpecializations:number;gameNow:number;onStart:(id:ResearchId)=>void;onCancel:()=>void}){
 const now=gameNow;
 const [tab,setTab]=useState<Tab>('overview');
 const [category,setCategory]=useState<number>(0);

 const completed=projects.reduce((total,p)=>total+level(state,p.id),0);
 const activeProject=state.active?projects.find(p=>p.id===state.active?.id):undefined;
 const progress=state.active?Math.min(100,Math.max(0,100*(now-state.active.startedAt)/Math.max(1,state.active.endsAt-state.active.startedAt))):0;
 const available=projects.filter(p=>level(state,p.id)<maxLevel(p.id)).length;
 const projectCard=(p:typeof projects[number])=>{
  const current=level(state,p.id),next=current+1,cost=price(p.id,next);
  const maxed=current>=maxLevel(p.id),prerequisiteMissing=p.id==='explorerExpansion'&&(discoveredRoads<5000||explorerSpecializations<1),locked=!!state.active||!company||company.cash<cost||prerequisiteMissing;
  const Icon=icons[p.id];
  return <article className="research-project" key={p.id}>
   <div className="research-project-top"><span className="research-project-icon"><Icon size={22}/></span><span className={maxed?'research-level-badge complete':'research-level-badge'}>{maxed?'MAX LEVEL':`LEVEL ${current} / ${maxLevel(p.id)}`}</span></div>
   <h3>{p.name}</h3><p>{p.effect}</p>
   <div className="research-level-track" aria-label={`${current} of ${maxLevel(p.id)} levels completed`}>{Array.from({length:maxLevel(p.id)},(_,i)=><span key={i} className={i<current?'filled':''}/>)}</div>
   <div className="research-project-details"><div><small>Next level</small><strong>{maxed?'Completed':`Level ${next}`}</strong></div><div><small>Research cost</small><strong>{maxed?'—':euro(cost)}</strong></div><div><small>Research time</small><strong>{maxed?'—':formatDuration(duration(state,next,p.id))}</strong></div></div>
   {p.id==='explorerExpansion'&&!maxed&&<p>Progress: {discoveredRoads.toLocaleString('en-IE')} / 5,000 roads · {explorerSpecializations} / 1 universal explorer</p>}
   {maxed?<div className="research-maxed"><CheckCircle2 size={16}/> Fully researched</div>:<button type="button" disabled={locked} onClick={()=>onStart(p.id)}>{state.active?'Research in progress':!company?'Create company first':company.cash<cost?'Insufficient funds':prerequisiteMissing?'Unlock exploration milestones':<>Start research <ArrowUpRight size={15}/></>}</button>}
  </article>;
 };
 return <section className="research-page research-v215">
  <header className="research-heading"><div><span className="eyebrow">RESEARCH & DEVELOPMENT · V2.1.5</span><h1>Research</h1><p>Develop revenue, petrol vehicles, fleet operations and company technology.</p></div><span className="research-real-time"><Clock3 size={14}/> GAME TIME · 24×</span></header>
  <nav className="research-tabs" role="tablist" aria-label="Research sections">{([['overview','Overview',FlaskConical],['projects','Research projects',Beaker],['progress','Progress',TrendingUp]] as const).map(([id,label,Icon])=><button type="button" role="tab" aria-selected={tab===id} className={tab===id?'active':''} key={id} onClick={()=>setTab(id)}><Icon size={16}/>{label}</button>)}</nav>
  <div className="research-kpis"><article><small>RESEARCH LEVELS</small><strong>{completed} <em>/ {projects.reduce((sum,p)=>sum+maxLevel(p.id),0)}</em></strong><span>Across eight research categories</span></article><article><small>ACTIVE PROJECTS</small><strong>{state.active?1:0} <em>/ 1</em></strong><span>One project at a time</span></article><article><small>AVAILABLE UPGRADES</small><strong>{available}</strong><span>Programmes not yet maxed</span></article><article><small>AVAILABLE CAPITAL</small><strong>{euro(company?.cash??0)}</strong><span>Company cash balance</span></article></div>
  {!company&&<div className="research-notice">Create a company to unlock research projects. You can review the programmes below.</div>}
  {tab==='overview'&&<div className="research-section"><div className="research-section-heading"><h2>Research status</h2><span>Live project information</span></div>
   <article className="research-active-card">{state.active&&activeProject?<><div className="research-active-icon"><Beaker size={26}/></div><div className="research-active-body"><span className="research-overline">CURRENTLY RESEARCHING</span><h3>{activeProject.name} · Level {state.active.level}</h3><p>Research progresses on the 24× game calendar, including elapsed game time while the game is closed.</p><div className="research-active-progress"><div style={{width:`${progress}%`}}/></div><div className="research-active-footer"><span>{progress.toFixed(0)}% complete</span><strong>{formatDuration(state.active.endsAt-now)} remaining</strong></div></div><button type="button" className="research-cancel" onClick={onCancel}>Cancel · no refund</button></>:<><div className="research-active-icon idle"><CheckCircle2 size={26}/></div><div className="research-active-body"><span className="research-overline">RESEARCH LAB</span><h3>No active project</h3><p>Select a programme to begin improving your company.</p></div><button type="button" onClick={()=>setTab('projects')}>Browse projects <ArrowUpRight size={15}/></button></>}</article>
   <div className="research-section-heading"><h2>Research programmes</h2><button type="button" className="research-link" onClick={()=>setTab('projects')}>View all projects →</button></div>
   <div className="research-categories" style={{display:'flex',gap:8,overflowX:'auto',padding:'8px 0 14px'}}>{categories.map((name,i)=><button key={name} type="button" aria-pressed={category===i} onClick={()=>setCategory(i)} style={{flexShrink:0,padding:'9px 12px',borderRadius:10,border:'1px solid #668',background:category===i?'#244e68':'#142734',color:'white'}}>{name}</button>)}</div><div className="research-grid">{projects.filter(p=>p.category===category).map(projectCard)}</div>
  </div>}
  {tab==='projects'&&<div className="research-section"><div className="research-section-heading"><h2>Available research</h2><span>Permanent company improvements</span></div><div className="research-grid">{projects.map(projectCard)}</div><div className="research-info"><ShieldCheck size={18}/> Research costs are charged when you start a project. Cancelling does not refund the cost.</div></div>}
  {tab==='progress'&&<div className="research-section"><div className="research-section-heading"><h2>Development progress</h2><span>{completed} of {projects.reduce((sum,p)=>sum+maxLevel(p.id),0)} research levels completed</span></div><div className="research-progress-list">{projects.map(p=>{const Icon=icons[p.id],current=level(state,p.id);return <article key={p.id}><span className="research-project-icon"><Icon size={19}/></span><div><strong>{p.name}</strong><small>{p.effect}</small><div className="research-level-track">{Array.from({length:maxLevel(p.id)},(_,i)=><span key={i} className={i<current?'filled':''}/>)}</div></div><b>{current} / {maxLevel(p.id)}</b></article>})}</div><div className="research-info"><Clock3 size={18}/> Research uses the same 24× game clock as company operations.</div></div>}
 </section>;
}
