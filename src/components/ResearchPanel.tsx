import {useEffect,useMemo,useRef,useState} from 'react';
import {FlaskConical,Database,CheckCircle2,LockKeyhole,Search,X,Minus,ZoomIn,Maximize2,GitBranch,Layers3} from 'lucide-react';
import type {Company} from '../company';
import * as Research from '../research';
import {ADVANCED_CATEGORIES,RESOURCE_INFO,resourceKeys,researchCosts,
 safeBag,type ResourceKey,type OperationalContext} from '../researchProgress';
import {buildLevelResearchDiagram,RESEARCH_CANVAS_WIDTH,RESEARCH_NODE_SIZE,
 RESEARCH_GLYPHS,RESEARCH_RESOURCE_GLYPHS,type LevelDiagramNode} from '../researchGraph';
import {STARTER_STAGES,STARTER_LEVELS,researchNodeId,technologyLevelRequirements,effectiveCosts} from '../researchAutomatic';
import './research-v4.css';

type Tab='tree'|'resources'|'completed';
type Props={
 company:Company|null;state:Research.ResearchState;discoveredRoads:number;
 explorerSpecializations:number;depots:number;gameNow:number;freshStart?:boolean;
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
const labels:Record<ResourceKey,string>={
 roads:'Roads',passengers:'Drop-offs',revenue:'Cash earned',parking:'Parking',hotels:'Hotels',
 ferries:'Ferries',distance:'Distance',maintenance:'Services',construction:'Builds',corporate:'Corporate'
};
const minZoom=.31,maxZoom=1.8;
const clampZoom=(n:number)=>Math.min(maxZoom,Math.max(minZoom,Math.round(n*100)/100));
const starterIcon=['','🚕','📈','🏅','🚙'];

export default function ResearchPanel({company,state,discoveredRoads,explorerSpecializations,depots,gameNow,freshStart=false}:Props){
 const [tab,setTab]=useState<Tab>('tree');
 const [focused,setFocused]=useState<string|null>(null);
 const [search,setSearch]=useState('');
 const [category,setCategory]=useState<number|'all'>('all');
 const viewport=useRef<HTMLDivElement>(null);
 const [zoom,setZoom]=useState(.46);
 const manualZoom=useRef(false);
 const pinch=useRef<{distance:number;zoom:number}|null>(null);
 const projects=Research.allProjects;
 const diagram=useMemo(()=>buildLevelResearchDiagram(projects.map(p=>p.id)),[]);
 const byId=useMemo(()=>new Map(diagram.nodes.map(n=>[n.id,n])),[diagram]);
 const inventory=safeBag(state.resources),earned=safeBag(state.earned);
 const starterLevel=freshStart?state.starterLevel??0:STARTER_LEVELS;
 const context:OperationalContext={roads:discoveredRoads,explorers:explorerSpecializations,depots,
  freshStart,starterLevel};
 const isComplete=(node:LevelDiagramNode)=>{
  if(node.type==='starter')return starterLevel>=node.level;
  return Research.level(state,node.projectId as Research.ResearchId)>=node.level;
 };
 const requirements=(node:LevelDiagramNode)=>{
  if(isComplete(node))return [] as string[];
  if(node.type==='starter')
   return node.level>1&&starterLevel<node.level-1?['Startup Level '+(node.level-1)]:[];
  return technologyLevelRequirements(node.projectId,node.level,state.levels,context);
 };
 const nodeCosts=(node:LevelDiagramNode)=>{
  if(node.type==='starter'){
   const target=STARTER_STAGES[node.level-1];
   return {passengers:target.jobs,revenue:target.revenue};
  }
  return effectiveCosts(node.projectId,node.level,state.levels,Research.projects);
 };
 const progressFor=(node:LevelDiagramNode)=>{
  if(isComplete(node))return 100;
  const costs=nodeCosts(node);
  const delivered=node.type==='starter'?earned:state.contributions?.[node.id]??{};
  const entries=Object.entries(costs);
  if(!entries.length)return 0;
  return Math.round(entries.reduce((sum,[key,n])=>
   sum+Math.min(1,(delivered[key as ResourceKey]??0)/n),0)/entries.length*100);
 };
 const completed=diagram.nodes.filter(isComplete).length;
 const selected=focused?byId.get(focused):undefined;
 const selectedProject=selected?.type==='technology'?projects.find(p=>p.id===selected.projectId):undefined;
 const selectedMissing=selected?requirements(selected):[];
 const selectedCosts=selected?nodeCosts(selected):{};
 const selectedDelivered=selected?.type==='starter'?earned:selected?state.contributions?.[selected.id]??{}:{};
 const matching=search.trim()?projects.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())).slice(0,7):[];
 const firstIncomplete=diagram.nodes.find(n=>!isComplete(n)&&requirements(n).length===0);
 const activeCount=diagram.nodes.filter(n=>!isComplete(n)&&requirements(n).length===0).length;
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
  const resize=typeof ResizeObserver!=='undefined'?new ResizeObserver(adjust):null;
  resize?.observe(element);window.addEventListener('resize',adjust);
  return()=>{resize?.disconnect();window.removeEventListener('resize',adjust);};
 },[tab]);
 const changeZoom=(delta:number)=>{manualZoom.current=true;setZoom(v=>clampZoom(v+delta));};
 const jumpTo=(id:string)=>{
  const node=byId.get(id);if(!node||!viewport.current)return;
  viewport.current.scrollTo({
   left:Math.max(0,(node.x+RESEARCH_NODE_SIZE/2)*zoom-viewport.current.clientWidth/2),
   top:Math.max(0,(node.y+RESEARCH_NODE_SIZE/2)*zoom-viewport.current.clientHeight/2),
   behavior:'smooth'});
 };
 const touchDistance=(a:React.Touch,b:React.Touch)=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
 const onTouchStart=(e:React.TouchEvent<HTMLDivElement>)=>{
  if(e.touches.length===2)pinch.current={distance:touchDistance(e.touches[0],e.touches[1]),zoom};
 };
 const onTouchMove=(e:React.TouchEvent<HTMLDivElement>)=>{
  if(e.touches.length!==2||!pinch.current)return;
  manualZoom.current=true;
  setZoom(clampZoom(pinch.current.zoom*touchDistance(e.touches[0],e.touches[1])/Math.max(1,pinch.current.distance)));
 };
 const onTouchEnd=(e:React.TouchEvent<HTMLDivElement>)=>{if(e.touches.length<2)pinch.current=null;};

 return <section className="research-v4 rv5" aria-label="Technology research tree">
  <header className="rv5-head">
   <div className="rv5-heading"><FlaskConical size={20}/><div><h1>Technology</h1>
    <small>TravelEmpire · {new Date(gameNow).toLocaleDateString('en-IE')}</small></div></div>
   <span className="rv5-count">{completed} / {diagram.nodes.length} levels</span>
  </header>
  <section className="rv5-wallet" aria-label="Available automatic research resources">
   <div className="rv5-wallet-title"><strong><Database size={13}/> Research resources</strong>
    <button type="button" onClick={()=>setTab('resources')}>Details ›</button></div>
   <div className="rv5-wallet-grid">{resourceKeys.map(key=><button type="button" key={key}
    className="rv5-wallet-unit" onClick={()=>setTab('resources')}
    title={RESOURCE_INFO[key].name+' · '+exact(key,inventory[key])+' available'}>
    <span className="rv5-wallet-glyph" aria-hidden="true">{RESEARCH_RESOURCE_GLYPHS[key]}</span>
    <span className="rv5-wallet-amount">{format(key,inventory[key])}</span>
    <span className="rv5-wallet-name">{labels[key]}</span>
   </button>)}</div>
  </section>
  <nav className="rv5-tabs" aria-label="Research views">
   <button type="button" className={tab==='tree'?'on':''} onClick={()=>setTab('tree')}><GitBranch size={15}/> Tech tree</button>
   <button type="button" className={tab==='resources'?'on':''} onClick={()=>setTab('resources')}><Database size={15}/> Resources</button>
   <button type="button" className={tab==='completed'?'on':''} onClick={()=>setTab('completed')}><CheckCircle2 size={15}/> Unlocked</button>
  </nav>
  {tab==='tree'&&<>
   <div className="rv5-toolbar">
    <label className="rv5-search"><Search size={14}/><input value={search} onChange={e=>setSearch(e.target.value)}
     placeholder="Find technology" aria-label="Find technology"/></label>
    <select aria-label="Jump to technology division" value={category} onChange={e=>{
     const v=e.target.value==='all'?'all':Number(e.target.value);setCategory(v);
     const first=projects.find(p=>p.category===v);
     if(first)jumpTo(researchNodeId(first.id,1));
    }}>
     <option value="all">All divisions</option>{ADVANCED_CATEGORIES.map((name,i)=><option key={name} value={i}>{name}</option>)}
    </select>
   </div>
   {matching.length>0&&<div className="rv5-search-results">
    {matching.map(p=><button key={p.id} type="button"
     onClick={()=>{const id=researchNodeId(p.id,Math.min(Research.maxLevel(p.id),Research.level(state,p.id)+1));setFocused(id);setSearch('');jumpTo(id);}}>
     {RESEARCH_GLYPHS[p.id]??'🔬'} {p.name}</button>)}
   </div>}
   <div className="rv5-map-controls"><span><Layers3 size={13}/>
    {starterLevel<STARTER_LEVELS?'Starter '+starterLevel+' / 4 · Dealership locked':
     activeCount+' levels progressing automatically'}</span>
    <div className="rv5-zoom-controls">
     <button type="button" aria-label="Zoom out" onClick={()=>changeZoom(-.12)}><Minus size={16}/></button>
     <span>{Math.round(zoom*100)}%</span>
     <button type="button" aria-label="Zoom in" onClick={()=>changeZoom(.12)}><ZoomIn size={16}/></button>
     <button type="button" aria-label="Fit tree to width" onClick={fit}><Maximize2 size={15}/></button>
    </div>
   </div>
   <div className="rv5-viewport" ref={viewport} onTouchStart={onTouchStart}
    onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} aria-label="Pan and zoom connected technology levels">
    <div className="rv5-canvas-frame" style={{width:diagram.width*zoom,height:diagram.height*zoom}}>
     <div className="rv5-canvas" style={{width:diagram.width,height:diagram.height,transform:`scale(${zoom})`}}>
      <svg className="rv5-links" width={diagram.width} height={diagram.height}
       viewBox={`0 0 ${diagram.width} ${diagram.height}`} aria-hidden="true">
       {diagram.edges.map((edge,i)=>{
        const parent=byId.get(edge.from);
        return <path key={i} d={edge.path} className={parent&&isComplete(parent)?'established':'pending'}/>;
       })}
      </svg>
      <div className="rv5-tree-divider rv5-intro-label" style={{top:15}}>START YOUR COMPANY</div>
      <div className="rv5-tree-divider" style={{top:475}}>RESEARCH DIVISIONS · UNLOCK AFTER LEVEL 4</div>
      <div className="rv5-tree-divider" style={{top:3245}}>ADDITIONAL BUSINESS DIVISIONS</div>
      {diagram.divisions.map(item=><div className="rv5-lane-label" key={item.category}
       style={{left:item.x-12,top:item.y}} title={ADVANCED_CATEGORIES[item.category]}>
       {['🚕','🔧','🧭','🗺️','🎓','🏢','📣','🏦','⛴️','🏨','🏗️','🌍'][item.category]}
      </div>)}
      {diagram.nodes.map(node=>{
       const done=isComplete(node);
       const missing=requirements(node),locked=missing.length>0&&!done;
       const partial=progressFor(node)>0&&!done;
       const next=!locked&&!done;
       const name=node.type==='starter'?STARTER_STAGES[node.level-1].name:
        projects.find(p=>p.id===node.projectId)?.name??node.projectId;
       return <button key={node.id} type="button"
        className={'rv5-node'+(done?' completed':'')+(locked?' locked':'')+(next?' researching':'')+(partial?' partial':'')+(focused===node.id?' focused':'')}
        style={{left:node.x,top:node.y}} onClick={()=>setFocused(node.id)}
        title={name+' · Level '+node.level}
        aria-pressed={focused===node.id}
        aria-label={name+' Level '+node.level+' · '+(done?'Unlocked':locked?'Locked':'Progressing automatically')}>
        <span className="rv5-node-glyph">{node.type==='starter'?starterIcon[node.level]:RESEARCH_GLYPHS[node.projectId]??'🔬'}</span>
        {locked?<LockKeyhole className="rv5-node-lock" size={15}/>:done?<CheckCircle2 className="rv5-node-check" size={14}/>:null}
        <span className="rv5-node-level">{node.type==='starter'?'S':'L'}{node.level}</span>
       </button>;
      })}
     </div>
    </div>
   </div>
   <div className="rv5-caption"><span>🟩 Completed</span><span>🟦 Gathering resources</span><span>🔒 Locked</span><span>Automatic · pan and zoom</span></div>
  </>}
  {tab==='resources'&&<section className="rv5-view">
   <h2>Your research resources</h2><p>All sources contribute automatically to available technology levels. Resources are counted once and never require manual delivery.</p>
   <div className="rv5-resource-list">{resourceKeys.map(key=><div key={key} className="rv5-resource-row">
    <span className="rv5-resource-emoji">{RESEARCH_RESOURCE_GLYPHS[key]}</span>
    <div><strong>{RESOURCE_INFO[key].name}</strong><small>{RESOURCE_INFO[key].unit} · {exact(key,earned[key])} earned altogether</small></div>
    <b>{exact(key,inventory[key])}</b>
   </div>)}</div>
   <p>Starter levels use cumulative jobs and operating revenue. Technology levels automatically consume research resources as they're supplied, never your bank balance.</p>
   <button type="button" className="rv5-back" onClick={()=>setTab('tree')}><GitBranch size={16}/> Back to technology tree</button>
  </section>}
  {tab==='completed'&&<section className="rv5-view">
   <h2>Unlocked research levels</h2><p>{completed} of {diagram.nodes.length} levels complete. Each green node has its own requirements and unlock conditions.</p>
   <div className="rv5-unlocked-list">{diagram.nodes.filter(isComplete).map(node=><button type="button" key={node.id}
    onClick={()=>{setFocused(node.id);setTab('tree');jumpTo(node.id);}}>
    <span>{node.type==='starter'?starterIcon[node.level]:RESEARCH_GLYPHS[node.projectId]??'🔬'}</span>
    <strong>{node.type==='starter'?STARTER_STAGES[node.level-1].name:
     projects.find(p=>p.id===node.projectId)?.name??node.projectId}</strong><small>Lv {node.level}</small>
   </button>)}</div>
   <button type="button" className="rv5-back" onClick={()=>setTab('tree')}><GitBranch size={16}/> Return to technology tree</button>
  </section>}
  {tab==='tree'&&selected&&<aside className="rv5-details" aria-label="Technology level details">
   <header><div className="rv5-detail-icon">
    {selected.type==='starter'?starterIcon[selected.level]:RESEARCH_GLYPHS[selected.projectId]??'🔬'}
   </div><div><small>{selected.type==='starter'?'Starter progression':ADVANCED_CATEGORIES[selectedProject?.category??0]}</small>
    <h2>{selected.type==='starter'?STARTER_STAGES[selected.level-1].name:selectedProject?.name}</h2>
    <span>Level {selected.level} · {isComplete(selected)?'Unlocked':selectedMissing.length?'Prerequisites locked':'Automatically collecting resources'}</span>
   </div><button type="button" aria-label="Close level details" onClick={()=>setFocused(null)}><X size={20}/></button></header>
   <p>{selected.type==='starter'?STARTER_STAGES[selected.level-1].unlocks:selectedProject?.effect}</p>
   {isComplete(selected)?<div className="rv5-unlocked-note"><CheckCircle2 size={17}/> Level completed. The next connected level is available automatically.</div>:<>
    {selectedMissing.length>0&&<div className="rv5-missing"><strong>Unlock these first</strong>
     {selectedMissing.map(item=><div key={item}><LockKeyhole size={13}/>{item}</div>)}</div>}
    <div className="rv5-detail-progress"><span>Requirements collected automatically</span><b>{progressFor(selected)}%</b></div>
    <div className="rv5-detail-resources">{resourceKeys.filter(key=>(selectedCosts[key]??0)>0).map(key=>{
     const needed=selectedCosts[key]??0;
     const delivered=Math.min(needed,selectedDelivered[key]??0);
     return <div key={key}><span>{RESEARCH_RESOURCE_GLYPHS[key]} {RESOURCE_INFO[key].name}</span>
      <strong>{exact(key,delivered)} / {exact(key,needed)}</strong>
      <div className="rv5-bar"><i style={{width:(needed?delivered/needed*100:0)+'%'}}/></div>
      <small>{selected.type==='starter'?'Cumulative operational milestone':
       exact(key,inventory[key])+' still in inventory'}</small>
     </div>;
    })}</div>
    <div className="rv5-auto-message">Progress is automatic. Resources flow to eligible technologies as your company operates.</div>
   </>}
  </aside>}
  {!company&&<p className="rv5-auto-message">Create a company to start your research tree.</p>}
 </section>;
}
