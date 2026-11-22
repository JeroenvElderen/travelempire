import {useEffect,useMemo,useRef,useState} from 'react';
import {FlaskConical,Database,CheckCircle2,LockKeyhole,Play,Pause,Plus,Search,
 X,Minus,ZoomIn,Maximize2,GitBranch,ChevronRight,Layers3,Clock3} from 'lucide-react';
import type {Company} from '../company';
import * as Research from '../research';
import {ADVANCED_CATEGORIES,RESOURCE_INFO,resourceKeys,newProjects,researchCosts,prerequisites,
 safeBag,type ResourceKey,type OperationalContext} from '../researchProgress';
import {buildResearchDiagram,RESEARCH_CANVAS_WIDTH,RESEARCH_NODE_SIZE,
 RESEARCH_GLYPHS,RESEARCH_RESOURCE_GLYPHS} from '../researchGraph';
import './research-v4.css';

type Tab='tree'|'resources'|'active'|'completed';
type Props={
 company:Company|null;state:Research.ResearchState;discoveredRoads:number;explorerSpecializations:number;
 depots:number;gameNow:number;onStart:(id:Research.ResearchId)=>void;onQueue:(id:Research.ResearchId)=>void;
 onCancel:()=>void;onRemoveQueue:(id:Research.ResearchId)=>void;
};
const short=(n:number):string=>{
 const value=Math.max(0,Number(n)||0);
 if(value>=1e9)return (value/1e9).toFixed(value>=1e10?0:1).replace(/\.0$/,'')+'b';
 if(value>=1e6)return (value/1e6).toFixed(value>=1e7?0:1).replace(/\.0$/,'')+'m';
 if(value>=10000)return (value/1000).toFixed(value>=100000?0:1).replace(/\.0$/,'')+'k';
 return Math.floor(value).toLocaleString('en-IE');
};
const format=(key:ResourceKey,n:number)=>key==='revenue'?'€'+short(n):short(n);
const exact=(key:ResourceKey,n:number)=>key==='revenue'?'€'+Math.floor(n).toLocaleString('en-IE'):Math.floor(n).toLocaleString('en-IE');
const names:Record<ResourceKey,string>={
 roads:'Roads',passengers:'Drop-offs',revenue:'Cash earned',parking:'Parking',hotels:'Hotels',
 ferries:'Ferries',distance:'Distance',maintenance:'Services',construction:'Builds',corporate:'Corporate'
};
const MAX_ZOOM=1.65,MIN_ZOOM=.32;
const clampZoom=(n:number)=>Math.min(MAX_ZOOM,Math.max(MIN_ZOOM,Math.round(n*100)/100));

