import {useState} from 'react';
import {FlaskConical,ChartNoAxesCombined,GitBranch,Database,CheckCircle2,LockKeyhole,Clock3,Play,Pause,Plus,Search,ChevronRight,Layers3,Map as MapIcon,ArrowUpRight} from 'lucide-react';
import type {Company} from '../company';
import * as Research from '../research';
import {ADVANCED_CATEGORIES,RESOURCE_INFO,resourceKeys,newProjects,researchCosts,prerequisites,safeBag,type ResourceKey,type OperationalContext} from '../researchProgress';
import './research-v4.css';

type Tab='tree'|'active'|'resources'|'completed';
type Props={
 company:Company|null;state:Research.ResearchState;discoveredRoads:number;explorerSpecializations:number;
 depots:number;gameNow:number;onStart:(id:Research.ResearchId)=>void;onQueue:(id:Research.ResearchId)=>void;
 onCancel:()=>void;onRemoveQueue:(id:Research.ResearchId)=>void;
};
const integer=(n:number)=>Math.floor(n).toLocaleString('en-IE');
const formatResource=(key:ResourceKey,n:number)=>key==='revenue'?'€'+integer(n):integer(n);
const formatName=(id:string)=>Research.allProjects.find(p=>p.id===id)?.name??id;
const iconFor=(category:number)=>['💶','🚗','📊','🗺️','👥','🏢','📣','🏦','⛴️','🏨','🏗️','🌍'][category]??'🔬';
const maxLevel=(id:Research.ResearchId)=>Research.maxLevel(id);

