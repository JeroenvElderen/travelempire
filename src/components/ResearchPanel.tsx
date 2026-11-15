import {useState} from 'react';
import {FlaskConical,Beaker,TrendingUp,Coins,Clock3,CheckCircle2,ArrowUpRight,ChevronDown,Compass,Search,SlidersHorizontal,Wallet} from 'lucide-react';
import type {Company} from '../company';
import {projects,categories,level,maxLevel,price,duration,instantCompletionCost,type ResearchId,type ResearchState} from '../research';
import '../research.css';
import './research-floating.css';

type Tab='overview'|'projects'|'progress';
type Props={
 company:Company|null;state:ResearchState;discoveredRoads:number;explorerSpecializations:number;gameNow:number;
 onStart:(id:ResearchId)=>void;onCancel:()=>void;onCompleteNow:()=>void;
};
const euro=(amount:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(amount);
const formatDuration=(ms:number)=>{
 const seconds=Math.ceil(Math.max(0,ms)/1000),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60),secs=seconds%60;
 return hours>0?hours+'h '+String(minutes).padStart(2,'0')+'m':minutes+'m '+String(secs).padStart(2,'0')+'s';
};

export default function ResearchPanel({company,state,discoveredRoads,explorerSpecializations,gameNow,onStart,onCancel,onCompleteNow}:Props){
 const [tab,setTab]=useState<Tab>('overview');
 const [category,setCategory]=useState<number|'all'>('all');
 const [search,setSearch]=useState('');
 const [filtersOpen,setFiltersOpen]=useState(false);
 const [filter,setFilter]=useState<'available'|'all'|'completed'>('available');
 const [expanded,setExpanded]=useState<ResearchId|null>(null);
 const active=state.active;
 const activeProject=active?projects.find(p=>p.id===active.id):undefined;
 const progress=active?Math.max(0,Math.min(100,100*(gameNow-active.startedAt)/Math.max(1,active.endsAt-active.startedAt))):0;
 const finishCost=instantCompletionCost(state,gameNow);
 const total=projects.reduce((sum,p)=>sum+maxLevel(p.id),0);
 const completed=projects.reduce((sum,p)=>sum+level(state,p.id),0);
 const available=projects.filter(p=>level(state,p.id)<maxLevel(p.id)).length;
 const visible=projects.filter(p=>(category==='all'||p.category===category)&&(filter==='all'||(filter==='completed'?level(state,p.id)===maxLevel(p.id):level(state,p.id)<maxLevel(p.id)))&&(!search.trim()||(p.name+' '+p.effect+' '+categories[p.category]).toLowerCase().includes(search.trim().toLowerCase())));
 const recommended=projects.filter(p=>level(state,p.id)<maxLevel(p.id)).sort((a,b)=>price(a.id,level(state,a.id)+1)-price(b.id,level(state,b.id)+1)).slice(0,3);
 const openProject=(id:ResearchId)=>{setExpanded(id);setTab('projects');setCategory('all');setSearch('');setFilter('available');};

 const projectRow=(p:typeof projects[number])=>{
  const current=level(state,p.id);
  const max=maxLevel(p.id);
  const maxed=current>=max;
  const next=current+1;
  const cost=maxed?0:price(p.id,next);
  const time=maxed?0:duration(state,next,p.id);
  const milestoneMissing=p.id==='explorerExpansion'&&(discoveredRoads<5000||explorerSpecializations<1);
  const blocked=!!active||!company||company.cash<cost||milestoneMissing;
  const isExpanded=expanded===p.id;
  const Icon=p.category===7?Coins:p.category===3?Compass:Beaker;
  return <article className="research-v3-project" key={p.id}>
   <button type="button" className="research-v3-project-trigger" aria-expanded={isExpanded} onClick={()=>setExpanded(isExpanded?null:p.id)}>
    <span className="research-v3-project-icon"><Icon size={18}/></span>
    <span className="research-v3-project-identity"><strong>{p.name}</strong><small>{categories[p.category]}</small></span>
    <span className={maxed?'research-v3-level is-maxed':'research-v3-level'}>{maxed?'Max':current+' / '+max}</span>
    <ChevronDown size={16} className="research-v3-chevron"/>
   </button>
   <div className="research-v3-level-track" role="progressbar" aria-label={p.name+' completed levels'} aria-valuenow={current} aria-valuemin={0} aria-valuemax={max}>
    <span style={{width:(current/max*100)+'%'}}/>
   </div>
   {isExpanded&&<div className="research-v3-project-expanded">
    <p>{p.effect}</p>
    {!maxed&&<div className="research-v3-project-costs">
     <div><span>Next</span><strong>Level {next}</strong></div>
     <div><span>Cost</span><strong>{euro(cost)}</strong></div>
     <div><span>Game time</span><strong>{formatDuration(time)}</strong></div>
    </div>}
    {p.id==='explorerExpansion'&&!maxed&&<div className="research-v3-requirements">
     <span>Roads discovered <strong>{Math.min(discoveredRoads,5000).toLocaleString('en-IE')} / 5,000</strong></span>
     <span>Explorer specializations <strong>{explorerSpecializations} / 1</strong></span>
    </div>}
    {maxed?<div className="research-v3-maxed"><CheckCircle2 size={16}/> Fully researched</div>:
     <button type="button" className="research-v3-primary" disabled={blocked} onClick={()=>onStart(p.id)}>
      {active?'Research already running':!company?'Create company first':company.cash<cost?'Insufficient funds':milestoneMissing?'Milestones required':'Start research · '+euro(cost)}
     </button>}
   </div>}
  </article>;
 };

 return <section className="research-page research-v215 research-v3" aria-label="Research centre">
  <header className="research-v3-header"><span className="research-v3-header-icon"><FlaskConical size={23}/></span><div><h1>Research</h1><p>Technology &amp; upgrades</p></div></header>
  <nav className="research-v3-nav" aria-label="Research sections">
   {([['overview','Overview',FlaskConical],['projects','Projects',Beaker],['progress','Progress',TrendingUp]] as const).map(([id,label,Icon])=>
    <button type="button" key={id} className={tab===id?'active':''} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}><Icon size={18}/><span>{tab===id?label:''}</span></button>)}
  </nav>
  <div className="research-v3-summary" aria-label="Research summary">
   <span><strong>{completed}</strong> / {total} levels</span>
   <span><strong>{available}</strong> available</span>
   <span><Wallet size={13}/><strong>{euro(company?.cash??0)}</strong> cash</span>
  </div>
  {!company&&<p className="research-v3-notice">Create a company to start researching. You can still browse projects.</p>}
  {tab==='overview'&&<div className="research-v3-content">
   <div className="research-v3-section-heading"><h2>Current research</h2><small>Game time · 24×</small></div>
   <article className="research-v3-active">
    {active&&activeProject?<>
     <div className="research-v3-active-top"><span className="research-v3-active-icon"><Beaker size={19}/></span><div><strong>{activeProject.name}</strong><small>Level {active.level}</small></div><span className="research-v3-active-percent">{Math.round(progress)}%</span></div>
     <div className="research-v3-active-track" role="progressbar" aria-label="Research progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{width:progress+'%'}}/></div>
     <div className="research-v3-active-meta"><span><Clock3 size={13}/> {formatDuration(active.endsAt-gameNow)} remaining</span><span>Researching</span></div>
     <button type="button" className="research-v3-primary" disabled={!company||company.cash<finishCost} onClick={onCompleteNow}>{company&&company.cash<finishCost?'Need '+euro(finishCost):'Complete now · '+euro(finishCost)}</button>
     <details className="research-v3-more"><summary>More options <ChevronDown size={14}/></summary><div><p>Completion price decreases with the remaining research time. Cancelling provides no refund.</p><button type="button" className="research-v3-cancel" onClick={onCancel}>Cancel research</button></div></details>
    </>:<>
     <div className="research-v3-active-top"><span className="research-v3-active-icon"><CheckCircle2 size={19}/></span><div><strong>No active project</strong><small>Your research lab is ready</small></div></div>
     <button type="button" className="research-v3-primary" onClick={()=>setTab('projects')}>Browse projects <ArrowUpRight size={15}/></button>
    </>}
   </article>
   <div className="research-v3-section-heading"><h2>Next upgrades</h2><button type="button" onClick={()=>setTab('projects')}>All projects <ArrowUpRight size={14}/></button></div>
   <div className="research-v3-suggestions">{recommended.map(p=><button key={p.id} type="button" onClick={()=>openProject(p.id)}>
    <span className="research-v3-suggestion-name"><strong>{p.name}</strong><small>Level {level(state,p.id)+1} · {euro(price(p.id,level(state,p.id)+1))}</small></span><ArrowUpRight size={15}/></button>)}
    {!recommended.length&&<p className="research-v3-empty">All available research is complete.</p>}
   </div>
  </div>}
  {tab==='projects'&&<div className="research-v3-content">
   <div className="research-v3-section-heading"><div><h2>Projects</h2><small>{visible.length} programmes</small></div><button type="button" className={filtersOpen||category!=='all'||filter!=='available'||search?'research-v3-filter-toggle active':'research-v3-filter-toggle'} aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(v=>!v)}><SlidersHorizontal size={16}/> Filter</button></div>
   {filtersOpen&&<div className="research-v3-tools">
    <label className="research-v3-search"><Search size={16}/><input type="search" value={search} onChange={e=>setSearch(e.target.value)} aria-label="Search research projects" placeholder="Find technology…"/></label>
    <div className="research-v3-filter-chips" aria-label="Project status">{([['available','Available'],['all','All'],['completed','Complete']] as const).map(([id,label])=><button type="button" key={id} className={filter===id?'active':''} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}</div>
    <label className="research-v3-category-label">Category <select value={category} onChange={e=>setCategory(e.target.value==='all'?'all':Number(e.target.value))}><option value="all">All categories</option>{categories.map((name,i)=><option key={name} value={i}>{name}</option>)}</select></label>
   </div>}
   <div className="research-v3-project-list">{visible.map(projectRow)}{!visible.length&&<p className="research-v3-empty">No matching projects. Change the filters to see more.</p>}</div>
  </div>}
  {tab==='progress'&&<div className="research-v3-content">
   <div className="research-v3-section-heading"><h2>Development</h2><small>{completed} / {total} levels</small></div>
   <div className="research-v3-progress-total" role="progressbar" aria-label="Overall research completion" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={total}><span style={{width:(total?completed/total*100:0)+'%'}}/></div>
   <div className="research-v3-progress-list">{projects.map(p=>{
    const current=level(state,p.id),max=maxLevel(p.id);return <article key={p.id}>
     <div className="research-v3-progress-info"><strong>{p.name}</strong><small>{current} / {max}</small></div>
     <div className="research-v3-level-track" role="progressbar" aria-label={p.name+' completed levels'} aria-valuenow={current} aria-valuemin={0} aria-valuemax={max}><span style={{width:(current/max*100)+'%'}}/></div>
    </article>;
   })}</div>
  </div>}
 </section>;
}