export default function ResearchPanel({company,state,discoveredRoads,explorerSpecializations,depots,gameNow,onStart,onQueue,onCancel,onRemoveQueue}:Props){
 const [tab,setTab]=useState<Tab>('tree');
 const [focused,setFocused]=useState<Research.ResearchId|null>(null);
 const [search,setSearch]=useState('');
 const [category,setCategory]=useState<number|'all'>('all');
 const viewport=useRef<HTMLDivElement>(null);
 const [zoom,setZoom]=useState(.48);
 const manualZoom=useRef(false);
 const pinch=useRef<{distance:number;zoom:number}|null>(null);
 const all=Research.allProjects;
 const diagram=useMemo(()=>buildResearchDiagram(all.map(project=>project.id)),[]);
 const byId=useMemo(()=>new Map(diagram.nodes.map(node=>[node.id,node])),[diagram]);
 const context:OperationalContext={roads:discoveredRoads,explorers:explorerSpecializations,depots};
 const inventory=safeBag(state.resources),earned=safeBag(state.earned);
 const active=state.selected as Research.ResearchId|undefined;
 const activeNode=all.find(p=>p.id===active);
 const completed=all.filter(p=>Research.level(state,p.id)>=Research.maxLevel(p.id)).length;
 const selected=all.find(p=>p.id===focused);
 const completeLevel=selected?Research.level(state,selected.id):0;
 const selectedMax=selected?Research.maxLevel(selected.id):1;
 const isDone=selected?completeLevel>=selectedMax:false;
 const missing=selected?prerequisites(selected.id,state.levels,context):[];
 const cost=selected?researchCosts(selected.id,completeLevel+1,Research.projects):{};
 const efficiency=selected?.id==='efficiency'?1:1-Math.min(.25,Research.level(state,'efficiency')*.05);
 const goal=Object.fromEntries(Object.entries(cost).map(([key,n])=>
  [key,Math.max(1,Math.ceil(n*efficiency))])) as typeof cost;
 const contribution=selected?state.contributions?.[selected.id+':'+(completeLevel+1)]??{}:{};
 const progressFor=(id:string)=>{
  const p=all.find(n=>n.id===id);if(!p)return 0;
  const level=Research.level(state,p.id);
  if(level>=Research.maxLevel(p.id))return 100;
  const base=researchCosts(p.id,level+1,Research.projects);
  const factor=p.id==='efficiency'?1:1-Math.min(.25,Research.level(state,'efficiency')*.05);
  const entries=Object.entries(base);
  if(!entries.length)return 0;
  const given=state.contributions?.[p.id+':'+(level+1)]??{};
  return Math.round(entries.reduce((sum,[key,amount])=>sum+Math.min(1,(given[key as ResourceKey]??0)/Math.max(1,Math.ceil(amount*factor))),0)/entries.length*100);
 };
 const selectedProgress=selected?progressFor(selected.id):0;
 const searchMatches=search.trim()?all.filter(p=>(p.name+' '+ADVANCED_CATEGORIES[p.category]).toLowerCase().includes(search.toLowerCase())).slice(0,6):[];
 const advanced=new Set(newProjects.map(p=>p.id));

 const fit=()=>{
  const width=viewport.current?.clientWidth??350;
  manualZoom.current=false;
  setZoom(clampZoom((width-22)/RESEARCH_CANVAS_WIDTH));
  viewport.current?.scrollTo({left:0,top:0,behavior:'smooth'});
 };
 useEffect(()=>{
  const element=viewport.current;if(!element)return;
  const adjust=()=>{if(!manualZoom.current)setZoom(clampZoom((element.clientWidth-22)/RESEARCH_CANVAS_WIDTH));};
  adjust();
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(adjust):null;
  observer?.observe(element);
  window.addEventListener('resize',adjust);
  return()=>{observer?.disconnect();window.removeEventListener('resize',adjust);};
 },[tab]);
 const changeZoom=(delta:number)=>{manualZoom.current=true;setZoom(v=>clampZoom(v+delta));};
 const jumpTo=(id:string)=>{
  const node=byId.get(id);
  if(!node||!viewport.current)return;
  viewport.current.scrollTo({
   left:Math.max(0,(node.x+RESEARCH_NODE_SIZE/2)*zoom-viewport.current.clientWidth/2),
   top:Math.max(0,(node.y+RESEARCH_NODE_SIZE/2)*zoom-viewport.current.clientHeight/2),
   behavior:'smooth'
  });
 };
 const touchDistance=(a:React.Touch,b:React.Touch)=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
 const onTouchStart=(event:React.TouchEvent<HTMLDivElement>)=>{
  if(event.touches.length===2)pinch.current={
   distance:touchDistance(event.touches[0],event.touches[1]),zoom};
 };
 const onTouchMove=(event:React.TouchEvent<HTMLDivElement>)=>{
  if(event.touches.length!==2||!pinch.current)return;
  const distance=touchDistance(event.touches[0],event.touches[1]);
  manualZoom.current=true;
  setZoom(clampZoom(pinch.current.zoom*distance/Math.max(1,pinch.current.distance)));
 };
 const onTouchEnd=(event:React.TouchEvent<HTMLDivElement>)=>{if(event.touches.length<2)pinch.current=null;};

 return <section className="research-v4 rv5" aria-label="Research Centre">
  <header className="rv5-head">
   <div className="rv5-heading">
    <FlaskConical size={20}/>
    <div><h1>Technology</h1><small>TravelEmpire Research Centre</small></div>
   </div>
   <span className="rv5-count">{completed} / {all.length} unlocked</span>
  </header>
  <section className="rv5-wallet" aria-label="Research resources available">
   <div className="rv5-wallet-title">
    <strong><Database size={13}/> Research resources</strong>
    <button type="button" onClick={()=>setTab('resources')}>Details <ChevronRight size={13}/></button>
   </div>
   <div className="rv5-wallet-grid">
    {resourceKeys.map(key=><button type="button" className="rv5-wallet-unit" key={key}
     title={RESOURCE_INFO[key].name+' · '+exact(key,inventory[key])+' available'} onClick={()=>setTab('resources')}>
     <span className="rv5-wallet-glyph" aria-hidden="true">{RESEARCH_RESOURCE_GLYPHS[key]}</span>
     <span className="rv5-wallet-amount">{format(key,inventory[key])}</span>
     <span className="rv5-wallet-name">{names[key]}</span>
    </button>)}
   </div>
  </section>
  <nav className="rv5-tabs" aria-label="Research Centre sections">
   <button type="button" aria-current={tab==='tree'?'page':undefined} className={tab==='tree'?'on':''} onClick={()=>setTab('tree')}><GitBranch size={15}/> Tech tree</button>
   <button type="button" aria-current={tab==='active'?'page':undefined} className={tab==='active'?'on':''} onClick={()=>setTab('active')}><Play size={14}/> Active</button>
   <button type="button" aria-current={tab==='completed'?'page':undefined} className={tab==='completed'?'on':''} onClick={()=>setTab('completed')}><CheckCircle2 size={15}/> Unlocked</button>
  </nav>

  {tab==='tree'&&<>
   <div className="rv5-toolbar">
    <label className="rv5-search"><Search size={14}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find technology" aria-label="Find technology"/></label>
    <select aria-label="Jump to research division" value={category} onChange={e=>{
     const value=e.target.value==='all'?'all':Number(e.target.value);
     setCategory(value);
     if(value!=='all'){const first=all.find(p=>p.category===value);if(first)jumpTo(first.id);}
    }}>
     <option value="all">All divisions</option>{ADVANCED_CATEGORIES.map((name,i)=><option key={name} value={i}>{name}</option>)}
    </select>
   </div>
   {searchMatches.length>0&&<div className="rv5-search-results">
    {searchMatches.map(p=><button key={p.id} type="button" onClick={()=>{setFocused(p.id);setSearch('');jumpTo(p.id);}}>{RESEARCH_GLYPHS[p.id]??'🔬'} {p.name}</button>)}
   </div>}
   <div className="rv5-map-controls">
    <span><Layers3 size={13}/> {activeNode?'Researching: '+activeNode.name:'Choose a technology'}</span>
    <div className="rv5-zoom-controls">
     <button type="button" aria-label="Zoom out" onClick={()=>changeZoom(-.12)}><Minus size={16}/></button>
     <span>{Math.round(zoom*100)}%</span>
     <button type="button" aria-label="Zoom in" onClick={()=>changeZoom(.12)}><ZoomIn size={16}/></button>
     <button type="button" aria-label="Fit technology tree" onClick={fit}><Maximize2 size={15}/></button>
    </div>
   </div>
   <div className="rv5-viewport" ref={viewport} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
    aria-label="Scrollable research technology tree with connected prerequisites">
    <div className="rv5-canvas-frame" style={{width:diagram.width*zoom,height:diagram.height*zoom}}>
     <div className="rv5-canvas" style={{width:diagram.width,height:diagram.height,transform:`scale(${zoom})`}}>
      <svg className="rv5-links" width={diagram.width} height={diagram.height} viewBox={`0 0 ${diagram.width} ${diagram.height}`} aria-hidden="true">
       {diagram.edges.map(edge=>{
        const origin=all.find(p=>p.id===edge.from),destination=all.find(p=>p.id===edge.to);
        const solid=Boolean(origin&&destination&&Research.level(state,origin.id)>0);
        return <path key={edge.from+'>'+edge.to} d={edge.path} className={solid?'established':'pending'}/>;
       })}
       <path className="pending" d="M 380 98 V 120"/>
       {[0,1,2,3,4,5,6,7].map(lane=><path className="pending" key={lane} d={`M 380 120 H ${65+lane*90} V ${145+(lane%2)*20}`}/>)}
      </svg>
      <div className="rv5-root" style={{left:352,top:34}} title="TravelEmpire research root"><FlaskConical size={25}/></div>
      <div className="rv5-tree-divider" style={{top:865}}>NEW BUSINESS DIVISIONS</div>
      {diagram.nodes.map(node=>{
       const project=all.find(p=>p.id===node.id);
       if(!project)return null;
       const value=Research.level(state,project.id);
       const max=Research.maxLevel(project.id);
       const done=value>=max;
       const missing=prerequisites(project.id,state.levels,context);
       const locked=missing.length>0&&!done;
       const running=active===project.id;
       const hasProgress=progressFor(project.id)>0&&!done;
       return <button key={node.id} type="button"
        className={'rv5-node'+(done?' completed':'')+(locked?' locked':'')+(running?' researching':'')+(focused===node.id?' focused':'')+(hasProgress?' partial':'')}
        style={{left:node.x,top:node.y}} onClick={()=>setFocused(project.id)} title={project.name}
        aria-label={project.name+' · '+(done?'Unlocked':locked?'Locked: '+missing.join(', '):running?'Researching':'Available')}
        aria-pressed={focused===node.id}>
        <span className="rv5-node-glyph">{RESEARCH_GLYPHS[node.id]??'🔬'}</span>
        {locked?<LockKeyhole className="rv5-node-lock" size={15}/>:done?<CheckCircle2 className="rv5-node-check" size={14}/>:null}
        {max>1?<span className="rv5-node-level">{value}/{max}</span>:null}
        {running?<span className="rv5-node-pulse"/>:null}
       </button>;
      })}
     </div>
    </div>
   </div>
   <div className="rv5-caption"><span>🟩 Unlocked</span><span>🟦 Researching</span><span>🔒 Locked</span><span>Drag to explore · pinch or use zoom</span></div>
  </>}
  {tab==='resources'&&<section className="rv5-view">
   <h2>Your research inventory</h2>
   <p>Resources are earned through genuine gameplay and automatically delivered to your active research. Amounts here are <strong>available balances</strong> after any contributions.</p>
   <div className="rv5-resource-list">{resourceKeys.map(key=><div key={key} className="rv5-resource-row">
    <span className="rv5-resource-emoji">{RESEARCH_RESOURCE_GLYPHS[key]}</span>
    <div><strong>{RESOURCE_INFO[key].name}</strong><small>{RESOURCE_INFO[key].unit} · {exact(key,earned[key])} earned in total</small></div>
    <b>{exact(key,inventory[key])}</b>
   </div>)}</div>
   <p>Parking is measured as paid space-hours, hotels as new stays, ferries as passengers, and roads as unique discoveries. Revenue Data is earned income—not the money currently in your bank.</p>
   <button className="rv5-back" type="button" onClick={()=>setTab('tree')}><GitBranch size={16}/> Back to tech tree</button>
  </section>}
  {tab==='active'&&<section className="rv5-view">
   <h2>Automatic research</h2>
   {activeNode?<div className="rv5-current">
    <span className="rv5-current-emoji">{RESEARCH_GLYPHS[activeNode.id]??'🔬'}</span>
    <div><strong>{activeNode.name}</strong><small>{progressFor(activeNode.id)}% of required resources delivered</small></div>
    <button type="button" onClick={()=>{setFocused(activeNode.id);setTab('tree');jumpTo(activeNode.id);}}>View</button>
    <button type="button" onClick={onCancel} aria-label="Pause active research"><Pause size={16}/></button>
   </div>:<p>No technology selected. Choose one in the tree and your resources will flow to it automatically.</p>}
   <h3>Next in queue ({state.queue?.length??0}/5)</h3>
   {(state.queue??[]).length===0?<p>No technologies queued.</p>:
    state.queue?.map(id=><div className="rv5-queue-row" key={id}><span>{RESEARCH_GLYPHS[id]??'🔬'} {all.find(p=>p.id===id)?.name??id}</span><button onClick={()=>onRemoveQueue(id as Research.ResearchId)} type="button">Remove</button></div>)}
   {state.active&&<p><Clock3 size={13}/> Previous paid timed research is finishing on the original game clock and will keep its reward.</p>}
   <button className="rv5-back" type="button" onClick={()=>setTab('tree')}><GitBranch size={16}/> Explore research tree</button>
  </section>}
  {tab==='completed'&&<section className="rv5-view">
   <h2>Unlocked technologies</h2>
   <p>{completed} out of {all.length} fully researched programmes. Your existing research levels and special explorer rewards are preserved.</p>
   <div className="rv5-unlocked-list">
    {all.filter(p=>Research.level(state,p.id)>0).map(p=><button type="button" key={p.id} onClick={()=>{setFocused(p.id);setTab('tree');jumpTo(p.id);}}>
     <span>{RESEARCH_GLYPHS[p.id]??'🔬'}</span><strong>{p.name}</strong><small>{Research.level(state,p.id)}/{Research.maxLevel(p.id)}</small>
    </button>)}
   </div>
   <button className="rv5-back" type="button" onClick={()=>setTab('tree')}><GitBranch size={16}/> Back to tech tree</button>
  </section>}

  {tab==='tree'&&selected&&<aside className="rv5-details" aria-label="Technology information">
   <header><div className="rv5-detail-icon">{RESEARCH_GLYPHS[selected.id]??'🔬'}</div>
    <div><small>{ADVANCED_CATEGORIES[selected.category]}</small><h2>{selected.name}</h2><span>{advanced.has(selected.id)?'Technology unlock':'Upgrade '+completeLevel+' / '+selectedMax}</span></div>
    <button type="button" aria-label="Close technology details" onClick={()=>setFocused(null)}><X size={20}/></button></header>
   <p>{selected.effect}</p>
   {isDone?<div className="rv5-unlocked-note"><CheckCircle2 size={17}/> Researched and unlocked</div>:<>
    {missing.length>0&&<div className="rv5-missing"><strong>Unlock requirements</strong>{missing.map(item=><div key={item}><LockKeyhole size={13}/>{item}</div>)}</div>}
    <div className="rv5-detail-progress"><span>Resources delivered</span><b>{selectedProgress}%</b></div>
    <div className="rv5-detail-resources">{resourceKeys.filter(key=>(goal[key]??0)>0).map(key=>{
     const needed=goal[key]??0,delivered=Math.min(needed,contribution[key]??0);
     return <div key={key}><span>{RESEARCH_RESOURCE_GLYPHS[key]} {RESOURCE_INFO[key].name}</span>
      <strong>{exact(key,delivered)} / {exact(key,needed)}</strong>
      <div className="rv5-bar"><i style={{width:(needed?delivered/needed*100:0)+'%'}}/></div>
      <small>{exact(key,inventory[key])} available in inventory</small>
     </div>;
    })}</div>
    <div className="rv5-detail-actions">
     <button className="rv5-primary" type="button" disabled={!company||active===selected.id||missing.length>0}
      onClick={()=>{onStart(selected.id);setFocused(null);}}>
      <Play size={15}/>{active===selected.id?'Researching automatically':missing.length>0?'Unlock prerequisites first':'Research automatically'}</button>
     <button type="button" disabled={!company||active===selected.id||state.queue?.includes(selected.id)||(state.queue?.length??0)>=5}
      onClick={()=>{onQueue(selected.id);setFocused(null);}}><Plus size={15}/> Queue</button>
    </div>
   </>}
  </aside>}
 </section>;
}