export default function ResearchPanel({company,state,discoveredRoads,explorerSpecializations,depots,gameNow,onStart,onQueue,onCancel,onRemoveQueue}:Props){
 const [tab,setTab]=useState<Tab>('tree');
 const [category,setCategory]=useState<number|'all'>('all');
 const [search,setSearch]=useState('');
 const [focused,setFocused]=useState<Research.ResearchId|null>(null);
 const levels=state.levels;
 const context:OperationalContext={roads:discoveredRoads,explorers:explorerSpecializations,depots};
 const inventory=safeBag(state.resources),earned=safeBag(state.earned);
 const active=state.selected as Research.ResearchId|undefined;
 const activeNode=active?Research.allProjects.find(p=>p.id===active):undefined;
 const all=Research.allProjects;
 const done=all.filter(p=>(levels[p.id]??0)>=maxLevel(p.id));
 const advancedIds=new Set(newProjects.map(p=>p.id));
 const selected=focused?all.find(p=>p.id===focused):activeNode;
 const visible=all.filter(p=>(category==='all'||p.category===category)&&
  (!search.trim()||(p.name+' '+p.effect+' '+ADVANCED_CATEGORIES[p.category]).toLowerCase().includes(search.trim().toLowerCase())));
 const selectedLevel=selected?Research.level(state,selected.id):0;
 const selectedMax=selected?maxLevel(selected.id):1;
 const selectedCost=selected?researchCosts(selected.id,selectedLevel+1,Research.projects):{};
 const costFactor=selected?.id==='efficiency'?1:1-Math.min(.25,Research.level(state,'efficiency')*.05);
 const costs=Object.fromEntries(Object.entries(selectedCost).map(([k,n])=>
  [k,Math.max(1,Math.ceil(n*costFactor))])) as typeof selectedCost;
 const contribution=selected?state.contributions?.[selected.id+':'+(selectedLevel+1)]??{}:{};
 const blocked=selected?prerequisites(selected.id,levels,context):[];
 const progress=selected?Object.entries(costs).length===0?0:Math.round(100*
  Object.entries(costs).reduce((a,[key,amount])=>a+Math.min(1,(contribution[key as ResourceKey]??0)/amount),0)/
  Object.entries(costs).length):0;
 const isQueued=(id:string)=>state.queue?.includes(id)??false;

 return <section className="research-v4" aria-label="Research Centre">
  <header className="rv4-head">
   <div className="rv4-logo"><FlaskConical size={23}/></div>
   <div className="rv4-heading"><h1>Research Centre</h1><p>Technology progression · automatic resource delivery</p></div>
  </header>
  <div className="rv4-metrics">
   <div><small>Technologies</small><strong>{done.length} <span>/ {all.length}</span></strong></div>
   <div><small>In progress</small><strong>{active?1:0}</strong></div>
   <div><small>Research queue</small><strong>{state.queue?.length??0} <span>/ 5</span></strong></div>
  </div>
  <nav className="rv4-tabs" aria-label="Research views">
   {([['tree','Tech Tree',GitBranch],['active','Active',Play],['resources','Resources',Database],['completed','Completed',CheckCircle2]] as const)
    .map(([key,title,Icon])=><button type="button" key={key} className={tab===key?'selected':''} onClick={()=>setTab(key)}>
    <Icon size={17}/><span>{title}</span></button>)}
  </nav>
  {tab==='tree'&&<>
   <div className="rv4-controls">
    <label className="rv4-search"><Search size={16}/><input aria-label="Search technology tree" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search technologies"/></label>
    <select aria-label="Filter research branch" value={category} onChange={e=>setCategory(e.target.value==='all'?'all':Number(e.target.value))}>
     <option value="all">All 12 branches</option>{ADVANCED_CATEGORIES.map((name,i)=><option key={name} value={i}>{name}</option>)}
    </select>
   </div>
   <div className="rv4-tree-scroll" aria-label="Scrollable connected technology tree">
    <div className="rv4-tree" style={{gridTemplateColumns:'repeat('+(category==='all'?12:1)+', minmax(238px, 1fr))'}}>
     {ADVANCED_CATEGORIES.map((name,index)=>{
      if(category!=='all'&&category!==index)return null;
      const nodes=visible.filter(p=>p.category===index);
      return <section key={name} className="rv4-branch">
       <div className="rv4-branch-name"><span>{iconFor(index)}</span><div><strong>{name}</strong><small>{nodes.length} technologies</small></div></div>
       <div className="rv4-node-path">{nodes.map((p,i)=>{
        const l=Research.level(state,p.id);
        const max=maxLevel(p.id);
        const missing=prerequisites(p.id,levels,context);
        const complete=l>=max;
        const selectedNode=active===p.id;
        const locked=missing.length>0;
        return <div key={p.id} className="rv4-node-wrap">
         {i>0&&<div className="rv4-connector" aria-hidden="true"/>}
         <button type="button" className={'rv4-node'+(complete?' done':'')+(locked?' locked':'')+(selectedNode?' running':'')+(focused===p.id?' focus':'')}
          aria-pressed={focused===p.id} onClick={()=>setFocused(p.id)}>
          <span className="rv4-node-title">{complete?<CheckCircle2 size={16}/>:locked?<LockKeyhole size={15}/>:<Layers3 size={15}/>}<strong>{p.name}</strong></span>
          <span className="rv4-node-foot"><small>{advancedIds.has(p.id)?'Technology':'Level '+l+' / '+max}</small><small>{complete?'Unlocked':selectedNode?'Receiving resources':locked?'Prerequisites':isQueued(p.id)?'Queued':'Available'}</small></span>
          {newProjects.find(n=>n.id===p.id)?.requires.length?<span className="rv4-node-requires">Links: {newProjects.find(n=>n.id===p.id)?.requires.map(formatName).join(', ')}</span>:null}
         </button>
        </div>;
       })}</div>
      </section>;
     })}
    </div>
   </div>
   <p className="rv4-hint"><MapIcon size={14}/> Swipe sideways to explore branches. Tap any technology to see prerequisites and resource requirements.</p>
  </>}
  {tab==='active'&&<div className="rv4-section">
   <h2>Automatic research delivery</h2>
   <p>Every completed business activity sends its research resources to the selected technology. Unused resources accumulate for later technologies.</p>
   <div className="rv4-active-card">
    {activeNode?<><strong>{activeNode.name}</strong><small>Resources flow automatically when generated</small><button type="button" onClick={()=>{setFocused(activeNode.id);setTab('tree');}}>View technology <ArrowUpRight size={14}/></button><button type="button" onClick={onCancel}>Pause research <Pause size={14}/></button></>
    :<><strong>No selected technology</strong><p>Choose a technology in the tree. Your businesses will keep earning resources in the meantime.</p><button type="button" onClick={()=>setTab('tree')}>Open technology tree <ChevronRight size={14}/></button></>}
   </div>
   <h2>Upcoming technologies</h2>
   {state.queue?.length?state.queue.map(id=><div key={id} className="rv4-queued"><span>{formatName(id)}</span><button type="button" onClick={()=>onRemoveQueue(id as Research.ResearchId)}>Remove</button></div>):<p>Your queue is empty.</p>}
  </div>}
  {tab==='resources'&&<div className="rv4-section">
   <h2>Operational resource inventory</h2>
   <p>These are research counters earned from settled activity. They are not physical materials or spendable company cash.</p>
   <div className="rv4-resource-grid">
    {resourceKeys.map(key=><div key={key} className="rv4-resource">
     <small>{RESOURCE_INFO[key].name}</small><strong>{formatResource(key,inventory[key])}</strong>
     <span>{formatResource(key,earned[key])} earned in total · {RESOURCE_INFO[key].unit}</span>
    </div>)}
   </div>
   <p>Parking Data is measured in occupied paid parking-space hours. Hotel Guest Data counts new stays. Road Data counts uniquely discovered road segments.</p>
  </div>}
  {tab==='completed'&&<div className="rv4-section"><h2>Unlocked technologies</h2>
   <div className="rv4-completed">{done.length?done.map(p=><button key={p.id} type="button" onClick={()=>{setFocused(p.id);setTab('tree');}}><CheckCircle2 size={16}/><span>{p.name}</span></button>):<p>No technologies completed yet.</p>}</div>
   <p>Previously researched upgrades and earned explorer rewards remain available.</p>
  </div>}
  {tab==='tree'&&selected&&<aside className="rv4-detail" aria-label="Selected technology details">
   <div className="rv4-detail-title">
    <div><small>{ADVANCED_CATEGORIES[selected.category]}</small><h2>{selected.name}</h2></div>
    <button type="button" aria-label="Close technology details" onClick={()=>setFocused(null)}>×</button>
   </div>
   <p>{selected.effect}</p>
   <div className="rv4-detail-status"><span>Technology level</span><strong>{selectedLevel} / {selectedMax}</strong></div>
   {blocked.length>0&&<div className="rv4-prerequisites"><strong>Prerequisites</strong>{blocked.map(item=><div key={item}><LockKeyhole size={13}/>{item}</div>)}</div>}
   {selectedLevel<selectedMax&&<><h3>Required resources</h3>
    {resourceKeys.filter(k=>(costs[k]??0)>0).map(key=>{
     const needed=costs[key]??0;
     const delivered=Math.min(needed,contribution[key]??0);
     const available=inventory[key];
     return <div className="rv4-requirement" key={key}>
      <div><span>{RESOURCE_INFO[key].name}</span><strong>{formatResource(key,delivered)} / {formatResource(key,needed)}</strong></div>
      <div className="rv4-progress"><span style={{width:(needed?100*delivered/needed:0)+'%'}}/></div>
      <small>{formatResource(key,available)} waiting in research inventory</small>
     </div>;
    })}
    <div className="rv4-detail-status"><span>Requirements delivered</span><strong>{progress}%</strong></div>
    <div className="rv4-actions">
     <button className="primary" disabled={!company||active===selected.id} onClick={()=>onStart(selected.id)}>
      <Play size={15}/>{active===selected.id?'Researching automatically':'Set as active research'}</button>
     <button disabled={!company||isQueued(selected.id)||active===selected.id||(state.queue?.length??0)>=5} onClick={()=>onQueue(selected.id)}><Plus size={15}/>Add to queue</button>
    </div>
   </>}
  </aside>}
  {!company&&<p className="rv4-hint">Create a company to begin collecting resources and researching technologies.</p>}
  {state.active&&<p className="rv4-hint"><Clock3 size={14}/> A previously purchased research upgrade is finishing on the original game clock; its reward will be preserved.</p>}
  <footer className="rv4-footer"><ChartNoAxesCombined size={15}/> Research advances through actual business activity. No manual delivery or additional research payment required.</footer>
 </section>;
}
