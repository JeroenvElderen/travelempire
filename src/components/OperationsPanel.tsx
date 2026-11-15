import {useMemo,useState} from 'react';
import {Activity,Compass,Route,Settings2,TrendingUp,Users,Wallet,CarFront,Layers3,ChevronDown,ChevronUp} from 'lucide-react';
import {demandAt} from '../simulation/demand';
import type {FleetState,RoadGraph} from '../simulation/taxi';
import './operations.css';
import './operations-floating.css';

type Tab='overview'|'exploration'|'diagnostics';
type Props={fleet:FleetState;graph:RoadGraph|null;missionCount:number;roadPackages:number;diagnostics:{queued:number;edges:number;workerEdges:number};error:string};
const money=(n:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(n);
const number=(n:number)=>new Intl.NumberFormat('en-IE').format(n);

export default function OperationsPanel({fleet,graph,missionCount,roadPackages,diagnostics,error}:Props){
 const [tab,setTab]=useState<Tab>('overview');
 const [expandedExplorer,setExpandedExplorer]=useState<string|null>(null);
 const [showDispatchRules,setShowDispatchRules]=useState(false);
 const explorers=fleet.taxis.filter(t=>t.kind==='explorer');
 const taxis=fleet.taxis.filter(t=>!t.kind||t.kind==='taxi');
 const activeTaxis=taxis.filter(t=>t.status!=='IDLE'&&t.status!=='PAUSED').length;
 const demand=demandAt(Date.now(),taxis.length);
 const coverage=useMemo(()=>{
  if(!graph)return null;
  const roads=new Set<string>();
  for(const links of graph.edges.values())for(const edge of links)roads.add(edge.id);
  if(!roads.size)return 0;
  const discovered=new Set(fleet.exploredEdgeIds??[]);
  let count=0;
  for(const id of roads)if(discovered.has(id))count++;
  return 100*count/roads.size;
 },[graph,fleet.exploredEdgeIds]);
 const uniqueKm=explorers.reduce((sum,t)=>sum+(t.uniqueDiscoveredKm??0),0);
 const travelledKm=explorers.reduce((sum,t)=>sum+(t.discoveredKm??0),0);
 const exploring=explorers.filter(t=>t.status==='EXPLORING').length;
 return <section className="ops-page ops-v2" aria-label="Operations center">
  <header className="ops-head">
   <span className="ops-head-icon"><Activity size={23}/></span>
   <div><h1>Operations</h1><p>Live dispatch &amp; network</p></div>
  </header>
  <nav className="ops-tabs" role="tablist" aria-label="Operations sections">
   {([['overview','Overview',Activity],['exploration','Exploration',Compass],['diagnostics','Diagnostics',Settings2]] as const).map(([key,label,Icon])=>
    <button key={key} type="button" role="tab" aria-selected={tab===key} aria-label={label} className={tab===key?'active':''} onClick={()=>setTab(key)}><Icon size={19}/><span>{tab===key?label:''}</span></button>)}
  </nav>
  {error&&<div className="ops-alert" role="alert">{error}</div>}
  {tab==='overview'&&<div className="ops-content" role="tabpanel">
   <div className="ops-quick-stats" aria-label="Dispatch summary">
    <span><CarFront size={15}/><strong>{activeTaxis}</strong> active</span>
    <span><Users size={15}/><strong>{missionCount}</strong> requests</span>
    <span><strong>{number(fleet.completed)}</strong> trips</span>
   </div>
   <div className="ops-section-heading"><h2>Live operations</h2><small>{taxis.length} passenger taxis</small></div>
   <div className="ops-panel-grid">
    <article className="ops-card">
     <div className="ops-card-head"><div className="ops-card-label"><TrendingUp size={17}/><strong>Revenue</strong></div></div>
     <strong className="ops-card-emphasis">{money(fleet.revenue)}</strong>
     <span className="ops-card-note">Lifetime passenger fares</span>
    </article>
    <article className="ops-card">
     <div className="ops-card-head"><div className="ops-card-label"><Users size={17}/><strong>Demand</strong></div></div>
     <strong className="ops-card-emphasis">{demand.level}</strong>
     <span className="ops-card-note">{demand.fareMultiplier.toFixed(2)}× fare · {demand.weekend?'Weekend':'Weekday'}</span>
    </article>
   </div>
   <article className="ops-card">
    <div className="ops-card-head">
     <div className="ops-card-label"><Route size={17}/><strong>Discovered network</strong></div>
     <strong className="ops-card-emphasis">{coverage===null?'Loading':coverage.toFixed(1)+'%'}</strong>
    </div>
    <div className="ops-progress" role="progressbar" aria-label="Coverage of currently loaded roads" aria-valuenow={coverage??0} aria-valuemin={0} aria-valuemax={100}><div style={{width:`${Math.max(0,Math.min(100,coverage??0))}%`}}/></div>
    <div className="ops-card-row"><span>Discovered road IDs</span><strong>{number((fleet.exploredEdgeIds??[]).length)}</strong></div>
    <span className="ops-card-note">Coverage of loaded road data, not all roads in Greece.</span>
   </article>
   <button type="button" className="ops-detail-toggle" aria-expanded={showDispatchRules} onClick={()=>setShowDispatchRules(v=>!v)}>
    {showDispatchRules?'Hide dispatch details':'How dispatch works'}{showDispatchRules?<ChevronUp size={15}/>:<ChevronDown size={15}/>}
   </button>
   {showDispatchRules&&<div className="ops-card-note">Automatic dispatch runs while the game is open. Only discovered roads receive passenger requests. Waiting jobs are prioritised and available taxis are assigned by estimated driving time; requests expire after two minutes.</div>}
  </div>}
  {tab==='exploration'&&<div className="ops-content" role="tabpanel">
   <div className="ops-quick-stats" aria-label="Exploration summary">
    <span><Compass size={15}/><strong>{explorers.length}</strong> explorers</span>
    <span><strong>{exploring}</strong> active</span>
    <span><strong>{uniqueKm.toFixed(1)}</strong> km new</span>
   </div>
   <div className="ops-section-heading"><h2>Explorers</h2><small>{travelledKm.toFixed(1)} km driven</small></div>
   <div className="ops-explorer-list">
    {explorers.map(t=>{
     const isExpanded=expandedExplorer===t.id;
     return <article key={t.id} className="ops-explorer-mini">
      <div className="ops-explorer-head">
       <span className="ops-explorer-icon"><Compass size={19}/></span>
       <div className="ops-explorer-name"><strong>{t.name}</strong><small>Road discovery</small></div>
       <span className="ops-explorer-status">{t.status.replaceAll('_',' ').toLowerCase()}</span>
      </div>
      <div className="ops-explorer-summary"><span>New roads <strong>{(t.uniqueDiscoveredKm??0).toFixed(2)} km</strong></span><span>Driven <strong>{(t.discoveredKm??0).toFixed(1)} km</strong></span></div>
      {isExpanded&&<div className="ops-explorer-details"><span>Operating spend</span><strong>{money(t.explorationExpense??0)}</strong></div>}
      <div className="ops-explorer-actions"><button type="button" className="ops-detail-toggle" aria-expanded={isExpanded} onClick={()=>setExpandedExplorer(isExpanded?null:t.id)}>{isExpanded?'Less':'Details'}{isExpanded?<ChevronUp size={15}/>:<ChevronDown size={15}/>}</button></div>
     </article>;
    })}
    {!explorers.length&&<p className="ops-empty">No explorers yet. Purchase one from Fleet to start discovering roads.</p>}
   </div>
   <article className="ops-card">
    <div className="ops-card-row"><span>Total exploration spend</span><strong>{money(fleet.explorationExpense??0)}</strong></div>
   </article>
  </div>}
  {tab==='diagnostics'&&<div className="ops-content" role="tabpanel">
   <div className="ops-section-heading"><h2>Network health</h2><small>Currently loaded data</small></div>
   <div className="ops-stats-mini">
    <article className="ops-stat-mini"><span>Road tiles</span><strong>{number(roadPackages)}</strong></article>
    <article className="ops-stat-mini"><span>Queued loads</span><strong>{number(diagnostics.queued)}</strong></article>
    <article className="ops-stat-mini"><span>Routing edges</span><strong>{number(diagnostics.edges)}</strong></article>
    <article className="ops-stat-mini"><span>Worker edges</span><strong>{number(diagnostics.workerEdges)}</strong></article>
   </div>
   <div className="ops-section-heading"><h2>Loaded graph</h2><Layers3 size={17}/></div>
   <div className="ops-diagnostic-list">
    <div className="ops-diagnostic-row"><span>Graph nodes</span><strong>{graph?number(graph.nodeKeys.length):'Loading'}</strong></div>
    <div className="ops-diagnostic-row"><span>Discovered road IDs</span><strong>{number((fleet.exploredEdgeIds??[]).length)}</strong></div>
    <div className="ops-diagnostic-row"><span>Loaded network coverage</span><strong>{coverage===null?'Loading':coverage.toFixed(1)+'%'}</strong></div>
    <div className="ops-diagnostic-row"><span>Dispatch</span><strong>Automatic</strong></div>
   </div>
   <details className="ops-card ops-advanced"><summary>Additional information <ChevronDown size={15}/></summary>
    <div className="ops-extra">
     <div className="ops-card-row"><span>Exploration spend</span><strong>{money(fleet.explorationExpense??0)}</strong></div>
     <div className="ops-card-row"><span>Loaded tile packages</span><strong>{number(roadPackages)}</strong></div>
     <span className="ops-card-note">Network figures change as vehicles travel and new road tiles load.</span>
    </div>
   </details>
  </div>}
 </section>;
}
